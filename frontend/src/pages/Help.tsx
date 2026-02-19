import React from 'react';
import { useTranslation } from 'react-i18next';

const Help: React.FC = () => {
  const { t } = useTranslation();

  const faqs = [
    {
      q: 'How do I create a profile?',
      a: 'Click "Get Started" on the home page and fill in your details step by step.'
    },
    {
      q: 'What documents do I need?',
      a: 'Common documents include Aadhaar Card, Land Records (7/12), Income Certificate, and Bank Passbook.'
    },
    {
      q: 'How long does approval take?',
      a: 'Most applications are processed within 2-4 weeks depending on the scheme.'
    },
    {
      q: 'Can I use this offline?',
      a: 'Yes! The app works offline. Your data will sync automatically when you reconnect.'
    }
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">{t('nav.help')}</h1>

      <div className="card mb-6">
        <h2 className="text-lg font-semibold mb-4">Contact Support</h2>
        <p className="text-gray-600 mb-4">Need help? Contact us:</p>
        <p className="font-medium">📞 Toll-Free: 1800-XXX-XXXX</p>
        <p className="font-medium">📧 Email: support@krishi-ai.gov.in</p>
      </div>

      <h2 className="text-lg font-semibold mb-4">Frequently Asked Questions</h2>
      <div className="space-y-4">
        {faqs.map((faq, idx) => (
          <details key={idx} className="card cursor-pointer">
            <summary className="font-medium">{faq.q}</summary>
            <p className="text-gray-600 mt-2">{faq.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
};

export default Help;
