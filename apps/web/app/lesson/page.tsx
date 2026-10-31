import Link from "next/link";
import { LessonReader } from "./lesson-reader";
import "./lesson.css";
import { lessonRequestFrom } from "./lesson-request";
import { parsePrefs } from "./prefs";

const param = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function LessonPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const named = param(params.label)?.trim();
  const label = named || "this object";
  const question = param(params.q)?.trim() || undefined;
  const prefs = parsePrefs(param(params.depth), param(params.age));
  const request = lessonRequestFrom({
    taxonomyId: param(params.taxonomyId),
    label: named,
    q: question,
    depth: prefs.depth,
    age: prefs.age,
    fresh: param(params.fresh),
  });
  if (!request) {
    return (
      <main id="main">
        <h1>Choose something to learn about</h1>
        <p>
          <Link href="/capture">Photograph or describe anything</Link> to start a lesson about it.
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
