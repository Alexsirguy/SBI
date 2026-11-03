"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { useT } from "./i18n/provider";
import { Logo } from "./logo";

// Account leads to sign-in when signed out (ADR 0020).
const MAIN_LINKS = [
  { href: "/#how", label: "navHowItWorks" },
  { href: "/about", label: "navAbout" },
  { href: "/privacy", label: "navPrivacy" },
  { href: "/account", label: "navAccount" },
] as const;

// Every page's <main> carries id="main", so keyboard users can skip straight past the header.
export function SiteHeader() {
  const t = useT("site");
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  // Following a link closes the menu, so it never covers the page the learner chose.
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="site-header" data-open={open}>
      <a href="#main" className="skip-link">
        {t("skipToContent")}
      </a>
      <div className="site-header__inner">
        <Link href="/" className="site-brand">
          <Logo />
        </Link>
        <button
          ref={buttonRef}
          type="button"
          className="menu-button"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((value) => !value)}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
            {open ? (
              <path
                d="M6 6 L18 18 M18 6 L6 18"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M4 7 H20 M4 12 H20 M4 17 H20"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            )}
          </svg>
          <span className="menu-button__label">{open ? t("menuClose") : t("menuOpen")}</span>
        </button>
        <nav aria-label={t("navMainLabel")} id={menuId} className="site-menu">
          <ul className="site-nav">
            {MAIN_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={pathname === link.href ? "page" : undefined}
                  onClick={close}
                >
                  {t(link.label)}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/capture"
                className="sbi-button sbi-button--primary sbi-button--small"
                onClick={close}
              >
                {t("navStartLesson")}
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
