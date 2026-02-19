/**
 * Admin Dashboard — Premium analytics with SVG charts, stat cards, and fraud alerts
 */

import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api/v1';

interface Metrics {
    overview: {
        total_users: number;
        total_profiles: number;
        total_applications: number;
        total_documents: number;
        ocr_success_rate?: number;
        recent_applications_7d: number;
        avg_farmer_income: number;
    };
    applications_by_status: Record<string, number>;
    top_states: Array<{ state: string; count: number }>;
    top_schemes: Array<{ scheme: string; count: number }>;
}

/* ───── SVG Donut Chart Component ───── */
const DonutChart: React.FC<{ data: Record<string, number> }> = ({ data }) => {
    const entries = Object.entries(data);
    const total = entries.reduce((sum, [, v]) => sum + v, 0) || 1;
    const colors = ['#3B82F6', '#F59E0B', '#8B5CF6', '#10B981', '#EF4444', '#6366F1', '#EC4899'];
    let cumulative = 0;

    const slices = entries.map(([status, count], i) => {
        const pct = count / total;
        const dashArray = pct * 100;
        const dashOffset = -cumulative * 100;
        cumulative += pct;
        return { status, count, pct, dashArray, dashOffset, color: colors[i % colors.length] };
    });

    return (
        <div className="flex items-center gap-6">
            <div className="relative w-36 h-36 flex-shrink-0">
                <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                    {slices.map((s, i) => (
                        <circle
                            key={i}
                            cx="18" cy="18" r="15.915"
                            fill="none"
                            stroke={s.color}
                            strokeWidth="3.5"
                            strokeDasharray={`${s.dashArray} ${100 - s.dashArray}`}
                            strokeDashoffset={s.dashOffset}
                            className="transition-all duration-700"
                        />
                    ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-gray-900">{total}</span>
                    <span className="text-xs text-gray-500">Total</span>
                </div>
            </div>
            <div className="flex flex-col gap-1.5">
                {slices.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                        <span className="text-gray-700">{s.status.replace(/_/g, ' ')}</span>
                        <span className="text-gray-400 ml-auto font-medium">{s.count}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

/* ───── SVG Bar Chart Component ───── */
const BarChart: React.FC<{ data: Array<{ label: string; value: number }> }> = ({ data }) => {
    const max = Math.max(...data.map(d => d.value), 1);
    const colors = ['#10B981', '#34D399', '#6EE7B7', '#A7F3D0', '#D1FAE5'];

    return (
        <div className="space-y-3">
            {data.map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-28 truncate text-right">{item.label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-5 relative overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all duration-700 ease-out"
                            style={{
                                width: `${(item.value / max) * 100}%`,
                                backgroundColor: colors[i % colors.length],
                                animationDelay: `${i * 100}ms`
                            }}
                        />
                    </div>
                    <span className="text-sm font-bold text-gray-700 w-10 text-right">{item.value}</span>
                </div>
            ))}
        </div>
    );
};

/* ───── OCR Gauge Component ───── */
const GaugeChart: React.FC<{ value: number }> = ({ value }) => {
    const angle = (value / 100) * 180;
    const color = value >= 80 ? '#10B981' : value >= 60 ? '#F59E0B' : '#EF4444';

    return (
        <div className="flex flex-col items-center">
            <div className="relative w-32 h-16 overflow-hidden">
                <svg viewBox="0 0 100 50" className="w-full h-full">
                    <path d="M 5 50 A 45 45 0 0 1 95 50" fill="none" stroke="#E5E7EB" strokeWidth="8" strokeLinecap="round" />
                    <path
                        d="M 5 50 A 45 45 0 0 1 95 50"
                        fill="none"
                        stroke={color}
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={`${(angle / 180) * 141.37} 141.37`}
                        className="transition-all duration-1000"
                    />
                </svg>
            </div>
            <span className="text-3xl font-bold mt-1" style={{ color }}>{value}%</span>
            <span className="text-xs text-gray-500 mt-1">OCR Success Rate</span>
        </div>
    );
};

/* ───── Stat Card Component ───── */
const StatCard: React.FC<{
    icon: string; label: string; value: string | number; trend?: string; color: string;
}> = ({ icon, label, value, trend, color }) => (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all duration-300 group">
        <div className="flex items-start justify-between mb-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${color}`}>
                {icon}
            </div>
            {trend && (
                <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                    {trend}
                </span>
            )}
        </div>
        <p className="text-2xl font-bold text-gray-900 group-hover:text-green-700 transition-colors">{value}</p>
        <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
);

const AdminDashboard: React.FC = () => {
    const { token } = useAuth();
    const [metrics, setMetrics] = useState<Metrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchMetrics = async () => {
            if (!token) {
                setError('Please login to access admin dashboard');
                setLoading(false);
                return;
            }
            try {
                const response = await fetch(`${API_URL}/admin/metrics`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) throw new Error('Failed to fetch metrics');
                const data = await response.json();
                setMetrics(data);
            } catch (err) {
                console.error(err);
                setError('Showing demo data — backend offline');
                setMetrics({
                    overview: {
                        total_users: 127,
                        total_profiles: 104,
                        total_applications: 89,
                        total_documents: 213,
                        ocr_success_rate: 78,
                        recent_applications_7d: 23,
                        avg_farmer_income: 165000
                    },
                    applications_by_status: {
                        SUBMITTED: 34,
                        RECEIVED: 22,
                        UNDER_REVIEW: 18,
                        APPROVED: 12,
                        REJECTED: 3
                    },
                    top_states: [
                        { state: 'Maharashtra', count: 42 },
                        { state: 'Gujarat', count: 23 },
                        { state: 'Madhya Pradesh', count: 18 },
                        { state: 'Rajasthan', count: 12 },
                        { state: 'Karnataka', count: 9 }
                    ],
                    top_schemes: [
                        { scheme: 'PM-KISAN Samman Nidhi', count: 34 },
                        { scheme: 'PM Fasal Bima Yojana', count: 22 },
                        { scheme: 'Kisan Credit Card', count: 18 },
                        { scheme: 'Soil Health Card', count: 9 },
                        { scheme: 'PM Krishi Sinchai Yojana', count: 6 }
                    ]
                });
            } finally {
                setLoading(false);
            }
        };
        fetchMetrics();
    }, [token]);

    if (loading) return <LoadingSpinner />;

    if (!metrics) return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            <p className="text-red-600">{error}</p>
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">📊 Admin Dashboard</h1>
                    <p className="text-gray-500 mt-1">Real-time platform analytics and insights</p>
                </div>
                {error && (
                    <span className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2 rounded-xl text-sm font-medium">
                        ⚠️ Demo Mode
                    </span>
                )}
            </div>

            {/* Stat Cards Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <StatCard icon="👥" label="Total Users" value={metrics.overview.total_users} trend="↑ Active" color="bg-blue-50" />
                <StatCard icon="📝" label="Profiles Created" value={metrics.overview.total_profiles} color="bg-green-50" />
                <StatCard icon="📄" label="Applications" value={metrics.overview.total_applications} trend={`+${metrics.overview.recent_applications_7d} this week`} color="bg-purple-50" />
                <StatCard icon="💰" label="Avg Income" value={`₹${metrics.overview.avg_farmer_income.toLocaleString('en-IN')}`} color="bg-amber-50" />
            </div>

            {/* Charts Row */}
            <div className="grid md:grid-cols-3 gap-6 mb-8">
                {/* Donut Chart */}
                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm md:col-span-1">
                    <h2 className="text-lg font-bold text-gray-900 mb-5">Application Status</h2>
                    <DonutChart data={metrics.applications_by_status} />
                </div>

                {/* Top States Bar Chart */}
                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm md:col-span-1">
                    <h2 className="text-lg font-bold text-gray-900 mb-5">Top States</h2>
                    <BarChart data={metrics.top_states.map(s => ({ label: s.state, value: s.count }))} />
                </div>

                {/* OCR Gauge + Doc Stats */}
                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex flex-col items-center justify-center">
                    <h2 className="text-lg font-bold text-gray-900 mb-5 self-start">Document AI</h2>
                    <GaugeChart value={metrics.overview.ocr_success_rate ?? 0} />
                    <div className="mt-4 flex gap-6 text-center">
                        <div>
                            <p className="text-xl font-bold text-gray-900">{metrics.overview.total_documents}</p>
                            <p className="text-xs text-gray-500">Documents</p>
                        </div>
                        <div>
                            <p className="text-xl font-bold text-green-600">
                                {Math.round((metrics.overview.total_documents * (metrics.overview.ocr_success_rate ?? 0)) / 100)}
                            </p>
                            <p className="text-xs text-gray-500">Successful</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Top Schemes */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <h2 className="text-lg font-bold text-gray-900 mb-5">🏆 Most Applied Schemes</h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {metrics.top_schemes.map((s, i) => {
                        const badgeColors = ['bg-yellow-100 text-yellow-800', 'bg-gray-100 text-gray-700', 'bg-amber-100 text-amber-800', 'bg-green-50 text-green-700', 'bg-blue-50 text-blue-700'];
                        return (
                            <div key={i} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-green-50 transition-colors group">
                                <span className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold ${badgeColors[i] || badgeColors[4]}`}>
                                    #{i + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-green-700 transition-colors">{s.scheme}</p>
                                    <p className="text-xs text-gray-500">{s.count} applications</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
