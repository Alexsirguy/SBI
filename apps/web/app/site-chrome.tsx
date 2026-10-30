import Link from "next/link";

const LINKS = [
  { href: "/capture", label: "Start a lesson" },
  { href: "/privacy", label: "Privacy" },
  { href: "/about", label: "About" },
] as const;

// Every page's <main> carries id="main", so keyboard users can skip straight past the header.
export function SiteHeader() {
  return (
    <header className="site-header">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <div className="site-header__inner">
        <Link href="/" className="site-brand">
          Science Behind It
        </Link>
        <nav aria-label="Main">
          <ul className="site-nav">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <p>Short answers first, then the reasons, with their sources.</p>
        <nav aria-label="Footer">
          <ul className="site-nav">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
