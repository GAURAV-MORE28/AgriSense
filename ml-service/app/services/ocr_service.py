"""
OCR Service for document text extraction and parsing.
"""

import re
import base64
import io
import logging
from typing import Dict, List, Optional, Tuple
from Levenshtein import ratio as levenshtein_ratio

logger = logging.getLogger(__name__)

# Try to import pytesseract, fallback to mock if not available
try:
    import pytesseract
    from PIL import Image
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False
    logger.warning("pytesseract not available, using mock OCR")


class OCRService:
    """
    OCR service for extracting text from documents.
    Supports Aadhaar cards, land records, and other Indian documents.
    """
    
    # Regex patterns for Indian documents
    AADHAAR_PATTERN = r'\b\d{4}\s?\d{4}\s?\d{4}\b'
    PHONE_PATTERN = r'\b[6-9]\d{9}\b'
    PINCODE_PATTERN = r'\b\d{6}\b'
    NAME_PATTERN = r'(?:Name|नाम|नाव)[:\s]*([A-Za-z\s]+)'
    
    # Known document keywords
    DOC_KEYWORDS = {
        'aadhaar': ['aadhaar', 'आधार', 'uid', 'unique identification'],
        'land_record': ['land', 'भूमि', 'जमीन', 'khata', 'khasra', 'mutation'],
        'income_certificate': ['income', 'आय', 'certificate', 'प्रमाणपत्र'],
        'caste_certificate': ['caste', 'जाति', 'sc', 'st', 'obc'],
        'bank_passbook': ['bank', 'account', 'passbook', 'बैंक'],
    }
    
    def __init__(self):
        """Initialize OCR service."""
        self.tesseract_available = TESSERACT_AVAILABLE
        logger.info(f"OCR Service initialized (tesseract: {self.tesseract_available})")
    
    def _decode_base64_image(self, base64_string: str) -> Optional[bytes]:
        """Decode base64 image string to bytes."""
        try:
            # Remove data URL prefix if present
            if ',' in base64_string:
                base64_string = base64_string.split(',')[1]
            return base64.b64decode(base64_string)
        except Exception as e:
            logger.error(f"Error decoding base64 image: {e}")
            return None
    
    def _extract_text_tesseract(self, image_bytes: bytes) -> str:
        """Extract text using Tesseract OCR."""
        if not self.tesseract_available:
            return self._mock_ocr_text()
        
        try:
            image = Image.open(io.BytesIO(image_bytes))
            # Use both English and Hindi for better results
            text = pytesseract.image_to_string(image, lang='eng+hin')
            return text
        except Exception as e:
            logger.error(f"Tesseract OCR error: {e}")
            return ""
    
    def _mock_ocr_text(self) -> str:
        """Return mock OCR text for testing."""
        return """
        GOVERNMENT OF INDIA
        आधार - Aadhaar
        
        Name: Ramesh Kumar
        नाम: रमेश कुमार
        
        DOB: 15/08/1985
        Gender/लिंग: Male/पुरुष
        
        Address: Village Khed, District Pune
        Maharashtra - 411001
        
        1234 5678 9012
        
        Unique Identification Authority of India
        """
    
    def _detect_document_type(self, text: str) -> str:
        """Detect document type from extracted text."""
        text_lower = text.lower()
        
        for doc_type, keywords in self.DOC_KEYWORDS.items():
            if any(kw in text_lower for kw in keywords):
                return doc_type
        
        return "unknown"
    
    def _extract_aadhaar_number(self, text: str) -> Optional[str]:
        """Extract Aadhaar number from text."""
        matches = re.findall(self.AADHAAR_PATTERN, text)
        if matches:
            # Return the first valid 12-digit number
            return matches[0].replace(' ', '')
        return None
    
    def _extract_name(self, text: str) -> Optional[str]:
        """Extract name from text."""
        # Try English pattern first
        match = re.search(self.NAME_PATTERN, text, re.IGNORECASE)
        if match:
            return match.group(1).strip()
        
        # Fallback: look for lines with common name patterns
        lines = text.split('\n')
        for line in lines:
            if 'name' in line.lower():
                parts = line.split(':')
                if len(parts) > 1:
                    return parts[1].strip()
        
        return None
    
    def _extract_address(self, text: str) -> Optional[str]:
        """Extract address from text."""
        lines = text.split('\n')
        address_lines = []
        capture = False
        
        for line in lines:
            line = line.strip()
            if 'address' in line.lower() or 'पता' in line:
                capture = True
                # Get text after "Address:"
                parts = line.split(':')
                if len(parts) > 1:
                    address_lines.append(parts[1].strip())
            elif capture and line:
                if re.search(self.PINCODE_PATTERN, line):
                    address_lines.append(line)
                    break
                address_lines.append(line)
        
        return ' '.join(address_lines) if address_lines else None
    
    def _extract_fields(self, text: str, doc_type: str) -> Dict[str, str]:
        """Extract structured fields based on document type."""
        fields = {}
        
        # Common extractions
        aadhaar = self._extract_aadhaar_number(text)
        if aadhaar:
            fields['id_number'] = aadhaar
        
        name = self._extract_name(text)
        if name:
            fields['name'] = name
        
        address = self._extract_address(text)
        if address:
            fields['address'] = address
        
        # Phone number
        phone_match = re.search(self.PHONE_PATTERN, text)
        if phone_match:
            fields['phone'] = phone_match.group()
        
        # Pincode for geo hints
        pincode_match = re.search(self.PINCODE_PATTERN, text)
        if pincode_match:
            fields['geo_hints'] = f"PIN: {pincode_match.group()}"
        
        # Document-specific extractions
        if doc_type == 'land_record':
            # Look for land-specific fields
            khasra_match = re.search(r'khasra[:\s]*(\d+)', text, re.IGNORECASE)
            if khasra_match:
                fields['land_id'] = khasra_match.group(1)
        
        return fields
    
    def _calculate_confidence(self, text: str, fields: Dict) -> float:
        """Calculate OCR confidence based on extraction quality."""
        if not text:
            return 0.0
        
        confidence = 0.30  # Base for having any text
        
        # Text quality bonus
        if len(text) > 100:
            confidence += 0.15
        if len(text) > 300:
            confidence += 0.10
        
        # Key field bonuses (most important)
        if fields.get('aadhaar_number'):
            confidence += 0.15
        if fields.get('name'):
            confidence += 0.12
        if fields.get('address'):
            confidence += 0.10
        if fields.get('dob'):
            confidence += 0.05
        if fields.get('gender'):
            confidence += 0.03
        
        return round(min(confidence, 0.98), 2)
    
    def process_image(
        self, 
        image_base64: Optional[str] = None,
        image_bytes: Optional[bytes] = None,
        doc_type_hint: Optional[str] = None
    ) -> Dict:
        """
        Process an image and extract OCR data.
        
        Returns:
            Dict with doc_type_guess, fields, ocr_confidence, raw_text
        """
        # Get image bytes
        if image_base64:
            image_bytes = self._decode_base64_image(image_base64)
        
        if not image_bytes:
            # No real image — return mock data for demo
            logger.info("No image provided, returning mock OCR data")
            raw_text = self._mock_ocr_text()
        else:
            # Extract text from real image
            raw_text = self._extract_text_tesseract(image_bytes)
        
        # Detect document type
        doc_type = doc_type_hint or self._detect_document_type(raw_text)
        
        # Extract fields
        fields = self._extract_fields(raw_text, doc_type)
        
        # Calculate confidence
        confidence = self._calculate_confidence(raw_text, fields)
        
        return {
            "doc_type_guess": doc_type,
            "fields": fields,
            "ocr_confidence": round(confidence, 2),
            "raw_text": raw_text[:1000] if raw_text else None  # Truncate for response
        }
    
    def validate_against_profile(
        self, 
        ocr_fields: Dict[str, str], 
        profile_fields: Dict[str, str]
    ) -> List[Dict]:
        """
        Validate OCR fields against profile fields using fuzzy matching.
        
        Returns list of validation results with match scores.
        """
        validations = []
        
        for field, ocr_value in ocr_fields.items():
            if field in profile_fields:
                profile_value = str(profile_fields[field])
                ocr_value_str = str(ocr_value)
                
                # Calculate match score using Levenshtein ratio
                match_score = levenshtein_ratio(
                    ocr_value_str.lower(), 
                    profile_value.lower()
                )
                
                # Determine status
                if match_score >= 0.9:
                    status = "match"
                elif match_score >= 0.6:
                    status = "partial_match"
                else:
                    status = "mismatch"
                
                validation = {
                    "field": field,
                    "document_value": ocr_value_str,
                    "profile_value": profile_value,
                    "match_score": round(match_score, 2),
                    "status": status
                }
                
                # Add suggestion for mismatches
                if status == "mismatch":
                    validation["suggestion"] = f"Document shows '{ocr_value_str}' but profile has '{profile_value}'. Please verify."
                
                validations.append(validation)
        
        return validations
