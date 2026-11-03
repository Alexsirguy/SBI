import type { Messages } from "../../messages";
import account from "./account.json";
import capture from "./capture.json";
import common from "./common.json";
import lesson from "./lesson.json";
import site from "./site.json";

// Typed against English, so a missing or extra key fails the build.
const es: Messages = { account, capture, common, lesson, site };

export default es;
