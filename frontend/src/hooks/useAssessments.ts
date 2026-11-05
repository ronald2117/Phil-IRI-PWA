import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAssessment,
  listAssessments,
  saveAssessmentReviewRemote,
  submitAssessment,
} from "@/api/assessment";
import { readAssessment, readAssessments, saveAssessment } from "@/lib/assessment-store";
import type {
  AssessmentInput,
  AssessmentRecord,
  AssessmentReview,
  AssessmentSummary,
} from "@/types/assessment";

export const ASSESSMENTS_QUERY_KEY = ["assessments"] as const;
export const assessmentQueryKey = (id: string) => ["assessment", id] as const;

function sortByCreatedAt(records: AssessmentSummary[]) {
  return records.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function useAssessments() {
  return useQuery({
    queryKey: ASSESSMENTS_QUERY_KEY,
    queryFn: async (): Promise<AssessmentSummary[]> => {
      const cached = readAssessments();
      try {
        const remote = await listAssessments();
        const merged = new Map<string, AssessmentSummary>(cached.map((item) => [item.id, item]));

        for (const item of remote) {
          const previous = merged.get(item.id);
          merged.set(item.id, {
            ...previous,
            ...item,
            result: item.result ?? previous?.result,
            review: previous?.review,
          });
        }

        return sortByCreatedAt([...merged.values()]);
      } catch {
        return cached;
      }
    },
    initialData: () => readAssessments(),
    staleTime: 30_000,
  });
}

export function useAssessment(id: string) {
  return useQuery({
    queryKey: assessmentQueryKey(id),
    enabled: Boolean(id),
    queryFn: async (): Promise<AssessmentRecord> => {
      const cached = readAssessment(id);
      try {
        const remote = await getAssessment(id);
        const record: AssessmentRecord = cached
          ? {
              ...cached,
              ...remote,
              result: { ...remote.result, ...cached.result },
              review: cached.review,
            }
          : remote;
        saveAssessment(record);
        return record;
      } catch (error) {
        if (cached) return cached;
        throw error;
      }
    },
    initialData: () => readAssessment(id),
    staleTime: 30_000,
  });
}

interface CreateAssessmentVariables {
  input: AssessmentInput;
  onProgress?: (progress: number) => void;
}

export function useCreateAssessment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ input, onProgress }: CreateAssessmentVariables) => submitAssessment(input, onProgress),
    onSuccess: (record) => {
      saveAssessment(record);
      queryClient.setQueryData(assessmentQueryKey(record.id), record);
      void queryClient.invalidateQueries({ queryKey: ASSESSMENTS_QUERY_KEY });
    },
  });
}

interface SaveReviewVariables {
  id: string;
  review: AssessmentReview;
}

export function useSaveAssessmentReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, review }: SaveReviewVariables) => {
      const existing = readAssessment(id) ?? queryClient.getQueryData<AssessmentRecord>(assessmentQueryKey(id));
      if (!existing) throw new Error("This assessment could not be found on this device.");

      const updated = { ...existing, review };
      saveAssessment(updated);
      void saveAssessmentReviewRemote(id, review).catch(() => undefined);
      return updated;
    },
    onSuccess: (record) => {
      queryClient.setQueryData(assessmentQueryKey(record.id), record);
      void queryClient.invalidateQueries({ queryKey: ASSESSMENTS_QUERY_KEY });
    },
  });
}