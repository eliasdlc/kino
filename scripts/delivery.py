#!/usr/bin/env python3
"""Verify web artifacts before recording approval or production closure."""
import argparse
import datetime as dt
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import sys
import urllib.request
from urllib.parse import quote, urlparse

ROOT = Path(__file__).resolve().parents[1]
VENDOR = ROOT / 'scripts/vendor/delivery'


def load_core():
    manifest = json.loads((VENDOR / 'source.json').read_text())
    for name, digest in manifest['files'].items():
        if hashlib.sha256((VENDOR / name).read_bytes()).hexdigest() != digest:
            raise ValueError('DELIVERY_VENDOR: pinned source changed; update its provenance deliberately')
    spec = importlib.util.spec_from_file_location('delivery_core', VENDOR / 'delivery_events.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


core = load_core()


def config():
    return json.loads((ROOT / '.github/delivery.json').read_text())


def pull(number):
    return core.github('pr', 'view', str(number), '--json', 'number,state,headRefOid,headRefName,baseRefName,mergeCommit,url,isCrossRepository')


def inspect(identifier):
    identifier = identifier.removeprefix('https://').rstrip('/')
    if not re.fullmatch(r'[A-Za-z0-9_.-]+', identifier):
        raise ValueError('DELIVERY_URL: expected deployment ID or hostname')
    result = core.command('npx', '--yes', 'vercel', 'api', '/v13/deployments/' + quote(identifier), '--raw')
    return json.loads(result.stdout)


def identity(deployment, sha, branch, settings, production=False):
    meta = deployment.get('meta', {})
    if deployment.get('projectId') != settings['vercelProjectId']:
        raise ValueError('DELIVERY_PROJECT: wrong Vercel project')
    if deployment.get('readyState') != 'READY':
        raise ValueError('DELIVERY_READY: deployment is not ready')
    if meta.get('githubCommitSha') != sha or meta.get('githubCommitRef') != branch:
        raise ValueError('DELIVERY_SHA: deployment does not match the exact source and branch')
    if f'{meta.get("githubCommitOrg")}/{meta.get("githubCommitRepo")}' != settings['repository']:
        raise ValueError('DELIVERY_REPOSITORY: wrong source repository')
    if deployment.get('target') not in ({'production'} if production else {None, 'preview'}):
        raise ValueError('DELIVERY_ENVIRONMENT: preview and production are different gates')
    url = deployment.get('url', '')
    if not re.fullmatch(r'[A-Za-z0-9-]+\.vercel\.app', url) or not str(deployment.get('id', '')).startswith('dpl_'):
        raise ValueError('DELIVERY_URL: immutable Vercel deployment identity required')
    # Never retain the raw Vercel response: it can contain private environment data.
    return {'id': deployment['id'], 'url': 'https://' + url, 'sha': sha, 'branch': branch,
            'projectId': deployment['projectId'], 'environment': 'production' if production else 'preview'}


def current_preview(number, deployment_id):
    pr = pull(number)
    settings = config()
    if pr['state'] != 'OPEN' or pr['baseRefName'] != settings['productionBranch'] or pr['isCrossRepository']:
        raise ValueError('DELIVERY_PR: use an internal open PR targeting main')
    return pr, identity(inspect(deployment_id), pr['headRefOid'], pr['headRefName'], settings)


def check_event(event, pr, deployment):
    core.validate(event)
    if event['kind'] != 'accepted':
        raise ValueError('DELIVERY_KIND: acceptance required')
    if event['pr'] != pr['number'] or event['sourceSha'] != pr['headRefOid']:
        raise ValueError('DELIVERY_STALE: approval is for an older PR head')
    if event.get('deployment') != deployment or event['artifactUrl'] != deployment['url']:
        raise ValueError('DELIVERY_ARTIFACT: approval does not identify this immutable preview')


def accepted_preview(events, pr):
    if pr['baseRefName'] != config()['productionBranch'] or pr['isCrossRepository']:
        raise ValueError('DELIVERY_PR: acceptance requires an internal PR targeting main')
    accepted = core.approval(events, pr['number'], pr['headRefOid'])
    if not accepted:
        raise ValueError('DELIVERY_APPROVAL: current head has no active acceptance')
    settings = config()
    for event in accepted:
        deployment = event.get('deployment', {})
        if (deployment.get('sha') != pr['headRefOid'] or
                deployment.get('branch') != pr['headRefName'] or
                deployment.get('projectId') != settings['vercelProjectId'] or
                deployment.get('environment') != 'preview' or
                not str(deployment.get('id', '')).startswith('dpl_') or
                not re.fullmatch(r'https://[A-Za-z0-9-]+\.vercel\.app', deployment.get('url', ''))):
            raise ValueError('DELIVERY_ARTIFACT: acceptance requires a matching immutable preview')
        check_event(event, pr, deployment)
    return accepted


def health(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'delivery-verification/1'})
    with urllib.request.urlopen(request, timeout=30) as response:
        status = response.status
        final_url = response.url
        if status != 200 or urlparse(final_url).hostname not in {urlparse(url).hostname, 'www.' + urlparse(url).hostname}:
            raise ValueError('DELIVERY_HEALTH: expected HTTP 200 on the production domain')
        return {'url': url, 'finalUrl': final_url, 'status': status}


def auth_health():
    result = core.command('pnpm', 'check:auth-production')
    providers = sorted(line.removesuffix(': configured') for line in result.stdout.splitlines()
                       if line.endswith(': configured'))
    if providers != ['github', 'google']:
        raise ValueError('DELIVERY_AUTH: production social providers did not pass their redirect checks')
    return {'command': 'pnpm check:auth-production', 'providers': providers, 'status': 'passed'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='action', required=True)
    prepare = sub.add_parser('prepare')
    prepare.add_argument('--pr', type=int, required=True)
    prepare.add_argument('--deployment', required=True)
    prepare.add_argument('--by', required=True)
    prepare.add_argument('--requirement', action='append', required=True)
    prepare.add_argument('--ticket', action='append', required=True)
    prepare.add_argument('--output', type=Path, required=True)
    record = sub.add_parser('record')
    record.add_argument('event', type=Path)
    verify = sub.add_parser('preview')
    verify.add_argument('--pr', type=int, required=True)
    verify.add_argument('--deployment', required=True)
    production = sub.add_parser('production')
    production.add_argument('--pr', type=int, required=True)
    production.add_argument('--publish', action='store_true')
    check = sub.add_parser('check-pr')
    check.add_argument('pr', type=int)
    check.add_argument('--status', action='store_true')
    passthrough = sub.add_parser('events')
    passthrough.add_argument('arguments', nargs=argparse.REMAINDER)
    args = parser.parse_args()
    try:
        if args.action == 'events':
            if not args.arguments or args.arguments[0] not in {'project', 'pending-projections', 'check-release'}:
                raise ValueError('DELIVERY_COMMAND: use the web commands to validate approval artifacts')
            sys.argv = ['delivery_events.py', *args.arguments]
            return core.main()
        if args.action in {'prepare', 'preview'}:
            pr, deployment = current_preview(args.pr, args.deployment)
            if args.action == 'preview':
                print(json.dumps(deployment, indent=2))
                return 0
            event = core.seal(dict(schemaVersion=1, kind='accepted', pr=args.pr,
                                  sourceSha=pr['headRefOid'], artifactSha=pr['headRefOid'],
                                  artifactUrl=deployment['url'], deployment=deployment,
                                  ownerQuote=args.by, actor=core.github('api', 'user')['login'],
                                  requirementIds=args.requirement, tickets=args.ticket,
                                  timestamp=dt.datetime.now(dt.timezone.utc).isoformat()))
            check_event(event, pr, deployment)
            with args.output.open('x') as file:
                file.write(json.dumps(event, indent=2) + '\n')
            print(args.output)
            return 0
        if args.action == 'record':
            event = json.loads(args.event.read_text())
            core.validate(event)
            store = core.Store()
            _, existing = store.read(allow_missing=True)
            if event['actor'] != core.github('api', 'user')['login']:
                raise ValueError('DELIVERY_ACTOR: authenticated recorder differs')
            if not any(e['eventId'] == event['eventId'] for e in existing):
                if event['kind'] == 'accepted':
                    pr, deployment = current_preview(event['pr'], event['deployment']['id'])
                    check_event(event, pr, deployment)
                # Other kinds are validated against their immutable target by Store.
            print(store.append(event))
            if event['kind'] in {'accepted', 'rejected', 'superseded'}:
                core.publish_status(store.read()[1], event['pr'])
            return 0
        pr = pull(args.pr)
        settings = config()
        if args.action == 'check-pr':
            try:
                accepted_preview(core.Store().read()[1], pr)
                error = None
            except (ValueError, KeyError) as exc:
                error = str(exc)
            if args.status:
                core.github('api', f'repos/{settings["repository"]}/statuses/{pr["headRefOid"]}',
                            '-f', 'context=owner-acceptance', '-f', 'state=' + ('failure' if error else 'success'),
                            '-f', 'description=' + ('Approval missing or invalid' if error else 'Exact preview approval recorded'))
            print(error or 'Accepted current preview')
            return 1 if error else 0
        if pr['state'] != 'MERGED' or pr['baseRefName'] != settings['productionBranch']:
            raise ValueError('DELIVERY_MERGE: production closure requires a merged main PR')
        _, events = core.Store().read()
        accepted_preview(events, pr)
        main_sha = core.github('api', f'repos/{settings["repository"]}/commits/{settings["productionBranch"]}')['sha']
        if not core.contains(pr['mergeCommit']['oid'], main_sha):
            raise ValueError('DELIVERY_MERGE: main does not include this PR')
        live = inspect(settings['productionDomain'])
        deployment = identity(live, main_sha, settings['productionBranch'], settings, production=True)
        receipt = {'pr': args.pr, 'reviewedSha': pr['headRefOid'], 'mergeSha': pr['mergeCommit']['oid'],
                   'deployment': deployment, 'health': health('https://' + settings['productionDomain']),
                   'authHealth': auth_health(),
                   'observedAt': dt.datetime.now(dt.timezone.utc).isoformat()}
        # Resolve the alias again after the HTTP probe so a moving production
        # domain cannot silently attach the health result to a different build.
        if (inspect(settings['productionDomain'])['id'] != deployment['id'] or
                core.github('api', f'repos/{settings["repository"]}/commits/{settings["productionBranch"]}')['sha'] != main_sha):
            raise ValueError('DELIVERY_RACE: production changed during verification; retry')
        if args.publish:
            core.github('api', f'repos/{settings["repository"]}/statuses/{main_sha}', '-f', 'context=production-verification',
                        '-f', 'state=success', '-f', 'target_url=' + deployment['url'], '-f', 'description=Verified main deployment and production HTTP 200')
            core.command('gh', 'pr', 'comment', str(args.pr), '--body-file', '-', data='Production receipt:\n```json\n' + json.dumps(receipt, indent=2) + '\n```\n')
        print(json.dumps(receipt, indent=2))
        return 0
    except (ValueError, KeyError, OSError, subprocess.SubprocessError) as exc:
        print(str(exc), file=sys.stderr)
        return 2


if __name__ == '__main__':
    sys.exit(main())
