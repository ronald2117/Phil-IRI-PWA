import type { AssessmentRecord } from "@/types/assessment";

const STORAGE_KEY = "basabantay.assessments.v1";
let memoryRecords: AssessmentRecord[] = [];

function readStoredRecords(): AssessmentRecord[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return memoryRecords;

    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return memoryRecords;

    memoryRecords = parsed.filter(
      (record): record is AssessmentRecord =>
        typeof record === "object" &&
        record !== null &&
        "id" in record &&
        "result" in record,
    );
    return memoryRecords;
  } catch {
    return memoryRecords;
  }
}

export function readAssessments() {
  return readStoredRecords().sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export function readAssessment(id: string) {
  return readStoredRecords().find((record) => record.id === id);
}

export function saveAssessment(record: AssessmentRecord) {
  const records = readStoredRecords();
  const existingIndex = records.findIndex((item) => item.id === record.id);

  if (existingIndex >= 0) {
    records[existingIndex] = record;
  } else {
    records.unshift(record);
  }

  memoryRecords = records;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // A private browsing session may disable persistent storage.
  }

  return record;
}