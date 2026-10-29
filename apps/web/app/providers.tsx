"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  // One client per browser session; created in state so a re-render never discards its cache.
  // No silent retries: a learner should see a failure at once and choose to try again.
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
