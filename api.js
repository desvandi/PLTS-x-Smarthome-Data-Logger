/**
 * PLTS SmartHome Dashboard - API Communication Module
 * Handles all HTTP communication with the Google Apps Script backend.
 * Depends on: Auth (for token), Utils (for toast on errors)
 *
 * IMPORTANT: Google Apps Script Web Apps require:
 * - Content-Type: 'text/plain;charset=utf-8' (NOT application/json)
 * - Body must be URL-encoded form data
 * - Use redirect: 'follow' to read response
 * - Do NOT use mode: 'no-cors' (it makes response opaque)
 */

const Api = {
  // ==================================================================
  // Configuration
  // ==================================================================

  /** Base URL for Google Apps Script deployment */
  BASE_URL: 'https://script.google.com/macros/s/AKfycbwHB33dD9Uc0GDaE3q5DN-F23iVHvsJQokjZebv3nnx32hjZyGImlfzfxqQBODQzWr9/exec',

  /** Default request timeout in milliseconds */
  TIMEOUT_MS: 15000,

  /** Default number of retries on network failure */
  DEFAULT_RETRIES: 2,

  /* =========================================================
   * Core HTTP POST
   * ========================================================= */

  /**
   * Send a POST request to the Google Apps Script backend.
   *
   * GAS requires a specific format:
   * - Content-Type: text/plain;charset=utf-8
   * - Body: URL-encoded key=value pairs (NOT JSON)
   * - redirect: 'follow' (GAS returns 302 redirects)
   *
   * @param {Object} data - key-value pairs to send
   * @param {number} retries - number of retry attempts on failure
   * @returns {Promise<Object>} parsed JSON response from GAS
   * @throws {Error} if request fails after all retries
   */
  async _post(data, retries = this.DEFAULT_RETRIES) {
    // Auto-inject token if not already in data and user is authenticated
    if (!data.token && typeof Auth !== 'undefined' && Auth.isAuthenticated()) {
      data.token = Auth.getToken();
    }

    // Convert data object to URL-encoded string
    const body = Object.keys(data)
      .map((key) => {
        const val = data[key];
        // Handle nested objects/arrays by JSON-encoding them
        if (val !== null && typeof val === 'object') {
          return `${encodeURIComponent(key)}=${encodeURIComponent(JSON.stringify(val))}`;
        }
        return `${encodeURIComponent(key)}=${encodeURIComponent(val === undefined ? '' : val)}`;
      })
      .join('&');

    // Abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

    let lastError = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(this.BASE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8',
          },
          body: body,
          redirect: 'follow',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Check for HTTP errors
        if (!response.ok) {
          // Google may return HTML error pages
          const text = await response.text().catch(() => '');
          throw new Error(`HTTP ${response.status}: ${text.substring(0, 200)}`);
        }

        // Read response as text first (GAS sometimes wraps in unexpected formats)
        const responseText = await response.text();

        // Parse JSON
        let result;
        try {
          result = JSON.parse(responseText);
        } catch (parseErr) {
          console.error('[Api._post] Non-JSON response:', responseText.substring(0, 300));
          throw new Error('Respons server tidak valid (bukan JSON).');
        }

        // Handle API-level errors
        if (result.error && !result.success) {
          // Authentication error - clear session and redirect
          if (
            result.error.toLowerCase().includes('unauthorized') ||
            result.error.toLowerCase().includes('token expired') ||
            result.error.toLowerCase().includes('invalid token')
          ) {
            console.warn('[Api._post] Authentication error:', result.error);
            if (typeof Auth !== 'undefined') {
              Auth._clearSession();
              // Redirect to login only if we're on dashboard
              if (window.location.pathname.includes('dashboard')) {
                window.location.href = './index.html';
              }
            }
            throw new Error('Sesi telah berakhir. Silakan login kembali.');
          }
        }

        return result;
      } catch (err) {
        clearTimeout(timeoutId);
        lastError = err;

        // Don't retry on auth errors or abort (timeout)
        if (
          err.message.includes('Sesi telah berakhir') ||
          err.message.includes('login kembali') ||
          err.name === 'AbortError'
        ) {
          throw err;
        }

        console.warn(`[Api._post] Attempt ${attempt + 1}/${retries + 1} failed:`, err.message);

        // Wait before retrying (exponential backoff: 1s, 2s, 4s...)
        if (attempt < retries) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // All retries exhausted
    const msg = lastError?.name === 'AbortError'
      ? 'Permintaan timeout. Server tidak merespon dalam waktu 15 detik.'
      : `Gagal terhubung ke server: ${lastError?.message || 'Unknown error'}`;

    console.error('[Api._post] All retries exhausted:', msg);

    // Show user-facing error if Utils is available
    if (typeof Utils !== 'undefined') {
      Utils.showToast(msg, 'error', 6000);
    }

    throw new Error(msg);
  },

  /* =========================================================
   * Sensor Data
   * ========================================================= */

  /**
   * Get latest sensor readings from all devices.
   * @returns {Promise<Object>} sensor data object
   */
  async getSensorData() {
    return this._post({ action: 'getSensorData' });
  },

  /**
   * Get historical sensor data for charting.
   * @param {number} hours - number of hours to look back (default 24)
   * @returns {Promise<Array>} array of historical data points
   */
  async getSensorHistory(hours = 24) {
    return this._post({ action: 'getSensorHistory', hours: hours });
  },

  /* =========================================================
   * Control Commands
   * ========================================================= */

  /**
   * Turn a relay on or off.
   * @param {number} relayId - 1-based relay index (1-13)
   * @param {'on'|'off'} state
   * @returns {Promise<Object>} {success: boolean}
   */
  async setRelay(relayId, state) {
    return this._post({
      action: 'setRelay',
      relay_id: relayId,
      state: state,
    });
  },

  /**
   * Set PWM duty cycle for a fan/light channel.
   * @param {number} channel - channel index (0-based)
   * @param {number} value - duty cycle 0-100
   * @returns {Promise<Object>} {success: boolean}
   */
  async setPWM(channel, value) {
    // Clamp value to 0-100
    const clamped = Math.max(0, Math.min(100, Number(value) || 0));
    return this._post({
      action: 'setPWM',
      channel: channel,
      value: clamped,
    });
  },

  /**
   * Enable or disable PV disconnect (emergency stop).
   * @param {'on'|'off'} state
   * @returns {Promise<Object>} {success: boolean}
   */
  async setPVDisconnect(state) {
    return this._post({
      action: 'setPVDisconnect',
      state: state,
    });
  },

  /* =========================================================
   * Rules Engine
   * ========================================================= */

  /**
   * Get all automation rules.
   * @returns {Promise<Array>} array of rule objects
   */
  async getRules() {
    return this._post({ action: 'getRules' });
  },

  /**
   * Save a rule (create or update).
   * If rule.id exists, it's an update; otherwise it's a new rule.
   * @param {Object} rule - rule object with all fields
   * @returns {Promise<Object>} {success: boolean}
   */
  async saveRule(rule) {
    return this._post({
      action: 'saveRule',
      rule: rule,
    });
  },

  /**
   * Delete an automation rule by ID.
   * @param {string|number} ruleId
   * @returns {Promise<Object>} {success: boolean}
   */
  async deleteRule(ruleId) {
    return this._post({
      action: 'deleteRule',
      rule_id: ruleId,
    });
  },

  /* =========================================================
   * PIR Motion Mapping
   * ========================================================= */

  /**
   * Get all PIR-to-relay mappings.
   * @returns {Promise<Array>} array of PIR mapping objects
   */
  async getPIRMapping() {
    return this._post({ action: 'getPIRMapping' });
  },

  /**
   * Save PIR-to-relay mappings (replaces all existing).
   * @param {Array} mappings - array of mapping objects
   * @returns {Promise<Object>} {success: boolean}
   */
  async savePIRMapping(mappings) {
    return this._post({
      action: 'savePIRMapping',
      mappings: mappings,
    });
  },

  /* =========================================================
   * User Management (Admin Only)
   * ========================================================= */

  /**
   * Get all registered users.
   * @returns {Promise<Array>} array of user objects
   */
  async getUsers() {
    return this._post({ action: 'getUsers' });
  },

  /**
   * Create a new user account.
   * @param {string} username
   * @param {string} password - plain text (will be hashed here)
   * @param {string} role - 'admin', 'technician', or 'user'
   * @returns {Promise<Object>} {success: boolean}
   */
  async createUser(username, password, role) {
    // Hash password before sending
    const passwordHash = await Utils.sha256(password);
    return this._post({
      action: 'createUser',
      username: username,
      password_hash: passwordHash,
      role: role,
    });
  },

  /**
   * Delete a user account.
   * @param {string} username
   * @returns {Promise<Object>} {success: boolean}
   */
  async deleteUser(username) {
    return this._post({
      action: 'deleteUser',
      username: username,
    });
  },

  /**
   * Reset a user's password. Returns the new password.
   * @param {string} username
   * @returns {Promise<Object>} {success: boolean, new_password: string}
   */
  async resetPassword(username) {
    return this._post({
      action: 'resetPassword',
      username: username,
    });
  },

  /* =========================================================
   * Event Log & System Config
   * ========================================================= */

  /**
   * Get recent event log entries.
   * @param {number} limit - max number of entries (default 50)
   * @returns {Promise<Array>} array of event log objects
   */
  async getEventLog(limit = 50) {
    return this._post({
      action: 'getEventLog',
      limit: limit,
    });
  },

  /**
   * Get system configuration key-value pairs.
   * @returns {Promise<Array>} array of {key, value} objects
   */
  async getSystemConfig() {
    return this._post({ action: 'getSystemConfig' });
  },
};
