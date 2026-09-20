import copy
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch, MagicMock

spec = importlib.util.spec_from_file_location('web_delivery', Path(__file__).resolve().parents[1] / 'delivery.py')
web = importlib.util.module_from_spec(spec)
spec.loader.exec_module(web)
SHA = 'a' * 40
SETTINGS = {'repository': 'owner/site', 'vercelProjectId': 'prj_site', 'productionBranch': 'main', 'productionDomain': 'site.example'}
PR = dict(number=7, state='OPEN', headRefOid=SHA, headRefName='feat/change', baseRefName='main', isCrossRepository=False, mergeCommit={'oid': 'b' * 40})


def deployment(production=False):
    return dict(id='dpl_example', url='site-immutable.vercel.app', projectId='prj_site', readyState='READY',
                target='production' if production else None,
                meta=dict(githubCommitSha=SHA, githubCommitRef='main' if production else 'feat/change',
                          githubCommitOrg='owner', githubCommitRepo='site'), env={'PRIVATE': 'must-not-be-retained'})


def event():
    artifact = web.identity(deployment(), SHA, 'feat/change', SETTINGS)
    return web.core.seal(dict(schemaVersion=1, kind='accepted', pr=7, sourceSha=SHA, artifactSha=SHA,
                             artifactUrl=artifact['url'], deployment=artifact, ownerQuote='green', actor='owner',
                             timestamp='2026-09-19T12:00:00+00:00', requirementIds=['scope'],
                             tickets=['https://projects.zoho.com/portal/example#zp/task-detail/123']))


class DeliveryTest(unittest.TestCase):
    def setUp(self):
        self.settings = patch.object(web, 'config', return_value=SETTINGS)
        self.settings.start()
        self.addCleanup(self.settings.stop)

    def invoke(self, *args):
        with patch('sys.argv', ['delivery.py', *args]), patch('sys.stdout', new_callable=io.StringIO), patch('sys.stderr', new_callable=io.StringIO):
            return web.main()

    def test_identity_pass_fail_pass(self):
        good = deployment()
        self.assertEqual(web.identity(good, SHA, 'feat/change', SETTINGS)['sha'], SHA)
        for field, value, rule in [('projectId', 'other', 'PROJECT'), ('readyState', 'ERROR', 'READY'),
                                   ('target', 'production', 'ENVIRONMENT'), ('target', 'staging', 'ENVIRONMENT'),
                                   ('url', 'custom.example', 'URL')]:
            bad = copy.deepcopy(good)
            bad[field] = value
            with self.subTest(field=field, value=value), self.assertRaisesRegex(ValueError, 'DELIVERY_' + rule):
                web.identity(bad, SHA, 'feat/change', SETTINGS)
        for field, value, rule in [('githubCommitSha', 'b' * 40, 'SHA'), ('githubCommitRef', 'other', 'SHA'),
                                   ('githubCommitRepo', 'other', 'REPOSITORY')]:
            bad = copy.deepcopy(good)
            bad['meta'][field] = value
            with self.subTest(field=field), self.assertRaisesRegex(ValueError, 'DELIVERY_' + rule):
                web.identity(bad, SHA, 'feat/change', SETTINGS)
        self.assertEqual(web.identity(good, SHA, 'feat/change', SETTINGS)['sha'], SHA)

    def test_receipt_does_not_retain_environment(self):
        self.assertNotIn('PRIVATE', json.dumps(event()))
        self.assertNotIn('env', event()['deployment'])

    def test_stale_and_wrong_artifact_approval(self):
        good = event()
        web.accepted_preview([good], PR)
        with self.assertRaisesRegex(ValueError, 'DELIVERY_APPROVAL'):
            web.accepted_preview([good], {**PR, 'headRefOid': 'c' * 40})
        for field, value in [('projectId', 'wrong'), ('sha', 'b' * 40), ('branch', 'wrong'), ('environment', 'production'), ('url', 'https://site.example'), ('id', '')]:
            bad = copy.deepcopy(good)
            bad['deployment'][field] = value
            with self.subTest(field=field), self.assertRaisesRegex(ValueError, 'DELIVERY_ARTIFACT'):
                web.accepted_preview([web.core.seal(bad)], PR)
        web.accepted_preview([good], PR)

    def test_core_prepare_and_record_cannot_bypass_web_validation(self):
        with patch.object(web.core, 'main') as core_main:
            self.assertEqual(self.invoke('events', 'prepare'), 2)
            self.assertEqual(self.invoke('events', 'record'), 2)
            core_main.assert_not_called()

    def test_record_rechecks_preview_before_append(self):
        store = MagicMock()
        store.read.return_value = (None, [])
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'approval.json'
            path.write_text(json.dumps(event()))
            with patch.object(web.core, 'Store', return_value=store), patch.object(web.core, 'github', return_value={'login': 'owner'}), patch.object(web, 'current_preview', side_effect=ValueError('DELIVERY_SHA: changed')):
                self.assertEqual(self.invoke('record', str(path)), 2)
                store.append.assert_not_called()

    def test_record_retry_after_merge_does_not_create_second_event(self):
        store = MagicMock()
        store.read.return_value = ('commit', [event()])
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'approval.json'
            path.write_text(json.dumps(event()))
            with patch.object(web.core, 'Store', return_value=store), patch.object(web.core, 'github', return_value={'login': 'owner'}), patch.object(web, 'current_preview') as preview, patch.object(web.core, 'publish_status'):
                self.assertEqual(self.invoke('record', str(path)), 0)
                preview.assert_not_called()
                store.append.assert_called_once_with(event())

    def test_approval_status_fails_closed(self):
        with patch.object(web, 'pull', return_value=PR), patch.object(web.core, 'Store') as store, patch.object(web.core, 'github') as github:
            store.return_value.read.side_effect = ValueError('DELIVERY_STORE: unavailable')
            self.assertEqual(self.invoke('check-pr', '7', '--status'), 1)
            self.assertIn('state=failure', github.call_args.args)

    def test_production_requires_acceptance_and_stable_identity(self):
        merged = {**PR, 'state': 'MERGED'}
        store = MagicMock()
        store.read.return_value = ('commit', [event()])
        with patch.object(web, 'pull', return_value=merged), patch.object(web.core, 'Store', return_value=store), patch.object(web.core, 'contains', return_value=True), patch.object(web.core, 'github', return_value={'sha': SHA}) as github, patch.object(web, 'inspect', return_value=deployment(True)) as inspect, patch.object(web, 'health', return_value={'status': 200}), patch.object(web, 'auth_health', return_value={'status': 'passed'}):
            self.assertEqual(self.invoke('production', '--pr', '7'), 0)
            store.read.return_value = ('commit', [])
            self.assertEqual(self.invoke('production', '--pr', '7', '--publish'), 2)
            store.read.return_value = ('commit', [event()])
            inspect.side_effect = [deployment(True), {**deployment(True), 'id': 'dpl_changed'}]
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
        with patch.object(web.core, 'command', return_value=result):
            self.assertEqual(web.auth_health()['providers'], ['github', 'google'])
        result.stdout = 'google: configured\n'
        with patch.object(web.core, 'command', return_value=result), self.assertRaisesRegex(ValueError, 'DELIVERY_AUTH'):
            web.auth_health()

    def test_vendor_tampering_fails_then_restored_source_passes(self):
        web.load_core()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'source.json').write_text(json.dumps({'files': {'bad.py': '0' * 64}}))
            (root / 'bad.py').write_text('changed')
            with patch.object(web, 'VENDOR', root), self.assertRaisesRegex(ValueError, 'DELIVERY_VENDOR'):
                web.load_core()
        web.load_core()


if __name__ == '__main__':
    unittest.main()
