import { Logger } from "@nestjs/common";

export interface Email {
  to: string;
  toName: string;
  subject: string;
  text: string;
  html: string;
}

export type Mailer = (email: Email) => Promise<void>;

export interface ZeptoMailConfig {
  apiUrl: string;
  token: string;
  from: string;
  fromName: string;
}

const escape = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Sends through ZeptoMail's v1.1 email API. */
export function createZeptoMailer(config: ZeptoMailConfig, fetcher: typeof fetch = fetch): Mailer {
  return async (email) => {
    const response = await fetcher(config.apiUrl, {
      body: JSON.stringify({
        from: { address: config.from, name: config.fromName },
        htmlbody: email.html,
        subject: email.subject,
        textbody: email.text,
        to: [{ email_address: { address: email.to, name: email.toName } }],
      }),
      headers: {
        accept: "application/json",
        authorization: `Zoho-enczapikey ${config.token}`,
        "content-type": "application/json",
      },
      method: "POST",
    });
    if (!response.ok) {
      throw new Error(`ZeptoMail refused the email: ${response.status}.`);
    }
  };
}

// Local development has no mail account, so the link is printed for the developer to open.
export function createLogMailer(logger = new Logger("Mailer")): Mailer {
  return async (email) => {
    logger.log(`Email to ${email.to} — ${email.subject}\n${email.text}`);
  };
}

/** One plain message with one button-style link; kept simple so every mail client shows it. */
export function linkEmail(
  to: { email: string; name: string },
  subject: string,
  intro: string,
  action: string,
  url: string,
  outro: string,
): Email {
  return {
    html: `<p>Hi ${escape(to.name)},</p><p>${escape(intro)}</p><p><a href="${escape(url)}">${escape(action)}</a></p><p>${escape(outro)}</p><p>Science Behind It</p>`,
    subject,
    text: `Hi ${to.name},\n\n${intro}\n\n${action}: ${url}\n\n${outro}\n\nScience Behind It`,
    to: to.email,
    toName: to.name,
  };
}
