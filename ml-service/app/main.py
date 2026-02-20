"""
KRISHI-AI ML Service
FastAPI application for scheme matching, ranking, and OCR processing.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.api import schemes, ocr, health, ai_chat
from app.core.config import settings
from app.services.rules_engine import RulesEngine
from app.services.ranking_engine import RankingEngine

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global engine instances
rules_engine: RulesEngine = None
ranking_engine: RankingEngine = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize and cleanup resources."""
    global rules_engine, ranking_engine
    
    logger.info("Loading scheme rules and ML models...")
    rules_engine = RulesEngine()
    ranking_engine = RankingEngine()
    
    logger.info("ML Service initialized successfully")
    yield
    
    logger.info("Shutting down ML Service")


app = FastAPI(
    title="KRISHI-AI ML Service",
    description="AI-powered scheme matching, ranking, and OCR for farmers",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, tags=["Health"])
app.include_router(schemes.router, prefix="/api/v1", tags=["Schemes"])
app.include_router(ocr.router, prefix="/api/v1", tags=["OCR"])
app.include_router(ai_chat.router, prefix="/api/v1", tags=["AI Chat"])


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "KRISHI-AI ML Service",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }


def get_rules_engine() -> RulesEngine:
    """Get the rules engine instance."""
    return rules_engine


def get_ranking_engine() -> RankingEngine:
    """Get the ranking engine instance."""
    return ranking_engine
