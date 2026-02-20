/**
 * Profile Wizard – Multi-step form for farmer profile creation
 * Uses AuthContext for token and profile persistence
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import VoiceInput from '../components/VoiceInput';

interface ProfileData {
  name: string;
  mobile: string;
  state: string;
  district: string;
  village: string;
  landType: 'irrigated' | 'dry' | 'mixed';
  acreage: number;
  mainCrops: string[];
  familyCount: number;
  annualIncome: number;
  farmerType: 'owner' | 'tenant' | 'sharecropper';
  // Extended fields
  educationLevel: string;
  irrigationAvailable: boolean;
  loanStatus: string;
  bankAccountLinked: boolean;
  aadhaarLinked: boolean;
  casteCategory: string;
  soilType: string;
  waterSource: string;
}

const STATES = [
  'Maharashtra', 'Gujarat', 'Madhya Pradesh', 'Rajasthan', 'Karnataka',
  'Andhra Pradesh', 'Telangana', 'Tamil Nadu', 'Uttar Pradesh', 'Punjab',
  'Haryana', 'Bihar', 'West Bengal', 'Odisha', 'Chhattisgarh'
];

const CROPS = [
  'rice', 'wheat', 'cotton', 'sugarcane', 'pulses', 'oilseeds',
  'maize', 'soybean', 'vegetables', 'fruits', 'mango', 'banana'
];

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4001/api/v1';

const ProfileWizard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { token, isAuthenticated, user, setProfile: setAuthProfile } = useAuth();

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [profile, setProfile] = useState<ProfileData>({
    name: '',
    mobile: user?.mobile || '',
    state: '',
    district: '',
    village: '',
    landType: 'irrigated',
    acreage: 0,
    mainCrops: [],
    familyCount: 1,
    annualIncome: 0,
    farmerType: 'owner',
    educationLevel: 'none',
    irrigationAvailable: false,
    loanStatus: 'none',
    bankAccountLinked: false,
    aadhaarLinked: false,
    casteCategory: 'general',
    soilType: 'unknown',
    waterSource: 'rainfed'
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  // Pre-fill mobile from auth
  useEffect(() => {
    if (user?.mobile && !profile.mobile) {
      setProfile(prev => ({ ...prev, mobile: user.mobile }));
    }
  }, [user, profile.mobile]);

  const updateProfile = (field: keyof ProfileData, value: unknown) => {
    setProfile(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleVoiceResult = (text: string, field: keyof ProfileData) => {
    updateProfile(field, text);
  };

  const validateStep = (): boolean => {
    if (step === 1) {
      if (!profile.name.trim()) { setError('Name is required'); return false; }
      if (!profile.state) { setError('Please select a state'); return false; }
      if (!profile.district.trim()) { setError('District is required'); return false; }
    }
    if (step === 2) {
      if (profile.acreage <= 0) { setError('Please enter land area'); return false; }
      if (profile.mainCrops.length === 0) { setError('Select at least one crop'); return false; }
    }
    if (step === 3) {
      if (profile.annualIncome <= 0) { setError('Please enter annual income'); return false; }
    }
    // Step 4 - all optional fields, nothing to validate
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    if (step < 4) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;
    setIsSubmitting(true);
    setError(null);

    try {
      // Map camelCase to snake_case for backend API
      const apiBody = {
        name: profile.name,
        mobile: profile.mobile || user?.mobile || '0000000000',
        state: profile.state,
        district: profile.district,
        village: profile.village,
        land_type: profile.landType,
        acreage: profile.acreage,
        main_crops: profile.mainCrops,
        family_count: profile.familyCount,
        annual_income: profile.annualIncome,
        farmer_type: profile.farmerType,
        education_level: profile.educationLevel,
        irrigation_available: profile.irrigationAvailable,
        loan_status: profile.loanStatus,
        bank_account_linked: profile.bankAccountLinked,
        aadhaar_linked: profile.aadhaarLinked,
        caste_category: profile.casteCategory,
        soil_type: profile.soilType,
        water_source: profile.waterSource
      };

      const response = await fetch(`${API_URL}/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(apiBody)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to save profile');
      }

      const data = await response.json();
      const savedProfile = data.profile;

      // Update AuthContext with the saved profile
      setAuthProfile(savedProfile);

      setSuccess(true);

      // Navigate to schemes after a brief success animation
      setTimeout(() => {
        navigate('/schemes');
      }, 1500);

    } catch (err: any) {
      console.error('Profile save failed:', err);
      setError(err.message || 'Failed to save profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCropToggle = (crop: string) => {
    const crops = profile.mainCrops.includes(crop)
      ? profile.mainCrops.filter(c => c !== crop)
      : [...profile.mainCrops, crop];
    updateProfile('mainCrops', crops);
  };

  if (success) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center animate-slide-up">
          <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center text-4xl mb-6">
            ✅
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Profile Saved!</h2>
          <p className="text-gray-500">Finding your best schemes...</p>
        </div>
      </div>
    );
  }

  const stepLabels = [
    { num: 1, label: t('profile.step1') || 'Personal Info', icon: '👤' },
    { num: 2, label: t('profile.step2') || 'Farm Details', icon: '🌾' },
    { num: 3, label: t('profile.step3') || 'Family & Income', icon: '💰' },
    { num: 4, label: 'Additional Info', icon: '📋' }
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        {t('profile.title') || 'Create Your Profile'}
      </h1>
      <p className="text-gray-500 text-sm mb-6">
        Fill your details to get personalized scheme recommendations
      </p>

      {/* Progress Steps */}
      <div className="flex items-center gap-2 mb-8">
        {stepLabels.map((s, i) => (
          <React.Fragment key={s.num}>
            <button
              onClick={() => s.num < step && setStep(s.num)}
              disabled={s.num > step}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${s.num === step
                ? 'bg-green-100 text-green-700 ring-2 ring-green-500 ring-offset-2'
                : s.num < step
                  ? 'bg-green-500 text-white cursor-pointer hover:bg-green-600'
                  : 'bg-gray-100 text-gray-400'
                }`}
            >
              <span>{s.num < step ? '✓' : s.icon}</span>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
            {i < 3 && <div className={`flex-1 h-0.5 rounded ${s.num < step ? 'bg-green-400' : 'bg-gray-200'}`} />}
          </React.Fragment>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm flex items-center gap-2">
          <span>⚠️</span> {error}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 md:p-8">
        {/* Step 1: Personal Info */}
        {step === 1 && (
          <div className="space-y-5 animate-slide-up">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('profile.name')} *
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={profile.name}
                  onChange={e => updateProfile('name', e.target.value)}
                  className="input-field flex-1"
                  placeholder="Enter your full name"
                  aria-label={t('profile.name')}
                  autoFocus
                />
                <VoiceInput onResult={(text) => handleVoiceResult(text, 'name')} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('profile.mobile')}
              </label>
              <input
                type="tel"
                value={profile.mobile}
                onChange={e => updateProfile('mobile', e.target.value)}
                className="input-field bg-gray-50"
                placeholder="9876543210"
                maxLength={10}
                readOnly={!!user?.mobile}
                aria-label={t('profile.mobile')}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('profile.state')} *
              </label>
              <select
                value={profile.state}
                onChange={e => updateProfile('state', e.target.value)}
                className="select-field"
                aria-label={t('profile.state')}
              >
                <option value="">Select State</option>
                {STATES.map(state => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t('profile.district')} *
                </label>
                <input
                  type="text"
                  value={profile.district}
                  onChange={e => updateProfile('district', e.target.value)}
                  className="input-field"
                  placeholder="e.g. Pune"
                  aria-label={t('profile.district')}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t('profile.village')}
                </label>
                <input
                  type="text"
                  value={profile.village}
                  onChange={e => updateProfile('village', e.target.value)}
                  className="input-field"
                  placeholder="Optional"
                  aria-label={t('profile.village')}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Farm Details */}
        {step === 2 && (
          <div className="space-y-6 animate-slide-up">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                {t('profile.landType')} *
              </label>
              <div className="grid grid-cols-3 gap-3">
                {(['irrigated', 'dry', 'mixed'] as const).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => updateProfile('landType', type)}
                    className={`py-3 px-4 rounded-xl border-2 text-sm font-semibold transition-all ${profile.landType === type
                      ? 'border-green-500 bg-green-50 text-green-700 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                  >
                    {type === 'irrigated' ? '💧' : type === 'dry' ? '☀️' : '🌤️'} {t(`profile.${type}`)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('profile.acreage')} *
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={profile.acreage || ''}
                  onChange={e => updateProfile('acreage', parseFloat(e.target.value) || 0)}
                  className="input-field pr-20"
                  placeholder="1.5"
                  step="0.1"
                  min="0"
                  aria-label={t('profile.acreage')}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">hectares</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                {t('profile.crops')} * <span className="text-gray-400 font-normal">(select all that apply)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {CROPS.map(crop => (
                  <button
                    key={crop}
                    type="button"
                    onClick={() => handleCropToggle(crop)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${profile.mainCrops.includes(crop)
                      ? 'bg-green-500 text-white shadow-sm scale-105'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    {crop}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                {t('profile.farmerType')} *
              </label>
              <div className="grid grid-cols-3 gap-3">
                {(['owner', 'tenant', 'sharecropper'] as const).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => updateProfile('farmerType', type)}
                    className={`py-3 px-4 rounded-xl border-2 text-sm font-semibold transition-all ${profile.farmerType === type
                      ? 'border-green-500 bg-green-50 text-green-700 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                  >
                    {t(`profile.${type}`)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Family & Income */}
        {step === 3 && (
          <div className="space-y-6 animate-slide-up">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('profile.familyCount')} *
              </label>
              <input
                type="number"
                value={profile.familyCount || ''}
                onChange={e => updateProfile('familyCount', parseInt(e.target.value) || 1)}
                className="input-field"
                placeholder="4"
                min="1"
                aria-label={t('profile.familyCount')}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('profile.annualIncome')} *
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">₹</span>
                <input
                  type="number"
                  value={profile.annualIncome || ''}
                  onChange={e => updateProfile('annualIncome', parseInt(e.target.value) || 0)}
                  className="input-field pl-10"
                  placeholder="150000"
                  min="0"
                  step="1000"
                  aria-label={t('profile.annualIncome')}
                />
              </div>
              {profile.annualIncome > 0 && (
                <p className="text-sm text-green-600 mt-2 font-medium">
                  ≈ ₹{(profile.annualIncome / 12).toLocaleString('en-IN', { maximumFractionDigits: 0 })} per month
                </p>
              )}
            </div>

            {/* Summary preview */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100">
              <h4 className="text-sm font-bold text-green-700 mb-3">📋 Profile Summary</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-500">Name:</span> <span className="font-medium">{profile.name}</span></div>
                <div><span className="text-gray-500">State:</span> <span className="font-medium">{profile.state}</span></div>
                <div><span className="text-gray-500">Land:</span> <span className="font-medium">{profile.acreage} ha ({profile.landType})</span></div>
                <div><span className="text-gray-500">Type:</span> <span className="font-medium capitalize">{profile.farmerType}</span></div>
                <div className="col-span-2"><span className="text-gray-500">Crops:</span> <span className="font-medium">{profile.mainCrops.join(', ')}</span></div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Additional Info (all optional) */}
        {step === 4 && (
          <div className="space-y-5 animate-slide-up">
            <p className="text-sm text-gray-500 mb-2">These details help us find more schemes — all fields are optional.</p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Education Level</label>
                <select value={profile.educationLevel} onChange={e => updateProfile('educationLevel', e.target.value)} className="select-field">
                  <option value="none">No formal education</option>
                  <option value="primary">Primary (1-5)</option>
                  <option value="secondary">Secondary (6-10)</option>
                  <option value="higher_secondary">Higher Secondary (11-12)</option>
                  <option value="graduate">Graduate</option>
                  <option value="postgraduate">Post-graduate</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Caste Category</label>
                <select value={profile.casteCategory} onChange={e => updateProfile('casteCategory', e.target.value)} className="select-field">
                  <option value="general">General</option>
                  <option value="obc">OBC</option>
                  <option value="sc">SC</option>
                  <option value="st">ST</option>
                  <option value="nt">NT</option>
                  <option value="vjnt">VJNT</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Soil Type</label>
                <select value={profile.soilType} onChange={e => updateProfile('soilType', e.target.value)} className="select-field">
                  <option value="unknown">Don't know</option>
                  <option value="black">Black (Kali)</option>
                  <option value="red">Red (Tambdi)</option>
                  <option value="alluvial">Alluvial</option>
                  <option value="laterite">Laterite (Jambha)</option>
                  <option value="sandy">Sandy</option>
                  <option value="clay">Clay</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Water Source</label>
                <select value={profile.waterSource} onChange={e => updateProfile('waterSource', e.target.value)} className="select-field">
                  <option value="rainfed">Rainfed only</option>
                  <option value="well">Well</option>
                  <option value="borewell">Borewell</option>
                  <option value="canal">Canal</option>
                  <option value="river">River/Stream</option>
                  <option value="tank">Tank/Pond</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Loan Status</label>
                <select value={profile.loanStatus} onChange={e => updateProfile('loanStatus', e.target.value)} className="select-field">
                  <option value="none">No loan</option>
                  <option value="active">Active loan</option>
                  <option value="repaid">Loan repaid</option>
                  <option value="defaulted">Loan defaulted</option>
                </select>
              </div>
              <div className="flex flex-col gap-3 pt-1">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={profile.irrigationAvailable} onChange={e => updateProfile('irrigationAvailable', e.target.checked)} className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                  <span className="text-sm font-medium text-gray-700">💧 Irrigation Available</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={profile.bankAccountLinked} onChange={e => updateProfile('bankAccountLinked', e.target.checked)} className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                  <span className="text-sm font-medium text-gray-700">🏦 Bank Account Linked</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={profile.aadhaarLinked} onChange={e => updateProfile('aadhaarLinked', e.target.checked)} className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                  <span className="text-sm font-medium text-gray-700">🆔 Aadhaar Linked</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8 pt-6 border-t border-gray-100">
          {step > 1 ? (
            <button onClick={handleBack} className="btn-secondary">
              ← {t('profile.back')}
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button onClick={handleNext} className="btn-primary">
              {t('profile.next')} →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-green-500/25 hover:shadow-xl disabled:opacity-50 transition-all duration-300 hover:-translate-y-0.5 disabled:hover:translate-y-0"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  Saving...
                </span>
              ) : (
                <>{t('profile.submit')} 🔍</>
              )}
            </button>
          )}
        </div>
      </div>

      <p className="text-center text-sm text-gray-400 mt-6">
        🔐 {t('profile.privacyNote')}
      </p>
    </div>
  );
};

export default ProfileWizard;
