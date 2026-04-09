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

function renderHome() {
  return `
    <section class="overview-section">
      <div class="section-head">
        <div>
          <div class="section-kicker">控制台主页</div>
          <h1>把分散在各系统里的提醒集中管理</h1>
          <p>阶段一已支持 CAS 登录、2FA、会话持久化与消息概览。</p>
        </div>
        <div class="overview-actions">
          <mdui-button variant="filled" href="#/login">连接 CAS</mdui-button>
          <mdui-button variant="outlined" href="#/overview">查看概览</mdui-button>
        </div>
      </div>
      <div class="summary-grid">
        <mdui-card class="summary-card"><div class="summary-label">待处理通知</div><div class="summary-value">17</div></mdui-card>
        <mdui-card class="summary-card"><div class="summary-label">活跃规则</div><div class="summary-value">8</div></mdui-card>
        <mdui-card class="summary-card"><div class="summary-label">渠道送达率</div><div class="summary-value">98.6%</div></mdui-card>
      </div>
      <mdui-card class="panel-card">
        <div class="panel-title">最近通知</div>
        <div class="timeline" id="home-timeline-list"></div>
      </mdui-card>
    </section>
  `;
}

function renderLogin() {
  const apiBase = localStorage.getItem(storageKeys.apiBase) || 'http://127.0.0.1:8000';
  const selectedRecent = loginAccountManager.getPreferredRecentAccountId();
  return `
    <section class="login-page">
      <mdui-card class="panel-card login-card">
        <div class="panel-title">登录</div>
        <p class="panel-desc">请使用桂电统一身份认证账号(智慧校园账号)登录。</p>
        <form id="cas-login-form" class="login-form">
          <mdui-text-field name="student_id" label="学号 / 工号" variant="outlined" required></mdui-text-field>
          <mdui-text-field name="password" type="password" toggle-password label="密码" variant="outlined" required></mdui-text-field>
          <mdui-text-field name="api_base" label="后端 API 地址" variant="outlined" value="${apiBase}" helper="默认指向本地后端服务"></mdui-text-field>
          <mdui-select id="recent-account-select" label="最近登录账号" variant="outlined" value="${selectedRecent}">
            ${loginAccountManager.renderRecentAccountOptions()}
          </mdui-select>
          <div class="recent-account-tools">
            <button type="button" class="recent-account-tool-btn" id="delete-recent-account-btn">删除当前历史账号</button>
            <button type="button" class="recent-account-tool-btn danger" id="clear-recent-accounts-btn">清空全部历史账号</button>
          </div>
          <div class="recent-account-switches" id="recent-account-switches">
            ${loginAccountManager.renderRecentAccountQuickSwitch()}
          </div>
          <div class="login-preferences">
            <label class="login-pref-item">
              <input id="remember-password" type="checkbox" />
              <span>保存密码</span>
            </label>
            <label class="login-pref-item">
              <input id="auto-login" type="checkbox" />
              <span>自动登录</span>
            </label>
          </div>
          <div class="login-actions">
            <mdui-button type="submit" variant="filled">登录</mdui-button>
            <mdui-button type="button" variant="text" id="load-profile-btn">读取当前用户</mdui-button>
          </div>
        </form>
        <div id="login-status" class="result-card muted">尚未发起登录。</div>
      </mdui-card>
    </section>
  `;
}

function renderOverview() {
  const realtime = appState.realtime;
  const userStudentId = realtime.user?.student_id || '--';
  const userRealName = realtime.user?.real_name || '--';
  const avatar = realtime.user?.avatar_base64 || '';
  const healthStatus = realtime.health?.status || '--';
  const updatedAt = realtime.updatedAt || '--';
  const cookieLines = appState.lastLoginResult?.cas_cookies?.length
    ? formatCookies(appState.lastLoginResult.cas_cookies)
    : appState.storedCookies?.length
      ? formatCookies(appState.storedCookies)
    : '当前会话暂无 Cookies 记录。';
  return `
    <section>
      <div class="summary-grid">
        <mdui-card class="summary-card">
          <div class="summary-label">当前学号</div>
          <div class="summary-value" id="overview-student-id">${userStudentId}</div>
          <div class="summary-note" id="overview-display-name">真实姓名：${userRealName}</div>
        </mdui-card>
        <mdui-card class="summary-card">
          <div class="summary-label">后端状态</div>
          <div class="summary-value" id="overview-health">${healthStatus}</div>
          <div class="summary-note">来自 /health 实时查询</div>
        </mdui-card>
        <mdui-card class="summary-card">
          <div class="summary-label">最后刷新时间</div>
          <div class="summary-value" id="overview-updated-at">${updatedAt}</div>
          <div class="summary-note" id="overview-loading-note">${realtime.loading ? '正在刷新…' : '点击按钮可手动刷新'}</div>
        </mdui-card>
      </div>
      <section class="main-grid">
      <mdui-card class="panel-card">
        <div class="panel-title">登录与用户概览</div>
        <div id="login-status" class="result-card ${appState.lastStatus.type}">${appState.lastStatus.message}</div>
        <div class="overview-actions" style="margin-top:0.8rem">
          <mdui-button variant="filled" href="#/login">去登录页</mdui-button>
          <mdui-button type="button" variant="outlined" id="load-profile-btn">刷新当前用户</mdui-button>
          <mdui-button type="button" variant="outlined" id="refresh-overview-btn">刷新实时数据</mdui-button>
        </div>
        <div id="overview-error" class="result-card error" style="margin-top:0.8rem;${realtime.error ? '' : 'display:none;'}">${realtime.error || ''}</div>
      </mdui-card>
      <mdui-card class="panel-card">
        <div class="panel-title">本次登录 Cookies</div>
        <div id="overview-cookie-box" class="result-card muted">${cookieLines}</div>
      </mdui-card>
      <mdui-card class="panel-card" id="profile-card" style="grid-column:1 / -1">
        <div class="panel-title">昵称与头像（隐私）</div>
        <p class="panel-desc">可设置对外显示昵称</p>
        <div class="profile-editor">
          <div class="profile-avatar-wrap">
            <img id="profile-avatar-preview" class="profile-avatar" src="${avatar || ''}" alt="头像预览" style="${avatar ? '' : 'display:none;'}" />
            <div id="profile-avatar-placeholder" class="profile-avatar-placeholder" style="${avatar ? 'display:none;' : ''}">未设置头像</div>
          </div>
          <div class="profile-fields">
            <mdui-text-field id="profile-display-name" label="昵称" variant="outlined" value="${realtime.user?.display_name || ''}"></mdui-text-field>
            <input id="profile-avatar-file" type="file" accept="image/*" />
            <mdui-button id="save-profile-btn" variant="filled">保存昵称与头像</mdui-button>
          </div>
        </div>
      </mdui-card>
      <mdui-card class="panel-card" style="grid-column:1 / -1">
        <div class="panel-title">最近通知</div>
        <div class="timeline" id="overview-timeline-list"></div>
      </mdui-card>
      </section>
    </section>
  `;
}

function renderCollectors() {
  const sc = appState.smartCampus;
  const s = sc.setting || {};
  const q = sc.query || {};
  const rows = (sc.messages || [])
    .map((item) => `
      <article class="timeline-item">
        <header>
          <strong>${item.sender || '系统通知'}</strong>
          <time>${item.occurred_at_text || item.fetched_at || '--'}</time>
        </header>
        <div class="timeline-title">${item.title || '(无标题)'}</div>
        <p style="margin:0.25rem 0;color:var(--guet-muted);font-size:0.85rem;">状态：${item.is_marked_read ? '已读' : '未读'} | ID：${item.external_id || '--'}</p>
        <p>${item.content_text || item.content_html || ''}</p>
      </article>
    `)
    .join('');
  return `
    <section class="lower-grid">
      <mdui-card class="panel-card" style="grid-column:1 / -1">
        <div class="panel-title">智慧校园通知采集器</div>
        <p class="panel-desc">数据源：pcportal 消息中心 receiveBox。同步后会标记已读</p>
        <div class="panel-title" style="font-size:1rem;margin-top:0.8rem;">采集时间设置</div>
        <div class="overview-actions" style="margin-top:0.6rem;flex-wrap:wrap;">
          <mdui-select id="sc-schedule-mode" value="${s.schedule_mode || 'visual'}" label="调度模式" variant="outlined" style="min-width:180px;">
            <mdui-menu-item value="visual">可视化</mdui-menu-item>
            <mdui-menu-item value="cron">Cron 表达式</mdui-menu-item>
          </mdui-select>
          <mdui-switch id="sc-enabled-switch" ${s.enabled ? 'checked' : ''}>启用采集器</mdui-switch>
        </div>
        <div id="sc-visual-settings" style="${(s.schedule_mode || 'visual') === 'visual' ? '' : 'display:none;'}">
          <div class="overview-actions" style="margin-top:0.6rem;flex-wrap:wrap;">
            <mdui-select id="sc-visual-mode" value="${s.visual_mode || 'every_n_minutes'}" label="可视化频率" variant="outlined" style="min-width:180px;">
              <mdui-menu-item value="every_n_minutes">每 N 分钟</mdui-menu-item>
              <mdui-menu-item value="daily_time">每天固定时间</mdui-menu-item>
            </mdui-select>
            <mdui-text-field id="sc-interval-minutes" type="number" label="间隔分钟" variant="outlined" min="1" max="1440" value="${s.interval_minutes || 30}" style="min-width:160px;"></mdui-text-field>
            <mdui-text-field id="sc-daily-time" type="time" label="每日时间" variant="outlined" value="${s.daily_time || '08:00'}" style="min-width:160px;"></mdui-text-field>
          </div>
        </div>
        <div id="sc-cron-settings" style="${(s.schedule_mode || 'visual') === 'cron' ? '' : 'display:none;'}">
          <mdui-text-field id="sc-cron-expr" label="Cron 表达式" variant="outlined" value="${s.cron_expr || '*/30 * * * *'}" helper="示例：*/30 * * * *"></mdui-text-field>
        </div>
        <div class="overview-actions" style="margin-top:0.8rem">
          <mdui-button type="button" variant="tonal" id="save-smart-campus-settings-btn">保存设置</mdui-button>
          <mdui-button type="button" variant="filled" id="sync-smart-campus-btn">同步通知</mdui-button>
          <mdui-button type="button" variant="outlined" id="refresh-smart-campus-btn">刷新本地记录</mdui-button>
        </div>
        <div id="smart-campus-status" class="result-card ${sc.error ? 'error' : 'muted'}" style="margin-top:0.8rem">
          ${sc.error ? sc.error : (sc.loading ? '正在同步智慧校园通知…' : `最近更新时间：${sc.updatedAt || '--'}`)}
        </div>
      </mdui-card>
      <mdui-card class="panel-card" style="grid-column:1 / -1">
        <div class="panel-title">通知列表</div>
        <div class="overview-actions" style="margin:0.6rem 0;flex-wrap:wrap;">
          <mdui-text-field id="sc-search-q" label="关键词" variant="outlined" value="${q.q || ''}" style="min-width:220px;"></mdui-text-field>
          <mdui-text-field id="sc-search-sender" label="发送方" variant="outlined" value="${q.sender || ''}" style="min-width:180px;"></mdui-text-field>
          <mdui-select id="sc-read-state" value="${q.read_state || 'all'}" label="已读筛选" variant="outlined" style="min-width:140px;">
            <mdui-menu-item value="all">全部</mdui-menu-item>
            <mdui-menu-item value="read">仅已读</mdui-menu-item>
            <mdui-menu-item value="unread">仅未读</mdui-menu-item>
          </mdui-select>
          <mdui-select id="sc-sort-by" value="${q.sort_by || 'fetched_at'}" label="排序字段" variant="outlined" style="min-width:160px;">
            <mdui-menu-item value="fetched_at">采集时间</mdui-menu-item>
            <mdui-menu-item value="occurred_at_text">通知时间</mdui-menu-item>
            <mdui-menu-item value="title">标题</mdui-menu-item>
            <mdui-menu-item value="sender">发送方</mdui-menu-item>
          </mdui-select>
          <mdui-select id="sc-sort-dir" value="${q.sort_dir || 'desc'}" label="顺序" variant="outlined" style="min-width:120px;">
            <mdui-menu-item value="desc">降序</mdui-menu-item>
            <mdui-menu-item value="asc">升序</mdui-menu-item>
          </mdui-select>
          <mdui-button type="button" variant="outlined" id="apply-smart-campus-query-btn">应用筛选</mdui-button>
          <mdui-button type="button" variant="text" id="reset-smart-campus-query-btn">重置</mdui-button>
        </div>
        <div id="smart-campus-list" class="timeline">${rows || '<p class="panel-desc">暂无通知，先点击“同步通知”。</p>'}</div>
      </mdui-card>
    </section>
  `;
}

function renderSkeleton(title, rows) {
  return `
    <section class="lower-grid">
      ${rows
        .map(
          (row) => `
        <mdui-card class="panel-card">
          <div class="panel-title">${row.title}</div>
          <div class="simple-row">
            <div><strong>${row.label}</strong><p>${row.desc}</p></div>
            <mdui-chip>${row.status}</mdui-chip>
          </div>
        </mdui-card>
      `,
        )
        .join('')}
      <mdui-card class="panel-card" style="grid-column:1 / -1">
        <div class="panel-title">${title} - 下一步</div>
        <ol class="steps">
          <li>完成后端接口定义与鉴权策略。</li>
          <li>补齐增删改查表单和保存逻辑。</li>
          <li>接入变更日志与测试用例。</li>
        </ol>
      </mdui-card>
    </section>
  `;
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
  applyThemeByPreference(getPreferredThemeMode());
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', (event) => {
    if (getPreferredThemeMode() === 'auto') applyTheme(event.matches ? 'dark' : 'light', 'auto');
  });
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
  if (appState.currentRoute !== '/collectors') return;
  const sc = appState.smartCampus;
  const statusNode = document.querySelector('#smart-campus-status');
  const listNode = document.querySelector('#smart-campus-list');
  if (statusNode) {
    statusNode.className = `result-card ${sc.error ? 'error' : 'muted'}`;
    statusNode.textContent = sc.error ? sc.error : (sc.loading ? '正在同步智慧校园通知…' : `最近更新时间：${sc.updatedAt || '--'}`);
  }
  if (listNode) {
    if (!sc.messages.length) {
      listNode.innerHTML = '<p class="panel-desc">暂无通知，先点击“同步通知”。</p>';
      return;
    }
    listNode.innerHTML = sc.messages
      .map((item) => `
      <article class="timeline-item">
        <header><strong>${item.sender || '系统通知'}</strong><time>${item.occurred_at_text || item.fetched_at || '--'}</time></header>
        <div class="timeline-title">${item.title || '(无标题)'}</div>
        <p>${item.content_text || item.content_html || ''}</p>
      </article>
    `)
      .join('');
  }
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

void restoreSavedSession();
if (!window.location.hash) navigateTo('/home');
handleRouteChange();
