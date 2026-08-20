import inspect

import pytest

from app.algorithms.birch import birch
from app.algorithms.cure import cure
from app.algorithms.dbscan import dbscan
from app.registry import ALGORITHMS

IMPLEMENTATIONS = {"dbscan": dbscan, "birch": birch, "cure": cure}


def test_all_three_algorithms_are_registered():
    assert set(ALGORITHMS) == {"dbscan", "birch", "cure"}


@pytest.mark.parametrize("key", ["dbscan", "birch", "cure"])
def test_registry_entries_are_complete(key):
    entry = ALGORITHMS[key]
    assert entry["key"] == key
    assert entry["label"] and entry["tagline"]
    assert entry["params"]
    theory = entry["theory"]
    assert theory["summary"]
    assert theory["how_it_works"]
    assert theory["complexity"]
    assert theory["strengths"] and theory["weaknesses"]


@pytest.mark.parametrize("key", ["dbscan", "birch", "cure"])
def test_every_declared_param_exists_on_the_implementation(key):
    signature = inspect.signature(IMPLEMENTATIONS[key])
    for param in ALGORITHMS[key]["params"]:
        assert param["name"] in signature.parameters, param["name"]


@pytest.mark.parametrize("key", ["dbscan", "birch", "cure"])
def test_declared_defaults_match_the_implementation(key):
    signature = inspect.signature(IMPLEMENTATIONS[key])
    for param in ALGORITHMS[key]["params"]:
        actual = signature.parameters[param["name"]].default
        if actual is not inspect.Parameter.empty and param["default"] is not None:
            assert actual == param["default"], param["name"]


@pytest.mark.parametrize("key", ["dbscan", "birch", "cure"])
def test_numeric_params_declare_a_usable_range(key):
    for param in ALGORITHMS[key]["params"]:
        if param["type"] in ("float", "int"):
            assert param["min"] < param["max"]
            assert param["step"] > 0
        if param["type"] == "choice":
            assert param["options"]
            assert param["default"] in param["options"]


@pytest.mark.parametrize("key", ["dbscan", "birch", "cure"])
def test_every_param_has_help_and_a_theory_entry(key):
    entry = ALGORITHMS[key]
    for param in entry["params"]:
        assert param["help"]
        assert param["name"] in entry["theory"]["parameters"]


def test_registry_is_json_serialisable():
    import json

    json.dumps(ALGORITHMS)
