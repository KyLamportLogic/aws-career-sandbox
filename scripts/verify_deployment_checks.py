#!/usr/bin/env python3
"""Read exact-revision CI evidence before the human-approved credential step.

GitHub's protected workflow and environment supply authority. This helper does
not independently authenticate a human or execute any AWS/deployment command.
"""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.request


REPOSITORY = "KyLamportLogic/aws-career-sandbox"
REQUIRED_CONTEXTS = ("validate", "ai-governance / verdict")
ACTIONS_APP_ID = 15368


class DeploymentEvidenceError(RuntimeError):
    pass


def verify_context(environment):
    expected = {
        "GITHUB_ACTIONS": "true", "GITHUB_REPOSITORY": REPOSITORY,
        "GITHUB_REF": "refs/heads/main", "GITHUB_REF_PROTECTED": "true",
        "GITHUB_EVENT_NAME": "workflow_dispatch", "GITHUB_ACTOR": "KyPython",
    }
    if any(environment.get(key) != value for key, value in expected.items()):
        raise DeploymentEvidenceError("Deployment requires the protected manual main workflow and owner actor.")
    revision = environment.get("GITHUB_SHA", "")
    if not re.fullmatch(r"[0-9a-f]{40}", revision):
        raise DeploymentEvidenceError("The exact source revision is missing or malformed.")
    return REPOSITORY, revision


def fetch_check_runs(repository, revision, token, open_url=None):
    if repository != REPOSITORY or not re.fullmatch(r"[0-9a-f]{40}", revision) or not token:
        raise DeploymentEvidenceError("Trusted repository, exact revision and read-only GitHub token are required.")
    opener = open_url or urllib.request.urlopen
    rows, expected_count, seen = [], None, set()
    for page in range(1, 11):
        url = (f"https://api.github.com/repos/{repository}/commits/{revision}/check-runs"
               f"?per_page=100&filter=latest&page={page}")
        request = urllib.request.Request(url, headers={
            "Accept": "application/vnd.github+json", "Authorization": f"Bearer {token}",
            "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "aws-career-sandbox-ci-evidence",
        })
        try:
            with opener(request, timeout=15) as response:
                document = json.loads(response.read())
        except Exception as error:
            raise DeploymentEvidenceError("Required-check API evidence is unavailable.") from error
        if not isinstance(document, dict):
            raise DeploymentEvidenceError("Required-check inventory is malformed.")
        total, batch = document.get("total_count"), document.get("check_runs")
        if type(total) is not int or not 0 <= total <= 1000 or not isinstance(batch, list):
            raise DeploymentEvidenceError("Required-check inventory is malformed or exceeds the bounded scope.")
        if expected_count is None:
            expected_count = total
        if total != expected_count or (not batch and len(rows) < total):
            raise DeploymentEvidenceError("Required-check inventory changed or is incomplete.")
        for row in batch:
            if not isinstance(row, dict) or type(row.get("id")) is not int or row["id"] in seen:
                raise DeploymentEvidenceError("Required-check inventory has malformed or repeated attempts.")
            seen.add(row["id"])
            rows.append(row)
        if len(rows) == total:
            return rows
        if len(rows) > total:
            raise DeploymentEvidenceError("Required-check inventory is inconsistent.")
    raise DeploymentEvidenceError("Required-check pagination exceeded its bounded scope.")


def require_successful_checks(rows, revision):
    if not isinstance(rows, list):
        raise DeploymentEvidenceError("Required-check evidence is missing.")
    for context in REQUIRED_CONTEXTS:
        attempts = [row for row in rows if isinstance(row, dict) and row.get("name") == context]
        if not attempts or any(type(row.get("id")) is not int or row["id"] <= 0 for row in attempts):
            raise DeploymentEvidenceError("A required check is missing or malformed: " + context)
        latest = max(attempts, key=lambda row: row["id"])
        if (latest.get("head_sha") != revision or latest.get("status") != "completed"
                or latest.get("conclusion") != "success"
                or not isinstance(latest.get("app"), dict)
                or latest["app"].get("id") != ACTIONS_APP_ID):
            raise DeploymentEvidenceError("A required check lacks exact-revision success: " + context)


def main():
    try:
        repository, revision = verify_context(os.environ)
        runs = fetch_check_runs(repository, revision, os.environ.get("GH_TOKEN", ""))
        require_successful_checks(runs, revision)
    except DeploymentEvidenceError as error:
        print(str(error), file=sys.stderr)
        return 1
    print("Required CI and governance checks succeeded for the exact manual-deployment revision.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
