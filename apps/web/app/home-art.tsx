// Hand-drawn, deterministic artwork for the home page; colours come from the Workbench tokens.

/** A magnifying glass inside viewfinder brackets: the "show us the object" moment. */
export function ScanArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 300" className={className} aria-hidden="true" focusable="false">
      <g className="art-object">
        <circle cx="185" cy="135" r="52" className="art-lens-glass" />
        <path d="M160 108a36 36 0 0 1 30-14" className="art-glint" />
        <circle cx="185" cy="135" r="52" className="art-ink-stroke" strokeWidth="11" />
        <path d="M224 174 L272 222" className="art-ink-stroke" strokeWidth="20" />
      </g>
      <g className="art-brackets">
        <path d="M110 92V62h30 M290 92V62h-30 M110 228v30h30 M290 228v30h-30" />
      </g>
      <rect x="104" y="58" width="192" height="4" rx="2" className="art-scanline" />
    </svg>
  );
}

/** Object 50 from a lens of focal length 80: the upright virtual image sits 133 behind, 2.67× tall. */
export function RayArt({ className }: { className?: string }) {
  return (
    <svg viewBox="40 70 340 185" className={className} aria-hidden="true" focusable="false">
      <line x1="20" y1="170" x2="380" y2="170" className="art-axis" />
      <circle cx="120" cy="170" r="3.5" className="art-focus" />
      <circle cx="280" cy="170" r="3.5" className="art-focus" />
      <ellipse cx="200" cy="170" rx="11" ry="78" className="art-lens" />
      <g className="art-image">
        <path d="M66.7 170V92 M58.7 100l8-10 8 10" className="art-virtual" />
      </g>
      <path d="M200 140 L66.7 90 M200 170 L66.7 90" className="art-ray-back" pathLength="1" />
      <path d="M150 140H200L360 200" className="art-ray" pathLength="1" />
      <path d="M150 140L200 170L325 245" className="art-ray art-ray--second" pathLength="1" />
      <path d="M150 170V143 M144 150l6-8 6 8" className="art-object-arrow" />
    </svg>
  );
}

/** The experiment: a lens over print, with the slider that moves it. */
export function TryArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 300" className={className} aria-hidden="true" focusable="false">
      <g className="art-print">
        <rect x="70" y="60" width="260" height="150" rx="12" className="art-paper" />
        <path d="M95 95h120 M95 120h170 M95 145h90 M95 170h150" className="art-lines" />
      </g>
      <g className="art-loupe">
        <circle cx="180" cy="130" r="48" className="art-lens-glass" />
        <text x="180" y="146" textAnchor="middle" className="art-print-big">
          Aa
        </text>
        <circle cx="180" cy="130" r="48" className="art-ink-stroke" strokeWidth="8" />
      </g>
      <line x1="90" y1="252" x2="310" y2="252" className="art-track" />
      <line x1="90" y1="252" x2="200" y2="252" className="art-track-fill" />
      <circle cx="200" cy="252" r="13" className="art-knob" />
    </svg>
  );
}

/** A problem card with two answers to choose from. */
export function GuessArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 300" className={className} aria-hidden="true" focusable="false">
      <rect x="60" y="50" width="280" height="110" rx="14" className="art-paper" />
      <path d="M88 86h200 M88 110h150" className="art-lines" />
      <rect x="88" y="124" width="120" height="16" rx="4" className="art-marker" />
      <rect x="60" y="190" width="132" height="48" rx="24" className="art-chip art-chip--chosen" />
      <rect x="208" y="190" width="132" height="48" rx="24" className="art-chip" />
      <path d="M100 214l10 10 20-20" className="art-tick" />
    </svg>
  );
}
