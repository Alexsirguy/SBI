import Link from "next/link";
import { getLocale } from "../i18n/load";
import { pathwayAge } from "../pathway/pathway";
import { getPathway } from "../pathway/server";
import { getT } from "../i18n/server";
import { LessonReader } from "./lesson-reader";
import "./lesson.css";
import { lessonRequestFrom } from "./lesson-request";
import { rich } from "./lesson-t";
import { parsePrefs } from "./prefs";

const param = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function LessonPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const t = await getT("lesson");
  const named = param(params.label)?.trim();
  const label = named || t("defaultLabel");
  const question = param(params.q)?.trim() || undefined;
  const chosen = parsePrefs(param(params.depth), param(params.age));
  // The child pathway is held on the server, so a typed or shared link cannot lift it.
  const prefs = { ...chosen, age: pathwayAge(await getPathway(), chosen.age) };
  const request = lessonRequestFrom({
    taxonomyId: param(params.taxonomyId),
    label: named,
    q: question,
    depth: prefs.depth,
    age: prefs.age,
    fresh: param(params.fresh),
    locale: await getLocale(),
  });
  if (!request) {
    return (
      <main id="main">
        <h1>{t("chooseHeading")}</h1>
        <p>
          {rich(t("chooseBody"), {
            link: <Link href="/capture">{t("chooseLink")}</Link>,
          })}
        </p>
      </main>
    );
  }
  // Keyed by subject and question only: a depth or age change updates the reader in place, so
  // focus stays on the control the learner just used while the matching lesson streams.
  return (
    <LessonReader
      key={`${request.taxonomyId ?? request.subject}\n${request.question}`}
      request={request}
      label={label}
      prefs={prefs}
      question={question}
    />
  );
}
