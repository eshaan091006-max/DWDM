from fastapi.testclient import TestClient

from app.main import create_app


def test_health_reports_ok():
    client = TestClient(create_app())
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_api_error_is_serialised_as_envelope():
    from app.errors import ApiError

    app = create_app()

    @app.get("/api/boom")
    def boom():
        raise ApiError("bad_input", "eps must be positive", field="eps", status=422)

    client = TestClient(app)
    response = client.get("/api/boom")
    assert response.status_code == 422
    assert response.json() == {
        "error": {"code": "bad_input", "message": "eps must be positive", "field": "eps"}
    }
