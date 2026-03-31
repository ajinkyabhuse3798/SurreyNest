from __future__ import annotations

import os
import subprocess
from pathlib import Path


def _write_executable(path: Path, body: str) -> None:
    path.write_text(body)
    path.chmod(0o755)


def test_render_start_script_runs_migrations_then_starts_uvicorn(tmp_path: Path) -> None:
    backend_dir = Path(__file__).resolve().parents[1]
    script_path = backend_dir / "start-render.sh"
    log_path = tmp_path / "commands.log"
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()

    _write_executable(
        bin_dir / "alembic",
        "#!/bin/sh\n"
        f"echo \"alembic:$@\" >> \"{log_path}\"\n",
    )
    _write_executable(
        bin_dir / "python",
        "#!/bin/sh\n"
        f"echo \"python:$@\" >> \"{log_path}\"\n",
    )

    env = os.environ.copy()
    env["PATH"] = f"{bin_dir}:{env['PATH']}"
    env["PORT"] = "12345"

    result = subprocess.run(
        ["sh", str(script_path)],
        cwd=backend_dir,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr
    assert log_path.read_text().splitlines() == [
        "alembic:upgrade head",
        "python:-m uvicorn app.main:app --host 0.0.0.0 --port 12345 --workers 1",
    ]
