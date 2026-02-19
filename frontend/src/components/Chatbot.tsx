/**
 * Floating AI Farmer Chatbot
 * Multilingual support with voice input (Web Speech API)
 * Welcome message, suggestion chips, and typing animation
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api/v1';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: string[];
  intent?: string;
}

interface ChatbotProps {
  token: string | null;
}

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी' },
  { code: 'mr', label: 'मराठी' },
];

const WELCOME_MESSAGES: Record<string, { text: string; suggestions: string[] }> = {
  en: {
    text: "Namaste! 🙏 I'm your Krishi-AI assistant. I help farmers discover government schemes, understand eligibility, and apply easily. How can I help you today?",
    suggestions: ['Find schemes for me', 'What is PM-KISAN?', 'How to apply?', 'What documents do I need?']
  },
  hi: {
    text: "नमस्ते! 🙏 मैं आपका कृषि-AI सहायक हूं। मैं किसानों को सरकारी योजनाएं खोजने, पात्रता समझने और आसानी से आवेदन करने में मदद करता हूं। आज मैं आपकी कैसे मदद कर सकता हूं?",
    suggestions: ['योजनाएं खोजें', 'पीएम-किसान क्या है?', 'आवेदन कैसे करें?', 'दस्तावेज कौन से चाहिए?']
  },
  mr: {
    text: "नमस्कार! 🙏 मी तुमचा कृषी-AI सहाय्यक आहे. मी शेतकऱ्यांना सरकारी योजना शोधण्यात, पात्रता समजून घेण्यात आणि सहज अर्ज करण्यात मदत करतो. आज मी तुमची कशी मदत करू शकतो?",
    suggestions: ['योजना शोधा', 'पीएम-किसान काय आहे?', 'अर्ज कसा करायचा?', 'कागदपत्रे कोणती?']
  }
};

const Chatbot: React.FC<ChatbotProps> = ({ token }) => {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState(i18n.language?.split('-')[0] || 'en');
  const [listening, setListening] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(scrollToBottom, [messages]);

  // Add welcome message on first open
  useEffect(() => {
    if (isOpen && !hasOpened) {
      setHasOpened(true);
      const lang = language in WELCOME_MESSAGES ? language : 'en';
      const welcome = WELCOME_MESSAGES[lang];
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: welcome.text,
        timestamp: new Date(),
        suggestions: welcome.suggestions
      }]);
    }
  }, [isOpen, hasOpened, language]);

  // Initialize Web Speech API for voice input
  useEffect(() => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      recognitionRef.current = new SpeechRecognitionAPI();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = language === 'hi' ? 'hi-IN' : language === 'mr' ? 'mr-IN' : 'en-IN';
      recognitionRef.current.onresult = (e: any) => {
        const transcript = e.results[0][0].transcript;
        setInput(prev => (prev ? `${prev} ${transcript}` : transcript));
      };
      recognitionRef.current.onend = () => setListening(false);
      recognitionRef.current.onerror = () => setListening(false);
    }
    return () => {
      if (recognitionRef.current) recognitionRef.current.abort();
    };
  }, [language]);

  const toggleVoice = () => {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.lang = language === 'hi' ? 'hi-IN' : language === 'mr' ? 'mr-IN' : 'en-IN';
      recognitionRef.current.start();
      setListening(true);
    }
  };

  const sendMessage = useCallback(async (messageText?: string) => {
    const trimmed = (messageText || input).trim();
    if (!trimmed || loading) return;

    // Clear any previous errors
    setError(null);
    setRetryCount(0);

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_URL}/ai/chat`, {
        method: 'POST',
        headers,
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({ 
          message: trimmed, 
          language,
          // Pass conversation context to ML service for better responses
          context: {
            conversationLength: messages.length,
            previousIntents: messages.filter(m => m.role === 'assistant' && m.intent).slice(-2)
          }
        }),
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      const responseText = data.response || 'I could not process that. Please try again.';
      const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];

      const botMsg: Message = {
        id: `b-${Date.now()}`,
        role: 'assistant',
        content: responseText,
        timestamp: new Date(),
        suggestions: suggestions.slice(0, 4), // Limit to 4 suggestions
        intent: data.intent
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      // Don't show error if request was aborted
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('Chatbot error:', errorMessage);
      setError(errorMessage);
      
      let errorText = 'Sorry, I encountered an error. Please check your connection and try again.';
      if (errorMessage.includes('Failed to fetch')) {
        errorText = 'Connection error. Please check your internet connection and try again.';
      } else if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
        errorText = 'Request took too long. Please try a shorter message.';
      }
      
      const errMsg: Message = {
        id: `b-${Date.now()}`,
        role: 'assistant',
        content: errorText,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, token, language, messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage(suggestion);
  };

  return (
    <>
      {/* Floating toggle button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#1E8E4A] text-white shadow-lg hover:bg-[#176B39] focus:outline-none focus:ring-4 focus:ring-[#1E8E4A]/40 transition-all duration-300 hover:scale-110 flex items-center justify-center"
        aria-label={isOpen ? 'Close chatbot' : 'Open AI assistant'}
      >
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {/* Notification dot when not opened */}
            {!hasOpened && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse" />
            )}
          </>
        )}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div
          className="fixed bottom-24 right-6 z-40 w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col animate-slide-up"
          style={{ height: 'min(520px, 75vh)' }}
          role="dialog"
          aria-label="AI Farmer Assistant chat"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-[#1E8E4A] to-[#176B39] text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-sm">🌾</div>
              <div>
                <span className="text-base font-semibold">Krishi AI Assistant</span>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse" />
                  <span className="text-xs text-green-200">Online</span>
                </div>
              </div>
            </div>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-white/20 border border-white/30 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/50"
              aria-label="Select language"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code} className="text-gray-800">
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F7FAFC]">
            {/* Error Banner */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4v2m0-11a9 9 0 110 18 9 9 0 010-18z" />
                  </svg>
                  <div className="text-sm text-red-700">{error}</div>
                </div>
                <button
                  onClick={() => setError(null)}
                  className="text-red-500 hover:text-red-700 flex-shrink-0"
                >
                  ×
                </button>
              </div>
            )}
            
            {messages.map((m) => (
              <div key={m.id}>
                <div className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                  <div
                    className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-line ${m.role === 'user'
                        ? 'bg-[#1E8E4A] text-white rounded-br-md'
                        : 'bg-white text-[#1F2937] border border-gray-200 rounded-bl-md shadow-sm'
                      }`}
                  >
                    {m.content}
                  </div>
                </div>
                {/* Suggestion chips */}
                {m.role === 'assistant' && m.suggestions && m.suggestions.length > 0 && !loading && (
                  <div className="flex flex-wrap gap-1.5 mt-2 ml-1 animate-fade-in">
                    {m.suggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-medium hover:bg-green-100 hover:border-green-300 transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-2 flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 border-t border-gray-200 bg-white">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={toggleVoice}
                className={`p-2 rounded-xl transition-colors ${listening ? 'bg-[#F6A500] text-white animate-pulse' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                aria-label={listening ? 'Stop listening' : 'Start voice input'}
                disabled={!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v7m0-9a7 7 0 017-7" />
                </svg>
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about schemes..."
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E8E4A] focus:border-transparent text-[#1F2937]"
                aria-label="Type your message"
              />
              <button
                type="button"
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                className="px-4 py-2.5 bg-[#1E8E4A] text-white rounded-xl font-medium hover:bg-[#176B39] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Send message"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Chatbot;
