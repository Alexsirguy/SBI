import type { LessonSection } from "@sbi/contracts";
import { useT } from "../../i18n/provider";
import { SectionFrame } from "./frame";

/** Module 5: something to try or imagine; on high-risk topics only ever a thought experiment. */
export function TryAnIdeaSection({
  section,
  highRisk,
}: {
  section: LessonSection;
  highRisk: boolean;
}) {
  const t = useT("lesson");
  return (
    <SectionFrame section={section}>
      <p className="try-kind">
        <strong>{highRisk ? t("thoughtExperiment") : t("tryOrPicture")}</strong>
      </p>
      <p>{section.text}</p>
      {/* Interactive visuals (#96) mount here once the visual platform lands. */}
      <div data-slot="interaction" />
    </SectionFrame>
  );
}
