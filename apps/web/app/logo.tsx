/** The SBI mark: the letters inside a magnifying lens, in the Workbench action and highlighter colours. */
export function LogoMark({ size = 36, title }: { size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className="logo-mark"
    >
      <circle cx="21" cy="21" r="18" fill="var(--sbi-marker)" />
      <circle cx="21" cy="21" r="18" fill="none" stroke="var(--sbi-action)" strokeWidth="4" />
      <path d="M34 34 L44 44" stroke="var(--sbi-action)" strokeWidth="6" strokeLinecap="round" />
      <text
        x="21"
        y="25.5"
        textAnchor="middle"
        fontFamily="var(--sbi-font-display)"
        fontWeight="800"
        fontSize="13"
        letterSpacing="-0.3"
        fill="var(--sbi-marker-ink)"
      >
        SBI
      </text>
    </svg>
  );
}

/** Mark plus name; the name hides on the narrowest screens and the mark then carries it. */
export function Logo() {
  return (
    <span className="logo">
      <LogoMark />
      <span className="logo__name">Science Behind It</span>
    </span>
  );
}
