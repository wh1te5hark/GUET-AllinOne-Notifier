export function createI18nManager({
  appState,
  storageKey,
  defaultLanguage,
  setStatus,
  rerenderCurrentRoute,
}) {
  const localeMap = {
    zh: 'zh-CN',
    en: 'en-US',
  };

  const dictionaries = {};

  function getLanguage() {
    const raw = localStorage.getItem(storageKey) || defaultLanguage;
    return raw === 'en' ? 'en' : 'zh';
  }

  async function loadDictionary(lang) {
    const locale = localeMap[lang] || localeMap[defaultLanguage];
    if (dictionaries[lang]) return dictionaries[lang];
    const response = await fetch(`./assets/i18n/${locale}.json`);
    if (!response.ok) throw new Error(`Load language pack failed: ${locale}`);
    const data = await response.json();
    dictionaries[lang] = data;
    return data;
  }

  function getDict(lang) {
    return dictionaries[lang] || dictionaries[defaultLanguage] || {};
  }

  function text(selector, value) {
    if (!value) return;
    const el = document.querySelector(selector);
    if (el) el.textContent = value;
  }

  function attr(selector, key, value) {
    if (!value) return;
    const el = document.querySelector(selector);
    if (el) el.setAttribute(key, value);
  }

  function applyLanguage(lang) {
    const dict = getDict(lang);
    document.documentElement.lang = dict.htmlLang || (lang === 'en' ? 'en' : 'zh-CN');

    text('.topbar-actions mdui-button[href="#/home"]', dict.topHome);
    text('.topbar-actions mdui-button[href="#/overview"]', dict.topOverview);
    text('mdui-list-item[href="#/home"]', dict.drawerHome);
    text('mdui-list-item[href="#/login"]', dict.drawerLogin);
    text('mdui-list-item[href="#/overview"]', dict.drawerOverview);
    text('mdui-list-item[href="#/collectors"]', dict.drawerCollectors);
    text('mdui-list-item[href="#/rules"]', dict.drawerRules);
    text('mdui-list-item[href="#/pushers"]', dict.drawerPushers);
    text('.drawer-theme-panel .drawer-theme-title', dict.themeTitle);
    text('#theme-mode-auto', dict.themeAuto);
    text('#theme-mode-light', dict.themeLight);
    text('#theme-mode-dark', dict.themeDark);
    text('#preferences-toggle', dict.preferencesToggle);
    text('.drawer-language-panel .drawer-color-title', dict.languageTitle);
    text('.language-preview-text', dict.languagePreview);
    text('.drawer-font-panel .drawer-color-title', dict.fontSizeTitle);
    text('#font-size-sm', dict.fontSizeSm);
    text('#font-size-base', dict.fontSizeBase);
    text('#font-size-lg', dict.fontSizeLg);
    text('.font-size-preview-text', dict.fontPreview);
    text('.drawer-color-panel .drawer-color-title', dict.colorTitle);
    text('.drawer-color-panel .drawer-color-title:nth-of-type(2)', dict.presetTitle);
    text('#reset-colors-btn', dict.resetColors);
    text('#save-colors-btn', dict.saveColors);
    text('#drawer-logout-btn', dict.drawerLogout);
    text('#menu-profile-btn', dict.menuProfile);
    text('#menu-logout-btn', dict.menuLogout);

    attr('#cas-login-form [name="student_id"]', 'label', dict.studentIdLabel);
    attr('#cas-login-form [name="password"]', 'label', dict.passwordLabel);
    attr('#cas-login-form [name="api_base"]', 'label', dict.apiBaseLabel);
    attr('#cas-login-form [name="api_base"]', 'helper', dict.apiBaseHelper);

    attr('#two-factor-dialog', 'headline', dict.twoFaHeadline);
    text('#two-factor-dialog .two-factor-hint', dict.twoFaHint);
    attr('#two-factor-method-field', 'label', dict.twoFaMethodLabel);
    text('#two-factor-method-field mdui-menu-item[value="sms_code"]', dict.twoFaSmsMethod);
    text('#two-factor-method-field mdui-menu-item[value="wechat_qr"]', dict.twoFaWechatMethod);
    attr('#two-factor-code-field', 'label', dict.twoFaCodeLabel);
    attr('#two-factor-code-field', 'helper', dict.twoFaCodeHelper);
    text('#send-2fa-code-btn', dict.twoFaSendSms);
    text('#verify-2fa-btn', dict.twoFaSubmitCode);
    text('.wechat-qr-hint', dict.twoFaWechatHint);
    text('#open-wechat-2fa-btn', dict.twoFaGetWechatQr);
    text('#close-2fa-dialog-btn', dict.twoFaLater);

    if (
      appState.lastStatus?.message === getDict('zh').untouchedStatus
      || appState.lastStatus?.message === getDict('en').untouchedStatus
    ) {
      setStatus(dict.untouchedStatus || appState.lastStatus.message, 'muted');
    }
  }

  function bindEvents() {
    const zhButton = document.querySelector('#language-zh');
    const enButton = document.querySelector('#language-en');

    if (zhButton) {
      zhButton.addEventListener('click', () => {
        void setLanguage('zh');
      });
    }
    if (enButton) {
      enButton.addEventListener('click', () => {
        void setLanguage('en');
      });
    }
  }

  async function setLanguage(lang) {
    const nextLang = lang === 'en' ? 'en' : 'zh';
    localStorage.setItem(storageKey, nextLang);
    if (!dictionaries[nextLang]) await loadDictionary(nextLang);
    rerenderCurrentRoute();
    applyLanguage(nextLang);

    const zhButton = document.querySelector('#language-zh');
    const enButton = document.querySelector('#language-en');
    if (zhButton && enButton) {
      zhButton.variant = nextLang === 'zh' ? 'filled' : 'outlined';
      enButton.variant = nextLang === 'en' ? 'filled' : 'outlined';
      zhButton.textContent = getDict(nextLang).languageZh;
      enButton.textContent = getDict(nextLang).languageEn;
    }
  }

  async function init() {
    const lang = getLanguage();
    await loadDictionary(defaultLanguage);
    if (!dictionaries[lang]) await loadDictionary(lang);
    await setLanguage(lang);
    bindEvents();
  }

  function t(key, fallback = '') {
    const dict = getDict(getLanguage());
    return dict[key] ?? fallback;
  }

  return {
    init,
    getLanguage,
    setLanguage,
    applyLanguage,
    t,
  };
}
