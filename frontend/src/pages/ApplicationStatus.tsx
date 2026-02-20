import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4001/api/v1';

interface StatusUpdate {
  status: string;
  timestamp: string;
  message: string;
}

interface ApplicationData {
  application_id: string;
  scheme_name: string;
  status: string;
  status_history: StatusUpdate[];
  gov_application_id?: string;
}

const ApplicationStatus: React.FC = () => {
  const { applicationId } = useParams<{ applicationId: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { token } = useAuth();

  const [application, setApplication] = useState<ApplicationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      if (!token || !applicationId) return;

      try {
        const response = await axios.get(
          `${API_URL}/application/${applicationId}/status`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setApplication(response.data);
      } catch (err) {
        console.error('Error fetching status:', err);
        setError('Failed to fetch application status');
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchStatus();
    } else {
      // If not authenticated, maybe just show loading or unauthorized
      // For demo, we might want to redirect, but let's just wait for auth (handled by App/AuthContext usually)
      setLoading(false);
      setError("Login required to view status");
    }

    // Poll for updates every 5 seconds
    const interval = setInterval(() => {
      if (token) fetchStatus();
    }, 5000);

    return () => clearInterval(interval);

  }, [applicationId, token]);

  if (loading) return <LoadingSpinner />;

  if (error) return (
    <div className="max-w-2xl mx-auto px-4 py-8 text-center text-red-600">
      <p>{error}</p>
      <button onClick={() => navigate('/')} className="mt-4 btn-secondary">Go Home</button>
    </div>
  );

  if (!application) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('status.title') || 'Application Status'}</h1>
        <span className={`px-3 py-1 rounded-full text-sm font-semibold status-badge ${application.status.toLowerCase()}`}>
          {application.status}
        </span>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
        <div className="p-6 border-b">
          <p className="text-gray-500 text-sm">Application ID</p>
          <p className="font-mono text-lg font-medium">{application.application_id}</p>
          {application.gov_application_id && (
            <div className="mt-2">
              <p className="text-gray-500 text-sm">Govt Reference ID</p>
              <p className="font-mono text-medium text-gray-700">{application.gov_application_id}</p>
            </div>
          )}
          <div className="mt-4">
            <p className="text-gray-500 text-sm">Scheme</p>
            <p className="text-xl font-semibold text-primary-700">{application.scheme_name}</p>
          </div>
        </div>

        <div className="p-6 bg-gray-50">
          <h2 className="text-lg font-semibold mb-6">{t('status.timeline') || 'Tracking Timeline'}</h2>

          <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-300 before:to-transparent">
            {application.status_history.map((update, idx) => (
              <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">

                {/* Icon */}
                <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-green-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 text-white font-bold">
                  ✓
                </div>

                {/* Content */}
                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded border border-gray-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between space-x-2 mb-1">
                    <div className="font-bold text-gray-900">{update.status.replace(/_/g, ' ')}</div>
                    <time className="font-caveat font-medium text-indigo-500 text-sm">
                      {new Date(update.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </time>
                  </div>
                  <div className="text-gray-500 text-sm">
                    {update.message}
                    <div className="mt-1 text-xs text-gray-400">
                      {new Date(update.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApplicationStatus;
