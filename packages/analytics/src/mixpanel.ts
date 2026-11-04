import type { Mixpanel } from "mixpanel-browser/dist/mixpanel-core.cjs.js";
import type { BrowserSink } from "./tracker";

export const MIXPANEL_EU_HOST = "https://api-eu.mixpanel.com";

// The core build leaves out session replay, which we never use and which is most of the weight.
const loadMixpanel = async (): Promise<Mixpanel> =>
  (await import("mixpanel-browser/dist/mixpanel-core.cjs.js")).default;

/**
 * Sends to Mixpanel's EU endpoint with one random ID per visit (ADR 0026).
 * Loads the library on the first event, so learners who never consent never download it.
 */
export function createMixpanelSink(options: {
  token: string;
  visitId: () => string;
  load?: () => Promise<Mixpanel>;
}): BrowserSink {
  let ready: Promise<Mixpanel | undefined> | undefined;
  const start = () =>
    (ready ??= (options.load ?? loadMixpanel)()
      .then((mixpanel) => {
        mixpanel.init(options.token, {
          api_host: MIXPANEL_EU_HOST,
          ip: false,
          autocapture: false,
          track_pageview: false,
          disable_persistence: true,
          // Batching queues events in localStorage, which would outlive the visit.
          batch_requests: false,
          // Lesson URLs carry the learner's typed question.
          property_blacklist: [
            "$current_url",
            "$referrer",
            "$initial_referrer",
            "$referring_domain",
          ],
        });
        mixpanel.identify(options.visitId());
        return mixpanel;
      })
      .catch(() => undefined));

  return {
    send(name, props) {
      void start().then((mixpanel) => mixpanel?.track(name, props));
    },
    reset() {
      void ready?.then((mixpanel) => mixpanel?.reset());
      ready = undefined;
    },
  };
}
