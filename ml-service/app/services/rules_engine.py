"""
Rules Engine for deterministic scheme eligibility matching.
"""

import yaml
import os
from typing import List, Dict, Any, Tuple, Optional
from app.models.schemas import FarmerProfile, RuleMatch
import logging
import psycopg2
from psycopg2.extras import RealDictCursor
from app.core.config import settings
import json

logger = logging.getLogger(__name__)


class RulesEngine:
    """
    Deterministic rules engine for scheme eligibility.
    Rules are defined in YAML format for easy editing by non-developers.
    """
    
    OPERATORS = {
        "==": lambda a, b: a == b,
        "!=": lambda a, b: a != b,
        "<": lambda a, b: float(a) < float(b),
        "<=": lambda a, b: float(a) <= float(b),
        ">": lambda a, b: float(a) > float(b),
        ">=": lambda a, b: float(a) >= float(b),
        "in": lambda a, b: a in b if isinstance(b, list) else str(a).lower() in str(b).lower(),
        "not_in": lambda a, b: a not in b if isinstance(b, list) else str(a).lower() not in str(b).lower(),
        "contains": lambda a, b: any(str(b).lower() in str(x).lower() for x in a) if isinstance(a, list) else str(b).lower() in str(a).lower(),
        "any_in": lambda a, b: any(x in b for x in a) if isinstance(a, list) else a in b,
        "equals": lambda a, b: str(a).lower() == str(b).lower(), # Add equals as alias and case-insensitive
    }
    
    def __init__(self, schemes_path: Optional[str] = None):
        """Initialize the rules engine with scheme definitions."""
        self.schemes_path = schemes_path or settings.schemes_data_path
        self.schemes = self.reload_schemes()
    
    def reload_schemes(self) -> List[Dict]:
        """Reload schemes from DB (primary) or YAML (fallback)."""
        schemes = self._load_schemes_from_db()
        if not schemes:
            logger.warning("Falling back to YAML for schemes")
            schemes = self._load_schemes_from_yaml()
        
        self.schemes = schemes
        logger.info(f"Loaded {len(self.schemes)} schemes into RulesEngine")
        return schemes
    
    def _load_schemes_from_db(self) -> List[Dict]:
        """Load scheme definitions from PostgreSQL."""
        try:
            conn = psycopg2.connect(settings.database_url)
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute("SELECT * FROM schemes WHERE is_active = TRUE")
            rows = cur.fetchall()
            
            schemes = []
            for row in rows:
                scheme = dict(row)
                # Convert eligibility_rules from JSONB to list of dicts if needed
                if isinstance(scheme.get('eligibility_rules'), str):
                    scheme['rules'] = json.loads(scheme['eligibility_rules'])
                else:
                    scheme['rules'] = scheme['eligibility_rules']
                
                # Ensure compatibility with existing logic
                scheme['max_benefit'] = float(scheme.get('benefit_estimate') or 0)
                schemes.append(scheme)
            
            cur.close()
            conn.close()
            return schemes
        except Exception as e:
            logger.error(f"Error loading schemes from DB: {e}")
            return []

    def _load_schemes_from_yaml(self) -> List[Dict]:
        """Load scheme definitions from YAML file."""
        try:
            with open(self.schemes_path, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)
                return data.get('schemes', [])
        except FileNotFoundError:
            logger.warning(f"Schemes file not found at {self.schemes_path}, using empty list")
            return []
        except Exception as e:
            logger.error(f"Error loading schemes: {e}")
            return []
    
    def _get_profile_value(self, profile: FarmerProfile, field: str) -> Any:
        """Extract a value from the profile by field name."""
        field_mapping = {
            "acreage": profile.acreage,
            "land_area": profile.acreage,
            "income": profile.annual_income,
            "annual_income": profile.annual_income,
            "family_count": profile.family_count,
            "family_size": profile.family_count,
            "state": profile.state.lower(),
            "district": profile.district.lower(),
            "land_type": profile.land_type.value,
            "farmer_type": profile.farmer_type.value,
            "crops": profile.main_crops,
            "main_crops": profile.main_crops,
            "education_level": profile.education_level.lower() if profile.education_level else "none",
            "irrigation_available": profile.irrigation_available,
            "loan_status": profile.loan_status.lower() if profile.loan_status else "none",
            "bank_account_linked": profile.bank_account_linked,
            "aadhaar_linked": profile.aadhaar_linked,
            "caste_category": profile.caste_category.lower() if profile.caste_category else "general",
            "livestock": profile.livestock,
            "soil_type": profile.soil_type.lower() if profile.soil_type else "unknown",
            "water_source": profile.water_source.lower() if profile.water_source else "rainfed",
            "machinery_owned": profile.machinery_owned,
        }
        return field_mapping.get(field.lower())
    
    def _evaluate_rule(self, rule: Dict, profile: FarmerProfile) -> RuleMatch:
        """Evaluate a single rule against a profile."""
        field = rule.get('field', '')
        operator = rule.get('operator', '==')
        expected_value = rule.get('value')
        rule_id = rule.get('id', f"{field}_{operator}")
        description = rule.get('description', f"{field} {operator} {expected_value}")
        
        actual_value = self._get_profile_value(profile, field)
        
        # Handle None values
        if actual_value is None:
            return RuleMatch(
                rule_id=rule_id,
                field=field,
                operator=operator,
                expected_value=expected_value,
                actual_value=None,
                passed=False,
                description=f"Field '{field}' not found in profile"
            )
        
        # Get operator function
        op_func = self.OPERATORS.get(operator)
        if not op_func:
            logger.warning(f"Unknown operator: {operator}")
            return RuleMatch(
                rule_id=rule_id,
                field=field,
                operator=operator,
                expected_value=expected_value,
                actual_value=actual_value,
                passed=False,
                description=f"Unknown operator: {operator}"
            )
        
        try:
            passed = op_func(actual_value, expected_value)
        except Exception as e:
            logger.warning(f"Error evaluating rule {rule_id}: {e}")
            passed = False
        
        return RuleMatch(
            rule_id=rule_id,
            field=field,
            operator=operator,
            expected_value=expected_value,
            actual_value=actual_value,
            passed=passed,
            description=description
        )
    
    def _evaluate_condition_group(
        self, 
        conditions: List[Dict], 
        profile: FarmerProfile,
        logic: str = "AND"
    ) -> Tuple[bool, List[RuleMatch], List[RuleMatch]]:
        """Evaluate a group of conditions with AND/OR logic."""
        matched_rules = []
        failing_rules = []
        
        for condition in conditions:
            # Check for nested groups
            if 'conditions' in condition:
                nested_logic = condition.get('logic', 'AND')
                nested_pass, nested_matched, nested_failed = self._evaluate_condition_group(
                    condition['conditions'], profile, nested_logic
                )
                if nested_pass:
                    matched_rules.extend(nested_matched)
                else:
                    failing_rules.extend(nested_failed)
            else:
                # Regular rule
                result = self._evaluate_rule(condition, profile)
                if result.passed:
                    matched_rules.append(result)
                else:
                    failing_rules.append(result)
        
        # Determine overall pass based on logic
        if logic.upper() == "AND":
            passed = len(failing_rules) == 0
        else:  # OR
            passed = len(matched_rules) > 0
        
        return passed, matched_rules, failing_rules
    
    def evaluate_scheme(
        self, 
        scheme: Dict, 
        profile: FarmerProfile
    ) -> Tuple[bool, List[RuleMatch], List[RuleMatch], float]:
        """
        Evaluate a scheme's rules against a profile.
        Returns: (is_eligible, matched_rules, failing_rules, confidence)
        """
        rules = scheme.get('rules', [])
        logic = scheme.get('rules_logic', 'AND')
        
        if not rules:
            return True, [], [], 1.0
        
        passed, matched_rules, failing_rules = self._evaluate_condition_group(
            rules, profile, logic
        )
        
        # Calculate confidence based on rule match ratio
        total_rules = len(matched_rules) + len(failing_rules)
        if total_rules > 0:
            confidence = len(matched_rules) / total_rules
        else:
            confidence = 1.0
        
        return passed, matched_rules, failing_rules, confidence
    
    def find_eligible_schemes(
        self, 
        profile: FarmerProfile,
        schemes: Optional[List[Dict[str, Any]]] = None
    ) -> List[Dict[str, Any]]:
        """
        Find all schemes the profile is eligible for.
        Returns list of dicts with scheme info and rule evaluation results.
        """
        results = []
        schemes_to_eval = schemes if schemes is not None else self.schemes
        
        for scheme in schemes_to_eval:
            is_eligible, matched, failing, confidence = self.evaluate_scheme(scheme, profile)
            
            results.append({
                "scheme": scheme,
                "is_eligible": is_eligible,
                "matched_rules": matched,
                "failing_rules": failing,
                "confidence": confidence
            })
        
        return results
    
    def get_scheme_by_id(self, scheme_id: str) -> Dict:
        """Get a scheme by its ID."""
        for scheme in self.schemes:
            if scheme.get('scheme_id') == scheme_id:
                return scheme
        return None
