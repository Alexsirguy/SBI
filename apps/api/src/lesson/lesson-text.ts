import { isSpanish } from "@sbi/safety";

// Every learner-facing line the lesson service writes, per language (#107); English is the default.
const EN = {
  unavailable: "Lesson generation is unavailable right now. Try again later.",
  unknownCategory: "Unknown category.",
  unknownTopic: "That curriculum topic could not be found.",
  noCoverage: "No lesson coverage for this category yet.",
  noEvidence: "We could not find trusted sources for this question yet. Try asking it another way.",
  held: "A reviewer needs to check this lesson before we can show it. Try again later.",
  researching: (count: number, questions: string) => `Researching ${count} questions: ${questions}`,
  reusedEvidence: "Using evidence checked for an earlier question.",
  checkedClaims: (count: number) => `Checked ${count} claims from trusted sources.`,
  writingChecked: (count: number) => `Writing the lesson from ${count} checked claims.`,
  writingMixed: (checked: number, model: number) =>
    `Writing the lesson from ${checked} checked claims and ${model} from general knowledge.`,
  checking: "Checking every section against its sources.",
  fallback: "Fresh generation failed; showing a related cached lesson.",
  retry: "We couldn't write this lesson just now. Try again.",
  somethingWentWrong: "Something went wrong.",
  researchingCount: (count: number) => `Researching ${count} questions.`,
};

const ES: typeof EN = {
  unavailable: "Ahora mismo no se pueden crear lecciones. Inténtalo más tarde.",
  unknownCategory: "Categoría desconocida.",
  unknownTopic: "No se ha encontrado ese tema del currículo.",
  noCoverage: "Todavía no hay lecciones sobre esta categoría.",
  noEvidence:
    "Todavía no encontramos fuentes fiables para esta pregunta. Prueba a hacerla de otra forma.",
  held: "Un revisor tiene que comprobar esta lección antes de que podamos mostrarla. Inténtalo más tarde.",
  researching: (count, questions) => `Investigando ${count} preguntas: ${questions}`,
  reusedEvidence: "Usando pruebas comprobadas para una pregunta anterior.",
  checkedClaims: (count) => `${count} afirmaciones comprobadas en fuentes fiables.`,
  writingChecked: (count) =>
    `Escribiendo la lección a partir de ${count} afirmaciones comprobadas.`,
  writingMixed: (checked, model) =>
    `Escribiendo la lección a partir de ${checked} afirmaciones comprobadas y ${model} de conocimiento general.`,
  checking: "Comprobando cada sección con sus fuentes.",
  fallback: "No se pudo escribir una lección nueva; mostramos una lección relacionada guardada.",
  retry: "Ahora mismo no pudimos escribir esta lección. Inténtalo de nuevo.",
  somethingWentWrong: "Algo ha fallado.",
  researchingCount: (count) => `Investigando ${count} preguntas.`,
};

export type LessonText = typeof EN;

export function lessonText(locale: string | undefined): LessonText {
  return isSpanish(locale) ? ES : EN;
}

// Catalogue topics with their own wording for the safety notice shown first (ADR 0010).
export const SAFETY_NOTICES_ES: Readonly<Record<string, string>> = {
  "object.medicine-tablets":
    "Medicamentos: esta lección explica cómo funcionan los medicamentos en general, no cómo usar uno. Nunca tomes ni des un medicamento por esta lección; sigue el prospecto o pregunta a un médico o farmacéutico. Si alguien puede haber tomado demasiado, llama al centro de toxicología o al número de emergencias local.",
  "object.cleaning-products":
    "Productos de limpieza: esta lección explica solo la química. Nunca mezcles productos de limpieza ni uses uno de una forma que su etiqueta no indique; algunas mezclas desprenden gases tóxicos. Si alguien traga o respira uno, llama al centro de toxicología o al número de emergencias local.",
  "category.household-chemicals":
    "Productos químicos del hogar: esta lección explica solo la química. Nunca mezcles, pruebes ni manipules productos químicos por ella; sigue la etiqueta. Si alguien traga o respira uno, llama al centro de toxicología o al número de emergencias local.",
  "object.electrical-socket":
    "Electricidad: esta lección explica solo la ciencia. Nunca metas nada en un enchufe ni abras un enchufe, una clavija o un aparato; la corriente de la red puede matar. Si alguien recibe una descarga, corta la corriente antes de tocarlo y llama al número de emergencias local.",
  "object.mushroom":
    "Setas silvestres: esta lección explica solo la biología y no puede decirte si una seta es segura. Nunca comas ni pruebes una seta silvestre por una foto o por esta lección; algunas son mortales. Si alguien puede haber comido una, llama al centro de toxicología o al número de emergencias local.",
};
