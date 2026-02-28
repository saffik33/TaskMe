import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from .config import settings, check_jwt_secret
from .database import check_database_url, create_db_and_tables, migrate_custom_fields_column, migrate_add_user_support, migrate_assign_orphan_data, seed_core_columns
from .routers import auth, columns, export, parse, share, tasks

limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    check_database_url()
    check_jwt_secret()
    create_db_and_tables()
    migrate_custom_fields_column()
    migrate_add_user_support()
    migrate_assign_orphan_data()
    seed_core_columns()
    yield


docs_enabled = not os.getenv("RAILWAY_ENVIRONMENT")

app = FastAPI(
    title="TaskMe API",
    description="AI-Powered Task Management Application",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if docs_enabled else None,
    redoc_url="/redoc" if docs_enabled else None,
)

frontend_url = os.getenv("FRONTEND_URL", settings.FRONTEND_URL)
allowed_origins = [
    frontend_url,
    "https://frontend-production-c90f0.up.railway.app",
    "http://localhost:5173",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    from fastapi.responses import JSONResponse
    return JSONResponse(status_code=429, content={"detail": "Too many requests. Please try again later."})


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response: Response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


app.include_router(auth.router, prefix="/api/v1")
app.include_router(tasks.router, prefix="/api/v1")
app.include_router(parse.router, prefix="/api/v1")
app.include_router(export.router, prefix="/api/v1")
# app.include_router(email.router, prefix="/api/v1")  # Disabled — SMTP not configured
app.include_router(share.router, prefix="/api/v1")
app.include_router(columns.router, prefix="/api/v1")


@app.get("/")
def root():
    return {"message": "TaskMe API is running"}
