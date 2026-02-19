"""
API routes for OCR processing and document validation.
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import Optional
from pydantic import BaseModel
import logging
import base64

from app.models.schemas import OCRRequest, OCRResponse, ValidationResponse, ProfileValidation
from app.services.ocr_service import OCRService

router = APIRouter()
logger = logging.getLogger(__name__)

# OCR service instance
_ocr_service = None


def get_ocr_service() -> OCRService:
    """Get or create OCR service instance."""
    global _ocr_service
    if _ocr_service is None:
        _ocr_service = OCRService()
    return _ocr_service


@router.post("/ocr/process", response_model=OCRResponse)
async def process_document(request: OCRRequest):
    """
    Process a document image and extract text/fields using OCR.
    
    Accepts base64-encoded image or image URL.
    Returns extracted fields with confidence scores.
    """
    ocr_service = get_ocr_service()
    
    try:
        result = ocr_service.process_image(
            image_base64=request.image_base64,
            doc_type_hint=request.doc_type_hint
        )
        
        # Build response
        all_fields = [
            {
                "field_name": k,
                "value": v,
                "confidence": result["ocr_confidence"],
                "bounding_box": None
            }
            for k, v in result["fields"].items()
        ]
        
        return OCRResponse(
            doc_type_guess=result["doc_type_guess"],
            fields=result["fields"],
            all_fields=all_fields,
            ocr_confidence=result["ocr_confidence"],
            raw_text=result.get("raw_text"),
            validation_warnings=[]
        )
        
    except Exception as e:
        logger.error(f"OCR processing error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {str(e)}")


@router.post("/ocr/upload")
async def upload_and_process(
    file: UploadFile = File(...),
    doc_type_hint: Optional[str] = Form(None)
):
    """
    Upload a document image file and process with OCR.
    """
    ocr_service = get_ocr_service()
    
    try:
        # Read file content
        content = await file.read()
        
        # Process image
        result = ocr_service.process_image(
            image_bytes=content,
            doc_type_hint=doc_type_hint
        )
        
        # Build response
        all_fields = [
            {
                "field_name": k,
                "value": v,
                "confidence": result["ocr_confidence"],
                "bounding_box": None
            }
            for k, v in result["fields"].items()
        ]
        
        return {
            "filename": file.filename,
            "doc_type_guess": result["doc_type_guess"],
            "fields": result["fields"],
            "all_fields": all_fields,
            "ocr_confidence": result["ocr_confidence"],
            "validation_warnings": []
        }
        
    except Exception as e:
        logger.error(f"File upload OCR error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {str(e)}")


class ValidateRequest(BaseModel):
    """Request body for document validation."""
    ocr_fields: dict
    profile_fields: dict


@router.post("/ocr/validate", response_model=ValidationResponse)
async def validate_document(request: ValidateRequest):
    """
    Validate OCR-extracted fields against profile fields.
    
    Uses fuzzy matching to identify matches, partial matches, and mismatches.
    """
    ocr_service = get_ocr_service()
    
    try:
        validations = ocr_service.validate_against_profile(
            request.ocr_fields, request.profile_fields
        )
        
        # Determine overall match
        all_match = all(v["status"] in ["match", "partial_match"] for v in validations)
        
        # Generate suggestions
        suggestions = [
            v["suggestion"] for v in validations 
            if v.get("suggestion")
        ]
        
        return ValidationResponse(
            overall_match=all_match,
            validations=[ProfileValidation(**v) for v in validations],
            suggestions=suggestions
        )
        
    except Exception as e:
        logger.error(f"Validation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Validation failed: {str(e)}")
