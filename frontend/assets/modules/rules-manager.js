function splitTextList(raw) {
  return String(raw || '')
    .split(/[\n,]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinTextList(values) {
  if (!Array.isArray(values) || values.length === 0) return '';
  return values.join('\n');
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function currentLang() {
  return localStorage.getItem('guet_notifier_language') === 'en' ? 'en' : 'zh';
}

function labelForCatalogItem(item) {
  if (!item) return '';
  return currentLang() === 'en' ? item.label_en || item.key : item.label_zh || item.key;
}

export function createRulesManager({
  appState,
  getToken,
  getApiBase,
  parseJsonSafely,
  formatApiError,
  setStatus,
  applyRulesToDom,
  applyTestPusherFeedToDom,
}) {
  function getButtonLabel(isEdit) {
    const isEn = currentLang() === 'en';
    if (isEdit) return isEn ? 'Save Rule' : '保存规则';
    return isEn ? 'Create Rule' : '创建规则';
  }

  function getDefaultConfig() {
    return {
      sources: [],
      match: { mode: 'all', include_any: [], exclude_any: [], use_regex: false },
      template: { subject: '{{title}}', body: '{{content_text}}' },
      channel_keys: ['debug_log'],
    };
  }

  function normalizeRule(rule) {
    const config = rule?.config || {};
    const match = config.match || {};
    const template = config.template || {};
    return {
      id: Number(rule?.id || 0),
      name: String(rule?.name || ''),
      enabled: !!rule?.enabled,
      created_at: String(rule?.created_at || ''),
      updated_at: String(rule?.updated_at || ''),
      config: {
        sources: Array.isArray(config.sources) ? config.sources : [],
        match: {
          mode: match.mode === 'any' ? 'any' : 'all',
          include_any: Array.isArray(match.include_any) ? match.include_any : [],
          exclude_any: Array.isArray(match.exclude_any) ? match.exclude_any : [],
          use_regex: !!match.use_regex,
        },
        template: {
          subject: String(template.subject || '{{title}}'),
          body: String(template.body || '{{content_text}}'),
        },
        channel_keys: Array.isArray(config.channel_keys) && config.channel_keys.length
          ? config.channel_keys
          : ['debug_log'],
      },
    };
  }

  function getRuleById(ruleId) {
    return appState.rules.items.find((item) => item.id === Number(ruleId));
  }

  function paintMetadataCheckboxes() {
    const sourcesBox = document.querySelector('#rule-sources-box');
    const pushersBox = document.querySelector('#rule-pushers-box');
    const collectors = appState.rulesMeta?.collectors || [];
    const pushers = appState.rulesMeta?.pushers || [];
    if (sourcesBox) {
      sourcesBox.innerHTML = collectors
        .map(
          (it) => `
        <label class="rule-check-row">
          <input type="checkbox" name="rule-source-key" value="${escapeHtml(it.key)}" />
          <span>${escapeHtml(labelForCatalogItem(it))}</span>
        </label>`,
        )
        .join('');
    }
    if (pushersBox) {
      pushersBox.innerHTML = pushers
        .map(
          (it) => `
        <label class="rule-check-row">
          <input type="checkbox" name="rule-pusher-key" value="${escapeHtml(it.key)}" />
          <span>${escapeHtml(labelForCatalogItem(it))}</span>
        </label>`,
        )
        .join('');
    }
  }

  function setCheckedByValues(inputName, values) {
    const set = new Set((values || []).map(String));
    document.querySelectorAll(`input[name="${inputName}"]`).forEach((el) => {
      el.checked = set.has(el.value);
    });
  }

  function collectCheckedValues(inputName) {
    return Array.from(document.querySelectorAll(`input[name="${inputName}"]:checked`)).map((el) => el.value);
  }

  function resetRuleForm() {
    const idField = document.querySelector('#rule-id');
    const nameField = document.querySelector('#rule-name');
    const enabledField = document.querySelector('#rule-enabled');
    const modeField = document.querySelector('#rule-match-mode');
    const regexField = document.querySelector('#rule-use-regex');
    const includeField = document.querySelector('#rule-include-any');
    const excludeField = document.querySelector('#rule-exclude-any');
    const subjectField = document.querySelector('#rule-template-subject');
    const bodyField = document.querySelector('#rule-template-body');
    const saveButton = document.querySelector('#rule-save-btn');

    if (idField) idField.value = '';
    if (nameField) nameField.value = '';
    if (enabledField) enabledField.checked = true;
    if (modeField) modeField.value = 'all';
    if (regexField) regexField.checked = false;
    if (includeField) includeField.value = '';
    if (excludeField) excludeField.value = '';
    if (subjectField) subjectField.value = '{{title}}';
    if (bodyField) bodyField.value = '{{content_text}}';
    if (saveButton) saveButton.textContent = getButtonLabel(false);
    setCheckedByValues('rule-source-key', []);
    setCheckedByValues('rule-pusher-key', ['debug_log']);
  }

  function fillRuleForm(rule) {
    const target = normalizeRule(rule);
    const idField = document.querySelector('#rule-id');
    const nameField = document.querySelector('#rule-name');
    const enabledField = document.querySelector('#rule-enabled');
    const modeField = document.querySelector('#rule-match-mode');
    const regexField = document.querySelector('#rule-use-regex');
    const includeField = document.querySelector('#rule-include-any');
    const excludeField = document.querySelector('#rule-exclude-any');
    const subjectField = document.querySelector('#rule-template-subject');
    const bodyField = document.querySelector('#rule-template-body');
    const saveButton = document.querySelector('#rule-save-btn');
    if (idField) idField.value = String(target.id);
    if (nameField) nameField.value = target.name;
    if (enabledField) enabledField.checked = target.enabled;
    if (modeField) modeField.value = target.config.match.mode;
    if (regexField) regexField.checked = !!target.config.match.use_regex;
    if (includeField) includeField.value = joinTextList(target.config.match.include_any);
    if (excludeField) excludeField.value = joinTextList(target.config.match.exclude_any);
    if (subjectField) subjectField.value = target.config.template.subject;
    if (bodyField) bodyField.value = target.config.template.body;
    if (saveButton) saveButton.textContent = getButtonLabel(true);
    setCheckedByValues('rule-source-key', target.config.sources);
    setCheckedByValues('rule-pusher-key', target.config.channel_keys);
  }

  function collectRulePayload() {
    const id = Number(document.querySelector('#rule-id')?.value || 0);
    const name = String(document.querySelector('#rule-name')?.value || '').trim();
    const enabled = !!document.querySelector('#rule-enabled')?.checked;
    const sources = collectCheckedValues('rule-source-key');
    const mode = document.querySelector('#rule-match-mode')?.value === 'any' ? 'any' : 'all';
    const useRegex = !!document.querySelector('#rule-use-regex')?.checked;
    const includeAny = splitTextList(document.querySelector('#rule-include-any')?.value || '');
    const excludeAny = splitTextList(document.querySelector('#rule-exclude-any')?.value || '');
    const subject = String(document.querySelector('#rule-template-subject')?.value || '{{title}}').trim();
    const body = String(document.querySelector('#rule-template-body')?.value || '{{content_text}}').trim();
    const channelKeys = collectCheckedValues('rule-pusher-key');
    return {
      id,
      payload: {
        name,
        enabled,
        config: {
          ...getDefaultConfig(),
          sources,
          match: {
            mode,
            include_any: includeAny,
            exclude_any: excludeAny,
            use_regex: useRegex,
          },
          template: {
            subject: subject || '{{title}}',
            body: body || '{{content_text}}',
          },
          channel_keys: channelKeys,
        },
      },
    };
  }

  async function loadRulesMeta(silent = false) {
    try {
      const base = getApiBase();
      const [cRes, pRes] = await Promise.all([
        fetch(`${base}/api/v1/meta/collectors`, { mode: 'cors' }),
        fetch(`${base}/api/v1/meta/pushers`, { mode: 'cors' }),
      ]);
      const cData = await parseJsonSafely(cRes);
      const pData = await parseJsonSafely(pRes);
      if (!cRes.ok) throw new Error(formatApiError(cData.detail, `读取采集器目录失败（${cRes.status}）`));
      if (!pRes.ok) throw new Error(formatApiError(pData.detail, `读取推送器目录失败（${pRes.status}）`));
      appState.rulesMeta.collectors = Array.isArray(cData) ? cData : [];
      appState.rulesMeta.pushers = Array.isArray(pData) ? pData : [];
      appState.rulesMeta.error = '';
      if (appState.rules?.error?.startsWith?.('无法加载采集器')) appState.rules.error = '';
    } catch (error) {
      appState.rulesMeta.error = error.message;
      if (!silent) setStatus(`加载目录失败：${error.message}`, 'error');
      else {
        appState.rules.error = `无法加载采集器/推送器目录：${error.message}`;
        applyRulesToDom();
      }
    }
    paintMetadataCheckboxes();
  }

  async function loadTestPusherFeed(silent = false) {
    const token = getToken();
    if (!token) {
      appState.testPusherFeed.items = [];
      appState.testPusherFeed.error = '';
      applyTestPusherFeedToDom?.();
      return;
    }
    appState.testPusherFeed.loading = true;
    appState.testPusherFeed.error = '';
    applyTestPusherFeedToDom?.();
    try {
      const response = await fetch(`${getApiBase()}/api/v1/pushers/test-deliveries?limit=50`, {
        mode: 'cors',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await parseJsonSafely(response);
      if (!response.ok) throw new Error(formatApiError(data.detail, `读取测试推送失败（${response.status}）`));
      appState.testPusherFeed.items = Array.isArray(data) ? data : [];
    } catch (error) {
      appState.testPusherFeed.error = error.message;
      if (!silent) setStatus(`读取测试推送记录失败：${error.message}`, 'error');
    } finally {
      appState.testPusherFeed.loading = false;
      applyTestPusherFeedToDom?.();
    }
  }

  async function loadRules(silent = false) {
    const token = getToken();
    if (!token) {
      appState.rules.items = [];
      appState.rules.loading = false;
      appState.rules.error = '请先登录后再管理转发规则。';
      applyRulesToDom();
      if (!silent) setStatus('请先登录后再管理转发规则。', 'muted');
      return [];
    }
    appState.rules.loading = true;
    appState.rules.error = '';
    applyRulesToDom();
    try {
      const response = await fetch(`${getApiBase()}/api/v1/rules`, {
        mode: 'cors',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await parseJsonSafely(response);
      if (!response.ok) throw new Error(formatApiError(data.detail, `读取规则失败（${response.status}）`));
      appState.rules.items = Array.isArray(data) ? data.map(normalizeRule) : [];
      appState.rules.updatedAt = new Date().toLocaleString();
      if (!silent) setStatus('转发规则已加载。', 'success');
    } catch (error) {
      appState.rules.error = error.message;
      if (!silent) setStatus(`读取转发规则失败：${error.message}`, 'error');
    } finally {
      appState.rules.loading = false;
      applyRulesToDom();
    }
    return appState.rules.items;
  }

  async function saveRule() {
    const token = getToken();
    if (!token) {
      setStatus('请先登录后再保存规则。', 'error');
      return;
    }
    const { id, payload } = collectRulePayload();
    if (!payload.name) {
      setStatus('规则名称不能为空。', 'error');
      return;
    }
    if (!payload.config.channel_keys?.length) {
      setStatus(currentLang() === 'en' ? 'Select at least one pusher.' : '请至少选择一个推送器。', 'error');
      return;
    }
    const endpoint = id > 0 ? `${getApiBase()}/api/v1/rules/${id}` : `${getApiBase()}/api/v1/rules`;
    const method = id > 0 ? 'PUT' : 'POST';
    try {
      const response = await fetch(endpoint, {
        method,
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await parseJsonSafely(response);
      if (!response.ok) throw new Error(formatApiError(data.detail, `${method} 规则失败（${response.status}）`));
      setStatus(id > 0 ? '规则已更新。' : '规则已创建。', 'success');
      resetRuleForm();
      await loadRules(true);
    } catch (error) {
      setStatus(`保存规则失败：${error.message}`, 'error');
    }
  }

  async function deleteRule(ruleId) {
    const token = getToken();
    if (!token) {
      setStatus('请先登录后再删除规则。', 'error');
      return;
    }
    try {
      const response = await fetch(`${getApiBase()}/api/v1/rules/${ruleId}`, {
        method: 'DELETE',
        mode: 'cors',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const data = await parseJsonSafely(response);
        throw new Error(formatApiError(data.detail, `删除规则失败（${response.status}）`));
      }
      setStatus('规则已删除。', 'success');
      resetRuleForm();
      await loadRules(true);
    } catch (error) {
      setStatus(`删除规则失败：${error.message}`, 'error');
    }
  }

  async function toggleRule(ruleId, nextEnabled) {
    const rule = getRuleById(ruleId);
    if (!rule) return;
    const payload = {
      name: rule.name,
      enabled: !!nextEnabled,
      config: rule.config,
    };
    const token = getToken();
    if (!token) return;
    try {
      const response = await fetch(`${getApiBase()}/api/v1/rules/${ruleId}`, {
        method: 'PUT',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await parseJsonSafely(response);
      if (!response.ok) throw new Error(formatApiError(data.detail, `更新规则失败（${response.status}）`));
      setStatus(nextEnabled ? '规则已启用。' : '规则已禁用。', 'success');
      await loadRules(true);
    } catch (error) {
      setStatus(`切换规则状态失败：${error.message}`, 'error');
    }
  }

  async function handleRulesListClick(event) {
    const button = event.target?.closest('button[data-action]');
    if (!button) return;
    const action = button.dataset.action || '';
    const ruleId = Number(button.dataset.ruleId || 0);
    if (!ruleId) return;
    const rule = getRuleById(ruleId);
    if (action === 'edit') {
      if (!rule) return;
      fillRuleForm(rule);
      return;
    }
    if (action === 'toggle') {
      if (!rule) return;
      await toggleRule(ruleId, !rule.enabled);
      return;
    }
    if (action === 'delete') {
      await deleteRule(ruleId);
    }
  }

  function sourceDisplayLabel(key) {
    const c = appState.rulesMeta?.collectors?.find((x) => x.key === key);
    return c ? labelForCatalogItem(c) : key;
  }

  function pusherDisplayLabel(key) {
    const p = appState.rulesMeta?.pushers?.find((x) => x.key === key);
    return p ? labelForCatalogItem(p) : key;
  }

  return {
    loadRules,
    loadRulesMeta,
    loadTestPusherFeed,
    saveRule,
    resetRuleForm,
    fillRuleForm,
    handleRulesListClick,
    paintMetadataCheckboxes,
    sourceDisplayLabel,
    pusherDisplayLabel,
  };
}
