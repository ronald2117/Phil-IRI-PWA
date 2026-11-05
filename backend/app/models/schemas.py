"""Request and response schemas (Pydantic) for the Phil-IRI API."""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.models.assessment import AssessmentReview, AssessmentResult, Miscue


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------


class ReviewUpdateRequest(BaseModel):
    """Body for PATCH /assessments/{id}/review."""

    transcript: str = Field(..., max_length=12000, description="Teacher-corrected transcript.")
    notes: str = Field(default="")
    updated_at: Optional[datetime] = Field(
        default=None,
        description="Client-supplied timestamp; server uses utcnow() if omitted.",
    )


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    version: str = "1.0.0"
    message: str = "Phil-IRI assessment service is running."


class PassageResponse(BaseModel):
    id: str
    title: str
    description: str
    word_count: int
    text: str


class AssessmentResponse(BaseModel):
    """Full API response returned after a successful POST /assess."""

    id: str
    student_name: str
    grade: str
    section: str
    passage_id: str
    created_at: datetime

    # Result fields (flattened for the frontend's normalizeSummary helper)
    transcript: str
    expected_text: str
    total_words: int
    correct_words: int
    miscues: list[Miscue]
    accuracy: float
    reading_level: str


class AssessmentListItem(BaseModel):
    """Condensed record returned by GET /assessments."""

    id: str
    student_name: str
    grade: str
    section: str
    passage_id: str
    created_at: datetime
    result: Optional[AssessmentResult] = None
    review: Optional[AssessmentReview] = None


class AssessmentDetailResponse(BaseModel):
    """Full record returned by GET /assessments/{id}."""

    id: str
    student_name: str
    grade: str
    section: str
    passage_id: str
    created_at: datetime
    result: AssessmentResult
    review: Optional[AssessmentReview] = None


class AssessmentsListResponse(BaseModel):
    assessments: list[AssessmentListItem]
    total: int


class ReviewUpdateResponse(BaseModel):
    id: str
    review: AssessmentReview
    result: AssessmentResult
