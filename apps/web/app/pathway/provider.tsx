"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { writePathwayCookie, type Pathway } from "./pathway";

interface PathwayState {
  pathway: Pathway | undefined;
  choose: (pathway: Pathway) => void;
}

const PathwayContext = createContext<PathwayState>({ pathway: undefined, choose: () => undefined });

/** The server read the cookie, so the first render already matches the learner's pathway. */
export function PathwayProvider({
  initial,
  children,
}: {
  initial: Pathway | undefined;
  children: ReactNode;
}) {
  const router = useRouter();
  const [pathway, setPathway] = useState(initial);
  const choose = useCallback(
    (next: Pathway) => {
      writePathwayCookie(next);
      setPathway(next);
      // Server-rendered pages (the lesson's age band) follow the new choice.
      router.refresh();
    },
    [router],
  );
  return <PathwayContext.Provider value={{ choose, pathway }}>{children}</PathwayContext.Provider>;
}

export function usePathway(): PathwayState {
  return useContext(PathwayContext);
}
