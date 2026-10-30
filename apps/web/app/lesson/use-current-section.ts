"use client";

import { useEffect, useState } from "react";

/** The id of the section the reader is in: the last one whose top has passed a third of the way down. */
export function useCurrentSection(ids: string[]): string | undefined {
  const [current, setCurrent] = useState<string>();
  const key = ids.join(" ");
  useEffect(() => {
    if (!key) return;
    const all = key.split(" ");
    const update = () => {
      const line = window.innerHeight / 3;
      let found: string | undefined;
      for (const id of all) {
        const top = document.getElementById(id)?.getBoundingClientRect().top;
        if (top !== undefined && top <= line) found = id;
      }
      // A section jumped to near the end cannot reach the top, so while it is in view it wins.
      const jumped = window.location.hash.slice(1);
      const jumpedTop = all.includes(jumped)
        ? document.getElementById(jumped)?.getBoundingClientRect().top
        : undefined;
      if (jumpedTop !== undefined && jumpedTop >= -line && jumpedTop < window.innerHeight / 2) {
        found = jumped;
      }
      setCurrent(found ?? all[0]);
    };
    update();
    // Scroll events are passive and batched by the browser; this only reads layout.
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("hashchange", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("hashchange", update);
    };
  }, [key]);
  return current;
}
