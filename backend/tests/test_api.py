import io

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture
def client():
    return TestClient(create_app())


def blobs(client, n=80):
    response = client.post(
        "/api/datasets/generate",
        json={"kind": "blobs", "n_samples": n, "noise": 0.02, "random_seed": 0},
    )
    return response.json()["points"]


def test_algorithms_endpoint_lists_all_three(client):
    body = client.get("/api/algorithms").json()
    assert set(body["algorithms"]) == {"dbscan", "birch", "cure"}
    assert body["algorithms"]["dbscan"]["params"]


def test_generators_endpoint_lists_metadata(client):
    body = client.get("/api/datasets/generators").json()
    assert "blobs" in body["generators"]
    assert body["generators"]["blobs"]["hint"]


def test_generate_returns_points_and_ground_truth(client):
    response = client.post(
        "/api/datasets/generate",
        json={"kind": "moons", "n_samples": 50, "noise": 0.05, "random_seed": 1},
    )
    body = response.json()
    assert response.status_code == 200
    assert len(body["points"]) == 50
    assert len(body["points"][0]) == 2
    assert body["feature_names"] == ["x", "y"]
    assert len(body["source_labels"]) == 50


def test_generate_rejects_unknown_kind(client):
    response = client.post(
        "/api/datasets/generate", json={"kind": "spirals", "n_samples": 10}
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"]


def test_upload_parses_csv(client):
    file = io.BytesIO(b"x,y\n1,2\n3,4\n")
    response = client.post(
        "/api/datasets/upload", files={"file": ("data.csv", file, "text/csv")}
    )
    body = response.json()
    assert response.status_code == 200
    assert body["columns"] == ["x", "y"]
    assert body["n_rows"] == 2
    assert body["rows"] == [[1.0, 2.0], [3.0, 4.0]]


def test_upload_rejects_unsupported_format(client):
    file = io.BytesIO(b"junk")
    response = client.post(
        "/api/datasets/upload", files={"file": ("data.xlsx", file, "application/octet-stream")}
    )
    assert response.status_code == 415
    assert response.json()["error"]["code"] == "unsupported_format"


@pytest.mark.parametrize(
    "algorithm,params",
    [
        ("dbscan", {"eps": 0.9, "min_pts": 5}),
        ("birch", {"threshold": 0.5, "branching_factor": 8, "n_clusters": 3}),
        ("cure", {"n_clusters": 3, "n_representatives": 4, "shrink_factor": 0.2}),
    ],
)
def test_cluster_endpoint_returns_the_full_envelope(client, algorithm, params):
    points = blobs(client)
    response = client.post(
        f"/api/cluster/{algorithm}",
        json={"points": points, "params": params, "record_trace": True},
    )
    body = response.json()
    assert response.status_code == 200
    assert body["algorithm"] == algorithm
    assert len(body["labels"]) == len(points)
    assert body["n_clusters"] >= 1
    assert body["runtime_ms"] >= 0
    assert "silhouette" in body["metrics"]
    assert body["projection"]["points_2d"]
    assert body["trace"]["steps"]
    assert body["params_used"]


def test_cluster_trace_can_be_disabled(client):
    points = blobs(client)
    response = client.post(
        "/api/cluster/dbscan",
        json={"points": points, "params": {"eps": 0.9, "min_pts": 5}, "record_trace": False},
    )
    assert response.json()["trace"]["steps"] == []


def test_cluster_rejects_unknown_algorithm(client):
    response = client.post(
        "/api/cluster/kmeans", json={"points": [[0.0, 0.0]], "params": {}}
    )
    assert response.status_code == 404


def test_cluster_rejects_empty_points(client):
    response = client.post(
        "/api/cluster/dbscan", json={"points": [], "params": {"eps": 0.5, "min_pts": 3}}
    )
    assert response.status_code == 422


def test_cluster_rejects_ragged_points(client):
    response = client.post(
        "/api/cluster/dbscan",
        json={"points": [[0.0, 0.0], [1.0]], "params": {"eps": 0.5, "min_pts": 3}},
    )
    assert response.status_code == 422


def test_cluster_rejects_non_finite_values(client):
    response = client.post(
        "/api/cluster/dbscan",
        json={"points": [[0.0, 0.0], [1.0, None]], "params": {"eps": 0.5, "min_pts": 3}},
    )
    assert response.status_code == 422


def test_cluster_rejects_bad_parameter_values(client):
    points = blobs(client, n=20)
    response = client.post(
        "/api/cluster/dbscan", json={"points": points, "params": {"eps": 0, "min_pts": 3}}
    )
    assert response.status_code == 422
    assert response.json()["error"]["message"]


def test_cluster_ignores_unknown_parameter_names(client):
    points = blobs(client, n=20)
    response = client.post(
        "/api/cluster/dbscan",
        json={"points": points, "params": {"eps": 0.9, "min_pts": 5, "bogus": 1}},
    )
    assert response.status_code == 200
    assert "bogus" not in response.json()["params_used"]


def test_standardize_flag_changes_the_outcome(client):
    points = [[x, x * 100.0] for x in range(30)]
    raw = client.post(
        "/api/cluster/dbscan",
        json={"points": points, "params": {"eps": 1.0, "min_pts": 3}, "standardize": False},
    ).json()
    scaled = client.post(
        "/api/cluster/dbscan",
        json={"points": points, "params": {"eps": 1.0, "min_pts": 3}, "standardize": True},
    ).json()
    assert raw["labels"] != scaled["labels"]


def test_compare_runs_all_three_on_one_dataset(client):
    points = blobs(client)
    response = client.post(
        "/api/cluster/compare",
        json={
            "points": points,
            "configs": {
                "dbscan": {"eps": 0.9, "min_pts": 5},
                "birch": {"threshold": 0.5, "branching_factor": 8, "n_clusters": 3},
                "cure": {"n_clusters": 3},
            },
        },
    )
    body = response.json()
    assert response.status_code == 200
    assert set(body["results"]) == {"dbscan", "birch", "cure"}
    for result in body["results"].values():
        assert len(result["labels"]) == len(points)
        assert result["trace"]["steps"] == []  # compare mode never animates


def test_project_returns_two_dimensions_and_variance(client):
    points = [[float(i), float(i * 2), float(i % 3), float(i % 5)] for i in range(40)]
    response = client.post("/api/analysis/project", json={"points": points})
    body = response.json()
    assert response.status_code == 200
    assert len(body["projected"]) == 40
    assert len(body["projected"][0]) == 2
    assert len(body["explained_variance_ratio"]) == 2


def test_high_dimensional_clustering_projects_for_display(client):
    points = [[float(i), float(i * 2), float(i * 3), float(i % 4)] for i in range(40)]
    response = client.post(
        "/api/cluster/birch",
        json={"points": points, "params": {"threshold": 5.0, "n_clusters": 2}},
    )
    body = response.json()
    assert len(body["projection"]["points_2d"][0]) == 2
    assert body["projection"]["explained_variance_ratio"] is not None
