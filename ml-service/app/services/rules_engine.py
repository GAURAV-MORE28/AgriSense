"""
Rules Engine for deterministic scheme eligibility matching.
"""

import yaml
import os
from typing import List, Dict, Any, Tuple
from app.models.schemas import FarmerProfile, RuleMatch
import logging

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
    }
    
    def __init__(self, schemes_path: str = None):
        """Initialize the rules engine with scheme definitions."""
        self.schemes_path = schemes_path or os.path.join(
            os.path.dirname(__file__), "..", "..", "data", "schemes.yaml"
        )
        self.schemes = self._load_schemes()
        logger.info(f"Loaded {len(self.schemes)} schemes from {self.schemes_path}")
    
    def _load_schemes(self) -> List[Dict]:
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
        profile: FarmerProfile
    ) -> List[Dict[str, Any]]:
        """
        Find all schemes the profile is eligible for.
        Returns list of dicts with scheme info and rule evaluation results.
        """
        results = []
        
        for scheme in self.schemes:
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
