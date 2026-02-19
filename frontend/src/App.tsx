/**
 * KRISHI-AI Main App Component
 */

import React, { Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

// Pages
import Landing from './pages/Landing';
import ProfileWizard from './pages/ProfileWizard';
import SchemeResults from './pages/SchemeResults';
import SchemeDetail from './pages/SchemeDetail';
import DocumentUpload from './pages/DocumentUpload';
import ApplicationForm from './pages/ApplicationForm';
import ApplicationStatus from './pages/ApplicationStatus';
import Help from './pages/Help';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';

// Components
import Header from './components/Header';
import OfflineBanner from './components/OfflineBanner';
import LoadingSpinner from './components/LoadingSpinner';
import Chatbot from './components/Chatbot';

// Contexts
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { OfflineProvider } from './contexts/OfflineContext';

// Styles
import './index.css';

function ChatbotWrapper() {
  const { token } = useAuth();
  return <Chatbot token={token} />;
}

function AppContent() {
  const { i18n } = useTranslation();
  const [highContrast, setHighContrast] = useState(false);

  useEffect(() => {
    // Check for saved preferences
    const savedLang = localStorage.getItem('krishi-lang');
    if (savedLang) {
      i18n.changeLanguage(savedLang);
    }

    const savedContrast = localStorage.getItem('krishi-high-contrast');
    if (savedContrast === 'true') {
      setHighContrast(true);
    }
  }, [i18n]);

  const toggleHighContrast = () => {
    const newValue = !highContrast;
    setHighContrast(newValue);
    localStorage.setItem('krishi-high-contrast', String(newValue));
  };

  return (
    <AuthProvider>
      <OfflineProvider>
        <BrowserRouter>
          <div className={`min-h-screen bg-gray-50 ${highContrast ? 'high-contrast' : ''}`}>
            <Header
              onToggleContrast={toggleHighContrast}
              highContrast={highContrast}
            />
            <OfflineBanner />

            <main className="pb-20">
              <Suspense fallback={<LoadingSpinner />}>
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/profile" element={<ProfileWizard />} />
                  <Route path="/schemes" element={<SchemeResults />} />
                  <Route path="/schemes/:id" element={<SchemeDetail />} />
                  <Route path="/documents" element={<DocumentUpload />} />
                  <Route path="/apply/:schemeId" element={<ApplicationForm />} />
                  <Route path="/status/:applicationId" element={<ApplicationStatus />} />
                  <Route path="/admin" element={<AdminDashboard />} />
                  <Route path="/help" element={<Help />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </main>
            <ChatbotWrapper />
          </div>
        </BrowserRouter>
      </OfflineProvider>
    </AuthProvider>
  );
}

export default AppContent;
