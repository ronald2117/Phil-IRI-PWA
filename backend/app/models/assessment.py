"""
Pydantic domain models for Phil-IRI assessment entities.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional
from uuid import uuid4

from pydantic import BaseModel, Field


MiscueType = Literal["Substitution", "Omission", "Insertion", "Repetition"]


class Miscue(BaseModel):
    """A single word-level miscue detected during oral reading."""

    expected: str = Field(..., description="The word as written in the passage.")
    actual: str = Field(..., description="The word as spoken by the student (empty for omissions).")
    type: MiscueType = Field(..., description="Category of the miscue.")


class AssessmentResult(BaseModel):
    """Computed analysis result for one assessment session."""

    transcript: str = Field(..., description="Raw text returned by the speech-to-text engine.")
    expected_text: str = Field(..., description="The original passage text.")
    total_words: int = Field(..., ge=0)
    correct_words: int = Field(..., ge=0)
    miscues: list[Miscue] = Field(default_factory=list)
    accuracy: float = Field(..., ge=0.0, le=100.0, description="Percentage of correctly read words.")
    reading_level: Literal["Independent", "Instructional", "Frustration"]


class AssessmentReview(BaseModel):
    """Teacher-corrected transcript and optional notes, stored separately."""

    transcript: str = Field(..., description="Teacher-corrected transcript.")
    notes: str = Field(default="", description="Teacher observations or next steps.")
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Assessment(BaseModel):
    """Core metadata for a single assessment session."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    student_name: str = Field(..., min_length=1, max_length=100)
    grade: str = Field(..., min_length=1, max_length=50)
    section: str = Field(default="", max_length=80)
    passage_id: str = Field(..., min_length=1)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class AssessmentRecord(Assessment):
    """Full persisted record — metadata + result + optional teacher review."""

    result: AssessmentResult
    review: Optional[AssessmentReview] = None


class PassageInfo(BaseModel):
    """Lightweight info about a readable passage available on this server."""

    id: str
    title: str
    description: str
    word_count: int
    text: str
