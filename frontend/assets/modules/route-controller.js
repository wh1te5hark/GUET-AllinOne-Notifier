export function createRouteController({
  appState,
  routeView,
  renderRoute,
  updateActiveRouteInDrawer,
  onAfterRouteRender,
  handlers,
}) {
  const allowedRoutes = new Set(['/home', '/login', '/overview', '/collectors', '/rules', '/pushers']);

  function getRouteFromHash() {
    const raw = window.location.hash.replace(/^#/, '');
    if (!raw || raw === '/') return '/home';
    return allowedRoutes.has(raw) ? raw : '/home';
  }

  function navigateTo(route) {
    const target = allowedRoutes.has(route) ? route : '/home';
    window.location.hash = `#${target}`;
  }

  function rerenderRoute(route = appState.currentRoute) {
    appState.currentRoute = allowedRoutes.has(route) ? route : '/home';
    routeView.innerHTML = renderRoute(appState.currentRoute);
    bindRouteEvents(appState.currentRoute);
    onAfterRouteRender?.(appState.currentRoute);
  }

  function bindRouteEvents(route) {
    const queryInRoute = (selector) => routeView.querySelector(selector);

    if (route === '/login' || route === '/overview') {
      queryInRoute('#load-profile-btn')?.addEventListener('click', handlers.loadProfile);
      handlers.applyStatusToPage?.();
    }

    if (route === '/login') {
      queryInRoute('#cas-login-form')?.addEventListener('submit', handlers.handleLogin);
      queryInRoute('#cookie-login-btn')?.addEventListener('click', () => handlers.handleCookieLogin?.());
      void handlers.initLoginEnhancements?.();
    }

    if (route === '/overview') {
      queryInRoute('#refresh-overview-btn')?.addEventListener('click', () => handlers.fetchOverviewRealtime());
      queryInRoute('#overview-loading-note')?.parentElement?.addEventListener('click', () => handlers.fetchOverviewRealtime());

      const avatarInput = queryInRoute('#profile-avatar-file');
      const avatarTrigger = queryInRoute('#profile-avatar-file-trigger');
      const avatarName = queryInRoute('#profile-avatar-file-name');
      avatarTrigger?.addEventListener('click', () => avatarInput?.click());
      avatarInput?.addEventListener('change', (event) => {
        void handlers.onAvatarFileSelected(event);
        const file = event.target?.files?.[0];
        if (avatarName) avatarName.textContent = file?.name || handlers.getNoFileSelectedText?.() || '未选择文件';
      });

      queryInRoute('#save-profile-btn')?.addEventListener('click', handlers.saveProfile);
      queryInRoute('#copy-cookies-btn')?.addEventListener('click', () => handlers.copyCurrentCookies?.());
      handlers.applyRealtimeToOverviewDom?.();
      void handlers.fetchOverviewRealtime?.(true);
    }

    if (route === '/home') handlers.renderTimeline?.('home-timeline-list');
    if (route === '/overview') handlers.renderTimeline?.('overview-timeline-list');

    if (route === '/collectors') {
      queryInRoute('#save-smart-campus-settings-btn')?.addEventListener('click', () => {
        void handlers.saveSmartCampusSettings?.();
      });
      queryInRoute('#sc-schedule-mode')?.addEventListener('change', () => handlers.toggleSmartCampusScheduleMode?.());
      queryInRoute('#apply-smart-campus-query-btn')?.addEventListener('click', () => {
        void handlers.applySmartCampusQuery?.();
      });
      queryInRoute('#reset-smart-campus-query-btn')?.addEventListener('click', () => handlers.resetSmartCampusQuery?.());
      const debouncedApplyQuery = handlers.debounce(() => void handlers.applySmartCampusQuery?.(), 300);
      queryInRoute('#sc-search-q')?.addEventListener('input', debouncedApplyQuery);
      queryInRoute('#sc-search-sender')?.addEventListener('input', debouncedApplyQuery);
      queryInRoute('#sc-search-q')?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') void handlers.applySmartCampusQuery?.();
      });
      queryInRoute('#sc-search-sender')?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') void handlers.applySmartCampusQuery?.();
      });
      queryInRoute('#sync-smart-campus-btn')?.addEventListener('click', () => {
        void handlers.syncSmartCampusMessages?.();
      });
      queryInRoute('#refresh-smart-campus-btn')?.addEventListener('click', () => {
        void handlers.loadSmartCampusMessages?.();
      });
      queryInRoute('#sync-test-collector-btn')?.addEventListener('click', () => {
        void handlers.syncTestCollectorMessages?.();
      });
      queryInRoute('#refresh-test-collector-btn')?.addEventListener('click', () => {
        void handlers.loadTestCollectorMessages?.();
      });
      handlers.toggleSmartCampusScheduleMode?.();
      void handlers.loadSmartCampusSettings?.(true).then(() => handlers.applySmartCampusToDom?.());
      void handlers.loadSmartCampusMessages?.(true).then(() => handlers.applySmartCampusToDom?.());
      void handlers.loadTestCollectorMessages?.(true).then(() => handlers.applyTestCollectorToDom?.());
    }

    if (route === '/rules') {
      queryInRoute('#refresh-rules-btn')?.addEventListener('click', () => {
        void handlers.loadRules?.().then(() => handlers.loadTestPusherFeed?.(true));
      });
      queryInRoute('#refresh-test-pusher-btn')?.addEventListener('click', () => {
        void handlers.loadTestPusherFeed?.();
      });
      queryInRoute('#rule-save-btn')?.addEventListener('click', () => {
        void handlers.saveRule?.();
      });
      queryInRoute('#rule-reset-btn')?.addEventListener('click', () => handlers.resetRuleForm?.());
      queryInRoute('#rules-list')?.addEventListener('click', (event) => {
        void handlers.handleRulesListClick?.(event);
      });
      void handlers
        .loadRulesMeta?.(true)
        .then(() => {
          handlers.resetRuleForm?.();
          return handlers.loadRules?.(true);
        })
        .then(() => {
          handlers.applyRulesToDom?.();
          return handlers.loadTestPusherFeed?.(true);
        })
        .then(() => handlers.applyTestPusherFeedToDom?.());
    }
  }

  function handleRouteChange() {
    const route = getRouteFromHash();
    appState.currentRoute = route;
    updateActiveRouteInDrawer(route);
    rerenderRoute(route);
  }

  return {
    getRouteFromHash,
    navigateTo,
    rerenderRoute,
    bindRouteEvents,
    handleRouteChange,
  };
}
