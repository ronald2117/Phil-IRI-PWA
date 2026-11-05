import { useEffect, useRef, useState } from "react";
import { AudioLines, Mic, RotateCcw, Square, Upload } from "lucide-react";

interface RecordingPanelProps {
  onRecordingReady: (audio: Blob | null) => void;
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remaining = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remaining}`;
}

export function RecordingPanel({ onRecordingReady }: RecordingPanelProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const audioUrlRef = useRef("");
  const isMountedRef = useRef(false);

  useEffect(() => {
    if (!isRecording) return;
    const timer = window.setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, [isRecording]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.onstop = null;
        recorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, []);

  function clearRecording() {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = "";
    setAudioUrl("");
    setUploadedFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setElapsed(0);
    setError("");
    onRecordingReady(null);
  }

  function handleAudioFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".wav")) {
      setError("Choose a WAV audio file (.wav).");
      event.currentTarget.value = "";
      return;
    }
    if (file.size === 0) {
      setError("The selected WAV file is empty. Choose another file.");
      event.currentTarget.value = "";
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError("The WAV file exceeds the 50 MB limit. Choose a smaller file.");
      event.currentTarget.value = "";
      return;
    }

    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    const nextUrl = URL.createObjectURL(file);
    audioUrlRef.current = nextUrl;
    setAudioUrl(nextUrl);
    setUploadedFileName(file.name);
    setElapsed(0);
    setError("");
    onRecordingReady(file);
    event.currentTarget.value = "";
  }

  async function startRecording() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Audio recording is not available in this browser. Try a current version of Chrome, Safari, or Firefox.");
      return;
    }
    if (!window.isSecureContext) {
      setError("Microphone access requires a secure connection. Open this app using HTTPS or localhost.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (!isMountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      chunksRef.current = [];

      const playback = document.createElement("audio");
      const supportedType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]
        .find((type) => MediaRecorder.isTypeSupported(type) && playback.canPlayType(type) !== "");
      const recorder = supportedType
        ? new MediaRecorder(stream, { mimeType: supportedType })
        : new MediaRecorder(stream);

      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setError("The recording stopped unexpectedly. Please try again.");
        setIsRecording(false);
        stream.getTracks().forEach((track) => track.stop());
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        const audio = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (audio.size === 0) {
          setError("No audio was captured. Check the microphone and record again.");
          setIsRecording(false);
          return;
        }

        const nextUrl = URL.createObjectURL(audio);
        audioUrlRef.current = nextUrl;
        setAudioUrl(nextUrl);
        onRecordingReady(audio);
        setIsRecording(false);
      };

      setElapsed(0);
      recorder.start(1000);
      setIsRecording(true);
    } catch (captureError) {
      const errorName = captureError instanceof DOMException || captureError instanceof Error
        ? captureError.name
        : "";
      const messages: Record<string, string> = {
        NotAllowedError: "Microphone access was blocked. Allow microphone access for this site and check your device's privacy settings, then try again.",
        NotFoundError: "No microphone is available to the browser. Check that it is connected, enabled, and selected as an input device.",
        NotReadableError: "The microphone is unavailable or being used by another app. Close other apps using it and check your device's microphone settings.",
        OverconstrainedError: "The microphone does not support the requested audio settings. Try a different microphone or browser.",
        AbortError: "The browser could not start the microphone. Check your device's microphone settings and try again.",
        SecurityError: "Microphone access was blocked by the browser or device security settings.",
      };
      setError(messages[errorName] ?? "We could not start the microphone. Check browser and device microphone permissions, then try again.");
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  return (
    <section className="recording-panel" aria-labelledby="recording-title">
      <div className="recording-panel-topline">
        <span className="step-number">02</span>
        <span>VOICE SAMPLE</span>
      </div>
      <h2 id="recording-title">Record the reading</h2>
      <p className="recording-intro">Ask the learner to read the selected story aloud at a comfortable pace.</p>

      <div className={`recording-stage${isRecording ? " recording-stage--active" : ""}`}>
        {isRecording ? (
          <>
            <div className="waveform" aria-label="Recording in progress">
              {[12, 24, 17, 32, 21, 40, 25, 35, 15, 29, 19, 38, 23, 31, 14, 26, 18, 34, 21, 28, 13, 33, 20, 25].map((height, index) => (
                <span key={index} style={{ "--bar-height": `${height}px`, "--bar-delay": `${index * 45}ms` } as React.CSSProperties} />
              ))}
            </div>
            <span className="recording-timer"><span className="recording-dot" /> {formatDuration(elapsed)}</span>
            <p className="recording-status">Listening now</p>
          </>
        ) : audioUrl ? (
          <>
            <span className="recording-ready-icon"><AudioLines size={25} aria-hidden="true" /></span>
            <span className="recording-timer">{uploadedFileName ? "WAV file ready" : `${formatDuration(elapsed)} recorded`}</span>
            <p className="recording-status">{uploadedFileName || "Ready to play back"}</p>
          </>
        ) : (
          <>
            <span className="recording-ready-icon"><Mic size={25} aria-hidden="true" /></span>
            <span className="recording-timer">00:00</span>
            <p className="recording-status">Microphone is ready</p>
          </>
        )}
      </div>

      {audioUrl && !isRecording && (
        <div className="playback-block">
          <audio
            controls
            src={audioUrl}
            aria-label="Recorded reading playback"
            onError={(event) => {
              const code = event.currentTarget.error?.code;
              setError(code === MediaError.MEDIA_ERR_DECODE || code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
                ? "This browser cannot play the recorded audio format. Try recording in a different browser."
                : "The recording could not be played. Try recording again.");
            }}
          />
          {uploadedFileName ? (
            <button type="button" className="text-button" onClick={clearRecording}>Remove WAV file</button>
          ) : (
            <button type="button" className="text-button" onClick={() => { clearRecording(); void startRecording(); }}>
              <RotateCcw size={15} aria-hidden="true" /> Record again
            </button>
          )}
        </div>
      )}

      {isRecording ? (
        <button type="button" className="record-button record-button--stop" onClick={stopRecording}>
          <Square size={15} fill="currentColor" aria-hidden="true" /> Stop recording
        </button>
      ) : !audioUrl ? (
        <button type="button" className="record-button" onClick={() => void startRecording()}>
          <Mic size={17} aria-hidden="true" /> Start recording
        </button>
      ) : null}

      {!isRecording && (
        <div className="audio-upload">
          <p className="recording-upload-hint">Or upload a WAV file (up to 50 MB).</p>
          <label className="record-button record-button--upload">
            <Upload size={16} aria-hidden="true" /> Choose WAV file
            <input
              ref={fileInputRef}
              className="audio-upload-input"
              type="file"
              accept=".wav,audio/wav,audio/x-wav"
              aria-label="Choose a WAV audio file"
              onChange={handleAudioFileChange}
            />
          </label>
        </div>
      )}

      {error && <p className="field-error recording-error" role="alert">{error}</p>}
      <p className="recording-hint">Keep the device close and reduce background noise.</p>
    </section>
  );
}