import "./disclaimer-ack.css";

export const DISCLAIMER_ACK_KEY = "etq:disclaimer:ack:v1";

const NOTICE_TEXT =
  "ETQ is a self-help planning tool, not financial advice. It does not assess your circumstances or recommend any course of action. Speak to a qualified professional before acting on a projection.";

export function hasDisclaimerAck(): boolean {
  try {
    return window.localStorage.getItem(DISCLAIMER_ACK_KEY) !== null;
  } catch {
    return false;
  }
}

export function setDisclaimerAck(): void {
  try {
    window.localStorage.setItem(DISCLAIMER_ACK_KEY, new Date().toISOString());
  } catch {
    /* ignore quota errors */
  }
}

export function clearDisclaimerAck(): void {
  try {
    window.localStorage.removeItem(DISCLAIMER_ACK_KEY);
  } catch {
    /* ignore */
  }
}

export interface FirstVisitNoticeOptions {
  text?: string;
  disclaimerHref?: string;
  acceptLabel?: string;
}

export function mountFirstVisitNotice(parent: HTMLElement, options: FirstVisitNoticeOptions = {}): HTMLElement | null {
  if (hasDisclaimerAck()) return null;
  const text = options.text ?? NOTICE_TEXT;
  const disclaimerHref = options.disclaimerHref ?? "disclaimer.html#disclaimer";
  const acceptLabel = options.acceptLabel ?? "Got it";

  const strip = document.createElement("aside");
  strip.className = "first-visit-notice";
  strip.setAttribute("role", "note");
  strip.setAttribute("aria-label", "First-visit notice");
  strip.setAttribute("data-first-visit-notice", "");

  const message = document.createElement("p");
  message.className = "first-visit-notice-text";
  message.textContent = `${text} `;
  const link = document.createElement("a");
  link.href = disclaimerHref;
  link.textContent = "Read the full disclaimer.";
  message.appendChild(link);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "first-visit-notice-accept";
  button.textContent = acceptLabel;

  strip.appendChild(message);
  strip.appendChild(button);

  const dismiss = (): void => {
    setDisclaimerAck();
    strip.classList.add("is-dismissing");
    window.setTimeout(() => strip.remove(), 220);
  };

  button.addEventListener("click", dismiss);

  parent.prepend(strip);
  return strip;
}
