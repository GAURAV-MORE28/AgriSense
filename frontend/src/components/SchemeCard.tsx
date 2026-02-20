/**
 * SchemeCard Component - Displays scheme with explainability
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface Scheme {
  scheme_id: string;
  name: string;
  score: number;
  benefit_estimate: number;
  confidence: 'high' | 'medium' | 'low';
  eligibility_status: 'eligible' | 'partially_eligible' | 'ineligible';
  matched_rules: Array<{ description: string }>;
  failing_rules: Array<{ description: string }>;
  why?: string[];
  expected_documents: string[];
}

interface SchemeCardProps {
  scheme: Scheme;
  rank?: number;
  isExpanded: boolean;
  onToggle: () => void;
  localizedName: string;
  localizedExplanation: string;
}

const SchemeCard: React.FC<SchemeCardProps> = ({
  scheme,
  rank,
  isExpanded,
  onToggle,
  localizedName,
  localizedExplanation
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const getStatusBadge = () => {
    const statusConfig = {
      eligible: { class: 'eligible', text: t('schemes.eligible') },
      partially_eligible: { class: 'partial', text: t('schemes.partiallyEligible') },
      ineligible: { class: 'ineligible', text: t('schemes.notEligible') }
    };
    const config = statusConfig[scheme.eligibility_status];
    return (
      <span className={`status-badge ${config.class}`}>
        {config.text}
      </span>
    );
  };

  const getScoreBadge = () => {
    const scoreClass = scheme.score >= 80 ? 'high' : scheme.score >= 50 ? 'medium' : 'low';
    return (
      <span className={`score-badge ${scoreClass}`}>
        {scheme.score}%
      </span>
    );
  };

  return (
    <div className="scheme-card">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            {rank && (
              <span className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-sm font-bold text-primary-700">
                #{rank}
              </span>
            )}
            <h3 className="text-lg font-semibold text-gray-900">
              {localizedName}
            </h3>
          </div>

          <div className="flex items-center gap-3 mb-3">
            {getStatusBadge()}
            {getScoreBadge()}
          </div>

          {/* Score Progress Bar */}
          <div className="mb-3">
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="h-2 rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${scheme.score}%`,
                  backgroundColor: scheme.score >= 80 ? '#10B981' : scheme.score >= 50 ? '#F59E0B' : '#EF4444'
                }}
              />
            </div>
          </div>

          <p className="text-gray-600 mb-3">{localizedExplanation}</p>

          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-500">
              {t('schemes.benefit')}:
              <span className="font-semibold text-green-600 ml-1">
                ₹{scheme.benefit_estimate.toLocaleString('en-IN')}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Expand/Collapse Button */}
      <button
        onClick={onToggle}
        className="mt-4 text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center gap-1"
        aria-expanded={isExpanded}
      >
        {t('schemes.whyThis')}
        <span className="transform transition-transform" style={{
          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
        }}>
          ▼
        </span>
      </button>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t space-y-4 animate-slide-up">
          {/* Explainable AI - Why array */}
          {scheme.why && scheme.why.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                💡 {t('schemes.whyThis')}:
              </h4>
              <ul className="text-sm text-gray-600 space-y-1">
                {scheme.why.map((reason, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-[#1E8E4A]">•</span>
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {/* Matched Rules */}
          {scheme.matched_rules.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                ✅ {t('schemes.matchedRules')}:
              </h4>
              <ul className="text-sm text-gray-600 space-y-1">
                {scheme.matched_rules.map((rule, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-green-500">•</span>
                    {rule.description}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Failing Rules */}
          {scheme.failing_rules.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                ⚠️ {t('schemes.failingRules')}:
              </h4>
              <ul className="text-sm text-gray-600 space-y-1">
                {scheme.failing_rules.map((rule, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-yellow-500">•</span>
                    {rule.description}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Required Documents */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              📄 Required Documents:
            </h4>
            <div className="flex flex-wrap gap-2">
              {scheme.expected_documents.map((doc, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium border border-blue-100"
                >
                  📄 {doc}
                </span>
              ))}
            </div>
          </div>

          {/* Apply Button */}
          {scheme.eligibility_status !== 'ineligible' && (
            <button
              onClick={() => navigate(`/apply/${scheme.scheme_id}`)}
              className="btn-primary w-full mt-4"
            >
              {t('schemes.apply')} →
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default SchemeCard;
