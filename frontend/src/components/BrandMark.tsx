export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand-lockup${compact ? " brand-lockup--compact" : ""}`}>
      <span className="brand-symbol" aria-hidden="true">
        <svg viewBox="0 0 40 40" fill="none">
          <path d="M6 11.5c5.3-2.1 10.1-1.3 14 2.1v18c-3.9-3.4-8.7-4.2-14-2.1v-18Z" fill="currentColor" opacity=".94" />
          <path d="M34 11.5c-5.3-2.1-10.1-1.3-14 2.1v18c3.9-3.4 8.7-4.2 14-2.1v-18Z" fill="currentColor" opacity=".7" />
          <path d="M20 13.6v18" stroke="#1B3C30" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M10 17.5c2 .1 3.7.6 5.1 1.5M10 22c2 .1 3.7.6 5.1 1.5m14.9-6c-2 .1-3.7.6-5.1 1.5m5.1 3c-2 .1-3.7.6-5.1 1.5" stroke="#1B3C30" strokeWidth="1.2" strokeLinecap="round" opacity=".7" />
          <circle cx="31.5" cy="8.5" r="3.5" fill="#DCEB8B" />
        </svg>
      </span>
      <span className="brand-copy">
        <span className="brand-name">BasaBantay</span>
        {!compact && <span className="brand-caption">Phil-IRI reading lab</span>}
      </span>
    </div>
  );
}