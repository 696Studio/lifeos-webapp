"use client";

import { useEffect, useRef, useState } from "react";
import { useXpStore } from "../store/xpStore";
import type { XpEvent } from "../store/xpStore";

type Popup = {
  id: string;
  text: string;
  variant: "xp" | "level";
};

export default function XpNotifier() {
  // Лента событий из стора (xp_gain, level_up, task_completed)
  const events = useXpStore((s) => s.events);

  // что сейчас показываем как всплывашки
  const [popups, setPopups] = useState<Popup[]>([]);

  // запоминаем, сколько событий уже было обработано
  const prevLengthRef = useRef<number>(events.length);

  useEffect(() => {
    const prevLen = prevLengthRef.current;
    const currentLen = events.length;

    if (currentLen <= prevLen) return;

    const newEvents: XpEvent[] = events.slice(prevLen);
    prevLengthRef.current = currentLen;

    newEvents.forEach((ev) => {
      // Нас интересуют только xp_gain и level_up
      if (ev.type === "xp_gain" && ev.amount && ev.amount > 0) {
        const id = `xp-${ev.id}`;
        const text = `+${ev.amount} XP`;

        setPopups((prev) => [...prev, { id, text, variant: "xp" }]);

        setTimeout(() => {
          setPopups((prev) => prev.filter((p) => p.id !== id));
        }, 800);
      }

      if (ev.type === "level_up" && ev.levelFrom && ev.levelTo) {
        const id = `lvl-${ev.id}`;
        const text = `LEVEL UP ${ev.levelFrom} → ${ev.levelTo}`;

        setPopups((prev) => [...prev, { id, text, variant: "level" }]);

        setTimeout(() => {
          setPopups((prev) => prev.filter((p) => p.id !== id));
        }, 900);
      }
    });
  }, [events.length, events]);

  if (popups.length === 0) return null;

  return (
    <div
      // фиксированный контейнер поверх всего контента mini-app
      className="pointer-events-none fixed inset-x-0 top-[80px] z-50 flex flex-col items-center gap-1"
    >
      {popups.map((p) => (
        <div
          key={p.id}
          className={[
            "animate-fade-up rounded-full border px-4 py-1.5 text-xs font-semibold shadow-lg",
            p.variant === "xp"
              ? "border-cyan-400/70 bg-[radial-gradient(circle_at_top,#04232f,#020712)] text-cyan-100"
              : "border-amber-400/80 bg-[radial-gradient(circle_at_top,#3b2205,#09040a)] text-amber-100",
          ].join(" ")}
          style={{
            boxShadow:
              p.variant === "xp"
                ? "0 0 18px rgba(0,229,255,0.7)"
                : "0 0 18px rgba(251,191,36,0.7)",
          }}
        >
          {p.text}
        </div>
      ))}
    </div>
  );
}
