import asyncio
import os

from aiogram import Bot, Dispatcher, types
from aiogram.filters import CommandStart
from aiogram.types import ReplyKeyboardMarkup, KeyboardButton, WebAppInfo
from dotenv import load_dotenv

# Загружаем переменные окружения из .env
load_dotenv()

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
MINIAPP_URL = os.getenv("MINIAPP_URL", "https://lifeos-webapp.vercel.app/earn")

if not BOT_TOKEN:
    raise RuntimeError("TELEGRAM_BOT_TOKEN is not set in .env")

bot = Bot(BOT_TOKEN)
dp = Dispatcher()


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
        "Добро пожаловать в LifeOS WebApp бот.\n\n"
        "Нажми кнопку ниже, чтобы открыть LifeOS XP Mini App внутри Telegram.",
        reply_markup=keyboard,
    )


async def main():
    print("🤖 LifeOS Bot started")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())