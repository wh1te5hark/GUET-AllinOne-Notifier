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
    if (colorPrimaryInput) {
      colorPrimaryInput.addEventListener('input', (e) => {
        const colors = this.getColors();
        colors.primary = e.target.value;
        this.applyColors(colors);
      });
    }
    if (colorAccentInput) {
      colorAccentInput.addEventListener('input', (e) => {
        const colors = this.getColors();
        colors.accent = e.target.value;
        this.applyColors(colors);
      });
    }
    if (colorDangerInput) {
      colorDangerInput.addEventListener('input', (e) => {
        const colors = this.getColors();
        colors.danger = e.target.value;
        this.applyColors(colors);
      });
    }
    if (presetColorsContainer) {
      presetColorsContainer.addEventListener('click', (e) => {
        const presetColor = e.target.closest('.preset-color');
        if (presetColor) {
          const color = presetColor.dataset.color;
          const colors = this.getColors();
          colors.primary = color;
          this.applyColors(colors);
        }
      });
    }
    if (resetColorsButton) {
      resetColorsButton.addEventListener('click', () => {
        this.applyColors(this.defaultColors);
      });
    }
    if (saveColorsButton) {
      saveColorsButton.addEventListener('click', () => {
        const colors = this.getColors();
        if (colorPrimaryInput) colors.primary = colorPrimaryInput.value;
        if (colorAccentInput) colors.accent = colorAccentInput.value;
        if (colorDangerInput) colors.danger = colorDangerInput.value;
        this.saveColors(colors);
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
    document.querySelector('#overview-loading-note')?.parentElement?.addEventListener('click', () => fetchOverviewRealtime());
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
    const debouncedApplyQuery = debounce(() => void applySmartCampusQuery(), 300);
    document.querySelector('#sc-search-q')?.addEventListener('input', debouncedApplyQuery);
    document.querySelector('#sc-search-sender')?.addEventListener('input', debouncedApplyQuery);
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
    void loadSmartCampusSettings(true).then(() => applySmartCampusToDom());
    void loadSmartCampusMessages(true).then(() => applySmartCampusToDom());
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
  
  // 显示骨架屏
  showSkeleton(route);
  
  // 延迟渲染实际内容，模拟网络加载
  setTimeout(() => {
    routeView.innerHTML = renderRoute(route);
    bindRouteEvents(route);
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

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
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

// 初始化字体大小
FontSizeManager.init();

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
