import asyncio
import os

from aiogram import Bot, Dispatcher, types
from aiogram.filters import CommandStart
from aiogram.types import ReplyKeyboardMarkup, KeyboardButton, WebAppInfo
from dotenv import load_dotenv

# Загружаем переменные из .env (включая TELEGRAM_BOT_TOKEN)
load_dotenv()
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

if not BOT_TOKEN:
    raise RuntimeError("TELEGRAM_BOT_TOKEN is not set in .env")

bot = Bot(BOT_TOKEN)
dp = Dispatcher()

# ВРЕМЕННЫЙ URL MiniApp — позже подставим реальный (Vercel / ngrok)
MINIAPP_URL = "https://example.com"


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
        "Кнопкой ниже ты сможешь открыть мини-приложение LifeOS XP "
        "(как только мы задеплоим его по https).",
        reply_markup=keyboard,
    )


async def main():
    print("🤖 LifeOS Bot started")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())