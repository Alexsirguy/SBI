"use client";

import { Disclosure } from "@sbi/ui";
import { useMemo } from "react";
import { INTL_LOCALE } from "../../i18n/locales";
import { useLocale, useT } from "../../i18n/provider";
import { useTutorConversations } from "../use-tutor-conversations";

const SHOWN = 5;

/** Read back in place: lessons open by subject, so there is no page to send a conversation to. */
export function TutorChatsSection() {
  const t = useT("account");
  const locale = useLocale();
  const date = useMemo(
    () => new Intl.DateTimeFormat(INTL_LOCALE[locale], { dateStyle: "medium" }),
    [locale],
  );
  const conversations = useTutorConversations();
  // Nothing to say until there is a conversation, and a failure here shouldn't crowd the page.
  if (!conversations.data || conversations.data.length === 0) return null;

  return (
    <section className="account-card account-chats" aria-labelledby="account-chats">
      <h2 id="account-chats">{t("chatsHeading")}</h2>
      <p className="account-card__hint">{t("chatsIntro")}</p>
      <ul className="account-chats__list">
        {conversations.data.slice(0, SHOWN).map((chat) => (
          <li key={chat.lessonId}>
            <Disclosure
              summary={
                <span className="account-chats__summary">
                  <span className="account-chats__title">
                    {chat.lessonTitle ?? t("chatsUnknownLesson")}
                  </span>
                  <span className="account-chats__meta">
                    {t(chat.exchanges.length === 1 ? "chatsCountOne" : "chatsCountOther", {
                      count: chat.exchanges.length,
                      date: date.format(new Date(chat.lastAskedAt)),
                    })}
                  </span>
                </span>
              }
            >
              <ol className="account-chats__exchanges">
                {chat.exchanges.map((exchange) => (
                  <li key={exchange.turnId}>
                    <p className="account-chats__question">{exchange.userText}</p>
                    <p>{exchange.text}</p>
                  </li>
                ))}
              </ol>
            </Disclosure>
          </li>
        ))}
      </ul>
    </section>
  );
}
