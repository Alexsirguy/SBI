import type { AudienceBand, PolicyResponse, TutorTurn } from "@sbi/contracts";
import { ageHold, policyResponse, type RiskClassifier } from "@sbi/safety";

export type TurnSafety = TutorTurn["safetyCategory"];

export type Assessment =
  | { decision: "answer"; category: TurnSafety }
  | { decision: "policy"; category: TurnSafety; policy: PolicyResponse };

/** The same classifier and age holds lessons use, so the tutor can't be a way around them. */
export async function assessTurn(
  classify: RiskClassifier,
  input: { subject: string; text: string; audience: AudienceBand; locale: string },
): Promise<Assessment> {
  const risk = await classify({ subject: input.subject, question: input.text });
  const category: TurnSafety = risk.categories[0] ?? "none";
  if (risk.intent === "harm") {
    return {
      decision: "policy",
      category: risk.categories[0] ?? "other",
      policy: policyResponse(risk.categories[0], input.locale),
    };
  }
  const hold = ageHold(input.audience, risk, input.locale);
  if (hold) return { decision: "policy", category, policy: hold };
  return { decision: "answer", category };
}
