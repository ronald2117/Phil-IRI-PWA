# BasaBantay

Teacher-facing Phil-IRI oral reading assessment workspace built with React, TypeScript, Vite, React Router, TanStack Query, and Tailwind CSS v4.

## Run locally

```sh
npm install
npm run dev
```

The API defaults to `http://localhost:8000`. Copy `.env.example` to `.env.local` and set `VITE_API_BASE_URL` when the FastAPI service runs elsewhere.

## Assessment API

- `POST /assess` accepts `multipart/form-data` fields `audio_file`, `student_name`, `grade`, `section`, and `passage_id`.
- `GET /assessments` and `GET /assessments/{id}` are used when available. If the list or detail routes are not implemented, assessments created in this browser remain available from local storage.
- `PATCH /assessments/{id}/review` is sent as a best-effort sync for teacher edits. Review corrections are saved on this device first, so they remain available if the optional route is unavailable.

The assessment service should return the transcript, expected passage text, word counts, miscues, accuracy, and reading level. Result parsing also accepts common `result`, `analysis`, or `data` response wrappers.

## Installable app

The production build includes a web manifest, 192 px and 512 px icons, and a service worker that caches the app shell for offline launch. The browser must be served from HTTPS (or localhost) for installation and microphone access.