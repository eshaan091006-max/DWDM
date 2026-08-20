import json

import pytest

from app.data.ingest import parse_table
from app.errors import ApiError


def test_parses_csv_with_header():
    content = b"x,y,label\n1.0,2.0,a\n3.0,4.0,b\n"
    table = parse_table("data.csv", content)
    assert table["columns"] == ["x", "y", "label"]
    assert table["dtypes"] == ["numeric", "numeric", "text"]
    assert table["rows"] == [[1.0, 2.0, "a"], [3.0, 4.0, "b"]]
    assert table["n_rows"] == 2
    assert table["suggested_features"] == ["x", "y"]


def test_parses_csv_without_header():
    content = b"1.0,2.0\n3.0,4.0\n"
    table = parse_table("data.csv", content)
    assert table["columns"] == ["col_1", "col_2"]
    assert table["n_rows"] == 2


def test_sniffs_semicolon_and_tab_delimiters():
    semi = parse_table("d.csv", b"x;y\n1;2\n3;4\n")
    assert semi["columns"] == ["x", "y"]
    tab = parse_table("d.csv", b"x\ty\n1\t2\n3\t4\n")
    assert tab["columns"] == ["x", "y"]


def test_handles_crlf_line_endings_and_blank_lines():
    table = parse_table("d.csv", b"x,y\r\n1,2\r\n\r\n3,4\r\n")
    assert table["n_rows"] == 2


def test_ragged_rows_are_padded_not_rejected():
    table = parse_table("d.csv", b"x,y,z\n1,2\n3,4,5\n")
    assert all(len(row) == 3 for row in table["rows"])


def test_missing_values_become_none():
    table = parse_table("d.csv", b"x,y\n1,\n3,4\n")
    assert table["rows"][0][1] is None
    assert table["dtypes"][1] == "numeric"


def test_parses_json_array_of_objects():
    content = json.dumps([{"x": 1, "y": 2}, {"x": 3, "y": 4}]).encode()
    table = parse_table("data.json", content)
    assert table["columns"] == ["x", "y"]
    assert table["rows"] == [[1.0, 2.0], [3.0, 4.0]]


def test_parses_json_array_of_arrays():
    content = json.dumps([[1, 2], [3, 4]]).encode()
    table = parse_table("data.json", content)
    assert table["columns"] == ["col_1", "col_2"]
    assert table["n_rows"] == 2


def test_json_objects_with_differing_keys_union_the_columns():
    content = json.dumps([{"x": 1}, {"y": 2}]).encode()
    table = parse_table("data.json", content)
    assert set(table["columns"]) == {"x", "y"}
    assert table["n_rows"] == 2


def test_suggested_features_skips_text_columns():
    table = parse_table("d.csv", b"name,x,y\na,1,2\nb,3,4\n")
    assert table["suggested_features"] == ["x", "y"]


def test_suggested_features_is_empty_when_nothing_is_numeric():
    table = parse_table("d.csv", b"a,b\nfoo,bar\nbaz,qux\n")
    assert table["suggested_features"] == []


def test_empty_file_is_rejected():
    with pytest.raises(ApiError) as excinfo:
        parse_table("d.csv", b"")
    assert excinfo.value.code == "empty_file"


def test_unsupported_extension_is_rejected():
    with pytest.raises(ApiError) as excinfo:
        parse_table("data.xlsx", b"anything")
    assert excinfo.value.code == "unsupported_format"


def test_malformed_json_is_rejected():
    with pytest.raises(ApiError) as excinfo:
        parse_table("data.json", b"{not json")
    assert excinfo.value.code == "unparseable"


def test_json_scalar_is_rejected():
    with pytest.raises(ApiError) as excinfo:
        parse_table("data.json", b"42")
    assert excinfo.value.code == "unparseable"
