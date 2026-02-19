import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import LoadingSpinner from '../components/LoadingSpinner';

interface SchemeDetail {
  scheme_id: string;
  name: string;
  name_hi?: string;
  name_mr?: string;
  description: string;
  benefit_type: string;
  benefit_value: any;
  category: string;
  ministry: string;
  rules: any[];
  documents_required: string[];
}

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4001/api/v1';

const SchemeDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [scheme, setScheme] = useState<SchemeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSchemeDetails = async () => {
      try {
        const response = await axios.get(`${API_URL}/schemes/${id}`);
        setScheme(response.data);
      } catch (err) {
        console.error('Error fetching scheme details:', err);
        setError(t('common.error'));
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchSchemeDetails();
    }
  }, [id, t]);

  const getLocalizedName = (s: SchemeDetail) => {
    if (i18n.language === 'hi' && s.name_hi) return s.name_hi;
    if (i18n.language === 'mr' && s.name_mr) return s.name_mr;
    return s.name;
  };

  if (loading) return <LoadingSpinner />;
  if (error || !scheme) return (
    <div className="max-w-4xl mx-auto px-4 py-8 text-center">
      <p className="text-red-600">{error || 'Scheme not found'}</p>
      <button onClick={() => navigate(-1)} className="mt-4 btn-secondary">
        ← Back
      </button>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center text-primary-600 hover:text-primary-800 mb-6 transition-colors"
      >
        <span className="mr-2">←</span> {t('common.back')}
      </button>

      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-primary-50 px-6 py-8 border-b border-primary-100">
          <div className="flex justify-between items-start">
            <div>
              <span className="inline-block px-3 py-1 bg-white text-primary-700 rounded-full text-sm font-medium mb-3 shadow-sm">
                {scheme.ministry || 'Government Scheme'}
              </span>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {getLocalizedName(scheme)}
              </h1>
              <p className="text-gray-600">ID: {scheme.scheme_id}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-8">
          {/* Description */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              About the Scheme
            </h2>
            <p className="text-gray-700 leading-relaxed text-lg">
              {scheme.description}
            </p>
          </section>

          {/* Benefits */}
          <section className="bg-green-50 rounded-lg p-5 border border-green-100">
            <h2 className="text-lg font-semibold text-green-800 mb-2">
              💰 Benefits
            </h2>
            <p className="text-green-900">
              <span className="font-bold">Type:</span> {scheme.benefit_type}
            </p>
            <p className="text-green-900 mt-1">
              <span className="font-bold">Value:</span> {JSON.stringify(scheme.benefit_value)}
            </p>
          </section>

          {/* Documents Required */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              📄 Documents Required
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {scheme.documents_required?.map((doc, idx) => (
                <div key={idx} className="flex items-center p-3 bg-gray-50 rounded-lg border">
                  <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mr-3 font-bold">
                    {idx + 1}
                  </span>
                  <span className="text-gray-700 font-medium">{doc}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Action Bar */}
          <div className="pt-6 border-t flex justify-end">
            <button
              onClick={() => navigate(`/apply/${scheme.scheme_id}`, { state: { schemeName: getLocalizedName(scheme) } })}
              className="btn-primary text-lg px-8 py-3 shadow-lg hover:shadow-xl transform transition-all active:scale-95"
            >
              Start Application →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SchemeDetail;
