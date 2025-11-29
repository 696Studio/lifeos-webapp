"use client";

import { useEffect, useState } from "react";
import Card from "../Card";
import { useXpStore } from "../../store/xpStore";
import { useTelegram } from "../hooks/useTelegram";

type RemoteTask = {
  id: string;
  code: string | null;
  title: string;
  description: string | null;
  category: string | null;
  rewardXp: number;
  deadlineAt: string | null;
  isActive: boolean;
};

type SubmitStatus = "idle" | "pending" | "submitted" | "already" | "error";

export default function EarnPage() {
  const { userId, isTelegram } = useTelegram();

  // XP-статистика из стора (пока ещё локальная, потом подружим с Supabase-профилем)
  const level = useXpStore((s) => s.getLevel());
  const progressPercent = useXpStore((s) => s.getProgressPercent());
  const stats = useXpStore((s) => s.profile.stats);
  const currentXP = stats.currentXp;
  const nextLevelXP = stats.nextLevelXp;

  // Локальные задачи, которые приходят с бэка
  const [tasks, setTasks] = useState<RemoteTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Статусы отправки выполнения по задачам
  const [submitStatus, setSubmitStatus] = useState<Record<string, SubmitStatus>>({});

  // 🔄 Подгружаем задачи из бэка
  useEffect(() => {
    const loadTasks = async () => {
      try {
        setIsLoading(true);
        setLoadError(null);

        const res = await fetch("/api/xp/tasks/list", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });

        if (!res.ok) {
          console.error("Failed to load tasks from API", res.status);
          setLoadError("Не удалось загрузить задания");
          return;
        }

        const data = await res.json();

        const tasksFromApi: RemoteTask[] = (data.tasks ?? []).map((t: any) => ({
          id: t.id,
          code: t.code ?? null,
          title: t.title ?? "Без названия",
          description: t.description ?? null,
          category: t.category ?? null,
          rewardXp: t.rewardXp ?? 0,
          deadlineAt: t.deadlineAt ?? null,
          isActive: t.isActive !== false,
        }));

        setTasks(tasksFromApi);
      } catch (e) {
        console.error("Failed to load tasks from API", e);
        setLoadError("Ошибка при загрузке заданий");
      } finally {
        setIsLoading(false);
      }
    };

    loadTasks();
  }, []);

  const handleTaskClick = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    if (!isTelegram || !userId) {
      alert("Открой мини-апку через Telegram, чтобы выполнять задания.");
      return;
    }

    if (!task.isActive) return;

    if (!task.code) {
      alert("У этой задачи нет кода. Обратись к админу.");
      return;
    }

    const currentStatus = submitStatus[taskId] ?? "idle";
    if (currentStatus === "pending" || currentStatus === "submitted" || currentStatus === "already") {
      // уже отправлена или в процессе — повторно не жмём
      return;
    }

    setSubmitStatus((prev) => ({ ...prev, [taskId]: "pending" }));

    try {
      const res = await fetch("/api/xp/tasks/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          taskCode: task.code,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data || data.error) {
        console.error("Submit task error:", res.status, data);
        setSubmitStatus((prev) => ({ ...prev, [taskId]: "error" }));
        return;
      }

      if (data.status === "already_submitted") {
        setSubmitStatus((prev) => ({ ...prev, [taskId]: "already" }));
      } else {
        setSubmitStatus((prev) => ({ ...prev, [taskId]: "submitted" }));
      }
    } catch (e) {
      console.error("Failed to submit task", e);
      setSubmitStatus((prev) => ({ ...prev, [taskId]: "error" }));
    }
  };

  // Разбивка по категориям
  const inviteTasks = tasks.filter((t) => t.category === "invite");
  const streamTasks = tasks.filter((t) => t.category === "stream");
  const helpTasks = tasks.filter((t) => t.category === "help");
  const learnTasks = tasks.filter((t) => t.category === "learn");
  const ideasTasks = tasks.filter((t) => t.category === "ideas");
  const otherTasks = tasks.filter(
    (t) =>
      !["invite", "stream", "help", "learn", "ideas"].includes(t.category ?? "")
  );

  const renderTask = (task: RemoteTask) => {
    const status = submitStatus[task.id] ?? "idle";

    const isDisabled = !task.isActive || status === "pending" || status === "submitted" || status === "already";

    let label = "Отправить на проверку";
    if (!task.isActive) label = "Недоступно";
    if (status === "pending") label = "Отправляем…";
    if (status === "submitted") label = "Отправлено, ждёт проверки";
    if (status === "already") label = "Уже отправлена";
    if (status === "error") label = "Ошибка, попробовать снова";

    return (
      <div
        key={task.id}
        style={{
          padding: "12px 0",
          borderBottom: "1px solid rgba(148, 163, 184, 0.1)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "4px",
          }}
        >
          <span
            style={{
              fontSize: "14px",
              fontWeight: 500,
            }}
          >
            {task.title}
          </span>
          <span
            style={{
              fontSize: "13px",
              color: "#00e5ff",
            }}
          >
            +{task.rewardXp} XP
          </span>
        </div>

        {task.description && (
          <div
            style={{
              fontSize: "12px",
              color: "#7b8a90",
              marginBottom: "6px",
            }}
          >
            {task.description}
          </div>
        )}

        {task.deadlineAt && (
          <div
            style={{
              fontSize: "11px",
              color: "#64748b",
              marginBottom: "6px",
            }}
          >
            Дедлайн:{" "}
            {new Date(task.deadlineAt).toLocaleDateString("ru-RU", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            })}
          </div>
        )}

        <button
          onClick={() => handleTaskClick(task.id)}
          disabled={isDisabled}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: "999px",
            border: "none",
            cursor: isDisabled ? "default" : "pointer",
            background: !task.isActive
              ? "rgba(15, 23, 42, 0.9)"
              : isDisabled
              ? "rgba(15, 23, 42, 0.95)"
              : "linear-gradient(90deg, #00e5ff, #00b3ff)",
            color: isDisabled ? "#9ca3af" : "#020b10",
            fontSize: "13px",
            fontWeight: 500,
            transition: "transform 0.12s ease-out, box-shadow 0.12s ease-out",
          }}
        >
          {label}
        </button>
      </div>
    );
  };

  return (
    <main
      style={{
        minHeight: "calc(100vh - 80px)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "40px 16px",
      }}
    >
      <Card>
        <h2
          style={{
            fontSize: "22px",
            marginBottom: "6px",
          }}
        >
          Заработать XP
        </h2>
        <p
          style={{
            fontSize: "14px",
            color: "#a0afb5",
            marginBottom: "20px",
          }}
        >
          Выполняй задания, отправляй на проверку — после одобрения админом XP
          попадёт в твой профиль.
        </p>

        <section
          style={{
            padding: "16px 16px 14px",
            borderRadius: "18px",
            background: "rgba(15, 23, 42, 0.95)",
            boxShadow: "0 0 20px rgba(15,23,42,0.7)",
            marginBottom: "20px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "8px",
              fontSize: "13px",
              color: "#94a3b8",
            }}
          >
            <span>Твой уровень</span>
            <span>XP</span>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "8px",
            }}
          >
            <span
              style={{
                fontSize: "16px",
                fontWeight: 600,
                color: "#e5f2ff",
              }}
            >
              Level {level}
            </span>
            <span
              style={{
                fontSize: "14px",
                color: "#e5f2ff",
              }}
            >
              {currentXP} / {nextLevelXP}
            </span>
          </div>

          <div
            style={{
              width: "100%",
              height: "8px",
              borderRadius: "999px",
              background: "#11181c",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progressPercent}%`,
                height: "100%",
                background: "linear-gradient(90deg, #00ffff, #00c6ff)",
                transition: "width 0.2s ease-out",
              }}
            />
          </div>

          <p
            style={{
              marginTop: "8px",
              fontSize: "12px",
              color: "#7b8a90",
            }}
          >
            После одобрения выполненных задач админом твой прогресс обновится.
          </p>
        </section>

        {isLoading && (
          <p
            style={{
              fontSize: "13px",
              color: "#9ca3af",
              marginBottom: "8px",
            }}
          >
            Загружаем задания…
          </p>
        )}

        {loadError && (
          <p
            style={{
              fontSize: "13px",
              color: "#f97373",
              marginBottom: "8px",
            }}
          >
            {loadError}
          </p>
        )}

        {!isLoading && !loadError && tasks.length === 0 && (
          <p
            style={{
              fontSize: "13px",
              color: "#9ca3af",
            }}
          >
            Пока нет доступных заданий. Возвращайся чуть позже.
          </p>
        )}

        {/* Секции задач по категориям */}
        {inviteTasks.length > 0 && (
          <section style={{ marginBottom: "20px" }}>
            <h3
              style={{
                fontSize: "13px",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "#6b7b84",
                marginBottom: "8px",
              }}
            >
              Приглашения
            </h3>
            {inviteTasks.map(renderTask)}
          </section>
        )}

        {streamTasks.length > 0 && (
          <section style={{ marginBottom: "20px" }}>
            <h3
              style={{
                fontSize: "13px",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "#6b7b84",
                marginBottom: "8px",
              }}
            >
              Стримы
            </h3>
            {streamTasks.map(renderTask)}
          </section>
        )}

        {helpTasks.length > 0 && (
          <section style={{ marginBottom: "20px" }}>
            <h3
              style={{
                fontSize: "13px",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "#6b7b84",
                marginBottom: "8px",
              }}
            >
              Помощь / вклад
            </h3>
            {helpTasks.map(renderTask)}
          </section>
        )}

        {learnTasks.length > 0 && (
          <section style={{ marginBottom: "20px" }}>
            <h3
              style={{
                fontSize: "13px",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "#6b7b84",
                marginBottom: "8px",
              }}
            >
              Обучение
            </h3>
            {learnTasks.map(renderTask)}
          </section>
        )}

        {ideasTasks.length > 0 && (
          <section style={{ marginBottom: "20px" }}>
            <h3
              style={{
                fontSize: "13px",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "#6b7b84",
                marginBottom: "8px",
              }}
            >
              Идеи
            </h3>
            {ideasTasks.map(renderTask)}
          </section>
        )}

        {otherTasks.length > 0 && (
          <section style={{ marginBottom: "4px" }}>
            <h3
              style={{
                fontSize: "13px",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "#6b7b84",
                marginBottom: "8px",
              }}
            >
              Другое
            </h3>
            {otherTasks.map(renderTask)}
          </section>
        )}
      </Card>
    </main>
  );
}
