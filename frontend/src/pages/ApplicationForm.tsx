/**
 * Application Form – Review and submit application for a scheme
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api/v1';

const ApplicationForm: React.FC = () => {
  const { schemeId } = useParams<{ schemeId: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { token, isAuthenticated, profile } = useAuth();

  const [schemeName, setSchemeName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ id: string; govId?: string } | null>(null);
  const [requiredDocs, setRequiredDocs] = useState<string[]>([]);
  const [userDocuments, setUserDocuments] = useState<Array<{ document_id: string; filename: string; doc_type?: string }>>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);

  // Auth check
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (!profile) {
      navigate('/profile');
      return;
    }
  }, [isAuthenticated, profile, navigate]);

  // Load scheme details and user documents
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (schemeId) {
          const [schemeRes, docsRes] = await Promise.all([
            axios.get(`${API_URL}/schemes/${schemeId}`).catch(() => ({ data: {} })),
            axios.get(`${API_URL}/documents`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: { documents: [] } }))
          ]);
          setSchemeName(schemeRes.data.name || schemeId?.replace(/-/g, ' ') || 'Government Scheme');
          setRequiredDocs(schemeRes.data.required_documents || schemeRes.data.documents_required || ['Aadhaar Card', 'Land Records', 'Bank Passbook']);
          setUserDocuments(docsRes.data.documents || []);
        }
      } catch (e) {
        setSchemeName(schemeId?.replace(/-/g, ' ') || 'Government Scheme');
        setRequiredDocs(['Aadhaar Card', 'Land Records', 'Bank Passbook']);
      } finally {
        setLoading(false);
      }
    };
    if (token) load();
  }, [schemeId, token]);

  const toggleDocSelection = (docId: string) => {
    setSelectedDocIds(prev =>
      prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]
    );
  };

  const handleSubmit = async () => {
    if (!profile?.profile_id) {
      setError('Profile ID missing. Please update your profile first.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        profile_id: profile.profile_id,
        scheme_id: schemeId,
        scheme_name: schemeName,
        documents: selectedDocIds,
        form_data: {
          name: profile.name,
          state: profile.state,
          district: profile.district,
          farmer_type: profile.farmer_type,
          notes: 'Applied via KRISHI-AI Portal'
        },
        client_timestamp: new Date().toISOString()
      };

      const res = await axios.post(
        `${API_URL}/application/submit`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const appId = res.data.application_id;
      setSuccess({
        id: appId,
        govId: res.data.gov_application_id
      });

      // Navigate to status page immediately after successful submission
      if (appId) {
        navigate(`/status/${appId}`);
      }

    } catch (err: any) {
      console.error('Submission failed', err);
      setError(err.response?.data?.error || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  if (success) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="bg-white rounded-3xl shadow-xl p-10 border border-gray-100">
          <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center text-4xl mb-6">
            🎉
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Application Submitted!</h2>
          <p className="text-gray-500 mb-6">Your application has been received and is being processed.</p>

          <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left">
            <div className="text-sm">
              <p className="text-gray-500">Application ID</p>
              <p className="font-mono font-bold text-gray-900">{success.id}</p>
            </div>
            {success.govId && (
              <div className="text-sm mt-3">
                <p className="text-gray-500">Govt Reference</p>
                <p className="font-mono font-bold text-green-700">{success.govId}</p>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => navigate(`/status/${success.id}`)}
              className="flex-1 btn-primary"
            >
              Track Status →
            </button>
            <button
              onClick={() => navigate('/schemes')}
              className="flex-1 btn-secondary"
            >
              Apply More
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">{t('application.title') || 'Application Form'}</h1>

      {error && (
        <div className="p-4 mb-4 text-red-700 bg-red-50 rounded-xl border border-red-200 text-sm flex items-center gap-2">
          <span>⚠️</span> {error}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        {/* Scheme header */}
        <div className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-100">
          <p className="text-xs text-green-600 font-semibold uppercase mb-1">Applying for</p>
          <h2 className="text-xl font-bold text-green-800">{schemeName}</h2>
        </div>

        <div className="p-6">
          {/* Applicant Summary */}
          <div className="mb-6 pb-6 border-b">
            <h3 className="text-sm font-bold text-gray-700 uppercase mb-3">Applicant Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-400">Name</p>
                <p className="font-semibold">{profile?.name}</p>
              </div>
              <div>
                <p className="text-gray-400">Mobile</p>
                <p className="font-semibold">{profile?.mobile}</p>
              </div>
              <div>
                <p className="text-gray-400">State / District</p>
                <p className="font-semibold">{profile?.state}, {profile?.district}</p>
              </div>
              <div>
                <p className="text-gray-400">Farmer Type</p>
                <p className="font-semibold capitalize">{profile?.farmer_type}</p>
              </div>
            </div>
          </div>

          {/* Document Checklist - Select from uploaded or go upload */}
          <div className="mb-8">
            <h3 className="text-sm font-bold text-gray-700 uppercase mb-3">Attach Documents</h3>
            {userDocuments.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-gray-500 mb-2">Select documents to attach to this application:</p>
                {userDocuments.map((doc) => (
                  <label key={doc.document_id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-green-300 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedDocIds.includes(doc.document_id)}
                      onChange={() => toggleDocSelection(doc.document_id)}
                      className="rounded border-gray-300 text-[#1E8E4A] focus:ring-[#1E8E4A]"
                    />
                    <span className="text-sm font-medium text-gray-700">{doc.filename}</span>
                    {doc.doc_type && <span className="text-xs text-gray-500">({doc.doc_type})</span>}
                  </label>
                ))}
                <p className="text-xs text-gray-500 mt-2">
                  <a href="/documents" className="text-[#1E8E4A] hover:underline">Upload more documents</a>
                </p>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-sm text-amber-800 mb-2">No documents uploaded yet.</p>
                <a href="/documents" className="text-[#1E8E4A] font-semibold hover:underline">Upload documents first →</a>
                <p className="text-xs text-amber-600 mt-2">You can still submit; add documents later if required.</p>
              </div>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold text-lg rounded-xl shadow-lg shadow-green-500/25 hover:shadow-xl disabled:opacity-50 transition-all duration-300 hover:-translate-y-0.5 disabled:hover:translate-y-0"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Submitting...
              </span>
            ) : 'Submit Application 🚀'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApplicationForm;
