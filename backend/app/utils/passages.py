"""
Passage loader — discovers and parses .txt passage files from the
``passages/`` directory at the backend root.

Expected file naming convention: ``<passage-id>.txt``
  e.g. ``si-alitaptap.txt``, ``ang-pagong-at-kuneho.txt``

Each file may optionally start with a metadata block::

    # title: Si Alitaptap
    # description: Maikling kuwento tungkol sa isang gabi sa halamanan.

Lines that do not start with ``#`` are treated as the passage body.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path

from app.models.assessment import PassageInfo
from app.utils.text import tokenize

logger = logging.getLogger(__name__)

# Resolve the passages directory relative to this file's location:
# backend/app/utils/passages.py  →  backend/passages/
_PASSAGES_DIR = Path(__file__).parent.parent.parent / "passages"


def _parse_passage_file(path: Path) -> PassageInfo:
    """Parse a single passage ``.txt`` file into a :class:`PassageInfo`."""
    raw = path.read_text(encoding="utf-8").strip()
    lines = raw.splitlines()

    metadata: dict[str, str] = {}
    body_lines: list[str] = []
    in_body = False

    for line in lines:
        stripped = line.strip()
        if not in_body and stripped.startswith("#"):
            # Metadata line: ``# key: value``
            content = stripped.lstrip("#").strip()
            if ":" in content:
                key, _, value = content.partition(":")
                metadata[key.strip().lower()] = value.strip()
        else:
            in_body = True
            body_lines.append(line)

    text = " ".join(" ".join(body_lines).split())  # collapse whitespace
    passage_id = path.stem  # filename without extension

    return PassageInfo(
        id=passage_id,
        title=metadata.get("title", passage_id.replace("-", " ").title()),
        description=metadata.get("description", ""),
        word_count=len(tokenize(text)),
        text=text,
    )


@lru_cache(maxsize=1)
def load_passages() -> dict[str, PassageInfo]:
    """
    Load all passage files from the passages directory.

    Results are cached after the first call so the filesystem is only read
    once per process lifetime.
    """
    passages: dict[str, PassageInfo] = {}

    if not _PASSAGES_DIR.exists():
        logger.warning("Passages directory not found: %s", _PASSAGES_DIR)
        return passages

    for path in sorted(_PASSAGES_DIR.glob("*.txt")):
        try:
            passage = _parse_passage_file(path)
            passages[passage.id] = passage
            logger.debug("Loaded passage '%s' (%d words)", passage.id, passage.word_count)
        except Exception:
            logger.exception("Failed to load passage file: %s", path)

    logger.info("Loaded %d passage(s) from %s", len(passages), _PASSAGES_DIR)
    return passages


def get_passage(passage_id: str) -> PassageInfo | None:
    """Return a :class:`PassageInfo` by its ID, or ``None`` if not found."""
    return load_passages().get(passage_id)


def list_passages() -> list[PassageInfo]:
    """Return all available passages sorted by ID."""
    return sorted(load_passages().values(), key=lambda p: p.id)
