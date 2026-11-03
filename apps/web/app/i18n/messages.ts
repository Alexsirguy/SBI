import type en from "./messages/en";

/** English is the source of truth; every other language must have the same keys. */
export type Messages = typeof en;
export type Namespace = keyof Messages;
