/** The class a pupil opened, for this tab only: its code rides with lesson and tutor requests. */
export interface ClassContext {
  code: string;
  name: string;
  tutorEnabled: boolean;
}

const KEY = "sbi.class";

type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;

function session(storage?: Storage): Storage | undefined {
  try {
    return storage ?? window.sessionStorage;
  } catch {
    return undefined;
  }
}

// Session storage only: closing the tab leaves the class, and nothing is kept on the device.
export function readClass(storage?: Storage): ClassContext | undefined {
  try {
    const raw = session(storage)?.getItem(KEY);
    if (!raw) return undefined;
    const value = JSON.parse(raw) as Partial<ClassContext>;
    if (typeof value.code !== "string" || typeof value.name !== "string") return undefined;
    return { code: value.code, name: value.name, tutorEnabled: value.tutorEnabled !== false };
  } catch {
    return undefined;
  }
}

export function enterClass(context: ClassContext, storage?: Storage): void {
  try {
    session(storage)?.setItem(KEY, JSON.stringify(context));
  } catch {
    // Refused storage means the class lasts this page only; lessons still open from it.
  }
}

export function leaveClass(storage?: Storage): void {
  try {
    session(storage)?.removeItem(KEY);
  } catch {
    // Nothing was stored, so there is nothing to leave.
  }
}

export const classCode = (storage?: Storage) => readClass(storage)?.code;
