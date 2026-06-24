import os
import sys
import json
import uuid
import shutil
from pathlib import Path

try:
    import docker as _docker
    _DOCKER_CLIENT = _docker.from_env()
    _DOCKER_AVAILABLE = True
except Exception:
    _DOCKER_CLIENT = None
    _DOCKER_AVAILABLE = False

_IMAGE = "chamfer-ai-cad-executor"
_EXECUTION_TIMEOUT = 30

# Shared volume path (mounted via docker-compose)
_SHARED_DIR = Path("/shared/jobs")
_VOLUME_NAME = os.environ.get("CAD_WORK_VOLUME", "cad-work")


def _get_work_dir() -> Path:
    """Create a unique job directory inside the shared volume, or fall back to temp."""
    if _SHARED_DIR.parent.exists():
        job_dir = _SHARED_DIR / uuid.uuid4().hex
        job_dir.mkdir(parents=True, exist_ok=True)
        os.chmod(job_dir, 0o777)
        return job_dir
    # Fallback for bare-metal (not in Docker)
    import tempfile
    work = Path(tempfile.mkdtemp(prefix="chamfer_ai_"))
    os.chmod(work, 0o777)
    return work

def execute_cadquery(
    code: str,
    params: dict | None = None,
    render_snapshots: bool = False,
    render_png: bool = False,
    render_dim_views: bool = False,
) -> dict:
    from params import substitute_params

    if not _DOCKER_AVAILABLE:
        return {
            "success": False,
            "error": "Docker is not available — install docker and the docker Python SDK, "
                     "then build the executor image with: docker build -t chamfer-ai-cad-executor .",
        }

    processed_code = substitute_params(code, params) if params else code

    work = _get_work_dir()
    is_shared = str(work).startswith(str(_SHARED_DIR.parent))

    try:
        # ── Write inputs ──
        (work / "user_code.py").write_text(processed_code, encoding="utf-8")
        (work / "config.json").write_text(
            json.dumps({
                "render_snapshots": render_snapshots,
                "render_png": render_png,
                "render_dim_views": render_dim_views,
            }),
            encoding="utf-8",
        )

        # ── Determine volume mount ──
        if is_shared:
            volumes = {_VOLUME_NAME: {"bind": "/shared", "mode": "rw"}}
            job_dir_env = str(work)
        else:
            # Bare metal — mount the temp dir directly
            volumes = {str(work): {"bind": "/work", "mode": "rw"}}
            job_dir_env = "/work"

        # ── Launch Docker container ──
        container = None
        try:
            container = _DOCKER_CLIENT.containers.run(
                _IMAGE,
                command=["python", "/app/runner.py"],
                volumes=volumes,
                environment={"JOB_DIR": job_dir_env, "XDG_CACHE_HOME": "/tmp"},
                network_mode="none",
                mem_limit="512m",
                cpu_count=1,
                read_only=True,
                tmpfs={"/tmp": "size=128m"},
                security_opt=["no-new-privileges"],
                cap_drop=["ALL"],
                user="1000:1000",
                detach=True,
            )

            exit_result = container.wait(timeout=_EXECUTION_TIMEOUT)

            if exit_result["StatusCode"] != 0:
                stderr = ""
                try:
                    stderr = container.logs(stdout=False, stderr=True).decode(
                        errors="replace"
                    )
                except Exception:
                    pass
                return {
                    "success": False,
                    "error": stderr.strip() or "Unknown execution error",
                }

        except Exception as exc:
            if container is not None:
                try:
                    container.kill()
                except Exception:
                    pass
            msg = str(exc)
            if "timeout" in msg.lower() or "ReadTimeout" in type(exc).__name__:
                return {
                    "success": False,
                    "error": f"Execution timed out after {_EXECUTION_TIMEOUT}s",
                }
            return {"success": False, "error": msg}

        finally:
            if container is not None:
                try:
                    container.remove(force=True)
                except Exception:
                    pass

        # ── Collect output files ──
        stl = (work / "output.stl").read_bytes() if (work / "output.stl").exists() else None
        step = (work / "output.step").read_bytes() if (work / "output.step").exists() else None
        glb = (work / "output.glb").read_bytes() if (work / "output.glb").exists() else None

        validation = {}
        val_path = work / "validation.json"
        if val_path.exists():
            try:
                validation = json.loads(val_path.read_text(encoding="utf-8"))
            except Exception:
                pass

        inspection = {}
        insp_path = work / "inspection.json"
        if insp_path.exists():
            try:
                inspection = json.loads(insp_path.read_text(encoding="utf-8"))
            except Exception:
                pass

        snapshots = {}
        snap_path = work / "snapshots.json"
        if snap_path.exists():
            try:
                snapshots = json.loads(snap_path.read_text(encoding="utf-8"))
            except Exception:
                pass

        png_snapshots = {}
        png_path = work / "png_snapshots.json"
        if png_path.exists():
            try:
                png_snapshots = json.loads(png_path.read_text(encoding="utf-8"))
            except Exception:
                pass

        dim_views = {}
        dim_path = work / "dim_views.json"
        if dim_path.exists():
            try:
                dim_views = json.loads(dim_path.read_text(encoding="utf-8"))
            except Exception:
                pass

        return {
            "success": True,
            "stl": stl,
            "step": step,
            "glb": glb,
            "validation": validation,
            "inspection": inspection,
            "snapshots": snapshots,
            "png_snapshots": png_snapshots,
            "dim_views": dim_views,
        }

    finally:
        # Cleanup job directory
        if is_shared:
            shutil.rmtree(work, ignore_errors=True)
