# Phil-IRI Backend — Oral Reading Assessment API

Production-ready **FastAPI** backend for the Phil-IRI Oral Reading Miscue Detector.  
Records a student reading a Filipino passage, transcribes with **Faster-Whisper**, and returns a full miscue analysis.

---

## Folder structure

```
backend/
├── app/
│   ├── main.py                  # FastAPI factory + CORS + logging
│   ├── api/
│   │   ├── assessment.py        # Assessment submission, playback, and review routes
│   │   └── utils.py             # GET /health, GET /passages
│   ├── models/
│   │   ├── assessment.py        # Pydantic domain models
│   │   └── schemas.py           # Request / response schemas
│   ├── services/
│   │   ├── assessment.py        # Orchestration pipeline
│   │   ├── transcription.py     # Faster-Whisper integration
│   │   ├── miscue.py            # Word-level miscue detection
│   │   └── storage.py           # In-memory + JSON persistence
│   └── utils/
│       ├── text.py              # Normalisation & tokenisation
│       └── passages.py          # Passage file loader
├── passages/                    # .txt passage files
│   ├── si-alitaptap.txt
│   └── ang-pagong-at-kuneho.txt
├── uploads/                     # Saved audio recordings (auto-created)
├── outputs/                     # assessments.json persistence (auto-created)
├── run.py                       # Quick start script
└── requirements.txt
```

---

## Quick start

### 1. Install dependencies

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

PyAV is constrained to versions below 19 because Faster-Whisper passes an
`av.open` option that PyAV 19 no longer supports.

### 2. Run the server

```bash
python run.py
# or
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at **http://localhost:8000** and, for other devices on the same network, at **http://<server-ip>:8000**. Allow inbound connections to port 8000 in the server's firewall.

- Interactive docs: http://localhost:8000/docs  
- ReDoc:           http://localhost:8000/redoc

---

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/passages` | List available passages |
| `POST` | `/assess` | Submit recording for assessment |
| `GET` | `/assessments` | List all assessments |
| `GET` | `/assessments/{id}` | Get a single assessment |
| `GET` | `/assessments/{id}/audio` | Replay the saved recording |
| `PATCH` | `/assessments/{id}/review` | Save corrections and recalculate miscues |

The review endpoint reruns the word-level analysis against the corrected transcript
and persists the updated score, miscues, reading level, and teacher notes.

### POST /assess — form fields

| Field | Type | Description |
|-------|------|-------------|
| `audio_file` | File | WAV / WebM / M4A recording |
| `student_name` | string | Full name of the student |
| `grade` | string | e.g. `Grade 3` |
| `section` | string | e.g. `Sampaguita` |
| `passage_id` | string | Must match a filename in `passages/` (e.g. `si-alitaptap`) |

### Example response

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "student_name": "Juan Dela Cruz",
  "grade": "Grade 3",
  "section": "Sampaguita",
  "passage_id": "si-alitaptap",
  "created_at": "2024-01-01T08:00:00",
  "transcript": "isang gabi nakita ni lila ang isang alitaptap...",
  "expected_text": "Isang gabi, nakita ni Lila ang isang alitaptap...",
  "total_words": 47,
  "correct_words": 44,
  "miscues": [
    { "expected": "halamanan", "actual": "hardin", "type": "Substitution" },
    { "expected": "nagliliparan", "actual": "", "type": "Omission" }
  ],
  "accuracy": 93.62,
  "reading_level": "Instructional"
}
```

---

## Adding passages

Create a `.txt` file inside `passages/` with optional metadata headers:

```
# title: Ang Aking Pamilya
# description: Maikling kwento tungkol sa pamilya.

Mahal ko ang aking pamilya...
```

The filename (without `.txt`) becomes the `passage_id`.  
Restart the server after adding new passages.

---

## Notes

- **Offline**: Faster-Whisper runs entirely on CPU with the `small` model (no internet required after initial model download).
- **Persistence**: Assessments are stored in `outputs/assessments.json` and survive server restarts.
- **CORS**: All origins are allowed by default (suitable for local dev). Restrict in production.
- **Model**: The first `/assess` request will download the Whisper `small` model (~250 MB) if not cached.
