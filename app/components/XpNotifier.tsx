"use client";

import { useEffect, useState } from "react";
import { useXpStore } from "../store/xpStore";

// Глобальная всплывашка XP
export default function XpNotifier() {
  const events = useXpStore((s) => s.events); // берём xp-события из стора
  const [visible, setVisible] = useState(false);
  const [text, setText] = useState("");

  useEffect(() => {
    if (!events.length) return;

    const last = events[events.length - 1];

    // определяем текст уведомления
    if (last.type === "xp_gain") {
      setText(`+${last.amount} XP`);
    } else if (last.type === "level_up") {
      setText(`LEVEL UP! ${last.levelFrom} → ${last.levelTo}`);
    } else {
      return;
    }

    // показываем
    setVisible(true);

    // скрываем через 1.8 сек
    const t = setTimeout(() => setVisible(false), 1800);
    return () => clearTimeout(t);
  }, [events]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "100px",
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(0, 255, 255, 0.14)",
        border: "1px solid rgba(0, 255, 255, 0.4)",
        backdropFilter: "blur(14px)",
        borderRadius: "14px",
        padding: "12px 22px",
        fontSize: "15px",
        fontWeight: 600,
        color: "#00faff",
        textShadow: "0 0 12px rgba(0,255,255,0.7)",
        boxShadow: "0 0 30px rgba(0,255,255,0.25)",
        zIndex: 9999,
        transition: "all .3s ease",
        animation: "fadeSlide .3s ease forwards",
      }}
    >
      {text}
    </div>
  );
}
