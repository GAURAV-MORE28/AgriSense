"""
Pydantic models for request/response schemas.
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum


class LandType(str, Enum):
    IRRIGATED = "irrigated"
    DRY = "dry"
    MIXED = "mixed"


class FarmerType(str, Enum):
    OWNER = "owner"
    TENANT = "tenant"
    SHARECROPPER = "sharecropper"


class FarmerProfile(BaseModel):
    """Farmer profile for scheme matching."""
    profile_id: Optional[str] = None
    name: str
    mobile: str
    state: str
    district: str
    village: Optional[str] = None
    gps_lat: Optional[float] = None
    gps_lng: Optional[float] = None
    land_type: LandType
    acreage: float = Field(..., ge=0, description="Land area in hectares")
    main_crops: List[str]
    family_count: int = Field(..., ge=1)
    annual_income: float = Field(..., ge=0)
    farmer_type: FarmerType
    education_level: Optional[str] = "none"
    irrigation_available: Optional[bool] = False
    loan_status: Optional[str] = "none"
    bank_account_linked: Optional[bool] = False
    aadhaar_linked: Optional[bool] = False
    caste_category: Optional[str] = "general"
    livestock: List[str] = []
    soil_type: Optional[str] = "unknown"
    water_source: Optional[str] = "rainfed"
    machinery_owned: List[str] = []
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "Ramesh Kumar",
                "mobile": "9876543210",
                "state": "Maharashtra",
                "district": "Pune",
                "village": "Khed",
                "land_type": "irrigated",
                "acreage": 1.5,
                "main_crops": ["rice", "wheat"],
                "family_count": 4,
                "annual_income": 150000,
                "farmer_type": "owner"
            }
        }


class DocumentFields(BaseModel):
    """Extracted document fields."""
    doc_type: Optional[str] = None
    name: Optional[str] = None
    id_number: Optional[str] = None
    land_id: Optional[str] = None
    address: Optional[str] = None
    geo_hints: Optional[str] = None


class RuleDefinition(BaseModel):
    """Definition of a single eligibility rule."""
    field: str
    operator: str
    value: Any
    id: Optional[str] = None
    description: Optional[str] = None


class SchemeDefinition(BaseModel):
    """Definition of a scheme with matching rules."""
    scheme_id: str
    name: str
    name_hi: Optional[str] = None
    name_mr: Optional[str] = None
    category: str
    description: str
    max_benefit: float
    benefit_type: str = "fixed"  # "fixed", "per_hectare", "percentage"
    benefit_per_hectare: Optional[float] = None
    benefit_percentage: Optional[float] = None
    base_amount: Optional[float] = None
    priority_weight: float = 1.0
    rules_logic: str = "AND"
    rules: List[RuleDefinition] = []
    required_documents: List[str] = []


class SchemeMatchRequest(BaseModel):
    """Request for scheme matching."""
    profile: FarmerProfile
    schemes: Optional[List[SchemeDefinition]] = None  # Optional dynamic schemes
    documents: Optional[List[DocumentFields]] = None
    top_k: int = Field(default=10, ge=1, le=50)


class RuleMatch(BaseModel):
    """A matched or failed rule."""
    rule_id: str
    field: str
    operator: str
    expected_value: Any
    actual_value: Any
    passed: bool
    description: str


class SchemeRecommendation(BaseModel):
    """A recommended scheme with explainability."""
    scheme_id: str
    name: str
    name_hi: Optional[str] = None
    name_mr: Optional[str] = None
    score: float = Field(..., ge=0, le=100)
    benefit_estimate: float
    confidence: str  # "high", "medium", "low"
    matched_rules: List[RuleMatch]
    failing_rules: List[RuleMatch]
    why: List[str] = []  # Human-readable explainable AI reasons
    textual_explanation: str
    textual_explanation_hi: Optional[str] = None
    textual_explanation_mr: Optional[str] = None
    expected_documents: List[str]
    eligibility_status: str  # "eligible", "partially_eligible", "ineligible"
    eligibility_percentage: float = Field(..., ge=0, le=100)
    success_probability: float = Field(default=0.0, ge=0, le=1)
    confidence_score: float = Field(default=0.0, ge=0, le=1)


class SchemeMatchResponse(BaseModel):
    """Response with scheme recommendations."""
    profile_id: str
    total_schemes_evaluated: int
    recommendations: List[SchemeRecommendation]
    processing_time_ms: float


class OCRRequest(BaseModel):
    """OCR processing request."""
    image_base64: Optional[str] = None
    image_url: Optional[str] = None
    doc_type_hint: Optional[str] = None


class OCRField(BaseModel):
    """An extracted OCR field."""
    field_name: str
    value: str
    confidence: float
    bounding_box: Optional[Dict[str, int]] = None


class OCRResponse(BaseModel):
    """OCR processing response."""
    doc_type_guess: str
    fields: Dict[str, str]
    all_fields: List[OCRField]
    ocr_confidence: float
    raw_text: Optional[str] = None
    validation_warnings: List[str] = []


class ProfileValidation(BaseModel):
    """Document-profile validation result."""
    field: str
    document_value: str
    profile_value: str
    match_score: float
    status: str  # "match", "mismatch", "partial_match"
    suggestion: Optional[str] = None


class ValidationResponse(BaseModel):
    """Response from document-profile validation."""
    overall_match: bool
    validations: List[ProfileValidation]
    suggestions: List[str]
