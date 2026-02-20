/* Mock service worker */
self.addEventListener('install', () => {
    console.log('Service worker installed');
});
self.addEventListener('activate', () => {
    console.log('Service worker activated');
});
self.addEventListener('fetch', (event) => {
    // Basic passthrough
    event.respondWith(fetch(event.request));
});
