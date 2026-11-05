import { Fragment, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, ClipboardList, Info, LoaderCircle, Save } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { getAssessmentAudioUrl } from "@/api/assessment";
import { LoadingState } from "@/components/LoadingState";
import { getPassage } from "@/data/passages";
import { useAssessment, useSaveAssessmentReview } from "@/hooks/useAssessments";
import { formatAccuracy, formatDate } from "@/lib/format";
import { alignPassage, type PassageAlignment, type PassageWordStatus } from "@/lib/miscue";
import { MISCUE_TYPES } from "@/types/assessment";

const PASSAGE_WORD_PATTERN = /^[\p{L}\p{N}\p{Pc}]+$/u;

function AnnotatedPassage({ text, alignment }: { text: string; alignment: PassageAlignment }) {
  let wordIndex = 0;
  const parts = text.normalize("NFC").split(/([\p{L}\p{N}\p{Pc}]+)/gu);

  function renderInsertion(word: string, status: "insertion" | "repetition", key: string) {
    const label = status === "repetition" ? "Repeated word" : "Inserted word";
    return (
      <span className={`passage-insertion passage-insertion--${status}`} aria-label={`${label}: ${word}`} key={key}>
        ^{word}
      </span>
    );
  }

  return (
    <p className="reading-text annotated-passage" lang="fil">
      {parts.map((part, index) => {
        if (!PASSAGE_WORD_PATTERN.test(part)) return <Fragment key={index}>{part}</Fragment>;

        const currentWordIndex = wordIndex++;
        const status: PassageWordStatus = alignment.wordStatuses[currentWordIndex] ?? "correct";
        const statusLabel = status === "correct" ? "Correct" : status[0].toLocaleUpperCase() + status.slice(1);
        return (
          <Fragment key={index}>
            {alignment.insertions.get(currentWordIndex)?.map(({ word, status }, insertionIndex) =>
              renderInsertion(word, status, `${currentWordIndex}-${insertionIndex}`),
            )}
            <span
              className={`passage-word passage-word--${status}`}
              aria-label={status === "substitution"
                ? `${part}, read as ${alignment.substitutions.get(currentWordIndex) ?? ""}`
                : `${part}, ${statusLabel}`}
              title={status === "substitution"
                ? `Read as: ${alignment.substitutions.get(currentWordIndex) ?? ""}`
                : statusLabel}
            >
              {status === "substitution" && (
                <span className="passage-substitution-actual" aria-hidden="true">
                  {alignment.substitutions.get(currentWordIndex)}
                </span>
              )}
              {part}
            </span>
          </Fragment>
        );
      })}
      {alignment.insertions.get(wordIndex)?.map(({ word, status }, insertionIndex) =>
        renderInsertion(word, status, `end-${insertionIndex}`),
      )}
    </p>
  );
}

function StatValue({ label, value, note, accent = false, help }: { label: string; value: string | number; note?: string; accent?: boolean; help?: string }) {
  return (
    <div className={`stat-value${accent ? " stat-value--accent" : ""}`}>
      <span className="stat-label">
        {label}
        {help && (
          <span className="stat-help">
            <button type="button" className="stat-help-trigger" aria-label={`About ${label.toLocaleLowerCase()}`} aria-describedby="reading-level-help">
              <Info size={14} aria-hidden="true" />
            </button>
            <span className="stat-help-tooltip" id="reading-level-help" role="tooltip">{help}</span>
          </span>
        )}
      </span>
      <strong>{value}</strong>
      {note && <span className="stat-note">{note}</span>}
    </div>
  );
}

export function AssessmentResultPage() {
  const { id = "" } = useParams();
  const { data: assessment, isLoading, error } = useAssessment(id);
  const saveReview = useSaveAssessmentReview();
  const [transcript, setTranscript] = useState("");
  const [notes, setNotes] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [audioUnavailable, setAudioUnavailable] = useState(false);

  useEffect(() => {
    if (!assessment) return;
    setAudioUnavailable(false);
    setTranscript(assessment.review?.transcript ?? assessment.result.transcript);
    setNotes(assessment.review?.notes ?? "");
    setSavedMessage(assessment.review ? `Last saved ${formatDate(assessment.review.updated_at)}` : "");
  }, [assessment?.id, assessment?.review?.updated_at, assessment?.review?.transcript, assessment?.review?.notes, assessment?.result.transcript]);

  const savedTranscript = assessment?.review?.transcript ?? assessment?.result.transcript ?? "";
  const savedNotes = assessment?.review?.notes ?? "";
  const isDirty = transcript !== savedTranscript || notes !== savedNotes;
  const passage = assessment ? getPassage(assessment.passage_id) : undefined;
  const miscuesByType = useMemo(() => {
    const counts = new Map<string, number>();
    for (const miscue of assessment?.result.miscues ?? []) {
      counts.set(miscue.type, (counts.get(miscue.type) ?? 0) + 1);
    }
    return counts;
  }, [assessment?.result.miscues]);
  const passageAlignment = useMemo(() => {
    if (!assessment) return alignPassage("", "");
    const sourceText = assessment.result.expected_text || getPassage(assessment.passage_id)?.text || "Original passage text is not available.";
    return alignPassage(sourceText, assessment.result.transcript);
  }, [assessment?.passage_id, assessment?.result.expected_text, assessment?.result.transcript]);

  if (isLoading && !assessment) return <LoadingState label="Loading reading results" />;

  if (!assessment) {
    return (
      <div className="not-found-state">
        <span className="not-found-icon"><ClipboardList size={23} aria-hidden="true" /></span>
        <p className="eyebrow">ASSESSMENT NOT AVAILABLE</p>
        <h1>We couldn't find this reading.</h1>
        <p>{error instanceof Error ? error.message : "The record may have been removed or is not available on this device."}</p>
        <Link className="button button-primary" to="/assessments"><ArrowLeft size={16} /> Back to history</Link>
      </div>
    );
  }

  const { result } = assessment;
  const expectedText = result.expected_text || passage?.text || "Original passage text is not available.";
  const summaryText = result.miscues.length === 0
    ? "No miscues were recorded."
    : MISCUE_TYPES
        .filter((type) => (miscuesByType.get(type) ?? 0) > 0)
        .map((type) => `${miscuesByType.get(type)} ${type.toLocaleLowerCase()}${miscuesByType.get(type) === 1 ? "" : "s"}`)
        .join(" / ");

  function handleSave() {
    if (!assessment || !isDirty) return;
    setSavedMessage("");
    saveReview.mutate({
      id: assessment.id,
      review: {
        transcript,
        notes: notes.trim(),
        updated_at: new Date().toISOString(),
      },
    }, {
      onSuccess: ({ synced }) => setSavedMessage(
        synced
          ? "Corrections saved and analysis updated."
          : "Corrections saved on this device; server sync is unavailable.",
      ),
    });
  }

  return (
    <div className="page page-result">
      <Link to="/assessments" className="back-link"><ArrowLeft size={16} aria-hidden="true" /> Assessment history</Link>

      <header className="result-heading">
        <div>
          <p className="eyebrow">READING ASSESSMENT / {formatDate(assessment.created_at)}</p>
          <h1>{assessment.student_name}</h1>
          <p className="result-subtitle">{assessment.grade} <span>/</span> {assessment.section || "No section"} <span>/</span> {passage?.title ?? "Reading passage"}</p>
        </div>
        <span className="result-status"><Check size={15} aria-hidden="true" /> Analysis complete</span>
      </header>

      <section className="result-stats" aria-label="Reading summary">
        <StatValue label="Total words" value={result.total_words} />
        <StatValue label="Correct words" value={result.correct_words} />
        <StatValue label="Total miscues" value={result.miscues.length} />
        <StatValue label="Accuracy" value={formatAccuracy(result.accuracy)} accent />
        <StatValue
          label="Reading level"
          value={result.reading_level || "Not provided"}
          help="Accuracy is calculated as correct words ÷ total passage words × 100. Independent: 97% or higher; Instructional: 90% to below 97%; Frustration: below 90%. Omissions, substitutions, and repetitions count against correct words; insertions do not change the passage-word total."
        />
      </section>

      <section className="audio-replay" aria-label="Recording playback">
        <div>
          <p className="eyebrow">ORIGINAL RECORDING</p>
          <h2>Replay the reading</h2>
        </div>
        {audioUnavailable ? (
          <p className="audio-replay-unavailable">The recording is unavailable on the assessment server.</p>
        ) : (
          <audio
            controls
            preload="metadata"
            src={getAssessmentAudioUrl(assessment.id)}
            onError={() => setAudioUnavailable(true)}
          >
            Your browser does not support audio playback.
          </audio>
        )}
      </section>

      <section className="text-comparison" aria-label="Original passage and transcript">
        <article className="reading-text-column">
          <div className="content-section-heading">
            <div>
              <p className="eyebrow">SOURCE TEXT</p>
              <h2>Original passage</h2>
            </div>
            <span className="small-label">{passage?.title ?? "Phil-IRI passage"}</span>
          </div>
          <div className="passage-legend" aria-label="Passage marking legend">
            <span><i className="passage-legend-swatch passage-legend-swatch--correct" aria-hidden="true" />Correct</span>
            <span><i className="passage-legend-swatch passage-legend-swatch--miscue" aria-hidden="true" />Miscue</span>
            <span><i className="passage-legend-swatch passage-legend-swatch--repetition" aria-hidden="true" />Repetition</span>
            <span><b>^word</b> Inserted or repeated word</span>
          </div>
          <AnnotatedPassage text={expectedText} alignment={passageAlignment} />
        </article>

        <article className="reading-text-column transcript-column">
          <div className="content-section-heading">
            <div>
              <p className="eyebrow">TRANSCRIPT USED FOR RESULTS</p>
              <h2>{assessment.review ? "Teacher-corrected transcript" : "Transcript"}</h2>
            </div>
          </div>
          <span id="review-transcript-help" className="review-editor-help">Edit the recognized words, then save to recalculate the miscues.</span>
          <textarea
            id="review-transcript"
            className="text-input review-transcript-editor review-textarea"
            aria-describedby="review-transcript-help"
            aria-label="Teacher-corrected transcript"
            value={transcript}
            onChange={(event) => { setTranscript(event.target.value); setSavedMessage(""); }}
            placeholder="Review or correct the transcript..."
            rows={5}
            maxLength={12000}
            disabled={saveReview.isPending}
          />
        </article>
      </section>

      <section className="miscue-section" aria-labelledby="miscue-title">
        <div className="miscue-heading">
          <div>
            <p className="eyebrow">WORD-BY-WORD REVIEW</p>
            <h2 id="miscue-title">Miscue summary</h2>
            <p>{assessment.review ? "Recalculated from the reviewed transcript. " : ""}{summaryText}</p>
          </div>
          <span className="miscue-total"><strong>{result.miscues.length}</strong><span>total<br />miscues</span></span>
        </div>

        {result.miscues.length > 0 ? (
          <div className="miscue-table-wrap">
            <table className="miscue-table">
              <thead>
                <tr><th scope="col">Expected</th><th scope="col">Actual</th><th scope="col">Type</th></tr>
              </thead>
              <tbody>
                {result.miscues.map((miscue, index) => (
                  <tr key={`${miscue.expected}-${miscue.actual}-${index}`}>
                    <td>{miscue.expected || <span className="muted-word">-</span>}</td>
                    <td>{miscue.actual || <span className="muted-word">-</span>}</td>
                    <td><span className={`miscue-type miscue-type--${miscue.type.toLocaleLowerCase()}`}>{miscue.type}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="no-miscues"><Check size={18} aria-hidden="true" /><span>No miscues were returned for this passage.</span></div>
        )}
      </section>

      <section className="teacher-review" aria-labelledby="teacher-review-title">
        <div className="review-fields">
          <label className="field-label">
            Teacher notes <span className="optional-label">OPTIONAL</span>
            <textarea
              className="text-input review-textarea review-notes"
              value={notes}
              onChange={(event) => { setNotes(event.target.value); setSavedMessage(""); }}
              placeholder="Add a short observation or a next step for this reader..."
              rows={4}
              maxLength={2000}
              disabled={saveReview.isPending}
            />
          </label>
        </div>

        <div className="review-footer">
          <div className="review-feedback" aria-live="polite">
            {saveReview.isPending ? <><LoaderCircle size={15} className="spin" /> Recalculating and saving...</> : savedMessage && <><Check size={15} /> {savedMessage}</>}
            {saveReview.isError && <span className="field-error">{saveReview.error.message}</span>}
          </div>
          <button type="button" className="button button-primary" onClick={handleSave} disabled={!isDirty || saveReview.isPending}>
            {saveReview.isPending ? <LoaderCircle size={16} className="spin" /> : <Save size={16} aria-hidden="true" />}
            Save and recalculate
          </button>
        </div>
      </section>
    </div>
  );
}