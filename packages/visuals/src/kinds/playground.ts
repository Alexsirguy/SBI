import { kindRenderer } from "../kind";

// Long enough for a slow phone to parse the frame, short enough not to leave a blank box.
const READY_WITHIN_MS = 5000;

/**
 * AI-written canvas code in a sandboxed frame: no same origin, no network, no eval (ADR 0014).
 * The API serves the frame, so it carries its own CSP instead of inheriting the lesson's.
 */
export const createPlaygroundRenderer = ({
  documentUrl,
}: {
  documentUrl: (visualId: string) => string;
}) =>
  kindRenderer({
    kind: "playground",
    async draw(manifest, stage, values, options) {
      const document = stage.ownerDocument;
      const window = document.defaultView;
      const frame = document.createElement("iframe");
      frame.className = "visual-playground";
      // allow-scripts only: an opaque origin, with no forms, popups or top-level navigation.
      frame.setAttribute("sandbox", "allow-scripts");
      frame.setAttribute("referrerpolicy", "no-referrer");
      frame.title = manifest.alt;
      frame.src = documentUrl(manifest.visualId);

      let current = { ...values };
      let playing = !options.reducedMotion;
      const send = () => frame.contentWindow?.postMessage({ values: current, playing }, "*");
      const play = document.createElement("button");
      play.type = "button";
      play.className = "sbi-button sbi-button--quiet sbi-button--small";
      const showState = () => {
        play.textContent = playing ? "Pause" : "Play";
        play.setAttribute("aria-pressed", String(playing));
      };
      play.addEventListener("click", () => {
        playing = !playing;
        showState();
        send();
      });
      showState();
      const buttons = document.createElement("div");
      buttons.className = "visual-mechanism__buttons";
      buttons.append(play);

      let ready = false;
      let loads = 0;
      const stop = () => {
        window?.removeEventListener("message", onMessage);
        clearTimeout(timer);
      };
      // The explanation stays: a failed playground leaves the text a learner can still read.
      const fail = () => {
        stop();
        if (!frame.isConnected) return;
        frame.remove();
        buttons.remove();
        const note = document.createElement("p");
        note.className = "visual-layer__note";
        note.textContent = `This picture could not run. ${manifest.fallback.text}`;
        stage.append(note);
      };
      function onMessage(event: MessageEvent) {
        // Only our own frame counts, and it may only say it is ready or that it failed.
        if (event.source !== frame.contentWindow) return;
        const type = (event.data as { type?: unknown } | null)?.type;
        if (type === "ready") {
          ready = true;
          clearTimeout(timer);
        } else if (type === "error") fail();
      }
      window?.addEventListener("message", onMessage);
      frame.addEventListener("load", () => {
        loads += 1;
        // A second load means the code navigated its own frame somewhere else.
        if (loads > 1) fail();
        else send();
      });
      const timer = setTimeout(() => {
        if (!ready) fail();
      }, READY_WITHIN_MS);
      options.signal?.addEventListener("abort", stop);

      stage.append(frame, buttons);
      return {
        update(next) {
          current = { ...next };
          send();
        },
        destroy() {
          stop();
          frame.remove();
          buttons.remove();
        },
      };
    },
  });
