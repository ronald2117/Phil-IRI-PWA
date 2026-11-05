"""
In-memory + JSON-file backed storage for assessment records.

Design
------
* Records are kept in an in-process ``dict`` for fast access.
* On every write the whole store is persisted to ``outputs/assessments.json``
  so that data survives a server restart.
* On startup the store is rehydrated from that file.

This is intentionally simple — suitable for an offline MVP running on a
single machine.  For multi-process or multi-machine deployments, replace
this module with a proper database backend.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from pathlib import Path
from threading import Lock
from typing import Optional

from app.models.assessment import AssessmentRecord, AssessmentResult, AssessmentReview

logger = logging.getLogger(__name__)

_OUTPUTS_DIR = Path(__file__).parent.parent.parent / "outputs"
_STORE_FILE = _OUTPUTS_DIR / "assessments.json"

_lock = Lock()
_store: dict[str, AssessmentRecord] = {}


# ---------------------------------------------------------------------------
# Persistence helpers
# ---------------------------------------------------------------------------


def _datetime_default(obj: object) -> str:
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj)} is not JSON serialisable")


def _save() -> None:
    """Persist the current in-memory store to disk (called while holding *_lock*)."""
    _OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    try:
        payload = {
            record_id: json.loads(record.model_dump_json())
            for record_id, record in _store.items()
        }
        _STORE_FILE.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2, default=_datetime_default),
            encoding="utf-8",
        )
    except Exception:
        logger.exception("Failed to persist assessment store to %s", _STORE_FILE)


def _load() -> None:
    """Rehydrate the in-memory store from the JSON file on disk (called once at startup)."""
    global _store
    if not _STORE_FILE.exists():
        logger.info("No existing assessment store found at %s — starting fresh.", _STORE_FILE)
        return
    try:
        raw = json.loads(_STORE_FILE.read_text(encoding="utf-8"))
        with _lock:
            _store = {
                record_id: AssessmentRecord.model_validate(data)
                for record_id, data in raw.items()
            }
        logger.info("Loaded %d assessment record(s) from %s", len(_store), _STORE_FILE)
    except Exception:
        logger.exception("Failed to load assessment store from %s — starting fresh.", _STORE_FILE)
        _store = {}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def initialise() -> None:
    """Call once during application startup to load persisted records."""
    _load()


def save_assessment(record: AssessmentRecord) -> AssessmentRecord:
    """Persist a new or updated :class:`AssessmentRecord`."""
    with _lock:
        _store[record.id] = record
        _save()
    logger.debug("Saved assessment '%s'.", record.id)
    return record


def get_assessment(assessment_id: str) -> Optional[AssessmentRecord]:
    """Return a record by ID, or ``None`` if not found."""
    return _store.get(assessment_id)


def list_assessments() -> list[AssessmentRecord]:
    """Return all records sorted newest-first."""
    with _lock:
        records = list(_store.values())
    return sorted(records, key=lambda r: r.created_at, reverse=True)


def update_review(assessment_id: str, review: AssessmentReview) -> Optional[AssessmentRecord]:
    """
    Attach or replace the teacher review on an existing record.

    Returns the updated record, or ``None`` if the ID was not found.
    """
    with _lock:
        record = _store.get(assessment_id)
        if record is None:
            return None
        updated = record.model_copy(update={"review": review})
        _store[assessment_id] = updated
        _save()
    logger.debug("Updated review for assessment '%s'.", assessment_id)
    return updated
