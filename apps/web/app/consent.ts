import {
  CONSENT_VERSION,
  ConsentPurpose,
  ConsentRecord,
  type ConsentRecord as Consent,
} from "@sbi/contracts";
import { z } from "zod";

const CONSENT_KEY = "sbi.consent";
const KEPT_KEY = "sbi.kept-photos";

const KeptPhoto = z.object({ key: z.string().min(1), label: z.string(), keptAt: z.string() });
export type KeptPhoto = z.infer<typeof KeptPhoto>;

type Store = Pick<Storage, "getItem" | "setItem">;

// Private browsing can refuse storage; then nothing is remembered and nothing is consented.
function store(storage?: Store): Store | undefined {
  try {
    return storage ?? window.localStorage;
  } catch {
    return undefined;
  }
}

function read<T>(key: string, schema: z.ZodType<T>, storage?: Store): T | undefined {
  try {
    const raw = store(storage)?.getItem(key);
    return raw ? schema.parse(JSON.parse(raw)) : undefined;
  } catch {
    return undefined;
  }
}

const listeners = new Set<() => void>();

function write(key: string, value: unknown, storage?: Store) {
  try {
    store(storage)?.setItem(key, JSON.stringify(value));
  } catch {
    // Unwritable storage means the choice lasts this page only, which errs towards privacy.
  }
  for (const listener of listeners) listener();
}

/** Lets a page follow choices made in it or in another tab. */
export function subscribeToChoices(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** Changes whenever a choice or the kept list does; cheap to compare, as React requires. */
export function choicesSnapshot(storage?: Store): string {
  try {
    const source = store(storage);
    return `${source?.getItem(CONSENT_KEY) ?? ""}\n${source?.getItem(KEPT_KEY) ?? ""}`;
  } catch {
    return "";
  }
}

/** The learner's choices on this device; every purpose is off until they turn it on, and only
 * purposes with a feature behind them are ever asked for. */
export function readConsent(storage?: Store): Consent | undefined {
  return read(CONSENT_KEY, ConsentRecord, storage);
}

/** True only for a choice made under the current wording; an older agreement is asked again. */
export function hasConsent(purpose: ConsentPurpose, storage?: Store): boolean {
  const record = readConsent(storage);
  return record?.version === CONSENT_VERSION && record.choices[purpose] === true;
}

/** Accepted, declined, or undefined while the learner has not answered under current wording. */
export function consentChoice(purpose: ConsentPurpose, storage?: Store): boolean | undefined {
  const record = readConsent(storage);
  return record?.version === CONSENT_VERSION ? record.choices[purpose] : undefined;
}

export function setConsent(
  purpose: ConsentPurpose,
  allowed: boolean,
  storage?: Store,
  now = new Date(),
): Consent {
  return setConsents({ [purpose]: allowed }, storage, now);
}

/** Records several answers at once; purposes not named keep their earlier answer. */
export function setConsents(
  answers: Partial<Record<ConsentPurpose, boolean>>,
  storage?: Store,
  now = new Date(),
): Consent {
  const current = readConsent(storage);
  const record: Consent = {
    version: CONSENT_VERSION,
    choices: { ...(current?.version === CONSENT_VERSION ? current.choices : {}), ...answers },
    decidedAt: now.toISOString(),
  };
  write(CONSENT_KEY, record, storage);
  return record;
}

export const CONSENT_PURPOSES = ConsentPurpose.options;

/** Kept photos are listed on this device only, so the learner can find and delete them. */
export function readKeptPhotos(storage?: Store): KeptPhoto[] {
  return read(KEPT_KEY, z.array(KeptPhoto), storage) ?? [];
}

export function rememberKeptPhoto(photo: KeptPhoto, storage?: Store) {
  const others = readKeptPhotos(storage).filter((item) => item.key !== photo.key);
  write(KEPT_KEY, [...others, photo], storage);
}

export function forgetKeptPhoto(key: string, storage?: Store) {
  write(
    KEPT_KEY,
    readKeptPhotos(storage).filter((item) => item.key !== key),
    storage,
  );
}
