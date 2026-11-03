import type { SafetyCategory } from "@sbi/contracts";

// Spanish versions of policy.ts texts, kept side by side so a wording change is made in both.
const EMERGENCY =
  "Si alguien está en peligro o herido, llama ahora al número de emergencias local.";
const POISON =
  "Si alguien puede haber tragado, respirado o tocado algo dañino, llama al centro de toxicología o al número de emergencias local.";

export const CATEGORY_NOTICES_ES: Readonly<Record<SafetyCategory, string>> = {
  medical:
    "Salud y medicamentos: esta lección explica la ciencia en general, no qué tomar ni qué hacer. Nunca tomes ni des un medicamento por ella; pregunta a un médico, enfermero o farmacéutico. Si alguien puede haber tomado demasiado, llama al centro de toxicología o al número de emergencias local.",
  "chemical-exposure":
    "Productos químicos: esta lección explica solo la química. Nunca mezcles, pruebes, huelas ni manipules productos químicos por ella; sigue la etiqueta y pregunta a un adulto responsable. Si alguien traga o respira uno, llama al centro de toxicología o al número de emergencias local.",
  weapons:
    "Armas: esta lección explica solo la ciencia, nunca cómo fabricar, conseguir o usar un arma. Nunca manipules una por ella. Si alguien está en peligro, llama al número de emergencias local.",
  "self-harm":
    "Puede ser difícil pensar en este tema. Si lo estás pasando mal o podrías hacerte daño, habla hoy con alguien de confianza o llama al número de emergencias local. En findahelpline.com encontrarás líneas de ayuda gratuitas y confidenciales de tu país.",
  "dangerous-biology":
    "Peligros biológicos: esta lección explica solo la biología. Nunca toques, pruebes, recojas ni cultives nada peligroso por ella, y mantente lejos de los animales salvajes. Si alguien sufre una mordedura, una picadura o un envenenamiento, llama al centro de toxicología o al número de emergencias local.",
};

export const REDIRECTS_ES: Readonly<Record<SafetyCategory, { message: string; help: string[] }>> = {
  "self-harm": {
    message:
      "Parece que ahora mismo las cosas pueden estar siendo muy difíciles. No podemos ayudarte con esa pregunta, pero no tienes que afrontarlo solo.",
    help: [
      "Si podrías hacerte daño, llama ahora al número de emergencias local.",
      "Habla hoy con alguien de confianza: tu madre, tu padre, quien te cuide, un profesor, un amigo o un médico.",
      "En findahelpline.com encontrarás líneas de ayuda gratuitas y confidenciales de tu país.",
    ],
  },
  weapons: {
    message:
      "No podemos ayudar a fabricar, conseguir ni usar armas. Podemos explicar la ciencia de cómo funciona algo, de forma segura.",
    help: ["Pregunta mejor cómo funciona o por qué se comporta así.", EMERGENCY],
  },
  medical: {
    message:
      "No podemos aconsejar sobre tomar, dar o usar mal medicamentos o drogas. Podemos explicar en general cómo actúan en el cuerpo.",
    help: ["Pregunta a un médico, enfermero o farmacéutico sobre cualquier medicamento.", POISON],
  },
  "chemical-exposure": {
    message:
      "No podemos ayudar a mezclar, fabricar o usar productos químicos para causar daño. Podemos explicar la química que hay detrás, de forma segura.",
    help: ["Pregunta mejor por qué un producto químico se comporta así.", POISON],
  },
  "dangerous-biology": {
    message:
      "No podemos ayudar a cultivar, propagar o usar gérmenes, toxinas o venenos. Podemos explicar cómo funcionan los seres vivos, de forma segura.",
    help: ["Pregunta mejor cómo funciona o por qué se comporta así.", POISON],
  },
};

export const ANY_HARM_ES = {
  message:
    "No podemos ayudar con nada que pueda hacerte daño a ti o a otra persona. Podemos explicar la ciencia de cómo funcionan las cosas, de forma segura.",
  help: ["Pregunta mejor cómo funciona o por qué se comporta así.", EMERGENCY],
};

export const AGE_HOLDS_ES = {
  teen: {
    message:
      "Esta pregunta es para adolescentes y adultos, así que no la hemos respondido para la franja de edad que elegiste.",
    help: [
      "Si eres adolescente o adulto, cambia la franja de edad y la responderemos.",
      "O explóralo con tu madre, tu padre, quien te cuide o un profesor.",
    ],
  },
  adult: {
    message:
      "Esta pregunta es para adultos, así que no la hemos respondido para la franja de edad que elegiste.",
    help: [
      "Si eres adulto, cambia la franja de edad a Adulto y la responderemos.",
      "O explóralo con tu madre, tu padre, quien te cuide o un profesor.",
    ],
  },
} as const;

/** Spanish for any "es" locale tag; every other language falls back to English. */
export function isSpanish(locale: string | undefined): boolean {
  return !!locale && /^es(-|$)/i.test(locale);
}
