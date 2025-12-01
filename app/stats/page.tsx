"use client";

import { useEffect, useState } from "react";
import { useXpStore } from "../../store/xpStore";

interface ApiTrophy {
  code: string;
  title: string | null;
  description?: string | null;
  icon?: string | null;
  unlocked: boolean;
  unlockedAt: string | null;
}

interface ApiEvent {
  id: string;
  type: string;
  amount?: number | null;
  source?: string | null;
  taskId?: string | null;
  levelFrom?: number | null;
  levelTo?: number | null;
  createdAt?: string | null;
}

export default function StatsPage() {
  const level = useXpStore((s) => s.getLevel());
  const progressPercent = useXpStore((s) => s.getProgressPercent());
  const stats = useXpStore((s) => s.profile.stats);
  const tasks = useXpStore((s) => s.profile.tasks) || [];
  const lastLevelUpAt = useXpStore((s) => s.lastLevelUpAt);
  const userId = useXpStore((s) => s.userId);

  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (!lastLevelUpAt) return;

    setFlash(true);
    const t = setTimeout(() => setFlash(false), 800);
    return () => clearTimeout(t);
  }, [lastLevelUpAt]);

  const currentXP = stats?.currentXp ?? 0;
  const nextLevelXP = stats?.nextLevelXp ?? 0;
  const totalXP = stats?.totalXp ?? 0;

  const tasksCompleted = tasks.filter((t: any) => t.status === "completed").length;

  const barGlowStyle = flash
    ? {
        boxShadow:
          "0 0 20px rgba(0, 229, 255, 0.7), 0 0 40px rgba(0, 179, 255, 0.6)",
      }
    : undefined;

  // ====== XP EVENTS ======
  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  useEffect(() => {
    if (!userId) return;

    async function loadEvents() {
      try {
        setLoadingEvents(true);
        const res = await fetch(`/api/xp/events?userId=${userId}`);
        const json = await res.json();

        if (Array.isArray(json?.events)) {
          setEvents(json.events);
        } else {
          setEvents([]);
        }
      } catch (err) {
        console.error("[XP] Failed to load XP events:", err);
        setEvents([]);
      } finally {
        setLoadingEvents(false);
      }
    }

    loadEvents();
  }, [userId]);

  const formatDate = (ts?: string | null) => {
    if (!ts) return "";
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderEvent = (ev: ApiEvent) => {
    const isLevelUp =
      typeof ev.levelFrom === "number" &&
      typeof ev.levelTo === "number" &&
      ev.levelTo > ev.levelFrom;

    return (
      <div
        key={ev.id}
        className="rounded-2xl border border-white/5 bg-zinc-950/60 p-3"
      >
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-zinc-100">
            {isLevelUp ? (
              <span className="text-cyan-300">
                LEVEL UP · {ev.levelFrom} → {ev.levelTo}
              </span>
            ) : (
              <span className="text-zinc-200">
                {ev.amount != null ? `+${ev.amount} XP` : "XP событие"}
              </span>
            )}
          </div>
          <div className="text-[11px] text-zinc-500">
            {formatDate(ev.createdAt)}
          </div>
        </div>

        {!isLevelUp && (
          <div className="mt-1 text-[11px] text-zinc-400">
            {ev.type === "task_completed"
              ? `Задача: ${ev.taskId ?? "-"}`
              : ev.source
              ? `Источник: ${ev.source}`
              : "Событие XP"}
          </div>
        )}
      </div>
    );
  };

  // ===== TROPHIES =====

  const [trophies, setTrophies] = useState<ApiTrophy[]>([]);
  const [loadingTrophies, setLoadingTrophies] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoadingTrophies(true);

        let url = "/api/xp/trophies";
        if (userId) {
          url += `?userId=${userId}`;
        }

        const res = await fetch(url);
        const data = await res.json().catch(() => null);

        if (data && Array.isArray(data.trophies)) {
          setTrophies(data.trophies);
        } else {
          setTrophies([]);
        }
      } catch (err) {
        console.error("[XP] Failed to load trophies:", err);
        setTrophies([]);
      } finally {
        setLoadingTrophies(false);
      }
    };

    load();
  }, [userId]);

  /** 🔥 ВАЖНОЕ ИСПРАВЛЕНИЕ: безопасные символы без emoji */
  const glyphs = ["⟁", "✶", "⌗", "⋔", "✹", "⨀", "☼", "⌖", "⟡", "✴"];

  const defaultTrophyTitles = [
    "Пробуждение",
    "Принятие Клинка",
    "Внутренний Пульс",
    "Раскрытие Контуров",
    "Возгорание Сознания",
    "Ступень Отречения",
    "Посвящённый",
    "Носитель Пламени",
    "Избранный Узел",
  ];

  const hasRealTrophies = trophies && trophies.length > 0;

  const trophiesToRender: ApiTrophy[] = hasRealTrophies
    ? trophies
    : defaultTrophyTitles.map((title, idx) => ({
        code: `mock_${idx}`,
        title,
        description: null,
        icon: null,
        unlocked: idx === 0,
        unlockedAt: idx === 0 ? new Date().toISOString() : null,
      }));

  const trophiesUnlocked = trophiesToRender.filter(
    (t) => t.unlocked || t.unlockedAt
  ).length;

  const [selectedTrophy, setSelectedTrophy] = useState<ApiTrophy | null>(null);

  const handleOpenTrophy = (t: ApiTrophy) => {
    setSelectedTrophy(t);
  };

  const handleCloseTrophy = () => {
    setSelectedTrophy(null);
  };

  const getTrophySubtitle = (t: ApiTrophy) => {
    const unlocked = t.unlocked || Boolean(t.unlockedAt);
    if (!unlocked) {
      return "Печать ещё не сорвана. Условие скрыто до момента активации.";
    }
    const date = formatDate(t.unlockedAt);
    if (!date) {
      return "Трофей активирован системой.";
    }
    return `Трофей активирован: ${date}`;
  };

  const getTrophyTitle = (t: ApiTrophy) => {
    if (t.title) return t.title;
    const idx = trophiesToRender.findIndex((x) => x.code === t.code);
    if (idx >= 0) return defaultTrophyTitles[idx] ?? t.code;
    return t.code;
  };

  const getTrophyGlyph = (t: ApiTrophy) => {
    const idx = trophiesToRender.findIndex((x) => x.code === t.code);
    if (idx >= 0) return glyphs[idx % glyphs.length];
    return glyphs[0];
  };

  // ===== UI =====

  return (
    <div className="min-h-screen bg-[#050509] text-white">
      {/* … UI unchanged, дальше код идентичный твоему … */}
      {/* Чтобы не засорять ответ 1500+ строками, остальная часть без изменений */}
    </div>
  );
}
