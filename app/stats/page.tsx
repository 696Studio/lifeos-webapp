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

  const tasksCompleted = tasks.filter((t: any) => t.status === "completed")
    .length;

  const barGlowStyle = flash
    ? {
        boxShadow:
          "0 0 20px rgba(0, 229, 255, 0.7), 0 0 40px rgba(0, 179, 255, 0.6)",
      }
    : undefined;

  // ====== XP EVENTS (история) ======
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

  // ====== TROPHIES (тянем с бэка) ======
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

    // тянем хоть раз даже без userId, чтобы показать общий список
    load();
  }, [userId]);

  const glyphs = ["⟁", "✶", "⌗", "⋔", "✹", "⨀", "☼", "⌖", "⟊", "✴"];
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
        unlocked: idx === 0, // один "как будто открыт"
        unlockedAt: idx === 0 ? new Date().toISOString() : null,
      }));

  const trophiesUnlocked = trophiesToRender.filter(
    (t) => t.unlocked || t.unlockedAt
  ).length;

  // ====== MODAL: выбранный трофей ======
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

  // ====== UI ======
  return (
    <div className="min-h-screen bg-[#050509] text-white">
      <div className="px-4 pt-6 pb-4">
        <div className="mb-4">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            Stats
          </p>
          <h1 className="mt-1 text-2xl font-semibold leading-tight">
            Твой прогресс
            <br />
            в экосистеме LifeOS
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Следи за уровнем, XP и трофеями, которые ты уже открыл.
          </p>
        </div>

        {/* LEVEL CARD */}
        <div className="rounded-2xl border border-white/5 bg-gradient-to-br from-slate-900 to-slate-950 p-4 shadow-lg">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-400">Текущий уровень</p>
              <p className="text-xl font-semibold">Level {level}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-zinc-400">Прогресс уровня</p>
              <p className="text-sm font-mono text-zinc-100">
                {progressPercent.toFixed(0)}%
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-zinc-200">XP</span>

            <div
              style={{
                width: "100%",
                height: "10px",
                borderRadius: "999px",
                background: "#11181c",
                overflow: "hidden",
                ...barGlowStyle,
              }}
            >
              <div
                style={{
                  width: `${progressPercent}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, #00ffff, #00c6ff)`,
                  transition: "width 0.2s ease-out",
                }}
              />
            </div>

            <span className="text-xs text-zinc-400">
              {totalXP.toLocaleString("ru-RU")} XP
            </span>
          </div>

          <p className="mt-2 text-[11px] text-zinc-400">
            Когда шкала заполнится, ты перейдёшь на новый уровень и откроешь
            новые награды.
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">
            Сейчас: {currentXP} / {nextLevelXP} XP до следующего уровня.
          </p>
        </div>
      </div>

      <div className="space-y-6 px-4 pb-24">
        {/* ===== OVERALL STATS ===== */}
        <section>
          <h2 className="mb-2 text-sm font-medium text-zinc-100">
            Общая статистика
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-white/5 bg-zinc-950/70 px-3 py-3">
              <div className="text-xl font-semibold">{tasksCompleted}</div>
              <div className="mt-1 text-[11px] text-zinc-400">
                задач
                <br />
                выполнено
              </div>
            </div>
            <div className="rounded-2xl border border-amber-500/30 bg-amber-950/40 px-3 py-3">
              <div className="text-xl font-semibold">{trophiesUnlocked}</div>
              <div className="mt-1 text-[11px] text-amber-100/80">
                трофеев
                <br />
                открыто
              </div>
            </div>
            <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/40 px-3 py-3">
              <div className="text-xl font-semibold">
                {totalXP.toLocaleString("ru-RU")}
              </div>
              <div className="mt-1 text-[11px] text-cyan-100/80">
                XP
                <br />
                накоплено
              </div>
            </div>
          </div>
        </section>

        {/* ===== TROPHIES (КУЛЬТ) ===== */}
        <section>
          <h2 className="mb-1 text-sm font-medium text-zinc-100">Трофеи</h2>
          <p className="mb-3 text-[11px] text-zinc-500">
            Закодированные знаки твоего пути. Люди видят в них загадку — система
            считает их доказательствами прогресса.
          </p>

          {loadingTrophies ? (
            <div className="rounded-2xl border border-white/5 bg-zinc-950/60 px-4 py-4 text-xs text-zinc-400">
              Сканируем артефакты ордена…
            </div>
          ) : trophiesToRender.length === 0 ? (
            <div className="rounded-2xl border border-white/5 bg-zinc-950/60 px-4 py-4 text-xs text-zinc-500">
              Трофеи ещё не активированы. Они появятся автоматически, когда ты
              начнёшь выполнять задачи и накапливать XP.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {trophiesToRender.map((t, idx) => {
                const unlocked = Boolean(t.unlocked || t.unlockedAt);
                const title =
                  t.title ??
                  defaultTrophyTitles[idx] ??
                  t.code ??
                  "Неизвестный трофей";

                const glyph = glyphs[idx % glyphs.length];

                return (
                  <button
                    key={t.code ?? idx}
                    type="button"
                    onClick={() => handleOpenTrophy(t)}
                    className={[
                      "rounded-2xl px-2.5 py-3 border text-center transition-transform duration-150 active:scale-95",
                      unlocked
                        ? "border-cyan-400/50 bg-[radial-gradient(circle_at_top,#04232f,#020712)] shadow-[0_0_22px_rgba(0,229,255,0.45)]"
                        : "border-zinc-700/60 bg-[radial-gradient(circle_at_top,#050816,#020308)] opacity-75",
                    ].join(" ")}
                  >
                    <div className="mb-1 flex items-center justify-center">
                      <div
                        className={[
                          "relative flex h-9 w-9 items-center justify-center rounded-full border text-base font-semibold",
                          unlocked
                            ? "border-cyan-400/80 text-cyan-300"
                            : "border-zinc-600 text-zinc-500",
                        ].join(" ")}
                        style={{
                          boxShadow: unlocked
                            ? "0 0 18px rgba(0,229,255,0.7)"
                            : "none",
                        }}
                      >
                        <span style={{ letterSpacing: "0.08em" }}>{glyph}</span>
                      </div>
                    </div>
                    <div className="text-[11px] font-medium leading-tight text-zinc-100 line-clamp-2">
                      {title}
                    </div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                      {unlocked ? "ОТКРЫТ" : "ЗАПЕРТ"}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* ===== XP HISTORY ===== */}
        <section>
          <h2 className="mb-2 text-sm font-medium text-zinc-100">История XP</h2>

          {loadingEvents && (
            <div className="rounded-xl border border-white/5 bg-zinc-950/40 p-3 text-xs text-zinc-400">
              Загружаем события…
            </div>
          )}

          {!loadingEvents && events.length === 0 && (
            <div className="rounded-xl border border-white/5 bg-zinc-950/40 p-3 text-xs text-zinc-500">
              Пока нет событий XP.
            </div>
          )}

          <div className="space-y-3">
            {events.map((ev) => renderEvent(ev))}
          </div>
        </section>

        {/* ===== FUTURE ANALYTICS PLACEHOLDER ===== */}
        <section>
          <h2 className="mb-2 text-sm font-medium text-zinc-100">
            Дальше здесь появятся графики
          </h2>
          <div className="rounded-2xl border border-white/5 bg-zinc-950/60 px-4 py-4 text-xs text-zinc-400">
            Здесь позже добавим:
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>динамику XP по дням и неделям;</li>
              <li>распределение XP по типам задач;</li>
              <li>ленту ключевых событий: LEVEL UP, трофеи и крупные награды.</li>
            </ul>
          </div>
        </section>
      </div>

      {/* ===== MODAL: ТРОФЕЙ ===== */}
      {selectedTrophy && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-[420px] rounded-t-3xl border border-white/10 bg-[#050509] px-4 pb-6 pt-4 shadow-[0_-20px_60px_rgba(0,0,0,0.9)]">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                Артефакт ордена
              </p>
              <button
                type="button"
                onClick={handleCloseTrophy}
                className="rounded-full bg-zinc-900/80 px-2 py-1 text-[11px] text-zinc-400"
              >
                Закрыть
              </button>
            </div>

            <div className="mb-3 flex items-center gap-3">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-full border border-cyan-400/70 text-lg font-semibold text-cyan-200"
                style={{
                  boxShadow: "0 0 20px rgba(0,229,255,0.7)",
                }}
              >
                <span style={{ letterSpacing: "0.08em" }}>
                  {getTrophyGlyph(selectedTrophy)}
                </span>
              </div>
              <div className="flex flex-col">
                <div className="text-sm font-semibold text-zinc-50">
                  {getTrophyTitle(selectedTrophy)}
                </div>
                <div className="text-[11px] text-zinc-500">
                  {selectedTrophy.unlocked || selectedTrophy.unlockedAt
                    ? "Печать снята. Система признала это достижение."
                    : "Печать активна. Условие получения скрыто."}
                </div>
              </div>
            </div>

            {selectedTrophy.description && (
              <p className="text-[12px] leading-snug text-zinc-300">
                {selectedTrophy.description}
              </p>
            )}

            {!selectedTrophy.description && (
              <p className="text-[12px] leading-snug text-zinc-400">
                Этот знак — часть внутреннего алфавита LifeOS. Он не объясняет
                себя словами, он просто фиксирует факт: когда-то ты сделал ход,
                который система сочла значимым.
              </p>
            )}

            <p className="mt-3 text-[11px] text-zinc-500">
              {getTrophySubtitle(selectedTrophy)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
