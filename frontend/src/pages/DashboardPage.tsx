import { ArrowRight, BookOpen, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { AssessmentRow } from "@/components/AssessmentRow";
import { LoadingState } from "@/components/LoadingState";
import { useAssessments } from "@/hooks/useAssessments";

function ReadingIllustration() {
  return (
    <div className="hero-illustration" aria-hidden="true">
      <svg viewBox="0 0 480 340" fill="none">
        <circle cx="293" cy="167" r="144" fill="#DCEB8B" />
        <circle cx="293" cy="167" r="116" stroke="#B7CF6B" strokeWidth="1.5" strokeDasharray="2 8" />
        <path d="M74 258c31-20 63-30 96-30s59 8 84 25v-119c-27-18-55-27-86-27-33 0-64 9-94 27v124Z" fill="#F9F5E8" />
        <path d="M254 253c27-17 57-25 90-25s64 10 96 30V134c-30-18-61-27-94-27-34 0-64 9-92 27v119Z" fill="#FFFDF4" />
        <path d="M254 134c-27-18-55-27-86-27-33 0-64 9-94 27M254 134c28-18 58-27 92-27 33 0 64 9 94 27" stroke="#4B7058" strokeWidth="4" strokeLinecap="round" />
        <path d="M254 134v119" stroke="#4B7058" strokeWidth="4" strokeLinecap="round" />
        <path d="M103 153c20-8 41-12 63-12m-63 30c20-8 41-12 63-12m-63 30c20-8 41-12 63-12m129-24c20-8 42-12 65-12m-65 30c20-8 42-12 65-12m-65 30c20-8 42-12 65-12" stroke="#9CB39A" strokeWidth="4" strokeLinecap="round" />
        <path d="M353 54v15m0 21v15m-28-25h-15m86 0h-15m-48-20-10-10m60 60-10-10m0-40 10-10m-60 60 10-10" stroke="#F2AE72" strokeWidth="4" strokeLinecap="round" />
        <path d="M363 153c0-10 8-18 18-18s18 8 18 18v25c0 10-8 18-18 18s-18-8-18-18v-25Z" fill="#E78462" />
        <path d="M352 172v7c0 16 13 29 29 29s29-13 29-29v-7m-29 36v18m-14 0h28" stroke="#E78462" strokeWidth="5" strokeLinecap="round" />
        <path d="M86 88c-7-13-4-27 10-34 4 17 1 28-10 34Zm1 0c-14-5-21-17-17-31 14 10 20 20 17 31Z" fill="#BBD276" />
        <path d="M105 87c3-13 13-21 28-19-7 15-16 22-28 19Z" fill="#E7A16D" />
      </svg>
    </div>
  );
}

export function DashboardPage() {
  const { data: assessments = [], isFetching } = useAssessments();
  const recent = assessments.slice(0, 4);

  return (
    <div className="page page-dashboard">
      <section className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <div className="hero-kicker"><span /> GRADE 3 FILIPINO READING</div>
          <h1>Phil-IRI Oral Reading <span>Miscue Detector</span></h1>
          <p>Listen closely to each reader. Turn every word into a clearer next step for teaching.</p>
          <Link to="/new-assessment" className="button button-lime hero-cta">
            <Plus size={18} aria-hidden="true" /> Start an assessment <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <ReadingIllustration />
      </section>

      <section className="recent-section" aria-labelledby="recent-title">
        <div className="recent-heading">
          <div>
            <p className="eyebrow">YOUR CLASSROOM LOG</p>
            <h2 id="recent-title">Recent assessments</h2>
          </div>
          <div className="total-assessments" aria-label={`${assessments.length} total assessments`}>
            <span className="total-number">{assessments.length}</span>
            <span className="total-label">Total<br />assessments</span>
          </div>
        </div>

        {isFetching && assessments.length === 0 ? (
          <LoadingState label="Checking your assessment log" />
        ) : recent.length > 0 ? (
          <>
            <div className="assessment-list" aria-label="Recent assessments">
              {recent.map((assessment) => <AssessmentRow key={assessment.id} assessment={assessment} />)}
            </div>
            <Link to="/assessments" className="view-history-link">
              View assessment history <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </>
        ) : (
          <div className="empty-log">
            <span className="empty-log-icon"><BookOpen size={20} aria-hidden="true" /></span>
            <div>
              <h3>Your reading log starts here.</h3>
              <p>Complete an oral reading assessment and the learner's results will appear here.</p>
            </div>
            <Link to="/new-assessment" className="text-button empty-log-link">Create first assessment <ArrowRight size={15} aria-hidden="true" /></Link>
          </div>
        )}
      </section>

      <footer className="page-footnote">
        <span className="footnote-line" />
        <span>Made for the small moments that build confident readers.</span>
      </footer>
    </div>
  );
}