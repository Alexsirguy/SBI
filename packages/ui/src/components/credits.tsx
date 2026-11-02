/** One asset's credit, as `AssetCredit` in @sbi/contracts; the UI package keeps no schema of its own. */
export interface Credit {
  assetId: string;
  text: string;
  itemUrl?: string;
  license: { label: string; url?: string };
  shareAlike: boolean;
  changes?: string;
}

const external = { rel: "noopener noreferrer", target: "_blank" } as const;

/** The credits a picture's licences require: who made it, its page, its licence and what changed. */
export function AssetCredits({ credits }: { credits: readonly Credit[] }) {
  if (credits.length === 0) return null;
  const shared = [...new Set(credits.filter((c) => c.shareAlike).map((c) => c.license.label))];
  return (
    <div className="sbi-credits">
      <p className="sbi-credits__title">Credits</p>
      <ul>
        {credits.map((credit) => (
          <li key={credit.assetId}>
            {credit.itemUrl ? (
              <a href={credit.itemUrl} {...external}>
                {credit.text}
              </a>
            ) : (
              credit.text
            )}
            {credit.license.url ? (
              <>
                {" "}
                (
                <a href={credit.license.url} {...external}>
                  licence
                </a>
                )
              </>
            ) : null}
            {credit.changes ? (
              <span className="sbi-credits__changes"> {credit.changes}</span>
            ) : null}
          </li>
        ))}
      </ul>
      {shared.length > 0 ? (
        <p className="sbi-credits__share-alike">
          Share alike: if you reuse or adapt this, you must share it under {shared.join(" or ")}{" "}
          too.
        </p>
      ) : null}
    </div>
  );
}
