import { createLoginAccountManager } from './modules/login-account-manager.js';
import { createRenderers } from './modules/renderers.js';
import { createSmartCampusManager } from './modules/smart-campus-manager.js';
import { createAuthFlow } from './modules/auth-flow.js';
import { createProfileSessionManager } from './modules/profile-session-manager.js';
import { createUiManager } from './modules/ui-manager.js';

const timelineData = [
  { source: '教务处', time: '刚刚', title: '考试安排已更新', detail: '离散数学期末考试从周三晚改到周四下午。' },
  { source: '畅课', time: '16 分钟前', title: '新作业发布', detail: '《软件工程》新增实验报告。' },
  { source: '宿舍电费', time: '1 小时前', title: '余额低于阈值', detail: '当前余额 12.4 元，阈值为 15 元。' },
];

const drawer = document.querySelector('#nav-drawer');
const menuToggle = document.querySelector('#menu-toggle');
const themeToggle = document.querySelector('#theme-toggle');
const themeModeAutoButton = document.querySelector('#theme-mode-auto');
const themeModeLightButton = document.querySelector('#theme-mode-light');
const themeModeDarkButton = document.querySelector('#theme-mode-dark');
const routeView = document.querySelector('#route-view');
const topAccount = document.querySelector('#top-account');
const drawerAccount = document.querySelector('#drawer-account');
const drawerDisplayName = document.querySelector('#drawer-display-name');
const drawerAvatarImg = document.querySelector('#drawer-avatar-img');
const drawerAvatarFallback = document.querySelector('#drawer-avatar-fallback');
const drawerLogoutButton = document.querySelector('#drawer-logout-btn');
const drawerUserActions = document.querySelector('.drawer-user-actions');
const topAvatarTrigger = document.querySelector('#top-avatar-trigger');
const topAvatarPanel = document.querySelector('#top-avatar-panel');
const topAvatarImg = document.querySelector('#top-avatar-img');
const topAvatarFallback = document.querySelector('#top-avatar-fallback');
const topAvatarName = document.querySelector('#top-avatar-name');
const menuProfileButton = document.querySelector('#menu-profile-btn');
const menuLogoutButton = document.querySelector('#menu-logout-btn');

const twoFactorDialog = document.querySelector('#two-factor-dialog');
const verify2faButton = document.querySelector('#verify-2fa-btn');
const send2faCodeButton = document.querySelector('#send-2fa-code-btn');
const openWeChat2faButton = document.querySelector('#open-wechat-2fa-btn');
const close2faDialogButton = document.querySelector('#close-2fa-dialog-btn');
const twoFactorCodeField = document.querySelector('#two-factor-code-field');
const twoFactorMethodField = document.querySelector('#two-factor-method-field');
const twoFactorStatusEl = document.querySelector('#two-factor-status');
const smsPanel = document.querySelector('#sms-panel');
const wechatPanel = document.querySelector('#wechat-panel');
const wechatQrImg = document.querySelector('#wechat-qr-img');
const wechatQrOverlay = document.querySelector('#wechat-qr-overlay');

const storageKeys = {
  token: 'guet-notifier-access-token',
  apiBase: 'guet-notifier-api-base',
  themeMode: 'guet-notifier-theme-mode',
  recentAccounts: 'guet-notifier-recent-accounts',
  lastAccount: 'guet-notifier-last-account',
  cryptoKey: 'guet-notifier-crypto-key',
};
const themeColors = { light: '#1662c4', dark: '#6e9bff' };

const appState = {
  currentRoute: '/home',
  lastStatus: { message: '尚未发起登录。', type: 'muted' },
  lastLoginResult: null,
  storedCookies: [],
  currentUser: null,
  realtime: {
    user: null,
    health: null,
    updatedAt: '',
    loading: false,
    error: '',
  },
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
    query: {
      q: '',
      sender: '',
      read_state: 'all',
      sort_by: 'fetched_at',
      sort_dir: 'desc',
    },
  },
  login: {
    recentAccounts: [],
    autoLoginTried: false,
  },
};

const loginAccountManager = createLoginAccountManager({
  appState,
  storageKeys,
  getCurrentRoute: () => appState.currentRoute,
  routeView,
  renderRoute: (route) => renderRoute(route),
  bindRouteEvents: (route) => bindRouteEvents(route),
});

const renderers = createRenderers({
  appState,
  timelineData,
  storageKeys,
  formatCookies: (...args) => formatCookies(...args),
  loginAccountManager,
});

const smartCampusManager = createSmartCampusManager({
  appState,
  getToken: () => getToken(),
  getApiBase: () => getApiBase(),
  parseJsonSafely: (...args) => parseJsonSafely(...args),
  formatApiError: (...args) => formatApiError(...args),
  setStatus: (...args) => setStatus(...args),
  updateAccountDisplay: () => updateAccountDisplay(),
  applyRealtimeToOverviewDom: () => applyRealtimeToOverviewDom(),
  applySmartCampusToDom: () => applySmartCampusToDom(),
  rerenderCollectorsPage: () => {
    routeView.innerHTML = renderRoute('/collectors');
    bindRouteEvents('/collectors');
  },
});

const authFlow = createAuthFlow({
  appState,
  storageKeys,
  elements: {
    twoFactorDialog,
    twoFactorCodeField,
    twoFactorMethodField,
    twoFactorStatusEl,
    smsPanel,
    wechatPanel,
    wechatQrImg,
    wechatQrOverlay,
  },
  setStatus: (...args) => setStatus(...args),
  getToken: () => getToken(),
  getApiBase: () => getApiBase(),
  saveApiBase: (apiBase) => saveApiBase(apiBase),
  parseJsonSafely: (...args) => parseJsonSafely(...args),
  formatApiError: (...args) => formatApiError(...args),
  loginAccountManager,
  syncCurrentUser: (...args) => syncCurrentUser(...args),
  syncSmartCampusProfile: (...args) => syncSmartCampusProfile(...args),
  navigateTo: (route) => navigateTo(route),
});

const profileSessionManager = createProfileSessionManager({
  appState,
  getToken: () => getToken(),
  getApiBase: () => getApiBase(),
  parseJsonSafely: (...args) => parseJsonSafely(...args),
  formatApiError: (...args) => formatApiError(...args),
  setStatus: (...args) => setStatus(...args),
  syncCurrentUser: (...args) => syncCurrentUser(...args),
  syncSmartCampusProfile: (...args) => syncSmartCampusProfile(...args),
  clearLocalAuth: () => clearLocalAuth(),
  navigateTo: (route) => navigateTo(route),
  updateAccountDisplay: () => updateAccountDisplay(),
  applyRealtimeToOverviewDom: () => applyRealtimeToOverviewDom(),
  resolveNickname: (user) => resolveNickname(user),
});

const uiManager = createUiManager({
  storageKeys,
  themeColors,
  elements: {
    drawer,
    menuToggle,
    themeToggle,
    themeModeAutoButton,
    themeModeLightButton,
    themeModeDarkButton,
    topAvatarTrigger,
    topAvatarPanel,
    menuProfileButton,
    menuLogoutButton,
    drawerLogoutButton,
  },
  navigateTo: (route) => navigateTo(route),
  clearLocalAuth: () => clearLocalAuth(),
  setStatus: (...args) => setStatus(...args),
});

function resolveNickname(user) {
  if (!user) return '未登录';
  return String(user.display_name || '').trim()
    || String(user.real_name || '').trim()
    || String(user.student_id || '').trim()
    || '未登录';
}

function getRouteFromHash() {
  const raw = window.location.hash.replace(/^#/, '');
  if (!raw || raw === '/') return '/home';
  return raw.startsWith('/') ? raw : '/home';
}

function navigateTo(route) {
  window.location.hash = `#${route}`;
}

function updateActiveRouteInDrawer(route) {
  drawer?.querySelectorAll('mdui-list-item[href^="#/"]').forEach((node) => {
    const target = node.getAttribute('href')?.replace(/^#/, '') || '';
    node.classList.toggle('route-active', target === route);
  });
}

function updateAccountDisplay() {
  const user = appState.currentUser;
  const label = resolveNickname(user);
  const student = user?.student_id || '--';
  const avatar = user?.avatar_base64 || '';
  if (topAccount) topAccount.textContent = label;
  if (drawerDisplayName) drawerDisplayName.textContent = label;
  if (drawerAccount) drawerAccount.textContent = `当前账号：${student}`;
  if (drawerUserActions) drawerUserActions.style.display = user ? '' : 'none';
  if (topAvatarName) topAvatarName.textContent = user ? `${label} (${user.student_id || ''})` : '未登录';
  if (topAvatarImg && topAvatarFallback) {
    if (avatar) {
      topAvatarImg.src = avatar;
      topAvatarImg.style.display = '';
      topAvatarFallback.style.display = 'none';
    } else {
      topAvatarImg.src = '';
      topAvatarImg.style.display = 'none';
      topAvatarFallback.style.display = '';
      topAvatarFallback.textContent = (label || 'G').trim().slice(0, 1).toUpperCase();
    }
  }
  if (drawerAvatarImg && drawerAvatarFallback) {
    if (avatar) {
      drawerAvatarImg.src = avatar;
      drawerAvatarImg.style.display = '';
      drawerAvatarFallback.style.display = 'none';
    } else {
      drawerAvatarImg.src = '';
      drawerAvatarImg.style.display = 'none';
      drawerAvatarFallback.style.display = '';
      drawerAvatarFallback.textContent = (label || 'G').trim().slice(0, 1).toUpperCase();
    }
  }
}

function getToken() {
  return localStorage.getItem(storageKeys.token) || '';
}

function getApiBase() {
  const field = document.querySelector('#cas-login-form [name="api_base"]');
  if (field?.value.trim()) return field.value.trim().replace(/\/$/, '');
  return (localStorage.getItem(storageKeys.apiBase) || 'http://127.0.0.1:8000').replace(/\/$/, '');
}

function saveApiBase(apiBase) {
  localStorage.setItem(storageKeys.apiBase, apiBase);
}

function formatCookies(cookies) {
  if (!cookies || cookies.length === 0) return '';
  return cookies.map((c) => `  ${c.name}=${c.value} (${c.domain})`).join('\n');
}

function applyStatusToPage() {
  const statusNode = document.querySelector('#login-status');
  if (!statusNode) return;
  statusNode.className = `result-card ${appState.lastStatus.type}`;
  statusNode.textContent = appState.lastStatus.message;
}

function setStatus(message, type = 'muted') {
  appState.lastStatus = { message, type };
  applyStatusToPage();
}

function set2faStatus(message, type = 'info') {
  return authFlow.set2faStatus?.(message, type);
}

function clear2faStatus() {
  return authFlow.clear2faStatus?.();
}

function stopWechatPolling() {
  return authFlow.stopWechatPolling?.();
}

function updateMethodPanels() {
  return authFlow.updateMethodPanels();
}

function resetTwoFactorState() {
  return authFlow.resetTwoFactorState();
}

function closeTwoFactorDialog() {
  return authFlow.closeTwoFactorDialog();
}

function openTwoFactorDialog(methods = []) {
  return authFlow.openTwoFactorDialog?.(methods);
}

function renderTimeline(containerId) {
  return renderers.renderTimeline(containerId);
}

function renderRoute(route) {
  return renderers.renderRoute(route);
}

function bindRouteEvents(route) {
  if (route === '/login' || route === '/overview') {
    document.querySelector('#load-profile-btn')?.addEventListener('click', loadProfile);
    applyStatusToPage();
  }
  if (route === '/login') {
    document.querySelector('#cas-login-form')?.addEventListener('submit', handleLogin);
    void initLoginEnhancements();
  }
  if (route === '/overview') {
    document.querySelector('#refresh-overview-btn')?.addEventListener('click', () => fetchOverviewRealtime());
    document.querySelector('#profile-avatar-file')?.addEventListener('change', onAvatarFileSelected);
    document.querySelector('#save-profile-btn')?.addEventListener('click', saveProfile);
    applyRealtimeToOverviewDom();
    void fetchOverviewRealtime(true);
  }
  if (route === '/home') renderTimeline('home-timeline-list');
  if (route === '/overview') renderTimeline('overview-timeline-list');
  if (route === '/collectors') {
    document.querySelector('#save-smart-campus-settings-btn')?.addEventListener('click', () => {
      void saveSmartCampusSettings();
    });
    document.querySelector('#sc-schedule-mode')?.addEventListener('change', () => {
      toggleSmartCampusScheduleMode();
    });
    document.querySelector('#apply-smart-campus-query-btn')?.addEventListener('click', () => {
      void applySmartCampusQuery();
    });
    document.querySelector('#reset-smart-campus-query-btn')?.addEventListener('click', () => {
      resetSmartCampusQuery();
    });
    document.querySelector('#sc-search-q')?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') void applySmartCampusQuery();
    });
    document.querySelector('#sc-search-sender')?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') void applySmartCampusQuery();
    });
    document.querySelector('#sync-smart-campus-btn')?.addEventListener('click', () => {
      void syncSmartCampusMessages();
    });
    document.querySelector('#refresh-smart-campus-btn')?.addEventListener('click', () => {
      void loadSmartCampusMessages();
    });
    toggleSmartCampusScheduleMode();
    void loadSmartCampusSettings(true);
    void loadSmartCampusMessages(true);
  }
}

function applyRealtimeToOverviewDom() {
  return renderers.applyRealtimeToOverviewDom();
}

function handleRouteChange() {
  const route = getRouteFromHash();
  const validRoutes = ['/home', '/login', '/overview', '/collectors', '/rules', '/pushers'];
  if (!validRoutes.includes(route)) return navigateTo('/home');
  if (route === '/overview' && !getToken()) {
    setStatus('请先登录后再访问概览页。', 'error');
    return navigateTo('/login');
  }
  appState.currentRoute = route;
  updateActiveRouteInDrawer(route);
  routeView.innerHTML = renderRoute(route);
  bindRouteEvents(route);
}

function getSystemThemeMode() {
  return uiManager.getSystemThemeMode();
}

function getPreferredThemeMode() {
  return uiManager.getPreferredThemeMode();
}

function updateThemeButton(mode) {
  return uiManager.updateThemeButton(mode);
}

function updateThemeModeButtons(preference) {
  return uiManager.updateThemeModeButtons(preference);
}

function applyTheme(mode, preference = 'light') {
  return uiManager.applyTheme(mode, preference);
}

function applyThemeByPreference(preference) {
  return uiManager.applyThemeByPreference(preference);
}

function initTheme() {
  return uiManager.initTheme();
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

function formatApiError(detail, fallback = '请求失败') {
  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail[0]?.msg || JSON.stringify(detail);
  if (typeof detail === 'object') return detail.msg || JSON.stringify(detail);
  return String(detail);
}

function clearLocalAuth() {
  localStorage.removeItem(storageKeys.token);
  appState.currentUser = null;
  appState.lastLoginResult = null;
  appState.storedCookies = [];
  appState.smartCampus.messages = [];
  appState.smartCampus.error = '';
  appState.smartCampus.updatedAt = '';
  if (topAvatarPanel) topAvatarPanel.hidden = true;
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

function handleLoginSuccess(data) {
  return authFlow.handleLoginSuccess?.(data);
}

async function submitLoginWithPayload(payload, options = {}) {
  return authFlow.submitLoginWithPayload?.(payload, options);
}

async function handleLogin(event) {
  return authFlow.handleLogin(event);
}

async function tryAutoLoginOnLoginPage() {
  return authFlow.tryAutoLoginOnLoginPage?.();
}

async function initLoginEnhancements() {
  return authFlow.initLoginEnhancements();
}

async function verifyTwoFactorCode() {
  return authFlow.verifyTwoFactorCode();
}

async function sendTwoFactorCode() {
  return authFlow.sendTwoFactorCode();
}

async function initiateWeChatQr() {
  return authFlow.initiateWeChatQr();
}

function startWechatPolling() {
  return authFlow.startWechatPolling?.();
}

async function pollWechatStatus() {
  return authFlow.pollWechatStatus?.();
}

async function loadProfile() {
  return profileSessionManager.loadProfile();
}

async function loadStoredCookies() {
  return profileSessionManager.loadStoredCookies();
}

async function fetchOverviewRealtime(silent = false) {
  return profileSessionManager.fetchOverviewRealtime(silent);
}

function applySmartCampusToDom() {
  return renderers.applySmartCampusToDom();
}

async function syncSmartCampusProfile({ silent = false } = {}) {
  return smartCampusManager.syncSmartCampusProfile({ silent });
}

function toggleSmartCampusScheduleMode() {
  return smartCampusManager.toggleSmartCampusScheduleMode();
}

async function loadSmartCampusSettings(silent = false) {
  return smartCampusManager.loadSmartCampusSettings(silent);
}

async function saveSmartCampusSettings() {
  return smartCampusManager.saveSmartCampusSettings();
}

function applySmartCampusQueryFromDom() {
  return smartCampusManager.applySmartCampusQueryFromDom();
}

async function applySmartCampusQuery() {
  return smartCampusManager.applySmartCampusQuery();
}

function resetSmartCampusQuery() {
  return smartCampusManager.resetSmartCampusQuery();
}

async function loadSmartCampusMessages(silent = false) {
  return smartCampusManager.loadSmartCampusMessages(silent);
}

async function syncSmartCampusMessages() {
  return smartCampusManager.syncSmartCampusMessages();
}

async function onAvatarFileSelected(event) {
  return profileSessionManager.onAvatarFileSelected(event);
}

async function saveProfile() {
  return profileSessionManager.saveProfile();
}

async function restoreSavedSession() {
  return profileSessionManager.restoreSavedSession();
}

function toggleAvatarMenu(forceOpen) {
  return uiManager.toggleAvatarMenu(forceOpen);
}

function handleLogout() {
  return uiManager.handleLogout();
}

uiManager.bindShellEvents();

window.addEventListener('hashchange', handleRouteChange);
twoFactorMethodField?.addEventListener('change', updateMethodPanels);
verify2faButton?.addEventListener('click', verifyTwoFactorCode);
send2faCodeButton?.addEventListener('click', sendTwoFactorCode);
openWeChat2faButton?.addEventListener('click', initiateWeChatQr);
close2faDialogButton?.addEventListener('click', closeTwoFactorDialog);

initTheme();
resetTwoFactorState();
loginAccountManager.initRecentAccounts();
updateAccountDisplay();
void restoreSavedSession();
if (!window.location.hash) navigateTo('/home');
handleRouteChange();
