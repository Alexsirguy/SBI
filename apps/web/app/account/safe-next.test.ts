import { describe, expect, it, vi } from "vitest";

vi.mock("../api", () => ({ api: vi.fn() }));

const { safeNext } = await import("./use-account");

describe("safeNext", () => {
  it("keeps paths on this site, query and hash included", () => {
    expect(safeNext("/lesson?label=Kettle&depth=explore")).toBe(
      "/lesson?label=Kettle&depth=explore",
    );
    expect(safeNext("/account/lessons#top")).toBe("/account/lessons#top");
  });

  it.each([
    "//evil.example",
    "/\\evil.example",
    "/\tevil.example",
    "/ /evil",
    "https://evil.example",
    "javascript:alert(1)",
    "",
    null,
  ])("refuses %j", (value) => {
    expect(safeNext(value)).toBe("/account");
  });
});

describe("forgetAccountData", () => {
  it("drops every cached account query, saved lessons included", async () => {
    const { QueryClient } = await import("@tanstack/react-query");
    const { ACCOUNT_KEY, forgetAccountData } = await import("./use-account");
    const client = new QueryClient();
    client.setQueryData(ACCOUNT_KEY, { email: "a@example.com" });
    client.setQueryData(["account", "saved-lessons"], [{ title: "A's lesson" }]);
    client.setQueryData(["account", "saved-lesson", "x"], { title: "A's lesson" });
    client.setQueryData(["related", "x", 1], { related: [] });

    forgetAccountData(client);

    expect(client.getQueryData(["account", "saved-lessons"])).toBeUndefined();
    expect(client.getQueryData(["account", "saved-lesson", "x"])).toBeUndefined();
    expect(client.getQueryData(ACCOUNT_KEY)).toBeUndefined();
    expect(client.getQueryData(["related", "x", 1])).toBeDefined();
  });
});
