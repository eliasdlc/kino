import copy
import importlib.util
import io
import json
from pathlib import Path
import unittest
from unittest.mock import patch, MagicMock

spec = importlib.util.spec_from_file_location('web_delivery', Path(__file__).resolve().parents[1] / 'delivery.py')
web = importlib.util.module_from_spec(spec)
spec.loader.exec_module(web)
SHA = 'a' * 40
SETTINGS = {'repository': 'owner/site', 'vercelProjectId': 'prj_site', 'productionBranch': 'main', 'integrationBranch': 'dev', 'productionDomain': 'site.example'}
PR = dict(number=7, state='OPEN', headRefOid=SHA, headRefName='feat/change', baseRefName='dev', isCrossRepository=False, mergeCommit={'oid': 'b' * 40})


def deployment():
    return dict(id='dpl_example', url='site-immutable.vercel.app', projectId='prj_site', readyState='READY',
                target='production',
                meta=dict(githubCommitSha=SHA, githubCommitRef='main', githubCommitOrg='owner', githubCommitRepo='site'),
                env={'PRIVATE': 'must-not-be-retained'})


class DeliveryTest(unittest.TestCase):
    def setUp(self):
        self.settings = patch.object(web, 'config', return_value=SETTINGS)
        self.settings.start()
        self.addCleanup(self.settings.stop)

    def invoke(self, *args):
        with patch('sys.argv', ['delivery.py', *args]), patch('sys.stdout', new_callable=io.StringIO), patch('sys.stderr', new_callable=io.StringIO):
            return web.main()

    def test_branch_route_pass_fail_pass(self):
        web.validate_topology(PR)
        web.validate_topology({**PR, 'baseRefName': 'main', 'headRefName': 'dev'})
        for changes in [{'baseRefName': 'main'}, {'headRefName': 'main'}, {'headRefName': 'dev'}, {'isCrossRepository': True}]:
            with self.assertRaisesRegex(ValueError, 'DELIVERY_BRANCH'):
                web.validate_topology({**PR, **changes})
        web.validate_topology(PR)

    def test_check_branch_status(self):
        with patch.object(web, 'pull', return_value=PR), patch.object(web, 'github') as github:
            self.assertEqual(self.invoke('check-branch', '7', '--status'), 0)
            self.assertIn('state=success', github.call_args.args)
        with patch.object(web, 'pull', return_value={**PR, 'baseRefName': 'main'}), patch.object(web, 'github') as github:
            self.assertEqual(self.invoke('check-branch', '7', '--status'), 1)
            self.assertIn('state=failure', github.call_args.args)

    def test_identity_pass_fail_pass(self):
        good = deployment()
        self.assertEqual(web.identity(good, SHA, 'main', SETTINGS)['sha'], SHA)
        for field, value, rule in [('projectId', 'other', 'PROJECT'), ('readyState', 'ERROR', 'READY'),
                                   ('target', None, 'ENVIRONMENT'), ('target', 'preview', 'ENVIRONMENT'),
                                   ('url', 'custom.example', 'URL')]:
            bad = copy.deepcopy(good)
            bad[field] = value
            with self.subTest(field=field, value=value), self.assertRaisesRegex(ValueError, 'DELIVERY_' + rule):
                web.identity(bad, SHA, 'main', SETTINGS)
        for field, value, rule in [('githubCommitSha', 'b' * 40, 'SHA'), ('githubCommitRef', 'other', 'SHA'),
                                   ('githubCommitRepo', 'other', 'REPOSITORY')]:
            bad = copy.deepcopy(good)
            bad['meta'][field] = value
            with self.subTest(field=field), self.assertRaisesRegex(ValueError, 'DELIVERY_' + rule):
                web.identity(bad, SHA, 'main', SETTINGS)
        self.assertEqual(web.identity(good, SHA, 'main', SETTINGS)['sha'], SHA)

    def test_receipt_does_not_retain_environment(self):
        artifact = web.identity(deployment(), SHA, 'main', SETTINGS)
        self.assertNotIn('PRIVATE', json.dumps(artifact))
        self.assertNotIn('env', artifact)

    def test_production_requires_merged_release_and_stable_identity(self):
        merged = {**PR, 'state': 'MERGED', 'baseRefName': 'main', 'headRefName': 'dev'}
        with patch.object(web, 'pull', return_value=merged) as pull, patch.object(web, 'contains', return_value=True), patch.object(web, 'github', return_value={'sha': SHA}) as github, patch.object(web, 'inspect', return_value=deployment()) as inspect, patch.object(web, 'health', return_value={'status': 200}), patch.object(web, 'auth_health', return_value={'status': 'passed'}):
            self.assertEqual(self.invoke('production', '--pr', '7'), 0)
            pull.return_value = {**merged, 'state': 'OPEN'}
            self.assertEqual(self.invoke('production', '--pr', '7', '--publish'), 2)
            pull.return_value = {**merged, 'headRefName': 'feat/change'}
            self.assertEqual(self.invoke('production', '--pr', '7', '--publish'), 2)
            pull.return_value = merged
            inspect.side_effect = [deployment(), {**deployment(), 'id': 'dpl_changed'}]
            self.assertEqual(self.invoke('production', '--pr', '7', '--publish'), 2)
            inspect.side_effect = None
            github.side_effect = [{'sha': SHA}, {'sha': 'c' * 40}]
            self.assertEqual(self.invoke('production', '--pr', '7', '--publish'), 2)
            github.side_effect = None
            self.assertEqual(self.invoke('production', '--pr', '7'), 0)
            self.assertFalse(any('/statuses/' in str(call) for call in github.call_args_list))

    def test_health_rejects_login_redirect_and_non_200(self):
        response = MagicMock()
        response.__enter__.return_value = response
        with patch.object(web.urllib.request, 'urlopen', return_value=response):
            response.status, response.url = 200, 'https://site.example/'
            self.assertEqual(web.health('https://site.example')['status'], 200)
            response.url = 'https://login.example/'
            with self.assertRaisesRegex(ValueError, 'DELIVERY_HEALTH'):
                web.health('https://site.example')
            response.status, response.url = 503, 'https://site.example/'
            with self.assertRaisesRegex(ValueError, 'DELIVERY_HEALTH'):
                web.health('https://site.example')
            response.status = 200
            self.assertEqual(web.health('https://site.example')['status'], 200)

    def test_auth_health_requires_both_social_providers(self):
        result = MagicMock(stdout='google: configured\ngithub: configured\n')
        with patch.object(web, 'command', return_value=result):
            self.assertEqual(web.auth_health()['providers'], ['github', 'google'])
        result.stdout = 'google: configured\n'
        with patch.object(web, 'command', return_value=result), self.assertRaisesRegex(ValueError, 'DELIVERY_AUTH'):
            web.auth_health()

    def test_removed_acceptance_commands_are_rejected(self):
        for action in ['prepare', 'record', 'check-pr', 'events', 'preview']:
            with self.subTest(action=action), patch('sys.stderr', new_callable=io.StringIO), self.assertRaises(SystemExit):
                self.invoke(action)


if __name__ == '__main__':
    unittest.main()
