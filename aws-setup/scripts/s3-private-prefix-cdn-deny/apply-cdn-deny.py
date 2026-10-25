#!/usr/bin/env python3
"""Merge CloudFront GetObject Deny statements onto existing S3 bucket policies.

put-bucket-policy replaces the entire document. This script GET-merges by Sid
and never drops unrelated statements. See xituan_agent/devGuide/s3/README.md.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
PREFIXES_PATH = SCRIPT_DIR / "prefixes.json"


def load_config() -> dict[str, Any]:
    return json.loads(PREFIXES_PATH.read_text(encoding="utf-8"))


def deny_statement(bucket: str, sid: str, resource_suffix: str) -> dict[str, Any]:
    suffix = resource_suffix.lstrip("/")
    return {
        "Sid": sid,
        "Effect": "Deny",
        "Principal": {"Service": "cloudfront.amazonaws.com"},
        "Action": "s3:GetObject",
        "Resource": f"arn:aws:s3:::{bucket}/{suffix}",
    }


def get_policy(bucket: str) -> dict[str, Any]:
    raw = subprocess.check_output(
        [
            "aws",
            "s3api",
            "get-bucket-policy",
            "--bucket",
            bucket,
            "--query",
            "Policy",
            "--output",
            "text",
        ],
        text=True,
    )
    return json.loads(raw)


def put_policy(bucket: str, policy: dict[str, Any]) -> None:
    subprocess.check_call(
        [
            "aws",
            "s3api",
            "put-bucket-policy",
            "--bucket",
            bucket,
            "--policy",
            json.dumps(policy),
        ]
    )


def merge_denies(
    policy: dict[str, Any],
    bucket: str,
    denies: list[dict[str, str]],
) -> dict[str, Any]:
    sids = {item["sid"] for item in denies}
    statements = [
        stmt
        for stmt in policy.get("Statement", [])
        if stmt.get("Sid") not in sids
    ]
    for item in denies:
        statements.append(
            deny_statement(bucket, item["sid"], item["resourceSuffix"])
        )
    policy["Statement"] = statements
    if "Version" not in policy:
        policy["Version"] = "2012-10-17"
    return policy


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Merge private-prefix CloudFront Deny statements into S3 bucket policies."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print merged policy Sids without calling put-bucket-policy.",
    )
    parser.add_argument(
        "--buckets",
        nargs="*",
        help="Override bucket list from prefixes.json.",
    )
    args = parser.parse_args()

    config = load_config()
    buckets: list[str] = args.buckets or list(config["buckets"])
    denies: list[dict[str, str]] = list(config["denies"])
    if not denies:
        print("prefixes.json has no denies", file=sys.stderr)
        return 1

    for bucket in buckets:
        policy = get_policy(bucket)
        merged = merge_denies(policy, bucket, denies)
        sids = [stmt.get("Sid") for stmt in merged["Statement"]]
        print(f"{bucket}: Sids={sids}")
        if args.dry_run:
            continue
        put_policy(bucket, merged)
        print(f"{bucket}: put-bucket-policy ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
