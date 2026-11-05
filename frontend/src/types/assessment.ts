export const MISCUE_TYPES = [
  "Substitution",
  "Omission",
  "Insertion",
  "Repetition",
] as const;

export type KnownMiscueType = (typeof MISCUE_TYPES)[number];

export interface Miscue {
  expected: string;
  actual: string;
  type: KnownMiscueType | string;
}

export interface Assessment {
  id: string;
  student_name: string;
  grade: string;
  section: string;
  passage_id: string;
  created_at: string;
}

export interface AssessmentResult {
  transcript: string;
  expected_text: string;
  total_words: number;
  correct_words: number;
  miscues: Miscue[];
  accuracy: number;
  reading_level: string;
}

export interface AssessmentReview {
  transcript: string;
  notes: string;
  updated_at: string;
}

export interface AssessmentSummary extends Assessment {
  result?: AssessmentResult;
  review?: AssessmentReview;
}

export interface AssessmentRecord extends Assessment {
  result: AssessmentResult;
  review?: AssessmentReview;
}

export interface AssessmentInput {
  student_name: string;
  grade: string;
  section: string;
  passage_id: string;
  audio_file: Blob;
}