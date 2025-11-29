import asyncio
import os

from aiogram import Bot, Dispatcher, types
from aiogram.filters import CommandStart
from aiogram.types import ReplyKeyboardMarkup, KeyboardButton, WebAppInfo
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

# рабочий прод-URL
MINIAPP_URL = "https://lifeos-webapp.vercel.app"

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
        "Добро пожаловать в LifeOS XP Mini App.\n"
        "Нажми кнопку ниже, чтобы открыть приложение.",
        reply_markup=keyboard,
    )


async def main():
    print("🤖 LifeOS Bot started")
    print(f"➡ MINIAPP_URL = {MINIAPP_URL}")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())