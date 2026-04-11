export function createUiManager({
  storageKeys,
  themeColors,
  elements,
  navigateTo,
  clearLocalAuth,
  setStatus,
}) {
  function getSystemThemeMode() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function getPreferredThemeMode() {
    const stored = localStorage.getItem(storageKeys.themeMode);
    if (stored === 'light' || stored === 'dark' || stored === 'auto') return stored;
    return 'auto';
  }

  function updateThemeButton(mode) {
    if (!elements.themeToggle) return;
    elements.themeToggle.icon = mode === 'dark' ? 'light_mode' : 'dark_mode';
  }

  function updateThemeModeButtons(preference) {
    if (!elements.themeModeAutoButton || !elements.themeModeLightButton || !elements.themeModeDarkButton) return;
    elements.themeModeAutoButton.variant = preference === 'auto' ? 'filled' : 'outlined';
    elements.themeModeLightButton.variant = preference === 'light' ? 'filled' : 'outlined';
    elements.themeModeDarkButton.variant = preference === 'dark' ? 'filled' : 'outlined';
  }

  /** MDUI 组件除读取 html 上的 mdui-theme-* 外，也认宿主 `theme`；刷新后仅 setTheme 有时序问题，显式同步布局/抽屉更稳 */
  function syncMduiComponentTheme(preference, normalized) {
    const hostTheme = preference === 'auto' ? 'auto' : normalized;
    elements.drawer?.setAttribute('theme', hostTheme);
    document.querySelector('mdui-layout')?.setAttribute('theme', hostTheme);
    document.querySelector('#two-factor-dialog')?.setAttribute('theme', hostTheme);
  }

  function applyTheme(mode, preference = 'light') {
    const normalized = mode === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = normalized;
    localStorage.setItem(storageKeys.themeMode, preference);
    updateThemeButton(normalized);
    updateThemeModeButtons(preference);
    if (window.mdui?.setTheme) window.mdui.setTheme(normalized);
    if (window.mdui?.setColorScheme) window.mdui.setColorScheme(themeColors[normalized]);
    syncMduiComponentTheme(preference, normalized);
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

  function resyncMduiHostsFromDom() {
    const preference = getPreferredThemeMode();
    const normalized = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    syncMduiComponentTheme(preference, normalized);
  }

  function toggleAvatarMenu(forceOpen) {
    if (!elements.topAvatarPanel) return;
    const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : elements.topAvatarPanel.hidden;
    elements.topAvatarPanel.hidden = !shouldOpen;
  }

  function handleLogout() {
    clearLocalAuth();
    setStatus('已登出，可重新登录或切换账号。', 'muted');
    navigateTo('/login');
  }

  function bindShellEvents() {
    elements.menuToggle?.addEventListener('click', () => {
      elements.drawer.open = !elements.drawer.open;
    });
    elements.themeToggle?.addEventListener('click', () => {
      const current = document.documentElement.dataset.theme || 'light';
      applyTheme(current === 'dark' ? 'light' : 'dark', current === 'dark' ? 'light' : 'dark');
    });
    elements.themeModeAutoButton?.addEventListener('click', () => {
      applyThemeByPreference('auto');
      elements.drawer.open = false;
    });
    elements.themeModeLightButton?.addEventListener('click', () => {
      applyThemeByPreference('light');
      elements.drawer.open = false;
    });
    elements.themeModeDarkButton?.addEventListener('click', () => {
      applyThemeByPreference('dark');
      elements.drawer.open = false;
    });
    elements.drawer?.querySelectorAll('mdui-list-item[href]').forEach((node) => {
      node.addEventListener('click', () => {
        if (window.matchMedia('(max-width: 1024px)').matches) elements.drawer.open = false;
      });
    });
    elements.topAvatarTrigger?.addEventListener('click', () => toggleAvatarMenu());
    elements.menuProfileButton?.addEventListener('click', () => {
      toggleAvatarMenu(false);
      navigateTo('/overview');
      requestAnimationFrame(() => {
        document.querySelector('#profile-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
    elements.menuLogoutButton?.addEventListener('click', () => {
      toggleAvatarMenu(false);
      handleLogout();
    });
    elements.drawerLogoutButton?.addEventListener('click', () => {
      if (window.matchMedia('(max-width: 1024px)').matches) elements.drawer.open = false;
      handleLogout();
    });
    document.addEventListener('click', (event) => {
      if (!elements.topAvatarPanel || elements.topAvatarPanel.hidden) return;
      const insidePanel = elements.topAvatarPanel.contains(event.target);
      const isTrigger = elements.topAvatarTrigger?.contains(event.target);
      if (!insidePanel && !isTrigger) elements.topAvatarPanel.hidden = true;
    });
  }

  return {
    getSystemThemeMode,
    getPreferredThemeMode,
    updateThemeButton,
    updateThemeModeButtons,
    applyTheme,
    applyThemeByPreference,
    initTheme,
    resyncMduiHostsFromDom,
    toggleAvatarMenu,
    handleLogout,
    bindShellEvents,
  };
}
