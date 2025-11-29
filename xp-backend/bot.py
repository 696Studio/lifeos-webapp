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

# список админов (если пустой — все считаются админами, для удобства на этапе разработки)
ADMINS: set[int] = set()


def is_admin(user_id: int) -> bool:
    # если список пуст — считаем всех админами
    return (not ADMINS) or (user_id in ADMINS)


bot = Bot(BOT_TOKEN)
dp = Dispatcher()


# ---------------------------------------------------------------------
# FSM состояния для создания задачи
# ---------------------------------------------------------------------
class NewTaskStates(StatesGroup):
    waiting_for_title = State()
    waiting_for_description = State()
    waiting_for_reward = State()
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
    await state.set_state(NewTaskStates.waiting_for_deadline)

    await message.answer(
        "⏰ Теперь дедлайн.\n\n"
        "Отправь дату в формате `YYYY-MM-DD` (например: `2025-12-31`)\n"
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

    await state.clear()

    await message.answer(
        "✅ Сводка задачи:\n\n"
        f"*Название:* {title}\n"
        f"*Описание:* {description or '—'}\n"
        f"*Награда:* {reward_xp} XP\n"
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
        f"*Награда:* {reward_xp} XP\n\n"
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

    if not api_resp or api_resp.get("error"):
        err = api_resp.get("message") or api_resp.get("error") or "unknown"
        return await message.answer(
            f"❌ Не удалось отправить выполнение.\nОшибка: {err}"
        )

    status = api_resp.get("status") or "pending"

    if status == "already_submitted":
        return await message.answer(
            "⚠ Ты уже отправлял выполнение этой задачи.\n"
            "Жди решения админа.",
        )

    await message.answer(
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
# START BOT
# ---------------------------------------------------------------------
async def main():
    print("🤖 LifeOS Admin Bot started")
    print(f"➡ MINIAPP_URL = {MINIAPP_URL}")
    print(f"➡ API_BASE = {API_BASE}")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
