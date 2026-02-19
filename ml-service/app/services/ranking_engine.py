"""
Ranking Engine for ML-based scheme scoring and recommendation.
"""

import logging
from typing import List, Dict, Any
from app.models.schemas import (
    FarmerProfile, SchemeRecommendation, RuleMatch, DocumentFields
)

logger = logging.getLogger(__name__)


class RankingEngine:
    """
    ML-based ranking engine for scheme recommendations.
    Combines rule-based eligibility with ML scoring for ranking.
    """
    
    def __init__(self, model_path: str = None):
        """Initialize the ranking engine."""
        self.model = None
        self.model_path = model_path
        # For prototype, we use heuristic scoring
        # In production, load a trained LightGBM/sklearn model
        logger.info("Ranking engine initialized (heuristic mode)")
    
    def _calculate_benefit_score(
        self, 
        scheme: Dict, 
        profile: FarmerProfile,
        confidence: float,
        is_eligible: bool
    ) -> float:
        """
        Calculate score using: score = eligibility_score * benefit_weight * profile_match
        """
        # eligibility_score: 0-1 based on rule match
        eligibility_score = confidence if is_eligible else max(0.2, confidence * 0.5)

        # benefit_weight: normalized by scheme benefit (0-1 scale)
        max_benefit = scheme.get('max_benefit', 10000)
        priority_weight = scheme.get('priority_weight', 1.0)
        benefit_weight = min((max_benefit / 500000) * priority_weight, 1.0)

        # profile_match: how well profile fits (acreage, income, etc.)
        acreage_factor = min(profile.acreage / 5.0, 1.0)
        income_factor = 1.0 - min(profile.annual_income / 500000, 0.8)
        profile_match = 0.5 + 0.25 * acreage_factor + 0.25 * income_factor

        score = eligibility_score * benefit_weight * profile_match * 100
        return min(max(round(score, 2), 0), 100)
    
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
            is_eligible = result['is_eligible']
            matched_rules = result['matched_rules']
            failing_rules = result['failing_rules']
            confidence = result['confidence']
            
            # Calculate scores: eligibility_score * benefit_weight * profile_match
            score = self._calculate_benefit_score(scheme, profile, confidence, is_eligible)
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
                score=round(score, 2),
                benefit_estimate=benefit,
                confidence=self._get_confidence_level(confidence),
                matched_rules=matched_rules,
                failing_rules=failing_rules,
                why=why_array,
                textual_explanation=explanations['en'],
                textual_explanation_hi=explanations['hi'],
                textual_explanation_mr=explanations['mr'],
                expected_documents=scheme.get('required_documents', []),
                eligibility_status=self._get_eligibility_status(is_eligible, confidence)
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
