"""Structured API errors that serialise to a stable envelope."""

from fastapi import Request
from fastapi.responses import JSONResponse


class ApiError(Exception):
    """An error safe to show the user, carrying a machine-readable code."""

    def __init__(self, code: str, message: str, field: str | None = None, status: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.field = field
        self.status = status


async def api_error_handler(_request: Request, exc: ApiError) -> JSONResponse:
    """Render an ApiError as {"error": {code, message, field}}."""
    return JSONResponse(
        status_code=exc.status,
        content={"error": {"code": exc.code, "message": exc.message, "field": exc.field}},
    )
