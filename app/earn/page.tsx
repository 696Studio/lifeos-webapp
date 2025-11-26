"use client";

import { useState } from "react";
import Card from "../Card";
import { useXpStore } from "../../store/xpStore";

export default function EarnPage() {
  const tasks = useXpStore((s) => s.profile.tasks);
  const addXp = useXpStore((s) => s.addXp);
  const completeTask = useXpStore((s) => s.completeTask);

  // локальный стейт для эффектов
  const [xpPopup, setXpPopup] = useState<null | { amount: number; taskId: string }>(null);
  const [levelUp, setLevelUp] = useState<null | { from: number; to: number }>(null);

  const handleTaskClick = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // единственное, что реально не трогаем — locked
    if (task.status === "locked") return;

    // уровень ДО
    const stateBefore = useXpStore.getState();
    const oldLevel = stateBefore.getLevel();

    // начисляем XP и отмечаем задачу
    addXp(task.xp, { source: task.category, taskId: task.id });
    completeTask(task.id);

    // уровень ПОСЛЕ
    const stateAfter = useXpStore.getState();
    const newLevel = stateAfter.getLevel();

    // если уровень вырос — показываем LEVEL UP баннер
    if (newLevel > oldLevel) {
      setLevelUp({ from: oldLevel, to: newLevel });
      setTimeout(() => setLevelUp(null), 2000);
    }

    // локальный +XP попап над задачей
    setXpPopup({ amount: task.xp, taskId: task.id });
    setTimeout(() => setXpPopup(null), 800);
  };

  const inviteTasks = tasks.filter((t) => t.category === "invite");
  const streamTasks = tasks.filter((t) => t.category === "stream");
  const helpTasks = tasks.filter((t) => t.category === "help");
  const learnTasks = tasks.filter((t) => t.category === "learn");
  const ideasTasks = tasks.filter((t) => t.category === "ideas");

  const renderTask = (task: any) => {
    const isLocked = task.status === "locked";
    const isCompleted = task.status === "completed";

    const label = isLocked
      ? "Скоро"
      : isCompleted
      ? "Получено (можно ещё)"
      : "Получить XP";

    const disabled = isLocked; // всё, что не locked — жмётся

    const showPopup = xpPopup && xpPopup.taskId === task.id;

    return (
      <div
        key={task.id}
        style={{
          padding: "12px 0",
          borderBottom: "1px solid rgba(148, 163, 184, 0.1)",
          position: "relative", // нужно для позиционирования +XP
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
            +{task.xp} XP
          </span>
        </div>

        {task.description && (
          <div
            style={{
              fontSize: "12px",
              color: "#7b8a90",
              marginBottom: "8px",
            }}
          >
            {task.description}
          </div>
        )}

        <button
          onClick={() => handleTaskClick(task.id)}
          disabled={disabled}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: "999px",
            border: "none",
            cursor: disabled ? "default" : "pointer",
            background: disabled
              ? "rgba(15, 23, 42, 0.9)"
              : "linear-gradient(90deg, #00e5ff, #00b3ff)",
            color: disabled ? "#9ca3af" : "#020b10",
            fontSize: "13px",
            fontWeight: 500,
            transition: "transform 0.12s ease-out, box-shadow 0.12s ease-out",
            transform: !disabled && showPopup ? "scale(1.01)" : "scale(1)",
            boxShadow:
              !disabled && showPopup
                ? "0 0 16px rgba(0, 229, 255, 0.4)"
                : "none",
          }}
        >
          {label}
          {typeof task.timesCompleted === "number" &&
            task.timesCompleted > 0 && (
              <span style={{ marginLeft: 6, fontSize: "11px" }}>
                ({task.timesCompleted} раз)
              </span>
            )}
        </button>

        {/* маленькая вспышка +XP над задачей */}
        {showPopup && (
          <div
            style={{
              position: "absolute",
              right: 0,
              top: -4,
              fontSize: "11px",
              fontWeight: 700,
              color: "#00e5ff",
              textShadow: "0 0 8px rgba(0, 229, 255, 0.8)",
              animation: "fade-up 0.6s ease-out forwards",
            }}
          >
            +{xpPopup.amount} XP
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* LEVEL UP баннер поверх всего */}
      {levelUp && (
        <div
          style={{
            position: "fixed",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 50,
            padding: "10px 18px",
            borderRadius: "999px",
            background:
              "radial-gradient(circle at 0% 0%, #00e5ff, #00b3ff 40%, #020617 100%)",
            color: "#020617",
            fontSize: "13px",
            fontWeight: 600,
            boxShadow: "0 0 24px rgba(0, 229, 255, 0.5)",
          }}
        >
          LEVEL UP — {levelUp.from} → {levelUp.to}
        </div>
      )}

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
            Выполняй задания, чтобы поднимать уровень и открывать трофеи.
          </p>

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
                Идеи
              </h3>
              {ideasTasks.map(renderTask)}
            </section>
          )}
        </Card>
      </main>
    </>
  );
}
