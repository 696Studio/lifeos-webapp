import asyncio
import os
import aiohttp
from datetime import datetime

from aiogram import Bot, Dispatcher, types
from aiogram.filters import CommandStart, Command
from aiogram.types import (
    ReplyKeyboardMarkup,
    KeyboardButton,
    WebAppInfo,
    BotCommand,
)
from aiogram.fsm.state import StatesGroup, State
from aiogram.fsm.context import FSMContext
from dotenv import load_dotenv

# Подтягиваем .env (локально), но переменные Railway будут главнее
load_dotenv()

# ---------------------------------------------------------------------
# Загрузка и валидация токена
# ---------------------------------------------------------------------
BOT_TOKEN_RAW = os.getenv("TELEGRAM_BOT_TOKEN")

print("DEBUG TELEGRAM_BOT_TOKEN RAW:", repr(BOT_TOKEN_RAW))

if not BOT_TOKEN_RAW:
    raise RuntimeError(
        "TELEGRAM_BOT_TOKEN не задан. "
        "Проверь Variables в Railway или .env локально."
    )

# Чистим лишние пробелы и кавычки вокруг
BOT_TOKEN = BOT_TOKEN_RAW.strip().strip('"').strip("'")

if " " in BOT_TOKEN:
    raise RuntimeError(
        f"TELEGRAM_BOT_TOKEN выглядит некорректно (есть пробелы внутри): {repr(BOT_TOKEN_RAW)}"
    )

# рабочий прод-URL мини-апки
MINIAPP_URL = "https://lifeos-webapp.vercel.app"

# URL Next.js API (тот же домен)
API_BASE = f"{MINIAPP_URL}/api/xp"

# ---------------------------------------------------------------------
# Админы (ТОЛЬКО эти аккаунты имеют доступ к /newtask, /pending, /approve, /reject, /deletetask)
# ---------------------------------------------------------------------
ADMINS: set[int] = {
    525605396,   # твой основной аккаунт
    5282550012,  # второй аккаунт
}


def is_admin(user_id: int) -> bool:
    """
    Жёсткая проверка: админ только если user_id в ADMINS.
    Никакого "если пусто — все админы".
    """
    return user_id in ADMINS


bot = Bot(BOT_TOKEN)
dp = Dispatcher()


# ---------------------------------------------------------------------
# FSM состояния для создания задачи
# ---------------------------------------------------------------------
class NewTaskStates(StatesGroup):
    waiting_for_title = State()
    waiting_for_description = State()
    waiting_for_reward = State()
    waiting_for_type = State()
    waiting_for_iterations = State()
    waiting_for_deadline = State()


# ---------------------------------------------------------------------
# /start — открыть мини-апку
# ---------------------------------------------------------------------
@dp.message(CommandStart())
async def cmd_start(message: types.Message):
    keyboard = ReplyKeyboardMarkup(
        keyboard=[
            [
                KeyboardButton(
                    text="Открыть LifeOS Mini App",
                    web_app=WebAppInfo(url=MINIAPP_URL),
                )
            ]
        ],
        resize_keyboard=True,
    )

    await message.answer(
        "Добро пожаловать в LifeOS XP Mini App.\n"
        "Нажми кнопку ниже, чтобы открыть приложение.",
        reply_markup=keyboard,
    )


# ---------------------------------------------------------------------
# ADMIN: /newtask — запуск диалога создания задачи
# ---------------------------------------------------------------------
@dp.message(Command("newtask"))
async def new_task(message: types.Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return await message.answer("⛔ У вас нет прав для создания задач.")

    await state.clear()
    await state.set_state(NewTaskStates.waiting_for_title)

    await message.answer(
        "📝 Создание новой задачи.\n\n"
        "Отправь *название задачи*.",
        parse_mode="Markdown",
    )


@dp.message(NewTaskStates.waiting_for_title)
async def new_task_title(message: types.Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        await state.clear()
        return await message.answer("⛔ Доступ запрещён.")

    title = message.text.strip()
    if not title:
        return await message.answer("❗ Название не может быть пустым. Отправь ещё раз.")

    await state.update_data(title=title)
    await state.set_state(NewTaskStates.waiting_for_description)

    await message.answer(
        "✏️ Ок.\nТеперь отправь *описание задачи*.\n\n"
        "_Можно коротко, можно подробно._",
        parse_mode="Markdown",
    )


@dp.message(NewTaskStates.waiting_for_description)
async def new_task_description(message: types.Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        await state.clear()
        return await message.answer("⛔ Доступ запрещён.")

    description = message.text.strip()
    await state.update_data(description=description)
    await state.set_state(NewTaskStates.waiting_for_reward)

    await message.answer(
        "💰 Сколько XP дать за выполнение этой задачи?\n\n"
        "Отправь *целое число* (например: `50`).",
        parse_mode="Markdown",
    )


@dp.message(NewTaskStates.waiting_for_reward)
async def new_task_reward(message: types.Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        await state.clear()
        return await message.answer("⛔ Доступ запрещён.")

    text = message.text.strip().replace(" ", "")
    if not text.isdigit():
        return await message.answer(
            "❗ Нужно отправить *целое число XP*. Попробуй ещё раз.",
            parse_mode="Markdown",
        )

    reward_xp = int(text)
    if reward_xp <= 0:
        return await message.answer("❗ Награда должна быть больше 0. Попробуй ещё раз.")

    await state.update_data(reward_xp=reward_xp)
    await state.set_state(NewTaskStates.waiting_for_type)

    await message.answer(
        "⚙️ Теперь укажи *тип задачи*.\n\n"
        "Отправь цифру:\n"
        "`1` — разовая (1 раз на человека)\n"
        "`2` — ежедневка (1 раз в день на человека)\n"
        "`3` — ограниченная по количеству раз на человека\n\n"
        "Позже мы используем это, чтобы скрывать задачи, которые уже сделаны.",
        parse_mode="Markdown",
    )


@dp.message(NewTaskStates.waiting_for_type)
async def new_task_type(message: types.Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        await state.clear()
        return await message.answer("⛔ Доступ запрещён.")

    raw = message.text.strip().lower()

    task_type: str
    max_user_completions: int | None

    if raw in ("1", "разовая", "once", "one"):
        task_type = "single"
        max_user_completions = 1
        await state.update_data(
            task_type=task_type,
            max_user_completions=max_user_completions,
        )
        await state.set_state(NewTaskStates.waiting_for_deadline)
        return await message.answer(
            "✅ Тип: *разовая* (1 раз на человека).\n\n"
            "Теперь отправь дедлайн в формате `YYYY-MM-DD`\n"
            "или напиши `нет`, если дедлайн не нужен.",
            parse_mode="Markdown",
        )

    if raw in ("2", "ежедневка", "daily"):
        task_type = "daily"
        # 1 раз в день — будем обрабатывать логикой на бэке позже
        max_user_completions = 1
        await state.update_data(
            task_type=task_type,
            max_user_completions=max_user_completions,
        )
        await state.set_state(NewTaskStates.waiting_for_deadline)
        return await message.answer(
            "✅ Тип: *ежедневка* (1 раз в день на человека).\n\n"
            "Теперь отправь дедлайн в формате `YYYY-MM-DD`\n"
            "или напиши `нет`, если дедлайн не нужен.",
            parse_mode="Markdown",
        )

    if raw in ("3", "multi", "несколько", "n", "многократная"):
        task_type = "multi"
        await state.update_data(task_type=task_type)
        await state.set_state(NewTaskStates.waiting_for_iterations)
        return await message.answer(
            "🔁 Сколько *максимум раз один человек* может получить XP за эту задачу?\n\n"
            "Отправь число.\n"
            "`0` — без ограничения (можно бесконечно).",
            parse_mode="Markdown",
        )

    return await message.answer(
        "❗ Неверный вариант.\n\n"
        "Отправь:\n"
        "`1` — разовая\n"
        "`2` — ежедневка\n"
        "`3` — ограниченная по количеству раз",
        parse_mode="Markdown",
    )


@dp.message(NewTaskStates.waiting_for_iterations)
async def new_task_iterations(message: types.Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        await state.clear()
        return await message.answer("⛔ Доступ запрещён.")

    text = message.text.strip().replace(" ", "")

    if not text.isdigit():
        return await message.answer(
            "❗ Нужно отправить *целое число*.\n"
            "`0` — без ограничения.\n\n"
            "Попробуй ещё раз.",
            parse_mode="Markdown",
        )

    max_iter = int(text)
    if max_iter < 0:
        return await message.answer(
            "❗ Число не может быть отрицательным. Отправь 0 или больше.",
            parse_mode="Markdown",
        )

    await state.update_data(max_user_completions=max_iter)
    await state.set_state(NewTaskStates.waiting_for_deadline)

    human_limit = "без ограничения" if max_iter == 0 else f"{max_iter} раз"

    await message.answer(
        f"✅ Лимит на пользователя: *{human_limit}*.\n\n"
        "Теперь отправь дедлайн в формате `YYYY-MM-DD`\n"
        "или напиши `нет`, если дедлайн не нужен.",
        parse_mode="Markdown",
    )


@dp.message(NewTaskStates.waiting_for_deadline)
async def new_task_deadline(message: types.Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        await state.clear()
        return await message.answer("⛔ Доступ запрещён.")

    text = message.text.strip().lower()
    deadline_iso = None

    if text in ("нет", "no", "-", "none", "0"):
        deadline_iso = None
    else:
        try:
            dt = datetime.strptime(text, "%Y-%m-%d")
            deadline_iso = dt.strftime("%Y-%m-%dT00:00:00Z")
        except ValueError:
            return await message.answer(
                "❗ Неверный формат даты.\n"
                "Нужно вот так: `2025-12-31` или напиши `нет`.",
                parse_mode="Markdown",
            )

    data = await state.get_data()
    title = data.get("title")
    description = data.get("description")
    reward_xp = data.get("reward_xp")

    task_type = data.get("task_type") or "single"
    max_user_completions = data.get("max_user_completions")

    await state.clear()

    # человекочитаемые подписи типа
    if task_type == "daily":
        type_label = "ежедневка (1 раз в день на человека)"
    elif task_type == "multi":
        if max_user_completions is None or max_user_completions == 0:
            type_label = "многократная (без ограничения на пользователя)"
        else:
            type_label = f"многократная (до {max_user_completions} раз на пользователя)"
    else:
        type_label = "разовая (1 раз на человека)"

    human_limit = (
        "1"
        if task_type == "single"
        else (
            "1 в день"
            if task_type == "daily"
            else (
                "без ограничения"
                if (max_user_completions is None or max_user_completions == 0)
                else str(max_user_completions)
            )
        )
    )

    await message.answer(
        "✅ Сводка задачи:\n\n"
        f"*Название:* {title}\n"
        f"*Описание:* {description or '—'}\n"
        f"*Награда:* {reward_xp} XP\n"
        f"*Тип:* {type_label}\n"
        f"*Максимум на пользователя:* {human_limit}\n"
        f"*Дедлайн:* {text if deadline_iso else 'нет'}\n\n"
        "💾 Сохраняю задачу...",
        parse_mode="Markdown",
    )

    payload = {
        "title": title,
        "description": description,
        "rewardXp": reward_xp,
        "deadlineAt": deadline_iso,
        "createdBy": message.from_user.id,
        # новые поля — будем использовать в API/фронте
        "taskType": task_type,
        "maxUserCompletions": max_user_completions,
    }

    try:
        api_resp = await call_api("tasks/create", payload)
    except Exception as e:
        print("API ERROR /tasks/create:", e)
        return await message.answer("❌ Ошибка при обращении к API. Попробуй позже.")

    if not api_resp or api_resp.get("error"):
        err = api_resp.get("message") or api_resp.get("error") or "unknown"
        return await message.answer(f"❌ Не удалось сохранить задачу.\nОшибка: {err}")

    task = api_resp.get("task") or {}
    code = task.get("code") or "UNKNOWN"

    await message.answer(
        "🔥 Задача создана!\n\n"
        f"*Код задачи:* `{code}`\n"
        f"*Награда:* {reward_xp} XP\n"
        f"*Тип:* {type_label}\n\n"
        "Пользователи смогут выполнить её через /tasks и /done.",
        parse_mode="Markdown",
    )


# ---------------------------------------------------------------------
# USER: /tasks — список задач
# ---------------------------------------------------------------------
@dp.message(Command("tasks"))
async def tasks_list(message: types.Message):
    await message.answer("⏳ Загружаю список задач...")

    try:
        api_resp = await call_api("tasks/list", {})
    except Exception as e:
        print("API ERROR /tasks/list:", e)
        return await message.answer("❌ Не удалось загрузить задачи.\nОшибка: INTERNAL")

    if not api_resp or api_resp.get("error"):
        err = api_resp.get("message") or api_resp.get("error") or "unknown"
        return await message.answer(f"❌ Не удалось загрузить задачи.\nОшибка: {err}")

    tasks = api_resp.get("tasks") or []

    if not tasks:
        return await message.answer("Пока нет активных задач. Загляни позже ✨")

    lines = ["📃 *Доступные задачи:*", ""]
    for t in tasks[:15]:
        code = t.get("code")
        title = t.get("title")
        reward = t.get("rewardXp")
        line = f"• `{code}` — *{title}* (+{reward} XP)"
        lines.append(line)

    lines.append("")
    lines.append("Чтобы отправить выполнение, используй:\n`/done КОД_ЗАДАЧИ`")

    await message.answer("\n".join(lines), parse_mode="Markdown")


# ---------------------------------------------------------------------
# USER: /done <task_code> — отправить выполнение задачи
# ---------------------------------------------------------------------
@dp.message(Command("done"))
async def submit_task(message: types.Message):
    args = message.text.split()
    if len(args) < 2:
        return await message.answer(
            "❗ Укажи код задачи.\n\n"
            "Пример:\n"
            "`/done DAILY_1234`",
            parse_mode="Markdown",
        )

    task_code = args[1].strip().upper()
    user_id = message.from_user.id

    await message.answer(
        f"📩 Отправляю заявку на выполнение задачи `{task_code}`...",
        parse_mode="Markdown",
    )

    payload = {
        "userId": user_id,
        "taskCode": task_code,
    }

    try:
        api_resp = await call_api("tasks/submit", payload)
    except Exception as e:
        print("API ERROR /tasks/submit:", e)
        return await message.answer("❌ Ошибка при обращении к API. Попробуй позже.")

    if not api_resp:
        return await message.answer(
            "❌ Не удалось отправить выполнение.\nОшибка: пустой ответ от API."
        )

    # если бэк вернул error — это реально ошибка
    if api_resp.get("error"):
        err = api_resp.get("message") or api_resp.get("error") or "unknown"
        return await message.answer(
            f"❌ Не удалось отправить выполнение.\nОшибка: {err}"
        )

    status = api_resp.get("status") or "pending"
    task_type = api_resp.get("taskType") or "single"
    max_for_user = api_resp.get("maxForUser")

    # 🔹 когда задача не найдена / уже неактивна
    if status == "task_not_found":
        return await message.answer(
            "❗ Задача с таким кодом не найдена.\n"
            "Проверь код через /tasks и попробуй ещё раз.",
        )

    if status == "task_inactive":
        return await message.answer(
            "⚠ Эта задача больше не активна.\n"
            "Выбери другую задачу через /tasks.",
        )

    # 🔹 Лимит попыток для этой задачи
    if status == "limit_reached":
        if task_type == "daily":
            # ежедневка — уже делал сегодня
            return await message.answer(
                "⚠ Ты уже забрал XP за эту ежедневную задачу сегодня.\n"
                "Возвращайся завтра, чтобы получить ещё.",
            )
        else:
            # разовая или многократная
            if max_for_user is None:
                return await message.answer(
                    "⚠ Лимит выполнений для этой задачи уже достигнут.",
                )
            return await message.answer(
                "⚠ Лимит выполнений для этой задачи достигнут.\n"
                f"Ты уже выполнил её максимум {max_for_user} раз.",
            )

    # 🔹 На будущее (если когда-то решим возвращать already_submitted)
    if status == "already_submitted":
        return await message.answer(
            "⚠ Ты уже отправлял выполнение этой задачи.\n"
            "Жди решения админа.",
        )

    # 🔹 Обычный кейс — заявка создана, статус pending
    return await message.answer(
        "✅ Заявка на выполнение задачи отправлена.\n"
        "После проверки админом XP будет начислен.",
    )


# ---------------------------------------------------------------------
# ADMIN: /pending — список заявок на проверку
# ---------------------------------------------------------------------
@dp.message(Command("pending"))
async def pending_list(message: types.Message):
    if not is_admin(message.from_user.id):
        return await message.answer("⛔ Доступ запрещён.")

    await message.answer("⏳ Загружаю заявки на проверку...")

    payload = {"limit": 30}

    try:
        api_resp = await call_api("tasks/pending", payload)
    except Exception as e:
        print("API ERROR /tasks/pending:", e)
        return await message.answer("❌ Ошибка при обращении к API. Попробуй позже.")

    if not api_resp or api_resp.get("error"):
        err = api_resp.get("message") or api_resp.get("error") or "unknown"
        return await message.answer(
            f"❌ Не удалось загрузить заявки.\nОшибка: {err}"
        )

    items = api_resp.get("items") or []

    if not items:
        return await message.answer("✅ Нет заявок в статусе pending.")

    lines: list[str] = ["🟡 *Заявки, ожидающие проверки:*", ""]
    for idx, item in enumerate(items[:20], start=1):
        completion_id = item.get("id")
        task_code = item.get("taskCode") or "NO_CODE"
        task_title = item.get("taskTitle") or "Без названия"
        user_id = item.get("telegramUserId")
        reward = item.get("rewardXp") or 0

        line = (
            f"{idx}. `{task_code}` — *{task_title}*\n"
            f"   Пользователь: `{user_id}`\n"
            f"   Награда: +{reward} XP\n"
            f"   ID заявки: `{completion_id}`\n"
            f"   /approve {completion_id}\n"
            f"   /reject {completion_id}\n"
        )
        lines.append(line)

    await message.answer("\n".join(lines), parse_mode="Markdown")


# ---------------------------------------------------------------------
# ADMIN: /approve <completionId> — принять выполнение и начислить XP
# ---------------------------------------------------------------------
@dp.message(Command("approve"))
async def approve_completion(message: types.Message):
    if not is_admin(message.from_user.id):
        return await message.answer("⛔ Доступ запрещён.")

    args = message.text.split()
    if len(args) < 2:
        return await message.answer(
            "❗ Укажи ID заявки.\n\n"
            "Пример:\n"
            "`/approve 123e4567-e89b-12d3-a456-426614174000`",
            parse_mode="Markdown",
        )

    completion_id = args[1].strip()

    await message.answer(
        f"✅ Подтверждаю заявку `{completion_id}` и начисляю XP...",
        parse_mode="Markdown",
    )

    payload = {
        "completionId": completion_id,
        "adminId": message.from_user.id,
    }

    try:
        api_resp = await call_api("tasks/approve", payload)
    except Exception as e:
        print("API ERROR /tasks/approve:", e)
        return await message.answer("❌ Ошибка при обращении к API. Попробуй позже.")

    if not api_resp or api_resp.get("error"):
        err = api_resp.get("message") or api_resp.get("error") or "unknown"
        return await message.answer(
            f"❌ Не удалось подтвердить заявку.\nОшибка: {err}"
        )

    reward_xp = api_resp.get("rewardXp") or 0
    profile = api_resp.get("profile") or {}
    stats = profile.get("stats") or {}
    level = stats.get("level")
    total_xp = stats.get("totalXp")

    await message.answer(
        "🎉 Заявка одобрена.\n"
        f"Начислено: +{reward_xp} XP\n"
        f"Новый уровень: {level}\n"
        f"Всего XP: {total_xp}",
        parse_mode="Markdown",
    )


# ---------------------------------------------------------------------
# ADMIN: /reject <completionId> — отклонить выполнение
# ---------------------------------------------------------------------
@dp.message(Command("reject"))
async def reject_completion(message: types.Message):
    if not is_admin(message.from_user.id):
        return await message.answer("⛔ Доступ запрещён.")

    args = message.text.split()
    if len(args) < 2:
        return await message.answer(
            "❗ Укажи ID заявки.\n\n"
            "Пример:\n"
            "`/reject 123e4567-e89b-12d3-a456-426614174000`",
            parse_mode="Markdown",
        )

    completion_id = args[1].strip()

    await message.answer(
        f"🚫 Отклоняю заявку `{completion_id}`...",
        parse_mode="Markdown",
    )

    payload = {
        "completionId": completion_id,
        "adminId": message.from_user.id,
    }

    try:
        api_resp = await call_api("tasks/reject", payload)
    except Exception as e:
        print("API ERROR /tasks/reject:", e)
        return await message.answer("❌ Ошибка при обращении к API. Попробуй позже.")

    if not api_resp or api_resp.get("error"):
        err = api_resp.get("message") or api_resp.get("error") or "unknown"
        return await message.answer(
            f"❌ Не удалось отклонить заявку.\nОшибка: {err}"
        )

    await message.answer(
        "✅ Заявка отклонена.",
        parse_mode="Markdown",
    )


# ---------------------------------------------------------------------
# ADMIN: /deletetask <TASK_CODE> — мягко отключить задачу (is_active = false)
# ---------------------------------------------------------------------
@dp.message(Command("deletetask"))
async def delete_task(message: types.Message):
    """
    Мягкое удаление задачи:
    /deletetask CODE

    Под капотом:
    POST /api/xp/tasks/delete  { "taskCode": "CODE" }
    """
    if not is_admin(message.from_user.id):
        return await message.answer("⛔ Доступ запрещён.")

    args = message.text.split()
    if len(args) < 2:
        return await message.answer(
            "❗ Укажи код задачи, которую нужно отключить.\n\n"
            "Пример:\n"
            "`/deletetask DAILY_1234`",
            parse_mode="Markdown",
        )

    task_code = args[1].strip().upper()

    await message.answer(
        f"🗑 Отключаю задачу `{task_code}` (уберу её из Earn)...",
        parse_mode="Markdown",
    )

    payload = {
        "taskCode": task_code,
    }

    try:
        api_resp = await call_api("tasks/delete", payload)
    except Exception as e:
        print("API ERROR /tasks/delete:", e)
        return await message.answer("❌ Ошибка при обращении к API. Попробуй позже.")

    if not api_resp or api_resp.get("error"):
        err = (
            api_resp.get("message")
            or api_resp.get("error")
            or "unknown"
        )
        return await message.answer(
            f"❌ Не удалось отключить задачу.\nОшибка: {err}"
        )

    already_deleted = bool(api_resp.get("alreadyDeleted"))
    is_active = api_resp.get("isActive")

    if already_deleted or is_active is False:
        text = (
            f"⚠ Задача `{task_code}` уже была отключена.\n"
            "Earn её и так не показывает."
        )
    else:
        text = (
            f"✅ Задача `{task_code}` отключена.\n"
            "Она больше не будет появляться в разделе Earn."
        )

    await message.answer(text, parse_mode="Markdown")


# ---------------------------------------------------------------------
# Функция обращения к Next.js API
# ---------------------------------------------------------------------
async def call_api(path: str, payload: dict):
    url = f"{API_BASE}/{path}"
    async with aiohttp.ClientSession() as session:
        async with session.post(url, json=payload) as resp:
            try:
                data = await resp.json()
            except Exception:
                text = await resp.text()
                print("API BAD RESPONSE TEXT:", text)
                return {"error": "INVALID_RESPONSE", "raw": text}

            if resp.status >= 400:
                print("API ERROR STATUS:", resp.status, data)
            return data


# ---------------------------------------------------------------------
# Настройка команд бота (меню при вводе / )
# ---------------------------------------------------------------------
async def setup_bot_commands(bot: Bot):
    commands = [
        BotCommand(command="start", description="Открыть LifeOS Mini App"),
        BotCommand(command="tasks", description="Список активных задач"),
        BotCommand(command="done", description="Отправить выполнение задачи"),
        BotCommand(command="newtask", description="Создать задачу (админ)"),
        BotCommand(command="pending", description="Заявки на проверку (админ)"),
        BotCommand(command="approve", description="Одобрить заявку (админ)"),
        BotCommand(command="reject", description="Отклонить заявку (админ)"),
        BotCommand(command="deletetask", description="Отключить задачу (админ)"),
    ]

    await bot.set_my_commands(commands)
    print("✅ Bot commands set in Telegram")


# ---------------------------------------------------------------------
# START BOT
# ---------------------------------------------------------------------
async def main():
    print("🤖 LifeOS Admin Bot started")
    print(f"➡ MINIAPP_URL = {MINIAPP_URL}")
    print(f"➡ API_BASE = {API_BASE}")
    print(f"➡ ADMINS = {ADMINS}")

    # настроим команды в Telegram
    await setup_bot_commands(bot)

    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
