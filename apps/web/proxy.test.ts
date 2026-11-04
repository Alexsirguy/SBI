import { describe, expect, it } from "vitest";
import { lessonCsp } from "./proxy";

const connect = (csp: string) => csp.split("; ").find((part) => part.startsWith("connect-src"));

describe("lessonCsp", () => {
  it("lets the lesson reach only our API while no Mixpanel project is set", () => {
    expect(connect(lessonCsp("n", "http://api.test/x"))).toBe("connect-src 'self' http://api.test");
  });

  it("adds Mixpanel's EU host, and no other, once a token is set (ADR 0026)", () => {
    expect(connect(lessonCsp("n", "http://api.test", "token"))).toBe(
      "connect-src 'self' http://api.test https://api-eu.mixpanel.com",
    );
  });
});
