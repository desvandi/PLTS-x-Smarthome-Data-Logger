/**
 * PLTS SmartHome Dashboard - Main Application Controller
 * The central "glue" module that ties all other modules together.
 * Manages navigation, real-time data refresh, UI updates, and lifecycle.
 *
 * Depends on: Utils, Auth, Api, PWA
 *
 * Page modules (dashboard, controls, rules-editor, admin) register their
 * init() and update() methods on App.pageModules after this loads.
 */

const App = {
  /* =========================================================
   * State
   * ========================================================= */
  state: {
    currentPage: 'overview',       // currently visible page/section
    sidebarOpen: true,             // sidebar expanded state
    sensorData: null,              // latest sensor data object
    sensorHistory: [],             // historical data array for charts
    rules: [],                     // automation rules
    pirMappings: [],               // PIR-to-relay mappings
    users: [],                     // registered users (admin)
    eventLog: [],                  // event log entries
    systemConfig: [],              // key-value config pairs
    isConnected: true,             // network connectivity status
    isLoading: false,              // global loading overlay state
    refreshInterval: null,         // interval ID for sensor data polling
    commandInterval: null,         // interval ID for command queue
    charts: {},                    // Chart.js instance references {chartId: Chart}
  },

  // Registered page modules {pageName: {init(), update(data)}}
  pageModules: {},

  /* =========================================================
   * Initialization
   * ========================================================= */

  /**
   * Bootstrap the entire dashboard application.
   * Called once on DOMContentLoaded.
   */
  async init() {
    console.log('[App] Initializing PLTS SmartHome Dashboard...');

    // 1. Authentication guard
    if (!Auth.isAuthenticated()) {
      console.warn('[App] Not authenticated, redirecting to login.');
      window.location.href = './index.html';
      return;
    }

    // 2. Load theme
    this.loadTheme();

    // 3. Initialize PWA (service worker, install prompt)
    try {
      await PWA.init();
    } catch (err) {
      console.warn('[App] PWA init error (non-fatal):', err);
    }

    // 4. Request notification permission (non-intrusive)
    try {
      const perm = await PWA.requestNotificationPermission();
      if (perm === 'granted') {
        PWA.startNotificationPolling(30000);
      }
    } catch (err) {
      console.warn('[App] Notification permission error (non-fatal):', err);
    }

    // 5. Bind all event listeners
    this._bindEvents();

    // 6. Update connection status indicator
    this._handleOnlineStatus();

    // 7. Show current user info in the header
    this._updateUserDisplay();

    // 8. Apply role-based visibility
    this.updateRoleVisibility();

    // 9. Start clock
    this.updateClock();
    setInterval(() => this.updateClock(), 1000);

    // 10. Navigate to overview page (default)
    this.navigateTo('overview');

    // 11. Fetch initial data
    try {
      await Promise.all([
        this.refreshSensorData(),
        this.refreshSensorHistory(24),
        this._loadEventData(),
      ]);
    } catch (err) {
      console.error('[App] Initial data load error:', err);
    }

    // 12. Start real-time polling (every 5 seconds)
    this.startRealtimeUpdates();

    console.log('[App] Dashboard ready. User:', Auth.getUser()?.username, 'Role:', Auth.getRole());
  },

  /* =========================================================
   * Page Navigation
   * ========================================================= */

  /**
   * Navigate to a specific page/section.
   * Hides all page sections, shows the target, updates sidebar active state.
   * Calls page module init() on first visit and update() on subsequent visits.
   *
   * @param {string} page - page identifier (e.g. 'overview', 'monitoring', 'controls', 'automation', 'admin', 'settings')
   */
  navigateTo(page) {
    // HTML uses class "page" for page sections
    const pages = document.querySelectorAll('.page');
    pages.forEach((p) => {
      p.classList.remove('active');
    });

    // Show target page - HTML uses id="page-{page}"
    const target = document.getElementById(`page-${page}`);
    if (target) {
      // Trigger reflow for animation
      void target.offsetHeight;
      target.classList.add('active');
    } else {
      console.warn(`[App] Page section #page-${page} not found.`);
    }

    // Update sidebar active link
    const navLinks = document.querySelectorAll('.sidebar-nav a[data-page]');
    navLinks.forEach((link) => {
      const isActive = link.getAttribute('data-page') === page;
      link.classList.toggle('active', isActive);
      if (isActive) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });

    const prevPage = this.state.currentPage;
    this.state.currentPage = page;

    // Call page module hooks
    const mod = this.pageModules[page];
    if (mod) {
      if (mod.init && !mod._initialized) {
        mod.init();
        mod._initialized = true;
      }
      if (mod.update) {
        mod.update(this.state.sensorData);
      }
    }

    // On mobile, close sidebar after navigation
    if (window.innerWidth < 768) {
      this.closeSidebar();
    }

    console.log(`[App] Navigated: ${prevPage} → ${page}`);
  },

  /* =========================================================
   * Sidebar
   * ========================================================= */

  /**
   * Toggle sidebar open/close state.
   */
  toggleSidebar() {
    this.state.sidebarOpen = !this.state.sidebarOpen;

    // HTML: id="sidebar"
    const sidebar = document.getElementById('sidebar');
    // HTML: class="main-wrapper" (no id="main-content")
    const mainContent = document.getElementById('main-wrapper');
    // HTML: id="sidebar-toggle"
    const toggleBtn = document.getElementById('sidebar-toggle');

    if (sidebar) {
      sidebar.classList.toggle('collapsed', !this.state.sidebarOpen);
    }
    if (mainContent) {
      mainContent.classList.toggle('sidebar-collapsed', !this.state.sidebarOpen);
    }
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-expanded', String(this.state.sidebarOpen));
    }

    // Persist preference
    if (typeof Utils !== 'undefined' && Utils.storage) {
      Utils.storage.set('sidebar_open', this.state.sidebarOpen);
    }
  },

  /**
   * Force close sidebar (used on mobile after navigation).
   */
  closeSidebar() {
    if (this.state.sidebarOpen) {
      this.toggleSidebar();
    }
  },

  /* =========================================================
   * Data Refresh
   * ========================================================= */

  /**
   * Fetch the latest sensor data and update the UI.
   * @returns {Promise<Object|null>}
   */
  async refreshSensorData() {
    try {
      const data = await Api.getSensorData();

      if (data && (data.success !== false)) {
        // Store the actual data (may be nested under .data in some responses)
        this.state.sensorData = data.data || data;

        // Update connection status
        if (!this.state.isConnected) {
          this.state.isConnected = true;
          this.updateConnectionStatus(true);
        }

        // Update the current page module
        const mod = this.pageModules[this.state.currentPage];
        if (mod && mod.update) {
          mod.update(this.state.sensorData);
        }

        // Update overview cards if on overview page
        if (this.state.currentPage === 'overview') {
          this.updateOverviewCards(this.state.sensorData);
        }

        return this.state.sensorData;
      }

      console.warn('[App] refreshSensorData: API returned unsuccessful response.', data);
      return null;
    } catch (err) {
      console.error('[App] refreshSensorData error:', err.message);
      return null;
    }
  },

  /**
   * Fetch historical sensor data for charts.
   * @param {number} hours - hours to look back
   * @returns {Promise<Array>}
   */
  async refreshSensorHistory(hours = 24) {
    try {
      const data = await Api.getSensorHistory(hours);

      if (data && Array.isArray(data)) {
        this.state.sensorHistory = data;

        // Update charts if the chart page module has a handler
        const mod = this.pageModules[this.state.currentPage];
        if (mod && mod.onHistoryUpdate) {
          mod.onHistoryUpdate(data);
        }

        return data;
      } else if (data && data.data && Array.isArray(data.data)) {
        this.state.sensorHistory = data.data;
        const mod = this.pageModules[this.state.currentPage];
        if (mod && mod.onHistoryUpdate) {
          mod.onHistoryUpdate(data.data);
        }
        return data.data;
      }

      return [];
    } catch (err) {
      console.error('[App] refreshSensorHistory error:', err.message);
      return [];
    }
  },

  /**
   * Load event log, rules, and other supplementary data.
   * @private
   */
  async _loadEventData() {
    try {
      const [eventLog, rules, config] = await Promise.allSettled([
        Api.getEventLog(50),
        Auth.hasRole(['admin', 'technician']) ? Api.getRules() : Promise.resolve([]),
        Auth.hasRole('admin') ? Api.getSystemConfig() : Promise.resolve([]),
      ]);

      if (eventLog.status === 'fulfilled' && Array.isArray(eventLog.value)) {
        this.state.eventLog = eventLog.value;
      }
      if (rules.status === 'fulfilled' && Array.isArray(rules.value)) {
        this.state.rules = rules.value;
      }
      if (config.status === 'fulfilled' && Array.isArray(config.value)) {
        this.state.systemConfig = config.value;
      }

      // Load PIR mappings if user has control access
      if (Auth.hasRole(['admin', 'technician'])) {
        try {
          const pirResult = await Api.getPIRMapping();
          if (Array.isArray(pirResult)) {
            this.state.pirMappings = pirResult;
          } else if (pirResult && Array.isArray(pirResult.data)) {
            this.state.pirMappings = pirResult.data;
          }
        } catch (e) {
          console.warn('[App] Failed to load PIR mappings:', e.message);
        }
      }

      // Load users list if admin
      if (Auth.hasRole('admin')) {
        try {
          const usersResult = await Api.getUsers();
          if (Array.isArray(usersResult)) {
            this.state.users = usersResult;
          } else if (usersResult && Array.isArray(usersResult.data)) {
            this.state.users = usersResult.data;
          }
        } catch (e) {
          console.warn('[App] Failed to load users:', e.message);
        }
      }
    } catch (err) {
      console.error('[App] _loadEventData error:', err.message);
    }
  },

  /* =========================================================
   * Real-time Updates (Polling)
   * ========================================================= */

  /**
   * Start polling sensor data every 5 seconds.
   */
  startRealtimeUpdates() {
    this.stopRealtimeUpdates(); // Clear existing interval

    this.state.refreshInterval = setInterval(async () => {
      await this.refreshSensorData();
    }, 5000);

    // Refresh history every 60 seconds
    this.state.commandInterval = setInterval(async () => {
      await this.refreshSensorHistory(24);
    }, 60000);

    console.log('[App] Real-time updates started (sensor: 5s, history: 60s).');
  },

  /**
   * Stop all polling intervals.
   */
  stopRealtimeUpdates() {
    if (this.state.refreshInterval) {
      clearInterval(this.state.refreshInterval);
      this.state.refreshInterval = null;
    }
    if (this.state.commandInterval) {
      clearInterval(this.state.commandInterval);
      this.state.commandInterval = null;
    }
    console.log('[App] Real-time updates stopped.');
  },

  /* =========================================================
   * Event Binding
   * ========================================================= */

  /**
   * Bind all UI event listeners using event delegation where possible.
   * @private
   */
  _bindEvents() {
    // --- Sidebar Navigation (event delegation on nav) ---
    // HTML: <nav class="sidebar-nav"> (no id, use class)
    const sidebarNav = document.querySelector('.sidebar-nav');
    if (sidebarNav) {
      sidebarNav.addEventListener('click', (e) => {
        const link = e.target.closest('a[data-page]');
        if (link) {
          e.preventDefault();
          const page = link.getAttribute('data-page');
          if (page) this.navigateTo(page);
        }
      });
    }

    // --- Sidebar Toggle (desktop) ---
    // HTML: id="sidebar-toggle"
    const toggleBtn = document.getElementById('sidebar-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggleSidebar());
    }

    // --- Hamburger (mobile) ---
    // HTML: id="hamburger-btn"
    const hamburgerBtn = document.getElementById('hamburger-btn');
    if (hamburgerBtn) {
      hamburgerBtn.addEventListener('click', () => this.toggleSidebar());
    }

    // --- Mobile Sidebar Overlay ---
    // HTML: id="sidebar-overlay"
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    if (sidebarOverlay) {
      sidebarOverlay.addEventListener('click', () => this.closeSidebar());
    }

    // --- Logout Button ---
    // HTML: id="nav-logout"
    const logoutBtn = document.getElementById('nav-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this._handleLogout();
      });
    }

    // --- Online/Offline Status ---
    window.addEventListener('online', () => this._handleOnlineStatus());
    window.addEventListener('offline', () => this._handleOnlineStatus());

    // --- Window Resize ---
    window.addEventListener('resize', Utils.throttle(() => this._handleResize(), 200));

    // --- Keyboard Shortcuts ---
    document.addEventListener('keydown', (e) => this._handleKeyboard(e));

    // --- Visibility Change (pause/resume polling when tab is hidden) ---
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.stopRealtimeUpdates();
        console.log('[App] Tab hidden, polling paused.');
      } else {
        this.startRealtimeUpdates();
        console.log('[App] Tab visible, polling resumed.');
      }
    });

    // --- Sidebar state from localStorage ---
    if (typeof Utils !== 'undefined' && Utils.storage) {
      const savedSidebar = Utils.storage.get('sidebar_open', true);
      if (savedSidebar === false && this.state.sidebarOpen) {
        this.toggleSidebar();
      }
    }
  },

  /**
   * Handle keyboard shortcuts.
   * @param {KeyboardEvent} e
   * @private
   */
  _handleKeyboard(e) {
    // Ctrl+Shift+R: Force refresh
    if (e.ctrlKey && e.shiftKey && e.key === 'R') {
      e.preventDefault();
      this.refreshSensorData();
      this.refreshSensorHistory(24);
    }

    // Ctrl+B: Toggle sidebar
    if (e.ctrlKey && e.key === 'b') {
      e.preventDefault();
      this.toggleSidebar();
    }

    // Escape: Close any open modal
    if (e.key === 'Escape') {
      const activeModal = document.querySelector('.modal-overlay.modal-open');
      if (activeModal) {
        activeModal.classList.remove('modal-open');
        activeModal.style.display = 'none';
      }
    }
  },

  /* =========================================================
   * Network Status
   * ========================================================= */

  /**
   * Handle online/offline status changes.
   * @private
   */
  _handleOnlineStatus() {
    const online = navigator.onLine;
    this.state.isConnected = online;
    this.updateConnectionStatus(online);

    if (online) {
      // Resume polling and refresh data immediately
      this.startRealtimeUpdates();
      this.refreshSensorData();
      Utils.showToast('Koneksi internet tersambung kembali.', 'success', 3000);
    } else {
      this.stopRealtimeUpdates();
      Utils.showToast('Koneksi internet terputus. Data ditampilkan mungkin tidak mutakhir.', 'warning', 0);
    }
  },

  /**
   * Update the connection status indicator in the UI.
   * @param {boolean} online
   */
  updateConnectionStatus(online) {
    // HTML: id="status-dot", id="status-text"
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');

    if (dot) {
      dot.className = 'status-dot ' + (online ? 'status-on' : 'status-off');
      dot.title = online ? 'Terhubung' : 'Terputus';
    }
    if (text) {
      text.textContent = online ? 'Terhubung' : 'Terputus';
    }
  },

  /* =========================================================
   * Window Resize Handler
   * ========================================================= */

  /**
   * Handle window resize events.
   * @private
   */
  _handleResize() {
    // On small screens, auto-collapse sidebar
    if (window.innerWidth < 768 && this.state.sidebarOpen) {
      // Don't toggle, just set state (toggle causes animation)
      this.state.sidebarOpen = false;
      const sidebar = document.getElementById('sidebar');
      const mainContent = document.getElementById('main-wrapper');
      if (sidebar) sidebar.classList.add('collapsed');
      if (mainContent) mainContent.classList.add('sidebar-collapsed');
    }
  },

  /* =========================================================
   * UI Updates
   * ========================================================= */

  /**
   * Update the clock display.
   */
  updateClock() {
    // HTML: id="header-clock"
    const clockEl = document.getElementById('header-clock');
    if (clockEl) {
      const now = new Date();
      const h = now.getHours().toString().padStart(2, '0');
      const m = now.getMinutes().toString().padStart(2, '0');
      const s = now.getSeconds().toString().padStart(2, '0');
      clockEl.textContent = `${h}:${m}:${s}`;
    }
  },

  /**
   * Show the global loading overlay (inline toast approach).
   */
  showLoading() {
    this.state.isLoading = true;
    // No dedicated loading overlay exists in HTML; use toast for feedback
  },

  /**
   * Hide the global loading overlay.
   */
  hideLoading() {
    this.state.isLoading = false;
  },

  /**
   * Update user display info in the header (name, role badge).
   * @private
   */
  _updateUserDisplay() {
    const user = Auth.getUser();
    if (!user) return;

    // HTML: id="user-avatar"
    const avatarEl = document.getElementById('user-avatar');
    if (avatarEl) {
      avatarEl.textContent = (user.username || 'U').charAt(0).toUpperCase();
    }

    // HTML: id="user-name"
    const usernameEl = document.getElementById('user-name');
    if (usernameEl) {
      usernameEl.textContent = user.username || 'Admin';
    }

    // HTML: id="user-role-badge"
    const roleEl = document.getElementById('user-role-badge');
    if (roleEl) {
      const roleLabels = { admin: 'Admin', technician: 'Teknisi', user: 'Pengguna' };
      roleEl.textContent = roleLabels[user.role] || user.role;
      roleEl.className = 'role-badge ' + (user.role || 'admin');
    }
  },

  /* =========================================================
   * Dashboard Overview Cards
   * ========================================================= */

  /**
   * Update the overview page's summary cards with latest sensor data.
   * @param {Object} data - sensor data object from API
   */
  updateOverviewCards(data) {
    if (!data) return;

    // Battery SoC
    const socEl = document.getElementById('metric-soc');
    if (socEl && data.soc_pct != null) {
      socEl.textContent = data.soc_pct.toFixed(1);
    }

    // Battery voltage sub
    const vPackEl = document.getElementById('metric-v-pack');
    if (vPackEl && data.v_pack != null) {
      vPackEl.textContent = data.v_pack.toFixed(2) + ' V';
    }

    // Solar Power
    const solarEl = document.getElementById('metric-solar');
    if (solarEl && data.p_mppt != null) {
      solarEl.textContent = data.p_mppt.toFixed(0);
    }

    // MPPT detail sub
    const mpptEl = document.getElementById('metric-mppt-detail');
    if (mpptEl && data.v_mppt != null && data.i_mppt != null) {
      mpptEl.textContent = data.v_mppt.toFixed(1) + ' V / ' + data.i_mppt.toFixed(1) + ' A';
    }

    // Load Power
    const loadEl = document.getElementById('metric-load');
    if (loadEl && data.p_ac != null) {
      loadEl.textContent = data.p_ac.toFixed(0);
    }

    // AC detail sub
    const acEl = document.getElementById('metric-ac-detail');
    if (acEl && data.i_ac != null) {
      acEl.textContent = '-- V / ' + data.i_ac.toFixed(1) + ' A';
    }

    // Temperature
    const tempEl = document.getElementById('metric-temp');
    if (tempEl && data.temp != null) {
      tempEl.textContent = data.temp.toFixed(1);
    }

    // Humidity sub
    const humiEl = document.getElementById('metric-humi');
    if (humiEl && data.humi != null) {
      humiEl.textContent = 'Kelembaban: ' + data.humi.toFixed(1) + '%';
    }
  },

  /* =========================================================
   * Role-Based Visibility
   * ========================================================= */

  /**
   * Show or hide UI elements based on the current user's role.
   * Elements with data-role="admin" etc. will be shown/hidden.
   */
  updateRoleVisibility() {
    const role = Auth.getRole();

    // Elements that require a specific role
    // HTML nav items use data-role="admin,tech" (comma-separated)
    const roleElements = document.querySelectorAll('[data-role]');
    roleElements.forEach((el) => {
      const requiredRoles = el.getAttribute('data-role').split(',').map((r) => r.trim());
      let visible = false;

      switch (role) {
        case 'admin':
          visible = true; // Admin sees everything
          break;
        case 'technician':
          visible = requiredRoles.includes('tech') || requiredRoles.includes('technician');
          break;
        case 'user':
          visible = requiredRoles.includes('user');
          break;
      }

      el.style.display = visible ? '' : 'none';
      el.classList.toggle('hidden-by-role', !visible);
    });

    // Sidebar nav items - check data-page for restricted pages
    const navItems = document.querySelectorAll('.sidebar-nav a[data-page]');
    navItems.forEach((item) => {
      const page = item.getAttribute('data-page');
      // Check if the nav item has a data-role attribute
      const requiredRoles = item.getAttribute('data-role');
      if (!requiredRoles) return; // Public items (like dashboard, monitoring, settings) are always visible

      const roles = requiredRoles.split(',').map((r) => r.trim());
      let visible = false;

      switch (role) {
        case 'admin':
          visible = true;
          break;
        case 'technician':
          visible = roles.includes('tech') || roles.includes('technician');
          break;
        case 'user':
          visible = false;
          break;
      }

      item.style.display = visible ? '' : 'none';
      item.classList.toggle('hidden-by-role', !visible);
    });

    console.log('[App] Role visibility updated for:', role);
  },

  /* =========================================================
   * Theme Management
   * ========================================================= */

  /**
   * Toggle between dark and light themes.
   */
  toggleTheme() {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') !== 'light';
    const newTheme = isDark ? 'light' : 'dark';

    html.setAttribute('data-theme', newTheme);
    if (typeof Utils !== 'undefined' && Utils.storage) {
      Utils.storage.set('theme', newTheme);
    }

    // Update theme label in settings page if present
    const label = document.getElementById('theme-label');
    if (label) {
      label.textContent = newTheme === 'dark' ? 'Tema Gelap' : 'Tema Terang';
    }

    // Update theme toggle checkbox if present
    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
      toggle.checked = !isDark;
    }

    console.log('[App] Theme changed to:', newTheme);
  },

  /**
   * Load saved theme from localStorage.
   */
  loadTheme() {
    let saved = 'dark';
    if (typeof Utils !== 'undefined' && Utils.storage) {
      saved = Utils.storage.get('theme', 'dark');
    }
    document.documentElement.setAttribute('data-theme', saved);
  },

  /* =========================================================
   * Logout Handler
   * ========================================================= */

  /**
   * Handle logout with confirmation.
   * @private
   */
  async _handleLogout() {
    const confirmed = await Utils.confirm(
      'Konfirmasi Keluar',
      'Apakah Anda yakin ingin keluar dari dashboard?'
    );
    if (confirmed) {
      await Auth.logout();
    }
  },

  /* =========================================================
   * Register Page Module
   * ========================================================= */

  /**
   * Register a page module with init and update hooks.
   *
   * @param {string} name - page identifier (matches data-page)
   * @param {Object} module - {init(), update(data), onHistoryUpdate(data), destroy()}
   */
  registerPageModule(name, module) {
    this.pageModules[name] = module;
    console.log(`[App] Page module registered: ${name}`);
  },

  /* =========================================================
   * Lifecycle / Cleanup
   * ========================================================= */

  /**
   * Destroy the application instance.
   */
  destroy() {
    // Stop polling
    this.stopRealtimeUpdates();

    // Destroy PWA
    if (typeof PWA !== 'undefined' && PWA.destroy) {
      PWA.destroy();
    }

    // Destroy all Chart.js instances
    Object.keys(this.state.charts).forEach((key) => {
      try {
        if (this.state.charts[key] && typeof this.state.charts[key].destroy === 'function') {
          this.state.charts[key].destroy();
        }
      } catch (e) {
        console.warn(`[App] Error destroying chart "${key}":`, e);
      }
    });
    this.state.charts = {};

    // Destroy page modules
    Object.keys(this.pageModules).forEach((name) => {
      try {
        if (this.pageModules[name] && typeof this.pageModules[name].destroy === 'function') {
          this.pageModules[name].destroy();
        }
      } catch (e) {
        console.warn(`[App] Error destroying page module "${name}":`, e);
      }
    });

    // Clear state
    this.state.sensorData = null;
    this.state.sensorHistory = [];
    this.state.rules = [];
    this.state.eventLog = [];

    console.log('[App] Destroyed. All resources cleaned up.');
  },
};

/* =========================================================
 * Bootstrap on DOMContentLoaded
 * ========================================================= */

window.addEventListener('DOMContentLoaded', () => {
  // Make App globally accessible (it already is via const, but be explicit)
  window.App = App;

  // Initialize the dashboard
  App.init().catch((err) => {
    console.error('[App] Fatal initialization error:', err);
    // Show error to user
    const container = document.body;
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'display:flex;align-items:center;justify-content:center;min-height:100vh;color:#f85149;font-size:18px;text-align:center;padding:40px;';
    errorDiv.innerHTML = `
      <div>
        <h2 style="margin-bottom:12px;">Gagal Memuat Dashboard</h2>
        <p style="color:#8b949e;margin-bottom:20px;">${err.message || 'Terjadi kesalahan saat inisialisasi.'}</p>
        <a href="./index.html" style="color:#58a6ff;text-decoration:underline;">Kembali ke Halaman Login</a>
      </div>
    `;
    container.appendChild(errorDiv);
  });
});
