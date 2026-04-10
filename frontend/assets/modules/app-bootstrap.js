export function createAppBootstrap({
  routeController,
  uiManager,
  loginAccountManager,
  authFlow,
  profileSessionManager,
  updateAccountDisplay,
  initColorSystem,
  initFontSize,
  initI18n,
  preferences,
  twoFactorElements,
}) {
  function bindTwoFactorEvents() {
    twoFactorElements.twoFactorMethodField?.addEventListener('change', authFlow.updateMethodPanels);
    twoFactorElements.verify2faButton?.addEventListener('click', authFlow.verifyTwoFactorCode);
    twoFactorElements.send2faCodeButton?.addEventListener('click', authFlow.sendTwoFactorCode);
    twoFactorElements.openWeChat2faButton?.addEventListener('click', authFlow.initiateWeChatQr);
    twoFactorElements.close2faDialogButton?.addEventListener('click', authFlow.closeTwoFactorDialog);
  }

  function bindGlobalEvents() {
    window.addEventListener('hashchange', routeController.handleRouteChange);
  }

  function bindPreferencesToggle() {
    preferences.toggleButton?.addEventListener('click', () => {
      const panel = preferences.panel;
      if (!panel) return;
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });
  }

  async function init() {
    uiManager.bindShellEvents();
    bindGlobalEvents();
    bindTwoFactorEvents();
    bindPreferencesToggle();

    uiManager.initTheme();
    initColorSystem();
    initFontSize();

    authFlow.resetTwoFactorState();
    loginAccountManager.initRecentAccounts();
    updateAccountDisplay();

    routeController.handleRouteChange();
    await initI18n();
    void profileSessionManager.restoreSavedSession();
  }

  return { init };
}
