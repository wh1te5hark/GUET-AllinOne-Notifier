export function createProfileSessionManager({
  appState,
  getToken,
  getApiBase,
  parseJsonSafely,
  formatApiError,
  setStatus,
  syncCurrentUser,
  syncSmartCampusProfile,
  clearLocalAuth,
  navigateTo,
  updateAccountDisplay,
  applyRealtimeToOverviewDom,
  resolveNickname,
}) {
  function isEnglish() {
    return (localStorage.getItem('guet_notifier_language') || 'zh') === 'en';
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('头像读取失败'));
      reader.readAsDataURL(file);
    });
  }

  async function onAvatarFileSelected(event) {
    const file = event.target?.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      if (!appState.realtime.user) appState.realtime.user = {};
      appState.realtime.user.avatar_base64 = dataUrl;
      const preview = document.querySelector('#profile-avatar-preview');
      const placeholder = document.querySelector('#profile-avatar-placeholder');
      if (preview) {
        preview.src = dataUrl;
        preview.style.display = '';
      }
      if (placeholder) placeholder.style.display = 'none';
      setStatus('头像已选择，点击保存后写入数据库。', 'success');
    } catch (error) {
      setStatus(`头像处理失败：${error.message}`, 'error');
    }
  }

  async function saveProfile() {
    const token = getToken();
    if (!token) return setStatus('请先登录后再保存资料。', 'error');
    const nameField = document.querySelector('#profile-display-name');
    const displayName = nameField?.value?.trim() || '';
    const avatarBase64 = appState.realtime.user?.avatar_base64 || '';
    setStatus('正在保存昵称与头像…');
    try {
      const response = await fetch(`${getApiBase()}/api/v1/profile`, {
        method: 'PUT',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          display_name: displayName,
          avatar_base64: avatarBase64,
        }),
      });
      const data = await parseJsonSafely(response);
      if (!response.ok) throw new Error(formatApiError(data.detail, `保存失败（${response.status}）`));
      appState.currentUser = data;
      appState.realtime.user = data;
      updateAccountDisplay();
      applyRealtimeToOverviewDom();
      setStatus('昵称与头像保存成功。', 'success');
    } catch (error) {
      setStatus(`保存失败：${error.message}`, 'error');
    }
  }

  async function loadStoredCookies() {
    const token = getToken();
    if (!token) {
      appState.storedCookies = [];
      return [];
    }
    try {
      const response = await fetch(`${getApiBase()}/api/v1/me/cookies`, {
        mode: 'cors',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await parseJsonSafely(response);
      if (!response.ok) throw new Error(formatApiError(data.detail, `读取 Cookies 失败（${response.status}）`));
      appState.storedCookies = Array.isArray(data) ? data : [];
      return appState.storedCookies;
    } catch {
      appState.storedCookies = [];
      return [];
    }
  }

  async function loadProfile() {
    if (!getToken()) {
      setStatus('请先登录后再读取当前用户。', 'error');
      return;
    }
    setStatus('正在读取当前用户信息…');
    const data = await syncCurrentUser();
    if (!data) return;
    await loadStoredCookies();
    setStatus(
      `当前用户\nID：${data.id}\n学号：${data.student_id}\n昵称：${data.display_name || '未设置'}\n真实姓名：${data.real_name || '未采集'}`,
      'success',
    );
  }

  async function fetchOverviewRealtime(silent = false) {
    const token = getToken();
    if (!token) {
      appState.realtime.error = isEnglish() ? 'Not signed in. Cannot request overview data.' : '未登录，无法请求概览数据。';
      return;
    }
    appState.realtime.loading = true;
    appState.realtime.error = '';
    applyRealtimeToOverviewDom();
    const apiBase = getApiBase();
    try {
      const [healthResp, meResp, cookieResp] = await Promise.all([
        fetch(`${apiBase}/health`, { mode: 'cors' }),
        fetch(`${apiBase}/api/v1/me`, {
          mode: 'cors',
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${apiBase}/api/v1/me/cookies`, {
          mode: 'cors',
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const healthData = await parseJsonSafely(healthResp);
      const meData = await parseJsonSafely(meResp);
      const cookieData = await parseJsonSafely(cookieResp);
      if (!healthResp.ok) throw new Error(formatApiError(healthData.detail, `health 请求失败（${healthResp.status}）`));
      if (meResp.status === 401) {
        clearLocalAuth();
        setStatus('登录态已失效，请重新登录。', 'error');
        navigateTo('/login');
        return;
      }
      if (!meResp.ok) throw new Error(formatApiError(meData.detail, `me 请求失败（${meResp.status}）`));
      if (!cookieResp.ok) throw new Error(formatApiError(cookieData.detail, `cookies 请求失败（${cookieResp.status}）`));
      appState.realtime.health = healthData;
      appState.realtime.user = meData;
      appState.storedCookies = Array.isArray(cookieData) ? cookieData : [];
      appState.currentUser = meData;
      updateAccountDisplay();
      appState.realtime.updatedAt = new Date().toLocaleTimeString();
    } catch (error) {
      appState.realtime.error = isEnglish()
        ? `Realtime data fetch failed: ${error.message}`
        : `实时数据获取失败：${error.message}`;
    } finally {
      appState.realtime.loading = false;
      if (!silent) setStatus('概览实时数据已更新。', 'success');
      applyRealtimeToOverviewDom();
    }
  }

  async function restoreSavedSession() {
    updateAccountDisplay();
    if (!getToken()) return;
    const user = await syncCurrentUser({ silent: true });
    if (user) await loadStoredCookies();
    if (user) await syncSmartCampusProfile({ silent: true });
    if (user) setStatus(`已恢复登录态：${resolveNickname(user)}`, 'success');
  }

  return {
    onAvatarFileSelected,
    saveProfile,
    loadStoredCookies,
    loadProfile,
    fetchOverviewRealtime,
    restoreSavedSession,
  };
}
