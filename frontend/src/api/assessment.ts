import { apiRequest, uploadForm } from "@/api/client";
import { countWords } from "@/lib/format";
import { getPassage } from "@/data/passages";
import type {
  Assessment,
  AssessmentInput,
  AssessmentRecord,
  AssessmentReview,
  AssessmentResult,
  AssessmentSummary,
  Miscue,
} from "@/types/assessment";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : value == null ? fallback : String(value);
}

function asNumber(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function createAssessmentId() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `assessment-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getSource(payload: unknown) {
  const root = asRecord(payload) ?? {};
  const nestedData = asRecord(root.data);
  const assessment = asRecord(root.assessment) ?? asRecord(nestedData?.assessment);
  const result =
    asRecord(root.result) ??
    asRecord(root.analysis) ??
    asRecord(nestedData?.result) ??
    asRecord(nestedData?.analysis) ??
    nestedData ??
    root;

  return { root, assessment: assessment ?? root, result };
}

function normalizeMiscue(value: unknown): Miscue | undefined {
  const record = asRecord(value);
  if (!record) return undefined;

  const rawType = asString(record.type ?? record.miscue_type, "Miscue");
  const lowerType = rawType.toLowerCase();
  const type =
    lowerType.includes("substitution") ? "Substitution" :
      lowerType.includes("omission") ? "Omission" :
        lowerType.includes("insertion") ? "Insertion" :
          lowerType.includes("repetition") ? "Repetition" : rawType;

  return {
    expected: asString(record.expected ?? record.expected_word),
    actual: asString(record.actual ?? record.actual_word),
    type,
  };
}

function normalizeSummary(payload: unknown, fallbackId?: string): AssessmentSummary {
  const { root, assessment, result } = getSource(payload);
  const generatedId = fallbackId || createAssessmentId();
  const id = asString(assessment.id ?? root.id ?? assessment.assessment_id ?? root.assessment_id, generatedId) || generatedId;
  const miscues = Array.isArray(result.miscues)
    ? result.miscues.map(normalizeMiscue).filter((item): item is Miscue => Boolean(item))
    : [];
  const expectedText = asString(result.expected_text ?? result.original_text);
  const totalWords = asNumber(result.total_words ?? result.word_count, countWords(expectedText));
  const correctWords = asNumber(
    result.correct_words,
    Math.max(0, totalWords - miscues.filter((miscue) => miscue.type !== "Insertion").length),
  );
  const rawAccuracy = result.accuracy ?? result.accuracy_percentage;
  const normalizedAccuracy = rawAccuracy == null
    ? totalWords > 0 ? (correctWords / totalWords) * 100 : 0
    : asNumber(rawAccuracy, 0);
  const accuracy = normalizedAccuracy > 0 && normalizedAccuracy <= 1
    ? normalizedAccuracy * 100
    : normalizedAccuracy;
  const passageId = asString(assessment.passage_id ?? root.passage_id);
  const fallbackPassage = getPassage(passageId);

  const assessmentData: Assessment = {
    id,
    student_name: asString(assessment.student_name ?? root.student_name, "Student"),
    grade: asString(assessment.grade ?? root.grade, "Grade 3"),
    section: asString(assessment.section ?? root.section, ""),
    passage_id: passageId,
    created_at: asString(assessment.created_at ?? root.created_at, new Date().toISOString()),
  };

  const resultData: AssessmentResult = {
    transcript: asString(result.transcript ?? result.transcription ?? result.transcribed_text ?? result.recognized_text),
    expected_text: expectedText || fallbackPassage?.text || "",
    total_words: totalWords,
    correct_words: correctWords,
    miscues,
    accuracy: Math.max(0, Math.min(100, accuracy)),
    reading_level: asString(result.reading_level ?? result.level, "Not provided"),
  };

  return { ...assessmentData, result: resultData };
}

export async function submitAssessment(
  input: AssessmentInput,
  onProgress?: (progress: number) => void,
): Promise<AssessmentRecord> {
  const formData = new FormData();
  const extension = input.audio_file.type.includes("mp4") ? "m4a" : "webm";
  const fileName = input.audio_file instanceof File ? input.audio_file.name : `reading-recording.${extension}`;
  formData.append("audio_file", input.audio_file, fileName);
  formData.append("student_name", input.student_name);
  formData.append("grade", input.grade);
  formData.append("section", input.section);
  formData.append("passage_id", input.passage_id);

  const response = await uploadForm<unknown>("/assess", formData, onProgress);
  const normalized = normalizeSummary(response);

  return {
    ...normalized,
    student_name: input.student_name,
    grade: input.grade,
    section: input.section,
    passage_id: input.passage_id,
    result: {
      ...normalized.result!,
      expected_text: normalized.result?.expected_text || getPassage(input.passage_id)?.text || "",
    },
  };
}

function unwrapList(payload: unknown) {
  if (Array.isArray(payload)) return payload;
  const record = asRecord(payload);
  if (!record) return [];
  const nested = record.assessments ?? record.items ?? record.results ?? record.data;
  return Array.isArray(nested) ? nested : [];
}

export async function listAssessments(): Promise<AssessmentSummary[]> {
  const payload = await apiRequest<unknown>("/assessments");
  return unwrapList(payload).map((item) => normalizeSummary(item));
}

export async function getAssessment(id: string): Promise<AssessmentRecord> {
  const payload = await apiRequest<unknown>(`/assessments/${encodeURIComponent(id)}`);
  return normalizeSummary(payload, id) as AssessmentRecord;
}

export async function saveAssessmentReviewRemote(id: string, review: AssessmentReview) {
  return apiRequest<unknown>(`/assessments/${encodeURIComponent(id)}/review`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(review),
  });
}