"""Utility / meta API routes — health check and passage listing."""

from __future__ import annotations

from fastapi import APIRouter

from app.models.schemas import HealthResponse, PassageResponse
from app.utils.passages import list_passages

router = APIRouter(tags=["Utility"])


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Health check",
    description="Returns a simple status object confirming the service is reachable.",
)
async def health() -> HealthResponse:
    return HealthResponse()


@router.get(
    "/passages",
    response_model=list[PassageResponse],
    summary="List available reading passages",
    description=(
        "Returns all passage files that are available on this server. "
        "The ``id`` values correspond to the ``passage_id`` form field in POST /assess."
    ),
)
async def get_passages() -> list[PassageResponse]:
    return [
        PassageResponse(
            id=p.id,
            title=p.title,
            description=p.description,
            word_count=p.word_count,
            text=p.text,
        )
        for p in list_passages()
    ]
