import { Modal, App, Notice } from "obsidian";
import {
  requestDeviceCode,
  pollDeviceToken,
  refreshAccessToken,
  TraktApiError,
} from "./trakt-api";
import type { TraktrSettings } from "./settings";
import { getTranslator } from "./i18n";

/**
 * Modal that displays the device auth flow UI.
 * Shows the verification URL, user code, and polls for authorization.
 */
export class AuthModal extends Modal {
  private cancelled = false;
  private pollInterval: number | null = null;
  private countdownInterval: number | null = null;
  private settings: TraktrSettings;
  private onSuccess: () => Promise<void>;

  constructor(
    app: App,
    settings: TraktrSettings,
    onSuccess: () => Promise<void>,
  ) {
    super(app);
    this.settings = settings;
    this.onSuccess = onSuccess;
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("traktr-auth-modal");
    const t = getTranslator(this.settings.uiLanguage);

    contentEl.createEl("h2", { text: t("authModal.title") });

    const statusEl = contentEl.createEl("p", {
      text: t("authModal.requestingCode"),
      cls: "traktr-auth-status",
    });

    try {
      const deviceCode = await requestDeviceCode(this.settings.clientId);

      if (this.cancelled) return;

      // Show instructions
      statusEl.setText(t("authModal.openLink"));

      const linkEl = contentEl.createEl("p");
      linkEl.createEl("a", {
        text: deviceCode.verification_url,
        href: deviceCode.verification_url,
      });

      const codeContainer = contentEl.createEl("div", {
        cls: "traktr-auth-code-container",
      });
      const codeEl = codeContainer.createEl("code", {
        text: deviceCode.user_code,
        cls: "traktr-auth-code",
      });
      codeEl.addEventListener("click", () => {
        void navigator.clipboard.writeText(deviceCode.user_code);
        new Notice(t("authModal.codeCopied"));
      });
      codeContainer.createEl("small", {
        text: t("authModal.copyHint"),
        cls: "traktr-auth-copy-hint",
      });

      const countdownEl = contentEl.createEl("p", {
        cls: "traktr-auth-countdown",
      });

      const cancelBtn = contentEl.createEl("button", {
        text: t("authModal.cancel"),
      });
      cancelBtn.addEventListener("click", () => this.close());

      // Start countdown
      const expiresAt = Date.now() + deviceCode.expires_in * 1000;
      this.countdownInterval = window.setInterval(() => {
        const remaining = Math.max(
          0,
          Math.floor((expiresAt - Date.now()) / 1000),
        );
        countdownEl.setText(t("authModal.codeExpiresIn", { n: remaining }));
        if (remaining <= 0) {
          this.clearCountdown();
          statusEl.setText(t("authModal.codeExpired"));
        }
      }, 1000);

      // Start polling
      const pollIntervalMs = (deviceCode.interval || 5) * 1000;
      this.pollInterval = window.setInterval(() => {
        void (async () => {
          if (this.cancelled) {
            this.clearPolling();
            this.clearCountdown();
            return;
          }

          try {
            const token = await pollDeviceToken(
              deviceCode.device_code,
              this.settings.clientId,
              this.settings.clientSecret,
            );

            if (token) {
              this.clearPolling();
              this.clearCountdown();

              // Save tokens
              this.settings.accessToken = token.access_token;
              this.settings.refreshToken = token.refresh_token;
              this.settings.tokenExpiresAt =
                (token.created_at + token.expires_in) * 1000;

              await this.onSuccess();

              new Notice(t("authModal.success"));
              this.close();
            }
          } catch (e) {
            if (e instanceof TraktApiError && !e.isRetryable) {
              this.clearPolling();
              this.clearCountdown();
              statusEl.setText(
                t("authModal.errorPrefix", { msg: e.message }),
              );
            }
            // For retryable errors (429), just skip this poll cycle
          }
        })();
      }, pollIntervalMs);
    } catch (e) {
      statusEl.setText(
        t("authModal.failedStart", {
          msg: e instanceof Error ? e.message : String(e),
        }),
      );
    }
  }

  private clearPolling() {
    if (this.pollInterval !== null) {
      window.clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  private clearCountdown() {
    if (this.countdownInterval !== null) {
      window.clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  onClose() {
    this.cancelled = true;
    this.clearPolling();
    this.clearCountdown();
    this.contentEl.empty();
  }
}

/**
 * Ensures the access token is still valid.
 * Refreshes it if expired or within a 1-hour buffer.
 * Throws if refresh fails (caller should prompt re-auth).
 */
export async function ensureValidToken(
  settings: TraktrSettings,
  saveSettings: () => Promise<void>,
): Promise<void> {
  const t = getTranslator(settings.uiLanguage);
  if (!settings.accessToken || !settings.refreshToken) {
    throw new Error(t("auth.error.notConnected"));
  }

  const bufferMs = 60 * 60 * 1000; // 1 hour
  if (Date.now() < settings.tokenExpiresAt - bufferMs) {
    return; // Token is still valid
  }

  // Refresh the token
  try {
    const token = await refreshAccessToken(
      settings.refreshToken,
      settings.clientId,
      settings.clientSecret,
    );
    settings.accessToken = token.access_token;
    settings.refreshToken = token.refresh_token;
    settings.tokenExpiresAt = (token.created_at + token.expires_in) * 1000;
    await saveSettings();
  } catch {
    // Clear tokens on refresh failure
    settings.accessToken = "";
    settings.refreshToken = "";
    settings.tokenExpiresAt = 0;
    await saveSettings();
    throw new Error(t("auth.error.sessionExpired"));
  }
}
