import { CONSENT_VERSION } from "@sbi/contracts";
import {
  createTracker,
  deviceTier,
  noopSink,
  type BrowserSink,
  type EventContext,
  type Track,
} from "@sbi/analytics";
import { hasConsent } from "../consent";
import { isLocale } from "../i18n/locales";
import { readPrefs } from "../lesson/prefs";
import { PATHWAY_COOKIE } from "../pathway/pathway";

const VISIT_KEY = "sbi.visit";

type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;

export interface WebTrackerOptions {
  token: string | null;
  sink: (token: string, visitId: () => string) => BrowserSink;
  consented: () => boolean;
  cookie: () => string;
  storage: () => Storage | undefined;
  path: () => string;
  lang: () => string;
  navigator: () => Parameters<typeof deviceTier>[0];
  installed: () => boolean;
}

const ROUTES: [RegExp, EventContext["route"]][] = [
  [/^\/$/, "home"],
  [/^\/capture/, "capture"],
  [/^\/lesson/, "lesson"],
  [/^\/pathway/, "pathway"],
  [/^\/privacy/, "privacy"],
  [/^\/account/, "account"],
];

/** Under-13s send nothing: the child pathway, or the child band chosen for this visit. */
function isChild(cookie: string, storage: Storage | undefined): boolean {
  if (new RegExp(`(?:^|; )${PATHWAY_COOKIE}=child(?:;|$)`).test(cookie)) return true;
  return readPrefs(storage)?.age === "child";
}

/** The browser's tracker, with every input injectable so tests never touch the real page. */
export function createWebTracker(options: WebTrackerOptions): {
  track: Track;
  forgetVisit: () => void;
} {
  let sink: BrowserSink | undefined;

  const visitId = () => {
    const storage = options.storage();
    const known = storage?.getItem(VISIT_KEY);
    if (known) return known;
    const fresh = crypto.randomUUID();
    storage?.setItem(VISIT_KEY, fresh);
    return fresh;
  };

  const context = (): EventContext | undefined => {
    const storage = options.storage();
    if (!options.token || !options.consented() || isChild(options.cookie(), storage)) {
      return undefined;
    }
    const age = readPrefs(storage)?.age;
    const lang = options.lang();
    return {
      consentVersion: CONSENT_VERSION,
      route: ROUTES.find(([pattern]) => pattern.test(options.path()))?.[1] ?? "other",
      locale: isLocale(lang) ? lang : "en",
      ageBand: age === "teen" || age === "adult" ? age : "general",
      deviceTier: deviceTier(options.navigator()),
      displayMode: options.installed() ? "installed" : "browser",
    };
  };

  const track = createTracker({
    context,
    sink: {
      send: (name, props) => {
        sink ??= options.token ? options.sink(options.token, visitId) : noopSink;
        sink.send(name, props);
      },
      reset: () => sink?.reset(),
    },
    onReject: (name, problems) => {
      if (process.env.NODE_ENV !== "production") console.warn(`Event ${name} refused`, problems);
    },
  });

  return {
    track,
    forgetVisit: () => {
      sink?.reset();
      sink = undefined;
      options.storage()?.removeItem(VISIT_KEY);
    },
  };
}

// iOS Safari reports a home-screen launch only through its own navigator flag.
function installed(): boolean {
  if (typeof window === "undefined") return false;
  const standalone = (navigator as { standalone?: boolean }).standalone === true;
  return standalone || window.matchMedia?.("(display-mode: standalone)").matches === true;
}

function session(): Storage | undefined {
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

const web = createWebTracker({
  // Read directly, not through webEnv, so components that import this stay testable without env.
  token: process.env.NEXT_PUBLIC_MIXPANEL_TOKEN || null,
  // Mixpanel is fetched only once a consented event is sent (ADR 0026).
  sink: (token, visitId) => {
    let loaded: Promise<BrowserSink> | undefined;
    const load = () =>
      (loaded ??= import("@sbi/analytics/mixpanel").then(({ createMixpanelSink }) =>
        createMixpanelSink({ token, visitId }),
      ));
    return {
      send: (name, props) => void load().then((real) => real.send(name, props)),
      reset: () => void loaded?.then((real) => real.reset()),
    };
  },
  consented: () => hasConsent("usage-statistics"),
  cookie: () => (typeof document === "undefined" ? "" : document.cookie),
  storage: session,
  path: () => (typeof location === "undefined" ? "/" : location.pathname),
  lang: () => (typeof document === "undefined" ? "en" : document.documentElement.lang),
  navigator: () => (typeof navigator === "undefined" ? {} : (navigator as never)),
  installed,
});

/** Sends one spec §13 event when the learner has said yes; otherwise does nothing. */
export const track: Track = web.track;

/** Called when usage statistics are declined, so nothing more is sent and the visit is forgotten. */
export const forgetVisit = web.forgetVisit;
