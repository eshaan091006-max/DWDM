"""Vercel serverless entry point for the FastAPI backend.

Vercel's Python runtime looks for an ASGI application named `app` in this
module. The real application lives in `backend/app/`, which is not on the
import path inside the function bundle, so this adds it before importing.

`vercel.json` routes every `/api/*` request here and preserves the original
path, so FastAPI's own routes (`/api/health`, `/api/cluster/{algorithm}`, …)
match exactly as they do under uvicorn locally.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend"))

from app.main import app  # noqa: E402  (path must be set before this import)

__all__ = ["app"]
