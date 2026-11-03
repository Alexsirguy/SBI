import "server-only";
import { format } from "./format";
import { getLocale, getMessages } from "./load";
import type { Messages, Namespace } from "./messages";

/** Server components' translator for one namespace. */
export async function getT<N extends Namespace>(namespace: N) {
  const messages = await getMessages(await getLocale());
  const table = messages[namespace];
  return (key: keyof Messages[N] & string, values?: Record<string, string | number>) =>
    format(table[key as keyof typeof table] as string, values);
}
