import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api/v1';

const DocumentUpload: React.FC = () => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { token } = useAuth();

  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<Array<{ document_id: string; filename: string; doc_type?: string; ocr_confidence?: number; ocr_fields?: Record<string, string>; fields?: Record<string, string> }>>([]);
  const [error, setError] = useState<string | null>(null);

  // Fetch existing documents on load
  React.useEffect(() => {
    const fetchDocs = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await axios.get(`${API_URL}/documents`, { headers: { Authorization: `Bearer ${token}` } });
        setDocuments(res.data.documents || []);
      } catch {
        setDocuments([]);
      } finally {
        setLoading(false);
      }
    };
    fetchDocs();
  }, [token]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    if (!token) {
      setError("Please login to upload documents");
      return;
    }

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', files[0]);
    formData.append('doc_type_hint', 'aadhaar'); // Hint for demo purposes

    try {
      const res = await axios.post(`${API_URL}/documents/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        }
      });

      setDocuments(prev => [...prev, {
        document_id: res.data.document_id,
        filename: res.data.filename,
        doc_type: res.data.doc_type_guess,
        ocr_confidence: res.data.ocr_confidence,
        ocr_fields: res.data.fields
      }]);
    } catch (err) {
      console.error('Upload failed', err);
      setError('Document upload failed. Please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">{t('documents.title') || 'Document Upload'}</h1>

      {error && (
        <div className="p-4 mb-4 text-red-700 bg-red-100 rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg mb-6">
          <span className="text-4xl mb-4 block">📄</span>
          <p className="text-gray-600 mb-4">{t('documents.upload') || 'Upload Aadhaar or Land Record'}</p>

          <div className="flex justify-center gap-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-primary"
              disabled={uploading}
            >
              {uploading ? (
                <span className="flex items-center gap-2">
                  <LoadingSpinner size="sm" /> Processing OCR...
                </span>
              ) : (
                t('documents.file') || 'Select File'
              )}
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800">
          ℹ️ <strong>Tip:</strong> Upload a clear image of your Aadhaar card or 7/12 extract.
          Our AI will automatically extract your details.
        </div>
      </div>

      {documents.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold mb-4">Processed Documents</h2>
          {documents.map((doc) => (
            <div key={doc.document_id} className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold text-gray-900">{doc.filename}</h3>
                  <span className="text-xs text-gray-500 uppercase">{doc.doc_type || 'document'}</span>
                </div>
                <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-bold">
                  OCR Confidence: {((doc.ocr_confidence ?? 0) * 100).toFixed(0)}%
                </span>
              </div>

              <div className="mt-3 bg-gray-50 p-3 rounded">
                <p className="text-xs text-gray-500 mb-2 font-semibold uppercase">Extracted Data:</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {Object.entries(doc.ocr_fields || doc.fields || {}).map(([key, value]) => (
                    <div key={key}>
                      <span className="text-gray-500 capitalize">{key.replace('_', ' ')}:</span>
                      <span className="ml-1 font-medium text-gray-900 truncate block">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-3 flex justify-end">
                <button className="text-primary-600 text-sm font-medium hover:underline">
                  Verify & Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DocumentUpload;
