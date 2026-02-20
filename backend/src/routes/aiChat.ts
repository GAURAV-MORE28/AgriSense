/**
 * AI Farmer Chatbot routes
 * Intelligent chatbot with RAG-style scheme search, eligibility checking,
 * profile-aware responses, and conversation history persistence.
 */

import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import axios from 'axios';
import { optionalAuth, authenticate, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import * as db from '../config/db';

const router = Router();

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5000';

// Fallback responses when ML service is completely unavailable
const FALLBACK_RESPONSES: Record<string, Record<string, string>> = {
  schemes: {
    en: 'I can help you find government schemes! Please create your farmer profile first, then I\'ll recommend schemes matching your land, crops, and income.',
    hi: 'मैं आपको सरकारी योजनाएं खोजने में मदद कर सकता हूं! कृपया पहले अपना किसान प्रोफाइल बनाएं।',
    mr: 'मी तुम्हाला सरकारी योजना शोधण्यात मदत करू शकतो! कृपया प्रथम तुमचे शेतकरी प्रोफाइल तयार करा।'
  },
  default: {
    en: 'I\'m your Krishi-AI assistant. I can help you discover government schemes, check eligibility, and guide you through applications. Create your profile for personalized recommendations!',
    hi: 'मैं आपका कृषि-AI सहायक हूं। मैं किसानों के लिए सरकारी योजनाएं खोजने, पात्रता समझाने और आवेदन में मदद कर सकता हूं।',
    mr: 'मी तुमचा कृषि-AI सहाय्यक आहे. मी शेतकऱ्यांसाठी सरकारी योजना शोधणे, पात्रता समजावणे आणि अर्ज करण्यात मदत करू शकतो.'
  }
};

function getFallbackResponse(message: string, lang: string): string {
  const langKey = ['en', 'hi', 'mr'].includes(lang) ? lang : 'en';
  const lower = (message || '').toLowerCase();

  if (lower.includes('scheme') || lower.includes('योजना') || lower.includes('कोणती')) {
    return FALLBACK_RESPONSES.schemes[langKey];
  }
  return FALLBACK_RESPONSES.default[langKey];
}

function getDefaultSuggestions(lang: string): string[] {
  const suggestions: Record<string, string[]> = {
    en: ['Find schemes for me', 'What is PM-KISAN?', 'How to get crop insurance?', 'What documents do I need?'],
    hi: ['मेरे लिए योजनाएं खोजें', 'पीएम-किसान क्या है?', 'फसल बीमा कैसे मिलेगा?', 'कौन से दस्तावेज चाहिए?'],
    mr: ['माझ्यासाठी योजना शोधा', 'पीएम-किसान काय आहे?', 'पीक विमा कसा मिळेल?', 'कोणती कागदपत्रे लागतात?']
  };
  return suggestions[lang] || suggestions['en'];
}

/**
 * POST /api/v1/ai/chat
 * Chat with AI farmer assistant
 */
router.post('/chat',
  optionalAuth,
  body('message').notEmpty().trim().isLength({ min: 1, max: 1000 }),
  body('language').optional().isIn(['en', 'hi', 'mr']),
  body('context').optional().isObject(),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { message, language = 'en', context = {} } = req.body;
      const userId = req.user?.userId;

      logger.debug('AI chat request', { message, language, userId });

      // Load farmer profile for context
      let profileContext: Record<string, unknown> | null = null;
      if (userId) {
        try {
          const profileRes = await db.query(
            `SELECT name, state, district, acreage, main_crops, annual_income, 
             farmer_type, land_type, education_level, irrigation_available,
             loan_status, bank_account_linked, aadhaar_linked, caste_category,
             livestock, soil_type, water_source, machinery_owned
             FROM farmer_profiles WHERE user_id = $1`,
            [userId]
          );
          if (profileRes.rows.length > 0) {
            profileContext = profileRes.rows[0];
          }
        } catch (dbErr) {
          // Try with minimal columns if extended fields don't exist
          try {
            const profileRes = await db.query(
              `SELECT name, state, district, acreage, main_crops, annual_income, farmer_type
               FROM farmer_profiles WHERE user_id = $1`,
              [userId]
            );
            if (profileRes.rows.length > 0) {
              profileContext = profileRes.rows[0];
            }
          } catch (fallbackErr) {
            logger.error('Profile fetch error', { err: (fallbackErr as Error).message });
          }
        }
      }

      // Load recent chat history for conversation context
      let chatHistory: Array<{ role: string; message: string }> = [];
      if (userId) {
        try {
          const historyRes = await db.query(
            `SELECT role, message FROM chat_history 
             WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`,
            [userId]
          );
          chatHistory = historyRes.rows.reverse();
        } catch (dbErr) {
          logger.error('History fetch error', { err: (dbErr as Error).message });
          // Continue without history
        }
      }

      // Save user message to history
      if (userId) {
        try {
          await db.query(
            `INSERT INTO chat_history (user_id, role, message, language) VALUES ($1, 'user', $2, $3)`,
            [userId, message, language]
          );
        } catch (dbErr) {
          logger.error('History save error', { err: (dbErr as Error).message });
          // Continue even if history save fails
        }
      }

      let responseData: { response: string; suggestions: string[]; intent?: string; schemes_found?: number };

      // Quick path: if user is authenticated and asks about schemes, call internal /schemes and return recommendations immediately
      try {
        const quickLower = (message || '').toLowerCase();
        const schemeKeywordsQuick = ['scheme', 'schemes', 'योजना', 'किसान', 'eligible', 'qualify', 'qualifies', 'पात्र', 'कौनती'];
        const isSchemeQuery = schemeKeywordsQuick.some(k => quickLower.includes(k));
        if (userId && profileContext && isSchemeQuery) {
          logger.debug('Quick path: user asked about schemes — calling internal /schemes');
          const internalRes = await axios.get('http://localhost:4000/api/v1/schemes', {
            headers: { Authorization: req.headers.authorization || '' },
            timeout: 10000
          });
          const recs = internalRes.data.recommendations || [];
          if (Array.isArray(recs) && recs.length > 0) {
            let text = '';
            if (language === 'en') text = `Based on your profile, here are recommended schemes:\n\n`;
            else if (language === 'hi') text = `आपकी प्रोफाइल के आधार पर, ये उपयोगी योजनाएँ हैं:\n\n`;
            else text = `तुमच्या प्रोफाइलच्या आधारे, ही शिफारस केलेल्या योजना आहेत:\n\n`;
            recs.slice(0,3).forEach((r: any, i: number) => {
              const schemeObj = r.scheme || r;
              text += `${i+1}. ${schemeObj.name || schemeObj.scheme_id} - ${schemeObj.description || ''}\n\n`;
            });

            return res.json({ response: text, suggestions: getDefaultSuggestions(language), intent: 'scheme_search', schemes_found: recs.length, language, timestamp: new Date().toISOString() });
          }
        }
      } catch (qpErr) {
        logger.warn('Quick path /schemes call failed', { err: (qpErr as Error).message });
      }

      // Try ML service AI chat with better error handling
      try {
        const mlPayload = {
          message,
          language,
          profile: profileContext,
          history: chatHistory,
          context: context
        };

        logger.debug('Sending to ML service', { mlUrl: ML_SERVICE_URL });

        const chatResponse = await axios.post(
          `${ML_SERVICE_URL}/api/v1/chat`,
          mlPayload,
          { 
            timeout: 12000,
            headers: { 'Content-Type': 'application/json' }
          }
        );

        responseData = {
          response: chatResponse.data.response || getFallbackResponse(message, language),
          suggestions: Array.isArray(chatResponse.data.suggestions) ? chatResponse.data.suggestions : [],
          intent: chatResponse.data.intent,
          schemes_found: chatResponse.data.schemes_found || 0
        };
        logger.debug('ML service response received', { intent: responseData.intent });

        // If ML returned a fallback intent but we have profile data and message
        // appears to ask about schemes, call internal schemes/match as a backup
        try {
          const lower = (message || '').toLowerCase();
          const schemeKeywords = ['scheme', 'योजना', 'किसान', 'find', 'search', 'schemes', 'योजना', 'कौनती'];
          const looksLikeSchemeRequest = schemeKeywords.some(k => lower.includes(k));

          if (responseData.intent === 'fallback' && profileContext && looksLikeSchemeRequest) {
            logger.debug('ML returned fallback — invoking schemes/match as backup');

            // Normalize profile fields similar to /schemes route
            const apiProfile = {
              profile_id: (profileContext as any).profile_id,
              name: (profileContext as any).name,
              mobile: (profileContext as any).mobile,
              state: (profileContext as any).state,
              district: (profileContext as any).district,
              village: (profileContext as any).village || null,
              land_type: (profileContext as any).land_type,
              acreage: parseFloat((profileContext as any).acreage) || 0,
              main_crops: (profileContext as any).main_crops || [],
              family_count: (profileContext as any).family_count || 1,
              annual_income: parseFloat((profileContext as any).annual_income) || 0,
              farmer_type: (profileContext as any).farmer_type,
              education_level: (profileContext as any).education_level || 'none',
              irrigation_available: (profileContext as any).irrigation_available ?? false,
              loan_status: (profileContext as any).loan_status || 'none',
              bank_account_linked: (profileContext as any).bank_account_linked ?? false,
              aadhaar_linked: (profileContext as any).aadhaar_linked ?? false,
              caste_category: (profileContext as any).caste_category || 'general',
              livestock: (profileContext as any).livestock || [],
              soil_type: (profileContext as any).soil_type || 'unknown',
              water_source: (profileContext as any).water_source || 'rainfed',
              machinery_owned: (profileContext as any).machinery_owned || []
            };

            const matchRes = await axios.post(
              `${ML_SERVICE_URL}/api/v1/schemes/match`,
              { profile: apiProfile, query: message, top_k: 5 },
              { timeout: 10000 }
            );

            let recs = matchRes.data.recommendations || [];
            if (Array.isArray(recs) && recs.length > 0) {
              let text = '';
              if (language === 'en') text = `Based on your profile, here are some recommended schemes:\n\n`;
              else if (language === 'hi') text = `आपकी प्रोफाइल के आधार पर, ये उपयोगी योजनाएँ हैं:\n\n`;
              else text = `तुमच्या प्रोफाइलच्या आधारे, ही शिफारस केलेल्या योजना आहेत:\n\n`;

              recs.slice(0, 3).forEach((s: any, i: number) => {
                const schemeObj = s.scheme || s;
                const name = schemeObj.name || schemeObj.scheme_id || 'Scheme';
                const desc = schemeObj.description || '';
                const benefits = schemeObj.benefits || '';
                text += `${i + 1}. ${name} - ${desc} ${benefits ? '\nBenefits: ' + benefits : ''}\n\n`;
              });

              responseData = {
                response: text,
                suggestions: getDefaultSuggestions(language),
                intent: 'scheme_search',
                schemes_found: recs.length
              };
            }
            else {
              // If ML direct match returned no recommendations, try internal /schemes (authenticated) which normalizes profile
              try {
                const internalRes = await axios.get('http://localhost:4000/api/v1/schemes', {
                  headers: { Authorization: req.headers.authorization || '' },
                  timeout: 10000
                });
                const internalRecs = internalRes.data.recommendations || [];
                if (Array.isArray(internalRecs) && internalRecs.length > 0) {
                  let itext = '';
                  if (language === 'en') itext = `Based on your profile, here are recommended schemes:\n\n`;
                  else if (language === 'hi') itext = `आपकी प्रोफाइल के आधार पर, ये उपयोगी योजनाएँ हैं:\n\n`;
                  else itext = `तुमच्या प्रोफाइलच्या आधारे, ही शिफारस केलेल्या योजना आहेत:\n\n`;

                  internalRecs.slice(0,3).forEach((r: any, i: number) => {
                    const schemeObj = r.scheme || r;
                    const name = schemeObj.name || schemeObj.scheme_id || 'Scheme';
                    const desc = schemeObj.description || '';
                    itext += `${i+1}. ${name} - ${desc}\n\n`;
                  });

                  responseData = {
                    response: itext,
                    suggestions: getDefaultSuggestions(language),
                    intent: 'scheme_search',
                    schemes_found: internalRecs.length
                  };
                }
              } catch (internalErr) {
                logger.warn('Internal /schemes fallback failed', { err: (internalErr as Error).message });
              }
            }
          }
        } catch (fallbackMatchErr) {
          logger.warn('Fallback schemes/match call failed', { err: (fallbackMatchErr as Error).message });
        }
      } catch (mlErr) {
        // ML service unavailable - use simple fallback
        const errorMsg = (mlErr as Error).message;
        logger.warn('ML chat unavailable, using fallback', { err: errorMsg });

        responseData = {
          response: getFallbackResponse(message, language),
          suggestions: getDefaultSuggestions(language),
          intent: 'fallback',
          schemes_found: 0
        };
      }

      // If ML chat failed but we have a profile and the user asked about schemes,
      // try the schemes/match endpoint (which has succeeded in other flows).
      try {
        const lower = (message || '').toLowerCase();
        const schemeKeywords = ['scheme', 'योजना', 'योजना', 'किसान', 'find', 'search', 'schemes', 'योजना', 'कौनती'];
        const looksLikeSchemeRequest = schemeKeywords.some(k => lower.includes(k));

        if (responseData.intent === 'fallback' && profileContext && looksLikeSchemeRequest) {
          logger.debug('Attempting schemes/match fallback using profileContext');

          const matchRes = await axios.post(
            `${ML_SERVICE_URL}/api/v1/schemes/match`,
            { profile: profileContext, query: message, top_k: 5 },
            { timeout: 10000 }
          );

          const recs = matchRes.data.recommendations || [];
          if (Array.isArray(recs) && recs.length > 0) {
            let text = '';
            if (language === 'en') text = `Based on your profile, here are some recommended schemes:\n\n`;
            else if (language === 'hi') text = `आपकी प्रोफाइल के आधार पर, ये उपयोगी योजनाएँ हैं:\n\n`;
            else text = `तुमच्या प्रोफाइलच्या आधारे, ही शिफारस केलेल्या योजना आहेत:\n\n`;

            recs.slice(0, 3).forEach((s: any, i: number) => {
              const name = s.name || s.scheme_id || 'Scheme';
              const desc = s.description || '';
              const benefits = s.benefits || '';
              text += `${i + 1}. ${name} - ${desc} ${benefits ? '\nBenefits: ' + benefits : ''}\n\n`;
            });

            responseData = {
              response: text,
              suggestions: getDefaultSuggestions(language),
              intent: 'scheme_search',
              schemes_found: recs.length
            };
          }
        }
      } catch (matchErr) {
        logger.warn('schemes/match fallback failed', { err: (matchErr as Error).message });
        // keep original fallback responseData
      }

      // Save assistant response to history
      if (userId) {
        try {
          await db.query(
            `INSERT INTO chat_history (user_id, role, message, language, metadata) 
             VALUES ($1, 'assistant', $2, $3, $4)`,
            [userId, responseData.response, language, JSON.stringify({
              intent: responseData.intent,
              schemes_found: responseData.schemes_found,
              timestamp: new Date().toISOString()
            })]
          );
        } catch (dbErr) {
          logger.error('History save error for assistant', { err: (dbErr as Error).message });
          // Continue even if history save fails
        }
      }

      res.json({
        response: responseData.response,
        suggestions: responseData.suggestions,
        intent: responseData.intent,
        schemes_found: responseData.schemes_found,
        language,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      logger.error('Chat error', { err: (err as Error).message });
      next(err);
    }
  }
);

/**
 * GET /api/v1/ai/history
 * Get chat history for current user
 */
router.get('/history',
  authenticate,
  async (req: AuthRequest, res: Response, next) => {
    try {
      const userId = req.user!.userId;
      const limit = parseInt(req.query.limit as string) || 50;

      const result = await db.query(
        `SELECT role, message, language, created_at FROM chat_history 
         WHERE user_id = $1 ORDER BY created_at ASC LIMIT $2`,
        [userId, limit]
      );

      res.json({ history: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/v1/ai/history
 * Clear chat history for current user
 */
router.delete('/history',
  authenticate,
  async (req: AuthRequest, res: Response, next) => {
    try {
      const userId = req.user!.userId;
      await db.query('DELETE FROM chat_history WHERE user_id = $1', [userId]);
      res.json({ message: 'Chat history cleared' });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
