/**
 * Dashboard Module - PLTS SmartHome
 * Monitoring dashboard with Chart.js charts and real-time data display.
 *
 * Dependencies: Chart.js (loaded via CDN), Utils, Api, App (global)
 */
const Dashboard = (() => {
  'use strict';

  // ─── Chart Instances ────────────────────────────────────────────────
  const charts = {
    power: null,
    cells: null,
    tempHumi: null,
    history: null,
  };

  // ─── Internal State ─────────────────────────────────────────────────
  let _animFrameId = null;
  let _refreshInterval = null;

  // ─── Chart.js Dark Theme Defaults ───────────────────────────────────
  const CHART_COLORS = {
    bg: '#1c2333',
    grid: '#30363d',
    text: '#e6edf3',
    muted: '#8b949e',
    blue: '#58a6ff',
    green: '#3fb950',
    yellow: '#d29922',
    red: '#f85149',
    purple: '#bc8cff',
    orange: '#f0883e',
    teal: '#39d2c0',
  };

  function baseChartOptions(extra = {}) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600, easing: 'easeOutQuart' },
      plugins: {
        legend: {
          labels: {
            color: CHART_COLORS.text,
            font: { size: 12, family: "'Inter', sans-serif" },
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 16,
          },
        },
        tooltip: {
          backgroundColor: '#0d1117',
          titleColor: CHART_COLORS.text,
          bodyColor: CHART_COLORS.muted,
          borderColor: CHART_COLORS.grid,
          borderWidth: 1,
          padding: 10,
          cornerRadius: 6,
        },
      },
      scales: {
        x: {
          ticks: { color: CHART_COLORS.muted, maxRotation: 0, maxTicksLimit: 8, font: { size: 11 } },
          grid: { color: CHART_COLORS.grid, drawBorder: false },
          border: { display: false },
        },
        y: {
          ticks: { color: CHART_COLORS.muted, font: { size: 11 } },
          grid: { color: CHART_COLORS.grid, drawBorder: false },
          border: { display: false },
        },
      },
      ...extra,
    };
  }

  // ─── Utility: animate number ────────────────────────────────────────
  function animateValue(el, start, end, duration, suffix, decimals) {
    if (!el) return;
    const dec = decimals || (Math.abs(end) < 10 ? 1 : 0);
    const range = end - start;
    const startTime = performance.now();
    suffix = suffix || '';

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutQuart
      const ease = 1 - Math.pow(1 - progress, 4);
      const current = start + range * ease;
      el.textContent = current.toFixed(dec) + suffix;
      if (progress < 1) {
        _animFrameId = requestAnimationFrame(step);
      }
    }
    if (_animFrameId) cancelAnimationFrame(_animFrameId);
    _animFrameId = requestAnimationFrame(step);
  }

  // ─── Battery Color ──────────────────────────────────────────────────
  function getBatteryColor(soc) {
    if (typeof Utils !== 'undefined' && Utils.getBatteryColor) {
      return Utils.getBatteryColor(soc);
    }
    if (soc > 60) return CHART_COLORS.green;
    if (soc >= 30) return CHART_COLORS.yellow;
    return CHART_COLORS.red;
  }

  // ─── Moving Average ─────────────────────────────────────────────────
  function movingAverage(data, windowSize) {
    if (!data || data.length === 0) return data;
    const result = [];
    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - Math.floor(windowSize / 2));
      const end = Math.min(data.length, i + Math.ceil(windowSize / 2));
      let sum = 0;
      let count = 0;
      for (let j = start; j < end; j++) {
        sum += data[j];
        count++;
      }
      result.push(count > 0 ? sum / count : data[i]);
    }
    return result;
  }

  // ─── Format Time Label ──────────────────────────────────────────────
  function formatTimeLabel(ts) {
    const d = new Date(ts);
    return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
  }

  // ─── Trend Icon ─────────────────────────────────────────────────────
  function renderTrend(current, previous) {
    if (previous == null || current == null) return '';
    const diff = current - previous;
    if (Math.abs(diff) < 0.01) return `<span class="trend trend-flat" title="Stabil">—</span>`;
    const up = diff > 0;
    const colorClass = up ? 'trend-up' : 'trend-down';
    const icon = up ? '↑' : '↓';
    return `<span class="trend ${colorClass}" title="${up ? 'Naik' : 'Turun'}">${icon}</span>`;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════

  const Dashboard = {

    // ─── Overview Page Metrics ─────────────────────────────────────────
    updateOverview(data) {
      if (!data) return;

      const prevState = (window.App && App.state && App.state.sensorData) || {};

      // Battery SoC
      // HTML: <span id="metric-soc">--</span> is INSIDE <div class="metric-value">
      const socEl = document.getElementById('metric-soc');
      if (socEl) {
        const prevSoc = prevState.soc_pct;
        animateValue(socEl, prevSoc || 0, data.soc_pct || 0, 800, '', 1);

        // Update battery sub detail
        const vPackEl = document.getElementById('metric-v-pack');
        if (vPackEl && data.v_pack) {
          vPackEl.textContent = data.v_pack.toFixed(2) + ' V';
        }
      }

      // Update battery gauge SVG
      Dashboard.updateBatteryGauge(data.soc_pct);

      // Solar Power
      const solarEl = document.getElementById('metric-solar');
      if (solarEl) {
        const prevSolar = prevState.p_mppt;
        animateValue(solarEl, prevSolar || 0, data.p_mppt || 0, 800, '', 0);

        // Update MPPT detail
        const mpptDetail = document.getElementById('metric-mppt-detail');
        if (mpptDetail && data.v_mppt && data.i_mppt) {
          mpptDetail.textContent = data.v_mppt.toFixed(1) + ' V / ' + data.i_mppt.toFixed(1) + ' A';
        }
      }

      // AC Load Power
      const loadEl = document.getElementById('metric-load');
      if (loadEl) {
        const prevLoad = prevState.p_ac;
        animateValue(loadEl, prevLoad || 0, data.p_ac || 0, 800, '', 0);

        // Update AC detail
        const acDetail = document.getElementById('metric-ac-detail');
        if (acDetail) {
          acDetail.textContent = (data.v_ac || '--') + ' V / ' + (data.i_ac || '--') + ' A';
        }
      }

      // Temperature
      const tempEl = document.getElementById('metric-temp');
      if (tempEl) {
        const prevTemp = prevState.temp;
        animateValue(tempEl, prevTemp || 0, data.temp || 0, 800, '', 1);
      }

      // Update humidity sub
      const humiEl = document.getElementById('metric-humi');
      if (humiEl && data.humi != null) {
        humiEl.textContent = 'Kelembaban: ' + data.humi.toFixed(1) + '%';
      }

      // Quick controls
      Dashboard.renderQuickControls(data);
    },

    // ─── Battery Gauge (SVG Circle in HTML) ───────────────────────────
    updateBatteryGauge(soc) {
      const gaugeFill = document.getElementById('soc-gauge-fill');
      const gaugeText = document.getElementById('soc-gauge-text');

      if (!gaugeFill || !gaugeText) return;

      soc = Math.max(0, Math.min(100, soc || 0));
      const color = getBatteryColor(soc);

      // The SVG circle: r=28, circumference = 2 * PI * 28 = 175.93
      const circumference = 175.93;
      const offset = circumference - (soc / 100) * circumference;

      gaugeFill.style.strokeDashoffset = offset;
      gaugeFill.style.stroke = color;
      gaugeText.textContent = soc.toFixed(0) + '%';
    },

    // ─── Charts Initialization ─────────────────────────────────────────
    initCharts() {
      Dashboard.destroyCharts();

      // Power Chart (Solar & Load over time)
      const powerCtx = document.getElementById('chart-power');
      if (powerCtx) {
        charts.power = new Chart(powerCtx.getContext('2d'), {
          type: 'line',
          data: {
            labels: [],
            datasets: [
              {
                label: 'Solar (W)',
                data: [],
                borderColor: CHART_COLORS.orange,
                backgroundColor: CHART_COLORS.orange + '20',
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
                fill: true,
                tension: 0.4,
              },
              {
                label: 'Beban AC (W)',
                data: [],
                borderColor: CHART_COLORS.blue,
                backgroundColor: CHART_COLORS.blue + '20',
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
                fill: true,
                tension: 0.4,
              },
            ],
          },
          options: baseChartOptions({
            interaction: { mode: 'index', intersect: false },
            plugins: {
              ...baseChartOptions().plugins,
              title: {
                display: true,
                text: 'Daya Listrik',
                color: CHART_COLORS.text,
                font: { size: 14, weight: '600' },
                padding: { bottom: 12 },
              },
            },
          }),
        });
      }

      // Cell Voltage Chart (Bar chart, 8 cells)
      const cellsCtx = document.getElementById('chart-cells');
      if (cellsCtx) {
        charts.cells = new Chart(cellsCtx.getContext('2d'), {
          type: 'bar',
          data: {
            labels: ['Sel 1', 'Sel 2', 'Sel 3', 'Sel 4', 'Sel 5', 'Sel 6', 'Sel 7', 'Sel 8'],
            datasets: [{
              label: 'Tegangan (V)',
              data: [0, 0, 0, 0, 0, 0, 0, 0],
              backgroundColor: [],
              borderColor: [],
              borderWidth: 1,
              borderRadius: 4,
              maxBarThickness: 40,
            }],
          },
          options: baseChartOptions({
            plugins: {
              ...baseChartOptions().plugins,
              title: {
                display: true,
                text: 'Tegangan Sel Baterai',
                color: CHART_COLORS.text,
                font: { size: 14, weight: '600' },
                padding: { bottom: 12 },
              },
            },
            scales: {
              ...baseChartOptions().scales,
              y: {
                ...baseChartOptions().scales.y,
                min: 2.8,
                max: 4.2,
                ticks: { ...baseChartOptions().scales.y.ticks, callback: (v) => v.toFixed(1) + 'V' },
              },
            },
          }),
        });
      }

      // Temperature & Humidity Chart (dual y-axis)
      const thCtx = document.getElementById('chart-temp-humi');
      if (thCtx) {
        charts.tempHumi = new Chart(thCtx.getContext('2d'), {
          type: 'line',
          data: {
            labels: [],
            datasets: [
              {
                label: 'Suhu (°C)',
                data: [],
                borderColor: CHART_COLORS.red,
                backgroundColor: CHART_COLORS.red + '15',
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
                fill: true,
                tension: 0.4,
                yAxisID: 'y',
              },
              {
                label: 'Kelembaban (%)',
                data: [],
                borderColor: CHART_COLORS.teal,
                backgroundColor: CHART_COLORS.teal + '15',
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
                fill: true,
                tension: 0.4,
                yAxisID: 'y1',
              },
            ],
          },
          options: {
            ...baseChartOptions({
              interaction: { mode: 'index', intersect: false },
              plugins: {
                ...baseChartOptions().plugins,
                title: {
                  display: true,
                  text: 'Suhu & Kelembaban',
                  color: CHART_COLORS.text,
                  font: { size: 14, weight: '600' },
                  padding: { bottom: 12 },
                },
              },
            }),
            scales: {
              x: baseChartOptions().scales.x,
              y: {
                ...baseChartOptions().scales.y,
                position: 'left',
                ticks: { ...baseChartOptions().scales.y.ticks, callback: (v) => v + '°C' },
              },
              y1: {
                ...baseChartOptions().scales.y,
                position: 'right',
                min: 0,
                max: 100,
                ticks: { ...baseChartOptions().scales.y.ticks, callback: (v) => v + '%' },
                grid: { drawOnChartArea: false },
              },
            },
          },
        });
      }
    },

    // ─── Update Power Chart ────────────────────────────────────────────
    updatePowerChart(historyData) {
      if (!charts.power || !historyData || historyData.length === 0) return;

      const labels = historyData.map((d) => formatTimeLabel(d.timestamp));
      const solarRaw = historyData.map((d) => d.p_mppt || 0);
      const loadRaw = historyData.map((d) => d.p_ac || 0);
      const windowSize = Math.max(3, Math.floor(historyData.length / 20));

      charts.power.data.labels = labels;
      charts.power.data.datasets[0].data = movingAverage(solarRaw, windowSize);
      charts.power.data.datasets[1].data = movingAverage(loadRaw, windowSize);
      charts.power.update('none');
    },

    // ─── Update Cell Voltage Chart ─────────────────────────────────────
    updateCellChart(cellVoltages) {
      if (!charts.cells || !cellVoltages) return;

      const colors = cellVoltages.map((v) => {
        if (v >= 3.2) return { bg: CHART_COLORS.green + 'cc', border: CHART_COLORS.green };
        if (v >= 3.0) return { bg: CHART_COLORS.yellow + 'cc', border: CHART_COLORS.yellow };
        return { bg: CHART_COLORS.red + 'cc', border: CHART_COLORS.red };
      });

      charts.cells.data.datasets[0].data = cellVoltages;
      charts.cells.data.datasets[0].backgroundColor = colors.map((c) => c.bg);
      charts.cells.data.datasets[0].borderColor = colors.map((c) => c.border);
      charts.cells.update('none');
    },

    // ─── Update Temp/Humidity Chart ────────────────────────────────────
    updateTempHumiChart(historyData) {
      if (!charts.tempHumi || !historyData || historyData.length === 0) return;

      const labels = historyData.map((d) => formatTimeLabel(d.timestamp));
      const tempRaw = historyData.map((d) => d.temp || 0);
      const humiRaw = historyData.map((d) => d.humi || 0);
      const windowSize = Math.max(3, Math.floor(historyData.length / 20));

      charts.tempHumi.data.labels = labels;
      charts.tempHumi.data.datasets[0].data = movingAverage(tempRaw, windowSize);
      charts.tempHumi.data.datasets[1].data = movingAverage(humiRaw, windowSize);
      charts.tempHumi.update('none');
    },

    // ─── Update All Charts from Sensor Data ────────────────────────────
    updateAllCharts(data) {
      // Update cell chart from live data
      if (data) {
        const cellV = [];
        for (let i = 1; i <= 8; i++) {
          const key = 'v_cell' + i;
          cellV.push(data[key] || data['cell' + i] || 0);
        }
        Dashboard.updateCellChart(cellV);
      }

      // Load history for power & temp/humi charts
      Dashboard.loadHistory(24);
    },

    // ─── Monitoring Page ───────────────────────────────────────────────
    updateMonitoringPage(data) {
      if (!data) return;

      // Sensor cards - direct ID mapping to HTML elements
      _setSensorValue('sensor-v-mppt', data.v_mppt, 'V', 2);
      _setSensorValue('sensor-i-mppt', data.i_mppt, 'A', 2);
      _setSensorValue('sensor-p-mppt', data.p_mppt, 'W', 1);
      _setSensorValue('sensor-v-pack', data.v_pack, 'V', 2);
      _setSensorValue('sensor-soc', data.soc_pct, '%', 1);
      _setSensorValue('sensor-temp', data.temp, '°C', 1);
      _setSensorValue('sensor-humi', data.humi, '%', 1);
      _setSensorValue('sensor-i-ac', data.i_ac, 'A', 2);
      _setSensorValue('sensor-p-ac', data.p_ac, 'W', 1);

      // PV Connected status
      const pvEl = document.getElementById('sensor-pv-connected');
      if (pvEl) {
        pvEl.textContent = (data.pv_connected === 1 || data.pv_connected === true) ? 'Terhubung' : 'Terputus';
        pvEl.style.color = (data.pv_connected === 1 || data.pv_connected === true) ? 'var(--accent-green)' : 'var(--accent-red)';
      }

      // MPPT Detail Card
      _setDetailValue('detail-mppt-v', data.v_mppt, 'V', 2);
      _setDetailValue('detail-mppt-i', data.i_mppt, 'A', 2);
      _setDetailValue('detail-mppt-p', data.p_mppt, 'W', 1);

      // MPPT status badge
      const mpptBadge = document.getElementById('mppt-status-badge');
      if (mpptBadge) {
        const mpptActive = (data.p_mppt || 0) > 0;
        mpptBadge.textContent = mpptActive ? 'Aktif' : 'Tidak Aktif';
        mpptBadge.className = 'badge ' + (mpptActive ? 'badge-yellow' : 'badge-muted');
      }

      // AC Load Detail Card
      _setDetailValue('detail-ac-i', data.i_ac, 'A', 2);
      _setDetailValue('detail-ac-p', data.p_ac, 'W', 1);

      // AC status
      const acStatusEl = document.getElementById('detail-ac-status');
      if (acStatusEl) {
        const acActive = (data.p_ac || 0) > 0;
        acStatusEl.textContent = acActive ? 'Aktif' : 'Tidak Aktif';
      }

      // AC status badge
      const acBadge = document.getElementById('ac-status-badge');
      if (acBadge) {
        const acActive = (data.p_ac || 0) > 0;
        acBadge.textContent = acActive ? 'Aktif' : 'Tidak Aktif';
        acBadge.className = 'badge ' + (acActive ? 'badge-blue' : 'badge-muted');
      }
    },

    // ─── History Page ──────────────────────────────────────────────────
    async loadHistory(hours) {
      hours = hours || 24;

      // Update active button (HTML uses class .time-range-btn)
      document.querySelectorAll('.time-range-btn').forEach((btn) => {
        btn.classList.toggle('active', parseInt(btn.dataset.hours) === hours);
      });

      try {
        if (typeof App !== 'undefined') App.showLoading('Memuat data histori...');
        const historyData = await Api.getSensorHistory(hours);

        if (!historyData || historyData.length === 0) {
          Utils.showToast('Tidak ada data histori untuk rentang ini', 'info');
          if (typeof App !== 'undefined') App.hideLoading();
          return;
        }

        // Update power chart
        Dashboard.updatePowerChart(historyData);

        // Update temp/humidity chart
        Dashboard.updateTempHumiChart(historyData);

        if (typeof App !== 'undefined') App.hideLoading();
      } catch (err) {
        console.error('Gagal memuat histori:', err);
        Utils.showToast('Gagal memuat data histori', 'error');
        if (typeof App !== 'undefined') App.hideLoading();
      }
    },

    // ─── Quick Controls on Overview ────────────────────────────────────
    renderQuickControls(data) {
      const container = document.getElementById('quick-controls');
      if (!container) return;

      const quickRelays = [1, 5, 10, 12, 13];
      const relayStates = data.relay_states || [];
      const isTechnicianOrAdmin = (typeof Auth !== 'undefined') && Auth.hasRole && Auth.hasRole(['admin', 'technician']);

      let html = '<div class="quick-controls-grid">';

      quickRelays.forEach((id) => {
        const name = (typeof Utils !== 'undefined' && Utils.getRelayName) ? Utils.getRelayName(id) : 'Relay ' + id;
        const state = relayStates[id - 1] === 1 || relayStates[id - 1] === true;
        const isOn = state;
        const critical = id === 12 || id === 13;
        const iconClass = _getRelayIconClass(id);

        html += `
          <div class="quick-control-item ${isOn ? 'active' : ''}" data-relay-id="${id}">
            <div class="quick-control-icon ${iconClass} ${isOn ? 'on' : 'off'}">
              ${critical ? '<span class="critical-badge">!</span>' : ''}
            </div>
            <span class="quick-control-name">${name}</span>
            ${isTechnicianOrAdmin ? `
              <label class="quick-toggle ${isOn ? 'on' : ''}">
                <input type="checkbox" class="relay-toggle" data-relay-id="${id}" ${isOn ? 'checked' : ''} ${!isTechnicianOrAdmin ? 'disabled' : ''}>
                <span class="toggle-slider"></span>
              </label>
            ` : `
              <span class="quick-status ${isOn ? 'status-on' : 'status-off'}">${isOn ? 'ON' : 'OFF'}</span>
            `}
          </div>
        `;
      });

      // PV Status
      const pvOn = data.pv_connected === 1 || data.pv_connected === true;
      html += `
        <div class="quick-control-item ${pvOn ? 'active' : ''}">
          <div class="quick-control-icon pv-icon ${pvOn ? 'on' : 'off'}"></div>
          <span class="quick-control-name">Panel Surya</span>
          ${isTechnicianOrAdmin ? `
            <label class="quick-toggle ${pvOn ? 'on' : ''}">
              <input type="checkbox" class="pv-toggle-quick" ${pvOn ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          ` : `
            <span class="quick-status ${pvOn ? 'status-on' : 'status-off'}">${pvOn ? 'ON' : 'OFF'}</span>
          `}
        </div>
      `;

      html += '</div>';
      container.innerHTML = html;

      // Bind relay toggles
      container.querySelectorAll('.relay-toggle').forEach((toggle) => {
        toggle.addEventListener('change', async (e) => {
          const relayId = parseInt(e.target.dataset.relayId);
          const newState = e.target.checked ? 'on' : 'off';
          e.target.disabled = true;

          try {
            if (relayId === 12 || relayId === 13) {
              const name = (typeof Utils !== 'undefined' && Utils.getRelayName) ? Utils.getRelayName(relayId) : 'Relay ' + relayId;
              const confirmed = await Utils.confirm(
                'Konfirmasi',
                newState === 'on'
                  ? `Nyalakan ${name}? Operasi ini mempengaruhi daya listrik.`
                  : `Matikan ${name}? Operasi ini mempengaruhi daya listrik.`
              );
              if (!confirmed) {
                e.target.checked = !e.target.checked;
                e.target.disabled = false;
                return;
              }
            }

            await Api.setRelay(relayId, newState);
            Utils.showToast((typeof Utils !== 'undefined' && Utils.getRelayName ? Utils.getRelayName(relayId) : 'Relay ' + relayId) + ' ' + (newState === 'on' ? 'dinyalakan' : 'dimatikan'), 'success');
          } catch (err) {
            console.error('Gagal toggle relay:', err);
            e.target.checked = !e.target.checked;
            Utils.showToast('Gagal mengubah relay', 'error');
          }
          e.target.disabled = false;
        });
      });

      // Bind PV toggle
      container.querySelectorAll('.pv-toggle-quick').forEach((toggle) => {
        toggle.addEventListener('change', async (e) => {
          const newState = e.target.checked ? 'on' : 'off';
          e.target.disabled = true;

          try {
            const confirmed = await Utils.confirm(
              'Peringatan Kritis',
              newState === 'on'
                ? 'Hubungkan kembali Panel Surya? Pastikan kondisi aman.'
                : 'Putuskan Panel Surya? Ini akan menghentikan pengisian baterai!'
            );
            if (!confirmed) {
              e.target.checked = !e.target.checked;
              e.target.disabled = false;
              return;
            }

            await Api.setPVDisconnect(newState);
            Utils.showToast('PV ' + (newState === 'on' ? 'terhubung' : 'terputus'), 'success');
          } catch (err) {
            console.error('Gagal toggle PV:', err);
            e.target.checked = !e.target.checked;
            Utils.showToast('Gagal mengubah PV', 'error');
          }
          e.target.disabled = false;
        });
      });
    },

    // ─── Alerts / Event Log ────────────────────────────────────────────
    renderAlerts(eventLog) {
      const container = document.getElementById('recent-alerts');
      if (!container) return;

      if (!eventLog || eventLog.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <div class="empty-state-title">Tidak ada peringatan</div>
            <div class="empty-state-text">Semua sistem berjalan normal</div>
          </div>`;
        return;
      }

      const recent = eventLog.slice(0, 5);
      let html = '';

      recent.forEach((ev) => {
        const severity = ev.severity || 'info';
        const severityClass = _getSeverityClass(severity);
        const timeStr = ev.timestamp ? formatTimeLabel(ev.timestamp) : '';
        const dateStr = ev.timestamp ? new Date(ev.timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '';

        html += `
          <div class="alert-item ${severityClass}">
            <div class="alert-dot"></div>
            <div class="alert-content">
              <span class="alert-message">${_escapeHtml(ev.message || 'Event tidak diketahui')}</span>
              <span class="alert-time">${dateStr} ${timeStr}</span>
            </div>
          </div>
        `;
      });

      container.innerHTML = html;
    },

    // ─── Destroy ───────────────────────────────────────────────────────
    destroyCharts() {
      Object.keys(charts).forEach((key) => {
        if (charts[key]) {
          charts[key].destroy();
          charts[key] = null;
        }
      });
    },

    destroy() {
      Dashboard.destroyCharts();
      if (_animFrameId) {
        cancelAnimationFrame(_animFrameId);
        _animFrameId = null;
      }
      if (_refreshInterval) {
        clearInterval(_refreshInterval);
        _refreshInterval = null;
      }
    },

    // ─── Init ──────────────────────────────────────────────────────────
    init() {
      console.log('[Dashboard] Modul diinisialisasi');
    },
  };

  // ═══════════════════════════════════════════════════════════════════════
  //  PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════

  // Update a sensor card value on the monitoring page
  function _setSensorValue(id, value, unit, decimals) {
    const el = document.getElementById(id);
    if (el && value != null) {
      el.textContent = value.toFixed(decimals || 0);
    }
  }

  // Update a detail card value
  function _setDetailValue(id, value, unit, decimals) {
    const el = document.getElementById(id);
    if (el && value != null) {
      el.textContent = value.toFixed(decimals || 0);
    }
  }

  function _getRelayIconClass(relayId) {
    if ([1, 2, 3, 4, 5, 6, 7, 8, 9].includes(relayId)) return 'icon-lamp';
    if ([10, 11].includes(relayId)) return 'icon-fan';
    if (relayId === 12) return 'icon-inverter';
    if (relayId === 13) return 'icon-ac';
    return 'icon-default';
  }

  function _getSeverityClass(severity) {
    switch ((severity || '').toLowerCase()) {
      case 'critical':
      case 'error':
        return 'alert-critical';
      case 'warning':
        return 'alert-warning';
      case 'success':
        return 'alert-success';
      default:
        return 'alert-info';
    }
  }

  function _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return Dashboard;
})();
