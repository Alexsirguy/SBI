/** Hands the learner a JSON file to keep, without a round trip to the server. */
export function saveFile(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const link = Object.assign(document.createElement("a"), { download: name, href: url });
  link.click();
  URL.revokeObjectURL(url);
}
