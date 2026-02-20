/**
 * Loading Spinner Component
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'lg', className = '' }) => {
  const { t } = useTranslation();

  const sizeClasses = {
    sm: 'w-5 h-5 border-2',
    md: 'w-10 h-10 border-3',
    lg: 'w-16 h-16 border-4',
  };

  const containerClasses = size === 'lg' ? 'flex flex-col items-center justify-center min-h-[200px]' : 'inline-block';

  return (
    <div className={`${containerClasses} ${className}`} role="status">
      <div className={`relative ${sizeClasses[size]} rounded-full border-gray-200`}>
        <div className={`absolute top-0 left-0 w-full h-full border-transparent border-t-primary-600 rounded-full animate-spin ${sizeClasses[size].split(' ').filter(c => c.startsWith('border-')).join(' ')}`}></div>
      </div>
      {size === 'lg' && <p className="mt-4 text-gray-600">{t('common.loading')}</p>}
    </div>
  );
};

export default LoadingSpinner;
