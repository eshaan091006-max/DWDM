"""FastAPI application factory."""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import router
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

    @app.exception_handler(RequestValidationError)
    async def validation_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
        """Render pydantic validation failures in the same envelope as ApiError."""
        first = exc.errors()[0] if exc.errors() else {}
        location = [str(part) for part in first.get("loc", []) if part != "body"]
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "invalid_request",
                    "message": first.get("msg", "The request was not valid."),
                    "field": ".".join(location) or None,
                }
            },
        )

    app.include_router(router)

    @app.get("/api/health")
    def health() -> dict[str, str]:
        """Liveness probe the frontend polls to show connection state."""
        return {"status": "ok"}

    return app


app = create_app()
