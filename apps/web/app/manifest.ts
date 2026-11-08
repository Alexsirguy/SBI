import type { MetadataRoute } from "next";

// Makes the site installable (ADR 0028); saved lessons then open from the home screen offline.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Science Behind It",
    short_name: "Science Behind It",
    description: "The science of everyday objects, from what you can see to why it works.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f1ea",
    theme_color: "#0b6a64",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
