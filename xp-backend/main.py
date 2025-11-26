from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict

app = FastAPI()


# ----- Модели запроса/ответа -----

class XpClaimRequest(BaseModel):
    userId: str
    initData: str
    taskId: Optional[str] = None
    amount: Optional[int] = None


class XpClaimResponse(BaseModel):
    ok: bool
    awardedXp: Optional[int] = None
    totalXp: Optional[int] = None
    error: Optional[str] = None


# ----- Временная "БД" в памяти (потом заменим на реальную) -----

_fake_xp_db: Dict[str, int] = {}


def get_user_xp(user_id: str) -> int:
    return _fake_xp_db.get(user_id, 0)


def set_user_xp(user_id: str, xp: int) -> None:
    _fake_xp_db[user_id] = xp


# ----- Служебный healthcheck -----

@app.get("/health")
async def health():
    return {"ok": True}


# ----- Основной эндпоинт XP -----

@app.post("/xp/claim", response_model=XpClaimResponse)
async def xp_claim(payload: XpClaimRequest) -> XpClaimResponse:
    user_id = payload.userId
    init_data = payload.initData
    task_id = payload.taskId or "unknown"
    amount = payload.amount

    # TODO: позже добавим настоящую проверку подписи Telegram по initData
    if not init_data:
        raise HTTPException(status_code=400, detail="INIT_DATA_REQUIRED")

    # Простое правило выдачи XP:
    # если amount передан — используем его, иначе даём фикс 100 XP
    base_award = amount if amount is not None else 100

    current_xp = get_user_xp(user_id)
    new_total_xp = current_xp + base_award
    set_user_xp(user_id, new_total_xp)

    print(f"[XP] user={user_id} task={task_id} +{base_award}XP total={new_total_xp}")

    return XpClaimResponse(
        ok=True,
        awardedXp=base_award,
        totalXp=new_total_xp,
    )