/**
 * PLTS SmartHome Dashboard - Authentication Module
 * Handles login, logout, session management, and RBAC.
 * Depends on: Utils
 */

const Auth = {
  // Storage keys
  TOKEN_KEY: 'plts_token',
  USER_KEY: 'plts_user',
  EXPIRY_KEY: 'plts_token_expiry',

  /* =========================================================
   * Initialization
   * ========================================================= */

  /**
   * Initialize authentication state.
   * Checks for an existing valid session.
   * Call this on every page load (after DOMContentLoaded).
   */
  init() {
    // If there's a stored token, validate it's not expired
    if (this.isAuthenticated()) {
      console.log('[Auth] Session restored for:', this.getUser()?.username);
    } else {
      // Clear any stale data
      this._clearSession();
      console.log('[Auth] No valid session found.');
    }
  },

  /* =========================================================
   * Login / Logout
   * ========================================================= */

  /**
   * Authenticate user with username and plain-text password.
   * Hashes the password with SHA-256, sends to API, stores the JWT token.
   * @param {string} username
   * @param {string} password - plain text
   * @returns {Promise<{success: boolean, message?: string}>}
   */
  async login(username, password) {
    if (!username || !password) {
      return { success: false, message: 'Username dan password wajib diisi.' };
    }

    try {
      // Hash password before sending
      const passwordHash = await Utils.sha256(password);

      const response = await Api._post({
        action: 'login',
        username: username,
        password_hash: passwordHash,
      });

      if (response.success && response.token) {
        // Store session data
        // Token expiry: JWT tokens contain expiry in their payload; parse it
        // Fallback: default 24 hours from now if not parseable
        let expiryMs = 24 * 60 * 60 * 1000; // 24h default
        try {
          const payload = JSON.parse(atob(response.token.split('.')[1]));
          if (payload.exp) {
            expiryMs = (payload.exp * 1000) - Date.now();
          }
        } catch (e) {
          // Token not a valid JWT; use default expiry
          console.warn('[Auth] Could not parse JWT expiry, using 24h default.');
        }

        const user = {
          username: response.username || username,
          role: response.role || 'user',
        };

        this._storeSession(response.token, user, Date.now() + expiryMs);
        console.log('[Auth] Login successful:', user.username, 'role:', user.role);
        return { success: true };
      }

      return {
        success: false,
        message: response.message || response.error || 'Login gagal. Periksa username dan password.',
      };
    } catch (err) {
      console.error('[Auth.login] Error:', err);
      return {
        success: false,
        message: 'Gagal terhubung ke server. Periksa koneksi internet.',
      };
    }
  },

  /**
   * Log out the current user.
   * Notifies the API (best-effort), clears local session, redirects to index.html.
   */
  async logout() {
    const token = this.getToken();

    // Notify backend (fire-and-forget)
    if (token) {
      try {
        await Api._post({
          action: 'logout',
          token: token,
        });
      } catch (e) {
        // Ignore network errors on logout
        console.warn('[Auth.logout] Could not notify server:', e.message);
      }
    }

    // Destroy the App instance if it exists
    if (window.App && typeof window.App.destroy === 'function') {
      window.App.destroy();
    }

    this._clearSession();
    console.log('[Auth] Logged out.');

    // Redirect to login page
    try {
      window.location.href = './index.html';
    } catch (e) {
      window.location.href = './';
    }
  },

  /* =========================================================
   * Session Queries
   * ========================================================= */

  /**
   * Check if the user has a valid (non-expired) session.
   * @returns {boolean}
   */
  isAuthenticated() {
    const token = Utils.storage.get(this.TOKEN_KEY);
    const expiry = Utils.storage.get(this.EXPIRY_KEY);

    if (!token || !expiry) return false;

    // Check token is a non-empty string
    if (typeof token !== 'string' || token.trim().length === 0) return false;

    // Check expiry
    if (Date.now() > Number(expiry)) {
      console.log('[Auth] Token expired.');
      this._clearSession();
      return false;
    }

    return true;
  },

  /**
   * Get the current JWT token string.
   * @returns {string|null}
   */
  getToken() {
    if (!this.isAuthenticated()) return null;
    return Utils.storage.get(this.TOKEN_KEY);
  },

  /**
   * Get the current user info object {username, role}.
   * @returns {{username: string, role: string}|null}
   */
  getUser() {
    if (!this.isAuthenticated()) return null;
    return Utils.storage.get(this.USER_KEY);
  },

  /**
   * Get the current user's role.
   * @returns {'admin'|'technician'|'user'|string}
   */
  getRole() {
    const user = this.getUser();
    return user ? user.role : 'user';
  },

  /**
   * Check if the current user has one of the required roles.
   * @param {string|Array<string>} roles - single role or array of roles
   * @returns {boolean}
   */
  hasRole(roles) {
    const currentRole = this.getRole();
    if (Array.isArray(roles)) {
      return roles.includes(currentRole);
    }
    return currentRole === roles;
  },

  /* =========================================================
   * Password Management
   * ========================================================= */

  /**
   * Change the current user's password.
   * @param {string} oldPassword - current password (plain text)
   * @param {string} newPassword - new password (plain text)
   * @returns {Promise<{success: boolean, message?: string}>}
   */
  async changePassword(oldPassword, newPassword) {
    if (!oldPassword || !newPassword) {
      return { success: false, message: 'Password lama dan baru wajib diisi.' };
    }

    if (newPassword.length < 6) {
      return { success: false, message: 'Password baru minimal 6 karakter.' };
    }

    if (oldPassword === newPassword) {
      return { success: false, message: 'Password baru tidak boleh sama dengan password lama.' };
    }

    try {
      const oldHash = await Utils.sha256(oldPassword);
      const newHash = await Utils.sha256(newPassword);

      const response = await Api._post({
        action: 'changePassword',
        token: this.getToken(),
        old_password_hash: oldHash,
        new_password_hash: newHash,
      });

      if (response.success) {
        return { success: true, message: 'Password berhasil diubah.' };
      }

      return {
        success: false,
        message: response.message || response.error || 'Gagal mengubah password.',
      };
    } catch (err) {
      console.error('[Auth.changePassword] Error:', err);
      return {
        success: false,
        message: 'Gagal terhubung ke server.',
      };
    }
  },

  /* =========================================================
   * Internal: Session Storage
   * ========================================================= */

  /**
   * Store authentication session data in localStorage.
   * @param {string} token - JWT token
   * @param {{username: string, role: string}} user
   * @param {number} expiry - expiry timestamp (ms)
   */
  _storeSession(token, user, expiry) {
    Utils.storage.set(this.TOKEN_KEY, token);
    Utils.storage.set(this.USER_KEY, user);
    Utils.storage.set(this.EXPIRY_KEY, expiry);
  },

  /**
   * Clear all stored session data.
   */
  _clearSession() {
    Utils.storage.remove(this.TOKEN_KEY);
    Utils.storage.remove(this.USER_KEY);
    Utils.storage.remove(this.EXPIRY_KEY);
  },
};
