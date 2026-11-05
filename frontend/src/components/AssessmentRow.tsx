import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { getPassage } from "@/data/passages";
import { formatAccuracy, formatDate, getInitials } from "@/lib/format";
import type { AssessmentSummary } from "@/types/assessment";

export function AssessmentRow({ assessment }: { assessment: AssessmentSummary }) {
  const passage = getPassage(assessment.passage_id);

  return (
    <Link className="assessment-row" to={`/assessments/${encodeURIComponent(assessment.id)}`}>
      <span className="student-avatar" aria-hidden="true">{getInitials(assessment.student_name) || "S"}</span>
      <span className="assessment-row-main">
        <span className="assessment-row-name">{assessment.student_name}</span>
        <span className="assessment-row-meta">
          {assessment.grade} <span aria-hidden="true">/</span> {assessment.section || "No section"} <span aria-hidden="true">/</span> {passage?.title ?? "Reading passage"}
        </span>
      </span>
      <span className="assessment-row-date">{formatDate(assessment.created_at)}</span>
      <span className="assessment-row-score">
        {assessment.result ? formatAccuracy(assessment.result.accuracy) : "View"}
        <ArrowUpRight size={16} aria-hidden="true" />
      </span>
    </Link>
  );
}