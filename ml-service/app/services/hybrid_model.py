"""
Hybrid ML Model combining deterministic rules with Logistic Regression.
"""

import os
import joblib
import logging
import numpy as np
from typing import List, Dict, Any, Optional
from app.models.schemas import FarmerProfile

logger = logging.getLogger(__name__)

class HybridModel:
    """
    Hybrid model for scheme eligibility prediction.
    Features: [land_size, income, crop_match, irrigation, state_match, farmer_type, docs_count]
    """
    
    def __init__(self, model_path: Optional[str] = None):
        self.model_path = model_path or os.path.join(
            os.path.dirname(__file__), "..", "..", "models", "eligibility_model.pkl"
        )
        self.model = self._load_model()
        
    def _load_model(self):
        try:
            if os.path.exists(self.model_path):
                return joblib.load(self.model_path)
            logger.warning(f"Model not found at {self.model_path}. Using rules-only fallback.")
            return None
        except Exception as e:
            logger.error(f"Error loading model: {e}")
            return None

    def _prepare_features(self, profile: FarmerProfile, scheme: Dict) -> np.ndarray:
        """
        Creates feature vector: [land_size, income, crop_match, irrigation, state_match, farmer_type, docs_count]
        """
        # Feature 1: Land size (normalized)
        land_size = float(profile.acreage) / 10.0
        
        # Feature 2: Income (normalized)
        income = float(profile.annual_income) / 1000000.0
        
        # Feature 3: Crop Match (0 or 1)
        scheme_crops = scheme.get('main_crops', []) or []
        crop_match = 1.0 if not scheme_crops or any(c in scheme_crops for c in profile.main_crops) else 0.0
        
        # Feature 4: Irrigation (0 or 1)
        irrigation = 1.0 if profile.irrigation_available else 0.0
        
        # Feature 5: State Match (0 or 1)
        scheme_state = scheme.get('state')
        state_match = 1.0 if not scheme_state or profile.state.lower() == scheme_state.lower() else 0.0
        
        # Feature 6: Farmer Type
        f_type_map = {"owner": 1.0, "tenant": 0.5, "sharecropper": 0.3}
        farmer_type = f_type_map.get(profile.farmer_type.value if hasattr(profile.farmer_type, 'value') else profile.farmer_type, 0.0)
        
        # Feature 7: Docs Count
        docs_count = len(scheme.get('required_documents', [])) / 5.0
        
        return np.array([land_size, income, crop_match, irrigation, state_match, farmer_type, docs_count]).reshape(1, -1)

    def predict_probability(self, profile: FarmerProfile, scheme: Dict) -> float:
        """
        Predict probability of eligibility (0.0 to 1.0).
        """
        if self.model is None:
            return 0.5 # Default middle probability if model fails
            
        try:
            X = self._prepare_features(profile, scheme)
            # Some models might not have predict_proba if not calibrated
            if hasattr(self.model, "predict_proba"):
                prob = self.model.predict_proba(X)[0][1] # Probability of class 1
            else:
                prob = float(self.model.predict(X)[0])
            return float(prob)
        except Exception as e:
            logger.error(f"ML prediction error: {e}")
            return 0.5
