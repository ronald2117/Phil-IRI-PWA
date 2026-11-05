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

4. Classify only surplus words in consecutive duplicate runs as **Repetitions**.

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

from app.models.assessment import AssessmentResult, Miscue
from app.utils.text import tokenize

logger = logging.getLogger(__name__)


def _determine_reading_level(accuracy: float) -> str:
    if accuracy >= 97.0:
        return "Independent"
    if accuracy >= 90.0:
        return "Instructional"
    return "Frustration"


def _find_repeated_actual_indices(
    actual_tokens: list[str],
    matched_actual_indices: set[int],
) -> set[int]:
    repeated_indices: set[int] = set()
    start = 0

    while start < len(actual_tokens):
        end = start + 1
        while end < len(actual_tokens) and actual_tokens[end] == actual_tokens[start]:
            end += 1

        if end - start > 1:
            run_indices = range(start, end)
            matched_in_run = sum(index in matched_actual_indices for index in run_indices)
            surplus_indices = [index for index in run_indices if index not in matched_actual_indices]
            repeated_indices.update(surplus_indices if matched_in_run else surplus_indices[1:])

        start = end

    return repeated_indices


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

    opcodes = matcher.get_opcodes()
    matched_actual_indices = {
        actual_index
        for tag, _, _, j1, j2 in opcodes
        if tag == "equal"
        for actual_index in range(j1, j2)
    }
    repeated_actual_indices = _find_repeated_actual_indices(actual_tokens, matched_actual_indices)
    primary_miscues: list[Miscue] = []

    def append_pair(
        expected_word: str,
        actual_word: str,
        actual_index: int | None = None,
        miscue_type: str | None = None,
    ) -> None:
        if actual_index is not None and actual_index in repeated_actual_indices:
            miscue_type = "Repetition"
        if miscue_type:
            primary_miscues.append(
                Miscue(
                    expected=(expected_word or actual_word) if miscue_type == "Repetition" else expected_word,
                    actual=actual_word,
                    type=miscue_type,
                )
            )

    for tag, i1, i2, j1, j2 in opcodes:
        expected_chunk = expected_tokens[i1:i2]
        actual_chunk = actual_tokens[j1:j2]

        if tag == "equal":
            for offset, (exp, act) in enumerate(zip(expected_chunk, actual_chunk)):
                append_pair(exp, act, j1 + offset)

        elif tag == "replace":
            # Pair up as many words as possible; remainder are omissions / insertions
            for offset, (exp, act) in enumerate(zip(expected_chunk, actual_chunk)):
                append_pair(exp, act, j1 + offset, "Substitution")

            # Extra expected words with no actual counterpart → omissions
            for exp in expected_chunk[len(actual_chunk):]:
                append_pair(exp, "", miscue_type="Omission")

            # Extra actual words with no expected counterpart → insertions
            for offset, act in enumerate(actual_chunk[len(expected_chunk):], start=len(expected_chunk)):
                append_pair("", act, j1 + offset, "Insertion")

        elif tag == "delete":
            # Words in expected that the student omitted
            for exp in expected_chunk:
                append_pair(exp, "", miscue_type="Omission")

        elif tag == "insert":
            # Words the student said that are not in the passage
            for offset, act in enumerate(actual_chunk):
                append_pair("", act, j1 + offset, "Insertion")

    # ------------------------------------------------------------------
    # Accuracy metric
    # ------------------------------------------------------------------
    # Insertions do not reduce the word count from the passage perspective;
    # only omissions and substitutions are penalised.
    penalised = sum(
        1 for m in primary_miscues if m.type in {"Substitution", "Omission", "Repetition"}
    )
    correct_words = max(0, total_words - penalised)
    accuracy = (correct_words / total_words) * 100.0
    reading_level = _determine_reading_level(accuracy)

    logger.info(
        "Analysis complete — total: %d, correct: %d, miscues: %d, accuracy: %.2f%% (%s)",
        total_words,
        correct_words,
        len(primary_miscues),
        accuracy,
        reading_level,
    )

    return AssessmentResult(
        transcript=transcript,
        expected_text=expected_text,
        total_words=total_words,
        correct_words=correct_words,
        miscues=primary_miscues,
        accuracy=round(accuracy, 2),
        reading_level=reading_level,
    )
