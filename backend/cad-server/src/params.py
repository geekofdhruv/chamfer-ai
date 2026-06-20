import re
from typing import Any


def extract_parameters(code: str) -> list[dict[str, Any]]:
    """Parse # [min:step:max] annotations from CadQuery Python code."""
    params = []
    pattern = re.compile(
        r'^(\w+)\s*=\s*([\d.]+)\s*#\s*\[([\d.]+):([\d.]+):([\d.]+)\]',
        re.MULTILINE,
    )
    for match in pattern.finditer(code):
        params.append({
            "name": match.group(1),
            "default": float(match.group(2)),
            "min": float(match.group(3)),
            "step": float(match.group(4)),
            "max": float(match.group(5)),
        })
    return params


def substitute_params(code: str, params: dict[str, float]) -> str:
    """Replace top-level variable assignments with new parameter values, preserving comments."""
    result = code
    for name, value in params.items():
        result = re.sub(
            rf'^({name}\s*=\s*)([\d.]+)(\s*#.*)?$',
            rf'\g<1>{value}\3',
            result,
            flags=re.MULTILINE,
        )
    return result
