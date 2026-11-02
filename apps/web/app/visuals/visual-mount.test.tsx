// @vitest-environment happy-dom
import { newId, VisualManifest } from "@sbi/contracts";
import type { VisualRegistry } from "@sbi/visuals";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mount, text } from "../lesson/dom-test";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://api.test";
});

const { VisualMount } = await import("./visual-mount");

const registry: VisualRegistry = {
  resolve: async () => {
    throw new Error("unused");
  },
  // Drawing is the renderers' job and tested there; these tests read only the figure around it.
  mount: () => new Promise(() => undefined),
};

const manifest = VisualManifest.parse({
  visualId: newId(),
  kind: "molecule",
  alt: "A water molecule",
  fallback: { text: "One oxygen atom bonded to two hydrogen atoms." },
});

afterEach(() => document.body.replaceChildren());

describe("VisualMount", () => {
  it("credits each third-party asset with its page and licence, and share-alike terms", async () => {
    const { container } = await mount(
      <VisualMount
        registry={registry}
        manifest={{
          ...manifest,
          credits: [
            {
              assetId: newId(),
              text: "Water molecule by A. Chemist, CC BY-SA 4.0",
              itemUrl: "https://commons.wikimedia.org/wiki/File:Water.png",
              license: {
                label: "CC BY-SA 4.0",
                url: "https://creativecommons.org/licenses/by-sa/4.0/",
              },
              shareAlike: true,
            },
          ],
        }}
      />,
    );
    const credits = container.querySelector(".sbi-credits");
    expect(credits && text(credits)).toContain("Water molecule by A. Chemist, CC BY-SA 4.0");
    expect(
      container.querySelector('a[href="https://commons.wikimedia.org/wiki/File:Water.png"]'),
    ).not.toBeNull();
    expect(text(container)).toContain("share it under CC BY-SA 4.0 too");
  });

  it("shows no credits for a visual made entirely by us", async () => {
    const { container } = await mount(<VisualMount registry={registry} manifest={manifest} />);
    expect(container.querySelector(".sbi-credits")).toBeNull();
  });
});
