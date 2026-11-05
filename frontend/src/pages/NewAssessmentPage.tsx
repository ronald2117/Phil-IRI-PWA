import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, FileAudio, LoaderCircle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { RecordingPanel } from "@/components/RecordingPanel";
import { PASSAGES, getPassage } from "@/data/passages";
import { useCreateAssessment } from "@/hooks/useAssessments";

const GRADES = ["Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6"];

export function NewAssessmentPage() {
  const navigate = useNavigate();
  const createAssessment = useCreateAssessment();
  const [step, setStep] = useState<"details" | "recording">("details");
  const [studentName, setStudentName] = useState("");
  const [grade, setGrade] = useState("Grade 3");
  const [section, setSection] = useState("");
  const [passageId, setPassageId] = useState(PASSAGES[0].id);
  const [audio, setAudio] = useState<Blob | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [formError, setFormError] = useState("");
  const passage = getPassage(passageId);

  function handleContinue(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    if (!studentName.trim() || !section.trim()) {
      setFormError("Enter the student's name and section before continuing.");
      return;
    }
    setStep("recording");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    if (!audio) {
      setFormError("Record or upload a reading sample before submitting the assessment.");
      return;
    }

    setUploadProgress(0);
    createAssessment.mutate({
      input: {
        student_name: studentName.trim(),
        grade,
        section: section.trim(),
        passage_id: passageId,
        audio_file: audio,
      },
      onProgress: setUploadProgress,
    }, {
      onSuccess: (record) => navigate(`/assessments/${encodeURIComponent(record.id)}`),
    });
  }

  return (
    <div className="page page-new-assessment">
      <Link to="/" className="back-link"><ArrowLeft size={16} aria-hidden="true" /> Dashboard</Link>
      <header className="page-heading page-heading--form">
        <p className="eyebrow">{step === "details" ? "STEP 01 / LEARNER DETAILS" : "STEP 02 / VOICE SAMPLE"}</p>
        <h1>{step === "details" ? "Who’s reading today?" : "Ready to read?"}</h1>
        <p>{step === "details"
          ? "Enter the learner's details and choose a passage."
          : "Read the selected passage aloud, then submit the recording for assessment."}</p>
      </header>

      {step === "details" ? (
        <form className="assessment-form assessment-form--details" onSubmit={handleContinue}>
          <section className="form-section" aria-labelledby="student-details-title">
            <div className="form-section-heading">
              <span className="step-number step-number--light">01</span>
              <div>
                <p className="eyebrow">LEARNER DETAILS</p>
                <h2 id="student-details-title">Who is reading today?</h2>
              </div>
            </div>

            <div className="fields-grid">
              <label className="field-label field-label--wide">
                Student name <span aria-hidden="true">*</span>
                <input
                  className="text-input"
                  type="text"
                  value={studentName}
                  onChange={(event) => setStudentName(event.target.value)}
                  placeholder="Enter learner's full name"
                  autoComplete="name"
                  required
                  maxLength={100}
                />
              </label>
              <label className="field-label">
                Grade <span aria-hidden="true">*</span>
                <select className="text-input" value={grade} onChange={(event) => setGrade(event.target.value)} required>
                  {GRADES.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="field-label">
                Section <span aria-hidden="true">*</span>
                <input
                  className="text-input"
                  type="text"
                  value={section}
                  onChange={(event) => setSection(event.target.value)}
                  placeholder="e.g. Sampaguita"
                  required
                  maxLength={80}
                />
              </label>
              <label className="field-label field-label--wide">
                Passage selection <span aria-hidden="true">*</span>
                <select className="text-input" value={passageId} onChange={(event) => setPassageId(event.target.value)} required>
                  {PASSAGES.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                </select>
              </label>
            </div>
          </section>

          {passage && (
            <section className="passage-preview" aria-labelledby="passage-preview-title">
              <div className="passage-preview-heading">
                <div>
                  <p className="eyebrow">SELECTED PASSAGE</p>
                  <h2 id="passage-preview-title">{passage.title}</h2>
                </div>
                <span className="passage-language">FILIPINO</span>
              </div>
              <p className="passage-description">{passage.description}</p>
              <p className="passage-text" lang="fil">{passage.text}</p>
              <span className="passage-word-count">{passage.text.trim().split(/\s+/).length} words</span>
            </section>
          )}

          {formError && <div className="form-alert" role="alert"><span className="form-alert-mark">!</span><p>{formError}</p></div>}
          <div className="step-actions">
            <button className="button button-primary" type="submit">Continue to recording <ArrowRight size={16} aria-hidden="true" /></button>
          </div>
        </form>
      ) : (
        <form className="assessment-recording-form" onSubmit={handleSubmit}>
          {passage && (
            <section className="recording-passage" aria-labelledby="recording-passage-title">
              <div className="passage-preview-heading">
                <div>
                  <p className="eyebrow">READ THIS PASSAGE ALOUD</p>
                  <h2 id="recording-passage-title">{passage.title}</h2>
                </div>
                <span className="passage-language">FILIPINO / {passage.text.trim().split(/\s+/).length} WORDS</span>
              </div>
              <p className="passage-description">{passage.description}</p>
              <p className="passage-text" lang="fil">{passage.text}</p>
            </section>
          )}

          <RecordingPanel onRecordingReady={setAudio} />

          {(formError || createAssessment.isError) && (
            <div className="form-alert" role="alert">
              <span className="form-alert-mark">!</span>
              <p>{formError || createAssessment.error?.message || "The assessment could not be submitted."}</p>
            </div>
          )}

          {createAssessment.isPending && (
            <div className="upload-state" aria-live="polite">
              <div className="upload-state-heading">
                <span>{uploadProgress >= 100 ? "Audio received / analyzing reading" : "Uploading audio"}</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="upload-track" role="progressbar" aria-label="Audio upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={uploadProgress}>
                <span style={{ width: `${uploadProgress}%` }} />
              </div>
              {uploadProgress >= 100 && <span className="upload-processing"><LoaderCircle size={14} className="spin" /> Processing the reading with the assessment service</span>}
            </div>
          )}

          <div className="recording-form-actions">
            <button
              className="button button-secondary"
              type="button"
              onClick={() => { setFormError(""); setStep("details"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              disabled={createAssessment.isPending}
            >
              <ArrowLeft size={16} aria-hidden="true" /> Back to learner details
            </button>
            <div className="recording-submit">
              <div className="submit-note"><FileAudio size={17} aria-hidden="true" /><span>Audio is sent to the configured assessment service for analysis.</span></div>
              <button className="button button-primary submit-button" type="submit" disabled={createAssessment.isPending}>
                {createAssessment.isPending ? <><LoaderCircle size={17} className="spin" /> Submitting</> : <><Check size={17} aria-hidden="true" /> Submit assessment <ArrowRight size={16} aria-hidden="true" /></>}
              </button>
            </div>
          </div>
        </form>
      )}
      <p className="assessment-footnote">For the clearest results, record in a quiet space and let the learner read independently.</p>
    </div>
  );
}
