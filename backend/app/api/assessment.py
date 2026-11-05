"""API routes for assessment operations."""

from __future__ import annotations

import logging
from datetime import datetime

from fastapi import APIRouter, Form, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse

from app.models.schemas import (
    AssessmentDetailResponse,
    AssessmentListItem,
    AssessmentsListResponse,
    AssessmentResponse,
    ReviewUpdateRequest,
    ReviewUpdateResponse,
)
from app.models.assessment import AssessmentReview
from app.services import assessment as assessment_service
from app.services import storage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="", tags=["Assessment"])


# ---------------------------------------------------------------------------
# POST /assess
# ---------------------------------------------------------------------------


@router.post(
    "/assess",
    response_model=AssessmentResponse,
    status_code=status.HTTP_200_OK,
    summary="Submit an oral reading recording for assessment",
    description=(
        "Accepts a WAV/WebM/M4A audio recording and form metadata, runs "
        "Whisper transcription, performs word-level miscue analysis against "
        "the requested passage, and returns the full analysis result."
    ),
)
async def submit_assessment(
    audio_file: UploadFile,
    student_name: str = Form(..., min_length=1, max_length=100),
    grade: str = Form(..., min_length=1, max_length=50),
    section: str = Form(default="", max_length=80),
    passage_id: str = Form(..., min_length=1),
) -> AssessmentResponse:
    logger.info(
        "POST /assess — student='%s', grade='%s', passage='%s'",
        student_name, grade, passage_id,
    )

    try:
        record = await assessment_service.run_assessment(
            audio_file=audio_file,
            student_name=student_name,
            grade=grade,
            section=section,
            passage_id=passage_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except RuntimeError as exc:
        logger.exception("Transcription runtime error.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Transcription service error: {exc}",
        )
    except Exception:
        logger.exception("Unexpected error during assessment.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred. Please try again.",
        )

    result = record.result
    return AssessmentResponse(
        id=record.id,
        student_name=record.student_name,
        grade=record.grade,
        section=record.section,
        passage_id=record.passage_id,
        created_at=record.created_at,
        # Flatten result fields — matches frontend normalizeSummary expectations
        transcript=result.transcript,
        expected_text=result.expected_text,
        total_words=result.total_words,
        correct_words=result.correct_words,
        miscues=result.miscues,
        accuracy=result.accuracy,
        reading_level=result.reading_level,
    )


# ---------------------------------------------------------------------------
# GET /assessments
# ---------------------------------------------------------------------------


@router.get(
    "/assessments",
    response_model=AssessmentsListResponse,
    summary="List all assessment records",
)
async def list_assessments() -> AssessmentsListResponse:
    records = storage.list_assessments()
    items = [
        AssessmentListItem(
            id=r.id,
            student_name=r.student_name,
            grade=r.grade,
            section=r.section,
            passage_id=r.passage_id,
            created_at=r.created_at,
            result=r.result,
            review=r.review,
        )
        for r in records
    ]
    return AssessmentsListResponse(assessments=items, total=len(items))


# ---------------------------------------------------------------------------
# GET /assessments/{id}
# ---------------------------------------------------------------------------


@router.get(
    "/assessments/{assessment_id}",
    response_model=AssessmentDetailResponse,
    summary="Retrieve a single assessment by ID",
)
async def get_assessment(assessment_id: str) -> AssessmentDetailResponse:
    record = storage.get_assessment(assessment_id)
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assessment '{assessment_id}' not found.",
        )
    return AssessmentDetailResponse(
        id=record.id,
        student_name=record.student_name,
        grade=record.grade,
        section=record.section,
        passage_id=record.passage_id,
        created_at=record.created_at,
        result=record.result,
        review=record.review,
    )


# ---------------------------------------------------------------------------
# PATCH /assessments/{id}/review
# ---------------------------------------------------------------------------


@router.patch(
    "/assessments/{assessment_id}/review",
    response_model=ReviewUpdateResponse,
    summary="Save teacher corrections / review for an assessment",
)
async def update_review(
    assessment_id: str,
    body: ReviewUpdateRequest,
) -> ReviewUpdateResponse:
    review = AssessmentReview(
        transcript=body.transcript,
        notes=body.notes,
        updated_at=body.updated_at or datetime.utcnow(),
    )
    updated = storage.update_review(assessment_id, review)
    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assessment '{assessment_id}' not found.",
        )
    return ReviewUpdateResponse(id=updated.id, review=review)
