#!/usr/bin/env python3
"""Project one acceptance to Zoho through the host's authenticated MCP launcher."""
import argparse
import html
import json
from pathlib import Path
import select
import subprocess
import sys
import time


class Zoho:
    def __init__(self, launcher):
        self.process = subprocess.Popen([str(launcher)], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                        stderr=subprocess.DEVNULL, text=True)
        self.sequence = 0
        self.rpc('initialize', {'protocolVersion': '2024-11-05', 'capabilities': {},
                               'clientInfo': {'name': 'delivery-projection', 'version': '1'}})
        self.process.stdin.write(json.dumps({'jsonrpc': '2.0', 'method': 'notifications/initialized'}) + '\n')
        self.process.stdin.flush()

    def rpc(self, method, params):
        self.sequence += 1
        self.process.stdin.write(json.dumps({'jsonrpc': '2.0', 'id': self.sequence, 'method': method, 'params': params}) + '\n')
        self.process.stdin.flush()
        deadline = time.monotonic() + 40
        while time.monotonic() < deadline:
            if select.select([self.process.stdout], [], [], 1)[0]:
                line = self.process.stdout.readline()
                if not line:
                    raise ValueError('Zoho connection closed; projection remains pending')
                result = json.loads(line)
                if result.get('id') != self.sequence:
                    continue
                if result.get('error') or result.get('result', {}).get('isError'):
                    raise ValueError('Zoho rejected the request; projection remains pending')
                return result['result']
        raise ValueError('Zoho timed out; projection remains pending')

    def call(self, name, arguments):
        result = self.rpc('tools/call', {'name': 'ZohoProjects_' + name, 'arguments': arguments})
        if 'structuredContent' in result:
            return result['structuredContent']['data']
        return json.loads(result['content'][0]['text'])

    def close(self):
        self.process.terminate()
        try:
            self.process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            self.process.kill()
            self.process.wait()


def comments(data):
    if isinstance(data, list):
        return data
    for key in ['result', 'comments']:
        if isinstance(data.get(key), list):
            return data[key]
    raise ValueError('Unrecognized Zoho comment response; cannot acknowledge projection')


def project(event, client, portal, project_id):
    marker = 'delivery-event:' + event['eventId']
    body = '<p>' + marker + '</p><p>Accepted source: ' + html.escape(event['sourceSha']) + '</p>'
    body += '<p>Owner quote: ' + html.escape(event['ownerQuote']) + '</p>'
    body += '<p>Artifact: ' + html.escape(event['artifactUrl']) + '</p>'
    body += '<p>Requirements: ' + html.escape(', '.join(event['requirementIds'])) + '</p>'
    body += '<p>Acceptance does not imply merged, released or Closed.</p>'
    for url in event['tickets']:
        pv = {'portal_id': portal, 'project_id': project_id, 'task_id': url.rsplit('/', 1)[1]}
        def exists():
            page = 1
            while True:
                data = client.call('get_task_comments', {'path_variables': pv, 'query_params': {'page': page, 'per_page': 200}})
                rows = comments(data)
                if any(marker in row.get('comment', '') for row in rows):
                    return True
                if len(rows) < 200:
                    return False
                page += 1
        if not exists():
            client.call('add_task_comment', {'path_variables': pv, 'body': {'comment': body}})
        if not exists():
            raise ValueError('Zoho read-back failed; retry preserves the event identity')
    return {'eventId': event['eventId'], 'verifiedTickets': event['tickets']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--portal', required=True)
    parser.add_argument('--project', required=True)
    parser.add_argument('--launcher', type=Path, default=Path.home() / '.local/bin/zoho-projects-mcp')
    args = parser.parse_args()
    client = None
    try:
        event = json.load(sys.stdin)
        client = Zoho(args.launcher)
        print(json.dumps(project(event, client, args.portal, args.project)))
    except (ValueError, KeyError, OSError, subprocess.SubprocessError) as exc:
        print(str(exc), file=sys.stderr)
        return 1
    finally:
        if client:
            client.close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
