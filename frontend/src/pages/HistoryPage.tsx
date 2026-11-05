import { useMemo, useState } from "react";
import { CalendarDays, Search, SlidersHorizontal, X } from "lucide-react";
import { AssessmentRow } from "@/components/AssessmentRow";
import { LoadingState } from "@/components/LoadingState";
import { useAssessments } from "@/hooks/useAssessments";
import { toDateInputValue } from "@/lib/format";

export function HistoryPage() {
  const { data: assessments = [], isFetching } = useAssessments();
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const normalizedSearch = search.trim().toLocaleLowerCase();

  const filteredAssessments = useMemo(() => assessments.filter((assessment) => {
    const matchesText = !normalizedSearch ||
      assessment.student_name.toLocaleLowerCase().includes(normalizedSearch) ||
      assessment.section.toLocaleLowerCase().includes(normalizedSearch);
    const matchesDate = !date || toDateInputValue(assessment.created_at) === date;
    return matchesText && matchesDate;
  }), [assessments, date, normalizedSearch]);

  function clearFilters() {
    setSearch("");
    setDate("");
  }

  const hasFilters = Boolean(search || date);

  return (
    <div className="page page-history">
      <header className="page-heading">
        <p className="eyebrow">KEEP TRACK OF EVERY READER</p>
        <h1>Assessment history</h1>
        <p>Find a learner's previous reading and review the results together.</p>
      </header>

      <section className="history-tools" aria-label="Search assessments">
        <label className="search-field">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Search student or section</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search student or section"
          />
          {search && <button type="button" className="clear-search" onClick={() => setSearch("")} aria-label="Clear search"><X size={16} /></button>}
        </label>
        <label className="date-field">
          <CalendarDays size={17} aria-hidden="true" />
          <span className="sr-only">Filter by date</span>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} aria-label="Filter by date" />
        </label>
        {hasFilters && <button type="button" className="filter-reset" onClick={clearFilters}><X size={15} aria-hidden="true" /> Clear</button>}
        {!hasFilters && <span className="filter-caption"><SlidersHorizontal size={15} aria-hidden="true" /> Filter by name, section, or date</span>}
      </section>

      <section className="history-results" aria-labelledby="history-list-title">
        <div className="history-list-heading">
          <h2 id="history-list-title">All assessments</h2>
          <span>{filteredAssessments.length} {filteredAssessments.length === 1 ? "record" : "records"}</span>
        </div>
        {isFetching && assessments.length === 0 ? (
          <LoadingState label="Loading assessment history" />
        ) : filteredAssessments.length > 0 ? (
          <div className="assessment-list" aria-label="Assessment history">
            {filteredAssessments.map((assessment) => <AssessmentRow key={assessment.id} assessment={assessment} />)}
          </div>
        ) : (
          <div className="history-empty">
            <span className="history-empty-icon"><Search size={21} aria-hidden="true" /></span>
            <h3>{hasFilters ? "No matching assessments" : "No assessments yet"}</h3>
            <p>{hasFilters ? "Try another student name, section, or date." : "Completed reading assessments will be saved here."}</p>
            {hasFilters && <button type="button" className="text-button" onClick={clearFilters}>Clear filters</button>}
          </div>
        )}
      </section>
    </div>
  );
}