/**
 * Firebase Cloud Messaging service worker (must match src/lib/firebase.ts project + SDK major version).
 */

importScripts('https://www.gstatic.com/firebasejs/12.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBncLpnXmd5KIvE8Sq4iKi1ug4bl4hxhqk',
  authDomain: 'kmt-tracker-62159.firebaseapp.com',
  databaseURL: 'https://kmt-tracker-62159-default-rtdb.firebaseio.com',
  projectId: 'kmt-tracker-62159',
  storageBucket: 'kmt-tracker-62159.firebasestorage.app',
  messagingSenderId: '1093592499284',
  appId: '1:1093592499284:web:f105d5d3a425aeef9859c1',
  measurementId: 'G-4ELB2NRC27',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || payload.data?.title || 'Bus Tracker';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || '',
    icon: '/placeholder.svg',
    badge: '/placeholder.svg',
    tag: payload.data?.tag || 'bus-tracker',
    requireInteraction: false,
    renotify: true,
    data: payload.data || {},
    silent: false,
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.indexOf(self.registration.scope) >= 0 && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
