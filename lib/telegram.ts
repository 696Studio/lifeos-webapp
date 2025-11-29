// lib/telegram.ts
import crypto from "crypto";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

type ParsedOk = { ok: true; user: TelegramUser | null };
type ParsedError = { ok: false; error: string };

export type ParsedInitData = ParsedOk | ParsedError;

// Парсим initData из Telegram WebApp и валидируем подпись
export function parseAndValidateInitData(initData: string): ParsedInitData {
  if (!initData) {
    return { ok: false, error: "NO_INIT_DATA" };
  }

  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get("hash");
    if (!hash) return { ok: false, error: "NO_HASH" };

    // Строим data_check_string
    const data: string[] = [];
    urlParams.forEach((value, key) => {
      if (key === "hash") return;
      data.push(`${key}=${value}`);
    });
    data.sort();
    const dataCheckString = data.join("\n");

    // Если бот-токен не задан — для dev режима просто доверяем
    if (!BOT_TOKEN) {
      console.warn("[Telegram] BOT_TOKEN is not set, skipping validation");
      const userRaw = urlParams.get("user");
      const user = userRaw ? (JSON.parse(userRaw) as TelegramUser) : null;
      return { ok: true, user };
    }

    // Реальная проверка подписи, как в доках Telegram
    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(BOT_TOKEN)
      .digest();

    const computedHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    if (computedHash !== hash) {
      return { ok: false, error: "INVALID_HASH" };
    }

    const userRaw = urlParams.get("user");
    const user = userRaw ? (JSON.parse(userRaw) as TelegramUser) : null;

    return { ok: true, user };
  } catch (e) {
    console.error("[Telegram] Failed to parse initData", e);
    return { ok: false, error: "PARSE_ERROR" };
  }
}