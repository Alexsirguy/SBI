"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { forgetAccountData } from "../use-account";

/** Clears the deleted account's cached data once its page is gone, so nothing of it lingers. */
export function ForgetAccount() {
  const client = useQueryClient();
  useEffect(() => forgetAccountData(client), [client]);
  return null;
}
