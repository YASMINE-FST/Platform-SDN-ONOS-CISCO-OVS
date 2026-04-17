import asyncio
import bcrypt
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def fix():
    engine = create_async_engine(
        "postgresql+asyncpg://netguard:netguard_secret@db:5432/netguard"
    )
    async with engine.begin() as conn:
        h = bcrypt.hashpw(b"Admin@NetGuard1", bcrypt.gensalt()).decode()
        await conn.execute(
            text("UPDATE users SET hashed_password = :h WHERE email = 'admin@sdn.local'"),
            {"h": h}
        )
        print("Done! Hash:", h)

asyncio.run(fix())