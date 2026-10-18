from __future__ import annotations

import importlib.util
import json
import unittest
from pathlib import Path
from unittest import mock


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("deployment_checks", ROOT / "scripts" / "verify_deployment_checks.py")
assert SPEC is not None and SPEC.loader is not None
CHECKS = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CHECKS)
SHA = "a" * 40


def successful_runs():
    return [{"id": index, "name": name, "head_sha": SHA, "status": "completed",
             "conclusion": "success", "app": {"id": 15368}}
            for index, name in enumerate(("validate", "ai-governance / verdict"), 1)]


class RequiredChecksTests(unittest.TestCase):
    def test_success_requires_both_exact_head_checks(self):
        CHECKS.require_successful_checks(successful_runs(), SHA)

    def test_failed_cancelled_skipped_and_neutral_are_not_success(self):
        for outcome in ("failure", "cancelled", "skipped", "neutral", "timed_out", "action_required"):
            with self.subTest(outcome=outcome):
                rows = successful_runs()
                rows[0]["conclusion"] = outcome
                with self.assertRaises(CHECKS.DeploymentEvidenceError):
                    CHECKS.require_successful_checks(rows, SHA)

    def test_pending_or_newer_pending_attempt_does_not_reuse_old_green(self):
        for status in ("queued", "in_progress"):
            with self.subTest(status=status):
                rows = successful_runs()
                rows.append({**rows[0], "id": 10, "status": status, "conclusion": None})
                with self.assertRaises(CHECKS.DeploymentEvidenceError):
                    CHECKS.require_successful_checks(rows, SHA)

    def test_wrong_head_and_wrong_app_cannot_satisfy_required_context(self):
        for update in ({"head_sha": "b" * 40}, {"app": {"id": 1}}):
            with self.subTest(update=update):
                rows = successful_runs()
                rows[0].update(update)
                with self.assertRaises(CHECKS.DeploymentEvidenceError):
                    CHECKS.require_successful_checks(rows, SHA)

    def test_missing_data_and_boolean_attempt_ids_fail_closed(self):
        for rows in ([], successful_runs()[:1], [{**successful_runs()[0], "id": True}, successful_runs()[1]]):
            with self.subTest(rows=rows):
                with self.assertRaises(CHECKS.DeploymentEvidenceError):
                    CHECKS.require_successful_checks(rows, SHA)


class ContextTests(unittest.TestCase):
    def context(self):
        return {"GITHUB_ACTIONS": "true", "GITHUB_REPOSITORY": "KyLamportLogic/aws-career-sandbox",
                "GITHUB_SHA": SHA, "GITHUB_REF": "refs/heads/main", "GITHUB_REF_PROTECTED": "true",
                "GITHUB_EVENT_NAME": "workflow_dispatch", "GITHUB_ACTOR": "KyPython"}

    def test_only_trusted_manual_main_context_is_accepted(self):
        self.assertEqual(CHECKS.verify_context(self.context()), ("KyLamportLogic/aws-career-sandbox", SHA))

    def test_non_main_non_owner_unprotected_and_automatic_contexts_are_rejected(self):
        for key, value in (("GITHUB_REF", "refs/heads/feature"), ("GITHUB_ACTOR", "other-user"),
                           ("GITHUB_REF_PROTECTED", "false"), ("GITHUB_EVENT_NAME", "push"),
                           ("GITHUB_REPOSITORY", "other/repo"), ("GITHUB_SHA", "not-a-revision")):
            with self.subTest(key=key):
                context = self.context()
                context[key] = value
                with self.assertRaises(CHECKS.DeploymentEvidenceError):
                    CHECKS.verify_context(context)


class ApiTests(unittest.TestCase):
    def response(self, payload):
        response = mock.MagicMock()
        response.__enter__.return_value.read.return_value = json.dumps(payload).encode()
        return response

    def test_paginated_checks_are_read_with_bounded_timeout(self):
        first = [{"id": n, "name": "unrelated"} for n in range(100)]
        last = [{"id": 100, "name": "unrelated"}]
        opener = mock.Mock(side_effect=[self.response({"total_count": 101, "check_runs": first}),
                                        self.response({"total_count": 101, "check_runs": last})])
        rows = CHECKS.fetch_check_runs("KyLamportLogic/aws-career-sandbox", SHA, "fixture-only", opener)
        self.assertEqual(len(rows), 101)
        self.assertEqual(opener.call_count, 2)
        for call in opener.call_args_list:
            self.assertEqual(call.kwargs["timeout"], 15)
        self.assertIn("page=2", opener.call_args_list[1].args[0].full_url)

    def test_api_failure_or_inconsistent_page_inventory_fails_closed(self):
        for opener in (mock.Mock(side_effect=OSError("synthetic unavailable")),
                       mock.Mock(return_value=self.response({"total_count": 1, "check_runs": []})),
                       mock.Mock(return_value=self.response({"total_count": True, "check_runs": []}))):
            with self.subTest(opener=opener):
                with self.assertRaises(CHECKS.DeploymentEvidenceError):
                    CHECKS.fetch_check_runs("KyLamportLogic/aws-career-sandbox", SHA, "fixture-only", opener)


class WorkflowBoundaryTests(unittest.TestCase):
    def test_exact_revision_guard_precedes_provider_credentials(self):
        workflow = (ROOT / ".github/workflows/deploy.yml").read_text()
        self.assertLess(workflow.index("python3 scripts/verify_deployment_checks.py"),
                        workflow.index("uses: aws-actions/configure-aws-credentials@"))
        self.assertIn("checks: read", workflow)
        self.assertIn("if: github.ref == 'refs/heads/main'", workflow)
