

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: string[];
  intent?: string;
}

export interface ChatContextType {
  messages: Message[];
  isLoading: boolean;
  language: string;
  currentIntent: string | null;
  conversationHistory: Message[];
  addMessage: (message: Message) => void;
  setLoading: (loading: boolean) => void;
  setLanguage: (lang: string) => void;
  setCurrentIntent: (intent: string | null) => void;
  clearMessages: () => void;
  getLastUserMessage: () => string | null;
  getConversationSummary: () => string;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setLoading] = useState(false);
  const [language, setLanguage] = useState('en');
  const [currentIntent, setCurrentIntent] = useState<string | null>(null);

  const addMessage = useCallback((message: Message) => {
    setMessages(prev => {
      // Prevent duplicate messages
      if (prev.length > 0 && prev[prev.length - 1].id === message.id) {
        return prev;
      }
      return [...prev, message];
    });
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const getLastUserMessage = useCallback(() => {
    const lastUserMsg = messages.reverse().find(m => m.role === 'user');
    messages.reverse(); // Restore original order
    return lastUserMsg?.content || null;
  }, [messages]);

  const getConversationSummary = useCallback(() => {
    const intents = messages
      .filter(m => m.role === 'assistant' && m.intent)
      .map(m => m.intent)
      .filter((v, i, a) => a.indexOf(v) === i); // unique
    
    return intents.join(', ') || 'general';
  }, [messages]);

  const value: ChatContextType = {
    messages,
    isLoading,
    language,
    currentIntent,
    conversationHistory: messages.slice(-10), // Last 10 messages
    addMessage,
    setLoading,
    setLanguage,
    setCurrentIntent,
    clearMessages,
    getLastUserMessage,
    getConversationSummary
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within ChatProvider');
  }
  return context;
};
