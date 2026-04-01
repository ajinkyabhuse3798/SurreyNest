from __future__ import annotations

import os
import shutil
import socket
import subprocess
import time
import uuid
from pathlib import Path

import psycopg2
import pytest


def _free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


@pytest.mark.skipif(shutil.which("docker") is None, reason="docker is required")
def test_alembic_upgrade_head_succeeds_on_fresh_postgres() -> None:
    backend_dir = Path(__file__).resolve().parents[1]
    container_name = f"surreynest-migrate-{uuid.uuid4().hex[:8]}"
    host_port = _free_port()

    run_result = subprocess.run(
        [
            "docker",
            "run",
            "--rm",
            "-d",
            "--name",
            container_name,
            "-e",
            "POSTGRES_PASSWORD=postgres",
            "-e",
            "POSTGRES_DB=surreynest_test",
            "-p",
            f"{host_port}:5432",
            "postgis/postgis:15-3.4",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    assert run_result.returncode == 0, run_result.stderr

    try:
        deadline = time.time() + 60
        while time.time() < deadline:
            ready = subprocess.run(
                [
                    "docker",
                    "exec",
                    container_name,
                    "pg_isready",
                    "-U",
                    "postgres",
                    "-d",
                    "surreynest_test",
                ],
                capture_output=True,
                text=True,
                check=False,
            )
            if ready.returncode == 0:
                break
            time.sleep(1)
        else:
            pytest.fail("postgres container never became ready")

        env = os.environ.copy()
        database_url = (
            f"postgresql://postgres:postgres@127.0.0.1:{host_port}/surreynest_test"
        )
        env["DATABASE_URL"] = database_url

        deadline = time.time() + 30
        while time.time() < deadline:
            try:
                conn = psycopg2.connect(database_url)
            except psycopg2.OperationalError:
                time.sleep(1)
                continue
            conn.close()
            break
        else:
            pytest.fail("postgres did not accept local connections")

        upgrade = subprocess.run(
            ["./venv/bin/alembic", "upgrade", "head"],
            cwd=backend_dir,
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )

        assert upgrade.returncode == 0, upgrade.stderr

        conn = psycopg2.connect(database_url)
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_name = 'properties'
                      AND column_name = 'is_university_managed'
                    """
                )
                assert cur.fetchone() is not None

                cur.execute(
                    """
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_name = 'rent_predictions'
                      AND column_name = 'confidence'
                    """
                )
                assert cur.fetchone() is not None
        finally:
            conn.close()
    finally:
        subprocess.run(
            ["docker", "rm", "-f", container_name],
            capture_output=True,
            text=True,
            check=False,
        )
