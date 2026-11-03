import { setFallbackMessages } from "./i18n/provider";
import en from "./i18n/messages/en";

// Components render in English under test unless a test wraps them in another language.
setFallbackMessages(en);
