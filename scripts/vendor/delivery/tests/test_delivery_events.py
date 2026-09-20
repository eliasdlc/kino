import importlib.util
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('delivery_events', Path(__file__).parents[1] / 'delivery_events.py')
events = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(events)
A, B, C = ('a' * 40, 'b' * 40, 'c' * 40)


def accepted(**fields):
    return events.seal(dict(schemaVersion=1, kind='accepted', sourceSha=A, artifactSha=A,
                           artifactUrl='https://example.test/build/1', ownerQuote='green',
                           actor='owner', timestamp='2026-09-19T12:00:00Z',
                           requirementIds=['recording survives restart'], tickets=['https://projects.zoho.com/portal/test#zp/task-detail/1'], pr=1, **fields))


def disposition(source, kind, **fields):
    result = {**source, 'kind': kind, 'targetEventId': source['eventId'], **fields}
    return events.seal(result)


class Decisions(unittest.TestCase):
    def test_pass_fail_pass_exact_head_and_artifact(self):
        a = accepted()
        self.assertTrue(events.approval([a], 1, A))
        self.assertEqual(events.approval([a], 1, B), [])
        broken = events.seal({**a, 'artifactSha': B})
        with self.assertRaisesRegex(ValueError, 'DELIVERY_IDENTITY'):
            events.approval([broken], 1, A)
        self.assertTrue(events.approval([a], 1, A))

    def test_missing_acceptance_does_not_expire_or_disappear_on_closed_pr(self):
        a = accepted()
        for state in ['OPEN', 'CLOSED']:
            self.assertEqual(events.missing([a], C, lambda *_: False, lambda _: {'state': state}), [a])

    def test_squash_requires_the_exact_approved_head(self):
        a = accepted()
        pr = {'state': 'MERGED', 'headRefOid': A, 'mergeCommit': {'oid': B}}
        self.assertEqual(events.missing([a], C, lambda s, _: s == B, lambda _: pr), [])
        pr['headRefOid'] = C
        self.assertEqual(events.missing([a], C, lambda s, _: s == B, lambda _: pr), [a])

    def test_deferral_is_explicit_and_only_for_one_candidate(self):
        a = accepted()
        d = disposition(a, 'deferred', candidateSha=B)
        self.assertEqual(events.active_acceptances([a, d], B), [])
        self.assertEqual(events.active_acceptances([a, d], C), [a])
        self.assertEqual(events.approval([a, d], 1, A), [a])

    def test_unknown_or_mismatched_disposition_fails_closed(self):
        a = accepted()
        for d in [disposition(a, 'rejected', targetEventId='f' * 64), disposition(a, 'rejected', pr=2)]:
            with self.assertRaisesRegex(ValueError, 'DELIVERY_TARGET'):
                events.active_acceptances([a, d])

    def test_supersession_requires_accepted_replacement_covering_scope(self):
        a = accepted()
        b = events.seal({**a, 'sourceSha': B, 'artifactSha': B})
        d = disposition(a, 'superseded', replacementEventId=b['eventId'])
        self.assertEqual(events.active_acceptances([a, b, d]), [b])
        with self.assertRaisesRegex(ValueError, 'DELIVERY_REPLACEMENT'):
            events.active_acceptances([a, d])

    def test_projection_failure_is_pending_until_readback_receipt(self):
        a = accepted()
        self.assertEqual(events.pending_projections([a]), [a])
        projected = disposition(a, 'projected', projectionUrl='https://projects.zoho.com/task/1')
        self.assertEqual(events.pending_projections([a, projected]), [])
        self.assertEqual(events.approval([a, projected], 1, A), [a])

    def test_editing_hashed_event_is_detected(self):
        a = accepted()
        a['ownerQuote'] = 'invented'
        with self.assertRaisesRegex(ValueError, 'DELIVERY_INTEGRITY'):
            events.validate(a)

    def test_successful_build_is_not_an_acceptance_event(self):
        with self.assertRaisesRegex(ValueError, 'DELIVERY_SCHEMA'):
            events.validate({'conclusion': 'success', 'headSha': A})

    def test_unknown_git_commit_cannot_count_as_included(self):
        with patch.object(events, 'command', return_value=subprocess.CompletedProcess([], 1, '', '')), patch.object(events, 'git', side_effect=ValueError('unavailable')):
            with self.assertRaisesRegex(ValueError, 'unavailable'):
                events.contains(A, B)


class GitStore(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.previous = Path.cwd()
        self.root = Path(self.temp.name)
        self.remote = self.root / 'remote.git'
        subprocess.run(['git', 'init', '--bare', str(self.remote)], capture_output=True, check=True)
        os.chdir(self.root)
        events.git('init', '-b', 'work')
        events.git('config', 'user.name', 'Test')
        events.git('config', 'user.email', 'test@example.test')
        events.git('remote', 'add', 'origin', str(self.remote))
        self.store = events.Store()

    def tearDown(self):
        os.chdir(self.previous)
        self.temp.cleanup()

    def test_initialization_retry_and_recovery_from_lost_response(self):
        with self.assertRaisesRegex(ValueError, 'DELIVERY_STORE'):
            self.store.read()
        a = accepted()
        head = self.store.append(a)
        self.assertEqual(self.store.append(a), head)
        self.assertEqual(self.store.read()[1], [a])
        self.assertEqual(events.git('rev-list', '--count', head), '1')

    def test_rejects_history_that_edits_or_deletes_a_prior_event(self):
        a = accepted()
        head = self.store.append(a)
        blob = events.git('hash-object', '-w', '--stdin', data='{}')
        tree = events.git('mktree', data=f'100644 blob {blob}\t{a["eventId"]}.json\n')
        bad = events.git('commit-tree', tree, '-p', head, data='tamper\n')
        events.git('push', 'origin', f'{bad}:{events.REF}')
        with self.assertRaisesRegex(ValueError, 'DELIVERY_HISTORY'):
            self.store.read()

    def test_competing_writer_is_preserved_and_retried(self):
        a = accepted()
        b = events.seal({**a, 'pr': 2})
        original = events.command
        raced = False
        def race(*args, **kwargs):
            nonlocal raced
            if args[:2] == ('git', 'push') and not raced:
                raced = True
                self.store.append(b)
            return original(*args, **kwargs)
        with patch.object(events, 'command', side_effect=race):
            self.store.append(a)
        self.assertEqual(self.store.read()[1], [b, a])

    def test_offline_remote_is_not_an_empty_stream(self):
        self.store.append(accepted())
        self.remote.rename(self.root / 'offline')
        with self.assertRaisesRegex(ValueError, 'DELIVERY_STORE'):
            self.store.read(allow_missing=True)

class CommandContracts(unittest.TestCase):
    def run_cli(self, args, store):
        with patch('sys.argv', ['delivery_events.py', *args]), patch.object(events, 'Store', return_value=store):
            return events.main()

    def test_stale_approval_is_rejected_before_append(self):
        from unittest.mock import Mock
        store = Mock()
        store.read.return_value = (None, [])
        with tempfile.TemporaryDirectory() as directory:
            file = Path(directory) / 'event.json'
            file.write_text(events.canonical(accepted()))
            with patch.object(events, 'github', return_value={'login': 'owner'}), patch.object(events, 'pull', return_value={'state': 'OPEN', 'headRefOid': B}):
                self.assertEqual(self.run_cli(['record', str(file)], store), 2)
            store.append.assert_not_called()

    def test_retry_after_merge_repairs_status_without_requiring_open_pr(self):
        from unittest.mock import Mock
        store = Mock()
        a = accepted()
        store.read.return_value = (B, [a])
        store.append.return_value = B
        with tempfile.TemporaryDirectory() as directory:
            file = Path(directory) / 'event.json'
            file.write_text(events.canonical(a))
            with patch.object(events, 'github', return_value={'login': 'owner'}), patch.object(events, 'pull', side_effect=AssertionError('already recorded')), patch.object(events, 'publish_status') as publish:
                self.assertEqual(self.run_cli(['record', str(file)], store), 0)
                publish.assert_called_once_with([a], 1)

    def test_failed_projection_cannot_acknowledge_the_event(self):
        from unittest.mock import Mock
        store = Mock()
        store.read.return_value = (B, [accepted()])
        with patch.object(events, 'command', side_effect=ValueError('offline tracker')):
            self.assertEqual(self.run_cli(['project', '--adapter', '/example/projector'], store), 2)
        store.append.assert_not_called()

    def test_release_deferral_is_present_in_actual_notes(self):
        from unittest.mock import Mock
        import contextlib
        import io
        a = accepted()
        store = Mock()
        store.read.return_value = (C, [a, disposition(a, 'deferred', candidateSha=B)])
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            self.assertEqual(self.run_cli(['check-release', '--sha', B, '--notes'], store), 0)
        self.assertIn('Explicitly deferred', output.getvalue())
        self.assertIn('recording survives restart', output.getvalue())

    def test_supplied_receipt_must_match_downloaded_github_artifact(self):
        receipt = {k: 'value' for k in ['runId', 'runAttempt', 'runUrl', 'versionName', 'versionCode', 'package', 'releaseUrl', 'groups', 'utc', 'local', 'authorization']}
        receipt['sha'] = A
        def download(*args, **kwargs):
            target = Path(args[-1]) / 'release-receipt.json'
            target.write_text(events.canonical({**receipt, 'sha': B}))
            return subprocess.CompletedProcess(args, 0, '', '')
        with patch.object(events, 'command', side_effect=download):
            with self.assertRaisesRegex(ValueError, 'DELIVERY_RECEIPT'):
                events.verify_receipt(receipt, A)
