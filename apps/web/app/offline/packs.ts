import type { LessonPack } from "@sbi/contracts";

/** A saved pack as listed, without the lesson itself. */
export interface PackSummary {
  lessonId: string;
  title: string;
  savedAt: string;
}

export interface PackStore {
  save(pack: LessonPack): Promise<void>;
  list(): Promise<PackSummary[]>;
  get(lessonId: string): Promise<LessonPack | undefined>;
  remove(lessonId: string): Promise<void>;
}

const DB = "sbi-offline";
const STORE = "packs";

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Storage failed"));
  });
}

function open(): Promise<IDBDatabase> {
  const req = indexedDB.open(DB, 1);
  req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "lesson.lessonId" });
  return request(req);
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const db = await open();
  try {
    return await request(run(db.transaction(STORE, mode).objectStore(STORE)));
  } finally {
    db.close();
  }
}

const summary = (pack: LessonPack): PackSummary => ({
  lessonId: pack.lesson.lessonId,
  savedAt: pack.exportedAt,
  title: pack.lesson.title,
});

// IndexedDB, on this device only: a saved lesson holds nothing about the learner (ADR 0028).
export const devicePacks: PackStore = {
  save: async (pack) => void (await withStore("readwrite", (store) => store.put(pack))),
  list: async () =>
    ((await withStore("readonly", (store) => store.getAll())) as LessonPack[])
      .map(summary)
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt)),
  get: async (lessonId) =>
    (await withStore("readonly", (store) => store.get(lessonId))) as LessonPack | undefined,
  remove: async (lessonId) =>
    void (await withStore("readwrite", (store) => store.delete(lessonId))),
};

/** For tests and browsers without IndexedDB: the same store, kept in memory. */
export function memoryPacks(): PackStore {
  const packs = new Map<string, LessonPack>();
  return {
    save: async (pack) => void packs.set(pack.lesson.lessonId, structuredClone(pack)),
    list: async () =>
      [...packs.values()].map(summary).sort((a, b) => b.savedAt.localeCompare(a.savedAt)),
    get: async (lessonId) => structuredClone(packs.get(lessonId)),
    remove: async (lessonId) => void packs.delete(lessonId),
  };
}

export const packFileName = (pack: LessonPack) =>
  `${
    pack.lesson.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "lesson"
  }.sbipack.json`;
