// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "../api-client";
import { button, click, mount, text } from "../lesson/dom-test";

const api = vi.hoisted(() => vi.fn());
const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("../api", () => ({ api }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("../../env", () => ({ webEnv: { apiUrl: "http://api.test" } }));

const { AccountPanel } = await import("./account-panel");
const { hasConsent, rememberKeptPhoto, setConsent } = await import("../consent");

const ADA = {
  accountId: "0192f1a0-0000-7000-8000-000000000001",
  email: "ada@example.com",
  emailVerified: true,
  firstName: "Ada",
  lastName: "Lovelace",
  linkedAt: null as string | null,
};

afterEach(() => {
  document.body.replaceChildren();
  window.localStorage.clear();
  api.mockReset();
  router.replace.mockReset();
});

const view = () =>
  mount(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <AccountPanel />
    </QueryClientProvider>,
  );

// Buttons render before the account loads; clicking one early would do nothing.
const enabled = (scope: Element, name: string) =>
  vi.waitFor(() => {
    const found = button(scope, name);
    expect(found.disabled).toBe(false);
    return found;
  });

describe("AccountPanel", () => {
  it("sends a signed-out learner to the sign-in page", async () => {
    api.mockRejectedValue(new ApiRequestError("Sign in to use your account.", 401));
    await view();
    await vi.waitFor(() => expect(router.replace).toHaveBeenCalledWith("/account/sign-in"));
  });

  it("asks for a confirmed email before linking, and can resend the link", async () => {
    api.mockImplementation(async (name: string) =>
      name === "getAccount" ? { ...ADA, emailVerified: false } : { ok: true },
    );
    const { container } = await view();
    await vi.waitFor(() => expect(text(container)).toContain("Please confirm your email."));
    expect(button(container, "Link this device").disabled).toBe(true);

    await click(button(container, "Send the link again"));
    await vi.waitFor(() => expect(text(container)).toContain("Link sent"));
    expect(api).toHaveBeenCalledWith("resendVerification", {});
  });

  it("links this device only when asked, sending the consent and kept photos", async () => {
    rememberKeptPhoto({ key: "photos/a.jpg", label: "Kettle", keptAt: "2026-11-02T10:00:00.000Z" });
    let linkedAt: string | null = null;
    api.mockImplementation(async (name: string) => {
      if (name === "getAccount") return { ...ADA, linkedAt };
      linkedAt = "2026-11-02T10:00:00.000Z";
      return { accountId: ADA.accountId, linkedPhotos: 1 };
    });
    const { container } = await view();
    const link = await enabled(container, "Link this device");
    expect(text(container)).toContain("Signed in as Ada Lovelace (ada@example.com).");
    expect(hasConsent("account")).toBe(false);

    await click(link);

    await vi.waitFor(() =>
      expect(text(container)).toContain("On. This device's photos are tied to your account."),
    );
    expect(api).toHaveBeenCalledWith("linkAccount", {
      consent: expect.objectContaining({ choices: expect.objectContaining({ account: true }) }),
      photoKeys: ["photos/a.jpg"],
    });
    expect(hasConsent("account")).toBe(true);
  });

  it("takes the choice back if linking fails", async () => {
    api.mockImplementation(async (name: string) => {
      if (name === "getAccount") return ADA;
      throw new Error("Linking failed.");
    });
    const { container } = await view();
    await click(await enabled(container, "Link this device"));
    await vi.waitFor(() => expect(text(container)).toContain("Linking failed."));
    expect(hasConsent("account")).toBe(false);
  });

  it("unlinks and withdraws the choice", async () => {
    setConsent("account", true);
    let linkedAt: string | null = "2026-11-02T10:00:00.000Z";
    api.mockImplementation(async (name: string) => {
      if (name === "getAccount") return { ...ADA, linkedAt };
      linkedAt = null;
      return { unlinkedPhotos: 1 };
    });
    const { container } = await view();
    await click(await enabled(container, "Unlink this device"));
    await vi.waitFor(() => expect(text(container)).toContain("Off. Keep this device's photos"));
    expect(hasConsent("account")).toBe(false);
  });

  it("keeps the linking note short, with the full explanation behind the info icon", async () => {
    api.mockImplementation(async (name: string) => (name === "getAccount" ? ADA : { ok: true }));
    const { container } = await view();
    const info = await vi.waitFor(() => {
      const found = container.querySelector<HTMLButtonElement>(
        'button[aria-label="More about Link this device"]',
      );
      expect(found).not.toBeNull();
      return found as HTMLButtonElement;
    });
    const dialog = info.nextElementSibling as HTMLDialogElement;
    expect(dialog.open).toBe(false);

    await click(info);

    expect(dialog.open).toBe(true);
    expect(text(dialog)).toContain("clearing this browser does not leave them behind");
  });

  it("signs out and returns to the sign-in page", async () => {
    api.mockImplementation(async (name: string) =>
      name === "getAccount" ? ADA : name === "savedLessons" ? { lessons: [] } : { ok: true },
    );
    const { container } = await view();
    await click(await enabled(container, "Sign out"));
    await vi.waitFor(() => expect(router.replace).toHaveBeenCalledWith("/account/sign-in"));
    expect(api).toHaveBeenCalledWith("signOut", {});
  });

  it("shows a learner's latest saved lessons and a way in to teaching tools", async () => {
    const lessons = Array.from({ length: 7 }, (_, index) => ({
      lessonId: `0192f1a0-0000-7000-8000-00000000010${index}`,
      savedAt: "2026-11-02T10:00:00.000Z",
      sharedAt: null,
      title: `Lesson ${index + 1}`,
      version: 1,
    }));
    api.mockImplementation(async (name: string) =>
      name === "getAccount" ? ADA : name === "savedLessons" ? { lessons } : { ok: true },
    );
    const { container } = await view();

    await vi.waitFor(() => expect(text(container)).toContain("Lesson 5"));
    expect(text(container)).not.toContain("Lesson 6");
    expect(text(container)).toContain("See all 7 saved lessons");
    expect(text(container)).toContain("Turn on teaching tools");
    expect(text(container)).not.toContain("Your classes");
    expect(container.querySelector('a[href^="/lesson/saved/edit"]')).toBeNull();
  });

  it("gives a teacher a classes overview and an edit link on each saved lesson", async () => {
    const lesson = {
      lessonId: "0192f1a0-0000-7000-8000-000000000100",
      savedAt: "2026-11-02T10:00:00.000Z",
      sharedAt: null,
      title: "Kettles",
      version: 1,
    };
    const physics = {
      archivedAt: null,
      classId: "0192f1a0-0000-7000-8000-0000000000e1",
      codeHint: "PX",
      controls: { audienceLock: null, blockedCategories: [], tutorEnabled: true },
      createdAt: "2026-11-08T09:00:00.000Z",
      curriculum: null,
      lessons: [{ lessonId: lesson.lessonId, title: "Kettles", version: 1 }],
      level: null,
      name: "SSS2 Physics",
    };
    const replies: Record<string, unknown> = {
      classSummary: {
        minCount: 5,
        totals: { check_answered: 0, check_correct: 0, lesson_opened: 3, visual_used: 0 },
        weeks: [
          {
            counts: { check_answered: 0, check_correct: 0, lesson_opened: null, visual_used: 0 },
            week: "2026-W45",
          },
        ],
      },
      classes: {
        classes: [
          physics,
          {
            ...physics,
            archivedAt: "2026-11-08T10:00:00.000Z",
            classId: "0192f1a0-0000-7000-8000-0000000000e2",
            name: "Old class",
          },
        ],
        educator: true,
      },
      getAccount: { ...ADA, educator: true },
      savedLessons: { lessons: [lesson] },
    };
    api.mockImplementation(async (name: string) => replies[name] ?? { ok: true });
    const { container } = await view();

    await vi.waitFor(() =>
      expect(text(container)).toContain("Week 2026-W45: fewer than 5 lessons opened"),
    );
    expect(text(container)).toContain("SSS2 Physics");
    expect(text(container)).toContain("Code ends in PX");
    expect(text(container)).toContain("1 lesson");
    expect(text(container)).not.toContain("Old class");
    expect(text(container)).not.toContain("Turn on teaching tools");
    expect(
      container.querySelector(`a[href="/lesson/saved/edit?id=${lesson.lessonId}"]`),
    ).not.toBeNull();

    await click(button(container, "New class"));
    expect(container.querySelector("#teach-create")).not.toBeNull();
  });
});

describe("OfflineSection", () => {
  it("lists packs on this device and hides when there are none", async () => {
    const { OfflineSection } = await import("./dashboard/offline-section");
    const { memoryPacks } = await import("../offline/packs");
    const { TEST_PACK } = await import("../offline/offline-test-pack");
    const empty = await mount(<OfflineSection store={memoryPacks()} />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(text(empty.container)).toBe("");

    const store = memoryPacks();
    await store.save(TEST_PACK);
    const { container } = await mount(<OfflineSection store={store} />);
    await vi.waitFor(() => expect(text(container)).toContain(TEST_PACK.lesson.title));
    expect(text(container)).toContain("On this device");
  });
});

describe("TutorChatsSection", () => {
  it("reads a conversation back in place, and shows nothing without one", async () => {
    const { TutorChatsSection } = await import("./dashboard/tutor-chats-section");
    const exchange = (turnId: string, userText: string, text: string) => ({
      citedClaimIds: [],
      createdAt: "2026-11-07T10:00:00.000Z",
      kind: "lesson",
      text,
      turnId,
      userText,
    });
    const wrap = (node: React.ReactNode) => (
      <QueryClientProvider client={new QueryClient()}>{node}</QueryClientProvider>
    );

    api.mockResolvedValue({ conversations: [] });
    const empty = await mount(wrap(<TutorChatsSection />));
    await vi.waitFor(() =>
      expect(api).toHaveBeenCalledWith("tutorConversations", { locale: "en" }),
    );
    expect(text(empty.container)).toBe("");
    document.body.replaceChildren();

    api.mockResolvedValue({
      conversations: [
        {
          exchanges: [
            exchange(
              "0192f1a0-0000-7000-8000-0000000000c1",
              "Why does it whistle?",
              "Steam squeezes through the spout.",
            ),
            exchange(
              "0192f1a0-0000-7000-8000-0000000000c2",
              "Why is it loud?",
              "The hole is small.",
            ),
          ],
          lastAskedAt: "2026-11-07T10:00:00.000Z",
          lessonId: "0192f1a0-0000-7000-8000-000000000100",
          lessonTitle: "Why a kettle whistles",
        },
      ],
    });
    const { container } = await mount(wrap(<TutorChatsSection />));
    await vi.waitFor(() => expect(text(container)).toContain("Why a kettle whistles"));
    expect(text(container)).toContain("2 questions, last on 7 Nov 2026");
    expect(text(container)).toContain("Steam squeezes through the spout.");
    expect(container.querySelector("details")?.open).toBe(false);
  });
});
