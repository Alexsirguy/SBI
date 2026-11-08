import type { LessonDisclaimer } from "@sbi/contracts";

// Spanish wording for every notice publish.ts writes; change both when the English changes.
export const NOTICES_ES: Record<Exclude<LessonDisclaimer["kind"], "safety">, string> = {
  "model-knowledge":
    "Partes de esta lección vienen del conocimiento general de la IA porque no encontramos una fuente fiable para ellas, y ningún revisor la ha comprobado todavía. Avísanos si algo parece incorrecto.",
  "awaiting-review":
    "Ningún revisor ha comprobado todavía esta lección. Tómala como un borrador y avísanos si algo parece incorrecto.",
  "unverified-sections":
    "Partes de esta lección dicen más de lo que muestran sus fuentes y todavía no se han comprobado.",
  "sources-disagree": "Algunas de las fuentes de esta lección no coinciden entre sí.",
  "open-questions":
    "Algunas afirmaciones todavía se debaten o aún no las confirma una fuente fiable.",
  "limited-evidence": "Algunas afirmaciones se basan en pocas pruebas.",
  "reading-level": "Puede que esta lección sea más difícil de leer que el nivel que elegiste.",
  "teacher-edited":
    "Tu docente editó partes de esta lección. Esas partes no se volvieron a comprobar con sus fuentes.",
};

export const GENERIC_SAFETY_NOTICE_ES =
  "La seguridad es lo primero: esta lección explica solo la ciencia. No es un consejo para usar, manipular ni probar nada. No lo intentes tú; pregunta a un adulto responsable o a un profesional y, en una emergencia, llama al número de emergencias local.";
