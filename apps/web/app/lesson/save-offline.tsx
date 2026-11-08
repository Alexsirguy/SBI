"use client";

import type { LessonPack } from "@sbi/contracts";
import { Button } from "@sbi/ui";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "../api";
import { useT } from "../i18n/provider";
import { devicePacks, packFileName, type PackStore } from "../offline/packs";
import { enableOffline } from "../offline/service-worker";
import { saveFile } from "../save-file";

/** Keeps this lesson on the device, with its cleared visuals and credits, for use offline (#116). */
export function SaveOffline({
  lessonId,
  version,
  store = devicePacks,
}: {
  lessonId: string;
  version: number;
  store?: PackStore;
}) {
  const t = useT("offline");
  const save = useMutation({
    mutationFn: async (): Promise<{ pack: LessonPack; stored: boolean }> => {
      const pack = await api("exportLessonPack", { lessonId, version });
      // A browser that refuses storage still gets the pack, as a file to download.
      const stored = await store.save(pack).then(
        () => true,
        () => false,
      );
      await enableOffline().catch(() => undefined);
      return { pack, stored };
    },
  });

  return (
    <div className="save-offline">
      <Button variant="quiet" size="small" disabled={save.isPending} onClick={() => save.mutate()}>
        {save.isPending ? t("saving") : t("saveButton")}
      </Button>
      {save.data ? (
        <p role="status">
          {save.data.stored ? (
            <>
              {t("savedStatus")} <Link href="/offline">{t("seeSaved")}</Link>{" "}
            </>
          ) : (
            <>{t("unavailable")} </>
          )}
          <Button
            variant="quiet"
            size="small"
            onClick={() => saveFile(packFileName(save.data.pack), save.data.pack)}
          >
            {t("download")}
          </Button>
        </p>
      ) : null}
      {save.isError ? <p role="alert">{t("saveFailed")}</p> : null}
    </div>
  );
}
