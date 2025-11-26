// lib/telegram.ts
import { miniApp } from "@telegram-apps/sdk";

export const telegram =
  typeof window !== "undefined" ? miniApp : null;
