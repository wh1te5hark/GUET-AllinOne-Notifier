export function createSmartCampusManager({
  appState,
  getToken,
  getApiBase,
  parseJsonSafely,
  formatApiError,
  setStatus,
  updateAccountDisplay,
  applyRealtimeToOverviewDom,
  applySmartCampusToDom,
  rerenderCollectorsPage,
}) {
  async function syncSmartCampusProfile({ silent = false } = {}) {
    const token = getToken();
    if (!token) return null;
    try {
      const response = await fetch(`${getApiBase()}/api/v1/collectors/smart-campus/profile/sync`, {
        method: 'POST',
        mode: 'cors',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await parseJsonSafely(response);
      if (!response.ok) throw new Error(formatApiError(data.detail, `同步失败（${response.status}）`));
      if (appState.currentUser) appState.currentUser.real_name = data.real_name || appState.currentUser.real_name;
      if (appState.realtime.user) appState.realtime.user.real_name = data.real_name || appState.realtime.user.real_name;
      updateAccountDisplay();
      applyRealtimeToOverviewDom();
      if (!silent) setStatus(`已同步真实姓名：${data.real_name || '未获取到'}`, 'success');
      return data;
    } catch (error) {
      if (!silent) setStatus(`同步真实姓名失败：${error.message}`, 'error');
      return null;
    }
  }

  function toggleSmartCampusScheduleMode() {
    const modeField = document.querySelector('#sc-schedule-mode');
    const visualPanel = document.querySelector('#sc-visual-settings');
    const cronPanel = document.querySelector('#sc-cron-settings');
    const mode = modeField?.value || 'visual';
    if (visualPanel) visualPanel.style.display = mode === 'visual' ? '' : 'none';
    if (cronPanel) cronPanel.style.display = mode === 'cron' ? '' : 'none';
  }

  async function loadSmartCampusSettings(silent = false) {
    const token = getToken();
    if (!token) return null;
    try {
      const response = await fetch(`${getApiBase()}/api/v1/collectors/smart-campus/settings`, {
        mode: 'cors',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await parseJsonSafely(response);
      if (!response.ok) throw new Error(formatApiError(data.detail, `读取设置失败（${response.status}）`));
      appState.smartCampus.setting = { ...appState.smartCampus.setting, ...data };
      if (appState.currentRoute === '/collectors') {
        const setting = appState.smartCampus.setting;
        const enabledSwitch = document.querySelector('#sc-enabled-switch');
        const modeField = document.querySelector('#sc-schedule-mode');
        const cronField = document.querySelector('#sc-cron-expr');
        const visualModeField = document.querySelector('#sc-visual-mode');
        const intervalField = document.querySelector('#sc-interval-minutes');
        const dailyTimeField = document.querySelector('#sc-daily-time');
        if (enabledSwitch) enabledSwitch.checked = !!setting.enabled;
        if (modeField) modeField.value = setting.schedule_mode || 'visual';
        if (cronField) cronField.value = setting.cron_expr || '*/30 * * * *';
        if (visualModeField) visualModeField.value = setting.visual_mode || 'every_n_minutes';
        if (intervalField) intervalField.value = String(setting.interval_minutes || 30);
        if (dailyTimeField) dailyTimeField.value = setting.daily_time || '08:00';
        toggleSmartCampusScheduleMode();
      }
      if (!silent) setStatus('采集器设置已加载。', 'success');
      return data;
    } catch (error) {
      if (!silent) setStatus(`读取采集器设置失败：${error.message}`, 'error');
      return null;
    }
  }

  async function saveSmartCampusSettings() {
    const token = getToken();
    if (!token) return setStatus('请先登录后再保存采集器设置。', 'error');
    const mode = document.querySelector('#sc-schedule-mode')?.value || 'visual';
    const payload = {
      enabled: !!document.querySelector('#sc-enabled-switch')?.checked,
      schedule_mode: mode,
      cron_expr: document.querySelector('#sc-cron-expr')?.value?.trim() || '*/30 * * * *',
      visual_mode: document.querySelector('#sc-visual-mode')?.value || 'every_n_minutes',
      interval_minutes: Number.parseInt(document.querySelector('#sc-interval-minutes')?.value || '30', 10) || 30,
      daily_time: document.querySelector('#sc-daily-time')?.value || '08:00',
    };
    try {
      const response = await fetch(`${getApiBase()}/api/v1/collectors/smart-campus/settings`, {
        method: 'PUT',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await parseJsonSafely(response);
      if (!response.ok) throw new Error(formatApiError(data.detail, `保存失败（${response.status}）`));
      appState.smartCampus.setting = { ...appState.smartCampus.setting, ...data };
      setStatus('采集器设置已保存。', 'success');
    } catch (error) {
      setStatus(`保存采集器设置失败：${error.message}`, 'error');
    }
  }

  function applySmartCampusQueryFromDom() {
    appState.smartCampus.query = {
      q: document.querySelector('#sc-search-q')?.value?.trim() || '',
      sender: document.querySelector('#sc-search-sender')?.value?.trim() || '',
      read_state: document.querySelector('#sc-read-state')?.value || 'all',
      sort_by: document.querySelector('#sc-sort-by')?.value || 'fetched_at',
      sort_dir: document.querySelector('#sc-sort-dir')?.value || 'desc',
    };
  }

  async function applySmartCampusQuery() {
    applySmartCampusQueryFromDom();
    await loadSmartCampusMessages();
  }

  function resetSmartCampusQuery() {
    appState.smartCampus.query = {
      q: '',
      sender: '',
      read_state: 'all',
      sort_by: 'fetched_at',
      sort_dir: 'desc',
    };
    rerenderCollectorsPage();
  }

  async function loadSmartCampusMessages(silent = false) {
    const token = getToken();
    if (!token) return [];
    appState.smartCampus.loading = true;
    appState.smartCampus.error = '';
    applySmartCampusToDom();
    try {
      const query = appState.smartCampus.query || {};
      const qs = new URLSearchParams({
        q: query.q || '',
        sender: query.sender || '',
        read_state: query.read_state || 'all',
        sort_by: query.sort_by || 'fetched_at',
        sort_dir: query.sort_dir || 'desc',
      });
      const response = await fetch(`${getApiBase()}/api/v1/collectors/smart-campus/messages?${qs.toString()}`, {
        mode: 'cors',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await parseJsonSafely(response);
      if (!response.ok) throw new Error(formatApiError(data.detail, `读取失败（${response.status}）`));
      appState.smartCampus.messages = Array.isArray(data) ? data : [];
      appState.smartCampus.updatedAt = new Date().toLocaleTimeString();
      if (!silent) setStatus(`已加载 ${appState.smartCampus.messages.length} 条智慧校园通知。`, 'success');
    } catch (error) {
      appState.smartCampus.error = `读取智慧校园通知失败：${error.message}`;
      if (!silent) setStatus(appState.smartCampus.error, 'error');
    } finally {
      appState.smartCampus.loading = false;
      applySmartCampusToDom();
    }
    return appState.smartCampus.messages;
  }

  async function syncSmartCampusMessages() {
    const token = getToken();
    if (!token) return setStatus('请先登录后再同步采集器。', 'error');
    appState.smartCampus.loading = true;
    appState.smartCampus.error = '';
    applySmartCampusToDom();
    try {
      const response = await fetch(`${getApiBase()}/api/v1/collectors/smart-campus/messages/sync`, {
        method: 'POST',
        mode: 'cors',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await parseJsonSafely(response);
      if (!response.ok) throw new Error(formatApiError(data.detail, `同步失败（${response.status}）`));
      appState.smartCampus.messages = Array.isArray(data.messages) ? data.messages : [];
      appState.smartCampus.updatedAt = new Date().toLocaleTimeString();
      setStatus(`智慧校园通知同步完成：抓取 ${data.fetched_count}，新增 ${data.saved_count}，标记已读 ${data.marked_read_count || 0}。`, 'success');
    } catch (error) {
      appState.smartCampus.error = `同步智慧校园通知失败：${error.message}`;
      setStatus(appState.smartCampus.error, 'error');
    } finally {
      appState.smartCampus.loading = false;
      applySmartCampusToDom();
    }
  }

  return {
    syncSmartCampusProfile,
    toggleSmartCampusScheduleMode,
    loadSmartCampusSettings,
    saveSmartCampusSettings,
    applySmartCampusQueryFromDom,
    applySmartCampusQuery,
    resetSmartCampusQuery,
    loadSmartCampusMessages,
    syncSmartCampusMessages,
  };
}
