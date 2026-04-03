/**
 * PLTS SmartHome Dashboard - PWA & Notifications Module
 * Handles Service Worker registration, install prompts, push notifications,
 * and periodic background alert polling.
 * Depends on: Utils (for toast), Api (for alert data)
 */

const PWA = {
  // ==================================================================
  // Configuration
  // ==================================================================

  /** Path to the service worker file (relative to the site root) */
  SW_PATH: './sw.js',

  /** Reference to the registered ServiceWorker */
  _registration: null,

  /** Interval ID for notification polling */
  _pollIntervalId: null,

  /** Deferred install prompt (for "Add to Home Screen") */
  deferredPrompt: null,

  /** Last polled alert timestamp to avoid duplicate notifications */
  _lastAlertTimestamp: null,

  /* =========================================================
   * Initialization
   * ========================================================= */

  /**
   * Initialize PWA features:
   * 1. Register service worker
   * 2. Set up install prompt listener
   * 3. Listen for SW update messages
   */
  async init() {
    // Register service worker
    await this._registerServiceWorker();

    // Set up "Add to Home Screen" prompt
    this.initInstallPrompt();

    // Listen for messages from service worker
    this._listenForMessages();

    console.log('[PWA] Initialized.');
  },

  /* =========================================================
   * Service Worker Registration
   * ========================================================= */

  /**
   * Register the service worker and handle updates.
   * @private
   */
  async _registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      console.warn('[PWA] Service Workers not supported in this browser.');
      return;
    }

    try {
      this._registration = await navigator.serviceWorker.register(this.SW_PATH, {
        scope: './',
      });

      console.log('[PWA] Service Worker registered:', this._registration.scope);

      // Handle updates
      this._registration.addEventListener('updatefound', () => {
        const newWorker = this._registration.installer;
        if (!newWorker) return;

        console.log('[PWA] New Service Worker found, installing...');

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'activated') {
            console.log('[PWA] New Service Worker activated.');
            if (typeof Utils !== 'undefined') {
              Utils.showToast('Versi baru tersedia! Muat ulang halaman untuk memperbarui.', 'info', 8000);
            }
          }
        });
      });

      // Handle controller change (new SW took over)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[PWA] Controller changed, reloading...');
        // Optionally auto-reload:
        // window.location.reload();
      });
    } catch (err) {
      console.error('[PWA] Service Worker registration failed:', err);
    }
  },

  /* =========================================================
   * Install Prompt ("Add to Home Screen")
   * ========================================================= */

  /**
   * Initialize the install prompt handler.
   * Captures the `beforeinstallprompt` event so we can show it later.
   */
  initInstallPrompt() {
    // Prevent default mini-infobar on mobile
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      console.log('[PWA] Install prompt captured.');

      // Show install banner/button in the UI if element exists
      const installBtn = document.getElementById('btn-install-pwa');
      if (installBtn) {
        installBtn.style.display = 'flex';
        installBtn.addEventListener('click', () => this.promptInstall());
      }
    });

    // Track whether app was successfully installed
    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      console.log('[PWA] App installed successfully.');
      if (typeof Utils !== 'undefined') {
        Utils.showToast('Aplikasi berhasil dipasang!', 'success');
      }
      // Hide install button
      const installBtn = document.getElementById('btn-install-pwa');
      if (installBtn) installBtn.style.display = 'none';
    });
  },

  /**
   * Trigger the browser's install prompt (if available).
   * @returns {Promise<boolean>} true if prompt was shown
   */
  async promptInstall() {
    if (!this.deferredPrompt) {
      console.log('[PWA] No install prompt available.');
      return false;
    }

    try {
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      console.log('[PWA] Install prompt outcome:', outcome);
      this.deferredPrompt = null;
      return outcome === 'accepted';
    } catch (err) {
      console.error('[PWA] Error showing install prompt:', err);
      return false;
    }
  },

  /* =========================================================
   * Standalone Mode Detection
   * ========================================================= */

  /**
   * Check if the app is running in standalone mode (installed PWA).
   * @returns {boolean}
   */
  isStandalone() {
    // Check various display modes
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches ||
      // iOS Safari fallback
      window.navigator.standalone === true
    );
  },

  /* =========================================================
   * Notifications
   * ========================================================= */

  /**
   * Get the current notification permission status.
   * @returns {NotificationPermission}
   */
  getNotificationPermission() {
    if (!('Notification' in window)) return 'denied';
    return Notification.permission;
  },

  /**
   * Request browser notification permission from the user.
   * @returns {Promise<NotificationPermission>}
   */
  async requestNotificationPermission() {
    if (!('Notification' in window)) {
      console.warn('[PWA] Notifications not supported in this browser.');
      return 'denied';
    }

    // If already granted or denied, return current status
    if (Notification.permission !== 'default') {
      return Notification.permission;
    }

    try {
      const permission = await Notification.requestPermission();
      console.log('[PWA] Notification permission:', permission);
      return permission;
    } catch (err) {
      console.error('[PWA] Error requesting notification permission:', err);
      return 'denied';
    }
  },

  /**
   * Show a browser notification.
   * Works even when the app is in the background (if permission granted).
   * Falls back to toast if notifications are not available.
   *
   * @param {string} title - notification title
   * @param {NotificationOptions} options - standard Notification API options
   * @returns {Promise<Notification|null>}
   */
  async showNotification(title, options = {}) {
    // Default options
    const opts = {
      icon: './img/icon-192.png',
      badge: './img/badge-72.png',
      vibrate: [100, 50, 100],
      tag: 'plts-smarthome',
      renotify: true,
      ...options,
    };

    // Try browser notification first
    if (this.getNotificationPermission() === 'granted') {
      try {
        // If service worker is active, show via SW (works when app is closed)
        if (this._registration) {
          await this._registration.showNotification(title, opts);
          console.log('[PWA] Notification shown via Service Worker.');
          return null;
        }

        // Fallback: direct Notification API
        const notification = new Notification(title, opts);
        notification.onclick = () => {
          window.focus();
          if (opts.onClick) opts.onClick();
          notification.close();
        };
        console.log('[PWA] Notification shown directly.');
        return notification;
      } catch (err) {
        console.warn('[PWA] Failed to show notification:', err);
        // Fall through to toast
      }
    }

    // Fallback to toast notification
    if (typeof Utils !== 'undefined') {
      const body = opts.body || '';
      Utils.showToast(`${title}${body ? ': ' + body : ''}`, opts.data?.type || 'info', 6000);
    }

    return null;
  },

  /* =========================================================
   * Alert Polling
   * ========================================================= */

  /**
   * Start periodic polling for new alerts/notifications from the backend.
   * @param {number} intervalMs - polling interval in milliseconds (default 30s)
   */
  startNotificationPolling(intervalMs = 30000) {
    // Don't start if already polling
    if (this._pollIntervalId) {
      console.log('[PWA] Notification polling already active.');
      return;
    }

    // Don't poll if notifications are not permitted
    if (this.getNotificationPermission() !== 'granted') {
      console.log('[PWA] Notifications not granted, skipping polling.');
      return;
    }

    // Initial poll
    this._pollForAlerts();

    // Set up interval
    this._pollIntervalId = setInterval(() => {
      this._pollForAlerts();
    }, intervalMs);

    console.log(`[PWA] Notification polling started (every ${intervalMs / 1000}s).`);
  },

  /**
   * Stop periodic alert polling.
   */
  stopNotificationPolling() {
    if (this._pollIntervalId) {
      clearInterval(this._pollIntervalId);
      this._pollIntervalId = null;
      console.log('[PWA] Notification polling stopped.');
    }
  },

  /**
   * Poll the backend for new alerts and show browser notifications.
   * @private
   */
  async _pollForAlerts() {
    try {
      const result = await Api.getEventLog(5);

      if (!result || !Array.isArray(result) || result.length === 0) return;

      // Filter for high-severity events (warnings and errors)
      const alerts = result.filter(
        (evt) =>
          evt.severity === 'warning' ||
          evt.severity === 'error' ||
          evt.severity === 'critical'
      );

      if (alerts.length === 0) return;

      // Only show notifications for events newer than our last check
      const now = Date.now();
      const newAlerts = alerts.filter((evt) => {
        if (!evt.timestamp) return false;
        const evtTime = new Date(evt.timestamp).getTime();
        if (this._lastAlertTimestamp && evtTime <= this._lastAlertTimestamp) return false;
        return (now - evtTime) < 60000; // Only events from last 60 seconds
      });

      // Update last alert timestamp
      if (alerts.length > 0) {
        const latestTimestamp = alerts[0].timestamp;
        if (latestTimestamp) {
          this._lastAlertTimestamp = new Date(latestTimestamp).getTime();
        }
      }

      // Show notifications for new alerts (max 3 to avoid spam)
      const toShow = newAlerts.slice(0, 3);
      for (const alert of toShow) {
        const isCritical = alert.severity === 'error' || alert.severity === 'critical';
        await this.showNotification(
          isCritical ? '⚠️ Peringatan PLTS' : 'ℹ️ Notifikasi PLTS',
          {
            body: alert.message || alert.event_type || 'Event baru terdeteksi',
            tag: `alert-${alert.timestamp || Date.now()}`,
            data: { type: isCritical ? 'error' : 'warning' },
          }
        );
      }
    } catch (err) {
      // Silently fail - polling errors shouldn't disrupt the UI
      console.warn('[PWA] Alert polling error:', err.message);
    }
  },

  /* =========================================================
   * Updates
   * ========================================================= */

  /**
   * Check if a new version of the app is available.
   * @returns {Promise<boolean>} true if update is available
   */
  async checkForUpdate() {
    if (!this._registration) {
      await this._registerServiceWorker();
    }

    if (!this._registration) return false;

    try {
      await this._registration.update();
      return !this._registration.active;
    } catch (err) {
      console.error('[PWA] Error checking for updates:', err);
      return false;
    }
  },

  /* =========================================================
   * Service Worker Messaging
   * ========================================================= */

  /**
   * Listen for messages from the service worker.
   * @private
   */
  _listenForMessages() {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.addEventListener('message', (event) => {
      const { type, data } = event.data || {};

      switch (type) {
        case 'ALERT':
          // Service worker received a push notification
          if (data) {
            this.showNotification(data.title || 'Notifikasi PLTS', {
              body: data.body || data.message,
              data: { type: data.severity || 'info' },
            });
          }
          break;

        case 'UPDATE_AVAILABLE':
          if (typeof Utils !== 'undefined') {
            Utils.showToast('Versi baru tersedia! Muat ulang halaman untuk memperbarui.', 'info', 10000);
          }
          break;

        default:
          console.log('[PWA] Message from SW:', event.data);
      }
    });
  },

  /* =========================================================
   * Cleanup
   * ========================================================= */

  /**
   * Clean up PWA resources (call on logout).
   */
  destroy() {
    this.stopNotificationPolling();
    this._lastAlertTimestamp = null;
    this.deferredPrompt = null;
    console.log('[PWA] Destroyed.');
  },
};
