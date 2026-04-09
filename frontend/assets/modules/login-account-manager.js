export function createLoginAccountManager({
  appState,
  storageKeys,
  getCurrentRoute,
  routeView,
  renderRoute,
  bindRouteEvents,
}) {
  function safeJsonParse(raw, fallback) {
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function toBase64(bytes) {
    let binary = '';
    bytes.forEach((b) => {
      binary += String.fromCharCode(b);
    });
    return btoa(binary);
  }

  function fromBase64(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  async function getLocalCryptoKey() {
    let keyBase64 = localStorage.getItem(storageKeys.cryptoKey);
    if (!keyBase64) {
      const raw = new Uint8Array(32);
      crypto.getRandomValues(raw);
      keyBase64 = toBase64(raw);
      localStorage.setItem(storageKeys.cryptoKey, keyBase64);
    }
    const rawBytes = fromBase64(keyBase64);
    return crypto.subtle.importKey('raw', rawBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  }

  async function encryptSecret(plainText) {
    if (!plainText) return '';
    const key = await getLocalCryptoKey();
    const iv = new Uint8Array(12);
    crypto.getRandomValues(iv);
    const encoded = new TextEncoder().encode(plainText);
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    return `${toBase64(iv)}.${toBase64(new Uint8Array(encrypted))}`;
  }

  async function decryptSecret(payload) {
    if (!payload) return '';
    const [ivBase64, dataBase64] = String(payload).split('.');
    if (!ivBase64 || !dataBase64) return '';
    try {
      const key = await getLocalCryptoKey();
      const iv = fromBase64(ivBase64);
      const encrypted = fromBase64(dataBase64);
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
      return new TextDecoder().decode(plain);
    } catch {
      return '';
    }
  }

  function loadRecentAccounts() {
    const list = safeJsonParse(localStorage.getItem(storageKeys.recentAccounts), []);
    if (!Array.isArray(list)) return [];
    return list
      .filter((item) => item && typeof item.student_id === 'string')
      .map((item) => ({
        student_id: String(item.student_id || '').trim(),
        api_base: String(item.api_base || 'http://127.0.0.1:8000').trim() || 'http://127.0.0.1:8000',
        display_name: String(item.display_name || '').trim(),
        password_cipher: String(item.password_cipher || ''),
        remember_password: !!item.remember_password,
        auto_login: !!item.auto_login,
        last_login_at: Number(item.last_login_at || Date.now()),
      }))
      .filter((item) => item.student_id);
  }

  function saveRecentAccounts(accounts) {
    const trimmed = (accounts || []).slice(0, 8);
    appState.login.recentAccounts = trimmed;
    localStorage.setItem(storageKeys.recentAccounts, JSON.stringify(trimmed));
  }

  function initRecentAccounts() {
    appState.login.recentAccounts = loadRecentAccounts();
  }

  function getPreferredRecentAccountId() {
    const latest = localStorage.getItem(storageKeys.lastAccount) || '';
    if (latest && appState.login.recentAccounts.some((x) => x.student_id === latest)) return latest;
    return appState.login.recentAccounts[0]?.student_id || '';
  }

  function getRecentAccountById(studentId) {
    return appState.login.recentAccounts.find((item) => item.student_id === studentId);
  }

  async function fillLoginFormByAccount(studentId) {
    const account = getRecentAccountById(studentId);
    if (!account) return;
    const studentField = document.querySelector('#cas-login-form [name="student_id"]');
    const passwordField = document.querySelector('#cas-login-form [name="password"]');
    const apiBaseField = document.querySelector('#cas-login-form [name="api_base"]');
    const rememberField = document.querySelector('#remember-password');
    const autoField = document.querySelector('#auto-login');
    if (studentField) studentField.value = account.student_id;
    if (apiBaseField) apiBaseField.value = account.api_base || 'http://127.0.0.1:8000';
    if (rememberField) rememberField.checked = !!account.remember_password;
    if (autoField) autoField.checked = !!account.auto_login;
    if (passwordField) {
      passwordField.value = account.remember_password ? await decryptSecret(account.password_cipher) : '';
    }
    localStorage.setItem(storageKeys.lastAccount, account.student_id);
  }

  async function persistLoginContext(context, currentUser = null) {
    if (!context?.student_id) return;
    const base = appState.login.recentAccounts.filter((x) => x.student_id !== context.student_id);
    const record = {
      student_id: context.student_id,
      api_base: context.api_base || 'http://127.0.0.1:8000',
      display_name: currentUser?.display_name || currentUser?.real_name || '',
      remember_password: !!context.remember_password,
      auto_login: !!context.auto_login,
      password_cipher: '',
      last_login_at: Date.now(),
    };
    if (record.remember_password && context.password) {
      record.password_cipher = await encryptSecret(context.password);
    }
    const normalized = [record, ...base].slice(0, 8).map((item, idx) => ({
      ...item,
      auto_login: idx === 0 ? record.auto_login : (item.auto_login && !record.auto_login),
    }));
    saveRecentAccounts(normalized);
    localStorage.setItem(storageKeys.lastAccount, context.student_id);
  }

  function renderRecentAccountOptions() {
    if (!appState.login.recentAccounts.length) {
      return '<mdui-menu-item value="">暂无历史账号</mdui-menu-item>';
    }
    return appState.login.recentAccounts
      .map((item) => `<mdui-menu-item value="${item.student_id}">${item.student_id}</mdui-menu-item>`)
      .join('');
  }

  function renderRecentAccountQuickSwitch() {
    if (!appState.login.recentAccounts.length) {
      return '<span class="panel-desc">暂无历史账号，登录后将自动记录。</span>';
    }
    return appState.login.recentAccounts
      .slice(0, 4)
      .map(
        (item) => `<button type="button" class="recent-account-btn" data-student-id="${item.student_id}">
        ${item.display_name ? `${item.display_name}（${item.student_id}）` : item.student_id}
      </button>`,
      )
      .join('');
  }

  function removeRecentAccountById(studentId) {
    if (!studentId) return false;
    const remained = appState.login.recentAccounts.filter((item) => item.student_id !== studentId);
    if (remained.length === appState.login.recentAccounts.length) return false;
    saveRecentAccounts(remained);
    if (localStorage.getItem(storageKeys.lastAccount) === studentId) {
      if (remained[0]?.student_id) localStorage.setItem(storageKeys.lastAccount, remained[0].student_id);
      else localStorage.removeItem(storageKeys.lastAccount);
    }
    return true;
  }

  function clearAllRecentAccounts() {
    saveRecentAccounts([]);
    localStorage.removeItem(storageKeys.lastAccount);
  }

  function rerenderLoginPage() {
    if (getCurrentRoute() !== '/login') return;
    routeView.innerHTML = renderRoute('/login');
    bindRouteEvents('/login');
  }

  async function getAutoLoginCandidate() {
    const target = appState.login.recentAccounts.find((item) => item.auto_login && item.password_cipher);
    if (!target) return null;
    const password = await decryptSecret(target.password_cipher);
    if (!password) return null;
    return {
      student_id: target.student_id,
      password,
      api_base: target.api_base || 'http://127.0.0.1:8000',
    };
  }

  return {
    initRecentAccounts,
    getPreferredRecentAccountId,
    fillLoginFormByAccount,
    persistLoginContext,
    renderRecentAccountOptions,
    renderRecentAccountQuickSwitch,
    removeRecentAccountById,
    clearAllRecentAccounts,
    rerenderLoginPage,
    getAutoLoginCandidate,
  };
}
