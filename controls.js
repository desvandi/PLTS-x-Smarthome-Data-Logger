/**
 * Controls Module - PLTS SmartHome
 * Relay control panel, PWM controls, PV disconnect, and PIR configuration.
 *
 * Dependencies: Utils, Api, Auth (global)
 */
const Controls = (() => {
  'use strict';

  // ─── State ──────────────────────────────────────────────────────────
  const pirConfigs = [];
  let _pwmDebounceTimer = null;

  // ─── Constants ──────────────────────────────────────────────────────
  const RELAY_COUNT = 13;
  const PIR_COUNT = 4;
  const DEFAULT_PIR_TIMEOUT = 180;

  const RELAY_ICONS = {
    1: '💡', 2: '💡', 3: '💡', 4: '💡', 5: '💡',
    6: '💡', 7: '💡', 8: '💡', 9: '💡',
    10: '🌀', 11: '🌀', 12: '⚡', 13: '❄️',
  };

  const RELAY_CATEGORIES = {
    lampu: { label: 'Lampu', ids: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
    kipas: { label: 'Kipas', ids: [10, 11] },
    kritis: { label: 'Kritis', ids: [12, 13] },
  };

  // ═══════════════════════════════════════════════════════════════════════
  //  PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════

  const Controls = {

    // ─── Relay Controls ────────────────────────────────────────────────
    initRelayControls() {
      // HTML has id="relay-grid"
      const grid = document.getElementById('relay-grid');
      if (!grid) return;

      const canControl = typeof Auth !== 'undefined' && Auth.hasRole && Auth.hasRole(['admin', 'technician']);

      let html = '';

      Object.entries(RELAY_CATEGORIES).forEach(([cat, info]) => {
        html += `<div class="relay-category">
          <h3 class="relay-category-title">${info.label}</h3>
          <div class="relay-grid">`;

        info.ids.forEach((id) => {
          const name = (typeof Utils !== 'undefined' && Utils.getRelayName)
            ? Utils.getRelayName(id) : 'Relay ' + id;
          const icon = RELAY_ICONS[id] || '🔌';
          const critical = id === 12 || id === 13;

          html += `
            <div class="relay-card ${critical ? 'relay-critical' : ''}" data-relay-id="${id}">
              <div class="relay-icon">${icon}</div>
              <div class="relay-info">
                <span class="relay-name">${name}</span>
                <span class="relay-status">
                  <span class="relay-dot" data-relay-dot="${id}"></span>
                  <span class="relay-state-text" data-relay-state-text="${id}">—</span>
                </span>
              </div>
              <label class="relay-toggle-switch ${canControl ? '' : 'disabled'}">
                <input type="checkbox" class="relay-toggle" data-relay-id="${id}"
                  ${!canControl ? 'disabled' : ''}>
                <span class="toggle-slider"></span>
              </label>
              ${critical ? '<span class="critical-warning" title="Perangkat kritis">⚠️</span>' : ''}
            </div>`;
        });

        html += '</div></div>';
      });

      grid.innerHTML = html;

      // Bind toggle events
      grid.querySelectorAll('.relay-toggle').forEach((toggle) => {
        toggle.addEventListener('change', (e) => {
          const relayId = parseInt(e.target.dataset.relayId);
          const newState = e.target.checked ? 'on' : 'off';
          Controls.toggleRelay(relayId, newState);
        });
      });
    },

    async toggleRelay(relayId, newState) {
      const name = (typeof Utils !== 'undefined' && Utils.getRelayName)
        ? Utils.getRelayName(relayId) : 'Relay ' + relayId;

      // Confirmation for critical relays
      if (relayId === 12 || relayId === 13) {
        try {
          const confirmed = await Utils.confirm(
            'Konfirmasi Operasi Kritis',
            newState === 'on'
              ? `Nyalakan ${name}?\n\nPerangkat ini mempengaruhi daya listrik utama. Pastikan kondisi aman sebelum melanjutkan.`
              : `Matikan ${name}?\n\nPerangkat ini mempengaruhi daya listrik utama. Semua perangkat yang terhubung akan mati.`
          );
          if (!confirmed) {
            Controls.updateRelayState(relayId, newState === 'on' ? 'off' : 'on');
            return;
          }
        } catch (err) {
          // Dialog dismissed, revert
          Controls.updateRelayState(relayId, newState === 'on' ? 'off' : 'on');
          return;
        }
      }

      // Optimistic UI update
      Controls.updateRelayState(relayId, newState);

      try {
        await Api.setRelay(relayId, newState);
        Utils.showToast(name + ' ' + (newState === 'on' ? 'dinyalakan' : 'dimatikan'), 'success');
      } catch (err) {
        console.error('Gagal toggle relay ' + relayId + ':', err);
        Utils.showToast('Gagal mengubah ' + name, 'error');
        // Revert on error
        Controls.updateRelayState(relayId, newState === 'on' ? 'off' : 'on');
      }
    },

    updateRelayState(relayId, state) {
      const isOn = state === 'on' || state === 1 || state === true;

      // Update toggle
      const toggle = document.querySelector('.relay-toggle[data-relay-id="' + relayId + '"]');
      if (toggle) toggle.checked = isOn;

      // Update card
      const card = document.querySelector('.relay-card[data-relay-id="' + relayId + '"]');
      if (card) {
        card.classList.toggle('relay-on', isOn);
      }

      // Update dot
      const dot = document.querySelector('[data-relay-dot="' + relayId + '"]');
      if (dot) {
        dot.className = 'relay-dot ' + (isOn ? 'dot-on' : 'dot-off');
      }

      // Update text
      const text = document.querySelector('[data-relay-state-text="' + relayId + '"]');
      if (text) {
        text.textContent = isOn ? 'ON' : 'OFF';
        text.className = 'relay-state-text ' + (isOn ? 'text-on' : 'text-off');
      }
    },

    updateAllRelayStates(relayStates) {
      if (!relayStates || !Array.isArray(relayStates)) return;
      for (let i = 0; i < relayStates.length && i < RELAY_COUNT; i++) {
        Controls.updateRelayState(i + 1, relayStates[i]);
      }
    },

    // ─── PWM Controls ──────────────────────────────────────────────────
    initPWMControls() {
      // HTML has id="pwm-slider" and id="pwm-value" directly in the page
      const slider = document.getElementById('pwm-slider');
      if (!slider) return;

      const canControl = typeof Auth !== 'undefined' && Auth.hasRole && Auth.hasRole(['admin', 'technician']);
      if (!canControl) slider.disabled = true;

      // Debounced slider change
      slider.addEventListener('input', () => {
        const val = parseInt(slider.value);
        const display = document.getElementById('pwm-value');
        if (display) display.textContent = val + '%';
        slider.style.setProperty('--pwm-pct', val + '%');

        if (_pwmDebounceTimer) clearTimeout(_pwmDebounceTimer);
        _pwmDebounceTimer = setTimeout(() => {
          Controls.setPWMValue(0, val);
        }, 500);
      });
    },

    async setPWMValue(channel, value) {
      try {
        await Api.setPWM(channel, value);
        // No toast for slider to avoid spam, silent success
      } catch (err) {
        console.error('Gagal set PWM:', err);
        Utils.showToast('Gagal mengatur PWM', 'error');
      }
    },

    updatePWMValue(channel, value) {
      const slider = document.getElementById('pwm-slider');
      if (slider && channel === 0) {
        slider.value = value || 0;
        slider.style.setProperty('--pwm-pct', (value || 0) + '%');
        const display = document.getElementById('pwm-value');
        if (display) display.textContent = (value || 0) + '%';
      }
    },

    // ─── PV Disconnect ─────────────────────────────────────────────────
    initPVDisconnect() {
      // HTML has id="pv-disconnect-toggle" and id="pv-disconnect-label"
      const toggle = document.getElementById('pv-disconnect-toggle');
      if (!toggle) return;

      const canControl = typeof Auth !== 'undefined' && Auth.hasRole && Auth.hasRole(['admin', 'technician']);
      if (!canControl) toggle.disabled = true;

      toggle.addEventListener('change', (e) => {
        // When checkbox is checked, PV is disconnected (inverted logic)
        const state = e.target.checked ? 'off' : 'on';
        Controls.togglePV(state);
      });
    },

    async togglePV(state) {
      // HTML: pv-disconnect-toggle - checked = disconnected, unchecked = connected
      const toggle = document.getElementById('pv-disconnect-toggle');
      const label = document.getElementById('pv-disconnect-label');
      const isConnect = state === 'on';

      try {
        const confirmed = await Utils.confirm(
          '⚠️ Peringatan Kritis',
          isConnect
            ? 'Hubungkan kembali Panel Surya?\n\nPastikan semua koneksi aman sebelum menghubungkan.'
            : 'PUTUSKAN Panel Surya?\n\nPengisian baterai akan berhenti total!\nLanjutkan hanya untuk darurat atau perawatan.'
        );
        if (!confirmed) {
          if (toggle) toggle.checked = !toggle.checked;
          return;
        }

        if (typeof App !== 'undefined') App.showLoading(isConnect ? 'Menghubungkan PV...' : 'Memutuskan PV...');
        await Api.setPVDisconnect(state);

        // Update UI - checked means disconnected
        if (toggle) toggle.checked = !isConnect;
        if (label) {
          label.textContent = isConnect ? 'Terhubung' : 'Terputus';
        }
        Utils.showToast('PV ' + (isConnect ? 'terhubung' : 'terputus'), 'success');
        if (typeof App !== 'undefined') App.hideLoading();
      } catch (err) {
        console.error('Gagal toggle PV:', err);
        if (toggle) toggle.checked = !toggle.checked;
        Utils.showToast('Gagal mengubah status PV', 'error');
        if (typeof App !== 'undefined') App.hideLoading();
      }
    },

    _updatePVStatusUI(connected) {
      // HTML: pv-disconnect-toggle (checked = disconnected), pv-disconnect-label
      const toggle = document.getElementById('pv-disconnect-toggle');
      const label = document.getElementById('pv-disconnect-label');

      if (toggle) toggle.checked = !connected;
      if (label) {
        label.textContent = connected ? 'Terhubung' : 'Terputus';
      }
    },

    // ─── PIR Configuration ─────────────────────────────────────────────
    async loadPIRConfig() {
      // HTML has id="pir-config-grid" containing the PIR cards
      const container = document.getElementById('pir-config-grid');
      if (!container) return;

      if (typeof App !== 'undefined') App.showLoading('Memuat konfigurasi PIR...');

      try {
        const mappings = await Api.getPIRMapping();
        pirConfigs.length = 0;

        // Ensure we have 4 PIR configs
        for (let i = 1; i <= PIR_COUNT; i++) {
          const existing = (mappings || []).find((m) => m.pir_id === i);
          pirConfigs.push(existing || {
            pir_id: i,
            relay_ids: [],
            timeout: DEFAULT_PIR_TIMEOUT,
            time_range: '18:00-06:00',
            enabled: false,
          });
        }

        // Update existing PIR cards in HTML
        Controls._updatePIRCards();

        Controls._bindPIREvents(container);
        if (typeof App !== 'undefined') App.hideLoading();
      } catch (err) {
        console.error('Gagal memuat PIR config:', err);
        Utils.showToast('Gagal memuat konfigurasi PIR', 'error');
        if (typeof App !== 'undefined') App.hideLoading();
      }
    },

    _updatePIRCards() {
      for (let i = 1; i <= PIR_COUNT; i++) {
        const config = pirConfigs[i - 1];
        if (!config) continue;

        const card = document.getElementById('pir-card-' + i);
        if (!card) continue;

        // Update enable toggle
        const enableInput = card.querySelector('.pir-enable[data-pir="' + i + '"]');
        if (enableInput) enableInput.checked = config.enabled;

        // Update relay checkboxes
        card.querySelectorAll('.pir-relay[data-pir="' + i + '"]').forEach((cb) => {
          cb.checked = (config.relay_ids || []).includes(parseInt(cb.value));
        });

        // Update timeout
        const timeoutInput = card.querySelector('.pir-timeout[data-pir="' + i + '"]');
        if (timeoutInput) timeoutInput.value = config.timeout || DEFAULT_PIR_TIMEOUT;

        // Update time range
        const [timeStart, timeEnd] = (config.time_range || '18:00-06:00').split('-');
        const startTime = card.querySelector('.pir-time-start[data-pir="' + i + '"]');
        if (startTime) startTime.value = timeStart;
        const endTime = card.querySelector('.pir-time-end[data-pir="' + i + '"]');
        if (endTime) endTime.value = timeEnd;

        // Toggle enabled class
        card.classList.toggle('pir-enabled', config.enabled);
      }
    },

    _bindPIREvents(container) {
      // Bind save button
      const saveBtn = document.getElementById('save-pir-config');
      if (saveBtn) {
        saveBtn.addEventListener('click', () => {
          Controls.saveAllPIRConfig();
        });
      }
    },

    async saveAllPIRConfig() {
      const configs = [];

      for (let i = 1; i <= PIR_COUNT; i++) {
        const card = document.getElementById('pir-card-' + i);
        if (!card) continue;

        const enabled = card.querySelector('.pir-enable[data-pir="' + i + '"]')?.checked || false;
        const timeout = parseInt(card.querySelector('.pir-timeout[data-pir="' + i + '"]')?.value) || DEFAULT_PIR_TIMEOUT;
        const timeStart = card.querySelector('.pir-time-start[data-pir="' + i + '"]')?.value || '18:00';
        const timeEnd = card.querySelector('.pir-time-end[data-pir="' + i + '"]')?.value || '06:00';
        const relayIds = [];

        card.querySelectorAll('.pir-relay[data-pir="' + i + '"]:checked').forEach((cb) => {
          relayIds.push(parseInt(cb.value));
        });

        configs.push({
          pir_id: i,
          relay_ids: relayIds,
          timeout: Math.max(0, Math.min(3600, timeout)),
          time_range: timeStart + '-' + timeEnd,
          enabled: enabled,
        });
      }

      try {
        if (typeof App !== 'undefined') App.showLoading('Menyimpan konfigurasi PIR...');
        await Api.savePIRMapping(configs);
        Utils.showToast('Konfigurasi PIR tersimpan', 'success');
        if (typeof App !== 'undefined') App.hideLoading();
      } catch (err) {
        console.error('Gagal simpan PIR config:', err);
        Utils.showToast('Gagal menyimpan konfigurasi PIR', 'error');
        if (typeof App !== 'undefined') App.hideLoading();
      }
    },

    // ─── Update from Sensor Data ───────────────────────────────────────
    updateFromSensorData(data) {
      if (!data) return;

      // Update relay states
      if (data.relay_states) {
        Controls.updateAllRelayStates(data.relay_states);
      }

      // Update PWM
      if (data.pwm_values && data.pwm_values.length > 0) {
        Controls.updatePWMValue(0, data.pwm_values[0]);
      }

      // Update PV status
      if (data.pv_connected !== undefined) {
        Controls._updatePVStatusUI(data.pv_connected);
      }
    },

    // ─── Init ──────────────────────────────────────────────────────────
    init() {
      Controls.initRelayControls();
      Controls.initPWMControls();
      Controls.initPVDisconnect();
      Controls.loadPIRConfig();

      // Bind time range buttons if present (HTML uses class .time-range-btn)
      document.querySelectorAll('.time-range-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const hours = parseInt(btn.dataset.hours);
          if (hours && typeof Dashboard !== 'undefined') {
            Dashboard.loadHistory(hours);
          }
        });
      });

      console.log('[Controls] Modul diinisialisasi');
    },

    destroy() {
      if (_pwmDebounceTimer) {
        clearTimeout(_pwmDebounceTimer);
        _pwmDebounceTimer = null;
      }
    },
  };

  return Controls;
})();
