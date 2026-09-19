#!/usr/bin/env python3
"""Append delivery decisions to GitHub and check the exact release candidate."""
import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile

REF = 'refs/heads/delivery-events'
SHA = re.compile(r'[0-9a-f]{40}')
ID = re.compile(r'[0-9a-f]{64}')
KINDS = {'accepted', 'rejected', 'deferred', 'superseded', 'projected'}


def command(*args, data=None, check=True):
    result = subprocess.run(args, input=data, text=True, capture_output=True, timeout=90)
    if check and result.returncode:
        raise ValueError(f'{args[0]} failed (exit {result.returncode}); delivery state is unknown')
    return result


def git(*args, data=None):
    return command('git', *args, data=data).stdout.strip()


def github(*args):
    return json.loads(command('gh', *args).stdout)


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False)


def seal(event):
    body = {k: v for k, v in event.items() if k != 'eventId'}
    return {**body, 'eventId': hashlib.sha256(canonical(body).encode()).hexdigest()}


def validate(event):
    if not isinstance(event, dict) or type(event.get('schemaVersion')) is not int or event.get('schemaVersion') != 1:
        raise ValueError('DELIVERY_SCHEMA: expected schemaVersion 1')
    if event.get('kind') not in KINDS or event.get('eventId') != seal(event)['eventId']:
        raise ValueError('DELIVERY_INTEGRITY: unknown kind or changed event')
    for field in ['sourceSha', 'artifactSha']:
        if not SHA.fullmatch(str(event.get(field, ''))):
            raise ValueError(f'DELIVERY_IDENTITY: full {field} required')
    if event['sourceSha'] != event['artifactSha']:
        raise ValueError('DELIVERY_IDENTITY: artifact and reviewed source differ')
    for field in ['ownerQuote', 'artifactUrl', 'actor', 'timestamp']:
        if not isinstance(event.get(field), str) or not event[field].strip():
            raise ValueError(f'DELIVERY_SCHEMA: {field} required')
    if not event['artifactUrl'].startswith('https://'):
        raise ValueError('DELIVERY_ARTIFACT: HTTPS evidence URL required')
    when = dt.datetime.fromisoformat(event['timestamp'].replace('Z', '+00:00'))
    if when.tzinfo is None:
        raise ValueError('DELIVERY_TIME: timestamp requires a timezone')
    requirements = event.get('requirementIds')
    if not isinstance(requirements, list) or not requirements or any(not isinstance(r, str) or not r.strip() for r in requirements) or len(set(requirements)) != len(requirements):
        raise ValueError('DELIVERY_SCOPE: nonempty unique requirementIds required')
    if type(event.get('pr')) is not int or event['pr'] < 1:
        raise ValueError('DELIVERY_PR: positive PR number required')
    tickets = event.get('tickets')
    if not isinstance(tickets, list) or not tickets or any(not isinstance(t, str) or not re.fullmatch(r'https://projects\.zoho\.com/portal/[^/#]+#zp/task-detail/[0-9]+', t) for t in tickets):
        raise ValueError('DELIVERY_TICKETS: concrete Zoho task URLs required')
    if event['kind'] != 'accepted' and not ID.fullmatch(str(event.get('targetEventId', ''))):
        raise ValueError('DELIVERY_TARGET: disposition must name its acceptance event')
    if event['kind'] == 'deferred' and not SHA.fullmatch(str(event.get('candidateSha', ''))):
        raise ValueError('DELIVERY_DEFERRAL: name the exact candidate being authorized')
    if event['kind'] == 'superseded' and not ID.fullmatch(str(event.get('replacementEventId', ''))):
        raise ValueError('DELIVERY_REPLACEMENT: name the replacement acceptance event')
    if event['kind'] == 'projected' and not str(event.get('projectionUrl', '')).startswith('https://projects.zoho.com/'):
        raise ValueError('DELIVERY_PROJECTION: verified Zoho reference required')


def validate_stream(events):
    known = {}
    for event in events:
        validate(event)
        if event['eventId'] in known:
            raise ValueError('DELIVERY_DUPLICATE: duplicate event')
        if event['kind'] != 'accepted':
            target = known.get(event['targetEventId'])
            if target is None or target['kind'] != 'accepted' or any(event[k] != target[k] for k in ['sourceSha', 'artifactSha', 'pr', 'requirementIds', 'artifactUrl', 'tickets']):
                raise ValueError('DELIVERY_TARGET: disposition does not match its acceptance')
            if event['kind'] == 'superseded':
                replacement = known.get(event['replacementEventId'])
                if replacement is None or replacement['kind'] != 'accepted' or replacement['eventId'] == target['eventId'] or not set(target['requirementIds']) <= set(replacement['requirementIds']):
                    raise ValueError('DELIVERY_REPLACEMENT: replacement must cover the original scope')
        known[event['eventId']] = event
    return events


class Store:
    """One added, content-addressed JSON file per linear Git commit; no rewrites."""
    def __init__(self, remote='origin'):
        self.remote = remote

    def read(self, allow_missing=False):
        probe = command('git', 'ls-remote', '--exit-code', self.remote, REF, check=False)
        if probe.returncode == 2 and allow_missing:
            return None, []
        if probe.returncode:
            raise ValueError('DELIVERY_STORE: unavailable or not initialized; cannot assume no pending work')
        head = probe.stdout.split()[0]
        git('fetch', '--quiet', '--no-tags', self.remote, head)
        events = []
        for line in git('rev-list', '--reverse', '--parents', head).splitlines():
            parts = line.split()
            if len(parts) > 2:
                raise ValueError('DELIVERY_HISTORY: event stream cannot contain merge commits')
            changes = git('diff-tree', '--root', '--no-commit-id', '--name-status', '-r', parts[0]).splitlines()
            if len(changes) != 1 or not re.fullmatch(r'A\t[0-9a-f]{64}\.json', changes[0]):
                raise ValueError('DELIVERY_HISTORY: only one new event per commit is allowed')
            path = changes[0].split('\t')[1]
            event = json.loads(git('show', f'{parts[0]}:{path}'))
            if path != event.get('eventId', '') + '.json':
                raise ValueError('DELIVERY_INTEGRITY: filename differs from eventId')
            events.append(event)
        return head, validate_stream(events)

    def append(self, event):
        validate(event)
        for _ in range(4):
            head, events = self.read(allow_missing=True)
            if any(e['eventId'] == event['eventId'] for e in events):
                return head
            validate_stream([*events, event])
            entries = git('ls-tree', head).splitlines() if head else []
            blob = git('hash-object', '-w', '--stdin', data=canonical(event) + '\n')
            entries.append(f'100644 blob {blob}\t{event["eventId"]}.json')
            tree = git('mktree', data='\n'.join(sorted(entries, key=lambda x: x.split('\t')[1])) + '\n')
            parent = ['-p', head] if head else []
            commit = git('commit-tree', tree, *parent, data=f'delivery: {event["kind"]} {event["eventId"]}\n')
            pushed = command('git', 'push', self.remote, f'{commit}:{REF}', check=False)
            if pushed.returncode == 0:
                # A read-back also detects a concurrent malformed writer.
                self.read()
                return commit
        raise ValueError('DELIVERY_RETRY: concurrent update or write failure; retry the same event file')


def active_acceptances(events, candidate=None):
    validate_stream(events)
    retired = {e['targetEventId'] for e in events if e['kind'] in {'rejected', 'superseded'} or e['kind'] == 'deferred' and e['candidateSha'] == candidate}
    return [e for e in events if e['kind'] == 'accepted' and e['eventId'] not in retired]


def approval(events, pr, sha):
    return [e for e in active_acceptances(events) if e['pr'] == pr and e['sourceSha'] == sha]


def missing(events, candidate, contains, pull):
    absent = []
    for event in active_acceptances(events, candidate):
        if contains(event['sourceSha'], candidate):
            continue
        pr = pull(event['pr'])
        # A squash includes only the PR head actually merged, not an earlier approval.
        merged = pr.get('mergeCommit')
        if pr.get('state') == 'MERGED' and pr.get('headRefOid') == event['sourceSha'] and merged and contains(merged['oid'], candidate):
            continue
        absent.append(event)
    return absent


def contains(source, candidate):
    for sha in [source, candidate]:
        if command('git', 'cat-file', '-e', f'{sha}^{{commit}}', check=False).returncode:
            git('fetch', '--quiet', '--no-tags', 'origin', sha)
    result = command('git', 'merge-base', '--is-ancestor', source, candidate, check=False)
    if result.returncode not in (0, 1):
        raise ValueError('DELIVERY_ANCESTRY: unknown commit relationship')
    return result.returncode == 0


def pull(number):
    return github('pr', 'view', str(number), '--json', 'number,state,headRefOid,mergeCommit,url,baseRefName')


def pending_projections(events):
    acknowledged = {e['targetEventId'] for e in events if e['kind'] == 'projected'}
    return [e for e in events if e['kind'] == 'accepted' and e['eventId'] not in acknowledged]


def verify_receipt(receipt, sha):
    required = ['sha', 'runId', 'runAttempt', 'runUrl', 'versionName', 'versionCode', 'package',
                'releaseUrl', 'groups', 'utc', 'local', 'authorization']
    if any(not receipt.get(k) for k in required) or receipt['sha'] != sha:
        raise ValueError('DELIVERY_RECEIPT: incomplete or not the reviewed SHA')
    with tempfile.TemporaryDirectory(prefix='delivery-receipt-') as directory:
        command('gh', 'run', 'download', str(receipt['runId']), '--name',
                f'release-receipt-{receipt["runId"]}-{receipt["runAttempt"]}', '--dir', directory)
        trusted = json.loads((Path(directory) / 'release-receipt.json').read_text())
        if any(trusted.get(k) != receipt[k] for k in required):
            raise ValueError('DELIVERY_RECEIPT: supplied receipt differs from GitHub artifact')


def publish_status(events, number):
    pr = pull(number)
    accepted = approval(events, number, pr['headRefOid'])
    repo = github('repo', 'view', '--json', 'nameWithOwner')['nameWithOwner']
    github('api', f'repos/{repo}/statuses/{pr["headRefOid"]}', '-f', 'context=owner-acceptance',
           '-f', 'state=' + ('success' if accepted else 'failure'),
           '-f', 'description=' + ('Owner quote recorded for this exact SHA' if accepted else 'No acceptance for this exact SHA'))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='action', required=True)
    prepare = sub.add_parser('prepare')
    prepare.add_argument('--pr', required=True, type=int)
    prepare.add_argument('--by', required=True)
    prepare.add_argument('--requirement', action='append', required=True)
    prepare.add_argument('--ticket', action='append', required=True)
    prepare.add_argument('--output', required=True, type=Path)
    artifact = prepare.add_mutually_exclusive_group(required=True)
    artifact.add_argument('--receipt', type=Path)
    artifact.add_argument('--code-only', action='store_true')
    project = sub.add_parser('project')
    project.add_argument('--adapter', required=True, type=Path)
    project.add_argument('--adapter-arg', action='append', default=[])
    record = sub.add_parser('record')
    record.add_argument('event', type=Path)
    check = sub.add_parser('check-pr')
    check.add_argument('pr', type=int)
    check.add_argument('--status', action='store_true')
    release = sub.add_parser('check-release')
    release.add_argument('--sha', required=True)
    release.add_argument('--notes', action='store_true')
    sub.add_parser('pending-projections')
    args = parser.parse_args()
    try:
        store = Store()
        if args.action == 'prepare':
            pr = pull(args.pr)
            if pr['state'] != 'OPEN':
                raise ValueError('DELIVERY_PR: prepare acceptance for an open PR')
            event = dict(schemaVersion=1, kind='accepted', sourceSha=pr['headRefOid'],
                         artifactSha=pr['headRefOid'], artifactUrl=pr['url'] + '/commits/' + pr['headRefOid'],
                         ownerQuote=args.by, actor=github('api', 'user')['login'],
                         timestamp=dt.datetime.now(dt.timezone.utc).isoformat(),
                         requirementIds=args.requirement, tickets=args.ticket, pr=args.pr)
            if args.receipt:
                receipt = json.loads(args.receipt.read_text())
                verify_receipt(receipt, pr['headRefOid'])
                run = github('run', 'view', str(receipt['runId']), '--json', 'conclusion,headSha,url')
                # workflow_dispatch may run a resolver from main; the receipt is
                # the source identity, while the run proves the upload completed.
                if run['conclusion'] != 'success' or run['url'] != receipt['runUrl']:
                    raise ValueError('DELIVERY_RECEIPT: upload run is not successful')
                event.update(artifactUrl=receipt['releaseUrl'], receipt=receipt)
            validate(seal(event))
            with args.output.open('x') as file:
                file.write(json.dumps(seal(event), indent=2) + '\n')
            print(args.output)
            return 0
        if args.action == 'record':
            event = json.loads(args.event.read_text())
            validate(event)
            actor = github('api', 'user')['login']
            if event['actor'] != actor:
                raise ValueError('DELIVERY_ACTOR: recorder differs from authenticated GitHub account')
            _, existing = store.read(allow_missing=True)
            already_recorded = any(e['eventId'] == event['eventId'] for e in existing)
            if event['kind'] == 'accepted' and not already_recorded:
                pr = pull(event['pr'])
                if pr['headRefOid'] != event['sourceSha'] or pr['state'] != 'OPEN':
                    raise ValueError('DELIVERY_STALE: approve the current open PR head')
                if 'receipt' in event:
                    verify_receipt(event['receipt'], event['sourceSha'])
                    if event['receipt']['releaseUrl'] != event['artifactUrl']:
                        raise ValueError('DELIVERY_RECEIPT: artifact URL differs from receipt')
                elif event['artifactUrl'] != pr['url'] + '/commits/' + event['sourceSha']:
                    raise ValueError('DELIVERY_ARTIFACT: code-only evidence must name the exact PR commit')
            print(store.append(event))
            if event['kind'] in {'accepted', 'rejected', 'superseded'}:
                _, current = store.read()
                publish_status(current, event['pr'])
            return 0
        _, events = store.read()
        if args.action == 'project':
            for event in pending_projections(events):
                result = command(str(args.adapter.expanduser().resolve()), *args.adapter_arg, data=canonical(event))
                receipt = json.loads(result.stdout)
                if receipt.get('eventId') != event['eventId'] or receipt.get('verifiedTickets') != event['tickets']:
                    raise ValueError('DELIVERY_PROJECTION: adapter did not verify every linked ticket')
                projected = seal({**event, 'kind': 'projected', 'targetEventId': event['eventId'],
                                  'projectionUrl': event['tickets'][0]})
                store.append(projected)
            print('All acceptance projections acknowledged')
            return 0
        if args.action == 'pending-projections':
            print(json.dumps(pending_projections(events), indent=2))
            return 1 if pending_projections(events) else 0
        if args.action == 'check-release':
            if not SHA.fullmatch(args.sha):
                raise ValueError('DELIVERY_CANDIDATE: full candidate SHA required')
            absent = missing(events, args.sha, contains, pull)
            deferred = [e for e in events if e['kind'] == 'deferred' and e['candidateSha'] == args.sha]
            if args.notes:
                for title, rows in [('Accepted work missing from this build', absent), ('Explicitly deferred from this build', deferred)]:
                    if rows:
                        print(title + ':')
                        for event in rows:
                            print(f'- PR #{event["pr"]}: {", ".join(event["requirementIds"])}; owner: {event["ownerQuote"]}')
            else:
                print(json.dumps({'candidateSha': args.sha, 'missingAccepted': absent, 'deferred': deferred}, indent=2))
            return 1 if absent else 0
        pr = pull(args.pr)
        accepted = approval(events, args.pr, pr['headRefOid'])
        if args.status:
            publish_status(events, args.pr)
        print('Accepted current head' if accepted else 'DELIVERY_APPROVAL: current head is not accepted')
        return 0 if accepted else 1
    except (ValueError, KeyError, OSError, subprocess.SubprocessError) as exc:
        print(str(exc), file=sys.stderr)
        return 2


if __name__ == '__main__':
    sys.exit(main())
