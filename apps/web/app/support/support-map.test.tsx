// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mount, text } from "../lesson/dom-test";

const api = vi.hoisted(() => vi.fn());
vi.mock("../api", () => ({ api }));

const { SupportMapView } = await import("./support-map");

afterEach(() => {
  document.body.replaceChildren();
  api.mockReset();
});

describe("SupportMapView", () => {
  it("shows on-demand reach and the catalogue, with marks in words", async () => {
    api.mockResolvedValue({
      catalogueObjects: 2,
      categories: [
        {
          id: "category.fungi",
          label: "Fungi",
          objects: [
            { curated: true, id: "object.mushroom", label: "Mushroom", safetyNotice: true },
          ],
        },
        {
          id: "category.mechanisms",
          label: "Machines and mechanisms",
          objects: [
            { curated: false, id: "object.car-engine", label: "Car engine", safetyNotice: false },
          ],
        },
      ],
      onDemandSubjects: 12,
    });
    const { container } = await mount(
      <QueryClientProvider client={new QueryClient()}>
        <SupportMapView />
      </QueryClientProvider>,
    );

    await vi.waitFor(() => expect(text(container)).toContain("12 subjects outside our catalogue"));
    expect(text(container)).toContain("These 2 objects have extra care");
    expect(text(container)).toContain("Mushroom checked facts safety notice");
    expect(api).toHaveBeenCalledWith("supportMap", { locale: "en" });
  });
});
