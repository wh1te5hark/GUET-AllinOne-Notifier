export function createAuthFlow({
  appState,
  storageKeys,
  elements,
  setStatus,
  getToken,
  getApiBase,
  saveApiBase,
  parseJsonSafely,
  formatApiError,
  loginAccountManager,
  syncCurrentUser,
  syncSmartCampusProfile,
  navigateTo,
}) {
  let pendingChallenge = null;
  let pendingMethods = [];
  let wechatPollTimer = null;
  let pendingLoginContext = null;

  function set2faStatus(message, type = 'info') {
    if (!elements.twoFactorStatusEl) return;
    elements.twoFactorStatusEl.textContent = message;
    elements.twoFactorStatusEl.className = `two-factor-status visible ${type}`;
  }

  function clear2faStatus() {
    if (!elements.twoFactorStatusEl) return;
    elements.twoFactorStatusEl.textContent = '';
    elements.twoFactorStatusEl.className = 'two-factor-status';
  }

  function stopWechatPolling() {
    if (!wechatPollTimer) return;
    clearTimeout(wechatPollTimer);
    wechatPollTimer = null;
  }

  function updateMethodPanels() {
    const method = elements.twoFactorMethodField?.value || 'sms_code';
    if (elements.smsPanel) elements.smsPanel.style.display = method === 'sms_code' ? '' : 'none';
    if (elements.wechatPanel) elements.wechatPanel.style.display = method === 'wechat_qr' ? '' : 'none';
    if (method !== 'wechat_qr') stopWechatPolling();
  }

  function resetTwoFactorState() {
    pendingChallenge = null;
    pendingMethods = [];
    stopWechatPolling();
    if (elements.twoFactorCodeField) elements.twoFactorCodeField.value = '';
    if (elements.twoFactorMethodField) elements.twoFactorMethodField.value = 'sms_code';
    if (elements.wechatQrImg) {
      elements.wechatQrImg.style.display = 'none';
      elements.wechatQrImg.src = '';
    }
    if (elements.wechatQrOverlay) elements.wechatQrOverlay.style.display = 'none';
    clear2faStatus();
  }

  function closeTwoFactorDialog() {
    stopWechatPolling();
    if (elements.twoFactorDialog) elements.twoFactorDialog.open = false;
  }

  function openTwoFactorDialog(methods = []) {
    pendingMethods = methods;
    if (elements.twoFactorMethodField) {
      elements.twoFactorMethodField.value = methods.includes('sms_code') ? 'sms_code' : 'wechat_qr';
    }
    if (elements.twoFactorCodeField) elements.twoFactorCodeField.value = '';
    clear2faStatus();
    updateMethodPanels();
    if (elements.twoFactorDialog) elements.twoFactorDialog.open = true;
  }

  function handleLoginSuccess(data) {
    localStorage.setItem(storageKeys.token, data.access_token);
    appState.lastLoginResult = data;
    setStatus('登录成功，正在同步当前账号信息…', 'success');
    closeTwoFactorDialog();
    resetTwoFactorState();
    void syncCurrentUser({ silent: true }).then((user) => {
      void loginAccountManager.persistLoginContext(pendingLoginContext, user);
    });
    void syncSmartCampusProfile({ silent: true });
    navigateTo('/overview');
  }

  async function submitLoginWithPayload(payload, options = {}) {
    const apiBase = String(payload.api_base || '').trim().replace(/\/$/, '');
    if (!payload.student_id || !payload.password || !apiBase) {
      setStatus('请完整填写学号、密码和后端地址。', 'error');
      return;
    }
    const normalized = {
      student_id: String(payload.student_id || '').trim(),
      password: String(payload.password || ''),
      api_base: apiBase,
      remember_password: !!payload.remember_password,
      auto_login: !!payload.auto_login,
    };
    if (normalized.auto_login) normalized.remember_password = true;
    pendingLoginContext = normalized;
    localStorage.setItem(storageKeys.lastAccount, normalized.student_id);
    saveApiBase(apiBase);
    if (!options.silent) setStatus('正在请求 backend 登录接口，请稍候…');
    try {
      const response = await fetch(`${apiBase}/api/v1/auth/cas/login`, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: normalized.student_id, password: normalized.password }),
      });
      const data = await parseJsonSafely(response);
      if (!response.ok) throw new Error(formatApiError(data.detail, `登录失败（${response.status}）`));
      if (data.requires_2fa) {
        pendingChallenge = data.challenge_id;
        openTwoFactorDialog(data.available_2fa_methods || []);
        setStatus('检测到 CAS 需要二次验证，已弹出验证窗口。', 'muted');
        return;
      }
      handleLoginSuccess(data);
    } catch (error) {
      setStatus(options.fromAuto ? `自动登录失败：${error.message}` : `登录失败：${error.message}`, 'error');
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const submitButton = form.querySelector('mdui-button[type="submit"]');
    const formData = new FormData(form);
    if (submitButton) {
      submitButton.setAttribute('loading', '');
      submitButton.setAttribute('disabled', '');
    }
    try {
      await submitLoginWithPayload({
        student_id: formData.get('student_id'),
        password: formData.get('password'),
        api_base: formData.get('api_base'),
        remember_password: !!document.querySelector('#remember-password')?.checked,
        auto_login: !!document.querySelector('#auto-login')?.checked,
      });
    } finally {
      if (submitButton) {
        submitButton.removeAttribute('loading');
        submitButton.removeAttribute('disabled');
      }
    }
  }

  async function tryAutoLoginOnLoginPage() {
    if (appState.login.autoLoginTried || getToken()) return;
    const target = await loginAccountManager.getAutoLoginCandidate();
    if (!target) return;
    appState.login.autoLoginTried = true;
    await loginAccountManager.fillLoginFormByAccount(target.student_id);
    await submitLoginWithPayload(
      {
        student_id: target.student_id,
        password: target.password,
        api_base: target.api_base || 'http://127.0.0.1:8000',
        remember_password: true,
        auto_login: true,
      },
      { silent: true, fromAuto: true },
    );
  }

  async function initLoginEnhancements() {
    const select = document.querySelector('#recent-account-select');
    const rememberField = document.querySelector('#remember-password');
    const autoField = document.querySelector('#auto-login');
    const deleteCurrentButton = document.querySelector('#delete-recent-account-btn');
    const clearAllButton = document.querySelector('#clear-recent-accounts-btn');
    const preferredId = loginAccountManager.getPreferredRecentAccountId();
    if (select) {
      select.addEventListener('change', () => {
        const sid = select.value || '';
        if (sid) void loginAccountManager.fillLoginFormByAccount(sid);
      });
    }
    document.querySelectorAll('.recent-account-btn').forEach((button) => {
      button.addEventListener('click', () => {
        const sid = button.getAttribute('data-student-id');
        if (!sid) return;
        if (select) select.value = sid;
        void loginAccountManager.fillLoginFormByAccount(sid);
      });
    });
    rememberField?.addEventListener('change', () => {
      if (!rememberField.checked && autoField) autoField.checked = false;
    });
    autoField?.addEventListener('change', () => {
      if (autoField.checked && rememberField) rememberField.checked = true;
    });
    deleteCurrentButton?.addEventListener('click', () => {
      const sid = (select?.value || document.querySelector('#cas-login-form [name="student_id"]')?.value || '').trim();
      if (!sid) return setStatus('请选择要删除的历史账号。', 'error');
      if (!loginAccountManager.removeRecentAccountById(sid)) return setStatus(`历史账号 ${sid} 不存在。`, 'error');
      setStatus(`已删除历史账号：${sid}`, 'success');
      loginAccountManager.rerenderLoginPage();
    });
    clearAllButton?.addEventListener('click', () => {
      if (!appState.login.recentAccounts.length) return setStatus('当前没有可清空的历史账号。', 'muted');
      loginAccountManager.clearAllRecentAccounts();
      setStatus('已清空全部历史账号。', 'success');
      loginAccountManager.rerenderLoginPage();
    });
    if (preferredId) await loginAccountManager.fillLoginFormByAccount(preferredId);
    await tryAutoLoginOnLoginPage();
  }

  async function verifyTwoFactorCode() {
    const apiBase = getApiBase();
    const code = elements.twoFactorCodeField?.value?.trim() || '';
    if (!pendingChallenge) return set2faStatus('请先登录。', 'error');
    if (!code) return set2faStatus('请先输入验证码。', 'error');
    set2faStatus('正在提交验证码…', 'info');
    try {
      const response = await fetch(`${apiBase}/api/v1/auth/cas/2fa/verify`, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_id: pendingChallenge, code }),
      });
      const data = await parseJsonSafely(response);
      if (!response.ok) throw new Error(formatApiError(data.detail, `验证失败（${response.status}）`));
      handleLoginSuccess(data);
    } catch (error) {
      set2faStatus(`验证失败：${error.message}`, 'error');
    }
  }

  async function sendTwoFactorCode() {
    const apiBase = getApiBase();
    if (!pendingChallenge) return set2faStatus('请先登录。', 'error');
    if (!pendingMethods.includes('sms_code')) return set2faStatus('不支持短信验证码。', 'error');
    set2faStatus('正在发送短信验证码…', 'info');
    try {
      const response = await fetch(`${apiBase}/api/v1/auth/cas/2fa/sms/send`, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_id: pendingChallenge }),
      });
      const data = await parseJsonSafely(response);
      if (!response.ok) throw new Error(formatApiError(data.detail, `发送失败（${response.status}）`));
      set2faStatus(data.message || '验证码已发送。', 'success');
    } catch (error) {
      set2faStatus(`发送失败：${error.message}`, 'error');
    }
  }

  async function initiateWeChatQr() {
    const apiBase = getApiBase();
    if (!pendingChallenge) return set2faStatus('请先登录。', 'error');
    if (!pendingMethods.includes('wechat_qr')) return set2faStatus('不支持微信扫码。', 'error');
    set2faStatus('正在获取微信二维码…', 'info');
    if (elements.wechatQrImg) {
      elements.wechatQrImg.style.display = 'none';
      elements.wechatQrImg.src = '';
    }
    if (elements.wechatQrOverlay) elements.wechatQrOverlay.style.display = 'none';
    try {
      const response = await fetch(`${apiBase}/api/v1/auth/cas/2fa/wechat/init`, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_id: pendingChallenge }),
      });
      const data = await parseJsonSafely(response);
      if (!response.ok) throw new Error(formatApiError(data.detail, `获取失败（${response.status}）`));
      if (elements.wechatQrImg) {
        elements.wechatQrImg.src = data.qr_image_url;
        elements.wechatQrImg.style.display = 'block';
      }
      set2faStatus('请使用微信扫描下方二维码。', 'info');
      startWechatPolling();
    } catch (error) {
      set2faStatus(`获取二维码失败：${error.message}`, 'error');
    }
  }

  function startWechatPolling() {
    stopWechatPolling();
    void pollWechatStatus();
  }

  async function pollWechatStatus() {
    const apiBase = getApiBase();
    if (!pendingChallenge) return;
    try {
      const response = await fetch(`${apiBase}/api/v1/auth/cas/2fa/wechat/poll`, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_id: pendingChallenge }),
      });
      const data = await parseJsonSafely(response);
      if (!response.ok) return set2faStatus(`轮询失败：${formatApiError(data.detail, String(response.status))}`, 'error');
      const st = data.status;
      if (st === 'waiting') {
        wechatPollTimer = setTimeout(() => void pollWechatStatus(), 2000);
        return;
      }
      if (st === 'scanned') {
        set2faStatus('已扫码，请在手机上确认。', 'info');
        if (elements.wechatQrOverlay) {
          elements.wechatQrOverlay.textContent = '已扫码，请确认';
          elements.wechatQrOverlay.style.display = 'flex';
        }
        wechatPollTimer = setTimeout(() => void pollWechatStatus(), 1500);
        return;
      }
      if (st === 'confirmed' && data.login_result) return handleLoginSuccess(data.login_result);
      if (st === 'expired') return set2faStatus('二维码已过期，请重新获取。', 'error');
      if (st === 'cancelled') return set2faStatus('已取消，可重新获取二维码。', 'error');
      set2faStatus(data.message || '未知状态', 'error');
    } catch (error) {
      set2faStatus(`轮询异常：${error.message}`, 'error');
    }
  }

  return {
    set2faStatus,
    clear2faStatus,
    stopWechatPolling,
    updateMethodPanels,
    resetTwoFactorState,
    closeTwoFactorDialog,
    openTwoFactorDialog,
    handleLoginSuccess,
    submitLoginWithPayload,
    handleLogin,
    tryAutoLoginOnLoginPage,
    initLoginEnhancements,
    verifyTwoFactorCode,
    sendTwoFactorCode,
    initiateWeChatQr,
    startWechatPolling,
    pollWechatStatus,
  };
}
