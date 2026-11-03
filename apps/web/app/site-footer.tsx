import Link from "next/link";
import { LanguageSwitcher } from "./i18n/language-switcher";
import { getT } from "./i18n/server";
import { LogoMark } from "./logo";

const FOOTER_GROUPS = [
  {
    heading: "footerLearn",
    links: [
      { href: "/capture", label: "navStartLesson" },
      { href: "/#how", label: "navHowItWorks" },
      { href: "/#inside", label: "footerWhatsInLesson" },
    ],
  },
  {
    heading: "footerTrustAndSafety",
    links: [
      { href: "/about#checks", label: "footerHowChecked" },
      { href: "/about#safety", label: "footerSafety" },
      { href: "/privacy", label: "navPrivacy" },
    ],
  },
  {
    heading: "footerAbout",
    links: [
      { href: "/about", label: "footerAboutSbi" },
      { href: "/support", label: "footerWhatWeCover" },
      { href: "/about#report", label: "footerReportMistake" },
    ],
  },
] as const;

export async function SiteFooter() {
  const t = await getT("site");
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <LogoMark size={44} />
          <p>
            <strong>Science Behind It</strong>
            <br />
            {t("footerTagline")}
          </p>
        </div>
        <nav aria-label={t("footerLabel")} className="site-footer__groups">
          {FOOTER_GROUPS.map((group) => (
            <div key={group.heading}>
              <p className="site-footer__heading">{t(group.heading)}</p>
              <ul>
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href}>{t(link.label)}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className="site-footer__legal">
        <p>{t("footerLegal", { year: new Date().getFullYear() })}</p>
        <LanguageSwitcher />
      </div>
    </footer>
  );
}
