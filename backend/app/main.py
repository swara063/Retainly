from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router
from app.core.config import settings
from app.storage.local_store import ensure_storage

ensure_storage()

app = FastAPI(
    title="Attrition Intelligence Platform API",
    description="Explainable multi-agent HR attrition analytics platform",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=settings.CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")

@app.get("/")
def health_check():
    return {"service": "Attrition Intelligence Platform", "status": "running"}
