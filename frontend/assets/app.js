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
const drawerRouteItems = drawer?.querySelectorAll('mdui-list-item[href^="#/"]') || [];
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

// 颜色相关元素
const colorPrimaryInput = document.querySelector('#color-primary');
const colorAccentInput = document.querySelector('#color-accent');
const colorDangerInput = document.querySelector('#color-danger');
const presetColorsContainer = document.querySelector('#preset-colors');
const resetColorsButton = document.querySelector('#reset-colors-btn');
const saveColorsButton = document.querySelector('#save-colors-btn');
const fontSizeSmallBtn = document.querySelector('#font-size-sm');
const fontSizeBaseBtn = document.querySelector('#font-size-base');
const fontSizeLargeBtn = document.querySelector('#font-size-lg');

const storageKeys = {
  token: 'guet-notifier-access-token',
  apiBase: 'guet-notifier-api-base',
  themeMode: 'guet-notifier-theme-mode',
  recentAccounts: 'guet-notifier-recent-accounts',
  lastAccount: 'guet-notifier-last-account',
  cryptoKey: 'guet-notifier-crypto-key',
  customColors: 'guet-notifier-custom-colors',
  fontSize: 'guet-notifier-font-size',
};

// 主题管理模块
const ThemeManager = {
  getMode() {
    const stored = localStorage.getItem(storageKeys.themeMode);
    return stored || 'auto';
  },
  
  saveMode(mode) {
    localStorage.setItem(storageKeys.themeMode, mode);
  },
  
  applyMode(mode) {
    let finalMode = mode;
    if (mode === 'auto') {
      finalMode = this.getSystemMode();
    }
    document.documentElement.dataset.theme = finalMode;
    this.updateButtons(mode);
    if (window.mdui?.setColorScheme) {
      window.mdui.setColorScheme(themeColors[finalMode] || themeColors.light);
    }
  },
  
  getSystemMode() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  },
  
  updateButtons(mode) {
    if (themeModeAutoButton) themeModeAutoButton.setAttribute('variant', mode === 'auto' ? 'filled' : 'outlined');
    if (themeModeLightButton) themeModeLightButton.setAttribute('variant', mode === 'light' ? 'filled' : 'outlined');
    if (themeModeDarkButton) themeModeDarkButton.setAttribute('variant', mode === 'dark' ? 'filled' : 'outlined');
  },
  
  init() {
    const savedMode = this.getMode();
    this.applyMode(savedMode);
    this.bindEvents();
  },
  
  bindEvents() {
    if (themeModeAutoButton) {
      themeModeAutoButton.addEventListener('click', () => {
        this.applyMode('auto');
        this.saveMode('auto');
      });
    }
    if (themeModeLightButton) {
      themeModeLightButton.addEventListener('click', () => {
        this.applyMode('light');
        this.saveMode('light');
      });
    }
    if (themeModeDarkButton) {
      themeModeDarkButton.addEventListener('click', () => {
        this.applyMode('dark');
        this.saveMode('dark');
      });
    }
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      const currentMode = this.getMode();
      if (currentMode === 'auto') {
        this.applyMode('auto');
      }
    });
  }
};

// 颜色管理模块
const ColorManager = {
  defaultColors: {
    primary: '#1e40af',
    accent: '#0284c7',
    danger: '#dc2626',
  },
  
  getColors() {
    const stored = localStorage.getItem(storageKeys.customColors);
    if (!stored) return this.defaultColors;
    try {
      const colors = JSON.parse(stored);
      return {
        primary: colors.primary || this.defaultColors.primary,
        accent: colors.accent || this.defaultColors.accent,
        danger: colors.danger || this.defaultColors.danger,
      };
    } catch {
      return this.defaultColors;
    }
  },
  
  saveColors(colors) {
    localStorage.setItem(storageKeys.customColors, JSON.stringify(colors));
  },
  
  applyColors(colors) {
    // 更新CSS变量
    document.documentElement.style.setProperty('--guet-primary', colors.primary);
    document.documentElement.style.setProperty('--guet-accent', colors.accent);
    document.documentElement.style.setProperty('--guet-danger', colors.danger);
    
    // 更新颜色选择器的值和背景色
    if (colorPrimaryInput) {
      colorPrimaryInput.value = colors.primary;
      const picker = colorPrimaryInput.closest('.color-picker');
      if (picker) picker.style.backgroundColor = colors.primary;
    }
    if (colorAccentInput) {
      colorAccentInput.value = colors.accent;
      const picker = colorAccentInput.closest('.color-picker');
      if (picker) picker.style.backgroundColor = colors.accent;
    }
    if (colorDangerInput) {
      colorDangerInput.value = colors.danger;
      const picker = colorDangerInput.closest('.color-picker');
      if (picker) picker.style.backgroundColor = colors.danger;
    }
    
    // 更新MDUI主题颜色
    if (window.mdui?.setColorScheme) {
      const currentMode = document.documentElement.dataset.theme || 'light';
      window.mdui.setColorScheme(colors.primary);
    }
  },
  
  bindEvents() {
    const liveColors = this.getColors();

    if (colorPrimaryInput) {
      colorPrimaryInput.addEventListener('input', (e) => {
        liveColors.primary = e.target.value;
        this.applyColors(liveColors);
      });
    }
    if (colorAccentInput) {
      colorAccentInput.addEventListener('input', (e) => {
        liveColors.accent = e.target.value;
        this.applyColors(liveColors);
      });
    }
    if (colorDangerInput) {
      colorDangerInput.addEventListener('input', (e) => {
        liveColors.danger = e.target.value;
        this.applyColors(liveColors);
      });
    }
    if (presetColorsContainer) {
      presetColorsContainer.addEventListener('click', (e) => {
        const presetColor = e.target.closest('.preset-color');
        if (presetColor) {
          const color = presetColor.dataset.color;
          liveColors.primary = color;
          this.applyColors(liveColors);
        }
      });
    }
    if (resetColorsButton) {
      resetColorsButton.addEventListener('click', () => {
        liveColors.primary = this.defaultColors.primary;
        liveColors.accent = this.defaultColors.accent;
        liveColors.danger = this.defaultColors.danger;
        this.applyColors(this.defaultColors);
      });
    }
    if (saveColorsButton) {
      saveColorsButton.addEventListener('click', () => {
        if (colorPrimaryInput) liveColors.primary = colorPrimaryInput.value;
        if (colorAccentInput) liveColors.accent = colorAccentInput.value;
        if (colorDangerInput) liveColors.danger = colorDangerInput.value;
        this.saveColors(liveColors);
        setStatus('颜色保存成功！', 'success');
      });
    }
  }
};

// 字体大小管理模块
const FontSizeManager = {
  getSize() {
    const stored = localStorage.getItem(storageKeys.fontSize);
    return stored || 'base';
  },
  
  saveSize(size) {
    localStorage.setItem(storageKeys.fontSize, size);
  },
  
  applySize(size) {
    // 重置所有按钮状态
    if (fontSizeSmallBtn) fontSizeSmallBtn.setAttribute('variant', 'outlined');
    if (fontSizeBaseBtn) fontSizeBaseBtn.setAttribute('variant', 'outlined');
    if (fontSizeLargeBtn) fontSizeLargeBtn.setAttribute('variant', 'outlined');
    
    // 设置选中按钮状态
    switch (size) {
      case 'sm':
        if (fontSizeSmallBtn) fontSizeSmallBtn.setAttribute('variant', 'filled');
        document.documentElement.style.setProperty('--guet-font-size-base', '0.875rem');
        break;
      case 'lg':
        if (fontSizeLargeBtn) fontSizeLargeBtn.setAttribute('variant', 'filled');
        document.documentElement.style.setProperty('--guet-font-size-base', '1.125rem');
        break;
      default:
        if (fontSizeBaseBtn) fontSizeBaseBtn.setAttribute('variant', 'filled');
        document.documentElement.style.setProperty('--guet-font-size-base', '1rem');
        break;
    }
  },
  
  bindEvents() {
    if (fontSizeSmallBtn) {
      fontSizeSmallBtn.addEventListener('click', () => {
        this.applySize('sm');
        this.saveSize('sm');
      });
    }
    if (fontSizeBaseBtn) {
      fontSizeBaseBtn.addEventListener('click', () => {
        this.applySize('base');
        this.saveSize('base');
      });
    }
    if (fontSizeLargeBtn) {
      fontSizeLargeBtn.addEventListener('click', () => {
        this.applySize('lg');
        this.saveSize('lg');
      });
    }
  },
  
  init() {
    const savedSize = this.getSize();
    this.applySize(savedSize);
    this.bindEvents();
  }
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
  const lang = localStorage.getItem('guet_notifier_language') || 'zh';
  const notLoggedIn = lang === 'en' ? 'Not signed in' : '未登录';
  if (!user) return notLoggedIn;
  return String(user.display_name || '').trim()
    || String(user.real_name || '').trim()
    || String(user.student_id || '').trim()
    || notLoggedIn;
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
  drawerRouteItems.forEach((node) => {
    const target = node.getAttribute('href')?.replace(/^#/, '') || '';
    node.classList.toggle('route-active', target === route);
  });
}

function updateAccountDisplay() {
  const user = appState.currentUser;
  const label = resolveNickname(user);
  const lang = localStorage.getItem('guet_notifier_language') || 'zh';
  const student = user?.student_id || '--';
  const avatar = user?.avatar_base64 || '';
  if (topAccount) topAccount.textContent = label;
  if (drawerDisplayName) drawerDisplayName.textContent = label;
  if (drawerAccount) drawerAccount.textContent = lang === 'en' ? `Current account: ${student}` : `当前账号：${student}`;
  if (drawerUserActions) drawerUserActions.style.display = user ? '' : 'none';
  if (topAvatarName) topAvatarName.textContent = user ? `${label} (${user.student_id || ''})` : (lang === 'en' ? 'Not signed in' : '未登录');
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
  try {
    const field = document.querySelector('#cas-login-form [name="api_base"]');
    if (field?.value?.trim()) return field.value.trim().replace(/\/$/, '');
  } catch (e) {
    // 表单未渲染时的错误处理
  }
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

function translateStatusMessage(message) {
  const lang = localStorage.getItem('guet_notifier_language') || 'zh';
  const text = String(message || '');
  if (lang !== 'en') return text;

  const restoredMatch = text.match(/^已恢复登录态：(.+)$/);
  if (restoredMatch) return `Login session restored: ${restoredMatch[1]}`;
  if (text === '尚未发起登录。') return 'No login request sent yet.';
  if (text === '概览实时数据已更新。') return 'Overview realtime data refreshed.';
  if (text.startsWith('已删除历史账号：')) return `Deleted recent account: ${text.replace('已删除历史账号：', '')}`;
  if (text === '颜色保存成功！') return 'Colors saved successfully.';
  if (text === '请先登录后再访问概览页。') return 'Please sign in before accessing the overview page.';
  if (text === '请先登录后再读取当前用户。') return 'Please sign in before loading current user.';
  if (text.startsWith('登录态失效：')) return `Session expired: ${text.replace(/^登录态失效：/, '').replace('，请重新登录。', '. Please sign in again.')}`;
  if (text === '登录成功，正在同步当前账号信息…') return 'Login successful. Syncing current account info...';
  if (text === '请完整填写学号、密码和后端地址。') return 'Please complete student ID, password, and backend URL.';
  if (text === '正在请求 backend 登录接口，请稍候…') return 'Requesting backend login API, please wait...';
  if (text === '检测到 CAS 需要二次验证，已弹出验证窗口。') return 'CAS requires 2FA. Verification dialog opened.';
  if (text.startsWith('自动登录失败：')) return `Auto login failed: ${text.replace('自动登录失败：', '')}`;
  if (text.startsWith('登录失败：')) return `Login failed: ${text.replace('登录失败：', '')}`;
  if (text === '请选择要删除的历史账号。') return 'Please select a recent account to delete.';
  if (text.startsWith('历史账号 ') && text.endsWith(' 不存在。')) return `Recent account ${text.replace(/^历史账号 /, '').replace(/ 不存在。$/, '')} does not exist.`;
  if (text === '当前没有可清空的历史账号。') return 'There are no recent accounts to clear.';
  if (text === '已清空全部历史账号。') return 'All recent accounts have been cleared.';
  if (text === '头像已选择，点击保存后写入数据库。') return 'Avatar selected. Click save to store it.';
  if (text.startsWith('头像处理失败：')) return `Avatar processing failed: ${text.replace('头像处理失败：', '')}`;
  if (text === '请先登录后再保存资料。') return 'Please sign in before saving profile.';
  if (text === '正在保存昵称与头像…') return 'Saving nickname and avatar...';
  if (text === '昵称与头像保存成功。') return 'Nickname and avatar saved.';
  if (text.startsWith('保存失败：')) return `Save failed: ${text.replace('保存失败：', '')}`;
  if (text === '正在读取当前用户信息…') return 'Loading current user info...';
  if (text.startsWith('当前用户\n')) {
    return text
      .replace('当前用户', 'Current User')
      .replace('学号：', 'Student ID: ')
      .replace('昵称：', 'Nickname: ')
      .replace('真实姓名：', 'Real name: ')
      .replace('未设置', 'Not set')
      .replace('未采集', 'Not synced');
  }
  if (text === '登录态已失效，请重新登录。') return 'Session has expired, please sign in again.';
  if (text === '已登出，可重新登录或切换账号。') return 'Logged out. You can sign in again or switch accounts.';
  if (text.startsWith('实时数据获取失败：')) return `Realtime data fetch failed: ${text.replace('实时数据获取失败：', '')}`;
  if (text === '请先登录后再保存采集器设置。') return 'Please sign in before saving collector settings.';
  if (text === '采集器设置已加载。') return 'Collector settings loaded.';
  if (text.startsWith('读取采集器设置失败：')) return `Failed to load collector settings: ${text.replace('读取采集器设置失败：', '')}`;
  if (text === '采集器设置已保存。') return 'Collector settings saved.';
  if (text.startsWith('保存采集器设置失败：')) return `Failed to save collector settings: ${text.replace('保存采集器设置失败：', '')}`;
  if (text.startsWith('已加载 ') && text.endsWith(' 条智慧校园通知。')) return `Loaded ${text.replace('已加载 ', '').replace(' 条智慧校园通知。', '')} smart campus notices.`;
  if (text.startsWith('读取智慧校园通知失败：')) return `Failed to load smart campus notices: ${text.replace('读取智慧校园通知失败：', '')}`;
  if (text === '请先登录后再同步采集器。') return 'Please sign in before syncing collector.';
  if (text.startsWith('智慧校园通知同步完成：')) return `Smart campus sync completed: ${text.replace('智慧校园通知同步完成：', '').replace('抓取 ', 'fetched ').replace('，新增 ', ', saved ').replace('，标记已读 ', ', marked read ').replace('。', '')}.`;
  if (text.startsWith('同步智慧校园通知失败：')) return `Smart campus sync failed: ${text.replace('同步智慧校园通知失败：', '')}`;
  if (text.startsWith('已同步真实姓名：')) return `Real name synced: ${text.replace('已同步真实姓名：', '')}`;
  if (text.startsWith('同步真实姓名失败：')) return `Real name sync failed: ${text.replace('同步真实姓名失败：', '')}`;

  return text;
}

function setStatus(message, type = 'muted') {
  appState.lastStatus = { message: translateStatusMessage(message), type };
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

// 渲染首页骨架屏
function renderHomeSkeleton() {
  return `
    <section class="overview-section">
      <div class="section-head">
        <div>
          <div class="section-kicker">控制台主页</div>
          <h1>把分散在各系统里的提醒集中管理</h1>
          <p>阶段一已支持 CAS 登录、2FA、会话持久化与消息概览。</p>
        </div>
        <div class="overview-actions">
          <div class="skeleton skeleton-button"></div>
          <div class="skeleton skeleton-button"></div>
        </div>
      </div>
      <div class="summary-grid">
        <div class="skeleton-card">
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-title"></div>
        </div>
        <div class="skeleton-card">
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-title"></div>
        </div>
        <div class="skeleton-card">
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-title"></div>
        </div>
      </div>
      <div class="skeleton-card">
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton-timeline-item">
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-text"></div>
        </div>
        <div class="skeleton-timeline-item">
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-text"></div>
        </div>
        <div class="skeleton-timeline-item">
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-text"></div>
        </div>
      </div>
    </section>
  `;
}

// 渲染概览页骨架屏
function renderOverviewSkeleton() {
  return `
    <section>
      <div class="summary-grid">
        <div class="skeleton-card">
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton skeleton-text"></div>
        </div>
        <div class="skeleton-card">
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton skeleton-text"></div>
        </div>
        <div class="skeleton-card">
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton skeleton-text"></div>
        </div>
      </div>
      <section class="main-grid">
        <div class="skeleton-card">
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-text"></div>
          <div class="overview-actions" style="margin-top:0.8rem">
            <div class="skeleton skeleton-button"></div>
            <div class="skeleton skeleton-button"></div>
            <div class="skeleton skeleton-button"></div>
          </div>
        </div>
        <div class="skeleton-card">
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-text"></div>
        </div>
        <div class="skeleton-card" style="grid-column:1 / -1">
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton skeleton-text"></div>
          <div class="profile-editor">
            <div class="profile-avatar-wrap">
              <div class="skeleton skeleton-avatar"></div>
            </div>
            <div class="profile-fields">
              <div class="skeleton skeleton-text"></div>
              <div class="skeleton skeleton-text"></div>
              <div class="skeleton skeleton-button"></div>
            </div>
          </div>
        </div>
        <div class="skeleton-card" style="grid-column:1 / -1">
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton-timeline-item">
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text"></div>
          </div>
          <div class="skeleton-timeline-item">
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text"></div>
          </div>
        </div>
      </section>
    </section>
  `;
}

// 显示骨架屏
function showSkeleton(route) {
  switch (route) {
    case '/home':
      routeView.innerHTML = renderHomeSkeleton();
      break;
    case '/overview':
      routeView.innerHTML = renderOverviewSkeleton();
      break;
    default:
      break;
  }
}

function renderRoute(route) {
  return renderers.renderRoute(route);
}

function bindRouteEvents(route) {
  const queryInRoute = (selector) => routeView.querySelector(selector);

  if (route === '/login' || route === '/overview') {
    queryInRoute('#load-profile-btn')?.addEventListener('click', loadProfile);
    applyStatusToPage();
  }
  if (route === '/login') {
    queryInRoute('#cas-login-form')?.addEventListener('submit', handleLogin);
    void initLoginEnhancements();
  }
  if (route === '/overview') {
    queryInRoute('#refresh-overview-btn')?.addEventListener('click', () => fetchOverviewRealtime());
    queryInRoute('#overview-loading-note')?.parentElement?.addEventListener('click', () => fetchOverviewRealtime());
    const avatarInput = queryInRoute('#profile-avatar-file');
    const avatarTrigger = queryInRoute('#profile-avatar-file-trigger');
    const avatarName = queryInRoute('#profile-avatar-file-name');
    avatarTrigger?.addEventListener('click', () => avatarInput?.click());
    avatarInput?.addEventListener('change', (event) => {
      void onAvatarFileSelected(event);
      const file = event.target?.files?.[0];
      if (avatarName) avatarName.textContent = file?.name || (LanguageManager.getLanguage() === 'en' ? 'No file selected' : '未选择文件');
    });
    queryInRoute('#save-profile-btn')?.addEventListener('click', saveProfile);
    applyRealtimeToOverviewDom();
    void fetchOverviewRealtime(true);
  }
  if (route === '/home') renderTimeline('home-timeline-list');
  if (route === '/overview') renderTimeline('overview-timeline-list');
  if (route === '/collectors') {
    queryInRoute('#save-smart-campus-settings-btn')?.addEventListener('click', () => {
      void saveSmartCampusSettings();
    });
    queryInRoute('#sc-schedule-mode')?.addEventListener('change', () => {
      toggleSmartCampusScheduleMode();
    });
    queryInRoute('#apply-smart-campus-query-btn')?.addEventListener('click', () => {
      void applySmartCampusQuery();
    });
    queryInRoute('#reset-smart-campus-query-btn')?.addEventListener('click', () => {
      resetSmartCampusQuery();
    });
    const debouncedApplyQuery = debounce(() => void applySmartCampusQuery(), 300);
    queryInRoute('#sc-search-q')?.addEventListener('input', debouncedApplyQuery);
    queryInRoute('#sc-search-sender')?.addEventListener('input', debouncedApplyQuery);
    queryInRoute('#sc-search-q')?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') void applySmartCampusQuery();
    });
    queryInRoute('#sc-search-sender')?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') void applySmartCampusQuery();
    });
    queryInRoute('#sync-smart-campus-btn')?.addEventListener('click', () => {
      void syncSmartCampusMessages();
    });
    queryInRoute('#refresh-smart-campus-btn')?.addEventListener('click', () => {
      void loadSmartCampusMessages();
    });
    toggleSmartCampusScheduleMode();
    void loadSmartCampusSettings(true).then(() => applySmartCampusToDom());
    void loadSmartCampusMessages(true).then(() => applySmartCampusToDom());
  }
}

function applyRealtimeToOverviewDom() {
  const result = renderers.applyRealtimeToOverviewDom();
  if (typeof LanguageManager !== 'undefined') {
    LanguageManager.applyLanguage(LanguageManager.getLanguage());
  }
  return result;
}

let routeRenderTimer = null;

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
  
  // 显示骨架屏
  showSkeleton(route);
  
  // 延迟渲染实际内容，模拟网络加载（清理前一次切换，避免快速切路由时重复渲染）
  if (routeRenderTimer) clearTimeout(routeRenderTimer);
  routeRenderTimer = setTimeout(() => {
    routeView.innerHTML = renderRoute(route);
    bindRouteEvents(route);
    LanguageManager.applyLanguage(LanguageManager.getLanguage());
    routeRenderTimer = null;
  }, 300);
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

// 默认颜色
const defaultColors = {
  primary: '#1e40af',
  accent: '#0284c7',
  danger: '#dc2626',
};

// 获取用户自定义颜色
function getCustomColors() {
  const stored = localStorage.getItem(storageKeys.customColors);
  if (!stored) return defaultColors;
  try {
    const colors = JSON.parse(stored);
    return {
      primary: colors.primary || defaultColors.primary,
      accent: colors.accent || defaultColors.accent,
      danger: colors.danger || defaultColors.danger,
    };
  } catch {
    return defaultColors;
  }
}

// 保存用户自定义颜色
function saveCustomColors(colors) {
  localStorage.setItem(storageKeys.customColors, JSON.stringify(colors));
}

// 应用颜色到DOM
function applyCustomColors(colors) {
  // 更新CSS变量
  document.documentElement.style.setProperty('--guet-primary', colors.primary);
  document.documentElement.style.setProperty('--guet-accent', colors.accent);
  document.documentElement.style.setProperty('--guet-danger', colors.danger);
  
  // 更新颜色选择器的值和背景色
  if (colorPrimaryInput) {
    colorPrimaryInput.value = colors.primary;
    const picker = colorPrimaryInput.closest('.color-picker');
    if (picker) picker.style.backgroundColor = colors.primary;
  }
  if (colorAccentInput) {
    colorAccentInput.value = colors.accent;
    const picker = colorAccentInput.closest('.color-picker');
    if (picker) picker.style.backgroundColor = colors.accent;
  }
  if (colorDangerInput) {
    colorDangerInput.value = colors.danger;
    const picker = colorDangerInput.closest('.color-picker');
    if (picker) picker.style.backgroundColor = colors.danger;
  }
  
  // 更新MDUI主题颜色
  if (window.mdui?.setColorScheme) {
    const currentMode = document.documentElement.dataset.theme || 'light';
    window.mdui.setColorScheme(colors.primary);
  }
}

// 字体大小相关函数
function getFontSize() {
  const stored = localStorage.getItem(storageKeys.fontSize);
  return stored || 'base';
}

function saveFontSize(size) {
  localStorage.setItem(storageKeys.fontSize, size);
}

function applyFontSize(size) {
  // 重置所有按钮状态
  if (fontSizeSmallBtn) fontSizeSmallBtn.setAttribute('variant', 'outlined');
  if (fontSizeBaseBtn) fontSizeBaseBtn.setAttribute('variant', 'outlined');
  if (fontSizeLargeBtn) fontSizeLargeBtn.setAttribute('variant', 'outlined');
  
  // 设置选中按钮状态
  switch (size) {
    case 'sm':
      if (fontSizeSmallBtn) fontSizeSmallBtn.setAttribute('variant', 'filled');
      document.documentElement.style.setProperty('--guet-font-size-base', '0.875rem');
      break;
    case 'lg':
      if (fontSizeLargeBtn) fontSizeLargeBtn.setAttribute('variant', 'filled');
      document.documentElement.style.setProperty('--guet-font-size-base', '1.125rem');
      break;
    default:
      if (fontSizeBaseBtn) fontSizeBaseBtn.setAttribute('variant', 'filled');
      document.documentElement.style.setProperty('--guet-font-size-base', '1rem');
      break;
  }
}

// 绑定字体大小按钮事件
function bindFontSizeEvents() {
  if (fontSizeSmallBtn) {
    fontSizeSmallBtn.addEventListener('click', () => {
      applyFontSize('sm');
      saveFontSize('sm');
    });
  }
  if (fontSizeBaseBtn) {
    fontSizeBaseBtn.addEventListener('click', () => {
      applyFontSize('base');
      saveFontSize('base');
    });
  }
  if (fontSizeLargeBtn) {
    fontSizeLargeBtn.addEventListener('click', () => {
      applyFontSize('lg');
      saveFontSize('lg');
    });
  }
}

// 绑定颜色选择器事件
function bindColorPickerEvents() {
  if (colorPrimaryInput) {
    colorPrimaryInput.addEventListener('input', () => {
      const colors = getCustomColors();
      colors.primary = colorPrimaryInput.value;
      applyCustomColors(colors);
    });
  }
  
  if (colorAccentInput) {
    colorAccentInput.addEventListener('input', () => {
      const colors = getCustomColors();
      colors.accent = colorAccentInput.value;
      applyCustomColors(colors);
    });
  }
  
  if (colorDangerInput) {
    colorDangerInput.addEventListener('input', () => {
      const colors = getCustomColors();
      colors.danger = colorDangerInput.value;
      applyCustomColors(colors);
    });
  }
}

// 绑定预设颜色事件
function bindPresetColorEvents() {
  if (presetColorsContainer) {
    presetColorsContainer.addEventListener('click', (event) => {
      const presetColor = event.target.closest('.preset-color');
      if (presetColor) {
        const color = presetColor.dataset.color;
        if (color) {
          // 将预设颜色应用为主色调
          const colors = getCustomColors();
          colors.primary = color;
          applyCustomColors(colors);
          
          // 更新预设颜色的激活状态
          document.querySelectorAll('.preset-color').forEach(el => {
            el.classList.remove('active');
          });
          presetColor.classList.add('active');
        }
      }
    });
  }
}

// 绑定颜色按钮事件
function bindColorButtonEvents() {
  if (resetColorsButton) {
    resetColorsButton.addEventListener('click', () => {
      applyCustomColors(defaultColors);
      saveCustomColors(defaultColors);
    });
  }
  
  if (saveColorsButton) {
    saveColorsButton.addEventListener('click', () => {
      const colors = {
        primary: colorPrimaryInput?.value || defaultColors.primary,
        accent: colorAccentInput?.value || defaultColors.accent,
        danger: colorDangerInput?.value || defaultColors.danger,
      };
      saveCustomColors(colors);
      // 可以添加一个保存成功的提示
    });
  }
}

// 初始化颜色功能
function initColorSystem() {
  const colors = getCustomColors();
  applyCustomColors(colors);
  bindColorPickerEvents();
  bindPresetColorEvents();
  bindColorButtonEvents();
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
  const result = renderers.applySmartCampusToDom();
  if (typeof LanguageManager !== 'undefined') {
    LanguageManager.applyLanguage(LanguageManager.getLanguage());
  }
  return result;
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

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function escapeHtml(unsafe) {
  return String(unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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

// 初始化主题
ThemeManager.init();

resetTwoFactorState();
loginAccountManager.initRecentAccounts();
updateAccountDisplay();

// 初始化颜色
const customColors = ColorManager.getColors();
ColorManager.applyColors(customColors);
ColorManager.bindEvents();

// 语言管理
const LanguageManager = {
  storageKey: 'guet_notifier_language',
  defaultLanguage: 'zh',
  dictionaries: {
    zh: {
      htmlLang: 'zh-CN',
      topHome: '主页',
      topOverview: '概览',
      drawerHome: '主页',
      drawerLogin: '登录',
      drawerOverview: '概览',
      drawerCollectors: '采集器',
      drawerRules: '转发规则',
      drawerPushers: '推送器',
      themeTitle: '主题模式',
      themeAuto: '跟随系统',
      themeLight: '日间模式',
      themeDark: '夜间模式',
      preferencesToggle: '偏好设置',
      languageTitle: '语言偏好',
      languageZh: '简体中文',
      languageEn: 'English',
      languagePreview: '这是语言预览文本',
      fontSizeTitle: '字体大小',
      fontSizeSm: '小',
      fontSizeBase: '中',
      fontSizeLg: '大',
      fontPreview: '这是字体大小预览文本',
      colorTitle: '自定义颜色',
      presetTitle: '预设颜色',
      resetColors: '重置颜色',
      saveColors: '保存颜色',
      loginTitle: '账号登录',
      loginDesc: '使用桂电统一身份认证账号（智慧校园账号）登录，登录成功后自动同步当前用户信息。',
      loginTip2fa: '支持 2FA 验证',
      loginTipRecent: '支持历史账号快速切换',
      loginTipAuto: '支持自动登录',
      loginAdvanced: '高级配置（一般无需修改）',
      recentAccounts: '最近登录账号',
      deleteCurrent: '删除当前历史账号',
      clearAll: '清空全部历史账号',
      rememberPassword: '保存密码',
      autoLogin: '自动登录',
      loginButton: '登录',
      loadProfile: '读取当前用户',
      loginNote: '提示：勾选“自动登录”会自动启用“保存密码”；密码仅在本机加密保存。',
      untouchedStatus: '尚未发起登录。',
      homeKicker: '控制台主页',
      homeHeadline: '把分散在各系统里的提醒集中管理',
      homeDesc: '阶段一已支持 CAS 登录、2FA、会话持久化与消息概览。',
      homeConnectCas: '连接 CAS',
      homeViewOverview: '查看概览',
      homePendingNotice: '待处理通知',
      homeActiveRules: '活跃规则',
      homeDeliveryRate: '渠道送达率',
      recentNotice: '最近通知',
      overviewStudentId: '当前学号',
      overviewRealName: '真实姓名',
      overviewBackendHealth: '后端状态',
      overviewHealthNote: '来自 /health 实时查询',
      overviewUpdatedAt: '最后刷新时间',
      overviewLoading: '正在刷新…',
      overviewRefreshTip: '点击按钮可手动刷新',
      overviewLoginPanel: '登录与用户概览',
      goLogin: '去登录页',
      refreshCurrentUser: '刷新当前用户',
      refreshRealtime: '刷新实时数据',
      currentCookies: '本次登录 Cookies',
      profilePanel: '昵称与头像（隐私）',
      profileDesc: '可设置对外显示昵称',
      profilePlaceholder: '未设置头像',
      profileNickname: '昵称',
      saveProfile: '保存昵称与头像',
      chooseAvatarFile: '选择头像文件',
      noFileSelected: '未选择文件',
      noCookieRecords: '当前会话暂无 Cookies 记录。',
      collectorsTitle: '智慧校园通知采集器',
      collectorsDesc: '数据源：pcportal 消息中心 receiveBox。同步后会标记已读',
      collectorsSchedule: '采集时间设置',
      saveSettings: '保存设置',
      syncMessages: '同步通知',
      refreshLocal: '刷新本地记录',
      syncingMessages: '正在同步智慧校园通知…',
      latestUpdatedAt: '最近更新时间',
      noticeList: '通知列表',
      applyFilter: '应用筛选',
      reset: '重置',
      noNoticesHint: '暂无通知，先点击“同步通知”。',
      noRecentAccounts: '暂无历史账号，登录后将自动记录。',
      noRecentOptions: '暂无历史账号',
      rulesTitle: '转发规则',
      pushersTitle: '推送器',
      nextSteps: '下一步',
      doneBackend: '完成后端接口定义与鉴权策略。',
      fillForms: '补齐增删改查表单和保存逻辑。',
      addTests: '接入变更日志与测试用例。',
      triggerCondition: '触发条件',
      keywordPriority: '关键词 / 优先级',
      triggerDesc: '支持包含、排除、正则等条件。',
      msgTemplate: '消息模板',
      textTemplate: '文本模板',
      msgTemplateDesc: '主题、正文、变量映射占位。',
      channelRoute: '渠道路由',
      multiChannel: '多渠道',
      channelDesc: '按规则选择推送渠道。',
      qqBot: 'QQ 机器人',
      qqBotDesc: '连接地址与鉴权配置。',
      wxPush: '微信推送',
      wxPushDesc: 'AppToken 与 UID 管理。',
      feishu: '飞书',
      feishuDesc: '签名与路由配置。',
      deletedRecentPrefix: '已删除历史账号：',
      twoFaHeadline: 'CAS 二次验证',
      twoFaHint: 'CAS 需要二次验证，请选择验证方式并完成认证。',
      twoFaMethodLabel: '验证方式',
      twoFaSmsMethod: '短信验证码',
      twoFaWechatMethod: '微信扫码',
      twoFaCodeLabel: '验证码',
      twoFaCodeHelper: '收到短信后在此输入验证码',
      twoFaSendSms: '发送短信验证码',
      twoFaSubmitCode: '提交验证码',
      twoFaWechatHint: '点击下方按钮获取微信二维码',
      twoFaGetWechatQr: '获取微信二维码',
      twoFaLater: '稍后处理',
    },
    en: {
      htmlLang: 'en',
      topHome: 'Home',
      topOverview: 'Overview',
      drawerHome: 'Home',
      drawerLogin: 'Login',
      drawerOverview: 'Overview',
      drawerCollectors: 'Collectors',
      drawerRules: 'Rules',
      drawerPushers: 'Pushers',
      themeTitle: 'Theme Mode',
      themeAuto: 'System',
      themeLight: 'Light',
      themeDark: 'Dark',
      preferencesToggle: 'Preferences',
      languageTitle: 'Language',
      languageZh: 'Chinese',
      languageEn: 'English',
      languagePreview: 'This is language preview text',
      fontSizeTitle: 'Font Size',
      fontSizeSm: 'Small',
      fontSizeBase: 'Medium',
      fontSizeLg: 'Large',
      fontPreview: 'This is font size preview text',
      colorTitle: 'Custom Colors',
      presetTitle: 'Preset Colors',
      resetColors: 'Reset Colors',
      saveColors: 'Save Colors',
      loginTitle: 'Sign In',
      loginDesc: 'Use your GUET unified account (Smart Campus) to sign in. User profile will sync after login.',
      loginTip2fa: '2FA Supported',
      loginTipRecent: 'Quick Account Switch',
      loginTipAuto: 'Auto Login',
      loginAdvanced: 'Advanced Settings (Optional)',
      recentAccounts: 'Recent Accounts',
      deleteCurrent: 'Delete Current Account',
      clearAll: 'Clear All Accounts',
      rememberPassword: 'Remember Password',
      autoLogin: 'Auto Login',
      loginButton: 'Sign In',
      loadProfile: 'Load Current User',
      loginNote: 'Tip: Enabling auto login will also enable password remember; password is encrypted locally.',
      untouchedStatus: 'No login request sent yet.',
      homeKicker: 'Dashboard',
      homeHeadline: 'Centralize reminders from scattered campus systems',
      homeDesc: 'Phase 1 supports CAS login, 2FA, session persistence, and message overview.',
      homeConnectCas: 'Connect CAS',
      homeViewOverview: 'View Overview',
      homePendingNotice: 'Pending Notices',
      homeActiveRules: 'Active Rules',
      homeDeliveryRate: 'Delivery Rate',
      recentNotice: 'Recent Notices',
      overviewStudentId: 'Student ID',
      overviewRealName: 'Real Name',
      overviewBackendHealth: 'Backend Status',
      overviewHealthNote: 'Live data from /health',
      overviewUpdatedAt: 'Last Updated',
      overviewLoading: 'Refreshing...',
      overviewRefreshTip: 'Click button to refresh',
      overviewLoginPanel: 'Login & User Overview',
      goLogin: 'Go to Login',
      refreshCurrentUser: 'Refresh Current User',
      refreshRealtime: 'Refresh Realtime',
      currentCookies: 'Current Login Cookies',
      profilePanel: 'Nickname & Avatar (Privacy)',
      profileDesc: 'Set nickname shown to others',
      profilePlaceholder: 'No Avatar',
      profileNickname: 'Nickname',
      saveProfile: 'Save Nickname & Avatar',
      chooseAvatarFile: 'Choose Avatar File',
      noFileSelected: 'No file selected',
      noCookieRecords: 'No cookies recorded in current session.',
      collectorsTitle: 'Smart Campus Notifier Collector',
      collectorsDesc: 'Source: pcportal message center receiveBox. Messages are marked read after sync.',
      collectorsSchedule: 'Schedule Settings',
      saveSettings: 'Save Settings',
      syncMessages: 'Sync Messages',
      refreshLocal: 'Refresh Local',
      syncingMessages: 'Syncing smart campus messages...',
      latestUpdatedAt: 'Last updated',
      noticeList: 'Notice List',
      applyFilter: 'Apply Filter',
      reset: 'Reset',
      noNoticesHint: 'No notices yet, click "Sync Messages" first.',
      noRecentAccounts: 'No recent account history. It will be recorded after login.',
      noRecentOptions: 'No recent accounts',
      rulesTitle: 'Forwarding Rules',
      pushersTitle: 'Pushers',
      nextSteps: 'Next Steps',
      doneBackend: 'Complete backend API definitions and auth strategy.',
      fillForms: 'Fill CRUD forms and persistence logic.',
      addTests: 'Add changelog integration and test cases.',
      triggerCondition: 'Trigger Conditions',
      keywordPriority: 'Keyword / Priority',
      triggerDesc: 'Supports include, exclude, and regex conditions.',
      msgTemplate: 'Message Template',
      textTemplate: 'Text Template',
      msgTemplateDesc: 'Subject, body, and variable mapping placeholders.',
      channelRoute: 'Channel Routing',
      multiChannel: 'Multi-channel',
      channelDesc: 'Choose push channels by rule.',
      qqBot: 'QQ Bot',
      qqBotDesc: 'Connection URL and auth settings.',
      wxPush: 'WeChat Push',
      wxPushDesc: 'Manage AppToken and UID.',
      feishu: 'Feishu',
      feishuDesc: 'Signature and routing settings.',
      deletedRecentPrefix: 'Deleted recent account: ',
      twoFaHeadline: 'CAS Two-Factor Verification',
      twoFaHint: 'CAS requires 2FA. Please choose a method and complete verification.',
      twoFaMethodLabel: 'Verification Method',
      twoFaSmsMethod: 'SMS Code',
      twoFaWechatMethod: 'WeChat QR',
      twoFaCodeLabel: 'Verification Code',
      twoFaCodeHelper: 'Enter the SMS code you received',
      twoFaSendSms: 'Send SMS Code',
      twoFaSubmitCode: 'Submit Code',
      twoFaWechatHint: 'Click below to get WeChat QR code',
      twoFaGetWechatQr: 'Get WeChat QR Code',
      twoFaLater: 'Later',
    },
  },
  
  getLanguage() {
    return localStorage.getItem(this.storageKey) || this.defaultLanguage;
  },
  
  setLanguage(lang) {
    const nextLang = this.dictionaries[lang] ? lang : this.defaultLanguage;
    localStorage.setItem(this.storageKey, nextLang);
    // Re-render current route to make language change immediately visible.
    routeView.innerHTML = renderRoute(appState.currentRoute);
    bindRouteEvents(appState.currentRoute);
    this.applyLanguage(nextLang);
  },
  
  applyLanguage(lang) {
    const dict = this.dictionaries[lang] || this.dictionaries[this.defaultLanguage];
    document.documentElement.lang = dict.htmlLang;

    const zhButton = document.querySelector('#language-zh');
    const enButton = document.querySelector('#language-en');
    
    if (zhButton && enButton) {
      zhButton.setAttribute('variant', lang === 'zh' ? 'filled' : 'outlined');
      enButton.setAttribute('variant', lang === 'en' ? 'filled' : 'outlined');
      zhButton.textContent = dict.languageZh;
      enButton.textContent = dict.languageEn;
    }

    const setText = (selector, value) => {
      if (!value) return;
      const el = document.querySelector(selector);
      if (el) el.textContent = value;
    };
    const setAttr = (selector, attr, value) => {
      if (!value) return;
      const el = document.querySelector(selector);
      if (el) el.setAttribute(attr, value);
    };

    setText('.topbar-actions mdui-button[href="#/home"]', dict.topHome);
    setText('.topbar-actions mdui-button[href="#/overview"]', dict.topOverview);
    setText('mdui-list-item[href="#/home"]', dict.drawerHome);
    setText('mdui-list-item[href="#/login"]', dict.drawerLogin);
    setText('mdui-list-item[href="#/overview"]', dict.drawerOverview);
    setText('mdui-list-item[href="#/collectors"]', dict.drawerCollectors);
    setText('mdui-list-item[href="#/rules"]', dict.drawerRules);
    setText('mdui-list-item[href="#/pushers"]', dict.drawerPushers);
    setText('.drawer-theme-panel .drawer-theme-title', dict.themeTitle);
    setText('#theme-mode-auto', dict.themeAuto);
    setText('#theme-mode-light', dict.themeLight);
    setText('#theme-mode-dark', dict.themeDark);
    setText('#preferences-toggle', dict.preferencesToggle);
    setText('.drawer-language-panel .drawer-color-title', dict.languageTitle);
    setText('.language-preview-text', dict.languagePreview);
    setText('.drawer-font-panel .drawer-color-title', dict.fontSizeTitle);
    setText('#font-size-sm', dict.fontSizeSm);
    setText('#font-size-base', dict.fontSizeBase);
    setText('#font-size-lg', dict.fontSizeLg);
    setText('.font-size-preview-text', dict.fontPreview);
    setText('.drawer-color-panel .drawer-color-title', dict.colorTitle);
    setText('.drawer-color-panel .drawer-color-title:nth-of-type(2)', dict.presetTitle);
    setText('#reset-colors-btn', dict.resetColors);
    setText('#save-colors-btn', dict.saveColors);

    setText('.login-card .panel-title', dict.loginTitle);
    setText('.login-card .panel-desc', dict.loginDesc);
    setText('.login-page-tips .login-tip-chip:nth-child(1)', dict.loginTip2fa);
    setText('.login-page-tips .login-tip-chip:nth-child(2)', dict.loginTipRecent);
    setText('.login-page-tips .login-tip-chip:nth-child(3)', dict.loginTipAuto);
    setText('.login-advanced summary', dict.loginAdvanced);
    const recentSelect = document.querySelector('#recent-account-select');
    if (recentSelect) recentSelect.setAttribute('label', dict.recentAccounts);
    setText('#delete-recent-account-btn', dict.deleteCurrent);
    setText('#clear-recent-accounts-btn', dict.clearAll);
    setText('.login-preferences .login-pref-item:nth-child(1) span', dict.rememberPassword);
    setText('.login-preferences .login-pref-item:nth-child(2) span', dict.autoLogin);
    setText('.login-actions mdui-button[type="submit"]', dict.loginButton);
    setText('#load-profile-btn', dict.loadProfile);
    setText('.login-note', dict.loginNote);
    setText('.recent-account-switches .panel-desc', dict.noRecentAccounts);
    setText('#recent-account-select mdui-menu-item[value=""]', dict.noRecentOptions);
    setAttr('#cas-login-form [name="student_id"]', 'label', lang === 'en' ? 'Student ID / Work ID' : '学号 / 工号');
    setAttr('#cas-login-form [name="password"]', 'label', lang === 'en' ? 'Password' : '密码');
    setAttr('#cas-login-form [name="api_base"]', 'label', lang === 'en' ? 'Backend API URL' : '后端 API 地址');
    setAttr('#cas-login-form [name="api_base"]', 'helper', lang === 'en' ? 'Defaults to local backend service' : '默认指向本地后端服务');
    if (appState.currentRoute === '/home') {
      setText('.section-kicker', dict.homeKicker);
      setText('.overview-section .section-head h1', dict.homeHeadline);
      setText('.overview-section .section-head p', dict.homeDesc);
      setText('.overview-actions mdui-button[href="#/login"]', dict.homeConnectCas);
      setText('.overview-actions mdui-button[href="#/overview"]', dict.homeViewOverview);
      setText('.summary-grid .summary-card:nth-child(1) .summary-label', dict.homePendingNotice);
      setText('.summary-grid .summary-card:nth-child(2) .summary-label', dict.homeActiveRules);
      setText('.summary-grid .summary-card:nth-child(3) .summary-label', dict.homeDeliveryRate);
      setText('.overview-section .panel-card .panel-title', dict.recentNotice);
    }

    if (appState.currentRoute === '/overview') {
      setText('.summary-grid .summary-card:nth-child(1) .summary-label', dict.overviewStudentId);
      const overviewName = document.querySelector('#overview-display-name');
      if (overviewName) overviewName.textContent = `${dict.overviewRealName}：${appState.realtime.user?.real_name || '--'}`;
      setText('.summary-grid .summary-card:nth-child(2) .summary-label', dict.overviewBackendHealth);
      setText('.summary-grid .summary-card:nth-child(2) .summary-note', dict.overviewHealthNote);
      setText('.summary-grid .summary-card:nth-child(3) .summary-label', dict.overviewUpdatedAt);
      const overviewLoading = document.querySelector('#overview-loading-note');
      if (overviewLoading) overviewLoading.textContent = appState.realtime.loading ? dict.overviewLoading : dict.overviewRefreshTip;
      setText('.main-grid .panel-card:nth-child(1) .panel-title', dict.overviewLoginPanel);
      setText('.main-grid .panel-card:nth-child(1) .overview-actions mdui-button[href="#/login"]', dict.goLogin);
      setText('#load-profile-btn', dict.refreshCurrentUser);
      setText('#refresh-overview-btn', dict.refreshRealtime);
      setText('.main-grid .panel-card:nth-child(2) .panel-title', dict.currentCookies);
      setText('#profile-card .panel-title', dict.profilePanel);
      setText('#profile-card .panel-desc', dict.profileDesc);
      setText('#profile-avatar-placeholder', dict.profilePlaceholder);
      setAttr('#profile-display-name', 'label', dict.profileNickname);
      setText('#save-profile-btn', dict.saveProfile);
    setText('#profile-avatar-file-trigger', dict.chooseAvatarFile);
    const avatarInputEl = document.querySelector('#profile-avatar-file');
    const avatarNameEl = document.querySelector('#profile-avatar-file-name');
    if (avatarNameEl && !avatarInputEl?.files?.[0]) avatarNameEl.textContent = dict.noFileSelected;
      setText('.main-grid .panel-card:last-child .panel-title', dict.recentNotice);
    }
    setText('.lower-grid .panel-card:nth-child(1) .panel-title', dict.collectorsTitle);
    setText('.lower-grid .panel-card:nth-child(1) .panel-desc', dict.collectorsDesc);
    setText('.lower-grid .panel-card:nth-child(1) .panel-title[style*="font-size:1rem"]', dict.collectorsSchedule);
    setText('#save-smart-campus-settings-btn', dict.saveSettings);
    setText('#sync-smart-campus-btn', dict.syncMessages);
    setText('#refresh-smart-campus-btn', dict.refreshLocal);
    const smartStatus = document.querySelector('#smart-campus-status');
    if (smartStatus && !appState.smartCampus.error) {
      smartStatus.textContent = appState.smartCampus.loading
        ? dict.syncingMessages
        : `${dict.latestUpdatedAt}：${appState.smartCampus.updatedAt || '--'}`;
    }
    setText('.lower-grid .panel-card:nth-child(2) .panel-title', dict.noticeList);
    setText('#apply-smart-campus-query-btn', dict.applyFilter);
    setText('#reset-smart-campus-query-btn', dict.reset);
    setAttr('#sc-schedule-mode', 'label', lang === 'en' ? 'Mode' : '调度模式');
    setAttr('#sc-visual-mode', 'label', lang === 'en' ? 'Visual Frequency' : '可视化频率');
    setAttr('#sc-interval-minutes', 'label', lang === 'en' ? 'Interval Minutes' : '间隔分钟');
    setAttr('#sc-daily-time', 'label', lang === 'en' ? 'Daily Time' : '每日时间');
    setAttr('#sc-cron-expr', 'label', lang === 'en' ? 'Cron Expression' : 'Cron 表达式');
    setAttr('#sc-cron-expr', 'helper', lang === 'en' ? 'Example: */30 * * * *' : '示例：*/30 * * * *');
    setAttr('#sc-search-q', 'label', lang === 'en' ? 'Keyword' : '关键词');
    setAttr('#sc-search-sender', 'label', lang === 'en' ? 'Sender' : '发送方');
    setAttr('#sc-read-state', 'label', lang === 'en' ? 'Read Filter' : '已读筛选');
    setAttr('#sc-sort-by', 'label', lang === 'en' ? 'Sort Field' : '排序字段');
    setAttr('#sc-sort-dir', 'label', lang === 'en' ? 'Order' : '顺序');
    setAttr('#two-factor-dialog', 'headline', dict.twoFaHeadline);
    setText('#two-factor-dialog .two-factor-hint', dict.twoFaHint);
    setAttr('#two-factor-method-field', 'label', dict.twoFaMethodLabel);
    setText('#two-factor-method-field mdui-menu-item[value="sms_code"]', dict.twoFaSmsMethod);
    setText('#two-factor-method-field mdui-menu-item[value="wechat_qr"]', dict.twoFaWechatMethod);
    setAttr('#two-factor-code-field', 'label', dict.twoFaCodeLabel);
    setAttr('#two-factor-code-field', 'helper', dict.twoFaCodeHelper);
    setText('#send-2fa-code-btn', dict.twoFaSendSms);
    setText('#verify-2fa-btn', dict.twoFaSubmitCode);
    setText('.wechat-qr-hint', dict.twoFaWechatHint);
    setText('#open-wechat-2fa-btn', dict.twoFaGetWechatQr);
    setText('#close-2fa-dialog-btn', dict.twoFaLater);
    if (!appState.smartCampus.messages?.length) {
      const emptyNotice = document.querySelector('#smart-campus-list .panel-desc');
      if (emptyNotice) emptyNotice.textContent = dict.noNoticesHint;
    }
    if (appState.currentRoute === '/rules') {
      setText('.lower-grid .panel-card:nth-child(1) .panel-title', dict.triggerCondition);
      setText('.lower-grid .panel-card:nth-child(1) .simple-row strong', dict.keywordPriority);
      setText('.lower-grid .panel-card:nth-child(1) .simple-row p', dict.triggerDesc);
      setText('.lower-grid .panel-card:nth-child(2) .panel-title', dict.msgTemplate);
      setText('.lower-grid .panel-card:nth-child(2) .simple-row strong', dict.textTemplate);
      setText('.lower-grid .panel-card:nth-child(2) .simple-row p', dict.msgTemplateDesc);
      setText('.lower-grid .panel-card:nth-child(3) .panel-title', dict.channelRoute);
      setText('.lower-grid .panel-card:nth-child(3) .simple-row strong', dict.multiChannel);
      setText('.lower-grid .panel-card:nth-child(3) .simple-row p', dict.channelDesc);
      setText('.lower-grid .panel-card:nth-child(4) .panel-title', `${dict.rulesTitle} - ${dict.nextSteps}`);
      setText('.lower-grid .panel-card:nth-child(4) .steps li:nth-child(1)', dict.doneBackend);
      setText('.lower-grid .panel-card:nth-child(4) .steps li:nth-child(2)', dict.fillForms);
      setText('.lower-grid .panel-card:nth-child(4) .steps li:nth-child(3)', dict.addTests);
    }
    if (appState.currentRoute === '/pushers') {
      setText('.lower-grid .panel-card:nth-child(1) .panel-title', 'OneBot');
      setText('.lower-grid .panel-card:nth-child(1) .simple-row strong', dict.qqBot);
      setText('.lower-grid .panel-card:nth-child(1) .simple-row p', dict.qqBotDesc);
      setText('.lower-grid .panel-card:nth-child(2) .panel-title', 'WxPusher');
      setText('.lower-grid .panel-card:nth-child(2) .simple-row strong', dict.wxPush);
      setText('.lower-grid .panel-card:nth-child(2) .simple-row p', dict.wxPushDesc);
      setText('.lower-grid .panel-card:nth-child(3) .panel-title', dict.feishu);
      setText('.lower-grid .panel-card:nth-child(3) .simple-row strong', 'Webhook Bot');
      setText('.lower-grid .panel-card:nth-child(3) .simple-row p', dict.feishuDesc);
      setText('.lower-grid .panel-card:nth-child(4) .panel-title', `${dict.pushersTitle} - ${dict.nextSteps}`);
      setText('.lower-grid .panel-card:nth-child(4) .steps li:nth-child(1)', dict.doneBackend);
      setText('.lower-grid .panel-card:nth-child(4) .steps li:nth-child(2)', dict.fillForms);
      setText('.lower-grid .panel-card:nth-child(4) .steps li:nth-child(3)', dict.addTests);
    }

    if (appState.lastStatus?.message === this.dictionaries.zh.untouchedStatus
      || appState.lastStatus?.message === this.dictionaries.en.untouchedStatus) {
      setStatus(dict.untouchedStatus, 'muted');
    }
  },
  
  bindEvents() {
    const zhButton = document.querySelector('#language-zh');
    const enButton = document.querySelector('#language-en');
    
    if (zhButton) {
      zhButton.addEventListener('click', () => this.setLanguage('zh'));
    }
    
    if (enButton) {
      enButton.addEventListener('click', () => this.setLanguage('en'));
    }
  },
  
  init() {
    const lang = this.dictionaries[this.getLanguage()] ? this.getLanguage() : this.defaultLanguage;
    this.applyLanguage(lang);
    this.bindEvents();
  }
};

// 初始化字体大小
FontSizeManager.init();

// 初始化语言设置
LanguageManager.init();

// 初始化偏好设置展开/折叠功能
const preferencesToggle = document.querySelector('#preferences-toggle');
const preferencesPanel = document.querySelector('#preferences-panel');

if (preferencesToggle && preferencesPanel) {
  preferencesToggle.addEventListener('click', () => {
    const isVisible = preferencesPanel.style.display !== 'none';
    preferencesPanel.style.display = isVisible ? 'none' : 'block';
    
    // 切换图标
    const iconElement = preferencesToggle.querySelector('mdui-icon');
    if (iconElement) {
      iconElement.setAttribute('icon', isVisible ? 'settings' : 'expand_less');
    }
  });
}

void restoreSavedSession();
if (!window.location.hash) navigateTo('/home');
handleRouteChange();
