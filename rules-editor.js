/**
 * Rules Editor Module - PLTS SmartHome
 * Automation rules engine editor with dynamic forms.
 *
 * Dependencies: Utils, Api, Auth (global)
 */
const RulesEditor = (() => {
  'use strict';

  // ─── State ──────────────────────────────────────────────────────────
  let rules = [];
  let editingRule = null;
  let _conditionCount = 0;
  let _actionCount = 0;

  // ─── Constants ──────────────────────────────────────────────────────
  const TRIGGER_TYPES = {
    time: { label: 'Waktu', icon: '🕐' },
    batt: { label: 'Level Baterai', icon: '🔋' },
    temp: { label: 'Suhu', icon: '🌡️' },
    humi: { label: 'Kelembaban', icon: '💧' },
    pir: { label: 'Gerakan PIR', icon: '👁️' },
    pv_i: { label: 'Arus PV', icon: '☀️' },
    ac_i: { label: 'Arus AC', icon: '🔌' },
    manual: { label: 'Manual', icon: '👆' },
  };

  const OPERATOR_MAP = {
    '>': { label: 'Lebih dari (>)' },
    '>=': { label: 'Lebih dari sama dengan (≥)' },
    '<': { label: 'Kurang dari (<)' },
    '<=': { label: 'Kurang dari sama dengan (≤)' },
    '==': { label: 'Sama dengan (=)' },
    '!=': { label: 'Tidak sama dengan (≠)' },
  };

  const CONDITION_TYPES = {
    time: { label: 'Waktu', unit: '', hasOperator: false },
    batt: { label: 'Level Baterai', unit: '%', hasOperator: true },
    temp: { label: 'Suhu', unit: '°C', hasOperator: true },
    humi: { label: 'Kelembaban', unit: '%', hasOperator: true },
    pir: { label: 'PIR Aktif', unit: '', hasOperator: false },
    relay: { label: 'Status Relay', unit: '', hasOperator: false },
    soc: { label: 'SoC Baterai', unit: '%', hasOperator: true },
  };

  const ACTION_TYPES_MAP = {
    relay: { label: 'Kontrol Relay', icon: '🔌' },
    pwm: { label: 'Atur PWM', icon: '🎤' },
    pv: { label: 'Kontrol PV', icon: '⚡' },
    alert: { label: 'Kirim Notifikasi', icon: '🔔' },
    log: { label: 'Catat Log', icon: '📝' },
  };

  // ═══════════════════════════════════════════════════════════════════════
  //  PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════

  const RulesEditor = {

    // ─── Rules List ────────────────────────────────────────────────────
    async loadRules() {
      const listEl = document.getElementById('rules-list');
      if (!listEl) return;

      try {
        if (typeof App !== 'undefined') App.showLoading('Memuat aturan otomasi...');
        rules = await Api.getRules() || [];
        RulesEditor.renderRulesList(rules);
        if (typeof App !== 'undefined') App.hideLoading();
      } catch (err) {
        console.error('Gagal memuat aturan:', err);
        Utils.showToast('Gagal memuat daftar aturan', 'error');
        if (typeof App !== 'undefined') App.hideLoading();
      }
    },

    renderRulesList(rulesList) {
      const listEl = document.getElementById('rules-list');
      if (!listEl) return;

      if (!rulesList || rulesList.length === 0) {
        listEl.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">📋</div>
            <h3>Belum Ada Aturan</h3>
            <p>Atur otomasi untuk rumah pintar Anda</p>
          </div>
        `;
        return;
      }

      // Sort by priority
      const sorted = [...rulesList].sort((a, b) => (a.priority || 99) - (b.priority || 99));

      let html = '<div class="rules-cards">';

      sorted.forEach((rule) => {
        const triggerDesc = RulesEditor.formatTriggerDescription(rule.trigger);
        const condDesc = rule.conditions && rule.conditions.length > 0
          ? RulesEditor.formatConditionsDescription(rule.conditions, rule.conditions_logic)
          : '';
        const actionDesc = RulesEditor.formatActionsDescription(rule.actions);

        html += `
          <div class="rule-card ${rule.enabled ? 'rule-enabled' : 'rule-disabled'}" data-rule-id="${_esc(rule.id)}">
            <div class="rule-header">
              <div class="rule-title-row">
                <span class="rule-name">${_esc(rule.name || 'Tanpa Nama')}</span>
                <span class="rule-badge ${rule.enabled ? 'badge-green' : 'badge-muted'}">
                  ${rule.enabled ? '✅ Aktif' : '⏸️ Nonaktif'}
                </span>
                <span class="rule-badge badge-purple">Prioritas: ${rule.priority || 1}</span>
              </div>
            </div>
            <div class="rule-body">
              <div class="rule-section">
                <span class="rule-label">JIKA</span>
                <span class="rule-text">${triggerDesc}</span>
              </div>
              ${condDesc ? `
                <div class="rule-section">
                  <span class="rule-label">DAN</span>
                  <span class="rule-text">${condDesc}</span>
                </div>
              ` : ''}
              <div class="rule-section">
                <span class="rule-label">MAKA</span>
                <span class="rule-text">${actionDesc}</span>
              </div>
              ${rule.timeout_sec ? `
                <div class="rule-section rule-timeout">
                  <span class="rule-label">⏱️</span>
                  <span class="rule-text">Timeout: ${rule.timeout_sec} detik</span>
                </div>
              ` : ''}
            </div>
            <div class="rule-footer">
              <label class="rule-enable-toggle">
                <input type="checkbox" class="rule-enable-check" data-rule-id="${_esc(rule.id)}" ${rule.enabled ? 'checked' : ''}>
                <span class="toggle-slider toggle-sm"></span>
              </label>
              <div class="rule-actions">
                <button class="btn btn-sm btn-outline rule-edit-btn" data-rule-id="${_esc(rule.id)}">✏️ Edit</button>
                <button class="btn btn-sm btn-danger rule-delete-btn" data-rule-id="${_esc(rule.id)}">🗑️ Hapus</button>
              </div>
            </div>
          </div>`;
      });

      html += '</div>';
      listEl.innerHTML = html;

      // Bind events
      listEl.querySelectorAll('.rule-edit-btn').forEach((btn) => {
        btn.addEventListener('click', () => RulesEditor.openRuleEditor(btn.dataset.ruleId));
      });
      listEl.querySelectorAll('.rule-delete-btn').forEach((btn) => {
        btn.addEventListener('click', () => RulesEditor.deleteRule(btn.dataset.ruleId));
      });
      listEl.querySelectorAll('.rule-enable-check').forEach((cb) => {
        cb.addEventListener('change', (e) => {
          RulesEditor.toggleRuleEnabled(e.target.dataset.ruleId, e.target.checked);
        });
      });
    },

    // ─── Format Descriptions (Indonesian) ──────────────────────────────
    formatTriggerDescription(trigger) {
      if (!trigger) return 'Tidak ditentukan';
      const type = trigger.type;

      switch (type) {
        case 'time':
          return `Waktu ${trigger.time || '00:00'}`;
        case 'batt':
          return `Baterai ${_opLabel(trigger.operator)} ${trigger.value}%`;
        case 'temp':
          return `Suhu ${_opLabel(trigger.operator)} ${trigger.value}°C`;
        case 'humi':
          return `Kelembaban ${_opLabel(trigger.operator)} ${trigger.value}%`;
        case 'pir':
          return `PIR #${trigger.pir_id || 1} mendeteksi gerakan`;
        case 'pv_i':
          return `Arus PV ${_opLabel(trigger.operator)} ${trigger.value}A`;
        case 'ac_i':
          return `Arus AC ${_opLabel(trigger.operator)} ${trigger.value}A`;
        case 'manual':
          return 'Dijalankan secara manual';
        default:
          return `Trigger: ${type}`;
      }
    },

    formatConditionsDescription(conditions, logic) {
      if (!conditions || conditions.length === 0) return '';
      const logicStr = (logic === 'OR') ? ' ATAU ' : ' DAN ';
      return conditions.map((c) => RulesEditor._formatCondition(c)).join(logicStr);
    },

    _formatCondition(cond) {
      if (!cond) return '';
      const type = cond.type;

      switch (type) {
        case 'time':
          return `waktu ${cond.time_range || '00:00-23:59'}`;
        case 'batt':
          return `baterai ${_opLabel(cond.operator)} ${cond.value}%`;
        case 'temp':
          return `suhu ${_opLabel(cond.operator)} ${cond.value}°C`;
        case 'humi':
          return `kelembaban ${_opLabel(cond.operator)} ${cond.value}%`;
        case 'pir':
          return `PIR #${cond.pir_id || 1} aktif`;
        case 'relay':
          return `Relay #${cond.relay_id || 0} ${cond.state || 'on'}`;
        case 'soc':
          return `SoC ${_opLabel(cond.operator)} ${cond.value}%`;
        default:
          return `${type}`;
      }
    },

    formatActionsDescription(actions) {
      if (!actions || actions.length === 0) return 'Tidak ada aksi';
      return actions.map((a) => RulesEditor._formatAction(a)).join(', ');
    },

    _formatAction(action) {
      if (!action) return '';
      switch (action.type) {
        case 'relay': {
          const name = (typeof Utils !== 'undefined' && Utils.getRelayName)
            ? Utils.getRelayName(action.relay_id) : 'Relay ' + (action.relay_id || '');
          return `${name} = ${action.state === 'on' ? 'NYALA' : 'MATI'}`;
        }
        case 'pwm':
          return `PWM Ch.${action.channel || 0} = ${action.value || 0}%`;
        case 'pv':
          return `PV = ${action.state === 'on' ? 'TERHUBUNG' : 'TERPUTUS'}`;
        case 'alert':
          return `🔔 Notifikasi: ${_esc(action.message || 'Tidak ada pesan')}`;
        case 'log':
          return `📝 Log: ${_esc(action.message || 'Tidak ada pesan')}`;
        default:
          return action.type;
      }
    },

    // ─── Rule Editor Modal ─────────────────────────────────────────────
    openRuleEditor(ruleId) {
      const modal = document.getElementById('rule-editor-modal');
      if (!modal) return;

      editingRule = ruleId ? rules.find((r) => r.id === ruleId) : null;
      _conditionCount = 0;
      _actionCount = 0;

      // Set title
      const titleEl = document.getElementById('rule-editor-title');
      if (titleEl) {
        titleEl.textContent = editingRule ? '✏️ Edit Aturan' : '➕ Tambah Aturan Baru';
      }

      // Reset form fields
      _setFieldValue('rule-name-input', editingRule ? (editingRule.name || '') : '');
      _setFieldValue('rule-priority-input', editingRule ? (editingRule.priority || 1) : 1);
      _setFieldValue('rule-timeout-input', editingRule ? (editingRule.timeout_sec || 180) : 180);

      // Reset enabled toggle
      const enabledInput = document.getElementById('rule-enabled-input');
      if (enabledInput) enabledInput.checked = editingRule ? editingRule.enabled : true;

      // Reset conditions logic toggle
      const logicContainer = document.getElementById('conditions-logic');
      if (logicContainer) {
        const activeLogic = editingRule && editingRule.conditions_logic === 'OR' ? 'OR' : 'AND';
        logicContainer.querySelectorAll('.logic-toggle-btn').forEach((btn) => {
          btn.classList.toggle('active', btn.dataset.logic === activeLogic);
        });
      }

      // Populate trigger type select - HTML has id="rule-trigger-type"
      const triggerSelect = document.getElementById('rule-trigger-type');
      if (triggerSelect) {
        // HTML has different option values (Waktu, Battery, Suhu, etc.)
        // Map our internal types to HTML option values
        const htmlToInternal = {
          'Waktu': 'time',
          'Battery': 'batt',
          'Suhu': 'temp',
          'Kelembaban': 'humi',
          'PIR': 'pir',
          'Arus MPPT': 'pv_i',
          'Arus AC': 'ac_i',
          'Manual': 'manual',
        };

        if (editingRule && editingRule.trigger) {
          // Find the HTML option value that corresponds to the internal type
          let matchVal = '';
          for (const [htmlVal, internalVal] of Object.entries(htmlToInternal)) {
            if (internalVal === editingRule.trigger.type) {
              matchVal = htmlVal;
              break;
            }
          }
          triggerSelect.value = matchVal;
          // Show trigger params if needed
          if (matchVal) RulesEditor.renderTriggerParams(htmlToInternal[matchVal], editingRule.trigger);
        } else {
          triggerSelect.value = '';
          RulesEditor.renderTriggerParams('', null);
        }
      }

      // Clear conditions list
      const condContainer = document.getElementById('conditions-list');
      if (condContainer) condContainer.innerHTML = '';

      if (editingRule && editingRule.conditions && editingRule.conditions.length > 0) {
        editingRule.conditions.forEach((cond) => RulesEditor.addConditionRow(cond));
      }

      // Clear actions list
      const actContainer = document.getElementById('actions-list');
      if (actContainer) actContainer.innerHTML = '';

      if (editingRule && editingRule.actions && editingRule.actions.length > 0) {
        editingRule.actions.forEach((act) => RulesEditor.addActionRow(act));
      } else {
        RulesEditor.addActionRow();
      }

      // Show modal
      modal.classList.add('modal-open');
      modal.style.display = 'flex';

      // Bind modal events
      RulesEditor._bindModalEvents(modal);
    },

    closeRuleEditor() {
      const modal = document.getElementById('rule-editor-modal');
      if (!modal) return;

      modal.classList.remove('modal-open');
      modal.style.display = 'none';
      editingRule = null;
    },

    // ─── Dynamic Trigger Params ────────────────────────────────────────
    renderTriggerParams(triggerType, existingData) {
      // HTML has id="rule-trigger-params-content" inside id="rule-trigger-params"
      const container = document.getElementById('rule-trigger-params-content');
      const wrapper = document.getElementById('rule-trigger-params');
      if (!container || !wrapper) return;
      container.innerHTML = '';
      wrapper.classList.remove('hidden');

      if (!triggerType) {
        wrapper.classList.add('hidden');
        return;
      }

      switch (triggerType) {
        case 'time':
          container.innerHTML = `
            <div class="form-group">
              <label>Waktu (HH:MM)</label>
              <input type="time" id="trigger-time" class="form-input"
                value="${existingData && existingData.time ? existingData.time : '18:00'}">
            </div>`;
          break;

        case 'batt':
        case 'temp':
        case 'humi':
        case 'pv_i':
        case 'ac_i': {
          const unitMap = { batt: '%', temp: '°C', humi: '%', pv_i: 'A', ac_i: 'A' };
          const labelMap = { batt: 'Level Baterai', temp: 'Suhu', humi: 'Kelembaban', pv_i: 'Arus PV', ac_i: 'Arus AC' };
          const unit = unitMap[triggerType] || '';
          const label = labelMap[triggerType] || 'Nilai';
          container.innerHTML = `
            <div class="form-row">
              <div class="form-group flex-1">
                <label>Operator</label>
                <select id="trigger-operator" class="form-select">
                  ${_buildOperatorOptions(existingData ? existingData.operator : '>')}
                </select>
              </div>
              <div class="form-group flex-1">
                <label>${label} (${unit})</label>
                <input type="number" id="trigger-value" class="form-input"
                  value="${existingData ? existingData.value : ''}" step="0.1">
              </div>
            </div>`;
          break;
        }

        case 'pir':
          container.innerHTML = `
            <div class="form-group">
              <label>Nomor PIR</label>
              <select id="trigger-pir-id" class="form-select">
                <option value="1" ${existingData && existingData.pir_id === 1 ? 'selected' : ''}>PIR #1</option>
                <option value="2" ${existingData && existingData.pir_id === 2 ? 'selected' : ''}>PIR #2</option>
                <option value="3" ${existingData && existingData.pir_id === 3 ? 'selected' : ''}>PIR #3</option>
                <option value="4" ${existingData && existingData.pir_id === 4 ? 'selected' : ''}>PIR #4</option>
              </select>
            </div>`;
          break;

        case 'manual':
          container.innerHTML = `
            <div class="form-info">
              <span class="info-icon">ℹ️</span>
              <span>Aturan manual tidak memerlukan parameter trigger. Aturan akan dijalankan saat tombol dipicu.</span>
            </div>`;
          break;
      }
    },

    // ─── Condition Rows ────────────────────────────────────────────────
    addConditionRow(existingData) {
      // HTML has id="conditions-list"
      const container = document.getElementById('conditions-list');
      if (!container) return;

      const idx = _conditionCount++;
      const type = existingData ? existingData.type : '';
      const logicOptions = idx === 0 ? '' : `
        <select class="form-select form-sm cond-logic" data-idx="${idx}">
          <option value="AND" ${(existingData && existingData._logic) === 'OR' ? '' : 'selected'}>DAN</option>
          <option value="OR" ${(existingData && existingData._logic) === 'OR' ? 'selected' : ''}>ATAU</option>
        </select>`;

      const row = document.createElement('div');
      row.className = 'condition-row';
      row.dataset.idx = idx;
      row.innerHTML = `
        ${logicOptions}
        <select class="form-select form-sm cond-type" data-idx="${idx}">
          <option value="">-- Kondisi --</option>
          ${Object.entries(CONDITION_TYPES).map(([k, v]) =>
            `<option value="${k}" ${type === k ? 'selected' : ''}>${v.label}</option>`
          ).join('')}
        </select>
        <div class="cond-params" data-idx="${idx}"></div>
        <button type="button" class="btn btn-sm btn-danger cond-remove" data-idx="${idx}" title="Hapus kondisi">
          ✕
        </button>
      `;

      container.appendChild(row);

      // If existing data, render params
      if (type) {
        RulesEditor._renderConditionParams(idx, type, existingData);
      }

      // Bind type change
      row.querySelector('.cond-type').addEventListener('change', (e) => {
        RulesEditor._renderConditionParams(idx, e.target.value, null);
      });

      // Bind remove
      row.querySelector('.cond-remove').addEventListener('click', () => {
        RulesEditor.removeConditionRow(idx, row);
      });
    },

    removeConditionRow(idx, rowEl) {
      if (rowEl) {
        rowEl.remove();
      }
    },

    _renderConditionParams(idx, condType, existingData) {
      const container = document.querySelector('.cond-params[data-idx="' + idx + '"]');
      if (!container) return;
      container.innerHTML = '';

      if (!condType) return;

      switch (condType) {
        case 'time':
          container.innerHTML = `
            <div class="cond-time-range">
              <input type="time" class="form-input form-sm cond-time-start"
                value="${existingData ? (existingData.time_range || '').split('-')[0] : '18:00'}">
              <span>—</span>
              <input type="time" class="form-input form-sm cond-time-end"
                value="${existingData ? (existingData.time_range || '').split('-')[1] : '06:00'}">
            </div>`;
          break;

        case 'batt':
        case 'temp':
        case 'humi':
        case 'soc': {
          const unitMap = { batt: '%', temp: '°C', humi: '%', soc: '%' };
          const unit = unitMap[condType] || '';
          container.innerHTML = `
            <select class="form-select form-sm cond-operator" data-idx="${idx}">
              ${_buildOperatorOptions(existingData ? existingData.operator : '>')}
            </select>
            <input type="number" class="form-input form-sm cond-value" data-idx="${idx}"
              value="${existingData ? existingData.value : ''}" step="0.1" placeholder="Nilai (${unit})">`;
          break;
        }

        case 'pir':
          container.innerHTML = `
            <select class="form-select form-sm cond-pir-id" data-idx="${idx}">
              <option value="1" ${existingData && existingData.pir_id === 1 ? 'selected' : ''}>PIR #1</option>
              <option value="2" ${existingData && existingData.pir_id === 2 ? 'selected' : ''}>PIR #2</option>
              <option value="3" ${existingData && existingData.pir_id === 3 ? 'selected' : ''}>PIR #3</option>
              <option value="4" ${existingData && existingData.pir_id === 4 ? 'selected' : ''}>PIR #4</option>
            </select>`;
          break;

        case 'relay':
          container.innerHTML = `
            <select class="form-select form-sm cond-relay-id" data-idx="${idx}">
              ${_buildRelayOptions(existingData ? existingData.relay_id : 1)}
            </select>
            <select class="form-select form-sm cond-relay-state" data-idx="${idx}">
              <option value="on" ${existingData && existingData.state === 'on' ? 'selected' : ''}>ON</option>
              <option value="off" ${existingData && existingData.state === 'off' ? 'selected' : ''}>OFF</option>
            </select>`;
          break;
      }
    },

    // ─── Action Rows ───────────────────────────────────────────────────
    addActionRow(existingData) {
      // HTML has id="actions-list"
      const container = document.getElementById('actions-list');
      if (!container) return;

      const idx = _actionCount++;
      const type = existingData ? existingData.type : '';

      const row = document.createElement('div');
      row.className = 'action-row';
      row.dataset.idx = idx;
      row.innerHTML = `
        <select class="form-select form-sm action-type" data-idx="${idx}">
          <option value="">-- Aksi --</option>
          ${Object.entries(ACTION_TYPES_MAP).map(([k, v]) =>
            `<option value="${k}" ${type === k ? 'selected' : ''}>${v.icon} ${v.label}</option>`
          ).join('')}
        </select>
        <div class="action-params" data-idx="${idx}"></div>
        <button type="button" class="btn btn-sm btn-danger action-remove" data-idx="${idx}" title="Hapus aksi">
          ✕
        </button>
      `;

      container.appendChild(row);

      if (type) {
        RulesEditor.renderActionParams(idx, type, existingData);
      }

      // Bind type change
      row.querySelector('.action-type').addEventListener('change', (e) => {
        RulesEditor.renderActionParams(idx, e.target.value, null);
      });

      // Bind remove
      row.querySelector('.action-remove').addEventListener('click', () => {
        RulesEditor.removeActionRow(idx, row);
      });
    },

    removeActionRow(idx, rowEl) {
      // HTML has id="actions-list"
      const container = document.getElementById('actions-list');
      if (!container) return;
      // Must keep at least 1 action
      if (container.querySelectorAll('.action-row').length <= 1) {
        Utils.showToast('Aturan harus memiliki minimal 1 aksi', 'warning');
        return;
      }
      if (rowEl) rowEl.remove();
    },

    renderActionParams(idx, actionType, existingData) {
      const container = document.querySelector('.action-params[data-idx="' + idx + '"]');
      if (!container) return;
      container.innerHTML = '';

      if (!actionType) return;

      switch (actionType) {
        case 'relay':
          container.innerHTML = `
            <select class="form-select form-sm action-relay-id" data-idx="${idx}">
              ${_buildRelayOptions(existingData ? existingData.relay_id : 1)}
            </select>
            <select class="form-select form-sm action-relay-state" data-idx="${idx}">
              <option value="on" ${existingData && existingData.state === 'on' ? 'selected' : ''}>NYALA</option>
              <option value="off" ${existingData && existingData.state === 'off' ? 'selected' : ''}>MATI</option>
            </select>`;
          break;

        case 'pwm':
          container.innerHTML = `
            <input type="number" class="form-input form-sm action-pwm-channel" data-idx="${idx}"
              value="${existingData ? existingData.channel : 0}" min="0" max="3" placeholder="Channel (0-3)">
            <input type="number" class="form-input form-sm action-pwm-value" data-idx="${idx}"
              value="${existingData ? existingData.value : 50}" min="0" max="100" placeholder="Nilai (0-100%)">`;
          break;

        case 'pv':
          container.innerHTML = `
            <select class="form-select form-sm action-pv-state" data-idx="${idx}">
              <option value="on" ${existingData && existingData.state === 'on' ? 'selected' : ''}>TERHUBUNG</option>
              <option value="off" ${existingData && existingData.state === 'off' ? 'selected' : ''}>TERPUTUS</option>
            </select>`;
          break;

        case 'alert':
          container.innerHTML = `
            <input type="text" class="form-input form-sm action-message" data-idx="${idx}"
              value="${existingData ? _escAttr(existingData.message || '') : ''}"
              placeholder="Pesan notifikasi...">`;
          break;

        case 'log':
          container.innerHTML = `
            <input type="text" class="form-input form-sm action-message" data-idx="${idx}"
              value="${existingData ? _escAttr(existingData.message || '') : ''}"
              placeholder="Pesan log...">`;
          break;
      }
    },

    // ─── Save Rule ─────────────────────────────────────────────────────
    async saveRule() {
      // HTML: id="rule-name-input"
      const name = _getFieldValue('rule-name-input') || '';
      // HTML: id="rule-priority-input"
      const priority = parseInt(_getFieldValue('rule-priority-input')) || 1;
      // HTML: id="rule-timeout-input"
      const timeout = parseInt(_getFieldValue('rule-timeout-input')) || 180;

      // Conditions logic from toggle buttons
      const logicContainer = document.getElementById('conditions-logic');
      let conditionsLogic = 'AND';
      if (logicContainer) {
        const activeBtn = logicContainer.querySelector('.logic-toggle-btn.active');
        if (activeBtn) conditionsLogic = activeBtn.dataset.logic;
      }

      // HTML: id="rule-enabled-input"
      const enabledInput = document.getElementById('rule-enabled-input');
      const enabled = enabledInput ? enabledInput.checked : true;

      // Validate
      if (!name.trim()) {
        Utils.showToast('Nama aturan harus diisi', 'warning');
        return;
      }

      // Map HTML trigger select values to internal types
      const htmlToInternal = {
        'Waktu': 'time',
        'Battery': 'batt',
        'Suhu': 'temp',
        'Kelembaban': 'humi',
        'PIR': 'pir',
        'Arus MPPT': 'pv_i',
        'Arus AC': 'ac_i',
        'Manual': 'manual',
      };

      // Build trigger
      const triggerSelectHtml = _getFieldValue('rule-trigger-type');
      const triggerType = htmlToInternal[triggerSelectHtml] || '';
      if (!triggerType) {
        Utils.showToast('Pilih trigger terlebih dahulu', 'warning');
        return;
      }

      const trigger = { type: triggerType };
      switch (triggerType) {
        case 'time':
          trigger.time = _getFieldValue('trigger-time');
          if (!trigger.time) {
            Utils.showToast('Isi waktu trigger', 'warning');
            return;
          }
          break;
        case 'batt': case 'temp': case 'humi': case 'pv_i': case 'ac_i':
          trigger.operator = _getFieldValue('trigger-operator');
          trigger.value = parseFloat(_getFieldValue('trigger-value'));
          if (isNaN(trigger.value)) {
            Utils.showToast('Isi nilai trigger', 'warning');
            return;
          }
          break;
        case 'pir':
          trigger.pir_id = parseInt(_getFieldValue('trigger-pir-id'));
          break;
        case 'manual':
          break;
      }

      // Build conditions
      const conditions = [];
      const condRows = document.querySelectorAll('.condition-row');
      condRows.forEach((row) => {
        const type = row.querySelector('.cond-type').value;
        if (!type) return;

        const cond = { type };
        const logicEl = row.querySelector('.cond-logic');
        if (logicEl) cond._logic = logicEl.value;

        switch (type) {
          case 'time': {
            const start = row.querySelector('.cond-time-start');
            const end = row.querySelector('.cond-time-end');
            cond.time_range = (start ? start.value : '00:00') + '-' + (end ? end.value : '23:59');
            break;
          }
          case 'batt': case 'temp': case 'humi': case 'soc':
            cond.operator = row.querySelector('.cond-operator').value;
            cond.value = parseFloat(row.querySelector('.cond-value').value) || 0;
            break;
          case 'pir':
            cond.pir_id = parseInt(row.querySelector('.cond-pir-id').value);
            break;
          case 'relay':
            cond.relay_id = parseInt(row.querySelector('.cond-relay-id').value);
            cond.state = row.querySelector('.cond-relay-state').value;
            break;
        }
        conditions.push(cond);
      });

      // Clean _logic from conditions
      conditions.forEach((c) => delete c._logic);

      // Build actions
      const actions = [];
      const actRows = document.querySelectorAll('.action-row');
      actRows.forEach((row) => {
        const type = row.querySelector('.action-type').value;
        if (!type) return;

        const action = { type };
        switch (type) {
          case 'relay':
            action.relay_id = parseInt(row.querySelector('.action-relay-id').value);
            action.state = row.querySelector('.action-relay-state').value;
            break;
          case 'pwm':
            action.channel = parseInt(row.querySelector('.action-pwm-channel').value) || 0;
            action.value = parseInt(row.querySelector('.action-pwm-value').value) || 0;
            break;
          case 'pv':
            action.state = row.querySelector('.action-pv-state').value;
            break;
          case 'alert':
          case 'log':
            action.message = row.querySelector('.action-message').value || '';
            break;
        }
        actions.push(action);
      });

      if (actions.length === 0) {
        Utils.showToast('Aturan harus memiliki minimal 1 aksi', 'warning');
        return;
      }

      if (priority < 1 || priority > 100) {
        Utils.showToast('Prioritas harus antara 1-100', 'warning');
        return;
      }

      // Build rule object
      const rule = {
        id: editingRule ? editingRule.id : _generateId(),
        name: name.trim(),
        trigger,
        conditions_logic: conditionsLogic,
        conditions,
        actions,
        timeout_sec: timeout,
        enabled: enabled,
        priority,
      };

      try {
        if (typeof App !== 'undefined') App.showLoading(editingRule ? 'Menyimpan perubahan...' : 'Membuat aturan baru...');
        await Api.saveRule(rule);
        Utils.showToast(editingRule ? 'Aturan berhasil diperbarui' : 'Aturan baru berhasil dibuat', 'success');
        RulesEditor.closeRuleEditor();
        await RulesEditor.loadRules();
        if (typeof App !== 'undefined') App.hideLoading();
      } catch (err) {
        console.error('Gagal menyimpan aturan:', err);
        Utils.showToast('Gagal menyimpan aturan: ' + (err.message || 'Kesalahan tidak diketahui'), 'error');
        if (typeof App !== 'undefined') App.hideLoading();
      }
    },

    // ─── Delete Rule ───────────────────────────────────────────────────
    async deleteRule(ruleId) {
      const rule = rules.find((r) => r.id === ruleId);
      if (!rule) return;

      try {
        const confirmed = await Utils.confirm(
          'Hapus Aturan',
          `Yakin ingin menghapus aturan "${rule.name || 'Tanpa Nama'}"?\n\nTindakan ini tidak dapat dibatalkan.`
        );
        if (!confirmed) return;

        if (typeof App !== 'undefined') App.showLoading('Menghapus aturan...');
        await Api.deleteRule(ruleId);
        Utils.showToast('Aturan berhasil dihapus', 'success');
        await RulesEditor.loadRules();
        if (typeof App !== 'undefined') App.hideLoading();
      } catch (err) {
        console.error('Gagal menghapus aturan:', err);
        Utils.showToast('Gagal menghapus aturan', 'error');
        if (typeof App !== 'undefined') App.hideLoading();
      }
    },

    // ─── Toggle Rule Enabled ───────────────────────────────────────────
    async toggleRuleEnabled(ruleId, enabled) {
      const rule = rules.find((r) => r.id === ruleId);
      if (!rule) return;

      try {
        const updatedRule = { ...rule, enabled };
        await Api.saveRule(updatedRule);
        rule.enabled = enabled;
        Utils.showToast('Aturan ' + (enabled ? 'diaktifkan' : 'dinonaktifkan'), 'success');
      } catch (err) {
        console.error('Gagal toggle aturan:', err);
        Utils.showToast('Gagal mengubah status aturan', 'error');
        // Revert checkbox
        const cb = document.querySelector('.rule-enable-check[data-rule-id="' + ruleId + '"]');
        if (cb) cb.checked = !enabled;
      }
    },

    // ─── Bind Modal Events ─────────────────────────────────────────────
    _bindModalEvents(modal) {
      // Trigger type change - HTML has id="rule-trigger-type"
      const triggerSelect = document.getElementById('rule-trigger-type');
      if (triggerSelect) {
        const newSelect = triggerSelect.cloneNode(true);
        triggerSelect.parentNode.replaceChild(newSelect, triggerSelect);
        newSelect.addEventListener('change', () => {
          const htmlToInternal = {
            'Waktu': 'time',
            'Battery': 'batt',
            'Suhu': 'temp',
            'Kelembaban': 'humi',
            'PIR': 'pir',
            'Arus MPPT': 'pv_i',
            'Arus AC': 'ac_i',
            'Manual': 'manual',
          };
          const internalType = htmlToInternal[newSelect.value] || '';
          RulesEditor.renderTriggerParams(internalType, editingRule ? editingRule.trigger : null);
        });
        // Fire initial render if has value
        if (newSelect.value) {
          const htmlToInternal = {
            'Waktu': 'time',
            'Battery': 'batt',
            'Suhu': 'temp',
            'Kelembaban': 'humi',
            'PIR': 'pir',
            'Arus MPPT': 'pv_i',
            'Arus AC': 'ac_i',
            'Manual': 'manual',
          };
          RulesEditor.renderTriggerParams(htmlToInternal[newSelect.value] || '', editingRule ? editingRule.trigger : null);
        }
      }

      // Close modal button - HTML has id="rule-editor-close"
      const closeBtn = document.getElementById('rule-editor-close');
      if (closeBtn) {
        const newClose = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newClose, closeBtn);
        newClose.addEventListener('click', RulesEditor.closeRuleEditor);
      }

      // Cancel button - HTML has id="rule-editor-cancel"
      const cancelBtn = document.getElementById('rule-editor-cancel');
      if (cancelBtn) {
        const newCancel = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
        newCancel.addEventListener('click', RulesEditor.closeRuleEditor);
      }

      // Save button - HTML has id="rule-editor-save"
      const saveBtn = document.getElementById('rule-editor-save');
      if (saveBtn) {
        const newSave = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSave, saveBtn);
        newSave.addEventListener('click', () => RulesEditor.saveRule());
      }

      // Add condition button - HTML has id="btn-add-condition"
      const addCondBtn = document.getElementById('btn-add-condition');
      if (addCondBtn) {
        const newAddCond = addCondBtn.cloneNode(true);
        addCondBtn.parentNode.replaceChild(newAddCond, addCondBtn);
        newAddCond.addEventListener('click', () => RulesEditor.addConditionRow());
      }

      // Add action button - HTML has id="btn-add-action"
      const addActBtn = document.getElementById('btn-add-action');
      if (addActBtn) {
        const newAddAct = addActBtn.cloneNode(true);
        addActBtn.parentNode.replaceChild(newAddAct, addActBtn);
        newAddAct.addEventListener('click', () => RulesEditor.addActionRow());
      }

      // Click outside to close - the modal overlay IS the modal element itself
      modal.addEventListener('click', (e) => {
        if (e.target === modal) RulesEditor.closeRuleEditor();
      });

      // ESC to close
      const escHandler = (e) => {
        if (e.key === 'Escape') {
          RulesEditor.closeRuleEditor();
          document.removeEventListener('keydown', escHandler);
        }
      };
      document.addEventListener('keydown', escHandler);
    },

    // ─── Init ──────────────────────────────────────────────────────────
    init() {
      // Bind "Add Rule" button - HTML has id="btn-add-rule"
      const addBtn = document.getElementById('btn-add-rule');
      if (addBtn) {
        addBtn.addEventListener('click', () => RulesEditor.openRuleEditor());
      }

      // Load rules
      RulesEditor.loadRules();

      console.log('[RulesEditor] Modul diinisialisasi');
    },

    destroy() {
      editingRule = null;
      rules = [];
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

  function _opLabel(op) {
    if (!op) return '=';
    const map = { '>': 'lebih dari', '>=': '≥', '<': 'kurang dari', '<=': '≤', '==': '=', '!=': '≠' };
    return map[op] || op;
  }

  function _buildOperatorOptions(selected) {
    return Object.entries(OPERATOR_MAP).map(([key, info]) =>
      `<option value="${key}" ${selected === key ? 'selected' : ''}>${info.label}</option>`
    ).join('');
  }

  function _buildRelayOptions(selectedId) {
    let html = '';
    for (let i = 1; i <= 13; i++) {
      const name = (typeof Utils !== 'undefined' && Utils.getRelayName) ? Utils.getRelayName(i) : 'Relay ' + i;
      html += `<option value="${i}" ${parseInt(selectedId) === i ? 'selected' : ''}>${i}. ${name}</option>`;
    }
    return html;
  }

  function _generateId() {
    if (typeof Utils !== 'undefined' && Utils.generateId) return Utils.generateId();
    return 'rule_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  return RulesEditor;
})();
