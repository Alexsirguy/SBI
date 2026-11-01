import { expect, test } from "@playwright/test";
import { GALLERY_FIXTURES } from "@sbi/visuals";
import { playgroundDocument } from "@sbi/visuals/playground-document";

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const rainbow = GALLERY_FIXTURES.find((item) => item.kind === "playground");

// Code the static check would refuse, served anyway, to prove the frame holds without it.
const ESCAPE = `kit.onFrame(() => {});
let storage = "blocked";
try { localStorage.setItem("x", "1"); storage = "open"; } catch {}
let page = "blocked";
try { page = String(parent.document.title); } catch {}
try { fetch("https://evil.example/fetch").catch(() => {}); } catch {}
try { new Image().src = "https://evil.example/image"; } catch {}
try { top.location.href = "https://evil.example/top"; } catch {}
parent.postMessage({ type: "error", message: "storage " + storage + ", page " + page }, "*");`;

test("a playground that slips past the code check still cannot reach the page, network or tab", async ({
  page,
}) => {
  const leaks: string[] = [];
  await page.route("https://evil.example/**", (route) => {
    leaks.push(route.request().url());
    return route.fulfill({ status: 200, body: "" });
  });
  await page.route(`${API_URL}/playgrounds?*`, async (route) => {
    const { html, csp } = await playgroundDocument(ESCAPE, {
      frameAncestors: [new URL(page.url()).origin],
    });
    return route.fulfill({
      status: 200,
      body: html,
      headers: { "content-type": "text/html; charset=utf-8", "content-security-policy": csp },
    });
  });
  await page.addInitScript(() => {
    const seen: unknown[] = [];
    Object.assign(window, { seenMessages: seen });
    window.addEventListener("message", (event) => seen.push(event.data));
  });

  await page.goto("/visuals");
  const figure = page.getByRole("figure", { name: rainbow?.alt ?? "" });
  await expect(figure).toContainText("This picture could not run.");
  const messages = await page.evaluate(
    () => (window as unknown as { seenMessages: unknown[] }).seenMessages,
  );
  expect(messages).toContainEqual({ type: "error", message: "storage blocked, page blocked" });
  expect(page.url()).toMatch(/\/visuals$/);
  expect(leaks).toEqual([]);
});

test("the lesson page sends a CSP that loads only its own scripts and frames only the API", async ({
  page,
}) => {
  const response = await page.goto("/lesson?label=Kettle");
  const csp = response?.headers()["content-security-policy"] ?? "";
  expect(csp).toContain("default-src 'self'");
  expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  expect(csp).toContain(`frame-src ${new URL(API_URL).origin}`);
  expect(csp).toContain("frame-ancestors 'none'");
});
