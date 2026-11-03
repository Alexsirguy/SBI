import "server-only";
import { cookies } from "next/headers";
import { isPathway, PATHWAY_COOKIE, type Pathway } from "./pathway";

export async function getPathway(): Promise<Pathway | undefined> {
  const value = (await cookies()).get(PATHWAY_COOKIE)?.value;
  return isPathway(value) ? value : undefined;
}
