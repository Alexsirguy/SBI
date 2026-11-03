// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { button, click, find, mount, text } from "../lesson/dom-test";

const { PhotoNotes } = await import("./photo-notes");

afterEach(() => document.body.replaceChildren());

const view = () =>
  mount(
    <PhotoNotes
      heading="How your photo is handled"
      items={["Faces are blurred.", "Deleted in 7 days."]}
    />,
  );

describe("PhotoNotes", () => {
  it("starts folded on small screens, with the toggle naming the list it opens", async () => {
    const { container } = await view();
    const toggle = button(container, "Show details");
    const list = find(container, "ul");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.getAttribute("aria-controls")).toBe(list.id);
    expect(find(container, "section").className).not.toContain("privacy-cue--open");
    // Folding is drawn by a narrow-screen rule, so the notes stay in the page for wide screens.
    expect(text(list)).toContain("Deleted in 7 days.");
  });

  it("opens and folds again from the same toggle", async () => {
    const { container } = await view();
    await click(button(container, "Show details"));
    expect(find(container, "section").className).toContain("privacy-cue--open");
    expect(button(container, "Hide details").getAttribute("aria-expanded")).toBe("true");
    await click(button(container, "Hide details"));
    expect(button(container, "Show details").getAttribute("aria-expanded")).toBe("false");
  });
});
