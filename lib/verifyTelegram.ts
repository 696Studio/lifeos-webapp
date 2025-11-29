import crypto from "crypto";

/**
 * Проверяет подпись Telegram WebApp (initData)
 */
export function verifyTelegramInitData(initData: string, botToken: string) {
  try {
    const secret = crypto
      .createHmac("sha256", "WebAppData")
      .update(botToken)
      .digest();

    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get("hash");
    if (!hash) return false;

    // Строим строку проверки
    const dataCheckArr: string[] = [];
    urlParams.forEach((value, key) => {
      if (key === "hash") return;
      dataCheckArr.push(`${key}=${value}`);
    });

    const dataCheckString = dataCheckArr.sort().join("\n");

    const calculatedHash = crypto
      .createHmac("sha256", secret)
      .update(dataCheckString)
      .digest("hex");

    return calculatedHash === hash;
  } catch (e) {
    console.error("verifyTelegramInitData error:", e);
    return false;
  }
}
