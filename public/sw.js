// Basic Service Worker required for native mobile web notifications.
// It doesn't need to intercept fetch or handle push events if we are just calling showNotification locally.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  // Focus the window when notification is clicked
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Look for a chat window
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      // If none found, open the app
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
