import "./storage-disclosures.css";

export const SAVE_INFO_SEEN_KEY = "etq:disclaimer:save-info-seen:v1";

export function hasSaveInfoSeen(): boolean {
  try {
    return window.localStorage.getItem(SAVE_INFO_SEEN_KEY) !== null;
  } catch {
    return false;
  }
}

export function setSaveInfoSeen(): void {
  try {
    window.localStorage.setItem(SAVE_INFO_SEEN_KEY, new Date().toISOString());
  } catch {
    /* ignore */
  }
}

export function clearSaveInfoSeen(): void {
  try {
    window.localStorage.removeItem(SAVE_INFO_SEEN_KEY);
  } catch {
    /* ignore */
  }
}

export interface RestoreToastOptions {
  message?: string;
  forgetLabel?: string;
  onForget?: () => void;
  durationMs?: number;
}

const DEFAULT_RESTORE_MESSAGE = "Restored your previous session from this browser.";
const DEFAULT_FORGET_LABEL = "Forget";
const DEFAULT_RESTORE_DURATION_MS = 6000;

let activeToast: HTMLElement | null = null;
let activeToastDismissHandle: number | null = null;

function dismissToast(toast: HTMLElement, immediate = false): void {
  if (activeToastDismissHandle !== null) {
    window.clearTimeout(activeToastDismissHandle);
    activeToastDismissHandle = null;
  }
  toast.classList.remove("is-visible");
  toast.classList.add("is-dismissing");
  const removeAfter = immediate ? 0 : 220;
  window.setTimeout(() => {
    toast.remove();
    if (activeToast === toast) activeToast = null;
  }, removeAfter);
}

export function showRestoreToast(options: RestoreToastOptions = {}): HTMLElement | null {
  if (activeToast) dismissToast(activeToast, true);

  const message = options.message ?? DEFAULT_RESTORE_MESSAGE;
  const forgetLabel = options.forgetLabel ?? DEFAULT_FORGET_LABEL;
  const durationMs = options.durationMs ?? DEFAULT_RESTORE_DURATION_MS;

  const toast = document.createElement("aside");
  toast.className = "restore-toast";
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");

  const text = document.createElement("span");
  text.className = "restore-toast-text";
  text.textContent = message;
  toast.appendChild(text);

  if (options.onForget) {
    const action = document.createElement("button");
    action.type = "button";
    action.className = "restore-toast-action";
    action.textContent = forgetLabel;
    action.addEventListener("click", () => {
      options.onForget?.();
      dismissToast(toast);
    });
    toast.appendChild(action);
  }

  const close = document.createElement("button");
  close.type = "button";
  close.className = "restore-toast-close";
  close.setAttribute("aria-label", "Dismiss notice");
  close.textContent = "×";
  close.addEventListener("click", () => dismissToast(toast));
  toast.appendChild(close);

  document.body.appendChild(toast);
  activeToast = toast;

  // Trigger fade-in on next frame.
  requestAnimationFrame(() => {
    toast.classList.add("is-visible");
  });

  if (durationMs > 0) {
    activeToastDismissHandle = window.setTimeout(() => {
      activeToastDismissHandle = null;
      if (toast.isConnected) dismissToast(toast);
    }, durationMs);
  }

  return toast;
}

export interface SaveInfoNoticeOptions {
  onDismiss?: () => void;
}

export function buildSaveInfoNoticeHtml(): string {
  return `
    <div class="scenario-storage-notice" role="note" data-storage-notice>
      <p class="scenario-storage-notice-text">
        <strong>Saved on this device only.</strong>
        ETQ stores scenarios in your browser's local storage. Clearing browser data or
        switching device will lose them. There is no backup, no encryption, and no
        recovery; anyone using this browser profile can read these scenarios.
      </p>
      <button type="button" class="scenario-storage-notice-dismiss" data-storage-notice-dismiss>Got it</button>
    </div>
  `;
}

export function wireSaveInfoNoticeDismiss(root: ParentNode, options: SaveInfoNoticeOptions = {}): void {
  const button = root.querySelector<HTMLButtonElement>("[data-storage-notice-dismiss]");
  if (!button) return;
  button.addEventListener("click", () => {
    setSaveInfoSeen();
    const notice = button.closest<HTMLElement>("[data-storage-notice]");
    if (notice) notice.remove();
    options.onDismiss?.();
  });
}
