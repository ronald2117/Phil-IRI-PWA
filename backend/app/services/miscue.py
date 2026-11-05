"""
Word-level miscue detection for oral reading assessment.

Algorithm
---------
1. Tokenise both the expected passage and the student's transcript.
2. Use ``difflib.SequenceMatcher`` to align the two token sequences.
3. Map each opcode to a miscue type:

   - ``replace`` → Substitution (expected word ≠ actual word)
   - ``delete``  → Omission (word present in passage, absent in transcript)
   - ``insert``  → Insertion (word absent in passage, present in transcript)

4. Run a second pass on the aligned pairs to detect **Repetitions**:
   a repeated word is one that appears consecutively in the actual tokens
   with no matching position in the expected tokens.

Accuracy formula
----------------
    accuracy = (correct_words / total_words) × 100

Reading levels (Phil-IRI standard)
-----------------------------------
    ≥ 97 %  → Independent
    90–96 % → Instructional
    < 90 %  → Frustration
"""

from __future__ import annotations

import logging
from difflib import SequenceMatcher
from typing import NamedTuple

from app.models.assessment import AssessmentResult, Miscue
from app.utils.text import tokenize

logger = logging.getLogger(__name__)


class _AlignedPair(NamedTuple):
    expected: str  # empty string means insertion
    actual: str    # empty string means omission


def _determine_reading_level(accuracy: float) -> str:
    if accuracy >= 97.0:
        return "Independent"
    if accuracy >= 90.0:
        return "Instructional"
    return "Frustration"


def _detect_repetitions(pairs: list[_AlignedPair]) -> list[Miscue]:
    """
    Find words the student repeated.

    A repetition is detected when the same *actual* token appears at two
    consecutive positions in the aligned pairs while the corresponding
    *expected* tokens are either empty (insertion slot) or the same word —
    indicating the student said the word more than once.

    Returns a list of :class:`Miscue` objects of type ``"Repetition"``.
    """
    repetitions: list[Miscue] = []
    prev_actual = ""

    for pair in pairs:
        actual = pair.actual.lower()
        if actual and actual == prev_actual:
            repetitions.append(
                Miscue(
                    expected=pair.expected or pair.actual,
                    actual=pair.actual,
                    type="Repetition",
                )
            )
        if actual:
            prev_actual = actual

    return repetitions


def analyze(expected_text: str, transcript: str) -> AssessmentResult:
    """
    Compare *expected_text* (passage) against *transcript* (student speech)
    and return a fully computed :class:`AssessmentResult`.

    Parameters
    ----------
    expected_text:
        The canonical passage text as stored on disk.
    transcript:
        Raw text returned by the speech-to-text engine.
    """
    expected_tokens = tokenize(expected_text)
    actual_tokens = tokenize(transcript)

    total_words = len(expected_tokens)

    if total_words == 0:
        logger.warning("Expected text has no tokens — returning empty result.")
        return AssessmentResult(
            transcript=transcript,
            expected_text=expected_text,
            total_words=0,
            correct_words=0,
            miscues=[],
            accuracy=0.0,
            reading_level="Frustration",
        )

    # ------------------------------------------------------------------
    # Word-level alignment via SequenceMatcher
    # ------------------------------------------------------------------
    matcher = SequenceMatcher(
        None,
        expected_tokens,
        actual_tokens,
        autojunk=False,
    )

    primary_miscues: list[Miscue] = []
    aligned_pairs: list[_AlignedPair] = []

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        expected_chunk = expected_tokens[i1:i2]
        actual_chunk = actual_tokens[j1:j2]

        if tag == "equal":
            for exp, act in zip(expected_chunk, actual_chunk):
                aligned_pairs.append(_AlignedPair(exp, act))

        elif tag == "replace":
            # Pair up as many words as possible; remainder are omissions / insertions
            for exp, act in zip(expected_chunk, actual_chunk):
                primary_miscues.append(
                    Miscue(expected=exp, actual=act, type="Substitution")
                )
                aligned_pairs.append(_AlignedPair(exp, act))

            # Extra expected words with no actual counterpart → omissions
            for exp in expected_chunk[len(actual_chunk):]:
                primary_miscues.append(
                    Miscue(expected=exp, actual="", type="Omission")
                )
                aligned_pairs.append(_AlignedPair(exp, ""))

            # Extra actual words with no expected counterpart → insertions
            for act in actual_chunk[len(expected_chunk):]:
                primary_miscues.append(
                    Miscue(expected="", actual=act, type="Insertion")
                )
                aligned_pairs.append(_AlignedPair("", act))

        elif tag == "delete":
            # Words in expected that the student omitted
            for exp in expected_chunk:
                primary_miscues.append(
                    Miscue(expected=exp, actual="", type="Omission")
                )
                aligned_pairs.append(_AlignedPair(exp, ""))

        elif tag == "insert":
            # Words the student said that are not in the passage
            for act in actual_chunk:
                primary_miscues.append(
                    Miscue(expected="", actual=act, type="Insertion")
                )
                aligned_pairs.append(_AlignedPair("", act))

    # ------------------------------------------------------------------
    # Repetition detection (second pass)
    # ------------------------------------------------------------------
    repetitions = _detect_repetitions(aligned_pairs)
    all_miscues = primary_miscues + repetitions

    # ------------------------------------------------------------------
    # Accuracy metric
    # ------------------------------------------------------------------
    # Insertions do not reduce the word count from the passage perspective;
    # only omissions and substitutions are penalised.
    penalised = sum(
        1 for m in all_miscues if m.type in {"Substitution", "Omission", "Repetition"}
    )
    correct_words = max(0, total_words - penalised)
    accuracy = (correct_words / total_words) * 100.0
    reading_level = _determine_reading_level(accuracy)

    logger.info(
        "Analysis complete — total: %d, correct: %d, miscues: %d, accuracy: %.2f%% (%s)",
        total_words,
        correct_words,
        len(all_miscues),
        accuracy,
        reading_level,
    )

    return AssessmentResult(
        transcript=transcript,
        expected_text=expected_text,
        total_words=total_words,
        correct_words=correct_words,
        miscues=all_miscues,
        accuracy=round(accuracy, 2),
        reading_level=reading_level,
    )
