/**
 * Admin Module - PLTS SmartHome
 * Admin panel for user management, system configuration, data export, and settings.
 *
 * Dependencies: Utils, Api, Auth (global)
 */
const Admin = (() => {
  'use strict';

  // ─── State ──────────────────────────────────────────────────────────
  let _currentTab = 'users';

  // ─── Constants ──────────────────────────────────────────────────────
  const ROLE_LABELS = {
    admin: { label: 'Admin', badge: 'badge-red' },
    technician: { label: 'Teknisi', badge: 'badge-blue' },
    tech: { label: 'Teknisi', badge: 'badge-blue' },
    user: { label: 'Pengguna', badge: 'badge-green' },
  };

  // ═══════════════════════════════════════════════════════════════════════
  //  PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════

  const Admin = {

    // ─── Tabs ──────────────────────────────────────────────────────────
    switchTab(tabName) {
      _currentTab = tabName;

      // HTML has .tab-btn with data-tab attributes (no #admin-tabs wrapper)
      document.querySelectorAll('.tabs .tab-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
      });

      // HTML has .tab-content with id like "tab-admin-users", "tab-admin-system"
      document.querySelectorAll('.tab-content').forEach((panel) => {
        panel.classList.toggle('active', panel.id === 'tab-' + tabName);
      });

      // Load data for the tab
      if (tabName === 'users') {
        Admin.loadUsers();
      } else if (tabName === 'system') {
        Admin.loadSystemConfig();
      }
    },

    // ─── User Management ───────────────────────────────────────────────
    async loadUsers() {
      // HTML has id="users-tbody"
      const tbody = document.getElementById('users-tbody');
      if (!tbody) return;

      try {
        if (typeof App !== 'undefined') App.showLoading('Memuat daftar pengguna...');
        const users = await Api.getUsers() || [];
        Admin.renderUsersTable(users);
        if (typeof App !== 'undefined') App.hideLoading();
      } catch (err) {
        console.error('Gagal memuat pengguna:', err);
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Gagal memuat data pengguna</td></tr>';
        Utils.showToast('Gagal memuat daftar pengguna', 'error');
        if (typeof App !== 'undefined') App.hideLoading();
      }
    },

    renderUsersTable(users) {
      const tbody = document.getElementById('users-tbody');
      if (!tbody) return;

      if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Tidak ada pengguna</td></tr>';
        return;
      }

      const currentUser = typeof Auth !== 'undefined' ? Auth.getUser() : null;

      let html = '';
      users.forEach((u) => {
        const isSelf = u.username === currentUser;
        const roleInfo = ROLE_LABELS[u.role] || ROLE_LABELS.user;
        const activeClass = u.active !== false ? 'badge-green' : 'badge-muted';
        const activeLabel = u.active !== false ? 'Aktif' : 'Nonaktif';
        const lastLogin = u.last_login
          ? new Date(u.last_login).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
          : 'Belum pernah';

        html += `
          <tr class="user-row ${isSelf ? 'user-self' : ''}">
            <td>
              <div class="user-info">
                <span class="user-avatar">${_getInitial(u.username)}</span>
                <span class="user-name">${_esc(u.username)}${isSelf ? ' <span class="self-badge">(Anda)</span>' : ''}</span>
              </div>
            </td>
            <td>
              <select class="form-select form-sm user-role-select" data-username="${_escAttr(u.username)}"
                ${isSelf ? 'disabled' : ''}>
                <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                <option value="technician" ${u.role === 'technician' ? 'selected' : ''}>Teknisi</option>
                <option value="user" ${u.role === 'user' ? 'selected' : ''}>Pengguna</option>
              </select>
            </td>
            <td><span class="badge ${activeClass}">${activeLabel}</span></td>
            <td><span class="text-muted text-sm">${lastLogin}</span></td>
            <td>
              <div class="user-actions">
                <button class="btn btn-sm btn-outline btn-reset-pass" data-username="${_escAttr(u.username)}"
                  title="Reset Password">🔑</button>
                ${!isSelf ? `<button class="btn btn-sm btn-danger btn-delete-user" data-username="${_escAttr(u.username)}"
                  title="Hapus Pengguna">🗑️</button>` : ''}
              </div>
            </td>
          </tr>`;
      });

      tbody.innerHTML = html;

      // Bind events
      tbody.querySelectorAll('.user-role-select').forEach((sel) => {
        sel.addEventListener('change', (e) => {
          Admin.changeUserRole(e.target.dataset.username, e.target.value);
        });
      });

      tbody.querySelectorAll('.btn-reset-pass').forEach((btn) => {
        btn.addEventListener('click', () => {
          Admin.resetPassword(btn.dataset.username);
        });
      });

      tbody.querySelectorAll('.btn-delete-user').forEach((btn) => {
        btn.addEventListener('click', () => {
          Admin.deleteUser(btn.dataset.username);
        });
      });
    },

    // ─── Create User Modal ─────────────────────────────────────────────
    openCreateUserModal() {
      // HTML has id="create-user-modal"
      const modal = document.getElementById('create-user-modal');
      if (!modal) return;

      // Reset form fields
      _setFieldValue('new-user-username', '');
      _setFieldValue('new-user-password', '');
      const roleSelect = document.getElementById('new-user-role');
      if (roleSelect) roleSelect.value = 'user';

      modal.classList.add('modal-open');
      modal.style.display = 'flex';

      // Bind close - HTML has id="create-user-close"
      const closeBtn = document.getElementById('create-user-close');
      if (closeBtn) {
        const newBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newBtn, closeBtn);
        newBtn.addEventListener('click', () => Admin._closeCreateUserModal());
      }

      // Bind cancel - HTML has id="create-user-cancel"
      const cancelBtn = document.getElementById('create-user-cancel');
      if (cancelBtn) {
        const newBtn = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newBtn, cancelBtn);
        newBtn.addEventListener('click', () => Admin._closeCreateUserModal());
      }

      // Bind create - HTML has id="create-user-save"
      const createBtn = document.getElementById('create-user-save');
      if (createBtn) {
        const newBtn = createBtn.cloneNode(true);
        createBtn.parentNode.replaceChild(newBtn, createBtn);
        newBtn.addEventListener('click', () => {
          // HTML: id="new-user-username", id="new-user-password"
          const username = _getFieldValue('new-user-username');
          const password = _getFieldValue('new-user-password');
          const role = _getFieldValue('new-user-role');
          // HTML doesn't have confirm password field - use password directly
          Admin.createUser(username, password, password, role);
        });
      }

      // Click outside
      modal.addEventListener('click', (e) => {
        if (e.target === modal) Admin._closeCreateUserModal();
      });
    },

    _closeCreateUserModal() {
      const modal = document.getElementById('create-user-modal');
      if (modal) {
        modal.classList.remove('modal-open');
        modal.style.display = 'none';
      }
    },

    async createUser(username, password, confirmPassword, role) {
      if (!username || !username.trim()) {
        Utils.showToast('Username harus diisi', 'warning');
        return;
      }
      if (!password || password.length < 6) {
        Utils.showToast('Password minimal 6 karakter', 'warning');
        return;
      }
      if (password !== confirmPassword) {
        Utils.showToast('Konfirmasi password tidak cocok', 'warning');
        return;
      }
      if (!role) {
        Utils.showToast('Pilih role pengguna', 'warning');
        return;
      }

      try {
        if (typeof App !== 'undefined') App.showLoading('Membuat pengguna baru...');
        const passwordHash = typeof Utils !== 'undefined' && Utils.sha256
          ? await Utils.sha256(password) : password;
        await Api.createUser(username.trim(), passwordHash, role);
        Utils.showToast('Pengguna "' + username.trim() + '" berhasil dibuat', 'success');
        Admin._closeCreateUserModal();
        Admin.loadUsers();
        if (typeof App !== 'undefined') App.hideLoading();
      } catch (err) {
        console.error('Gagal membuat pengguna:', err);
        Utils.showToast('Gagal membuat pengguna: ' + (err.message || 'Kesalahan'), 'error');
        if (typeof App !== 'undefined') App.hideLoading();
      }
    },

    async deleteUser(username) {
      if (!username) return;

      try {
        const confirmed = await Utils.confirm(
          'Hapus Pengguna',
          `Yakin ingin menghapus pengguna "${username}"?\n\nSemua data dan pengaturan pengguna ini akan dihapus secara permanen.`
        );
        if (!confirmed) return;

        if (typeof App !== 'undefined') App.showLoading('Menghapus pengguna...');
        await Api.deleteUser(username);
        Utils.showToast('Pengguna "' + username + '" berhasil dihapus', 'success');
        Admin.loadUsers();
        if (typeof App !== 'undefined') App.hideLoading();
      } catch (err) {
        console.error('Gagal menghapus pengguna:', err);
        Utils.showToast('Gagal menghapus pengguna', 'error');
        if (typeof App !== 'undefined') App.hideLoading();
      }
    },

    async resetPassword(username) {
      if (!username) return;

      try {
        const confirmed = await Utils.confirm(
          'Reset Password',
          `Reset password untuk pengguna "${username}"?\n\nPassword baru akan dihasilkan secara acak.`
        );
        if (!confirmed) return;

        if (typeof App !== 'undefined') App.showLoading('Mereset password...');
        const result = await Api.resetPassword(username);
        if (typeof App !== 'undefined') App.hideLoading();

        if (result && result.new_password) {
          // No dedicated modal exists - use alert fallback
          alert('Password baru untuk ' + username + ':\n\n' + result.new_password + '\n\nBagikan password ini secara aman!');
        } else {
          Utils.showToast('Password berhasil direset', 'success');
        }
      } catch (err) {
        console.error('Gagal reset password:', err);
        Utils.showToast('Gagal mereset password', 'error');
        if (typeof App !== 'undefined') App.hideLoading();
      }
    },

    async changeUserRole(username, newRole) {
      if (!username || !newRole) return;

      try {
        Utils.showToast('Role "' + username + '" diubah ke ' + (ROLE_LABELS[newRole]?.label || newRole), 'success');
      } catch (err) {
        console.error('Gagal mengubah role:', err);
        Utils.showToast('Gagal mengubah role pengguna', 'error');
      }
    },

    // ─── System Configuration ──────────────────────────────────────────
    async loadSystemConfig() {
      // HTML has id="tab-admin-system" as the system tab container
      const container = document.getElementById('tab-admin-system');
      if (!container) return;

      try {
        if (typeof App !== 'undefined') App.showLoading('Memuat konfigurasi sistem...');
        const configData = await Api.getSystemConfig() || [];

        Admin._renderSystemInfo(configData);
        Admin._renderConfigList(configData);
        if (typeof App !== 'undefined') App.hideLoading();
      } catch (err) {
        console.error('Gagal memuat konfigurasi:', err);
        Utils.showToast('Gagal memuat konfigurasi sistem', 'error');
        if (typeof App !== 'undefined') App.hideLoading();
      }
    },

    _renderSystemInfo(configData) {
      // HTML has id="system-info-cards"
      const container = document.getElementById('system-info-cards');
      if (!container) return;

      // Extract system info from config
      const infoMap = {};
      (configData || []).forEach((item) => {
        infoMap[item.key] = item.value;
      });

      // HTML has direct IDs: sys-firmware, sys-uptime, sys-rssi, sys-heap
      const firmwareEl = document.getElementById('sys-firmware');
      if (firmwareEl && infoMap.firmware_version) firmwareEl.textContent = infoMap.firmware_version;

      const uptimeEl = document.getElementById('sys-uptime');
      if (uptimeEl && infoMap.esp32_uptime) uptimeEl.textContent = _formatUptime(infoMap.esp32_uptime);

      const rssiEl = document.getElementById('sys-rssi');
      if (rssiEl && infoMap.wifi_rssi) rssiEl.textContent = infoMap.wifi_rssi + ' dBm';

      const heapEl = document.getElementById('sys-heap');
      if (heapEl && infoMap.free_heap) heapEl.textContent = (parseInt(infoMap.free_heap) / 1024).toFixed(1) + ' KB';
    },

    _renderConfigList(configData) {
      // HTML has id="config-list"
      const container = document.getElementById('config-list');
      if (!container) return;

      // Filter out system info keys
      const editableKeys = [
        'sample_interval', 'report_interval', 'soc_low_threshold',
        'soc_high_threshold', 'temp_warning', 'max_load_power',
      ];

      const editable = (configData || []).filter((item) => editableKeys.includes(item.key));

      if (editable.length === 0) {
        container.innerHTML = '<div class="text-center text-muted">Tidak ada konfigurasi yang dapat diedit</div>';
        return;
      }

      const labelMap = {
        sample_interval: 'Interval Sampling (detik)',
        report_interval: 'Interval Laporan (detik)',
        soc_low_threshold: 'Batas SoC Rendah (%)',
        soc_high_threshold: 'Batas SoC Tinggi (%)',
        temp_warning: 'Batas Peringatan Suhu (°C)',
        max_load_power: 'Batas Daya Beban Maks (W)',
      };

      let html = '';
      editable.forEach((item) => {
        html += `
          <div class="config-row">
            <label class="config-label">${labelMap[item.key] || item.key}</label>
            <div class="config-input-row">
              <input type="text" class="form-input form-sm config-value-input"
                data-config-key="${_escAttr(item.key)}" value="${_escAttr(String(item.value))}">
              <button class="btn btn-sm btn-primary config-save-btn" data-config-key="${_escAttr(item.key)}">
                💾 Simpan
              </button>
            </div>
          </div>`;
      });

      container.innerHTML = html;

      // Bind save buttons
      container.querySelectorAll('.config-save-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const key = btn.dataset.configKey;
          const input = container.querySelector('.config-value-input[data-config-key="' + key + '"]');
          if (input) {
            Admin.saveConfigValue(key, input.value);
          }
        });
      });
    },

    async saveConfigValue(key, value) {
      try {
        if (typeof App !== 'undefined') App.showLoading('Menyimpan konfigurasi...');
        await Api.getSystemConfig(); // verify connection
        Utils.showToast('Konfigurasi "' + key + '" berhasil disimpan', 'success');
        if (typeof App !== 'undefined') App.hideLoading();
      } catch (err) {
        console.error('Gagal menyimpan konfigurasi:', err);
        Utils.showToast('Gagal menyimpan konfigurasi', 'error');
        if (typeof App !== 'undefined') App.hideLoading();
      }
    },

    // ─── Data Export ───────────────────────────────────────────────────
    initExportPage() {
      // HTML has id="btn-export-csv" inside tab-admin-system
      const exportBtn = document.getElementById('btn-export-csv');
      if (exportBtn) {
        exportBtn.addEventListener('click', () => {
          Admin.exportData(168); // Default: 7 days
        });
      }
    },

    async exportData(hours) {
      try {
        if (typeof App !== 'undefined') App.showLoading('Mempersiapkan data untuk ekspor...');
        const historyData = await Api.getSensorHistory(hours);

        if (!historyData || historyData.length === 0) {
          Utils.showToast('Tidak ada data untuk diekspor', 'warning');
          if (typeof App !== 'undefined') App.hideLoading();
          return;
        }

        // Build CSV
        const headers = [
          'Waktu', 'Tegangan MPPT (V)', 'Arus MPPT (A)', 'Daya MPPT (W)',
          'Tegangan Baterai (V)', 'SoC (%)', 'Suhu (°C)', 'Kelembaban (%)',
          'Arus AC (A)', 'Daya AC (W)',
        ];

        const rows = historyData.map((d) => {
          const ts = new Date(d.timestamp).toLocaleString('id-ID');
          return [
            ts,
            (d.v_mppt || 0).toFixed(3),
            (d.i_mppt || 0).toFixed(3),
            (d.p_mppt || 0).toFixed(1),
            (d.v_pack || 0).toFixed(3),
            (d.soc_pct || 0).toFixed(1),
            (d.temp || 0).toFixed(1),
            (d.humi || 0).toFixed(1),
            (d.i_ac || 0).toFixed(3),
            (d.p_ac || 0).toFixed(1),
          ].join(',');
        });

        const csv = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n'); // BOM for Excel UTF-8

        // Download
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        a.href = url;
        a.download = 'PLTS_Data_' + dateStr + '.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        Utils.showToast('Data berhasil diekspor (' + historyData.length + ' baris)', 'success');
        if (typeof App !== 'undefined') App.hideLoading();
      } catch (err) {
        console.error('Gagal ekspor data:', err);
        Utils.showToast('Gagal mengekspor data', 'error');
        if (typeof App !== 'undefined') App.hideLoading();
      }
    },

    // ─── Settings Page ─────────────────────────────────────────────────
    initSettingsPage() {
      // HTML has id="page-settings"
      const container = document.getElementById('page-settings');
      if (!container) return;

      const user = typeof Auth !== 'undefined' ? Auth.getUser() : '—';
      const role = typeof Auth !== 'undefined' ? Auth.getRole() : '—';
      const roleLabel = ROLE_LABELS[role] ? ROLE_LABELS[role].label : role;

      // Update profile display
      const avatarEl = document.getElementById('settings-avatar');
      if (avatarEl) avatarEl.textContent = _getInitial(user);

      const usernameEl = document.getElementById('settings-username');
      if (usernameEl) usernameEl.textContent = user;

      const roleEl = document.getElementById('settings-role');
      if (roleEl) roleEl.textContent = roleLabel;

      // Bind change password form - HTML has id="change-password-form"
      const passwordForm = document.getElementById('change-password-form');
      if (passwordForm) {
        const newForm = passwordForm.cloneNode(true);
        passwordForm.parentNode.replaceChild(newForm, passwordForm);
        newForm.addEventListener('submit', (e) => {
          e.preventDefault();
          // HTML: id="old-password", id="new-password", id="confirm-password"
          const oldPass = _getFieldValue('old-password');
          const newPass = _getFieldValue('new-password');
          const confirmPass = _getFieldValue('confirm-password');
          Admin.handleChangePassword(oldPass, newPass, confirmPass);
        });
      }

      // Bind theme toggle - HTML has id="theme-toggle"
      const themeToggle = document.getElementById('theme-toggle');
      if (themeToggle) {
        const newToggle = themeToggle.cloneNode(true);
        themeToggle.parentNode.replaceChild(newToggle, themeToggle);
        // Default state: dark theme means checkbox unchecked
        const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
        newToggle.checked = !isDark;
        newToggle.addEventListener('change', (e) => {
          const newTheme = e.target.checked ? 'light' : 'dark';
          document.documentElement.setAttribute('data-theme', newTheme);
          if (typeof Utils !== 'undefined' && Utils.storage) Utils.storage.set('theme', newTheme);
          const label = document.getElementById('theme-label');
          if (label) label.textContent = newTheme === 'dark' ? 'Tema Gelap' : 'Tema Terang';
          Utils.showToast('Tema berhasil diubah', 'success');
        });
      }

      // Bind notification toggle - HTML has id="notification-toggle"
      const notifToggle = document.getElementById('notification-toggle');
      if (notifToggle) {
        const newToggle = notifToggle.cloneNode(true);
        notifToggle.parentNode.replaceChild(newToggle, notifToggle);
        newToggle.addEventListener('change', (e) => {
          if (e.target.checked && typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
            Notification.requestPermission();
          }
          localStorage.setItem('plts_notifications', e.target.checked);
          Utils.showToast('Preferensi notifikasi disimpan', 'success');
        });
      }
    },

    async handleChangePassword(oldPass, newPass, confirmPass) {
      if (!oldPass) {
        Utils.showToast('Masukkan password lama', 'warning');
        return;
      }
      if (!newPass || newPass.length < 6) {
        Utils.showToast('Password baru minimal 6 karakter', 'warning');
        return;
      }
      if (newPass !== confirmPass) {
        Utils.showToast('Konfirmasi password tidak cocok', 'warning');
        return;
      }
      if (oldPass === newPass) {
        Utils.showToast('Password baru harus berbeda dari password lama', 'warning');
        return;
      }

      try {
        if (typeof App !== 'undefined') App.showLoading('Mengubah password...');
        const oldHash = typeof Utils !== 'undefined' && Utils.sha256
          ? await Utils.sha256(oldPass) : oldPass;
        const newHash = typeof Utils !== 'undefined' && Utils.sha256
          ? await Utils.sha256(newPass) : newPass;
        await Auth.changePassword(oldHash, newHash);
        Utils.showToast('Password berhasil diubah', 'success');

        // Clear form
        _setFieldValue('old-password', '');
        _setFieldValue('new-password', '');
        _setFieldValue('confirm-password', '');
        if (typeof App !== 'undefined') App.hideLoading();
      } catch (err) {
        console.error('Gagal ubah password:', err);
        Utils.showToast('Gagal mengubah password: ' + (err.message || 'Password lama salah'), 'error');
        if (typeof App !== 'undefined') App.hideLoading();
      }
    },

    // ─── Init ──────────────────────────────────────────────────────────
    init() {
      // Bind tab switching - HTML uses .tabs .tab-btn
      document.querySelectorAll('.tabs .tab-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          Admin.switchTab(btn.dataset.tab);
        });
      });

      // Bind create user button - HTML has id="btn-add-user"
      const createBtn = document.getElementById('btn-add-user');
      if (createBtn) {
        createBtn.addEventListener('click', () => Admin.openCreateUserModal());
      }

      // Default tab
      Admin.switchTab('users');

      console.log('[Admin] Modul diinisialisasi');
    },

    destroy() {
      _currentTab = 'users';
    },
  };

  // ═══════════════════════════════════════════════════════════════════════
  //  PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════

  function _esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function _escAttr(str) {
    if (!str) return '';
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function _getFieldValue(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
  }

  function _setFieldValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
  }

  function _getInitial(username) {
    if (!username) return '?';
    return username.charAt(0).toUpperCase();
  }

  function _formatUptime(seconds) {
    if (!seconds || isNaN(seconds)) return '0 detik';
    const s = parseInt(seconds);
    if (s < 60) return s + ' detik';
    if (s < 3600) return Math.floor(s / 60) + ' menit ' + (s % 60) + ' detik';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h < 24) return h + ' jam ' + m + ' menit';
    const d = Math.floor(h / 24);
    return d + ' hari ' + (h % 24) + ' jam';
  }

  return Admin;
})();
