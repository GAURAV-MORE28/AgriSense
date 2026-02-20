/**
 * Header Component – Premium glassmorphism nav with auth-aware links
 */

import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';

interface HeaderProps {
  onToggleContrast: () => void;
  highContrast: boolean;
}

const Header: React.FC<HeaderProps> = ({ onToggleContrast, highContrast }) => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, logout, hasProfile, isAdmin } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('krishi-lang', lang);
  };

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { path: '/', label: t('nav.home'), icon: '🏠', show: true },
    { path: '/profile', label: t('nav.profile'), icon: '📝', show: isAuthenticated },
    { path: '/schemes', label: t('nav.schemes'), icon: '🎯', show: isAuthenticated && hasProfile },
    { path: '/documents', label: t('nav.documents'), icon: '📄', show: isAuthenticated },
    { path: '/admin', label: 'Admin', icon: '📊', show: isAdmin },
    { path: '/help', label: t('nav.help'), icon: '❓', show: true },
  ].filter(item => item.show);

  const handleLogout = () => {
    logout();
    navigate('/');
    setMenuOpen(false);
  };

  return (
    <header className="bg-white/80 backdrop-blur-xl border-b border-gray-100 sticky top-0 z-50">
      {/* Skip link */}
      <a href="#main" className="skip-link">
        {t('accessibility.skipToMain')}
      </a>

      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center text-lg shadow-sm group-hover:shadow-md transition-shadow">
              🌾
            </div>
            <span className="font-extrabold text-lg bg-gradient-to-r from-green-700 to-emerald-600 bg-clip-text text-transparent">
              KRISHI-AI
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1" role="navigation" aria-label="Main navigation">
            {navItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${isActive(item.path)
                  ? 'bg-green-50 text-green-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Right Controls */}
          <div className="flex items-center gap-2">
            {/* Language */}
            <div className="relative">
              <select
                value={i18n.language}
                onChange={(e) => changeLanguage(e.target.value)}
                className="appearance-none bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 pr-8 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-green-500 cursor-pointer hover:bg-gray-100 transition-colors"
                aria-label={t('nav.language')}
              >
                <option value="en">EN</option>
                <option value="hi">हिं</option>
                <option value="mr">मरा</option>
              </select>
              <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-xs">🌐</span>
            </div>

            {/* Contrast */}
            <button
              onClick={onToggleContrast}
              className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm transition-all duration-200 ${highContrast
                ? 'bg-yellow-400 text-black shadow-sm'
                : 'bg-gray-50 border border-gray-200 text-gray-500 hover:bg-gray-100'
                }`}
              aria-label={t('accessibility.highContrast')}
              title={t('accessibility.highContrast')}
            >
              👁️
            </button>

            {/* Auth Button */}
            {isAuthenticated ? (
              <div className="hidden md:flex items-center gap-2">
                <span className="text-xs text-gray-400 font-mono">{user?.mobile}</span>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors"
                >
                  Logout
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="hidden md:inline-flex px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white text-sm font-semibold rounded-lg shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
              >
                Login
              </Link>
            )}

            {/* Mobile Menu */}
            <button
              className="md:hidden w-9 h-9 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center text-sm"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
            >
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {menuOpen && (
          <nav className="md:hidden py-4 border-t border-gray-100 animate-slide-up" role="navigation" aria-label="Mobile navigation">
            <div className="flex flex-col gap-1">
              {navItems.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${isActive(item.path)
                    ? 'bg-green-50 text-green-700'
                    : 'text-gray-700 hover:bg-gray-50'
                    }`}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </Link>
              ))}
              {isAuthenticated ? (
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 mt-2 border-t border-gray-100 pt-3"
                >
                  <span>🚪</span> Logout
                </button>
              ) : (
                <Link
                  to="/login"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold text-green-700 bg-green-50 mt-2"
                >
                  <span>🔑</span> Login
                </Link>
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
};

export default Header;
