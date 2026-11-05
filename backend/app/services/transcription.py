"""
Whisper transcription service using faster-whisper.

The model is loaded lazily on the first call and kept in memory for the
lifetime of the process — typical for a single-node deployment.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# Lazily initialised model singleton
_model = None
_MODEL_SIZE = "small"
_LANGUAGE = "tl"  # Filipino / Tagalog


def _get_model():
    """Return the cached WhisperModel, initialising it on first use."""
    global _model
    if _model is None:
        # Import deferred so the application starts even if faster-whisper
        # is not installed (useful during unit testing or CI).
        try:
            from faster_whisper import WhisperModel  # type: ignore

            logger.info("Loading Whisper model '%s' …", _MODEL_SIZE)
            _model = WhisperModel(
                _MODEL_SIZE,
                device="cpu",
                compute_type="int8",  # fastest on CPU; change to "float16" for GPU
            )
            logger.info("Whisper model loaded successfully.")
        except ImportError as exc:
            raise RuntimeError(
                "faster-whisper is not installed. "
                "Run: pip install faster-whisper"
            ) from exc
    return _model


def transcribe(audio_path: Path) -> str:
    """
    Transcribe the audio file at *audio_path* and return the full text.

    Parameters
    ----------
    audio_path:
        Absolute path to the audio file (WAV recommended; faster-whisper
        accepts any format ffmpeg can decode).

    Returns
    -------
    str
        The transcribed text with leading/trailing whitespace stripped.

    Raises
    ------
    RuntimeError
        If faster-whisper is not installed or transcription fails.
    FileNotFoundError
        If the audio file does not exist.
    """
    if not audio_path.exists():
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    model = _get_model()
    logger.info("Transcribing '%s' …", audio_path.name)

    segments, info = model.transcribe(
        str(audio_path),
        language=_LANGUAGE,
        beam_size=5,
        best_of=5,
        vad_filter=True,          # skip silent segments
        vad_parameters={"min_silence_duration_ms": 500},
    )

    logger.info(
        "Detected language '%s' (probability %.2f)",
        info.language,
        info.language_probability,
    )

    text = " ".join(segment.text.strip() for segment in segments)
    result = text.strip()
    logger.info("Transcript (%d chars): %s", len(result), result[:120])
    return result
