import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './i18n';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Unregister service worker (missing file causes errors)
// Register service worker for PWA
serviceWorkerRegistration.register({
  onUpdate: (registration) => {
    // New content available, prompt user to refresh
    const waitingServiceWorker = registration.waiting;
    if (waitingServiceWorker) {
      waitingServiceWorker.addEventListener('statechange', (event) => {
        if ((event.target as ServiceWorker).state === 'activated') {
          window.location.reload();
        }
      });
      waitingServiceWorker.postMessage({ type: 'SKIP_WAITING' });
    }
  },
  onSuccess: () => {
    console.log('KRISHI-AI is ready for offline use!');
  }
});
