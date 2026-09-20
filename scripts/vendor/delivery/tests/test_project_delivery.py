import importlib.util
from pathlib import Path
import unittest

SPEC = importlib.util.spec_from_file_location('project_delivery', Path(__file__).parents[1] / 'project_delivery.py')
projection = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(projection)


class RetryProjection(unittest.TestCase):
    def test_lost_response_retries_without_a_second_comment_or_closure(self):
        event = dict(eventId='a' * 64, sourceSha='b' * 40, ownerQuote='green', artifactUrl='https://example.test/build', requirementIds=['GPS'], tickets=['https://projects.zoho.com/portal/test#zp/task-detail/1'])
        class Fake:
            def __init__(self):
                self.rows = []
                self.posts = 0
            def call(self, name, args):
                if name == 'get_task_comments':
                    return {'result': self.rows}
                if name == 'add_task_comment':
                    self.posts += 1
                    self.rows.append(args['body'])
                    raise ValueError('lost response after remote write')
                raise AssertionError('projection must not close the task')
        client = Fake()
        with self.assertRaisesRegex(ValueError, 'lost response'):
            projection.project(event, client, '1', '2')
        result = projection.project(event, client, '1', '2')
        self.assertEqual(client.posts, 1)
        self.assertEqual(result['verifiedTickets'], event['tickets'])

    def test_unknown_response_cannot_be_treated_as_no_comments(self):
        with self.assertRaises(ValueError):
            projection.comments({'error': 'unavailable'})
