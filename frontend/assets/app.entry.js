import { createLoginAccountManager } from './modules/login-account-manager.js';
import { createRenderers } from './modules/renderers.js';
import { createSmartCampusManager } from './modules/smart-campus-manager.js';
import { createAuthFlow } from './modules/auth-flow.js';
import { createProfileSessionManager } from './modules/profile-session-manager.js';
import { createUiManager } from './modules/ui-manager.js';
import { createRouteController } from './modules/route-controller.js';
import { createAppBootstrap } from './modules/app-bootstrap.js';
import { createI18nManager } from './modules/i18n-manager.js';

const timelineData = [
  { source: '教务处', time: '刚刚', title: '考试安排已更新', detail: '离散数学期末考试从周三晚改到周四下午。' },
  { source: '畅课', time: '16 分钟前', title: '新作业发布', detail: '《软件工程》新增实验报告。' },
  { source: '宿舍电费', time: '1 小时前', title: '余额低于阈值', detail: '当前余额 12.4 元，阈值为 15 元。' },
];

const storageKeys = {
  token: 'guet-notifier-access-token',
  apiBase: 'guet-notifier-api-base',
  themeMode: 'guet-notifier-theme-mode',
  recentAccounts: 'guet-notifier-recent-accounts',
  lastAccount: 'guet-notifier-last-account',
  cryptoKey: 'guet-notifier-crypto-key',
  customColors: 'guet-notifier-custom-colors',
  fontSize: 'guet-notifier-font-size',
  language: 'guet_notifier_language',
};

const appState = {
  currentRoute: '/home',
  lastStatus: { message: '尚未发起登录。', type: 'muted' },
  lastLoginResult: null,
  storedCookies: [],
  currentUser: null,
  realtime: { user: null, health: null, updatedAt: '', loading: false, error: '' },
  smartCampus: {
    messages: [],
    loading: false,
    error: '',
    updatedAt: '',
    setting: {
      enabled: true,
      schedule_mode: 'visual',
      cron_expr: '*/30 * * * *',
      visual_mode: 'every_n_minutes',
      interval_minutes: 30,
      daily_time: '08:00',
    },
    query: { q: '', sender: '', read_state: 'all', sort_by: 'fetched_at', sort_dir: 'desc' },
  },
  login: { recentAccounts: [], autoLoginTried: false },
};

const elements = {
  drawer: document.querySelector('#nav-drawer'),
  menuToggle: document.querySelector('#menu-toggle'),
  themeToggle: document.querySelector('#theme-toggle'),
  themeModeAutoButton: document.querySelector('#theme-mode-auto'),
  themeModeLightButton: document.querySelector('#theme-mode-light'),
  themeModeDarkButton: document.querySelector('#theme-mode-dark'),
  routeView: document.querySelector('#route-view'),
  topAccount: document.querySelector('#top-account'),
  drawerAccount: document.querySelector('#drawer-account'),
  drawerDisplayName: document.querySelector('#drawer-display-name'),
  drawerAvatarImg: document.querySelector('#drawer-avatar-img'),
  drawerAvatarFallback: document.querySelector('#drawer-avatar-fallback'),
  drawerLogoutButton: document.querySelector('#drawer-logout-btn'),
  drawerUserActions: document.querySelector('.drawer-user-actions'),
  drawerRouteItems: document.querySelectorAll('#nav-drawer mdui-list-item[href^="#/"]'),
  topAvatarTrigger: document.querySelector('#top-avatar-trigger'),
  topAvatarPanel: document.querySelector('#top-avatar-panel'),
  topAvatarImg: document.querySelector('#top-avatar-img'),
  topAvatarFallback: document.querySelector('#top-avatar-fallback'),
  topAvatarName: document.querySelector('#top-avatar-name'),
  menuProfileButton: document.querySelector('#menu-profile-btn'),
  menuLogoutButton: document.querySelector('#menu-logout-btn'),
  twoFactorDialog: document.querySelector('#two-factor-dialog'),
  verify2faButton: document.querySelector('#verify-2fa-btn'),
  send2faCodeButton: document.querySelector('#send-2fa-code-btn'),
  openWeChat2faButton: document.querySelector('#open-wechat-2fa-btn'),
  close2faDialogButton: document.querySelector('#close-2fa-dialog-btn'),
  twoFactorCodeField: document.querySelector('#two-factor-code-field'),
  twoFactorMethodField: document.querySelector('#two-factor-method-field'),
  twoFactorStatusEl: document.querySelector('#two-factor-status'),
  smsPanel: document.querySelector('#sms-panel'),
  wechatPanel: document.querySelector('#wechat-panel'),
  wechatQrImg: document.querySelector('#wechat-qr-img'),
  wechatQrOverlay: document.querySelector('#wechat-qr-overlay'),
  colorPrimaryInput: document.querySelector('#color-primary'),
  colorAccentInput: document.querySelector('#color-accent'),
  colorDangerInput: document.querySelector('#color-danger'),
  presetColorsContainer: document.querySelector('#preset-colors'),
  resetColorsButton: document.querySelector('#reset-colors-btn'),
  saveColorsButton: document.querySelector('#save-colors-btn'),
  fontSizeSmallBtn: document.querySelector('#font-size-sm'),
  fontSizeBaseBtn: document.querySelector('#font-size-base'),
  fontSizeLargeBtn: document.querySelector('#font-size-lg'),
  preferencesToggle: document.querySelector('#preferences-toggle'),
  preferencesPanel: document.querySelector('#preferences-panel'),
};

const themeColors = { light: '#1662c4', dark: '#6e9bff' };
let routeController = null;

function debounce(func, wait) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

function getToken() {
  return localStorage.getItem(storageKeys.token) || '';
}

function getApiBase() {
  const formValue = document.querySelector('#cas-login-form [name="api_base"]')?.value?.trim();
  return (formValue || localStorage.getItem(storageKeys.apiBase) || 'http://127.0.0.1:8000').replace(/\/$/, '');
}

function saveApiBase(apiBase) {
  localStorage.setItem(storageKeys.apiBase, apiBase);
}

async function parseJsonSafely(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { detail: text };
  }
}

function formatApiError(detail, fallback = '请求失败|ApiError') {
  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail[0]?.msg || JSON.stringify(detail);
  if (typeof detail === 'object') return detail.msg || JSON.stringify(detail);
  return String(detail);
}

function formatCookies(cookies) {
  if (!cookies || cookies.length === 0) return '';
  return cookies.map((c) => `  ${c.name}=${c.value} (${c.domain})`).join('\n');
}

function formatCookiesForLogin(cookies) {
  if (!cookies || cookies.length === 0) return '';
  return cookies
    .map((c) => `${String(c.name || '').trim()}=${String(c.value || '').trim()}`)
    .filter((pair) => pair !== '=')
    .join('; ');
}

async function copyCurrentCookies() {
  const cookiePayload = appState.lastLoginResult?.cas_cookies?.length
    ? appState.lastLoginResult.cas_cookies
    : appState.storedCookies?.length
      ? appState.storedCookies
      : [];
  const loginReady = formatCookiesForLogin(cookiePayload);
  if (!loginReady) {
    setStatus('当前没有可复制的 Cookies。', 'muted');
    return;
  }
  try {
    await navigator.clipboard.writeText(loginReady);
    setStatus('Cookies 已复制到剪贴板。', 'success');
  } catch {
    setStatus('复制失败，请手动复制。', 'error');
  }
}

function resolveNickname(user) {
  const lang = localStorage.getItem(storageKeys.language) || 'zh';
  const notLoggedIn = lang === 'en' ? 'Not signed in' : '未登录';
  if (!user) return notLoggedIn;
  return String(user.display_name || '').trim()
    || String(user.real_name || '').trim()
    || String(user.student_id || '').trim()
    || notLoggedIn;
}

function updateActiveRouteInDrawer(route) {
  elements.drawerRouteItems.forEach((node) => {
    const target = node.getAttribute('href')?.replace(/^#/, '') || '';
    node.classList.toggle('route-active', target === route);
  });
}

function updateAccountDisplay() {
  const user = appState.currentUser;
  const label = resolveNickname(user);
  const lang = localStorage.getItem(storageKeys.language) || 'zh';
  const student = user?.student_id || '--';
  const avatar = user?.avatar_base64 || '';
  if (elements.topAccount) elements.topAccount.textContent = label;
  if (elements.drawerDisplayName) elements.drawerDisplayName.textContent = label;
  if (elements.drawerAccount) elements.drawerAccount.textContent = lang === 'en' ? `Current account: ${student}` : `当前账号：${student}`;
  if (elements.drawerUserActions) elements.drawerUserActions.style.display = user ? '' : 'none';
  if (elements.topAvatarName) elements.topAvatarName.textContent = user ? `${label} (${user.student_id || ''})` : (lang === 'en' ? 'Not signed in' : '未登录');

  if (elements.topAvatarImg && elements.topAvatarFallback) {
    if (avatar) {
      elements.topAvatarImg.src = avatar;
      elements.topAvatarImg.style.display = '';
      elements.topAvatarFallback.style.display = 'none';
    } else {
      elements.topAvatarImg.src = '';
      elements.topAvatarImg.style.display = 'none';
      elements.topAvatarFallback.style.display = '';
      elements.topAvatarFallback.textContent = (label || 'G').trim().slice(0, 1).toUpperCase();
    }
  }
  if (elements.drawerAvatarImg && elements.drawerAvatarFallback) {
    if (avatar) {
      elements.drawerAvatarImg.src = avatar;
      elements.drawerAvatarImg.style.display = '';
      elements.drawerAvatarFallback.style.display = 'none';
    } else {
      elements.drawerAvatarImg.src = '';
      elements.drawerAvatarImg.style.display = 'none';
      elements.drawerAvatarFallback.style.display = '';
      elements.drawerAvatarFallback.textContent = (label || 'G').trim().slice(0, 1).toUpperCase();
    }
  }
}

function applyStatusToPage() {
  const statusNode = document.querySelector('#login-status');
  if (!statusNode) return;
  statusNode.className = `result-card ${appState.lastStatus.type}`;
  statusNode.textContent = appState.lastStatus.message;
}

function translateStatusMessage(message) {
  const lang = localStorage.getItem(storageKeys.language) || 'zh';
  if (lang !== 'en') return String(message || '');
  return String(message || '')
    .replace('尚未发起登录。', 'No login request sent yet.')
    .replace('概览实时数据已更新。', 'Overview realtime data refreshed.')
    .replace('颜色保存成功！', 'Colors saved successfully.')
    .replace('已登出，可重新登录或切换账号。', 'Logged out. You can sign in again or switch accounts.')
    .replace('登录成功，当前账号信息同步完毕。', 'Login succeeded. Account info sync completed.')
    .replace('当前没有可复制的 Cookies。', 'No cookies available to copy.')
    .replace('Cookies 已复制到剪贴板。', 'Cookies copied to clipboard.')
    .replace('复制失败，请手动复制。', 'Copy failed. Please copy manually.');
}

function setStatus(message, type = 'muted') {
  appState.lastStatus = { message: translateStatusMessage(message), type };
  applyStatusToPage();
}

function clearLocalAuth() {
  localStorage.removeItem(storageKeys.token);
  appState.currentUser = null;
  appState.lastLoginResult = null;
  appState.storedCookies = [];
  appState.smartCampus.messages = [];
  appState.smartCampus.error = '';
  appState.smartCampus.updatedAt = '';
  if (elements.topAvatarPanel) elements.topAvatarPanel.hidden = true;
  updateAccountDisplay();
}

async function syncCurrentUser({ silent = false } = {}) {
  const token = getToken();
  if (!token) {
    appState.currentUser = null;
    updateAccountDisplay();
    if (!silent) setStatus('请先登录后再读取当前用户。', 'error');
    return null;
  }
  try {
    const response = await fetch(`${getApiBase()}/api/v1/me`, {
      mode: 'cors',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await parseJsonSafely(response);
    if (!response.ok) throw new Error(formatApiError(data.detail, `认证失效（${response.status}）`));
    appState.currentUser = data;
    appState.realtime.user = data;
    updateAccountDisplay();
    return data;
  } catch (error) {
    clearLocalAuth();
    if (!silent) setStatus(`登录态失效：${error.message}，请重新登录。`, 'error');
    return null;
  }
}

const loginAccountManager = createLoginAccountManager({
  appState,
  storageKeys,
  getCurrentRoute: () => appState.currentRoute,
  rerenderRoute: (route) => routeController?.rerenderRoute(route),
});

const renderers = createRenderers({ appState, timelineData, storageKeys, formatCookies });

const smartCampusManager = createSmartCampusManager({
  appState,
  getToken,
  getApiBase,
  parseJsonSafely,
  formatApiError,
  setStatus,
  updateAccountDisplay,
  applyRealtimeToOverviewDom: () => renderers.applyRealtimeToOverviewDom(),
  applySmartCampusToDom: () => renderers.applySmartCampusToDom(),
  rerenderCollectorsPage: () => routeController?.rerenderRoute('/collectors'),
});

const authFlow = createAuthFlow({
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
  syncSmartCampusProfile: (options) => smartCampusManager.syncSmartCampusProfile(options),
  navigateTo: (route) => routeController?.navigateTo(route),
});

const profileSessionManager = createProfileSessionManager({
  appState,
  getToken,
  getApiBase,
  parseJsonSafely,
  formatApiError,
  setStatus,
  syncCurrentUser,
  syncSmartCampusProfile: (options) => smartCampusManager.syncSmartCampusProfile(options),
  clearLocalAuth,
  navigateTo: (route) => routeController?.navigateTo(route),
  updateAccountDisplay,
  applyRealtimeToOverviewDom: () => renderers.applyRealtimeToOverviewDom(),
  resolveNickname,
});

const uiManager = createUiManager({
  storageKeys,
  themeColors,
  elements,
  navigateTo: (route) => routeController?.navigateTo(route),
  clearLocalAuth,
  setStatus,
});

const i18nManager = createI18nManager({
  appState,
  storageKey: storageKeys.language,
  defaultLanguage: 'zh',
  setStatus,
  rerenderCurrentRoute: () => routeController?.rerenderRoute(appState.currentRoute),
});

const colorManager = {
  defaultColors: { primary: '#1e40af', accent: '#0284c7', danger: '#dc2626' },
  getColors() {
    try {
      const raw = localStorage.getItem(storageKeys.customColors);
      return raw ? { ...this.defaultColors, ...JSON.parse(raw) } : { ...this.defaultColors };
    } catch {
      return { ...this.defaultColors };
    }
  },
  applyColors(colors) {
    document.documentElement.style.setProperty('--guet-primary', colors.primary);
    document.documentElement.style.setProperty('--guet-accent', colors.accent);
    document.documentElement.style.setProperty('--guet-danger', colors.danger);
    if (elements.colorPrimaryInput) elements.colorPrimaryInput.value = colors.primary;
    if (elements.colorAccentInput) elements.colorAccentInput.value = colors.accent;
    if (elements.colorDangerInput) elements.colorDangerInput.value = colors.danger;
  },
  saveColors(colors) {
    localStorage.setItem(storageKeys.customColors, JSON.stringify(colors));
  },
  init() {
    const live = this.getColors();
    this.applyColors(live);
    elements.colorPrimaryInput?.addEventListener('input', (event) => {
      live.primary = event.target.value;
      this.applyColors(live);
    });
    elements.colorAccentInput?.addEventListener('input', (event) => {
      live.accent = event.target.value;
      this.applyColors(live);
    });
    elements.colorDangerInput?.addEventListener('input', (event) => {
      live.danger = event.target.value;
      this.applyColors(live);
    });
    elements.presetColorsContainer?.addEventListener('click', (event) => {
      const target = event.target.closest('.preset-color');
      if (!target) return;
      const color = target.dataset.color;
      if (!color) return;
      live.primary = color;
      this.applyColors(live);
    });
    elements.resetColorsButton?.addEventListener('click', () => {
      Object.assign(live, this.defaultColors);
      this.applyColors(live);
      this.saveColors(live);
    });
    elements.saveColorsButton?.addEventListener('click', () => {
      this.saveColors(live);
      setStatus('颜色保存成功！', 'success');
    });
  },
};

const fontSizeManager = {
  getSize() {
    return localStorage.getItem(storageKeys.fontSize) || 'base';
  },
  sizeConfig: {
    sm: { root: '14px', scale: '0.875rem' },
    base: { root: '16px', scale: '1rem' },
    lg: { root: '18px', scale: '1.125rem' },
  },
  applySize(size) {
    const normalized = size === 'sm' || size === 'lg' ? size : 'base';
    elements.fontSizeSmallBtn?.setAttribute('variant', 'outlined');
    elements.fontSizeBaseBtn?.setAttribute('variant', 'outlined');
    elements.fontSizeLargeBtn?.setAttribute('variant', 'outlined');
    if (normalized === 'sm') {
      elements.fontSizeSmallBtn?.setAttribute('variant', 'filled');
    } else if (normalized === 'lg') {
      elements.fontSizeLargeBtn?.setAttribute('variant', 'filled');
    } else {
      elements.fontSizeBaseBtn?.setAttribute('variant', 'filled');
    }
    const config = this.sizeConfig[normalized];
    // Update both root font-size (for rem-based styles) and legacy custom variable.
    document.documentElement.style.fontSize = config.root;
    document.documentElement.style.setProperty('--guet-font-size-base', config.scale);
  },
  init() {
    this.applySize(this.getSize());
    elements.fontSizeSmallBtn?.addEventListener('click', () => {
      this.applySize('sm');
      localStorage.setItem(storageKeys.fontSize, 'sm');
    });
    elements.fontSizeBaseBtn?.addEventListener('click', () => {
      this.applySize('base');
      localStorage.setItem(storageKeys.fontSize, 'base');
    });
    elements.fontSizeLargeBtn?.addEventListener('click', () => {
      this.applySize('lg');
      localStorage.setItem(storageKeys.fontSize, 'lg');
    });
  },
};

routeController = createRouteController({
  appState,
  routeView: elements.routeView,
  renderRoute: (route) => renderers.renderRoute(route),
  updateActiveRouteInDrawer,
  onAfterRouteRender: () => i18nManager.applyLanguage(i18nManager.getLanguage()),
  handlers: {
    debounce,
    applyStatusToPage,
    handleLogin: authFlow.handleLogin,
    handleCookieLogin: authFlow.handleCookieLogin,
    initLoginEnhancements: authFlow.initLoginEnhancements,
    loadProfile: profileSessionManager.loadProfile,
    fetchOverviewRealtime: profileSessionManager.fetchOverviewRealtime,
    onAvatarFileSelected: profileSessionManager.onAvatarFileSelected,
    saveProfile: profileSessionManager.saveProfile,
    renderTimeline: renderers.renderTimeline,
    toggleSmartCampusScheduleMode: smartCampusManager.toggleSmartCampusScheduleMode,
    saveSmartCampusSettings: smartCampusManager.saveSmartCampusSettings,
    applySmartCampusQuery: smartCampusManager.applySmartCampusQuery,
    resetSmartCampusQuery: smartCampusManager.resetSmartCampusQuery,
    syncSmartCampusMessages: smartCampusManager.syncSmartCampusMessages,
    loadSmartCampusMessages: smartCampusManager.loadSmartCampusMessages,
    loadSmartCampusSettings: smartCampusManager.loadSmartCampusSettings,
    applyRealtimeToOverviewDom: renderers.applyRealtimeToOverviewDom,
    applySmartCampusToDom: renderers.applySmartCampusToDom,
    copyCurrentCookies,
    getNoFileSelectedText: () => i18nManager.t('noFileSelected', '未选择文件'),
  },
});

const bootstrap = createAppBootstrap({
  routeController,
  uiManager,
  loginAccountManager,
  authFlow,
  profileSessionManager,
  updateAccountDisplay,
  // 功能有故障：暂时停用自定义颜色初始化逻辑
  initColorSystem: () => {},
  initFontSize: () => fontSizeManager.init(),
  initI18n: () => i18nManager.init(),
  preferences: {
    toggleButton: elements.preferencesToggle,
    panel: elements.preferencesPanel,
  },
  twoFactorElements: {
    twoFactorMethodField: elements.twoFactorMethodField,
    verify2faButton: elements.verify2faButton,
    send2faCodeButton: elements.send2faCodeButton,
    openWeChat2faButton: elements.openWeChat2faButton,
    close2faDialogButton: elements.close2faDialogButton,
  },
});

void bootstrap.init();
