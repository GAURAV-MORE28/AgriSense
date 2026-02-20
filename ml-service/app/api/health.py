"""
Health check endpoints for ML Service.
"""

from fastapi import APIRouter
import time

router = APIRouter()

# Track service start time
SERVICE_START_TIME = time.time()


@router.get("/health")
async def health_check():
    """Basic health check endpoint."""
    return {
        "status": "healthy",
        "service": "krishi-ai-ml-service",
        "uptime_seconds": round(time.time() - SERVICE_START_TIME, 2)
    }


@router.get("/health/ready")
async def readiness_check():
    """Readiness check for kubernetes."""
    # Check if all components are ready
    try:
        from app.services.rules_engine import RulesEngine
        engine = RulesEngine()
        schemes_loaded = len(engine.schemes) > 0
    except Exception:
        schemes_loaded = False
    
    return {
        "ready": schemes_loaded,
        "checks": {
            "schemes_loaded": schemes_loaded
        }
    }


@router.get("/metrics")
async def metrics():
    """Basic Prometheus-style metrics endpoint."""
    uptime = time.time() - SERVICE_START_TIME
    
    metrics_text = f"""# HELP krishi_ml_uptime_seconds Service uptime in seconds
# TYPE krishi_ml_uptime_seconds gauge
krishi_ml_uptime_seconds {uptime:.2f}

# HELP krishi_ml_health Service health status (1=healthy, 0=unhealthy)
# TYPE krishi_ml_health gauge
krishi_ml_health 1
"""
    return metrics_text
