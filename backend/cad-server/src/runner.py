"""Sandboxed runner for Docker-based CadQuery execution.

Runs inside an air-gapped container mounted at /work (rw volume).
Reads user code from /work/user_code.py, executes it with restricted
globals (no os.system, no open(), no __import__ except cadquery + math),
exports STL/STEP/GLB, runs validation + inspection, and optionally
renders SVG snpashots, PNG renders, and 2D dimensional views.

Expects config at /work/config.json (parsed BEFORE any user-code
execution so malformed config fails fast).
"""

import json
import traceback
from pathlib import Path

WORK = Path("/work")
CONFIG_PATH = WORK / "config.json"
USER_CODE_PATH = WORK / "user_code.py"

# ──────────────────────────────────────────────────────────────────────
# 1.  Parse config FIRST — fail fast on malformed JSON
# ──────────────────────────────────────────────────────────────────────

with open(CONFIG_PATH, "r", encoding="utf-8") as fh:
    config = json.load(fh)

RENDER_SNAPSHOTS: bool = config.get("render_snapshots", False)
RENDER_PNG: bool = config.get("render_png", False)
RENDER_DIM_VIEWS: bool = config.get("render_dim_views", False)

# ──────────────────────────────────────────────────────────────────────
# 2.  Restricted execution environment
# ──────────────────────────────────────────────────────────────────────

ALLOWED_MODULES = {"cadquery", "math"}


def _safe_import(name, *args, **kwargs):
    if name not in ALLOWED_MODULES:
        raise ImportError(f"module '{name}' is not permitted in the sandbox")
    return __import__(name, *args, **kwargs)


SAFE_BUILTINS = {
    # ── Essential builtins ──
    "True": True,
    "False": False,
    "None": None,
    "print": print,
    "range": range,
    "len": len,
    "int": int,
    "float": float,
    "str": str,
    "bool": bool,
    "list": list,
    "dict": dict,
    "tuple": tuple,
    "set": set,
    "frozenset": frozenset,
    "bytes": bytes,
    "bytearray": bytearray,
    "complex": complex,
    # ── Math-like builtins ──
    "abs": abs,
    "min": min,
    "max": max,
    "round": round,
    "sum": sum,
    "pow": pow,
    "divmod": divmod,
    "hex": hex,
    "oct": oct,
    "bin": bin,
    # ── Sequence / iteration helpers ──
    "enumerate": enumerate,
    "zip": zip,
    "map": map,
    "filter": filter,
    "sorted": sorted,
    "reversed": reversed,
    "any": any,
    "all": all,
    "iter": iter,
    "next": next,
    "slice": slice,
    # ── Type introspection (read‑only) ──
    "isinstance": isinstance,
    "issubclass": issubclass,
    "type": type,
    "object": object,
    "property": property,
    "staticmethod": staticmethod,
    "classmethod": classmethod,
    "hasattr": hasattr,
    # ── Exceptions ──
    "Exception": Exception,
    "RuntimeError": RuntimeError,
    "ValueError": ValueError,
    "TypeError": TypeError,
    "NameError": NameError,
    "IndexError": IndexError,
    "KeyError": KeyError,
    "AttributeError": AttributeError,
    "ZeroDivisionError": ZeroDivisionError,
    "OverflowError": OverflowError,
    "ImportError": ImportError,
    "StopIteration": StopIteration,
    "ArithmeticError": ArithmeticError,
    "LookupError": LookupError,
    # ── The only import allowed ──
    "__import__": _safe_import,
}

RESTRICTED_GLOBALS: dict = {"__builtins__": SAFE_BUILTINS}

# ──────────────────────────────────────────────────────────────────────
# 3.  Read user code
# ──────────────────────────────────────────────────────────────────────

user_code = USER_CODE_PATH.read_text(encoding="utf-8")

# ──────────────────────────────────────────────────────────────────────
# 4.  Execute user code inside restricted namespace
# ──────────────────────────────────────────────────────────────────────

try:
    exec(user_code, RESTRICTED_GLOBALS)
except Exception:
    traceback.print_exc()
    raise RuntimeError("User code execution failed") from None

if "r" not in RESTRICTED_GLOBALS:
    raise RuntimeError("Code did not define variable 'r'")

result_shape = RESTRICTED_GLOBALS["r"]

# ──────────────────────────────────────────────────────────────────────
# 5.  Export files  (STL, STEP, GLB)
# ──────────────────────────────────────────────────────────────────────

import cadquery as cq  # noqa: E402  (import after restricted scope is fine)

STL_PATH = WORK / "output.stl"
STEP_PATH = WORK / "output.step"
GLB_PATH = WORK / "output.glb"

cq.exporters.export(result_shape, str(STL_PATH))
cq.exporters.export(result_shape, str(STEP_PATH))

try:
    asm = cq.Assembly()
    asm.add(result_shape, name="model")
    asm.save(str(GLB_PATH), "GLTF")
except Exception:
    pass

# ──────────────────────────────────────────────────────────────────────
# 6.  Validation
# ──────────────────────────────────────────────────────────────────────

val = result_shape.val()
validation = {
    "volume": round(val.Volume(), 3),
    "surface_area": round(val.Area(), 3),
    "is_valid": val.isValid(),
    "has_volume": val.Volume() > 0,
    "bounding_box": {
        "size": [
            round(val.BoundingBox().xlen, 3),
            round(val.BoundingBox().ylen, 3),
            round(val.BoundingBox().zlen, 3),
        ],
        "min": [
            round(val.BoundingBox().xmin, 3),
            round(val.BoundingBox().ymin, 3),
            round(val.BoundingBox().zmin, 3),
        ],
        "max": [
            round(val.BoundingBox().xmax, 3),
            round(val.BoundingBox().ymax, 3),
            round(val.BoundingBox().zmax, 3),
        ],
    },
}

warnings = []
if validation["volume"] <= 0:
    warnings.append("Model has zero volume")
bb_size = validation["bounding_box"]["size"]
if any(s > 10000 for s in bb_size):
    warnings.append(f"Model is very large ({bb_size}mm), check units")
if any(0 < s < 0.01 for s in bb_size):
    warnings.append(f"Model is very small ({bb_size}mm), check units")
validation["warnings"] = warnings

(WORK / "validation.json").write_text(json.dumps(validation), encoding="utf-8")

# ──────────────────────────────────────────────────────────────────────
# 7.  Detailed inspection
# ──────────────────────────────────────────────────────────────────────

from inspector import inspect_geometry  # noqa: E402

try:
    inspection = inspect_geometry(result_shape)
except Exception as ie:
    inspection = {"error": str(ie)}

(WORK / "inspection.json").write_text(json.dumps(inspection), encoding="utf-8")

# ──────────────────────────────────────────────────────────────────────
# 8.  Optional: SVG snapshots
# ──────────────────────────────────────────────────────────────────────

if RENDER_SNAPSHOTS:
    from snapshot import render_snapshots  # noqa: E402

    snapshot_dir = WORK / "snapshots"
    snapshot_dir.mkdir(parents=True, exist_ok=True)
    try:
        snap_paths = render_snapshots(result_shape, str(snapshot_dir))
        snaps = {}
        for view, path in snap_paths.items():
            snaps[view] = Path(path).read_text(encoding="utf-8")
        (WORK / "snapshots.json").write_text(json.dumps(snaps), encoding="utf-8")
    except Exception as se:
        (WORK / "snapshots.json").write_text(
            json.dumps({"error": str(se)}), encoding="utf-8"
        )

# ──────────────────────────────────────────────────────────────────────
# 9.  Optional: PNG snapshots (for LLM vision inspection)
# ──────────────────────────────────────────────────────────────────────

if RENDER_PNG:
    from png_snapshot import render_png_snapshots  # noqa: E402

    png_dir = WORK / "png_snapshots"
    png_dir.mkdir(parents=True, exist_ok=True)
    try:
        png_snaps = render_png_snapshots(str(STL_PATH), str(png_dir))
        (WORK / "png_snapshots.json").write_text(
            json.dumps(png_snaps), encoding="utf-8"
        )
    except Exception as pse:
        (WORK / "png_snapshots.json").write_text(
            json.dumps({"error": str(pse)}), encoding="utf-8"
        )

# ──────────────────────────────────────────────────────────────────────
# 10. Optional: 2D dimensional views
# ──────────────────────────────────────────────────────────────────────

if RENDER_DIM_VIEWS:
    from dim_views import render_dim_views  # noqa: E402

    dim_dir = WORK / "dim_views"
    dim_dir.mkdir(parents=True, exist_ok=True)
    try:
        dim_views = render_dim_views(str(STL_PATH), str(dim_dir))
        (WORK / "dim_views.json").write_text(
            json.dumps(dim_views), encoding="utf-8"
        )
    except Exception as dve:
        (WORK / "dim_views.json").write_text(
            json.dumps({"error": str(dve)}), encoding="utf-8"
        )

# ──────────────────────────────────────────────────────────────────────
# Done
# ──────────────────────────────────────────────────────────────────────

print("SUCCESS")
