"""Text normalisation utilities for Phil-IRI passage and transcript text."""

from __future__ import annotations

import re
import unicodedata


# Filipino punctuation and common OCR artefacts to strip before comparison
_PUNCT_RE = re.compile(r"[^\w\s]", re.UNICODE)
_SPACE_RE = re.compile(r"\s+")


def normalize(text: str) -> str:
    """
    Lowercase, strip punctuation, collapse whitespace.

    The normalisation is intentionally minimal so that Filipino words with
    diacritics (e.g. *nagliliparan*) remain intact; only canonical Unicode
    decomposition is applied before stripping punctuation marks.
    """
    # Decompose Unicode so that combining diacritical marks can be identified
    text = unicodedata.normalize("NFC", text)
    text = text.lower()
    text = _PUNCT_RE.sub(" ", text)
    text = _SPACE_RE.sub(" ", text).strip()
    return text


def tokenize(text: str) -> list[str]:
    """Return a list of non-empty word tokens from normalised text."""
    return [token for token in normalize(text).split(" ") if token]
