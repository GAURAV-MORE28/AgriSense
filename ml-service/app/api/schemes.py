"""
API routes for scheme matching and recommendations.
"""

from fastapi import APIRouter, HTTPException, Depends
import time
import uuid
import logging

from app.models.schemas import (
    SchemeMatchRequest, 
    SchemeMatchResponse,
    FarmerProfile
)
from app.services.rules_engine import RulesEngine
from app.services.ranking_engine import RankingEngine

router = APIRouter()
logger = logging.getLogger(__name__)

# Lazy initialization of engines
_rules_engine = None
_ranking_engine = None


def get_rules_engine() -> RulesEngine:
    """Get or create rules engine instance."""
    global _rules_engine
    if _rules_engine is None:
        _rules_engine = RulesEngine()
    return _rules_engine


def get_ranking_engine() -> RankingEngine:
    """Get or create ranking engine instance."""
    global _ranking_engine
    if _ranking_engine is None:
        _ranking_engine = RankingEngine()
    return _ranking_engine


@router.post("/schemes/match", response_model=SchemeMatchResponse)
async def match_schemes(
    request: SchemeMatchRequest,
    rules_engine: RulesEngine = Depends(get_rules_engine),
    ranking_engine: RankingEngine = Depends(get_ranking_engine)
):
    """
    Match farmer profile against available schemes.
    
    Returns top K schemes ranked by eligibility and benefit score,
    with explainable AI output for each recommendation.
    """
    start_time = time.time()
    
    try:
        # Generate profile ID if not provided
        profile_id = request.profile.profile_id or str(uuid.uuid4())
        
        # Evaluate all schemes against the profile
        # Use provided schemes if available, otherwise fallback to engine defaults
        dynamic_schemes = [s.dict() for s in request.schemes] if request.schemes else None
        eligible_results = rules_engine.find_eligible_schemes(request.profile, dynamic_schemes)
        
        # Rank and get top recommendations
        recommendations = ranking_engine.rank_schemes(
            eligible_results,
            request.profile,
            request.documents,
            request.top_k
        )
        
        processing_time = (time.time() - start_time) * 1000
        
        logger.info(
            f"Scheme matching completed for profile {profile_id}: "
            f"{len(recommendations)} recommendations in {processing_time:.2f}ms"
        )
        
        return SchemeMatchResponse(
            profile_id=profile_id,
            total_schemes_evaluated=len(eligible_results),
            recommendations=recommendations,
            processing_time_ms=round(processing_time, 2)
        )
        
    except Exception as e:
        logger.error(f"Error in scheme matching: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Scheme matching failed: {str(e)}")


@router.get("/schemes")
async def list_schemes(
    rules_engine: RulesEngine = Depends(get_rules_engine)
):
    """
    List all available schemes.
    """
    schemes = rules_engine.schemes
    return {
        "total": len(schemes),
        "schemes": [
            {
                "scheme_id": s.get("scheme_id"),
                "name": s.get("name"),
                "name_hi": s.get("name_hi"),
                "name_mr": s.get("name_mr"),
                "category": s.get("category"),
                "max_benefit": s.get("max_benefit"),
                "description": s.get("description")
            }
            for s in schemes
        ]
    }


@router.get("/schemes/{scheme_id}")
async def get_scheme(
    scheme_id: str,
    rules_engine: RulesEngine = Depends(get_rules_engine)
):
    """
    Get details of a specific scheme.
    """
    scheme = rules_engine.get_scheme_by_id(scheme_id)
    if not scheme:
        raise HTTPException(status_code=404, detail="Scheme not found")
    return scheme


@router.post("/schemes/debug")
async def debug_match(
    request: SchemeMatchRequest,
    rules_engine: RulesEngine = Depends(get_rules_engine),
    ranking_engine: RankingEngine = Depends(get_ranking_engine)
):
    """
    Debug matching logic for a specific profile.
    Returns full trace of all rule evaluations.
    """
    try:
        dynamic_schemes = [s.dict() for s in request.schemes] if request.schemes else None
        
        # 1. Rules Evaluation Trace
        results = []
        schemes_to_eval = dynamic_schemes if dynamic_schemes else rules_engine.schemes
        
        for scheme in schemes_to_eval:
            is_eligible, matched, failing, confidence = rules_engine.evaluate_scheme(scheme, request.profile)
            
            # 2. Eligibility Engine Trace
            doc_names = [d.field_name for d in request.documents] if request.documents else None
            e_result = ranking_engine.eligibility_engine.calculate_score(
                scheme, request.profile, matched, failing, doc_names
            )
            
            # 3. Hybrid ML Trace
            success_prob = ranking_engine.hybrid_model.predict_probability(request.profile, scheme)
            
            results.append({
                "scheme_id": scheme.get('scheme_id'),
                "name": scheme.get('name'),
                "rules_eval": {
                    "is_eligible": is_eligible,
                    "confidence": confidence,
                    "matched_count": len(matched),
                    "failed_count": len(failing),
                    "details": {
                        "matched": [r.dict() for r in matched],
                        "failing": [r.dict() for r in failing]
                    }
                },
                "scoring_eval": e_result,
                "ml_eval": {
                    "success_probability": success_prob
                }
            })
            
        return {
            "profile": request.profile.dict(),
            "evaluation_trace": results
        }
    except Exception as e:
        logger.error(f"Debug match failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
