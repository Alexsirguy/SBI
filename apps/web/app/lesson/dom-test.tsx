import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";

// React only flushes updates inside act() when it knows it is under test.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Renders into a fresh element in happy-dom; tests read the DOM as a learner would. */
export async function mount(ui: ReactNode) {
  const container = document.body.appendChild(document.createElement("div"));
  const root = createRoot(container);
  await act(async () => root.render(ui));
  return {
    container,
    unmount: () => act(() => root.unmount()),
  };
}

export const text = (element: Element) => (element.textContent ?? "").replace(/\s+/g, " ").trim();

/** The button whose accessible text (visually hidden parts included) is `name`. */
export function button(scope: Element, name: string | RegExp): HTMLButtonElement {
  const found = [...scope.querySelectorAll("button")].find((item) =>
    typeof name === "string" ? text(item) === name : name.test(text(item)),
  );
  if (!found) throw new Error(`no button named ${String(name)}`);
  return found;
}

export function radio(scope: Element, label: string): HTMLInputElement {
  const found = [...scope.querySelectorAll("label")].find((item) => text(item) === label);
  const input = found?.querySelector<HTMLInputElement>('input[type="radio"]');
  if (!input) throw new Error(`no radio labelled ${label}`);
  return input;
}

export const click = (element: HTMLElement) => act(async () => element.click());

export function find(scope: Element, selector: string): Element {
  const found = scope.querySelector(selector);
  if (!found) throw new Error(`nothing matches ${selector}`);
  return found;
}
