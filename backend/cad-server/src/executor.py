import os
import sys
import tempfile
import subprocess
import json
import base64
from pathlib import Path


def _get_venv_python() -> str:
    """Find the .venv Python next to this file or in parent dirs."""
    here = Path(__file__).resolve().parent
    for d in [here, *here.parents]:
        venv = d / ".venv"
        if venv.is_dir():
            for name in ("python.exe", "python"):
                exe = venv / ("Scripts" if os.name == "nt" else "bin") / name
                if exe.exists():
                    return str(exe)
    return sys.executable


_VENV_PYTHON = _get_venv_python()


def execute_cadquery(
    code: str,
    params: dict | None = None,
    render_snapshots: bool = False,
    render_png: bool = False,
    render_dim_views: bool = False,
) -> dict:
    """Execute CadQuery code in a sandboxed subprocess and return file bytes + validation + snapshots.

    Args:
        code: CadQuery Python source code
        params: Optional parameter substitutions
        render_snapshots: Render SVG snapshots (for user display)
        render_png: Render PNG snapshots (for LLM visual inspection)
        render_dim_views: Render 2D dimensional orthographic views (top/front/side)
    """
    from params import substitute_params

    processed_code = substitute_params(code, params) if params else code

    with tempfile.TemporaryDirectory(prefix="vibecad_") as work_dir:
        user_code_path = Path(work_dir) / "user_code.py"
        runner_path = Path(work_dir) / "runner.py"
        stl_path = Path(work_dir) / "output.stl"
        step_path = Path(work_dir) / "output.step"
        glb_path = Path(work_dir) / "output.glb"
        validation_path = Path(work_dir) / "validation.json"
        inspection_path = Path(work_dir) / "inspection.json"
        snapshot_dir = Path(work_dir) / "snapshots"
        snapshots_path = Path(work_dir) / "snapshots.json"
        png_snapshots_path = Path(work_dir) / "png_snapshots.json"
        dim_views_path = Path(work_dir) / "dim_views.json"

        user_code_path.write_text(processed_code, encoding="utf-8")

        # ── SVG snapshot rendering (for user display) ──
        svg_snapshot_code = ""
        if render_snapshots:
            svg_snapshot_code = f'''
    try:
        import sys as _sys
        _sys.path.insert(0, {str(Path(__file__).parent.resolve())!r})
        from snapshot import render_snapshots as _render_svg
        _snap_paths = _render_svg(r, {str(snapshot_dir)!r})
        _snaps = {{}}
        for _view, _path in _snap_paths.items():
            with open(_path, "r") as _sf:
                _snaps[_view] = _sf.read()
        with open({str(snapshots_path)!r}, "w") as _sf:
            json.dump(_snaps, _sf)
    except Exception as _se:
        with open({str(snapshots_path)!r}, "w") as _sf:
            json.dump({{"error": str(_se)}}, _sf)
'''

        # ── PNG snapshot rendering (for LLM visual inspection) ──
        png_snapshot_code = ""
        if render_png:
            png_snapshot_code = f'''
    try:
        import sys as _sys2
        _sys2.path.insert(0, {str(Path(__file__).parent.resolve())!r})
        from png_snapshot import render_png_snapshots as _render_png
        _png_snaps = _render_png({str(stl_path)!r}, {str(snapshot_dir)!r})
        with open({str(png_snapshots_path)!r}, "w") as _pf:
            json.dump(_png_snaps, _pf)
    except Exception as _pse:
        with open({str(png_snapshots_path)!r}, "w") as _pf:
            json.dump({{"error": str(_pse)}}, _pf)
'''

        # ── 2D dimensional views (top/front/side with dimensions) ──
        dim_views_code = ""
        if render_dim_views:
            dim_views_code = f'''
    try:
        import sys as _sys3
        _sys3.path.insert(0, {str(Path(__file__).parent.resolve())!r})
        from dim_views import render_dim_views as _render_dim
        _dim_views = _render_dim({str(stl_path)!r}, {str(snapshot_dir)!r})
        with open({str(dim_views_path)!r}, "w") as _df:
            json.dump(_dim_views, _df)
    except Exception as _dve:
        with open({str(dim_views_path)!r}, "w") as _df:
            json.dump({{"error": str(_dve)}}, _df)
'''

        runner = f'''
import cadquery as cq
import sys
import json

try:
    exec(open({str(user_code_path)!r}).read())
    if "r" not in dir():
        raise ValueError("Code did not define variable 'r'")

    # Export files
    cq.exporters.export(r, {str(stl_path)!r})
    cq.exporters.export(r, {str(step_path)!r})

    try:
        asm = cq.Assembly()
        asm.add(r, name="model")
        asm.save({str(glb_path)!r}, "GLTF")
    except Exception:
        pass

    # Run validation
    val = r.val()
    validation = {{
        "volume": round(val.Volume(), 3),
        "surface_area": round(val.Area(), 3),
        "is_valid": val.isValid(),
        "has_volume": val.Volume() > 0,
        "bounding_box": {{
            "size": [round(val.BoundingBox().xlen, 3), round(val.BoundingBox().ylen, 3), round(val.BoundingBox().zlen, 3)],
            "min": [round(val.BoundingBox().xmin, 3), round(val.BoundingBox().ymin, 3), round(val.BoundingBox().zmin, 3)],
            "max": [round(val.BoundingBox().xmax, 3), round(val.BoundingBox().ymax, 3), round(val.BoundingBox().zmax, 3)],
        }},
    }}

    warnings = []
    if validation["volume"] <= 0:
        warnings.append("Model has zero volume")
    bb_size = validation["bounding_box"]["size"]
    if any(s > 10000 for s in bb_size):
        warnings.append(f"Model is very large ({{bb_size}}mm), check units")
    if any(0 < s < 0.01 for s in bb_size):
        warnings.append(f"Model is very small ({{bb_size}}mm), check units")
    validation["warnings"] = warnings

    with open({str(validation_path)!r}, "w") as vf:
        json.dump(validation, vf)

    # Run detailed inspection
    try:
        sys.path.insert(0, {str(Path(__file__).parent.resolve())!r})
        from inspector import inspect_geometry
        inspection = inspect_geometry(r)
        with open({str(inspection_path)!r}, "w") as inf:
            json.dump(inspection, inf)
    except Exception as ie:
        with open({str(inspection_path)!r}, "w") as inf:
            json.dump({{"error": str(ie)}}, inf)
{svg_snapshot_code}{png_snapshot_code}{dim_views_code}
    print("SUCCESS")
except Exception as e:
    print(f"ERROR: {{e}}", file=sys.stderr)
    sys.exit(1)
'''
        runner_path.write_text(runner, encoding="utf-8")

        result = subprocess.run(
            [_VENV_PYTHON, str(runner_path)],
            capture_output=True, text=True, timeout=60, cwd=work_dir,
        )

        if result.returncode != 0:
            return {"success": False, "error": result.stderr.strip() or "Unknown error"}

        stl_bytes = stl_path.read_bytes() if stl_path.exists() else None
        step_bytes = step_path.read_bytes() if step_path.exists() else None
        glb_bytes = glb_path.read_bytes() if glb_path.exists() else None

        validation = {}
        if validation_path.exists():
            try:
                validation = json.loads(validation_path.read_text())
            except Exception:
                validation = {}

        inspection = {}
        if inspection_path.exists():
            try:
                inspection = json.loads(inspection_path.read_text())
            except Exception:
                inspection = {}

        snapshots = {}
        if snapshots_path.exists():
            try:
                snapshots = json.loads(snapshots_path.read_text())
            except Exception:
                snapshots = {}

        png_snapshots = {}
        if png_snapshots_path.exists():
            try:
                png_snapshots = json.loads(png_snapshots_path.read_text())
            except Exception:
                png_snapshots = {}

        dim_views = {}
        if dim_views_path.exists():
            try:
                dim_views = json.loads(dim_views_path.read_text())
            except Exception:
                dim_views = {}

        return {
            "success": True,
            "stl": stl_bytes,
            "step": step_bytes,
            "glb": glb_bytes,
            "validation": validation,
            "inspection": inspection,
            "snapshots": snapshots,
            "png_snapshots": png_snapshots,
            "dim_views": dim_views,
        }
