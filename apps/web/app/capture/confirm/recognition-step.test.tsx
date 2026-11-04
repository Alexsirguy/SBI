// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { button, click, mount } from "../../lesson/dom-test";

const track = vi.hoisted(() => vi.fn());
vi.mock("../../analytics/track", () => ({ track }));
vi.mock("../../api", () => ({ api: vi.fn(() => new Promise(() => undefined)) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const { RecognitionStep } = await import("./recognition-step");

const reply = {
  resultId: "0192f1a0-0000-7000-8000-000000000001",
  sessionId: "0192f1a0-0000-7000-8000-000000000002",
  candidates: [],
  otherLabels: [],
  options: [
    { label: "Kettle", certainty: "likely" as const },
    { label: "Teapot", certainty: "possible" as const },
  ],
  next: { kind: "confirm" },
} as never;

const view = () =>
  mount(
    <QueryClientProvider client={new QueryClient()}>
      <RecognitionStep reply={reply} onStart={vi.fn()} onRetake={vi.fn()} />
    </QueryClientProvider>,
  );

afterEach(() => {
  document.body.replaceChildren();
  track.mockReset();
});

describe("RecognitionStep usage events", () => {
  it("sends which option was picked by rank and certainty, never its words", async () => {
    const { container } = await view();
    await click(button(container, /Teapot/));
    expect(track).toHaveBeenCalledWith("recognition_confirmed", { rank: 1, certainty: "possible" });
    expect(JSON.stringify(track.mock.calls)).not.toContain("Teapot");
  });

  it("counts naming it yourself as a correction, without the name", async () => {
    const { container } = await view();
    const input = container.querySelector<HTMLInputElement>('input[name="object-query"]');
    if (!input) throw new Error("no describe field");
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setValue?.call(input, "Samovar");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await click(button(container, "Use this"));
    expect(track).toHaveBeenCalledWith("recognition_corrected", { correctionClass: "described" });
    expect(JSON.stringify(track.mock.calls)).not.toContain("Samovar");
  });
});
