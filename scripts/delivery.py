#!/usr/bin/env python3
"""Check PR branch routing and verify production closure after a release merge."""
import argparse
import datetime as dt
import json
from pathlib import Path
import re
import subprocess
import sys
import urllib.request
from urllib.parse import quote, urlparse

ROOT = Path(__file__).resolve().parents[1]


def command(*args, data=None, check=True):
    result = subprocess.run(args, input=data, text=True, capture_output=True, timeout=90)
    if check and result.returncode:
        raise ValueError(f'{args[0]} failed (exit {result.returncode}); delivery state is unknown')
    return result


def github(*args):
    return json.loads(command('gh', *args).stdout)


def contains(source, candidate):
    for sha in [source, candidate]:
        if command('git', 'cat-file', '-e', f'{sha}^{{commit}}', check=False).returncode:
            command('git', 'fetch', '--quiet', '--no-tags', 'origin', sha)
    result = command('git', 'merge-base', '--is-ancestor', source, candidate, check=False)
    if result.returncode not in (0, 1):
        raise ValueError('DELIVERY_ANCESTRY: unknown commit relationship')
    return result.returncode == 0


def config():
    return json.loads((ROOT / '.github/delivery.json').read_text())


def pull(number):
    return github('pr', 'view', str(number), '--json', 'number,state,headRefOid,headRefName,baseRefName,mergeCommit,url,isCrossRepository')


def inspect(identifier):
    identifier = identifier.removeprefix('https://').rstrip('/')
    if not re.fullmatch(r'[A-Za-z0-9_.-]+', identifier):
        raise ValueError('DELIVERY_URL: expected deployment ID or hostname')
    result = command('npx', '--yes', 'vercel', 'api', '/v13/deployments/' + quote(identifier), '--raw')
    return json.loads(result.stdout)


def identity(deployment, sha, branch, settings):
    meta = deployment.get('meta', {})
    if deployment.get('projectId') != settings['vercelProjectId']:
        raise ValueError('DELIVERY_PROJECT: wrong Vercel project')
    if deployment.get('readyState') != 'READY':
        raise ValueError('DELIVERY_READY: deployment is not ready')
    if meta.get('githubCommitSha') != sha or meta.get('githubCommitRef') != branch:
        raise ValueError('DELIVERY_SHA: deployment does not match the exact source and branch')
    if f'{meta.get("githubCommitOrg")}/{meta.get("githubCommitRepo")}' != settings['repository']:
        raise ValueError('DELIVERY_REPOSITORY: wrong source repository')
    if deployment.get('target') != 'production':
        raise ValueError('DELIVERY_ENVIRONMENT: production deployment required')
    url = deployment.get('url', '')
    if not re.fullmatch(r'[A-Za-z0-9-]+\.vercel\.app', url) or not str(deployment.get('id', '')).startswith('dpl_'):
        raise ValueError('DELIVERY_URL: immutable Vercel deployment identity required')
    # Never retain the raw Vercel response: it can contain private environment data.
    return {'id': deployment['id'], 'url': 'https://' + url, 'sha': sha, 'branch': branch,
            'projectId': deployment['projectId'], 'environment': 'production'}


def validate_topology(pr):
    settings = config()
    base, head = pr['baseRefName'], pr['headRefName']
    integration, production = settings['integrationBranch'], settings['productionBranch']
    if pr['isCrossRepository'] or not (
            (base == integration and head not in {integration, production}) or
            (base == production and head == integration)):
        raise ValueError('DELIVERY_BRANCH: task branches target dev; only dev releases target main')


def health(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'delivery-verification/1'})
    with urllib.request.urlopen(request, timeout=30) as response:
        status = response.status
        final_url = response.url
        if status != 200 or urlparse(final_url).hostname not in {urlparse(url).hostname, 'www.' + urlparse(url).hostname}:
            raise ValueError('DELIVERY_HEALTH: expected HTTP 200 on the production domain')
        return {'url': url, 'finalUrl': final_url, 'status': status}


def auth_health():
    result = command('pnpm', 'check:auth-production')
    providers = sorted(line.removesuffix(': configured') for line in result.stdout.splitlines()
                       if line.endswith(': configured'))
    if providers != ['github', 'google']:
        raise ValueError('DELIVERY_AUTH: production social providers did not pass their redirect checks')
    return {'command': 'pnpm check:auth-production', 'providers': providers, 'status': 'passed'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='action', required=True)
    production = sub.add_parser('production')
    production.add_argument('--pr', type=int, required=True)
    production.add_argument('--publish', action='store_true')
    branch = sub.add_parser('check-branch')
    branch.add_argument('pr', type=int)
    branch.add_argument('--status', action='store_true')
    args = parser.parse_args()
    try:
        pr = pull(args.pr)
        settings = config()
        if args.action == 'check-branch':
            try:
                validate_topology(pr)
                error = None
            except ValueError as exc:
                error = str(exc)
            if args.status:
                github('api', f'repos/{settings["repository"]}/statuses/{pr["headRefOid"]}',
                       '-f', 'context=branch-model', '-f', 'state=' + ('failure' if error else 'success'),
                       '-f', 'description=' + ('Invalid branch route' if error else 'Task to dev or dev to main'))
            print(error or 'Branch route valid')
            return 1 if error else 0
        if pr['state'] != 'MERGED' or pr['baseRefName'] != settings['productionBranch']:
            raise ValueError('DELIVERY_MERGE: production closure requires a merged main PR')
        validate_topology(pr)
        main_sha = github('api', f'repos/{settings["repository"]}/commits/{settings["productionBranch"]}')['sha']
        if not contains(pr['mergeCommit']['oid'], main_sha):
            raise ValueError('DELIVERY_MERGE: main does not include this PR')
        live = inspect(settings['productionDomain'])
        deployment = identity(live, main_sha, settings['productionBranch'], settings)
        receipt = {'pr': args.pr, 'reviewedSha': pr['headRefOid'], 'mergeSha': pr['mergeCommit']['oid'],
                   'deployment': deployment, 'health': health('https://' + settings['productionDomain']),
                   'authHealth': auth_health(),
                   'observedAt': dt.datetime.now(dt.timezone.utc).isoformat()}
        # Resolve the alias again after the HTTP probe so a moving production
        # domain cannot silently attach the health result to a different build.
        if (inspect(settings['productionDomain'])['id'] != deployment['id'] or
                github('api', f'repos/{settings["repository"]}/commits/{settings["productionBranch"]}')['sha'] != main_sha):
            raise ValueError('DELIVERY_RACE: production changed during verification; retry')
        if args.publish:
            github('api', f'repos/{settings["repository"]}/statuses/{main_sha}', '-f', 'context=production-verification',
                   '-f', 'state=success', '-f', 'target_url=' + deployment['url'], '-f', 'description=Verified main deployment and production HTTP 200')
            command('gh', 'pr', 'comment', str(args.pr), '--body-file', '-', data='Production receipt:\n```json\n' + json.dumps(receipt, indent=2) + '\n```\n')
        print(json.dumps(receipt, indent=2))
        return 0
    except (ValueError, KeyError, OSError, subprocess.SubprocessError) as exc:
        print(str(exc), file=sys.stderr)
        return 2


if __name__ == '__main__':
    sys.exit(main())
