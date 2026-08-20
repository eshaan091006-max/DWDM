"""FastAPI application factory."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.errors import ApiError, api_error_handler


def create_app() -> FastAPI:
    """Build the application with CORS and error handling wired up."""
    app = FastAPI(title="Clustering Explorer", version="1.0.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_exception_handler(ApiError, api_error_handler)

    @app.get("/api/health")
    def health() -> dict[str, str]:
        """Liveness probe the frontend polls to show connection state."""
        return {"status": "ok"}

    return app


app = create_app()
