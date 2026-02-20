"""
Ranking Engine for ML-based scheme scoring and recommendation.
"""

import logging
from typing import List, Dict, Any
from app.models.schemas import (
    FarmerProfile, SchemeRecommendation, RuleMatch, DocumentFields
)
from app.services.eligibility_engine import EligibilityScoringEngine
from app.services.hybrid_model import HybridModel
import numpy as np

logger = logging.getLogger(__name__)


class RankingEngine:
    """
    ML-based ranking engine for scheme recommendations.
    Combines rule-based eligibility with ML scoring for ranking.
    """
    
    def __init__(self, model_path: str = None):
        """Initialize the ranking engine."""
        self.model_path = model_path
        self.eligibility_engine = EligibilityScoringEngine()
        self.hybrid_model = HybridModel(model_path)
        logger.info("Ranking engine initialized with HybridModel")
    
    def _calculate_rank_score(
        self, 
        eligibility_score: float,
        scheme: Dict, 
        profile: FarmerProfile,
        doc_readiness: float,
        success_prob: float = 0.85
    ) -> float:
        """
        Ranking Score =
        0.35 * eligibility_score
        0.25 * estimated_benefit_weight
        0.15 * priority_scheme_weight
        0.10 * document_readiness
        0.10 * success_probability
        0.05 * recency_weight
        """
        # 1. Eligibility (0.35)
        s1 = 0.35 * eligibility_score
        
        # 2. Benefit Weight (0.25)
        benefit = self._estimate_benefit(scheme, profile)
        benefit_weight = min((benefit / 50000) * 100, 100)
        s2 = 0.25 * benefit_weight
        
        # 3. Priority Weight (0.15)
        priority = float(scheme.get('priority_weight', 1.0)) * 100
        s3 = 0.15 * min(priority, 100)
        
        # 4. Document Readiness (0.10)
        s4 = 0.10 * (doc_readiness * 100)
        
        # 5. Success Probability (0.10)
        s5 = 0.10 * (success_prob * 100)
        
        # 6. Recency Weight (0.05) - Default 1.0 for now
        s6 = 0.05 * 100
        
        total_score = s1 + s2 + s3 + s4 + s5 + s6
        return min(max(round(total_score, 2), 0), 100)
    
    def _estimate_benefit(self, scheme: Dict, profile: FarmerProfile) -> float:
        """Estimate the monetary benefit for this profile."""
        max_benefit = scheme.get('max_benefit', 10000)
        benefit_type = scheme.get('benefit_type', 'fixed')
        
        if benefit_type == 'per_hectare':
            per_hectare = scheme.get('benefit_per_hectare', 5000)
            return min(per_hectare * profile.acreage, max_benefit)
        elif benefit_type == 'percentage':
            percentage = scheme.get('benefit_percentage', 50)
            base_amount = scheme.get('base_amount', 10000)
            return min(base_amount * (percentage / 100), max_benefit)
        else:
            return max_benefit
    
    def _get_confidence_level(self, confidence: float) -> str:
        """Convert numeric confidence to level."""
        if confidence >= 0.8:
            return "high"
        elif confidence >= 0.5:
            return "medium"
        return "low"
    
    def _get_eligibility_status(
        self, 
        is_eligible: bool, 
        confidence: float
    ) -> str:
        """Determine eligibility status."""
        if is_eligible and confidence >= 0.8:
            return "eligible"
        elif is_eligible or confidence >= 0.5:
            return "partially_eligible"
        return "ineligible"
    
    def _build_why_array(
        self,
        matched_rules: List[RuleMatch],
        failing_rules: List[RuleMatch]
    ) -> List[str]:
        """Build human-readable 'why' array for explainable AI."""
        why = []
        for r in matched_rules:
            # Convert rule to readable format e.g. "Land <= 2 hectares", "Crop wheat matched"
            if r.operator in ["==", "in"] and r.expected_value:
                if isinstance(r.expected_value, list):
                    val_str = ", ".join(str(v) for v in r.expected_value[:3])
                else:
                    val_str = str(r.expected_value)
                why.append(f"{r.field.replace('_', ' ').title()} {r.operator} {val_str}")
            elif r.operator in ["<", "<=", ">", ">="] and r.actual_value is not None:
                why.append(f"{r.field.replace('_', ' ').title()} {r.operator} {r.expected_value} ✓")
            elif r.description:
                why.append(r.description)
        for r in failing_rules[:2]:  # Limit failing reasons
            why.append(f"✗ {r.description}")
        return why[:8]  # Max 8 reasons

    def _generate_explanation(
        self, 
        scheme: Dict, 
        matched_rules: List[RuleMatch],
        failing_rules: List[RuleMatch],
        benefit: float
    ) -> Dict[str, str]:
        """Generate human-readable explanations in multiple languages."""
        scheme_name = scheme.get('name', 'This scheme')
        
        # English explanation
        if len(failing_rules) == 0:
            en = f"You are fully eligible for {scheme_name}. "
            en += f"You could receive up to ₹{benefit:,.0f}. "
            if matched_rules:
                en += f"Key qualifications: {matched_rules[0].description}"
        elif len(matched_rules) > len(failing_rules):
            en = f"You are partially eligible for {scheme_name}. "
            en += f"Potential benefit: ₹{benefit:,.0f}. "
            en += f"Missing: {failing_rules[0].description}"
        else:
            en = f"Currently not eligible for {scheme_name}. "
            en += f"Main reason: {failing_rules[0].description}"
        
        # Hindi explanation
        if len(failing_rules) == 0:
            hi = f"आप {scheme.get('name_hi', scheme_name)} के लिए पूर्ण रूप से पात्र हैं। "
            hi += f"आपको ₹{benefit:,.0f} तक मिल सकते हैं।"
        else:
            hi = f"आप {scheme.get('name_hi', scheme_name)} के लिए आंशिक रूप से पात्र हैं।"
        
        # Marathi explanation
        if len(failing_rules) == 0:
            mr = f"तुम्ही {scheme.get('name_mr', scheme_name)} साठी पूर्णपणे पात्र आहात। "
            mr += f"तुम्हाला ₹{benefit:,.0f} पर्यंत मिळू शकतात।"
        else:
            mr = f"तुम्ही {scheme.get('name_mr', scheme_name)} साठी अंशतः पात्र आहात।"
        
        return {"en": en, "hi": hi, "mr": mr}
    
    def rank_schemes(
        self,
        eligible_results: List[Dict[str, Any]],
        profile: FarmerProfile,
        documents: List[DocumentFields] = None,
        top_k: int = 10
    ) -> List[SchemeRecommendation]:
        """
        Rank schemes and return top K recommendations with explainability.
        """
        recommendations = []
        
        for result in eligible_results:
            scheme = result['scheme']
            matched_rules = result['matched_rules']
            failing_rules = result['failing_rules']
            
            # Use the new Eligibility Scoring Engine
            doc_names = [d.field_name for d in documents] if documents else None
            e_result = self.eligibility_engine.calculate_score(
                scheme, profile, matched_rules, failing_rules, doc_names
            )
            
            eligibility_score = e_result['eligibility_score']
            doc_readiness = e_result['category_scores'].get('documents', 0.5)
            
            # Predict success probability using Hybrid ML Model
            success_prob = self.hybrid_model.predict_probability(profile, scheme)
            
            # Calculate final multi-factor rank score
            rank_score = self._calculate_rank_score(
                eligibility_score, scheme, profile, doc_readiness, success_prob
            )
            
            benefit = self._estimate_benefit(scheme, profile)
            
            # Generate explanations
            explanations = self._generate_explanation(
                scheme, matched_rules, failing_rules, benefit
            )
            
            why_array = self._build_why_array(matched_rules, failing_rules)

            recommendation = SchemeRecommendation(
                scheme_id=scheme.get('scheme_id', ''),
                name=scheme.get('name', ''),
                name_hi=scheme.get('name_hi'),
                name_mr=scheme.get('name_mr'),
                score=rank_score,
                benefit_estimate=benefit,
                confidence=self._get_confidence_level(eligibility_score / 100),
                matched_rules=matched_rules,
                failing_rules=failing_rules,
                why=why_array,
                textual_explanation=explanations['en'],
                textual_explanation_hi=explanations['hi'],
                textual_explanation_mr=explanations['mr'],
                expected_documents=scheme.get('required_documents', []),
                eligibility_status=e_result['eligibility_status'],
                eligibility_percentage=eligibility_score,
                success_probability=success_prob,
                confidence_score=eligibility_score / 100.0
            )
            recommendations.append(recommendation)
        
        # Sort by score (descending) and eligibility
        recommendations.sort(
            key=lambda x: (
                0 if x.eligibility_status == "eligible" else 
                1 if x.eligibility_status == "partially_eligible" else 2,
                -x.score
            )
        )
        
        return recommendations[:top_k]
