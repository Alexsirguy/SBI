import nextPlugin from "@next/eslint-plugin-next";
import react from "./react.js";

export default [...react, nextPlugin.configs["core-web-vitals"]];
