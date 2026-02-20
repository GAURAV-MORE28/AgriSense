/**
 * Login Page – OTP-based authentication with premium design
 */

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4001/api/v1';

const Login: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { login, isAuthenticated, refreshProfile, hasProfile } = useAuth();

    const [mobile, setMobile] = useState('');
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [step, setStep] = useState<'mobile' | 'otp'>('mobile');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [demoOtp, setDemoOtp] = useState<string | null>(null);

    const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

    // If already logged in, redirect
    useEffect(() => {
        if (isAuthenticated) {
            navigate(hasProfile ? '/schemes' : '/profile');
        }
    }, [isAuthenticated, hasProfile, navigate]);

    const handleRequestOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const res = await axios.post(`${API_URL}/auth/request-otp`, { mobile });
            setStep('otp');
            if (res.data.demo_otp) {
                setDemoOtp(String(res.data.demo_otp));
            }
            // Focus first OTP input
            setTimeout(() => otpRefs.current[0]?.focus(), 100);
        } catch (err: any) {
            setError(err.response?.data?.errors?.[0]?.msg || err.response?.data?.error || 'Failed to request OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleOtpChange = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) return;
        const newOtp = [...otp];
        newOtp[index] = value.slice(-1);
        setOtp(newOtp);

        // Auto-advance
        if (value && index < 5) {
            otpRefs.current[index + 1]?.focus();
        }

        // Auto-submit when all 6 digits entered
        if (newOtp.every(d => d !== '') && newOtp.join('').length === 6) {
            handleLogin(newOtp.join(''));
        }
    };

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
    };

    const handleOtpPaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        const newOtp = [...otp];
        for (let i = 0; i < 6; i++) {
            newOtp[i] = pasted[i] || '';
        }
        setOtp(newOtp);
        if (pasted.length === 6) {
            handleLogin(pasted);
        }
    };

    const handleLogin = async (otpStr?: string) => {
        const otpValue = otpStr || otp.join('');
        if (otpValue.length !== 6) return;

        setLoading(true);
        setError(null);
        try {
            const res = await axios.post(`${API_URL}/auth/login`, { mobile, otp: otpValue });
            login(res.data.token, res.data.user);

            // Fetch profile to know where to navigate
            try {
                const profileRes = await fetch(`${API_URL}/profile`, {
                    headers: { Authorization: `Bearer ${res.data.token}` }
                });
                if (profileRes.ok) {
                    navigate('/schemes');
                } else {
                    navigate('/profile');
                }
            } catch (e) {
                navigate('/profile');
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Login failed. Check your OTP.');
            setOtp(['', '', '', '', '', '']);
            otpRefs.current[0]?.focus();
        } finally {
            setLoading(false);
        }
    };

    const handleAutoFill = () => {
        if (demoOtp) {
            const digits = demoOtp.split('');
            const newOtp = [...otp];
            for (let i = 0; i < 6; i++) {
                newOtp[i] = digits[i] || '';
            }
            setOtp(newOtp);
            handleLogin(demoOtp);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-emerald-50 to-amber-50 px-4 py-12">
            {/* Decorative blobs */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-green-200/30 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-72 h-72 bg-amber-200/30 rounded-full blur-3xl" />

            <div className="relative max-w-md w-full">
                {/* Card */}
                <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl shadow-green-900/10 border border-white/60 p-8 md:p-10">
                    {/* Logo */}
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 mx-auto bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center text-3xl shadow-lg shadow-green-500/30 mb-4">
                            🌾
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900">
                            {step === 'mobile' ? 'Welcome to KRISHI-AI' : 'Enter OTP'}
                        </h2>
                        <p className="text-gray-500 mt-2 text-sm">
                            {step === 'mobile'
                                ? 'Enter your mobile number to get started'
                                : `We sent a 6-digit code to +91 ${mobile}`
                            }
                        </p>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-sm flex items-center gap-2">
                            <span>⚠️</span> {error}
                        </div>
                    )}

                    {/* Demo OTP banner */}
                    {demoOtp && step === 'otp' && (
                        <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-green-200 rounded-xl px-4 py-3 mb-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-green-600 font-medium">Demo OTP</p>
                                    <p className="text-lg font-mono font-bold text-green-800 tracking-widest">{demoOtp}</p>
                                </div>
                                <button
                                    onClick={handleAutoFill}
                                    className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
                                >
                                    Auto-fill
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'mobile' ? (
                        <form onSubmit={handleRequestOtp} className="space-y-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Mobile Number
                                </label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-sm">+91</span>
                                    <input
                                        type="tel"
                                        value={mobile}
                                        onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                        className="w-full pl-14 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-lg font-medium focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                                        placeholder="98765 43210"
                                        maxLength={10}
                                        autoFocus
                                        required
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={loading || mobile.length !== 10}
                                className="w-full py-3.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold text-lg rounded-xl shadow-lg shadow-green-500/25 hover:shadow-xl hover:shadow-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:-translate-y-0.5 disabled:hover:translate-y-0"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                        Sending OTP...
                                    </span>
                                ) : 'Get OTP →'}
                            </button>
                        </form>
                    ) : (
                        <div className="space-y-6">
                            {/* OTP Input Boxes */}
                            <div className="flex justify-center gap-3" onPaste={handleOtpPaste}>
                                {otp.map((digit, i) => (
                                    <input
                                        key={i}
                                        ref={(el) => { otpRefs.current[i] = el; }}
                                        type="text"
                                        inputMode="numeric"
                                        value={digit}
                                        onChange={(e) => handleOtpChange(i, e.target.value)}
                                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                                        className="w-12 h-14 text-center text-xl font-bold bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                                        maxLength={1}
                                    />
                                ))}
                            </div>

                            <button
                                onClick={() => handleLogin()}
                                disabled={loading || otp.join('').length !== 6}
                                className="w-full py-3.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold text-lg rounded-xl shadow-lg shadow-green-500/25 hover:shadow-xl hover:shadow-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:-translate-y-0.5 disabled:hover:translate-y-0"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                        Verifying...
                                    </span>
                                ) : 'Verify & Login'}
                            </button>

                            <button
                                type="button"
                                onClick={() => { setStep('mobile'); setOtp(['', '', '', '', '', '']); setDemoOtp(null); setError(null); }}
                                className="w-full text-sm text-green-600 hover:text-green-700 font-medium"
                            >
                                ← Change Mobile Number
                            </button>
                        </div>
                    )}
                </div>

                {/* Trust badges */}
                <div className="mt-6 text-center">
                    <p className="text-xs text-gray-400">
                        🔐 Secured with JWT encryption • 🇮🇳 Made for Indian Farmers
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
