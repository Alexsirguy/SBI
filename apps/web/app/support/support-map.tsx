"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { useLocale, useT } from "../i18n/provider";

/** The public support map (#109): on-demand reach first, then the curated catalogue by category. */
export function SupportMapView() {
  const t = useT("site");
  const locale = useLocale();
  const map = useQuery({
    queryFn: () => api("supportMap", { locale }),
    queryKey: ["support-map", locale],
  });

  if (map.isPending) return <p role="status">{t("supportLoading")}</p>;
  if (map.error) return <p role="alert">{t("supportError")}</p>;
  const { categories, catalogueObjects, onDemandSubjects } = map.data;

  return (
    <>
      <h2>{t("supportAnyHeading")}</h2>
      <p>{t("supportAny")}</p>
      <p>{t("supportOnDemand", { count: onDemandSubjects })}</p>
      <h2>{t("supportCatalogueHeading")}</h2>
      <p>{t("supportCatalogue", { count: catalogueObjects })}</p>
      <div className="support-map">
        {categories.map((category) => (
          <section key={category.id} aria-labelledby={`support-${category.id}`}>
            <h3 id={`support-${category.id}`}>{category.label}</h3>
            <ul>
              {category.objects.map((object) => (
                <li key={object.id}>
                  {object.label}
                  {/* Spaces keep the name and its marks apart when read aloud. */}
                  {object.curated ? " " : null}
                  {object.curated ? (
                    <span className="support-map__mark">{t("supportCuratedMark")}</span>
                  ) : null}
                  {object.safetyNotice ? " " : null}
                  {object.safetyNotice ? (
                    <span className="support-map__mark support-map__mark--safety">
                      {t("supportSafetyMark")}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
