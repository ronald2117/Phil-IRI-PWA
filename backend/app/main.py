"""
FastAPI application factory for the Phil-IRI Oral Reading Assessment backend.
"""

from __future__ import annotations

import logging
import logging.config

from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.assessment import router as assessment_router
from app.api.utils import router as utils_router
from app.services import storage

# ---------------------------------------------------------------------------
# Logging configuration
# ---------------------------------------------------------------------------

logging.config.dictConfig(
    {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "default": {
                "format": "%(asctime)s [%(levelname)s] %(name)s — %(message)s",
                "datefmt": "%Y-%m-%d %H:%M:%S",
            }
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "formatter": "default",
            }
        },
        "root": {"handlers": ["console"], "level": "INFO"},
        "loggers": {
            "app": {"level": "DEBUG", "propagate": True},
            "uvicorn": {"level": "INFO", "propagate": False, "handlers": ["console"]},
            "uvicorn.error": {"level": "INFO", "propagate": False, "handlers": ["console"]},
            "uvicorn.access": {"level": "WARNING", "propagate": False, "handlers": ["console"]},
        },
    }
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lifespan — startup / shutdown hooks
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    logger.info("🚀  Phil-IRI assessment service starting …")
    storage.initialise()
    yield
    logger.info("🛑  Phil-IRI assessment service shutting down.")


# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------


def create_app() -> FastAPI:
    app = FastAPI(
        title="Phil-IRI Oral Reading Assessment API",
        description=(
            "Offline, teacher-assisted Philippine Informal Reading Inventory (Phil-IRI) "
            "miscue detector.  Upload a WAV recording of a student's oral reading to "
            "receive a transcript, word-level miscue analysis, accuracy score, and "
            "reading level classification."
        ),
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    # ------------------------------------------------------------------
    # CORS — allow the Vite dev server and any local origin by default.
    # Tighten origins in production via environment variables if needed.
    # ------------------------------------------------------------------
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ------------------------------------------------------------------
    # Global exception handler — return JSON for unhandled exceptions
    # ------------------------------------------------------------------
    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled exception on %s %s", request.method, request.url)
        return JSONResponse(
            status_code=500,
            content={"detail": "An internal server error occurred."},
        )

    # ------------------------------------------------------------------
    # Routers
    # ------------------------------------------------------------------
    app.include_router(utils_router)
    app.include_router(assessment_router)

    return app


app = create_app()
