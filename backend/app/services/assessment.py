"""
Assessment submission orchestrator.

Ties together:
  * audio validation & persistence
  * Whisper transcription
  * miscue analysis
  * record storage
"""

from __future__ import annotations

import logging

from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

from app.models.assessment import Assessment, AssessmentRecord
from app.services import miscue as miscue_service
from app.services import storage
from app.services import transcription
from app.utils.passages import get_passage

logger = logging.getLogger(__name__)

_UPLOADS_DIR = Path(__file__).parent.parent.parent / "uploads"

# Accepted audio base-types (checked via substring so codec params like
# "audio/webm;codecs=opus" are handled correctly).
_ACCEPTED_AUDIO_BASES = (
    "audio/wav",
    "audio/x-wav",
    "audio/wave",
    "audio/vnd.wave",
    "audio/x-pn-wav",
    "audio/webm",
    "audio/mp4",
    "audio/m4a",
    "audio/mpeg",
    "audio/ogg",
    "application/octet-stream",  # generic binary — still attempt to transcribe
)


def _is_accepted_audio(content_type: str) -> bool:
    """Return True if *content_type* starts with any accepted audio base type."""
    base = content_type.split(";")[0].strip().lower()
    return base in {t.lower() for t in _ACCEPTED_AUDIO_BASES}

_MAX_AUDIO_BYTES = 50 * 1024 * 1024  # 50 MB


def get_audio_path(assessment_id: str) -> Path | None:
    """Return the saved recording path for an assessment, if it exists."""
    uploads_dir = _UPLOADS_DIR.resolve()
    for extension in (".wav", ".webm", ".m4a"):
        path = (_UPLOADS_DIR / f"{assessment_id}{extension}").resolve()
        if path.parent == uploads_dir and path.is_file():
            return path
    return None


async def run_assessment(
    *,
    audio_file: UploadFile,
    student_name: str,
    grade: str,
    section: str,
    passage_id: str,
) -> AssessmentRecord:
    """
    End-to-end assessment pipeline.

    1. Validate the uploaded audio file.
    2. Persist the file to ``uploads/``.
    3. Transcribe with Whisper.
    4. Load the expected passage.
    5. Run miscue analysis.
    6. Persist and return the :class:`AssessmentRecord`.
    """
    # ------------------------------------------------------------------
    # 1. Validate
    # ------------------------------------------------------------------
    content_type = (audio_file.content_type or "").lower()
    if content_type and not _is_accepted_audio(content_type):
        raise ValueError(
            f"Unsupported file type '{content_type}'. "
            "Please upload a WAV, WebM, or M4A audio recording."
        )

    passage = get_passage(passage_id)
    if passage is None:
        raise ValueError(f"Passage '{passage_id}' was not found on this server.")

    # ------------------------------------------------------------------
    # 2. Save audio to disk
    # ------------------------------------------------------------------
    _UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    assessment_id = str(uuid4())

    # Derive an appropriate extension from MIME type or original filename
    original_name = audio_file.filename or ""
    if original_name.endswith(".webm") or "webm" in content_type:
        ext = ".webm"
    elif original_name.endswith((".m4a", ".mp4")) or "mp4" in content_type or "m4a" in content_type:
        ext = ".m4a"
    else:
        ext = ".wav"

    audio_path = _UPLOADS_DIR / f"{assessment_id}{ext}"

    total_bytes = 0
    with audio_path.open("wb") as dest:
        while True:
            chunk = await audio_file.read(1024 * 64)  # 64 KB chunks
            if not chunk:
                break
            total_bytes += len(chunk)
            if total_bytes > _MAX_AUDIO_BYTES:
                dest.close()
                audio_path.unlink(missing_ok=True)
                raise ValueError(
                    f"Audio file exceeds the maximum allowed size of "
                    f"{_MAX_AUDIO_BYTES // (1024 * 1024)} MB."
                )
            dest.write(chunk)

    logger.info("Saved audio '%s' (%d bytes).", audio_path.name, total_bytes)

    # ------------------------------------------------------------------
    # 3. Transcribe
    # ------------------------------------------------------------------
    transcript = transcription.transcribe(audio_path)

    # ------------------------------------------------------------------
    # 4 & 5. Load passage + run miscue analysis
    # ------------------------------------------------------------------
    result = miscue_service.analyze(passage.text, transcript)

    # ------------------------------------------------------------------
    # 6. Build and persist the record
    # ------------------------------------------------------------------
    metadata = Assessment(
        id=assessment_id,
        student_name=student_name.strip(),
        grade=grade.strip(),
        section=section.strip(),
        passage_id=passage_id,
        created_at=datetime.utcnow(),
    )

    record = AssessmentRecord(
        **metadata.model_dump(),
        result=result,
    )

    storage.save_assessment(record)
    logger.info(
        "Assessment '%s' complete — %s, %s, accuracy=%.2f%%",
        record.id,
        student_name,
        passage_id,
        result.accuracy,
    )
    return record
