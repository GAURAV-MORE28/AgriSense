"use strict";
/**
 * AI Farmer Chatbot routes
 * Multilingual conversational AI for scheme discovery
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const axios_1 = __importDefault(require("axios"));
const auth_1 = require("../middleware/auth");
const logger_1 = require("../utils/logger");
const db = __importStar(require("../config/db"));
const router = (0, express_1.Router)();
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5000';
// Rule-based responses when LLM unavailable (English, Hindi, Marathi)
const FALLBACK_RESPONSES = {
    schemes: {
        en: 'I can help you find government schemes! Please create your farmer profile first, then I\'ll recommend schemes matching your land, crops, and income. You can also ask "What is PM-KISAN?" or "How to apply for crop insurance?"',
        hi: 'मैं आपको सरकारी योजनाएं खोजने में मदद कर सकता हूं! कृपया पहले अपना किसान प्रोफाइल बनाएं, फिर मैं आपकी जमीन, फसलों और आय के अनुसार योजनाएं सुझाऊंगा।',
        mr: 'मी तुम्हाला सरकारी योजना शोधण्यात मदत करू शकतो! कृपया प्रथम तुमचे शेतकरी प्रोफाइल तयार करा, नंतर मी तुमच्या जमिनी, पिके आणि उत्पन्नानुसार योजना शिफारस करीन।'
    },
    'pm-kisan': {
        en: 'PM-KISAN Samman Nidhi provides ₹6,000 per year to small farmers (land ≤2 hectares). You need Aadhaar, land records, and bank passbook. Install the PM-KISAN app or visit pmkisan.gov.in to apply.',
        hi: 'पीएम-किसान सम्मान निधि छोटे किसानों (जमीन ≤2 हेक्टेयर) को प्रति वर्ष ₹6,000 देती है। आधार, भूमि अभिलेख और बैंक पासबुक चाहिए। आवेदन के लिए pmkisan.gov.in पर जाएं।',
        mr: 'पीएम-किसान सन्मान निधी लहान शेतकऱ्यांना (जमीन ≤2 हेक्टर) दरवर्षी ₹6,000 देते। आधार, जमीन नोंद आणि बँक पासबुक लागते। अर्जासाठी pmkisan.gov.in भेट द्या।'
    },
    insurance: {
        en: 'PM Fasal Bima Yojana (PMFBY) offers crop insurance at low premium. You need to grow notified crops (rice, wheat, cotton, etc.). Contact your bank or visit pmfby.gov.in for enrollment during sowing season.',
        hi: 'प्रधानमंत्री फसल बीमा योजना कम प्रीमियम पर फसल बीमा देती है। अधिसूचित फसलें (चावल, गेहूं, कपास आदि) उगानी होंगी। बुवाई के मौसम में बैंक से संपर्क करें।',
        mr: 'पीएम पीक विमा योजना कम प्रीमियमवर पीक विमा देते। अधिसूचित पिके (तांदूळ, गहू, कापूस इ.) घ्यावी लागतात। पेरणीच्या हंगामात बँकेला संपर्क करा।'
    },
    kcc: {
        en: 'Kisan Credit Card (KCC) gives farmers credit at 4% interest. You need minimum 0.5 hectare land, Aadhaar, land records. Visit your nearest bank or cooperative society to apply.',
        hi: 'किसान क्रेडिट कार्ड 4% ब्याज पर ऋण देता है। न्यूनतम 0.5 हेक्टेयर जमीन, आधार और भूमि अभिलेख चाहिए। आवेदन के लिए नजदीकी बैंक जाएं।',
        mr: 'किसान क्रेडिट कार्ड 4% व्याजावर कर्ज देते। किमान 0.5 हेक्टर जमीन, आधार आणि जमीन नोंद लागते। अर्जासाठी जवळच्या बँकेला भेट द्या।'
    },
    documents: {
        en: 'For most schemes you need: Aadhaar Card, Land Records (7/12 or ROR), Bank Passbook. Some schemes may need Income Certificate or Caste Certificate. Upload documents in the Documents section for OCR extraction.',
        hi: 'अधिकांश योजनाओं के लिए चाहिए: आधार कार्ड, भूमि अभिलेख (7/12), बैंक पासबुक। कुछ योजनाओं में आय प्रमाण पत्र या जाति प्रमाण पत्र चाहिए।',
        mr: 'बहुत योजनांसाठी लागते: आधार कार्ड, जमीन नोंद (7/12), बँक पासबुक। काही योजनांना उत्पन्न प्रमाणपत्र किंवा जात प्रमाणपत्र लागते।'
    },
    default: {
        en: 'I\'m your Krishi-AI assistant. I can help you discover government schemes for farmers, explain eligibility, and guide you through applications. Create your profile to get personalized recommendations, or ask me about specific schemes like PM-KISAN, crop insurance, or KCC.',
        hi: 'मैं आपका कृषि-AI सहायक हूं। मैं किसानों के लिए सरकारी योजनाएं खोजने, पात्रता समझाने और आवेदन में मदद कर सकता हूं। व्यक्तिगत सिफारिशों के लिए प्रोफाइल बनाएं।',
        mr: 'मी तुमचा कृषि-AI सहाय्यक आहे। मी शेतकऱ्यांसाठी सरकारी योजना शोधण्यात, पात्रता समजावण्यात आणि अर्ज करण्यात मदत करू शकतो। वैयक्तिक शिफारसींसाठी प्रोफाइल तयार करा।'
    }
};
function getFallbackResponse(message, lang) {
    const langKey = ['en', 'hi', 'mr'].includes(lang) ? lang : 'en';
    const lower = message.toLowerCase();
    if (lower.includes('scheme') || lower.includes('योजना') || lower.includes('कोणती')) {
        return FALLBACK_RESPONSES.schemes[langKey];
    }
    if (lower.includes('pm-kisan') || lower.includes('किसान') || lower.includes('पीएम')) {
        return FALLBACK_RESPONSES['pm-kisan'][langKey];
    }
    if (lower.includes('insurance') || lower.includes('बीमा') || lower.includes('विमा')) {
        return FALLBACK_RESPONSES.insurance[langKey];
    }
    if (lower.includes('kcc') || lower.includes('credit') || lower.includes('क्रेडिट') || lower.includes('कर्ज')) {
        return FALLBACK_RESPONSES.kcc[langKey];
    }
    if (lower.includes('document') || lower.includes('कागद') || lower.includes('प्रमाण')) {
        return FALLBACK_RESPONSES.documents[langKey];
    }
    return FALLBACK_RESPONSES.default[langKey];
}
/**
 * POST /api/v1/ai/chat
 * Chat with AI farmer assistant
 */
router.post('/chat', auth_1.optionalAuth, (0, express_validator_1.body)('message').notEmpty().trim(), (0, express_validator_1.body)('language').optional().isIn(['en', 'hi', 'mr']), async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const { message, language = 'en' } = req.body;
        const userId = req.user?.userId;
        let profileContext = null;
        if (userId) {
            const profileRes = await db.query('SELECT name, state, district, acreage, main_crops, annual_income, farmer_type FROM farmer_profiles WHERE user_id = $1', [userId]);
            if (profileRes.rows.length > 0) {
                profileContext = profileRes.rows[0];
            }
        }
        // Try ML service AI chat if available
        try {
            const chatResponse = await axios_1.default.post(`${ML_SERVICE_URL}/api/v1/ai/chat`, {
                message,
                language,
                profile: profileContext
            }, { timeout: 10000 });
            return res.json({
                response: chatResponse.data.response,
                language
            });
        }
        catch (mlErr) {
            // ML service AI not available - use rule-based fallback
            logger_1.logger.debug('ML chat unavailable, using fallback', { err: mlErr.message });
            const response = getFallbackResponse(message, language);
            res.json({
                response,
                language
            });
        }
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=aiChat.js.map