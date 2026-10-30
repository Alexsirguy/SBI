import Link from "next/link";
import { LessonReader } from "./lesson-reader";
import { lessonRequestFrom } from "./lesson-request";
import { parsePrefs } from "./prefs";

const param = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function LessonPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const label = param(params.label)?.trim() || "this object";
  const question = param(params.q)?.trim() || undefined;
  const prefs = parsePrefs(param(params.depth), param(params.age));
  const request = lessonRequestFrom({
    taxonomyId: param(params.taxonomyId),
    label,
    q: question,
    depth: prefs.depth,
    age: prefs.age,
  });
  if (!request) {
    return (
      <main>
        <h1>Choose an object first</h1>
        <p>
          <Link href="/capture">Photograph or describe an object</Link> to start a lesson about it.
        </p>
      </main>
    );
  }
  // Keyed by the request so a new object or question starts a fresh stream.
  return (
    <LessonReader
      key={JSON.stringify(request)}
      request={request}
      label={label}
      prefs={prefs}
      question={question}
    />
  );
}
