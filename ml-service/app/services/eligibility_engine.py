"""
Eligibility Scoring Engine for weighted scheme match calculation.
"""

import logging
from typing import List, Dict, Any, Tuple
from app.models.schemas import FarmerProfile, RuleMatch

logger = logging.getLogger(__name__)

class EligibilityScoringEngine:
    """
    Computes precise eligibility scores (0-100) based on weighted factors.
    """
    
    # REQUIRED FORMULA
    # Land Match -> 20%
    # Income Match -> 20%
    # Crop Match -> 20%
    # Location Match -> 15%
    # Farmer Type -> 10%
    # Document Readiness -> 10%
    # Special Conditions -> 5%
    
    WEIGHTS = {
        "land": 0.20,
        "income": 0.20,
        "crop": 0.20,
        "location": 0.15,
        "farmentype": 0.10,
        "documents": 0.10,
        "special": 0.05
    }

    def calculate_score(
        self, 
        scheme: Dict[str, Any], 
        profile: FarmerProfile, 
        matched_rules: List[RuleMatch],
        failing_rules: List[RuleMatch],
        available_documents: List[str] = None
    ) -> Dict[str, Any]:
        """
        Calculates a weighted eligibility score.
        """
        # Map fields to categories for weighting
        categories = {
            "land": ["acreage", "land_area", "land_type"],
            "income": ["income", "annual_income"],
            "crop": ["crops", "main_crops"],
            "location": ["state", "district", "village"],
            "farmentype": ["farmer_type"],
            "documents": [], # Handled separately
            "special": [
                "irrigation_available", "caste_category", "livestock", 
                "soil_type", "water_source", "machinery_owned", "education_level",
                "bank_account_linked", "aadhaar_linked", "loan_status"
            ]
        }
        
        cat_scores = {}
        all_rules = matched_rules + failing_rules
        
        # Helper to get score for a category
        def get_cat_score(category_fields):
            cat_rules = [r for r in all_rules if r.field.lower() in category_fields]
            if not cat_rules:
                return 1.0 # Default to full pass if no rules for this category
            
            passed_cat = [r for r in cat_rules if r.passed]
            return len(passed_cat) / len(cat_rules)

        # Calculate scores for core rule categories
        for cat in ["land", "income", "crop", "location", "farmentype", "special"]:
            cat_scores[cat] = get_cat_score(categories[cat])

        # Document readiness (10%)
        required_docs = scheme.get('required_documents', [])
        if not required_docs:
            cat_scores["documents"] = 1.0
        else:
            # Check against profile.aadhaar_linked, bank_account_linked etc. if doc names match
            # But the requirement says "Document readiness" - if documents list is provided in request
            if available_documents is not None:
                matches = 0
                for doc in required_docs:
                    if any(doc.lower() in ad.lower() for ad in available_documents):
                        matches += 1
                cat_scores["documents"] = matches / len(required_docs)
            else:
                cat_scores["documents"] = 0.5 # Unknown baseline

        # Compute weighted sum
        weighted_score = 0
        for cat, weight in self.WEIGHTS.items():
            weighted_score += cat_scores.get(cat, 1.0) * weight
            
        final_percentage = round(weighted_score * 100, 2)
        
        # Determine label and status
        # Eligible (>=70)
        # Partial (40-69)
        # Not Eligible (<40)
        if final_percentage >= 70:
            label = "Eligible"
            status = "eligible"
        elif final_percentage >= 40:
            label = "Partial"
            status = "partially_eligible"
        else:
            label = "Not Eligible"
            status = "ineligible"
            
        return {
            "eligibility_score": final_percentage,
            "match_percentage": final_percentage,
            "eligibility_label": label,
            "eligibility_status": status,
            "category_scores": cat_scores,
            "is_fully_eligible": all(r.passed for r in all_rules) if all_rules else True
        }
