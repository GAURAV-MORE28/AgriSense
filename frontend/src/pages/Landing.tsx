/**
 * Landing Page – Premium hero, feature grid, how-it-works flow
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';

const Landing: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, hasProfile } = useAuth();

  const handleCta = () => {
    if (isAuthenticated && hasProfile) {
      navigate('/schemes');
    } else if (isAuthenticated) {
      navigate('/profile');
    } else {
      navigate('/login');
    }
  };

  const features = [
    { icon: '🤖', title: 'AI-Powered Matching', desc: 'Our ML engine evaluates 20+ schemes against your profile and ranks them by eligibility score.' },
    { icon: '📸', title: 'Smart Document OCR', desc: 'Upload Aadhaar or land records — AI extracts and validates fields automatically.' },
    { icon: '🎤', title: 'Voice Assistance', desc: 'Speak in Hindi, Marathi, or English — we understand and fill forms for you.' },
    {
      icon: '📶', title: 'Works Offline', desc: "Save your data locally and sync when you're back online. No internet required."
    },
    { icon: '🔒', title: 'Privacy First', desc: 'Your data stays on your device. Encrypted transmission, no third-party sharing.' },
    { icon: '🏛️', title: 'One-Click Apply', desc: 'Auto-fill applications and track them through government portals in real-time.' }
  ];

  const stats = [
    { value: '20+', label: 'Government Schemes' },
    { value: '15', label: 'States Covered' },
    { value: '₹2L+', label: 'Max Annual Benefit' },
    { value: '99%', label: 'Accuracy Rate' }
  ];

  return (
    <div className="min-h-screen">
      {/* ─── Hero Section ──────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-green-900 via-green-800 to-emerald-900" />
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
        {/* Glowing orb */}
        <div className="absolute top-20 right-20 w-72 h-72 bg-yellow-400/20 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-10 w-56 h-56 bg-emerald-400/20 rounded-full blur-3xl" />

        <div className="relative max-w-5xl mx-auto px-4 pt-20 pb-28 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-5 py-2 mb-8">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-green-200 text-sm font-medium">AI-Powered • 20+ Schemes • Multilingual</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold text-white mb-6 leading-tight tracking-tight">
            {t('landing.welcome') || 'Find Every Government'}
            <br />
            <span className="bg-gradient-to-r from-yellow-300 via-amber-300 to-orange-300 bg-clip-text text-transparent">
              Scheme You Deserve
            </span>
          </h1>

          <p className="text-lg md:text-xl text-green-100/90 mb-10 max-w-2xl mx-auto leading-relaxed">
            KRISHI-AI uses artificial intelligence to match farmers with the right government schemes,
            verify documents instantly, and submit applications — all in your language.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleCta}
              className="group relative px-10 py-4 bg-gradient-to-r from-yellow-400 to-amber-500 text-green-900 font-bold text-lg rounded-xl shadow-lg shadow-yellow-400/30 hover:shadow-xl hover:shadow-yellow-400/40 transition-all duration-300 hover:-translate-y-0.5"
            >
              <span className="relative z-10">
                {isAuthenticated ? (hasProfile ? 'View My Schemes →' : 'Create Profile →') : 'Get Started Free →'}
              </span>
            </button>
            <button
              onClick={() => navigate('/help')}
              className="px-8 py-4 border-2 border-white/30 text-white font-semibold rounded-xl hover:bg-white/10 transition-all duration-300"
            >
              Learn More
            </button>
          </div>
        </div>
      </section>

      {/* ─── Stats Bar ─────────────────────────────────── */}
      <section className="relative -mt-12 z-10 max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 px-6 py-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat, i) => (
              <div key={i} className="text-center">
                <p className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-transparent">
                  {stat.value}
                </p>
                <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features Grid ─────────────────────────────── */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-block px-4 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-semibold mb-4">Features</span>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
              Everything a Farmer Needs
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-lg hover:border-green-200 transition-all duration-300 hover:-translate-y-1 animate-slide-up"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-100 to-emerald-50 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform duration-300">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-500 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How It Works ──────────────────────────────── */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-block px-4 py-1.5 bg-amber-100 text-amber-700 rounded-full text-sm font-semibold mb-4">Process</span>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
              3 Simple Steps
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: 1, title: 'Create Profile', desc: 'Enter your basic details — name, location, land, crops, income.', icon: '📝', color: 'from-blue-500 to-indigo-500' },
              { step: 2, title: 'Get AI Matches', desc: 'Our engine evaluates 20+ schemes and ranks your best options.', icon: '🎯', color: 'from-green-500 to-emerald-500' },
              { step: 3, title: 'Apply Instantly', desc: 'Upload documents, fill forms, and submit — all automated.', icon: '✅', color: 'from-amber-500 to-orange-500' }
            ].map((item) => (
              <div key={item.step} className="relative text-center">
                {item.step < 3 && (
                  <div className="hidden md:block absolute top-10 left-[60%] w-[80%] border-t-2 border-dashed border-gray-200" />
                )}
                <div className={`w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center text-3xl text-white shadow-lg mb-5`}>
                  {item.icon}
                </div>
                <span className="inline-block px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-bold mb-3">
                  Step {item.step}
                </span>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-500 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA Banner ────────────────────────────────── */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto bg-gradient-to-r from-green-700 via-green-600 to-emerald-600 rounded-3xl p-10 text-center shadow-2xl shadow-green-500/20">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            Ready to Find Your Schemes?
          </h2>
          <p className="text-green-100 mb-8 max-w-lg mx-auto">
            Join thousands of farmers who have already discovered benefits worth lakhs through KRISHI-AI.
          </p>
          <button
            onClick={handleCta}
            className="px-10 py-4 bg-white text-green-700 font-bold text-lg rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5"
          >
            Start Now — It's Free 🌾
          </button>
        </div>
      </section>

      {/* ─── Footer ────────────────────────────────────── */}
      <footer className="py-8 px-4 bg-gray-900 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="text-xl">🌾</span>
            <span className="font-bold text-lg text-white">KRISHI-AI</span>
          </div>
          <p className="text-gray-400 text-sm">
            AI-Powered Government Scheme Discovery for Indian Farmers
          </p>
          <p className="text-gray-500 text-xs mt-4">
            🔐 Your data is encrypted and never shared with third parties.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
