import re
from typing import Any


def extract_parameters(code: str) -> list[dict[str, Any]]:
    """
    DEPRECATED: Parameters are now parsed from JSON response.
    Kept for backward compatibility. Returns empty list.
    """
    return []


def substitute_params(code: str, params: dict[str, float | int | str]) -> str:
    """Replace top-level variable assignments with new parameter values, preserving type."""
    result = code
    for name, value in params.items():
        # Detect if original value was an integer (no decimal point in source)
        original_match = re.search(rf'^{name}\s*=\s*([\d.]+)', result, re.MULTILINE)
        if original_match and '.' not in original_match.group(1):
            formatted_value = int(value)
        else:
            formatted_value = value

        # Replace the value while preserving any trailing comment
        result = re.sub(
            rf'^({name}\s*=\s*)([\d.]+)(\s*#.*)?$',
            rf'\g<1>{formatted_value}\3',
            result,
            flags=re.MULTILINE,
        )
    return result
