import { isSpanish } from "@sbi/safety";

// Learner-facing lines the tutor endpoints write, per language (#107).
const EN = {
  unavailable: "The tutor isn't available right now. Try again later.",
  tooMany: "That's a lot of questions for now. Take a look at the lesson and try again soon.",
  noLesson: "That lesson is not available.",
  beyondLesson: "This goes beyond the lesson's sources, so it isn't checked against them.",
};

const ES: typeof EN = {
  unavailable: "El tutor no está disponible ahora mismo. Inténtalo más tarde.",
  tooMany: "Son muchas preguntas por ahora. Echa un vistazo a la lección y vuelve a probar pronto.",
  noLesson: "Esa lección no está disponible.",
  beyondLesson:
    "Esto va más allá de las fuentes de la lección, así que no está comprobado con ellas.",
};

export const tutorText = (locale?: string) => (isSpanish(locale) ? ES : EN);
