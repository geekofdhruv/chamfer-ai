import os
import json
import tempfile
from pathlib import Path

try:
    import docker as _docker
    _DOCKER_CLIENT = _docker.from_env()
    _DOCKER_AVAILABLE = True
except Exception:
    _DOCKER_CLIENT = None
    _DOCKER_AVAILABLE = False

_IMAGE = "vibecad-cad-executor"
_EXECUTION_TIMEOUT = 30


def execute_cadquery(
    code: str,
    params: dict | None = None,
    render_snapshots: bool = False,
    render_png: bool = False,
    render_dim_views: bool = False,
) -> dict:
    """Execute CadQuery code in a sandboxed Docker container.

    Args:
        code: CadQuery Python source code.
        params: Optional parameter substitutions.
        render_snapshots: Render SVG snapshots (for user display).
        render_png: Render PNG snapshots (for LLM visual inspection).
        render_dim_views: Render 2D dimensional orthographic views (top/front/side).

    Returns dict matching the existing interface:
        success, error, stl, step, glb, validation, inspection,
        snapshots, png_snapshots, dim_views
    """
    from params import substitute_params

    if not _DOCKER_AVAILABLE:
        return {
            "success": False,
            "error": "Docker is not available — install docker and the docker Python SDK, "
                     "then build the executor image with: docker build -t vibecad-cad-executor .",
        }

    processed_code = substitute_params(code, params) if params else code

    with tempfile.TemporaryDirectory(prefix="vibecad_") as work_dir:
        os.chmod(work_dir, 0o777)  # allow container (UID 1000) to write to mounted volume
        work = Path(work_dir)

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

        # ── Launch Docker container ──
        container = None
        try:
            container = _DOCKER_CLIENT.containers.run(
                _IMAGE,
                command=["python", "/app/runner.py"],
                volumes={work_dir: {"bind": "/work", "mode": "rw"}},
                network_mode="none",
                mem_limit="2g",
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
            # ── Timeout path — kill container immediately ──
            if container is not None:
                try:
                    container.kill()
                except Exception:
                    pass
            # Detect timeout from Docker SDK errors
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
