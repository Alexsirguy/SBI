import Link from "next/link";
import { LogoMark } from "./logo";

const FOOTER_GROUPS = [
  {
    heading: "Learn",
    links: [
      { href: "/capture", label: "Start a lesson" },
      { href: "/#how", label: "How it works" },
      { href: "/#inside", label: "What's in a lesson" },
    ],
  },
  {
    heading: "Trust and safety",
    links: [
      { href: "/about#checks", label: "How lessons are checked" },
      { href: "/about#safety", label: "Safety" },
      { href: "/privacy", label: "Privacy" },
    ],
  },
  {
    heading: "About",
    links: [
      { href: "/about", label: "About Science Behind It" },
      { href: "/about#report", label: "Report a mistake" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <LogoMark size={44} />
          <p>
            <strong>Science Behind It</strong>
            <br />
            The science of everyday objects, from what you can see to why it works. Every lesson
            says where it comes from.
          </p>
        </div>
        <nav aria-label="Footer" className="site-footer__groups">
          {FOOTER_GROUPS.map((group) => (
            <div key={group.heading}>
              <p className="site-footer__heading">{group.heading}</p>
              <ul>
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className="site-footer__legal">
        <p>
          © {new Date().getFullYear()} Science Behind It. Lessons explain science; they are not
          professional advice.
        </p>
      </div>
    </footer>
  );
}
