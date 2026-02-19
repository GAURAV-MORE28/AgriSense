import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n';
import ApplicationForm from '../pages/ApplicationForm';
import { AuthProvider } from '../contexts/AuthContext';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock navigation
const mockedNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockedNavigate,
    useParams: () => ({ schemeId: '123' }),
    useLocation: () => ({ state: { schemeName: 'PM KISAN' } }),
}));

// Mock Auth Context
jest.mock('../contexts/AuthContext', () => ({
    useAuth: () => ({
        token: 'test-token',
        login: jest.fn(),
        isAuthenticated: true,
        user: { userId: 'u1', mobile: '9999999999' },
        profile: { name: 'Test User', profile_id: 'p1', mobile: '9999999999', district: 'Pune', state: 'Maharashtra', farmer_type: 'owner' }
    }),
    AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

describe('ApplicationForm Component', () => {
    beforeEach(() => {
        // Mock localStorage
        Object.defineProperty(window, 'localStorage', {
            value: {
                getItem: jest.fn((key) => {
                    if (key === 'krishi-profile') return JSON.stringify({ name: 'Test User', profile_id: 'p1', mobile: '9999999999', district: 'Pune' });
                    return null;
                }),
                setItem: jest.fn(),
                removeItem: jest.fn(),
                clear: jest.fn(),
            },
            writable: true
        });

        mockedAxios.get.mockResolvedValue({
            data: { name: 'PM KISAN', documents_required: ['Aadhaar'] }
        });
    });

    test('renders form and submits successfully', async () => {
        render(
            <I18nextProvider i18n={i18n}>
                <BrowserRouter>
                    <ApplicationForm />
                </BrowserRouter>
            </I18nextProvider>
        );

        // Wait for data loading
        await waitFor(() => (expect(screen.queryByRole('status')) as any).not.toBeInTheDocument());

        // Check if submit button exists
        const submitBtn = await screen.findByText(/Submit Application/i);
        (expect(submitBtn) as any).toBeInTheDocument();

        // Mock successful submission
        mockedAxios.post.mockResolvedValueOnce({ data: { application_id: 'APP-001' } });

        // Click submit
        fireEvent.click(submitBtn);

        // Verify submission call
        await waitFor(() => {
            expect(mockedAxios.post).toHaveBeenCalledWith(
                expect.stringContaining('/application/submit'),
                expect.objectContaining({
                    scheme_id: '123',
                    profile_id: 'p1'
                }),
                expect.anything()
            );
        });

        // Verify navigation
        expect(mockedNavigate).toHaveBeenCalledWith('/status/APP-001');
    });
});
