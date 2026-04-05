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
};

let pendingChallenge = null;
let pendingMethods = [];
let wechatPollTimer = null;

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
  const label = user ? `${user.display_name || user.student_id}` : '未登录';
  if (topAccount) topAccount.textContent = label;
  if (drawerAccount) drawerAccount.textContent = user ? `当前账号：${label}` : '统一消息推送平台';
  if (topAvatarName) topAvatarName.textContent = user ? `${label} (${user.student_id || ''})` : '未登录';
  const avatar = user?.avatar_base64 || '';
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
  if (!twoFactorStatusEl) return;
  twoFactorStatusEl.textContent = message;
  twoFactorStatusEl.className = `two-factor-status visible ${type}`;
}

function clear2faStatus() {
  if (!twoFactorStatusEl) return;
  twoFactorStatusEl.textContent = '';
  twoFactorStatusEl.className = 'two-factor-status';
}

function stopWechatPolling() {
  if (!wechatPollTimer) return;
  clearTimeout(wechatPollTimer);
  wechatPollTimer = null;
}

function updateMethodPanels() {
  const method = twoFactorMethodField?.value || 'sms_code';
  if (smsPanel) smsPanel.style.display = method === 'sms_code' ? '' : 'none';
  if (wechatPanel) wechatPanel.style.display = method === 'wechat_qr' ? '' : 'none';
  if (method !== 'wechat_qr') stopWechatPolling();
}

function resetTwoFactorState() {
  pendingChallenge = null;
  pendingMethods = [];
  stopWechatPolling();
  if (twoFactorCodeField) twoFactorCodeField.value = '';
  if (twoFactorMethodField) twoFactorMethodField.value = 'sms_code';
  if (wechatQrImg) {
    wechatQrImg.style.display = 'none';
    wechatQrImg.src = '';
  }
  if (wechatQrOverlay) wechatQrOverlay.style.display = 'none';
  clear2faStatus();
}

function closeTwoFactorDialog() {
  stopWechatPolling();
  if (twoFactorDialog) twoFactorDialog.open = false;
}

function openTwoFactorDialog(methods = []) {
  pendingMethods = methods;
  if (twoFactorMethodField) twoFactorMethodField.value = methods.includes('sms_code') ? 'sms_code' : 'wechat_qr';
  if (twoFactorCodeField) twoFactorCodeField.value = '';
  clear2faStatus();
  updateMethodPanels();
  if (twoFactorDialog) twoFactorDialog.open = true;
}

function renderTimeline(containerId) {
  const container = document.querySelector(`#${containerId}`);
  if (!container) return;
  container.innerHTML = timelineData
    .map(
      (item) => `
      <article class="timeline-item">
        <header><strong>${item.source}</strong><time>${item.time}</time></header>
        <div class="timeline-title">${item.title}</div>
        <p>${item.detail}</p>
      </article>
    `,
    )
    .join('');
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
  return `
    <section>
      <mdui-card class="panel-card login-card">
        <div class="panel-title">CAS 登录</div>
        <p class="panel-desc">登录后会保存访问令牌与本次 CAS Cookies。</p>
        <form id="cas-login-form" class="login-form">
          <mdui-text-field name="student_id" label="学号 / 工号" variant="outlined" required></mdui-text-field>
          <mdui-text-field name="password" type="password" toggle-password label="CAS 密码" variant="outlined" required></mdui-text-field>
          <mdui-text-field name="api_base" label="后端 API 地址" variant="outlined" value="${apiBase}" helper="默认指向本地 backend 服务"></mdui-text-field>
          <div class="login-actions">
            <mdui-button type="submit" variant="filled">登录并保存 Cookie</mdui-button>
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
  const userDisplayName = realtime.user?.display_name || '--';
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
          <div class="summary-note" id="overview-display-name">显示名：${userDisplayName}</div>
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
        <p class="panel-desc">可设置对外显示昵称，头像将以 base64 文本存储在数据库。</p>
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

function renderRoute(route) {
  if (route === '/home') return renderHome();
  if (route === '/login') return renderLogin();
  if (route === '/overview') return renderOverview();
  if (route === '/collectors') {
    return renderSkeleton('采集器', [
      { title: '教务采集器', label: 'CAS / 教务', desc: '安装、配置与运行状态管理。', status: '骨架' },
      { title: '畅课采集器', label: '畅课', desc: '课程作业、公告同步配置。', status: '骨架' },
      { title: '能耗采集器', label: '电费 / 水费', desc: '阈值与周期采集策略。', status: '骨架' },
    ]);
  }
  if (route === '/rules') {
    return renderSkeleton('转发规则', [
      { title: '触发条件', label: '关键词 / 优先级', desc: '支持包含、排除、正则等条件。', status: '骨架' },
      { title: '消息模板', label: '文本模板', desc: '主题、正文、变量映射占位。', status: '骨架' },
      { title: '渠道路由', label: '多渠道', desc: '按规则选择推送渠道。', status: '骨架' },
    ]);
  }
  if (route === '/pushers') {
    return renderSkeleton('推送器', [
      { title: 'OneBot', label: 'QQ 机器人', desc: '连接地址与鉴权配置。', status: '骨架' },
      { title: 'WxPusher', label: '微信推送', desc: 'AppToken 与 UID 管理。', status: '骨架' },
      { title: '飞书', label: 'Webhook 机器人', desc: '签名与路由配置。', status: '骨架' },
    ]);
  }
  return '';
}

function bindRouteEvents(route) {
  if (route === '/login' || route === '/overview') {
    document.querySelector('#load-profile-btn')?.addEventListener('click', loadProfile);
    applyStatusToPage();
  }
  if (route === '/login') {
    document.querySelector('#cas-login-form')?.addEventListener('submit', handleLogin);
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
}

function applyRealtimeToOverviewDom() {
  if (appState.currentRoute !== '/overview') return;
  const realtime = appState.realtime;
  const student = document.querySelector('#overview-student-id');
  const displayName = document.querySelector('#overview-display-name');
  const health = document.querySelector('#overview-health');
  const updatedAt = document.querySelector('#overview-updated-at');
  const loadingNote = document.querySelector('#overview-loading-note');
  const errorBox = document.querySelector('#overview-error');
  const cookieBox = document.querySelector('#overview-cookie-box');
  if (student) student.textContent = realtime.user?.student_id || '--';
  if (displayName) displayName.textContent = `显示名：${realtime.user?.display_name || '--'}`;
  if (health) health.textContent = realtime.health?.status || '--';
  if (updatedAt) updatedAt.textContent = realtime.updatedAt || '--';
  if (loadingNote) loadingNote.textContent = realtime.loading ? '正在刷新…' : '点击按钮可手动刷新';
  if (errorBox) {
    errorBox.textContent = realtime.error || '';
    errorBox.style.display = realtime.error ? '' : 'none';
  }
  if (cookieBox) {
    const lines = appState.lastLoginResult?.cas_cookies?.length
      ? formatCookies(appState.lastLoginResult.cas_cookies)
      : appState.storedCookies?.length
        ? formatCookies(appState.storedCookies)
        : '当前会话暂无 Cookies 记录。';
    cookieBox.textContent = lines;
  }
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
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getPreferredThemeMode() {
  const stored = localStorage.getItem(storageKeys.themeMode);
  if (stored === 'light' || stored === 'dark' || stored === 'auto') return stored;
  return 'auto';
}

function updateThemeButton(mode) {
  if (!themeToggle) return;
  themeToggle.icon = mode === 'dark' ? 'light_mode' : 'dark_mode';
}

function updateThemeModeButtons(preference) {
  if (!themeModeAutoButton || !themeModeLightButton || !themeModeDarkButton) return;
  themeModeAutoButton.variant = preference === 'auto' ? 'filled' : 'outlined';
  themeModeLightButton.variant = preference === 'light' ? 'filled' : 'outlined';
  themeModeDarkButton.variant = preference === 'dark' ? 'filled' : 'outlined';
}

function applyTheme(mode, preference = 'light') {
  const normalized = mode === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = normalized;
  localStorage.setItem(storageKeys.themeMode, preference);
  updateThemeButton(normalized);
  updateThemeModeButtons(preference);
  if (window.mdui?.setTheme) window.mdui.setTheme(normalized);
  if (window.mdui?.setColorScheme) window.mdui.setColorScheme(themeColors[normalized]);
}

function applyThemeByPreference(preference) {
  if (preference === 'auto') {
    applyTheme(getSystemThemeMode(), 'auto');
    return;
  }
  applyTheme(preference, preference);
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
  if (topAvatarPanel) topAvatarPanel.hidden = true;
  updateAccountDisplay();
}

async function syncCurrentUser({ silent = false } = {}) {
  const token = getToken();
  if (!token) {
    appState.currentUser = null;
    updateAccountDisplay();
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
  localStorage.setItem(storageKeys.token, data.access_token);
  appState.lastLoginResult = data;
  setStatus('登录成功，正在同步当前账号信息…', 'success');
  closeTwoFactorDialog();
  resetTwoFactorState();
  void syncCurrentUser({ silent: true });
  navigateTo('/overview');
}

async function handleLogin(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const apiBase = String(formData.get('api_base') || '').trim().replace(/\/$/, '');
  saveApiBase(apiBase);
  setStatus('正在请求 backend 登录接口，请稍候…');
  try {
    const response = await fetch(`${apiBase}/api/v1/auth/cas/login`, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: formData.get('student_id'), password: formData.get('password') }),
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
    setStatus(`登录失败：${error.message}`, 'error');
  }
}

async function verifyTwoFactorCode() {
  const apiBase = getApiBase();
  const code = twoFactorCodeField.value.trim();
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
  if (wechatQrImg) {
    wechatQrImg.style.display = 'none';
    wechatQrImg.src = '';
  }
  if (wechatQrOverlay) wechatQrOverlay.style.display = 'none';
  try {
    const response = await fetch(`${apiBase}/api/v1/auth/cas/2fa/wechat/init`, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challenge_id: pendingChallenge }),
    });
    const data = await parseJsonSafely(response);
    if (!response.ok) throw new Error(formatApiError(data.detail, `获取失败（${response.status}）`));
    if (wechatQrImg) {
      wechatQrImg.src = data.qr_image_url;
      wechatQrImg.style.display = 'block';
    }
    set2faStatus('请使用微信扫描下方二维码。', 'info');
    startWechatPolling();
  } catch (error) {
    set2faStatus(`获取二维码失败：${error.message}`, 'error');
  }
}

function startWechatPolling() {
  stopWechatPolling();
  pollWechatStatus();
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
      wechatPollTimer = setTimeout(pollWechatStatus, 2000);
      return;
    }
    if (st === 'scanned') {
      set2faStatus('已扫码，请在手机上确认。', 'info');
      if (wechatQrOverlay) {
        wechatQrOverlay.textContent = '已扫码，请确认';
        wechatQrOverlay.style.display = 'flex';
      }
      wechatPollTimer = setTimeout(pollWechatStatus, 1500);
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

async function loadProfile() {
  setStatus('正在读取当前用户信息…');
  const data = await syncCurrentUser();
  if (!data) return;
  await loadStoredCookies();
  setStatus(`当前用户\nID：${data.id}\n学号：${data.student_id}\n显示名：${data.display_name || '未设置'}`, 'success');
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
  } catch (error) {
    appState.storedCookies = [];
    return [];
  }
}

async function fetchOverviewRealtime(silent = false) {
  const token = getToken();
  if (!token) {
    appState.realtime.error = '未登录，无法请求概览数据。';
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
    appState.realtime.error = `实时数据获取失败：${error.message}`;
  } finally {
    appState.realtime.loading = false;
    if (!silent) setStatus('概览实时数据已更新。', 'success');
    applyRealtimeToOverviewDom();
  }
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

async function restoreSavedSession() {
  updateAccountDisplay();
  if (!getToken()) return;
  const user = await syncCurrentUser({ silent: true });
  if (user) await loadStoredCookies();
  if (user) setStatus(`已恢复登录态：${user.display_name || user.student_id}`, 'success');
}

function toggleAvatarMenu(forceOpen) {
  if (!topAvatarPanel) return;
  const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : topAvatarPanel.hidden;
  topAvatarPanel.hidden = !shouldOpen;
}

function handleLogout() {
  clearLocalAuth();
  setStatus('已登出，可重新登录或切换账号。', 'muted');
  navigateTo('/login');
}

menuToggle?.addEventListener('click', () => {
  drawer.open = !drawer.open;
});
themeToggle?.addEventListener('click', () => {
  const current = document.documentElement.dataset.theme || 'light';
  applyTheme(current === 'dark' ? 'light' : 'dark', current === 'dark' ? 'light' : 'dark');
});
themeModeAutoButton?.addEventListener('click', () => {
  applyThemeByPreference('auto');
  drawer.open = false;
});
themeModeLightButton?.addEventListener('click', () => {
  applyThemeByPreference('light');
  drawer.open = false;
});
themeModeDarkButton?.addEventListener('click', () => {
  applyThemeByPreference('dark');
  drawer.open = false;
});
drawer?.querySelectorAll('mdui-list-item[href]').forEach((node) => {
  node.addEventListener('click', () => {
    if (window.matchMedia('(max-width: 1024px)').matches) drawer.open = false;
  });
});
topAvatarTrigger?.addEventListener('click', () => toggleAvatarMenu());
menuProfileButton?.addEventListener('click', () => {
  toggleAvatarMenu(false);
  navigateTo('/overview');
  requestAnimationFrame(() => {
    document.querySelector('#profile-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});
menuLogoutButton?.addEventListener('click', () => {
  toggleAvatarMenu(false);
  handleLogout();
});
document.addEventListener('click', (event) => {
  if (!topAvatarPanel || topAvatarPanel.hidden) return;
  const insidePanel = topAvatarPanel.contains(event.target);
  const isTrigger = topAvatarTrigger?.contains(event.target);
  if (!insidePanel && !isTrigger) topAvatarPanel.hidden = true;
});

window.addEventListener('hashchange', handleRouteChange);
twoFactorMethodField?.addEventListener('change', updateMethodPanels);
verify2faButton?.addEventListener('click', verifyTwoFactorCode);
send2faCodeButton?.addEventListener('click', sendTwoFactorCode);
openWeChat2faButton?.addEventListener('click', initiateWeChatQr);
close2faDialogButton?.addEventListener('click', closeTwoFactorDialog);

initTheme();
resetTwoFactorState();
updateAccountDisplay();
void restoreSavedSession();
if (!window.location.hash) navigateTo('/home');
handleRouteChange();
