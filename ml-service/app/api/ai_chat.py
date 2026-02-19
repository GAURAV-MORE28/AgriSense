"""
Intelligent AI Chatbot with RAG-style scheme search and profile-aware responses.

Features:
- Loads all schemes from YAML dataset
- Searches schemes by keywords, category, eligibility
- Uses farmer profile context for personalized responses
- Detects user intent (greeting, scheme search, eligibility, documents, application, crop guidance)
- Generates dynamic responses using templates + real data
- Supports English, Hindi, Marathi
- Includes follow-up suggestions
"""

from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import yaml
import os
import re

router = APIRouter()

# ─── Load schemes dataset ────────────────────────────────────────
SCHEMES_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'schemes.yaml')
SCHEMES_DATA: List[Dict[str, Any]] = []

def load_schemes():
    global SCHEMES_DATA
    try:
        with open(SCHEMES_PATH, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
            SCHEMES_DATA = data if isinstance(data, list) else data.get('schemes', [])
    except Exception as e:
        print(f"Warning: Could not load schemes: {e}")
        SCHEMES_DATA = []

load_schemes()

# ─── Intent Detection ────────────────────────────────────────────

INTENT_PATTERNS = {
    'greeting': {
        'en': [r'\b(hi|hello|hey|good morning|good evening|namaste)\b'],
        'hi': [r'(नमस्ते|नमस्कार|हैलो|हाय)'],
        'mr': [r'(नमस्कार|नमस्ते|हॅलो)']
    },
    'scheme_search': {
        'en': [r'\b(scheme|yojana|subsidy|grant|benefit|which|find|search|recommend|eligible|list|available)\b'],
        'hi': [r'(योजना|सब्सिडी|अनुदान|लाभ|कौन|खोज|सूची|पात्र)'],
        'mr': [r'(योजना|अनुदान|लाभ|कोणत|शोध|यादी|पात्र)']
    },
    'pm_kisan': {
        'en': [r'\bpm.?kisan\b', r'\bkisan samman\b', r'\b6000\b.*\byear\b'],
        'hi': [r'पीएम.?किसान', r'किसान सम्मान'],
        'mr': [r'पीएम.?किसान', r'किसान सन्मान']
    },
    'insurance': {
        'en': [r'\b(insurance|pmfby|fasal bima|crop insurance|bima)\b'],
        'hi': [r'(बीमा|फसल बीमा|पीएमएफबीवाई)'],
        'mr': [r'(विमा|पीक विमा)']
    },
    'kcc': {
        'en': [r'\b(kcc|kisan credit|credit card|loan|kcl)\b'],
        'hi': [r'(केसीसी|किसान क्रेडिट|ऋण|कर्ज)'],
        'mr': [r'(केसीसी|किसान क्रेडिट|कर्ज)']
    },
    'documents': {
        'en': [r'\b(document|paper|aadhaar|aadhar|upload|ocr|scan|certificate)\b'],
        'hi': [r'(दस्तावेज|कागज|आधार|अपलोड|प्रमाणपत्र)'],
        'mr': [r'(कागदपत्र|आधार|अपलोड|प्रमाणपत्र)']
    },
    'application': {
        'en': [r'\b(apply|application|how to|process|step|procedure|register|form)\b'],
        'hi': [r'(आवेदन|प्रक्रिया|कैसे|पंजीकरण|फॉर्म)'],
        'mr': [r'(अर्ज|प्रक्रिया|कसे|नोंदणी|फॉर्म)']
    },
    'eligibility': {
        'en': [r'\b(eligib|qualify|criteria|requirement|condition|who can)\b'],
        'hi': [r'(पात्रता|योग्यता|शर्तें|कौन.*मिल|आवश्यकता)'],
        'mr': [r'(पात्रता|अटी|कोण.*मिळ|आवश्यकता)']
    },
    'crop_guidance': {
        'en': [r'\b(crop|farming|harvest|season|sowing|irrigation|fertilizer|soil|pest)\b'],
        'hi': [r'(फसल|खेती|बुवाई|सिंचाई|उर्वरक|मिट्टी|कीट)'],
        'mr': [r'(पीक|शेती|पेरणी|सिंचन|खत|माती|कीड)']
    },
    'solar': {
        'en': [r'\b(solar|kusum|pump|panel|renewable|energy)\b'],
        'hi': [r'(सोलर|कुसुम|पंप|पैनल|ऊर्जा)'],
        'mr': [r'(सोलर|कुसुम|पंप|पॅनेल|ऊर्जा)']
    }
}


def detect_intent(message: str, language: str = 'en') -> str:
    """Detect the user's intent from their message."""
    msg_lower = message.lower()
    
    # Check each intent's patterns
    scores: Dict[str, int] = {}
    for intent, lang_patterns in INTENT_PATTERNS.items():
        score = 0
        # Check patterns for the specified language
        for pat in lang_patterns.get(language, []):
            if re.search(pat, msg_lower, re.IGNORECASE):
                score += 2
        # Also check English patterns as fallback
        if language != 'en':
            for pat in lang_patterns.get('en', []):
                if re.search(pat, msg_lower, re.IGNORECASE):
                    score += 1
        if score > 0:
            scores[intent] = score
    
    if not scores:
        return 'general'
    
    return max(scores, key=scores.get)


# ─── Scheme Search (RAG-style retrieval) ─────────────────────────

def search_schemes(query: str, profile: Dict = None, top_k: int = 5) -> List[Dict]:
    """Search schemes by keyword matching against names, descriptions, categories, and benefits."""
    query_lower = query.lower()
    query_words = set(re.findall(r'\w+', query_lower))
    
    scored_schemes = []
    for scheme in SCHEMES_DATA:
        score = 0
        name = (scheme.get('name', '') or '').lower()
        desc = (scheme.get('description', '') or '').lower()
        category = (scheme.get('category', '') or '').lower()
        benefits = str(scheme.get('benefits', '')).lower()
        
        # Name match (highest weight)
        name_words = set(re.findall(r'\w+', name))
        name_overlap = len(query_words & name_words)
        score += name_overlap * 5
        
        # Exact substring match in name
        if query_lower in name:
            score += 10
        
        # Category match
        if query_lower in category or category in query_lower:
            score += 4
        
        # Description match
        desc_words = set(re.findall(r'\w+', desc))
        desc_overlap = len(query_words & desc_words)
        score += desc_overlap * 2
        
        # Benefits match
        benefits_words = set(re.findall(r'\w+', benefits))
        score += len(query_words & benefits_words)
        
        # Profile-based boosting
        if profile:
            rules = scheme.get('eligibility_rules', scheme.get('rules', []))
            if isinstance(rules, list):
                for rule in rules:
                    field = rule.get('field', '')
                    value = rule.get('value', '')
                    
                    if field == 'state' and profile.get('state', '').lower() == str(value).lower():
                        score += 3
                    if field == 'acreage' and profile.get('acreage'):
                        score += 1
                    if field == 'farmer_type' and profile.get('farmer_type', '').lower() == str(value).lower():
                        score += 2
                    if field == 'annual_income' and profile.get('annual_income'):
                        score += 1
        
        if score > 0:
            scored_schemes.append((score, scheme))
    
    scored_schemes.sort(key=lambda x: x[0], reverse=True)
    return [s[1] for s in scored_schemes[:top_k]]


def check_eligibility(scheme: Dict, profile: Dict) -> Dict:
    """Check if a farmer is eligible for a scheme based on rules."""
    if not profile:
        return {'eligible': 'unknown', 'reason': 'No profile available'}
    
    rules = scheme.get('eligibility_rules', scheme.get('rules', []))
    if not isinstance(rules, list) or len(rules) == 0:
        return {'eligible': 'likely', 'reason': 'No specific rules defined'}
    
    passed = []
    failed = []
    
    for rule in rules:
        field = rule.get('field', '')
        operator = rule.get('operator', '')
        value = rule.get('value', '')
        profile_value = profile.get(field)
        
        if profile_value is None:
            continue
        
        rule_desc = f"{field} {operator} {value}"
        
        try:
            if operator == 'equals':
                if str(profile_value).lower() == str(value).lower():
                    passed.append(rule_desc)
                else:
                    failed.append(rule_desc)
            elif operator == 'in':
                vals = [v.strip().lower() for v in str(value).split(',')] if isinstance(value, str) else [str(v).lower() for v in value]
                if str(profile_value).lower() in vals:
                    passed.append(rule_desc)
                else:
                    failed.append(rule_desc)
            elif operator == 'lte':
                if float(profile_value) <= float(value):
                    passed.append(rule_desc)
                else:
                    failed.append(rule_desc)
            elif operator == 'gte':
                if float(profile_value) >= float(value):
                    passed.append(rule_desc)
                else:
                    failed.append(rule_desc)
            elif operator == 'lt':
                if float(profile_value) < float(value):
                    passed.append(rule_desc)
                else:
                    failed.append(rule_desc)
            elif operator == 'contains':
                if isinstance(profile_value, list):
                    if str(value).lower() in [str(v).lower() for v in profile_value]:
                        passed.append(rule_desc)
                    else:
                        failed.append(rule_desc)
        except (ValueError, TypeError):
            pass
    
    if failed:
        return {'eligible': 'no', 'passed': passed, 'failed': failed}
    elif passed:
        return {'eligible': 'yes', 'passed': passed, 'failed': []}
    return {'eligible': 'likely', 'reason': 'Insufficient data to fully determine'}


# ─── Response Generation ─────────────────────────────────────────

def format_scheme_info(scheme: Dict, lang: str = 'en') -> str:
    """Format a single scheme into readable text."""
    name = scheme.get('name', 'Unknown Scheme')
    desc = scheme.get('description', '')
    benefits = scheme.get('benefits', '')
    category = scheme.get('category', '')
    docs = scheme.get('required_documents', scheme.get('documents_required', []))
    
    if lang == 'en':
        text = f"📋 **{name}**"
        if category:
            text += f" ({category})"
        text += f"\n{desc}"
        if benefits:
            text += f"\n💰 Benefits: {benefits}"
        if docs and isinstance(docs, list):
            text += f"\n📝 Documents: {', '.join(docs[:4])}"
        return text
    elif lang == 'hi':
        text = f"📋 **{name}**"
        if desc:
            text += f"\n{desc}"
        if benefits:
            text += f"\n💰 लाभ: {benefits}"
        return text
    else:  # mr
        text = f"📋 **{name}**"
        if desc:
            text += f"\n{desc}"
        if benefits:
            text += f"\n💰 फायदे: {benefits}"
        return text


def generate_response(intent: str, message: str, profile: Dict = None, language: str = 'en', history: List = None) -> Dict:
    """Generate a context-aware response based on intent, profile, and scheme data."""
    
    lang = language if language in ['en', 'hi', 'mr'] else 'en'
    farmer_name = profile.get('name', '') if profile else ''
    greeting = f"{farmer_name}ji, " if farmer_name and lang != 'en' else (f"{farmer_name}, " if farmer_name else '')
    
    suggestions = []
    response = ''
    
    if intent == 'greeting':
        responses = {
            'en': f"Hello {greeting.strip(' ,')}! 🌾 I'm your Krishi-AI assistant. I can help you find government schemes, check eligibility, explain benefits, and guide you through applications. How can I help you today?",
            'hi': f"नमस्ते {greeting.strip(' ,')}! 🌾 मैं आपका कृषि-AI सहायक हूं। मैं सरकारी योजनाएं खोजने, पात्रता जांचने, लाभ समझाने और आवेदन में मदद कर सकता हूं। आज मैं आपकी कैसे मदद करूं?",
            'mr': f"नमस्कार {greeting.strip(' ,')}! 🌾 मी तुमचा कृषि-AI सहाय्यक आहे. मी सरकारी योजना शोधणे, पात्रता तपासणे, लाभ समजावणे आणि अर्ज करण्यात मदत करू शकतो. आज मी तुम्हाला कशी मदत करू?",
        }
        response = responses[lang]
        suggestions = {
            'en': ['Find schemes for me', 'Am I eligible for PM-KISAN?', 'What documents do I need?', 'How to apply for crop insurance?'],
            'hi': ['मेरे लिए योजनाएं खोजें', 'क्या मैं पीएम-किसान के लिए पात्र हूं?', 'कौन से दस्तावेज चाहिए?', 'फसल बीमा कैसे मिलेगा?'],
            'mr': ['माझ्यासाठी योजना शोधा', 'मी पीएम-किसान पात्र आहे का?', 'कोणती कागदपत्रे लागतात?', 'पीक विमा कसा मिळेल?'],
        }[lang]
    
    elif intent == 'scheme_search':
        # Search for matching schemes
        results = search_schemes(message, profile, top_k=5)
        
        if results:
            if lang == 'en':
                response = f"{greeting}Based on your query, here are the most relevant schemes:\n\n"
            elif lang == 'hi':
                response = f"{greeting}आपकी खोज के आधार पर, ये सबसे प्रासंगिक योजनाएं हैं:\n\n"
            else:
                response = f"{greeting}तुमच्या शोधाच्या आधारे, या सर्वात संबंधित योजना आहेत:\n\n"
            
            for i, scheme in enumerate(results[:3], 1):
                response += f"{i}. {format_scheme_info(scheme, lang)}\n\n"
            
            if len(results) > 3:
                more = len(results) - 3
                if lang == 'en':
                    response += f"...and {more} more schemes available. Ask me about any specific scheme for details!"
                elif lang == 'hi':
                    response += f"...और {more} योजनाएं उपलब्ध हैं। किसी भी योजना के बारे में पूछें!"
                else:
                    response += f"...आणि {more} योजना उपलब्ध आहेत. कोणत्याही योजनेबद्दल विचारा!"
            
            # Generate suggestions based on top results
            top_scheme = results[0].get('name', '')
            suggestions = {
                'en': [f'Tell me about {top_scheme}', f'Am I eligible for {top_scheme}?', 'Show all schemes', 'What documents do I need?'],
                'hi': [f'{top_scheme} बताएं', f'क्या मैं {top_scheme} के लिए पात्र हूं?', 'सभी योजनाएं दिखाएं', 'कौन से दस्तावेज चाहिए?'],
                'mr': [f'{top_scheme} सांगा', f'मी {top_scheme} पात्र आहे का?', 'सर्व योजना दाखवा', 'कोणती कागदपत्रे लागतात?'],
            }[lang]
        else:
            response = {
                'en': f"{greeting}I couldn't find specific schemes matching your query. Try asking about:\n• PM-KISAN (income support)\n• Crop Insurance (PMFBY)\n• Kisan Credit Card\n• Solar Pump Subsidy\n• Soil Health Card\n\nOr tell me about your farming needs, and I'll recommend suitable schemes!",
                'hi': f"{greeting}आपकी खोज से मेल खाती योजना नहीं मिली। इनके बारे में पूछें:\n• पीएम-किसान\n• फसल बीमा\n• किसान क्रेडिट कार्ड\n• सोलर पंप सब्सिडी\n\nअपनी खेती की जरूरतें बताएं, मैं उचित योजनाएं सुझाऊंगा!",
                'mr': f"{greeting}तुमच्या शोधाशी जुळणारी योजना सापडली नाही. यांबद्दल विचारा:\n• पीएम-किसान\n• पीक विमा\n• किसान क्रेडिट कार्ड\n• सोलर पंप अनुदान\n\nतुमच्या शेती गरजा सांगा, मी योग्य योजना सुचवतो!",
            }[lang]
            suggestions = {
                'en': ['Show PM-KISAN details', 'Crop insurance schemes', 'Credit schemes for farmers', 'Schemes for my state'],
                'hi': ['पीएम-किसान दिखाएं', 'फसल बीमा योजनाएं', 'किसान क्रेडिट योजनाएं', 'मेरे राज्य की योजनाएं'],
                'mr': ['पीएम-किसान दाखवा', 'पीक विमा योजना', 'किसान क्रेडिट योजना', 'माझ्या राज्यातील योजना'],
            }[lang]
    
    elif intent in ('pm_kisan', 'insurance', 'kcc', 'solar'):
        # Search for the specific scheme type
        search_map = {
            'pm_kisan': 'PM-KISAN',
            'insurance': 'insurance crop fasal bima',
            'kcc': 'Kisan Credit Card KCC',
            'solar': 'solar kusum pump'
        }
        results = search_schemes(search_map[intent], profile, top_k=3)
        
        if results:
            scheme = results[0]
            response = format_scheme_info(scheme, lang) + "\n\n"
            
            # Add eligibility check if profile available
            if profile:
                elig = check_eligibility(scheme, profile)
                if elig['eligible'] == 'yes':
                    elig_text = {'en': '✅ Based on your profile, you appear ELIGIBLE for this scheme!', 
                                'hi': '✅ आपकी प्रोफाइल के अनुसार, आप इस योजना के लिए पात्र दिखते हैं!',
                                'mr': '✅ तुमच्या प्रोफाइलनुसार, तुम्ही या योजनेसाठी पात्र दिसता!'}
                elif elig['eligible'] == 'no':
                    elig_text = {'en': f"⚠️ Based on your profile, you may NOT be eligible. Issues: {', '.join(elig.get('failed', []))}",
                                'hi': f"⚠️ आपकी प्रोफाइल के अनुसार, आप पात्र नहीं लगते। समस्याएं: {', '.join(elig.get('failed', []))}",
                                'mr': f"⚠️ तुमच्या प्रोफाइलनुसार, तुम्ही पात्र नाही. समस्या: {', '.join(elig.get('failed', []))}"}
                else:
                    elig_text = {'en': 'ℹ️ Please complete your profile for a full eligibility check.',
                                'hi': 'ℹ️ पूर्ण पात्रता जांच के लिए प्रोफाइल पूरा करें।',
                                'mr': 'ℹ️ संपूर्ण पात्रता तपासणीसाठी प्रोफाइल पूर्ण करा.'}
                response += elig_text[lang]
            
            scheme_name = scheme.get('name', '')
            suggestions = {
                'en': [f'How to apply for {scheme_name}?', f'Documents needed for {scheme_name}', 'Show similar schemes', 'Check my eligibility'],
                'hi': [f'{scheme_name} कैसे आवेदन करें?', f'{scheme_name} के दस्तावेज', 'समान योजनाएं दिखाएं', 'मेरी पात्रता जांचें'],
                'mr': [f'{scheme_name} कसे अर्ज करावे?', f'{scheme_name} कागदपत्रे', 'समान योजना दाखवा', 'माझी पात्रता तपासा'],
            }[lang]
        else:
            response = _get_fallback(intent, lang, greeting)
            suggestions = _get_default_suggestions(lang)
    
    elif intent == 'eligibility':
        if not profile:
            response = {
                'en': "To check your eligibility, I need your farmer profile. Please go to the Profile section and fill in your details (land size, crops, income, etc.), then come back and ask me!",
                'hi': "पात्रता जांचने के लिए आपकी किसान प्रोफाइल चाहिए। कृपया प्रोफाइल सेक्शन में अपनी जानकारी भरें, फिर मुझसे पूछें!",
                'mr': "पात्रता तपासण्यासाठी तुमचे शेतकरी प्रोफाइल लागते. कृपया प्रोफाइल विभागात माहिती भरा, नंतर मला विचारा!",
            }[lang]
            suggestions = {
                'en': ['Go to Profile', 'What information do I need?', 'Show all schemes'],
                'hi': ['प्रोफाइल पर जाएं', 'कौन सी जानकारी चाहिए?', 'सभी योजनाएं दिखाएं'],
                'mr': ['प्रोफाइल वर जा', 'कोणती माहिती लागते?', 'सर्व योजना दाखवा'],
            }[lang]
        else:
            # Check eligibility against all schemes
            eligible_schemes = []
            for scheme in SCHEMES_DATA[:20]:
                elig = check_eligibility(scheme, profile)
                if elig['eligible'] in ('yes', 'likely'):
                    eligible_schemes.append(scheme)
            
            if eligible_schemes:
                if lang == 'en':
                    response = f"{greeting}Based on your profile ({profile.get('acreage', '?')} acres, {profile.get('state', '?')}), you may be eligible for these schemes:\n\n"
                elif lang == 'hi':
                    response = f"{greeting}आपकी प्रोफाइल ({profile.get('acreage', '?')} एकड़, {profile.get('state', '?')}) के अनुसार, आप इन योजनाओं के लिए पात्र हो सकते हैं:\n\n"
                else:
                    response = f"{greeting}तुमच्या प्रोफाइलनुसार ({profile.get('acreage', '?')} एकर, {profile.get('state', '?')}), तुम्ही या योजनांसाठी पात्र असू शकता:\n\n"
                
                for i, scheme in enumerate(eligible_schemes[:5], 1):
                    response += f"{i}. 📋 {scheme.get('name', '')} — {scheme.get('benefits', '')}\n"
                
                if len(eligible_schemes) > 5:
                    more = len(eligible_schemes) - 5
                    extras = {'en': f'\n...and {more} more!', 'hi': f'\n...और {more} और!', 'mr': f'\n...आणि {more} अधिक!'}
                    response += extras[lang]
            else:
                response = {
                    'en': f"{greeting}I couldn't find exact matches. Try updating your profile with complete details for better results.",
                    'hi': f"{greeting}सही मैच नहीं मिला। बेहतर परिणामों के लिए प्रोफाइल पूरा करें।",
                    'mr': f"{greeting}अचूक जुळणी सापडली नाही. चांगल्या परिणामांसाठी प्रोफाइल पूर्ण करा.",
                }[lang]
            
            suggestions = {
                'en': ['Show all schemes', 'How to apply?', 'What documents do I need?', 'Tell me about PM-KISAN'],
                'hi': ['सभी योजनाएं दिखाएं', 'कैसे आवेदन करें?', 'कौन से दस्तावेज चाहिए?', 'पीएम-किसान बताएं'],
                'mr': ['सर्व योजना दाखवा', 'कसे अर्ज करावे?', 'कोणती कागदपत्रे लागतात?', 'पीएम-किसान सांगा'],
            }[lang]
    
    elif intent == 'documents':
        response = {
            'en': f"{greeting}For most government schemes, you'll need:\n\n📄 **Essential Documents:**\n• Aadhaar Card (linked to mobile)\n• Land Records (7/12 extract or ROR)\n• Bank Passbook (with IFSC)\n• Passport-size Photo\n\n📄 **Additional (scheme-specific):**\n• Income Certificate\n• Caste Certificate (for reserved categories)\n• Crop Sowing Certificate\n• Soil Health Card\n\n💡 You can upload documents in the Documents section — our OCR will auto-extract details!",
            'hi': f"{greeting}अधिकांश सरकारी योजनाओं के लिए चाहिए:\n\n📄 **आवश्यक दस्तावेज:**\n• आधार कार्ड (मोबाइल से लिंक)\n• भूमि अभिलेख (7/12 या ROR)\n• बैंक पासबुक (IFSC सहित)\n• पासपोर्ट फोटो\n\n📄 **अतिरिक्त (योजना अनुसार):**\n• आय प्रमाण पत्र\n• जाति प्रमाण पत्र\n• फसल बुवाई प्रमाणपत्र\n• मिट्टी स्वास्थ्य कार्ड\n\n💡 डॉक्यूमेंट सेक्शन में अपलोड करें — OCR स्वचालित रूप से जानकारी निकालेगा!",
            'mr': f"{greeting}बहुतांश सरकारी योजनांसाठी लागतात:\n\n📄 **आवश्यक कागदपत्रे:**\n• आधार कार्ड (मोबाइलला लिंक)\n• जमीन नोंद (7/12 उतारा)\n• बँक पासबुक (IFSC सह)\n• पासपोर्ट फोटो\n\n📄 **अतिरिक्त (योजनेनुसार):**\n• उत्पन्न प्रमाणपत्र\n• जात प्रमाणपत्र\n• पीक पेरणी प्रमाणपत्र\n• मृदा आरोग्य कार्ड\n\n💡 कागदपत्रे विभागात अपलोड करा — OCR स्वयंचलितपणे माहिती काढेल!",
        }[lang]
        suggestions = {
            'en': ['Upload a document', 'Which schemes need Aadhaar?', 'How does OCR work?', 'Check my eligibility'],
            'hi': ['दस्तावेज अपलोड करें', 'किन योजनाओं में आधार चाहिए?', 'OCR कैसे काम करता है?', 'मेरी पात्रता जांचें'],
            'mr': ['कागदपत्र अपलोड करा', 'कोणत्या योजनांना आधार लागते?', 'OCR कसे काम करते?', 'माझी पात्रता तपासा'],
        }[lang]
    
    elif intent == 'application':
        response = {
            'en': f"{greeting}Here's the general application process:\n\n1️⃣ **Complete your Profile** — Fill in land, crop, and income details\n2️⃣ **Upload Documents** — Aadhaar, land records, bank passbook\n3️⃣ **Check Schemes** — Visit the Schemes page for matched schemes\n4️⃣ **Apply** — Click 'Apply' on any eligible scheme\n5️⃣ **Track Status** — Check application status in My Applications\n\n⏱️ Most applications are processed within 2-4 weeks. You'll receive updates via the app.",
            'hi': f"{greeting}आवेदन प्रक्रिया:\n\n1️⃣ **प्रोफाइल पूरा करें** — जमीन, फसल, आय भरें\n2️⃣ **दस्तावेज अपलोड करें** — आधार, भूमि अभिलेख, पासबुक\n3️⃣ **योजनाएं देखें** — मैच होती योजनाएं देखें\n4️⃣ **आवेदन करें** — पात्र योजना पर 'आवेदन' दबाएं\n5️⃣ **स्थिति जांचें** — आवेदन की प्रगति देखें\n\n⏱️ अधिकांश आवेदन 2-4 सप्ताह में संसाधित होते हैं।",
            'mr': f"{greeting}अर्ज प्रक्रिया:\n\n1️⃣ **प्रोफाइल पूर्ण करा** — जमीन, पीक, उत्पन्न भरा\n2️⃣ **कागदपत्रे अपलोड करा** — आधार, जमीन नोंद, पासबुक\n3️⃣ **योजना पहा** — जुळणाऱ्या योजना पहा\n4️⃣ **अर्ज करा** — पात्र योजनेवर 'अर्ज करा' दाबा\n5️⃣ **स्थिती तपासा** — अर्जाची प्रगती पहा\n\n⏱️ बहुतांश अर्ज 2-4 आठवड्यांत प्रक्रिया होतात.",
        }[lang]
        suggestions = {
            'en': ['Find schemes for me', 'Upload documents', 'Check my applications', 'What documents do I need?'],
            'hi': ['मेरे लिए योजनाएं खोजें', 'दस्तावेज अपलोड करें', 'मेरे आवेदन देखें', 'कौन से दस्तावेज चाहिए?'],
            'mr': ['योजना शोधा', 'कागदपत्रे अपलोड करा', 'माझे अर्ज तपासा', 'कोणती कागदपत्रे लागतात?'],
        }[lang]
    
    elif intent == 'crop_guidance':
        state = profile.get('state', '') if profile else ''
        crops = profile.get('main_crops', []) if profile else []
        crops_str = ', '.join(crops) if crops else 'your crops'
        
        response = {
            'en': f"{greeting}Here's some farming guidance:\n\n🌾 **For {crops_str}:**\n• Check weather forecasts before sowing\n• Use certified seeds from government centers\n• Apply for Soil Health Card for fertilizer recommendations\n• Consider drip/sprinkler irrigation for water efficiency\n• Register for Crop Insurance (PMFBY) before cut-off dates\n\n🔬 **Government Support:**\n• Free soil testing at KVK centers\n• Subsidized seeds and fertilizers via DBT\n• Training programs at agricultural universities\n\nWant me to find specific schemes for {crops_str}?",
            'hi': f"{greeting}खेती मार्गदर्शन:\n\n🌾 **{crops_str} के लिए:**\n• बुवाई से पहले मौसम देखें\n• सरकारी केंद्रों से प्रमाणित बीज लें\n• मिट्टी स्वास्थ्य कार्ड बनवाएं\n• ड्रिप/स्प्रिंकलर सिंचाई अपनाएं\n• फसल बीमा (PMFBY) कराएं\n\n🔬 **सरकारी सहायता:**\n• KVK में मुफ्त मिट्टी परीक्षण\n• DBT से सब्सिडी वाले बीज-खाद\n• कृषि विश्वविद्यालयों में प्रशिक्षण",
            'mr': f"{greeting}शेती मार्गदर्शन:\n\n🌾 **{crops_str} साठी:**\n• पेरणीपूर्वी हवामान पहा\n• सरकारी केंद्रांवरून प्रमाणित बियाणे घ्या\n• मृदा आरोग्य कार्ड बनवा\n• ठिबक/तुषार सिंचन वापरा\n• पीक विमा (PMFBY) करा\n\n🔬 **सरकारी मदत:**\n• KVK मध्ये मोफत माती तपासणी\n• DBT द्वारे अनुदानित बियाणे-खत\n• कृषी विद्यापीठांत प्रशिक्षण",
        }[lang]
        suggestions = {
            'en': [f'Schemes for {crops_str}', 'Irrigation schemes', 'Soil testing centers', 'Organic farming schemes'],
            'hi': [f'{crops_str} की योजनाएं', 'सिंचाई योजनाएं', 'मिट्टी परीक्षण केंद्र', 'जैविक खेती योजनाएं'],
            'mr': [f'{crops_str} योजना', 'सिंचन योजना', 'माती तपासणी केंद्र', 'सेंद्रिय शेती योजना'],
        }[lang]
    
    else:  # general / unknown intent
        # Try scheme search as fallback with the full message
        results = search_schemes(message, profile, top_k=3)
        if results and len(results) > 0:
            if lang == 'en':
                response = f"{greeting}I found some schemes that might be relevant:\n\n"
            elif lang == 'hi':
                response = f"{greeting}कुछ संबंधित योजनाएं मिलीं:\n\n"
            else:
                response = f"{greeting}काही संबंधित योजना सापडल्या:\n\n"
            
            for i, scheme in enumerate(results[:3], 1):
                response += f"{i}. {format_scheme_info(scheme, lang)}\n\n"
            
            suggestions = {
                'en': ['Tell me more about these', 'Check my eligibility', 'How to apply?', 'Show different schemes'],
                'hi': ['इनके बारे में और बताएं', 'मेरी पात्रता जांचें', 'कैसे आवेदन करें?', 'अलग योजनाएं दिखाएं'],
                'mr': ['यांबद्दल अधिक सांगा', 'माझी पात्रता तपासा', 'कसे अर्ज करावे?', 'वेगळ्या योजना दाखवा'],
            }[lang]
        else:
            response = {
                'en': f"{greeting}I'm your Krishi-AI assistant! I can help you with:\n\n🎯 **Find Schemes** — Discover government schemes you're eligible for\n📋 **Check Eligibility** — Verify if you qualify for specific schemes\n📄 **Documents** — Know what documents you need\n📝 **Apply** — Step-by-step application guidance\n🌾 **Crop Guidance** — Farming tips and resources\n\nWhat would you like to know?",
                'hi': f"{greeting}मैं आपका कृषि-AI सहायक हूं! मैं इनमें मदद कर सकता हूं:\n\n🎯 **योजना खोजें** — पात्र सरकारी योजनाएं\n📋 **पात्रता जांचें** — योग्यता जांच\n📄 **दस्तावेज** — जरूरी कागजात\n📝 **आवेदन** — आवेदन मार्गदर्शन\n🌾 **फसल मार्गदर्शन** — खेती सुझाव\n\nआप क्या जानना चाहेंगे?",
                'mr': f"{greeting}मी तुमचा कृषि-AI सहाय्यक आहे! मी यांमध्ये मदत करू शकतो:\n\n🎯 **योजना शोधा** — पात्र सरकारी योजना\n📋 **पात्रता तपासा** — योग्यता तपासणी\n📄 **कागदपत्रे** — आवश्यक कागदपत्रे\n📝 **अर्ज** — अर्ज मार्गदर्शन\n🌾 **पीक मार्गदर्शन** — शेती सल्ले\n\nतुम्हाला काय जाणून घ्यायचे आहे?",
            }[lang]
            suggestions = _get_default_suggestions(lang)
    
    return {
        'response': response,
        'suggestions': suggestions,
        'intent': intent,
        'schemes_found': len(search_schemes(message, profile, top_k=5)) if intent != 'greeting' else 0
    }


def _get_fallback(intent: str, lang: str, greeting: str) -> str:
    """Fallback responses for specific intents when no schemes found."""
    fallbacks = {
        'pm_kisan': {
            'en': f"{greeting}PM-KISAN Samman Nidhi provides ₹6,000/year to small farmers (≤2 hectares). You need Aadhaar, land records, and bank passbook. Visit pmkisan.gov.in to apply.",
            'hi': f"{greeting}पीएम-किसान सम्मान निधि छोटे किसानों (≤2 हेक्टेयर) को ₹6,000/वर्ष देती है। आधार, भूमि अभिलेख और पासबुक चाहिए।",
            'mr': f"{greeting}पीएम-किसान सन्मान निधी लहान शेतकऱ्यांना (≤2 हेक्टर) ₹6,000/वर्ष देते. आधार, जमीन नोंद आणि पासबुक लागते.",
        },
        'insurance': {
            'en': f"{greeting}PM Fasal Bima Yojana (PMFBY) offers crop insurance at low premium. Contact your bank during sowing season or visit pmfby.gov.in.",
            'hi': f"{greeting}पीएम फसल बीमा योजना कम प्रीमियम पर फसल बीमा देती है। बुवाई के मौसम में बैंक से संपर्क करें।",
            'mr': f"{greeting}पीएम पीक विमा योजना कमी प्रीमियमवर पीक विमा देते. पेरणीच्या हंगामात बँकेला संपर्क करा.",
        },
        'kcc': {
            'en': f"{greeting}Kisan Credit Card (KCC) provides credit at 4% interest. Minimum 0.5 hectare land required. Visit your nearest bank to apply.",
            'hi': f"{greeting}किसान क्रेडिट कार्ड 4% ब्याज पर ऋण देता है। न्यूनतम 0.5 हेक्टेयर जमीन चाहिए। नजदीकी बैंक जाएं।",
            'mr': f"{greeting}किसान क्रेडिट कार्ड 4% व्याजावर कर्ज देते. किमान 0.5 हेक्टर जमीन लागते. जवळच्या बँकेला भेट द्या.",
        },
        'solar': {
            'en': f"{greeting}PM-KUSUM scheme provides solar pump subsidies (60-90%). Suitable for farmers with 0.5+ hectare land. Contact your district agriculture office.",
            'hi': f"{greeting}पीएम-कुसुम योजना सोलर पंप पर 60-90% सब्सिडी देती है। 0.5+ हेक्टेयर जमीन वालों के लिए। जिला कृषि कार्यालय संपर्क करें।",
            'mr': f"{greeting}पीएम-कुसुम योजना सोलर पंपवर 60-90% अनुदान देते. 0.5+ हेक्टर जमीनधारकांसाठी. जिल्हा कृषी कार्यालयाशी संपर्क करा.",
        }
    }
    return fallbacks.get(intent, {}).get(lang, f"{greeting}I can help you find information about government schemes!")


def _get_default_suggestions(lang: str) -> List[str]:
    """Default suggestions when no specific context."""
    return {
        'en': ['Find schemes for me', 'What is PM-KISAN?', 'How to get crop insurance?', 'What documents do I need?'],
        'hi': ['मेरे लिए योजनाएं खोजें', 'पीएम-किसान क्या है?', 'फसल बीमा कैसे मिलेगा?', 'कौन से दस्तावेज चाहिए?'],
        'mr': ['माझ्यासाठी योजना शोधा', 'पीएम-किसान काय आहे?', 'पीक विमा कसा मिळेल?', 'कोणती कागदपत्रे लागतात?'],
    }.get(lang, ['Find schemes for me', 'What is PM-KISAN?', 'How to get crop insurance?', 'What documents do I need?'])


# ─── Request / Response Models ────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    language: Optional[str] = 'en'
    profile: Optional[Dict[str, Any]] = None
    history: Optional[List[Dict[str, str]]] = None
    context: Optional[Dict[str, Any]] = None

class ChatResponse(BaseModel):
    response: str
    suggestions: List[str] = []
    intent: str = ''
    schemes_found: int = 0
    language: str = 'en'
    timestamp: Optional[str] = None


# ─── API Endpoint ────────────────────────────────────────────────

@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, req: Request = None):
    """
    Intelligent AI chat endpoint.
    Detects intent, searches scheme database, checks eligibility,
    and generates context-aware multilingual responses.
    
    Features:
    - Dynamic response generation based on user intent
    - Profile-aware scheme recommendations
    - Multi-turn conversation support
    - Fallback responses when schemes not found
    """
    try:
        message = request.message.strip() if request.message else ""
        if not message:
            return ChatResponse(
                response="Please provide a message.",
                suggestions=_get_default_suggestions('en'),
                intent='error',
                language='en'
            )
        
        language = request.language or 'en'
        if language not in ['en', 'hi', 'mr']:
            language = 'en'
        
        profile = request.profile or {}
        history = request.history or []
        context = request.context or {}
        
        # Detect user intent with conversation context
        intent = detect_intent(message, language)
        
        # Boost intent detection if conversation length suggests continuation
        conversation_length = context.get('conversationLength', 0)
        if conversation_length > 0 and intent == 'general':
            # Check if previous intents can help contextualize
            previous_intents = context.get('previousIntents', [])
            if previous_intents and len(previous_intents) > 0:
                # Use previous context to inform response
                pass
        
        # Generate contextual response
        result = generate_response(intent, message, profile, language, history)
        
        return ChatResponse(
            response=result['response'],
            suggestions=result.get('suggestions', [])[:4],  # Limit to 4 suggestions
            intent=result.get('intent', intent),
            schemes_found=result.get('schemes_found', 0),
            language=language,
            timestamp=None
        )
    except Exception as e:
        import traceback
        print(f"Error in chat endpoint: {e}")
        traceback.print_exc()
        
        # Return graceful error response
        lang = request.language if request.language in ['en', 'hi', 'mr'] else 'en'
        return ChatResponse(
            response={
                'en': "I encountered an error processing your request. Please try again with a simpler message.",
                'hi': "आपके अनुरोध को संसाधित करने में त्रुटि हुई। कृपया सरल संदेश के साथ फिर से प्रयास करें।",
                'mr': "तुमच्या विनंतीचे प्रक्रिया करताना त्रुटी आली. कृपया सरल संदेशासह पुन्हा प्रयत्न करा."
            }.get(lang, "I encountered an error processing your request. Please try again."),
            suggestions=_get_default_suggestions(lang),
            intent='error',
            language=lang
        )
