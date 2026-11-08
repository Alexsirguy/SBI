import type { ClassRepository, StoredClass } from "@sbi/db";

/** In-memory class tables, with the same unique join-code rule as the database. */
export function fakeClasses() {
  const educators = new Set<string>();
  const rows = new Map<string, StoredClass & { joinCodeHash: string }>();
  const copy = (row: StoredClass & { joinCodeHash: string }): StoredClass =>
    structuredClone(
      Object.fromEntries(Object.entries(row).filter(([key]) => key !== "joinCodeHash")),
    ) as StoredClass;
  const duplicate = () => Object.assign(new Error("Duplicate entry"), { code: "ER_DUP_ENTRY" });
  const codeTaken = (hash: string, except?: string) =>
    [...rows.values()].some((row) => row.joinCodeHash === hash && row.classId !== except);

  const repository: ClassRepository = {
    isEducator: async (accountId) => educators.has(accountId),
    enableEducator: async (accountId) => void educators.add(accountId),
    create: async (input) => {
      if (codeTaken(input.joinCodeHash)) throw duplicate();
      rows.set(input.classId, { ...structuredClone(input), archivedAt: null, lessons: [] });
    },
    listOwned: async (accountId) =>
      [...rows.values()].filter((row) => row.ownerAccountId === accountId).map(copy),
    getOwned: async (accountId, classId) => {
      const row = rows.get(classId);
      return row && row.ownerAccountId === accountId ? copy(row) : undefined;
    },
    findOpenByCode: async (hash) => {
      const row = [...rows.values()].find((r) => r.joinCodeHash === hash && !r.archivedAt);
      return row && copy(row);
    },
    update: async (classId, changes) => {
      const row = rows.get(classId);
      if (!row) return;
      for (const [key, value] of Object.entries(changes)) {
        if (value !== undefined) Object.assign(row, { [key]: structuredClone(value) });
      }
    },
    setJoinCode: async (classId, joinCodeHash, joinCodeHint) => {
      if (codeTaken(joinCodeHash, classId)) throw duplicate();
      Object.assign(rows.get(classId) ?? {}, { joinCodeHash, joinCodeHint });
    },
    addLesson: async (classId, lesson) => {
      const row = rows.get(classId);
      if (!row) return;
      const existing = row.lessons.find((item) => item.lessonId === lesson.lessonId);
      if (existing) Object.assign(existing, { title: lesson.title, version: lesson.version });
      else row.lessons.push({ ...lesson });
    },
    removeLesson: async (classId, lessonId) => {
      const row = rows.get(classId);
      if (row) row.lessons = row.lessons.filter((item) => item.lessonId !== lessonId);
    },
    deleteArchivedBefore: async (before) => {
      let count = 0;
      for (const [id, row] of rows) {
        if (row.archivedAt && row.archivedAt <= before) count += Number(rows.delete(id));
      }
      return count;
    },
  };
  return { educators, repository, rows };
}
