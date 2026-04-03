/**
 * PLTS SmartHome Dashboard - Utility Functions
 * Shared utilities used across all modules.
 * No dependencies. Must be loaded first.
 */

const Utils = {
  /* =========================================================
   * Constants
   * ========================================================= */

  // Relay channel names (1-based index)
  RELAY_NAMES: [
    'Lampu Teras',
    'Lampu Tengah',
    'Lampu Tengah Aux',
    'Lampu Kamar Ayah',
    'Lampu Kamar Fatimah',
    'Lampu Kamar Mandi',
    'Lampu Gudang',
    'Lampu Belakang',
    'Lampu Kamar',
    'Kipas Utama',
    'Kipas Panel',
    'Inverter',
    'Air Conditioner',
  ],

  // Trigger types for rules engine
  TRIGGER_TYPES: [
    { value: 'time', label: 'Waktu (Scheduler)' },
    { value: 'batt', label: 'Battery SoC' },
    { value: 'temp', label: 'Suhu' },
    { value: 'humi', label: 'Kelembaban' },
    { value: 'pir', label: 'PIR Motion' },
    { value: 'pv_i', label: 'Arus MPPT' },
    { value: 'ac_i', label: 'Arus AC Load' },
    { value: 'manual', label: 'Manual' },
  ],

  // Comparison operators for rule conditions
  OPERATORS: [
    { value: '>', label: '>' },
    { value: '<', label: '<' },
    { value: '>=', label: '>=' },
    { value: '<=', label: '<=' },
    { value: '==', label: '=' },
  ],

  // Action types for rules engine
  ACTION_TYPES: [
    { value: 'relay', label: 'Set Relay' },
    { value: 'pwm', label: 'Set PWM' },
    { value: 'pv', label: 'PV Disconnect' },
    { value: 'alert', label: 'Kirim Alert' },
    { value: 'log', label: 'Log Event' },
  ],

  /* =========================================================
   * Cryptography
   * ========================================================= */

  /**
   * Compute SHA-256 hash of a message string.
   * Returns lowercase hex string.
   * @param {string} message
   * @returns {Promise<string>}
   */
  async sha256(message) {
    try {
      const msgBuffer = new TextEncoder().encode(message);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch (err) {
      console.error('[Utils.sha256] Error:', err);
      throw new Error('Gagal menghitung hash SHA-256. Browser tidak mendukung SubtleCrypto.');
    }
  },

  /* =========================================================
   * Date & Time Formatting
   * ========================================================= */

  /**
   * Format a date value to Indonesian locale string.
   * @param {Date|string|number} date - Date object, ISO string, or timestamp ms
   * @param {'short'|'full'|'date'} format
   * @returns {string}
   */
  formatDate(date, format = 'short') {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '-';

    const pad = (n) => String(n).padStart(2, '0');

    const day = pad(d.getDate());
    const month = pad(d.getMonth() + 1);
    const year = d.getFullYear();
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    const seconds = pad(d.getSeconds());

    switch (format) {
      case 'short':
        return `${hours}:${minutes}`;
      case 'full':
        return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
      case 'date':
        return `${day}/${month}/${year}`;
      default:
        return `${day}/${month}/${year} ${hours}:${minutes}`;
    }
  },

  /**
   * Relative time string, e.g. "5 menit yang lalu".
   * @param {Date|string|number} date
   * @returns {string}
   */
  timeAgo(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '-';

    const now = Date.now();
    const diffMs = now - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const absDiff = Math.abs(diffSec);

    // Future time (data from device clock may be ahead)
    if (diffSec < 0) {
      if (absDiff < 60) return 'baru saja';
      return `dalam ${this.timeAgoLabel(absDiff)}`;
    }

    if (absDiff < 10) return 'baru saja';
    return `${this.timeAgoLabel(absDiff)} yang lalu`;
  },

  /**
   * Internal helper: convert seconds to a human-readable label.
   * @param {number} seconds
   * @returns {string}
   */
  timeAgoLabel(seconds) {
    if (seconds < 60) return `${seconds} detik`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} menit`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} jam`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} hari`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} bulan`;
    const years = Math.floor(months / 12);
    return `${years} tahun`;
  },

  /* =========================================================
   * Number Formatting
   * ========================================================= */

  /**
   * Format number with dot as thousands separator (Indonesian convention).
   * @param {number} num
   * @param {number} decimals - Decimal places
   * @returns {string}
   */
  formatNumber(num, decimals = 1) {
    if (num === null || num === undefined || isNaN(num)) return '-';
    const fixed = Number(num).toFixed(decimals);
    const [intPart, decPart] = fixed.split('.');
    const withSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return decPart ? `${withSep},${decPart}` : withSep;
  },

  /**
   * Format a ratio (0-1) or percentage (0-100) as percentage string.
   * Auto-detects: if value > 1, treat as already percentage.
   * @param {number} value
   * @param {number} decimals
   * @returns {string}
   */
  formatPercent(value, decimals = 1) {
    if (value === null || value === undefined || isNaN(value)) return '-';
    const pct = Math.abs(value) <= 1 ? value * 100 : value;
    return `${this.formatNumber(pct, decimals)}%`;
  },

  /* =========================================================
   * Animation
   * ========================================================= */

  /**
   * Animate a numeric value inside an element.
   * @param {HTMLElement} element
   * @param {number} start
   * @param {number} end
   * @param {number} duration - ms
   * @param {string} suffix - appended after number (e.g. '%', 'V', 'A')
   */
  animateValue(element, start, end, duration = 1000, suffix = '') {
    if (!element) return;
    const range = end - start;
    const startTime = performance.now();

    const step = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + range * eased;
      element.textContent = this.formatNumber(current) + suffix;
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
  },

  /* =========================================================
   * DOM Helpers
   * ========================================================= */

  /** Shorthand for querySelector (null-safe). */
  $(selector) {
    return document.querySelector(selector);
  },

  /** Shorthand for querySelectorAll. */
  $$(selector) {
    return document.querySelectorAll(selector);
  },

  /**
   * Create an HTML element with optional className and innerHTML.
   * @param {string} tag
   * @param {string} [className]
   * @param {string} [innerHTML]
   * @returns {HTMLElement}
   */
  createElement(tag, className, innerHTML) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (innerHTML !== undefined) el.innerHTML = innerHTML;
    return el;
  },

  /* =========================================================
   * Toast Notifications
   * ========================================================= */

  /**
   * Show a toast notification.
   * @param {string} message
   * @param {'success'|'error'|'warning'|'info'} type
   * @param {number} duration - ms before auto-remove
   * @param {'top-right'|'bottom-right'|'top-center'} position
   */
  showToast(message, type = 'info', duration = 4000, position = 'top-right') {
    const containerId = `toast-container-${position}`;

    let container = document.getElementById(containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = containerId;
      container.className = 'toast-container';

      // Position-specific styles
      Object.assign(container.style, {
        position: 'fixed',
        zIndex: '10000',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        pointerEvents: 'none',
        maxHeight: '80vh',
        overflow: 'hidden',
      });

      if (position === 'top-right') {
        Object.assign(container.style, { top: '20px', right: '20px', alignItems: 'flex-end' });
      } else if (position === 'bottom-right') {
        Object.assign(container.style, { bottom: '20px', right: '20px', alignItems: 'flex-end' });
      } else if (position === 'top-center') {
        Object.assign(container.style, { top: '20px', left: '50%', transform: 'translateX(-50%)', alignItems: 'center' });
      }

      document.body.appendChild(container);
    }

    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ',
    };

    const borderColors = {
      success: '#3fb950',
      error: '#f85149',
      warning: '#d29922',
      info: '#58a6ff',
    };

    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    Object.assign(toast.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '12px 20px',
      borderRadius: '8px',
      backgroundColor: '#1c2333',
      color: '#e6edf3',
      fontSize: '14px',
      borderLeft: `4px solid ${borderColors[type] || borderColors.info}`,
      boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
      pointerEvents: 'auto',
      minWidth: '280px',
      maxWidth: '420px',
      opacity: '0',
      transform: 'translateX(40px)',
      transition: 'opacity 0.3s ease, transform 0.3s ease',
    });

    toast.innerHTML = `
      <span style="font-size:18px;font-weight:bold;color:${borderColors[type]}">${icons[type] || icons.info}</span>
      <span style="flex:1">${this._escapeHtml(message)}</span>
      <button style="background:none;border:none;color:#8b949e;cursor:pointer;font-size:16px;padding:0 2px;" aria-label="Tutup">&times;</button>
    `;

    // Close button handler
    const closeBtn = toast.querySelector('button');
    const removeToast = () => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(40px)';
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    };
    closeBtn.addEventListener('click', removeToast);

    container.appendChild(toast);

    // Trigger entrance animation
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(0)';
    });

    // Auto-remove
    const timer = setTimeout(removeToast, duration);

    // Pause auto-remove on hover
    toast.addEventListener('mouseenter', () => clearTimeout(timer));
    toast.addEventListener('mouseleave', () => setTimeout(removeToast, 1500));
  },

  /* =========================================================
   * Confirmation Dialog
   * ========================================================= */

  /**
   * Show a confirmation dialog (replaces native confirm()).
   * @param {string} title
   * @param {string} message
   * @returns {Promise<boolean>}
   */
  confirm(title, message) {
    return new Promise((resolve) => {
      // Remove any existing confirm modal
      const existing = document.getElementById('confirm-modal-overlay');
      if (existing) existing.remove();

      const overlay = document.createElement('div');
      overlay.id = 'confirm-modal-overlay';
      Object.assign(overlay.style, {
        position: 'fixed',
        inset: '0',
        backgroundColor: 'rgba(0,0,0,0.6)',
        zIndex: '10001',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'fadeIn 0.2s ease',
      });

      overlay.innerHTML = `
        <div style="background:#1c2333;border:1px solid #30363d;border-radius:12px;padding:28px;max-width:400px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.5);">
          <h3 style="margin:0 0 12px;font-size:18px;color:#e6edf3;">${this._escapeHtml(title)}</h3>
          <p style="margin:0 0 24px;font-size:14px;color:#8b949e;line-height:1.5;">${this._escapeHtml(message)}</p>
          <div style="display:flex;gap:12px;justify-content:flex-end;">
            <button id="confirm-btn-cancel" style="padding:8px 20px;border-radius:6px;border:1px solid #30363d;background:transparent;color:#8b949e;cursor:pointer;font-size:14px;transition:background 0.2s;">Batal</button>
            <button id="confirm-btn-ok" style="padding:8px 20px;border-radius:6px;border:none;background:#f85149;color:#fff;cursor:pointer;font-size:14px;font-weight:600;transition:background 0.2s;">Ya, Lanjutkan</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      const cleanup = (result) => {
        overlay.style.opacity = '0';
        setTimeout(() => {
          if (overlay.parentNode) overlay.remove();
          resolve(result);
        }, 150);
      };

      overlay.querySelector('#confirm-btn-ok').addEventListener('click', () => cleanup(true));
      overlay.querySelector('#confirm-btn-cancel').addEventListener('click', () => cleanup(false));
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) cleanup(false);
      });

      // Keyboard: Escape cancels, Enter confirms
      const keyHandler = (e) => {
        if (e.key === 'Escape') { cleanup(false); document.removeEventListener('keydown', keyHandler); }
        if (e.key === 'Enter') { cleanup(true); document.removeEventListener('keydown', keyHandler); }
      };
      document.addEventListener('keydown', keyHandler);
    });
  },

  /* =========================================================
   * Modal Helpers
   * ========================================================= */

  /**
   * Show a modal by ID. Sets display to flex and adds .active class.
   * @param {string} modalId
   */
  showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.add('active');
    modal.style.display = 'flex';
    // Trap focus
    const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable.length) focusable[0].focus();
  },

  /**
   * Hide a modal by ID.
   * @param {string} modalId
   */
  hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('active');
    modal.style.display = 'none';
  },

  /* =========================================================
   * Clipboard
   * ========================================================= */

  /**
   * Copy text to clipboard.
   * @param {string} text
   * @returns {Promise<boolean>}
   */
  async copyToClipboard(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      // Fallback for older browsers / non-HTTPS
      const textarea = document.createElement('textarea');
      textarea.value = text;
      Object.assign(textarea.style, { position: 'fixed', left: '-9999px', opacity: '0' });
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch (err) {
      console.error('[Utils.copyToClipboard] Error:', err);
      return false;
    }
  },

  /* =========================================================
   * Color Helpers
   * ========================================================= */

  /**
   * Get a color class or hex based on battery SoC percentage.
   * @param {number} soc - State of charge 0-100
   * @returns {string} Color value
   */
  getBatteryColor(soc) {
    if (soc === null || soc === undefined) return '#8b949e';
    if (soc > 60) return '#3fb950'; // green
    if (soc >= 30) return '#d29922'; // yellow
    return '#f85149'; // red
  },

  /**
   * Get a color based on a generic status string.
   * @param {string} status
   * @returns {string}
   */
  getStatusColor(status) {
    const s = (status || '').toLowerCase();
    if (['on', 'active', 'online', 'connected', 'ok', 'success', 'normal'].includes(s)) return '#3fb950';
    if (['warning', 'pending', 'standby'].includes(s)) return '#d29922';
    if (['off', 'inactive', 'offline', 'disconnected', 'error', 'critical', 'danger', 'fail'].includes(s)) return '#f85149';
    return '#8b949e'; // unknown / neutral
  },

  /* =========================================================
   * Functional Helpers
   * ========================================================= */

  /**
   * Debounce: delay execution until `delay` ms after last invocation.
   * @param {Function} fn
   * @param {number} delay - ms
   * @returns {Function}
   */
  debounce(fn, delay = 300) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  /**
   * Throttle: execute at most once every `limit` ms.
   * @param {Function} fn
   * @param {number} limit - ms
   * @returns {Function}
   */
  throttle(fn, limit = 300) {
    let inThrottle = false;
    let lastArgs = null;

    return function (...args) {
      if (!inThrottle) {
        fn.apply(this, args);
        inThrottle = true;
        setTimeout(() => {
          inThrottle = false;
          // Execute any trailing call that came during throttle
          if (lastArgs) {
            fn.apply(this, lastArgs);
            lastArgs = null;
          }
        }, limit);
      } else {
        lastArgs = args;
      }
    };
  },

  /**
   * Deep clone an object using structuredClone if available, else JSON round-trip.
   * @param {*} obj
   * @returns {*}
   */
  deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    try {
      if (typeof structuredClone === 'function') return structuredClone(obj);
    } catch (e) {
      // structuredClone may fail for some types (e.g. functions)
    }
    return JSON.parse(JSON.stringify(obj));
  },

  /**
   * Generate a unique ID string.
   * @returns {string}
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
  },

  /**
   * Get relay name by 1-based index.
   * @param {number} index - 1-based relay index
   * @returns {string}
   */
  getRelayName(index) {
    if (index < 1 || index > this.RELAY_NAMES.length) return `Relay ${index}`;
    return this.RELAY_NAMES[index - 1];
  },

  /* =========================================================
   * LocalStorage Helpers
   * ========================================================= */
  storage: {
    /**
     * Get value from localStorage.
     * @param {string} key
     * @param {*} defaultValue
     * @returns {*}
     */
    get(key, defaultValue = null) {
      try {
        const raw = localStorage.getItem(key);
        if (raw === null) return defaultValue;
        // Try JSON parse, fall back to raw string
        try {
          return JSON.parse(raw);
        } catch (e) {
          return raw;
        }
      } catch (e) {
        console.warn(`[Storage.get] Error reading "${key}":`, e);
        return defaultValue;
      }
    },

    /**
     * Set value in localStorage. Objects are JSON-stringified.
     * @param {string} key
     * @param {*} value
     */
    set(key, value) {
      try {
        if (value === undefined) {
          localStorage.removeItem(key);
          return;
        }
        const serialized = typeof value === 'string' ? value : JSON.stringify(value);
        localStorage.setItem(key, serialized);
      } catch (e) {
        console.warn(`[Storage.set] Error writing "${key}":`, e);
      }
    },

    /**
     * Remove a key from localStorage.
     * @param {string} key
     */
    remove(key) {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.warn(`[Storage.remove] Error removing "${key}":`, e);
      }
    },
  },

  /* =========================================================
   * Internal Helpers (private)
   * ========================================================= */

  /**
   * Escape HTML special characters to prevent XSS.
   * @param {string} str
   * @returns {string}
   */
  _escapeHtml(str) {
    if (!str) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(str).replace(/[&<>"']/g, (c) => map[c]);
  },
};
