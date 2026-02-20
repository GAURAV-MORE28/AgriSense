/**
 * VoiceInput Component - Speech-to-text input using Web Speech API
 */

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

interface VoiceInputProps {
  onResult: (text: string) => void;
  language?: string;
}

const VoiceInput: React.FC<VoiceInputProps> = ({ onResult, language }) => {
  const { t, i18n } = useTranslation();
  const [isListening, setIsListening] = useState(false);
  const [isSupported] = useState(() => {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  });

  const getLanguageCode = useCallback(() => {
    const langMap: Record<string, string> = {
      en: 'en-IN',
      hi: 'hi-IN',
      mr: 'mr-IN'
    };
    return language || langMap[i18n.language] || 'en-IN';
  }, [language, i18n.language]);

  const startListening = useCallback(() => {
    if (!isSupported) {
      alert('Speech recognition is not supported in your browser');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = getLanguageCode();
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  }, [isSupported, getLanguageCode, onResult]);

  if (!isSupported) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={startListening}
      disabled={isListening}
      className={`btn-voice relative ${isListening ? 'listening voice-pulse' : ''}`}
      aria-label={isListening ? t('profile.listening') : t('profile.speakButton')}
    >
      {isListening ? (
        <>
          <span className="animate-pulse">🎤</span>
          {t('profile.listening')}
        </>
      ) : (
        <>
          <span>🎤</span>
          {t('profile.speakButton')}
        </>
      )}
    </button>
  );
};

export default VoiceInput;
