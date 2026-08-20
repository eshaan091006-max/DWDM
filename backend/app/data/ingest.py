"""Parsing of uploaded CSV and JSON files into a plain table.

The backend keeps no state between requests, so this returns the whole parsed
table in one response and the frontend owns column selection from there.
"""

import csv
import io
import json
from typing import Any

from app.errors import ApiError

_DELIMITERS = [",", ";", "\t", "|"]


def _as_number(value: Any) -> float | None:
    """Parse a cell as a float, or return None if it is blank or non-numeric."""
    if value is None:
        return None
    if isinstance(value, bool):
        return float(value)
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip()
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def _sniff_delimiter(sample: str) -> str:
    """Pick the delimiter appearing most often on the first non-empty line."""
    for line in sample.splitlines():
        if line.strip():
            counts = {d: line.count(d) for d in _DELIMITERS}
            best = max(counts, key=lambda d: counts[d])
            return best if counts[best] > 0 else ","
    return ","


def _looks_like_header(first: list[str], rest: list[list[str]]) -> bool:
    """True when the first row is all text but a later row has numbers."""
    if not rest:
        return False
    first_is_text = all(_as_number(cell) is None for cell in first if str(cell).strip())
    later_has_numbers = any(
        _as_number(cell) is not None for row in rest for cell in row
    )
    return first_is_text and later_has_numbers


def _finalise(columns: list[str], rows: list[list[Any]]) -> dict[str, Any]:
    """Normalise row widths, infer column types, and suggest features."""
    if not columns:
        raise ApiError("no_columns", "The file has no columns to read.", status=422)

    width = len(columns)
    padded: list[list[Any]] = []
    for row in rows:
        trimmed = list(row[:width])
        trimmed.extend([None] * (width - len(trimmed)))
        padded.append(trimmed)

    dtypes: list[str] = []
    typed: list[list[Any]] = [list(row) for row in padded]
    for col in range(width):
        values = [row[col] for row in padded]
        present = [v for v in values if v is not None and str(v).strip() != ""]
        numeric = bool(present) and all(_as_number(v) is not None for v in present)
        dtypes.append("numeric" if numeric else "text")
        for r, value in enumerate(values):
            if numeric:
                typed[r][col] = _as_number(value)
            elif value is None or str(value).strip() == "":
                typed[r][col] = None
            else:
                typed[r][col] = str(value)

    suggested = [name for name, dt in zip(columns, dtypes) if dt == "numeric"][:2]

    return {
        "columns": columns,
        "dtypes": dtypes,
        "rows": typed,
        "n_rows": len(typed),
        "suggested_features": suggested,
    }


def _parse_csv(text: str) -> dict[str, Any]:
    delimiter = _sniff_delimiter(text)
    reader = csv.reader(io.StringIO(text), delimiter=delimiter)
    raw = [row for row in reader if any(str(cell).strip() for cell in row)]
    if not raw:
        raise ApiError("empty_file", "The file contains no rows.", status=422)

    if _looks_like_header(raw[0], raw[1:]):
        columns = [cell.strip() or f"col_{i + 1}" for i, cell in enumerate(raw[0])]
        rows: list[list[Any]] = [list(row) for row in raw[1:]]
    else:
        columns = [f"col_{i + 1}" for i in range(len(raw[0]))]
        rows = [list(row) for row in raw]

    if not rows:
        raise ApiError("empty_file", "The file has a header but no data rows.", status=422)
    return _finalise(columns, rows)


def _parse_json(text: str) -> dict[str, Any]:
    try:
        payload = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ApiError("unparseable", f"Could not parse JSON: {exc.msg}", status=422) from exc

    if not isinstance(payload, list) or not payload:
        raise ApiError(
            "unparseable",
            "Expected a non-empty JSON array of objects or arrays.",
            status=422,
        )

    if isinstance(payload[0], dict):
        columns: list[str] = []
        for record in payload:
            if not isinstance(record, dict):
                raise ApiError("unparseable", "Mixed JSON record shapes.", status=422)
            for key in record:
                if key not in columns:
                    columns.append(str(key))
        rows = [[record.get(name) for name in columns] for record in payload]
        return _finalise(columns, rows)

    if isinstance(payload[0], list):
        width = max(len(row) for row in payload if isinstance(row, list))
        columns = [f"col_{i + 1}" for i in range(width)]
        rows = [list(row) for row in payload if isinstance(row, list)]
        return _finalise(columns, rows)

    raise ApiError(
        "unparseable",
        "Expected a JSON array of objects or arrays, not scalars.",
        status=422,
    )


def parse_table(filename: str, content: bytes) -> dict[str, Any]:
    """Parse an uploaded CSV or JSON file into columns, dtypes, and rows."""
    if not content or not content.strip():
        raise ApiError("empty_file", "The uploaded file is empty.", status=422)

    text = content.decode("utf-8-sig", errors="replace")
    lowered = filename.lower()

    if lowered.endswith(".json"):
        return _parse_json(text)
    if lowered.endswith((".csv", ".tsv", ".txt")):
        return _parse_csv(text)

    raise ApiError(
        "unsupported_format",
        f"Cannot read {filename!r}. Upload a .csv, .tsv, .txt, or .json file.",
        status=415,
    )
