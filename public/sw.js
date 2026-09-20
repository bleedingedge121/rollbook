// public/sw.js — Roll Book Progressive Web App Service Worker
// Handles class reminder notifications, lock-screen alerts, and client focus.

const CACHE_NAME = 'rollbook-pwa-v1'

self.addEventListener('install', (event) => {
  // Activate worker immediately
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// Handle notification clicks: focus or open Roll Book
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing tab if open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus()
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
    })
  )
})

// Support Web Push events if configured
self.addEventListener('push', (event) => {
  let data = {
    title: 'Class Reminder — Roll Book',
    body: 'You have an upcoming class in 15 minutes.',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    tag: 'rollbook-class-reminder',
    data: { url: '/' },
  }

  if (event.data) {
    try {
      data = Object.assign(data, event.data.json())
    } catch {
      data.body = event.data.text()
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/icons/icon-192x192.png',
      badge: data.badge || '/icons/icon-192x192.png',
      vibrate: [200, 100, 200],
      tag: data.tag || 'rollbook-class-reminder',
      renotify: true,
      data: data.data || { url: '/' },
    })
  )
})
