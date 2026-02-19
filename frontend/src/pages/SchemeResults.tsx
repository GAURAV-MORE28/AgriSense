/**
 * Scheme Results Page – AI-matched schemes with explainability
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import SchemeCard from '../components/SchemeCard';

interface Scheme {
  scheme_id: string;
  name: string;
  name_hi?: string;
  name_mr?: string;
  score: number;
  benefit_estimate: number;
  confidence: 'high' | 'medium' | 'low';
  eligibility_status: 'eligible' | 'partially_eligible' | 'ineligible';
  textual_explanation: string;
  textual_explanation_hi?: string;
  textual_explanation_mr?: string;
  matched_rules: Array<{ description: string }>;
  failing_rules: Array<{ description: string }>;
  expected_documents: string[];
}

interface MatchResponse {
  profile_id: string;
  total_schemes_evaluated: number;
  recommendations: Scheme[];
  processing_time_ms: number;
}

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4001/api/v1';

const SchemeResults: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { token, isAuthenticated, hasProfile, profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [evaluatedCount, setEvaluatedCount] = useState(0);
  const [processingTime, setProcessingTime] = useState(0);
  const [filter, setFilter] = useState<'all' | 'eligible' | 'partial'>('all');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (!hasProfile) {
      navigate('/profile');
      return;
    }

    const fetchSchemes = async () => {
      try {
        // Use the authenticated GET /schemes endpoint (fetches profile from DB)
        const response = await fetch(`${API_URL}/schemes?top_k=20`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data: MatchResponse = await response.json();
        setSchemes(data.recommendations || []);
        setEvaluatedCount(data.total_schemes_evaluated || 0);
        setProcessingTime(data.processing_time_ms || 0);
      } catch (err) {
        console.error('Error fetching schemes:', err);
        setError('Could not fetch recommendations. Showing demo data.');
        setSchemes(getDemoSchemes());
        setEvaluatedCount(20);
      } finally {
        setLoading(false);
      }
    };

    fetchSchemes();
  }, [token, isAuthenticated, hasProfile, navigate]);

  const getLocalizedName = (scheme: Scheme): string => {
    if (i18n.language === 'hi' && scheme.name_hi) return scheme.name_hi;
    if (i18n.language === 'mr' && scheme.name_mr) return scheme.name_mr;
    return scheme.name;
  };

  const getLocalizedExplanation = (scheme: Scheme): string => {
    if (i18n.language === 'hi' && scheme.textual_explanation_hi) return scheme.textual_explanation_hi;
    if (i18n.language === 'mr' && scheme.textual_explanation_mr) return scheme.textual_explanation_mr;
    return scheme.textual_explanation;
  };

  const filteredSchemes = schemes.filter(s => {
    if (filter === 'eligible') return s.eligibility_status === 'eligible';
    if (filter === 'partial') return s.eligibility_status === 'partially_eligible';
    return true;
  });

  const eligibleCount = schemes.filter(s => s.eligibility_status === 'eligible').length;
  const partialCount = schemes.filter(s => s.eligibility_status === 'partially_eligible').length;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <LoadingSpinner />
        <p className="mt-4 text-gray-500 animate-pulse">Running AI matching against {evaluatedCount || '20+'} schemes...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          🎯 {t('schemes.title') || 'Your Matched Schemes'}
        </h1>
        <p className="text-gray-500 text-sm">
          AI evaluated {evaluatedCount} schemes for {profile?.name || 'you'}
          {processingTime > 0 && <span className="text-gray-400"> • {processingTime}ms</span>}
        </p>
      </div>

      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800">
          ⚠️ {error}
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`p-3 rounded-xl border-2 text-center transition-all ${filter === 'all' ? 'border-green-500 bg-green-50' : 'border-gray-100 bg-white hover:border-gray-200'
            }`}
        >
          <p className="text-2xl font-bold text-gray-900">{schemes.length}</p>
          <p className="text-xs text-gray-500">Total Found</p>
        </button>
        <button
          onClick={() => setFilter('eligible')}
          className={`p-3 rounded-xl border-2 text-center transition-all ${filter === 'eligible' ? 'border-green-500 bg-green-50' : 'border-gray-100 bg-white hover:border-gray-200'
            }`}
        >
          <p className="text-2xl font-bold text-green-600">{eligibleCount}</p>
          <p className="text-xs text-gray-500">Fully Eligible</p>
        </button>
        <button
          onClick={() => setFilter('partial')}
          className={`p-3 rounded-xl border-2 text-center transition-all ${filter === 'partial' ? 'border-green-500 bg-green-50' : 'border-gray-100 bg-white hover:border-gray-200'
            }`}
        >
          <p className="text-2xl font-bold text-amber-600">{partialCount}</p>
          <p className="text-xs text-gray-500">Partially Eligible</p>
        </button>
      </div>

      {/* Scheme List */}
      <div className="grid gap-4">
        {filteredSchemes.map((scheme, index) => (
          <SchemeCard
            key={scheme.scheme_id}
            scheme={scheme}
            rank={filter === 'all' ? index + 1 : undefined}
            isExpanded={expandedId === scheme.scheme_id}
            onToggle={() => setExpandedId(
              expandedId === scheme.scheme_id ? null : scheme.scheme_id
            )}
            localizedName={getLocalizedName(scheme)}
            localizedExplanation={getLocalizedExplanation(scheme)}
          />
        ))}
      </div>

      {filteredSchemes.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">🔍</p>
          <p>No schemes match this filter. Try "Total Found" view.</p>
        </div>
      )}
    </div>
  );
};

// Demo data for offline/fallback
function getDemoSchemes(): Scheme[] {
  return [
    {
      scheme_id: 'PM-KISAN-001',
      name: 'PM-KISAN Samman Nidhi',
      name_hi: 'पीएम-किसान सम्मान निधि',
      name_mr: 'पीएम-किसान सन्मान निधी',
      score: 95, benefit_estimate: 6000, confidence: 'high', eligibility_status: 'eligible',
      textual_explanation: 'You are fully eligible for PM-KISAN. You could receive up to ₹6,000 annually.',
      textual_explanation_hi: 'आप पीएम-किसान के लिए पूर्ण रूप से पात्र हैं।',
      textual_explanation_mr: 'तुम्ही पीएम-किसान साठी पूर्णपणे पात्र आहात.',
      matched_rules: [{ description: 'Land holding ≤ 2 hectares' }, { description: 'Owner or tenant farmer' }],
      failing_rules: [],
      expected_documents: ['Aadhaar Card', 'Land Records', 'Bank Passbook']
    },
    {
      scheme_id: 'PMFBY-003',
      name: 'PM Fasal Bima Yojana',
      name_hi: 'प्रधानमंत्री फसल बीमा योजना',
      name_mr: 'प्रधानमंत्री पीक विमा योजना',
      score: 88, benefit_estimate: 60000, confidence: 'high', eligibility_status: 'eligible',
      textual_explanation: 'You are eligible for crop insurance coverage based on your crops and land.',
      matched_rules: [{ description: 'Has cultivable land' }, { description: 'Grows notified crops' }],
      failing_rules: [],
      expected_documents: ['Aadhaar Card', 'Land Records', 'Sowing Certificate']
    },
    {
      scheme_id: 'KCC-004',
      name: 'Kisan Credit Card',
      name_hi: 'किसान क्रेडिट कार्ड',
      name_mr: 'किसान क्रेडिट कार्ड',
      score: 82, benefit_estimate: 150000, confidence: 'medium', eligibility_status: 'eligible',
      textual_explanation: 'You can get credit at subsidized interest rates for farm operations.',
      matched_rules: [{ description: 'Owner or tenant farmer' }],
      failing_rules: [],
      expected_documents: ['Aadhaar Card', 'Land Records', 'Bank Account']
    }
  ];
}

export default SchemeResults;
