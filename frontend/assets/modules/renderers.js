export function createRenderers({
  appState,
  timelineData,
  storageKeys,
  formatCookies,
  i18nManager,
}) {
  const t = (key, fallback = '') => i18nManager?.t?.(key, fallback) || fallback;

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function catalogLabel(list, key) {
    const it = (list || []).find((x) => x.key === key);
    const lang = localStorage.getItem('guet_notifier_language') === 'en' ? 'en' : 'zh';
    const raw = it ? (lang === 'en' ? it.label_en : it.label_zh) : key;
    return esc(raw);
  }

  function formatRuleSourcesForDisplay(sources) {
    const meta = appState.rulesMeta?.collectors || [];
    if (!sources?.length) return '全部来源';
    return sources.map((k) => catalogLabel(meta, k)).join('、');
  }

  function formatRulePushersForDisplay(keys) {
    const meta = appState.rulesMeta?.pushers || [];
    return (keys || []).map((k) => catalogLabel(meta, k)).join('、') || esc('debug_log');
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
          <div class="section-kicker">${t('homeSectionTitle', '控制台主页')}</div>
          <h1>${t('homeMainTitle', '把分散在各系统里的提醒集中管理')}</h1>
          <p>${t('homeDescription', '阶段一已支持 CAS 登录、2FA、会话持久化与消息概览。')}</p>
        </div>
        <div class="overview-actions">
          <mdui-button variant="filled" href="#/login">${t('homeConnectCas', '连接 CAS')}</mdui-button>
          <mdui-button variant="outlined" href="#/overview">${t('homeViewOverview', '查看概览')}</mdui-button>
          <mdui-button variant="outlined" href="#/rules">${t('topRules', '转发规则')}</mdui-button>
        </div>
      </div>
      <div class="summary-grid">
        <mdui-card class="summary-card"><div class="summary-label">${t('homePendingNotifications', '待处理通知')}</div><div class="summary-value">17</div></mdui-card>
        <mdui-card class="summary-card"><div class="summary-label">${t('homeActiveRules', '活跃规则')}</div><div class="summary-value">8</div></mdui-card>
        <mdui-card class="summary-card"><div class="summary-label">${t('homeDeliveryRate', '渠道送达率')}</div><div class="summary-value">98.6%</div></mdui-card>
      </div>
      <mdui-card class="panel-card">
        <div class="panel-title">${t('homeRecentNotifications', '最近通知')}</div>
        <div class="timeline" id="home-timeline-list"></div>
      </mdui-card>
    </section>
  `;
  }

  function renderLogin() {
    const apiBase = localStorage.getItem(storageKeys.apiBase) || 'http://127.0.0.1:8000';
    return `
    <section class="login-page">
      <mdui-card class="panel-card login-card">
        <div class="panel-title">${t('loginPageTitle', '账号登录')}</div>
        <p class="panel-desc">${t('loginDescription', '使用桂电统一身份认证账号（智慧校园账号）登录，登录成功后自动同步当前用户信息。')}</p>
        <form id="cas-login-form" class="login-form">
          <mdui-text-field name="student_id" label="${t('studentIdLabel', '学号 / 工号')}" variant="outlined" required autocomplete="username"></mdui-text-field>
          <mdui-text-field name="password" type="password" toggle-password label="${t('passwordLabel', '密码')}" variant="outlined" required autocomplete="current-password"></mdui-text-field>
          <details class="login-advanced">
            <summary>${t('loginAdvanced', '高级配置（一般无需修改）')}</summary>
            <mdui-text-field name="api_base" label="${t('apiBaseLabel', '后端 API 地址')}" variant="outlined" value="${apiBase}" helper="${t('apiBaseHelper', '默认指向本地后端服务')}"></mdui-text-field>
          </details>
          <div class="login-preferences">
            <label class="login-pref-item">
              <input id="remember-password" type="checkbox" />
              <span>${t('loginRememberPassword', '保存密码')}</span>
            </label>
            <label class="login-pref-item">
              <input id="auto-login" type="checkbox" />
              <span>${t('loginAutoLogin', '自动登录')}</span>
            </label>
          </div>
          <div class="login-actions">
            <mdui-button type="submit" variant="filled">${t('loginButton', '登录')}</mdui-button>
            <mdui-button type="button" variant="text" id="load-profile-btn">${t('loginLoadProfile', '读取当前用户')}</mdui-button>
          </div>
          <details class="cookie-login-details">
            <summary>${t('loginCookieLogin', '通过 Cookies 登录（点击展开）')}</summary>
            <div class="cookie-login-block">
              <div class="panel-desc">${t('loginCookieFormat', '（格式：name=value; name2=value2）。')}</div>
              <textarea
                id="cookie-login-text"
                class="cookie-login-textarea"
                rows="3"
                placeholder="${t('loginCookiePlaceholder', '示例：CASTGC=...; JSESSIONID=...')}"
              ></textarea>
              <mdui-button type="button" variant="outlined" id="cookie-login-btn">${t('loginCookieButton', '通过 Cookies 登录')}</mdui-button>
            </div>
          </details>
        </form>
        <div id="login-status" class="result-card muted">${t('untouchedStatus', '尚未发起登录。')}</div>
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
    const cookieEmpty = t('overviewNoCookies', '当前会话暂无 Cookies 记录。');
    const cookieLines = appState.lastLoginResult?.cas_cookies?.length
      ? formatCookies(appState.lastLoginResult.cas_cookies)
      : appState.storedCookies?.length
        ? formatCookies(appState.storedCookies)
        : cookieEmpty;
    return `
    <section>
      <div class="summary-grid">
        <mdui-card class="summary-card">
          <div class="summary-label">${t('overviewCurrentStudentId', '当前学号')}</div>
          <div class="summary-value" id="overview-student-id">${userStudentId}</div>
          <div class="summary-note" id="overview-display-name">${t('overviewRealName', '真实姓名')}: ${userRealName}</div>
        </mdui-card>
        <mdui-card class="summary-card">
          <div class="summary-label">${t('overviewBackendStatus', '后端状态')}</div>
          <div class="summary-value" id="overview-health">${healthStatus}</div>
          <div class="summary-note">${t('overviewHealthNote', '来自 /health 实时查询')}</div>
        </mdui-card>
        <mdui-card class="summary-card">
          <div class="summary-label">${t('overviewLastRefresh', '最后刷新时间')}</div>
          <div class="summary-value" id="overview-updated-at">${updatedAt}</div>
          <div class="summary-note" id="overview-loading-note">${realtime.loading ? t('overviewLoading', '正在刷新…') : t('overviewRefreshHint', '点击此处可手动刷新')}</div>
        </mdui-card>
      </div>
      <section class="main-grid">
      <mdui-card class="panel-card">
        <div class="panel-title">${t('overviewLoginOverview', '登录与用户概览')}</div>
        <div id="login-status" class="result-card ${appState.lastStatus.type}">${appState.lastStatus.message}</div>
        <div class="overview-actions" style="margin-top:0.8rem">
          <mdui-button variant="filled" href="#/login">${t('overviewGoToLogin', '去登录页')}</mdui-button>
          <mdui-button type="button" variant="outlined" id="load-profile-btn">${t('overviewRefreshUser', '刷新当前用户')}</mdui-button>
          <mdui-button type="button" variant="outlined" id="refresh-overview-btn">${t('overviewRefreshData', '刷新实时数据')}</mdui-button>
        </div>
        <div id="overview-error" class="result-card error" style="margin-top:0.8rem;${realtime.error ? '' : 'display:none;'}">${realtime.error || ''}</div>
      </mdui-card>
      <mdui-card class="panel-card">
        <div class="panel-title">${t('overviewCookiesTitle', '本次登录 Cookies')}</div>
        <div class="overview-cookie-tools">
          <mdui-button type="button" variant="outlined" id="copy-cookies-btn">${t('overviewCopyCookies', '复制 Cookies')}</mdui-button>
        </div>
        <details class="overview-cookie-details">
          <summary>${t('overviewCookieExpand', '点击展开')}</summary>
          <pre id="overview-cookie-box" class="result-card muted cookie-pre">${cookieLines}</pre>
        </details>
      </mdui-card>
      <mdui-card class="panel-card" id="profile-card" style="grid-column:1 / -1">
        <div class="panel-title">${t('overviewProfileTitle', '昵称与头像（隐私）')}</div>
        <p class="panel-desc">${t('overviewProfileDescription', '可设置对外显示昵称')}</p>
        <div class="profile-editor">
          <div class="profile-avatar-wrap">
            <img id="profile-avatar-preview" class="profile-avatar" src="${avatar || ''}" alt="头像预览" style="${avatar ? '' : 'display:none;'}" />
            <div id="profile-avatar-placeholder" class="profile-avatar-placeholder" style="${avatar ? 'display:none;' : ''}">${t('overviewNoAvatar', '未设置头像')}</div>
          </div>
          <div class="profile-fields">
            <mdui-text-field id="profile-display-name" label="${t('overviewAvatarLabel', '昵称')}" variant="outlined" value="${realtime.user?.display_name || ''}"></mdui-text-field>
            <div class="avatar-file-row">
              <input id="profile-avatar-file" type="file" accept="image/*" hidden />
              <mdui-button id="profile-avatar-file-trigger" variant="outlined">${t('overviewSelectAvatar', '选择头像文件')}</mdui-button>
              <span id="profile-avatar-file-name" class="avatar-file-name">${t('noFileSelected', '未选择文件')}</span>
            </div>
            <mdui-button id="save-profile-btn" variant="filled">${t('overviewSaveProfile', '保存昵称与头像')}</mdui-button>
          </div>
        </div>
      </mdui-card>
      <mdui-card class="panel-card" style="grid-column:1 / -1">
        <div class="panel-title">${t('homeRecentNotifications', '最近通知')}</div>
        <div class="timeline" id="overview-timeline-list"></div>
      </mdui-card>
      </section>
    </section>
  `;
  }

  function renderCollectors() {
    const lang = localStorage.getItem('guet_notifier_language') || 'zh';
    const isEn = lang === 'en';
    const senderFallback = isEn ? 'System Notice' : t('collectorsSystemNotice', '系统通知');
    const untitled = isEn ? '(Untitled)' : t('collectorsUntitled', '(无标题)');
    const readText = isEn ? 'Read' : t('collectorsRead', '已读');
    const unreadText = isEn ? 'Unread' : t('collectorsUnread', '未读');
    const statusLabel = isEn ? 'Status' : t('collectorsStatus', '状态');
    const sc = appState.smartCampus;
    const tc = appState.testCollector || { messages: [], loading: false, error: '', updatedAt: '' };
    const s = sc.setting || {};
    const q = sc.query || {};
    const tcRows = (tc.messages || [])
      .map(
        (item) => `
      <article class="timeline-item">
        <header>
          <strong>${item.sender || senderFallback}</strong>
          <time>${item.occurred_at_text || item.fetched_at || '--'}</time>
        </header>
        <div class="timeline-title">${item.title || untitled}</div>
        <p style="margin:0.25rem 0;color:var(--guet-muted);font-size:0.85rem;">${statusLabel}: ${item.is_marked_read ? readText : unreadText} | source: ${item.source || '--'} | ${item.external_id || '--'}</p>
        <p>${item.content_text || item.content_html || ''}</p>
      </article>
    `,
      )
      .join('');
    const rows = (sc.messages || [])
      .map((item) => `
      <article class="timeline-item">
        <header>
          <strong>${item.sender || t('collectorsSystemNotice', '系统通知')}</strong>
          <time>${item.occurred_at_text || item.fetched_at || '--'}</time>
        </header>
        <div class="timeline-title">${item.title || t('collectorsUntitled', '(无标题)')}</div>
        <p style="margin:0.25rem 0;color:var(--guet-muted);font-size:0.85rem;">${t('collectorsStatus', '状态')}: ${item.is_marked_read ? t('collectorsRead', '已读') : t('collectorsUnread', '未读')} | ID: ${item.external_id || '--'}</p>
        <p>${item.content_text || item.content_html || ''}</p>
      </article>
    `)
      .join('');
    return `
    <section class="lower-grid">
      <mdui-card class="panel-card" style="grid-column:1 / -1">
        <div class="panel-title">${t('collectorsTitle', '智慧校园通知采集器')}</div>
        <p class="panel-desc">${t('collectorsDescription', '数据源：pcportal 消息中心 receiveBox。同步后会标记已读')}</p>
        <div class="panel-title" style="font-size:1rem;margin-top:0.8rem;">${t('collectorsScheduleTitle', '采集时间设置')}</div>
        <div class="overview-actions" style="margin-top:0.6rem;flex-wrap:wrap;">
          <mdui-select id="sc-schedule-mode" value="${s.schedule_mode || 'visual'}" label="${t('collectorsScheduleMode', '调度模式')}" variant="outlined" style="min-width:180px;">
            <mdui-menu-item value="visual">${t('collectorsScheduleVisual', '可视化')}</mdui-menu-item>
            <mdui-menu-item value="cron">${t('collectorsScheduleCron', 'Cron 表达式')}</mdui-menu-item>
          </mdui-select>
          <mdui-switch id="sc-enabled-switch" ${s.enabled ? 'checked' : ''}>${t('collectorsEnable', '启用采集器')}</mdui-switch>
        </div>
        <div id="sc-visual-settings" style="${(s.schedule_mode || 'visual') === 'visual' ? '' : 'display:none;'}">
          <div class="overview-actions" style="margin-top:0.6rem;flex-wrap:wrap;">
            <mdui-select id="sc-visual-mode" value="${s.visual_mode || 'every_n_minutes'}" label="${t('collectorsVisualMode', '可视化频率')}" variant="outlined" style="min-width:180px;">
              <mdui-menu-item value="every_n_minutes">${t('collectorsEveryNMinutes', '每 N 分钟')}</mdui-menu-item>
              <mdui-menu-item value="daily_time">${t('collectorsDailyTime', '每天固定时间')}</mdui-menu-item>
            </mdui-select>
            <mdui-text-field id="sc-interval-minutes" type="number" label="${t('collectorsIntervalMinutes', '间隔分钟')}" variant="outlined" min="1" max="1440" value="${s.interval_minutes || 30}" style="min-width:160px;"></mdui-text-field>
            <mdui-text-field id="sc-daily-time" type="time" label="${t('collectorsDailyTimeLabel', '每日时间')}" variant="outlined" value="${s.daily_time || '08:00'}" style="min-width:160px;"></mdui-text-field>
          </div>
        </div>
        <div id="sc-cron-settings" style="${(s.schedule_mode || 'visual') === 'cron' ? '' : 'display:none;'}">
          <mdui-text-field id="sc-cron-expr" label="${t('collectorsCronExpression', 'Cron 表达式')}" variant="outlined" value="${s.cron_expr || '*/30 * * * *'}" helper="${t('collectorsCronHelper', '示例：*/30 * * * *')}"></mdui-text-field>
        </div>
        <div class="overview-actions" style="margin-top:0.8rem">
          <mdui-button type="button" variant="tonal" id="save-smart-campus-settings-btn">${t('collectorsSaveSettings', '保存设置')}</mdui-button>
          <mdui-button type="button" variant="filled" id="sync-smart-campus-btn">${t('collectorsSyncMessages', '同步通知')}</mdui-button>
          <mdui-button type="button" variant="outlined" id="refresh-smart-campus-btn">${t('collectorsRefreshLocal', '刷新本地记录')}</mdui-button>
        </div>
        <div id="smart-campus-status" class="result-card ${sc.error ? 'error' : 'muted'}" style="margin-top:0.8rem">
          ${sc.error ? sc.error : (sc.loading ? t('collectorsSyncing', '正在同步智慧校园通知…') : `${t('collectorsLastUpdated', '最近更新时间')}：${sc.updatedAt || '--'}`)}
        </div>
      </mdui-card>
      <mdui-card class="panel-card" style="grid-column:1 / -1">
        <div class="panel-title" id="test-collector-title">${t('testCollectorTitle', '测试采集器（联调）')}</div>
        <p class="panel-desc" id="test-collector-desc">${t('testCollectorDesc', '无需 CAS：每次点击会注入两条合成通知（source=test_collector）并执行转发规则，可与「测试推送」配合验证全链路。')}</p>
        <div class="overview-actions" style="margin-top:0.6rem">
          <mdui-button type="button" variant="filled" id="sync-test-collector-btn">${t('syncTestCollectorBtn', '注入测试通知')}</mdui-button>
          <mdui-button type="button" variant="outlined" id="refresh-test-collector-btn">${t('refreshTestCollectorBtn', '刷新测试列表')}</mdui-button>
        </div>
        <div id="test-collector-status" class="result-card ${tc.error ? 'error' : 'muted'}" style="margin-top:0.75rem">
          ${tc.error ? tc.error : (tc.loading ? (isEn ? 'Working…' : '处理中…') : `${isEn ? 'Last updated' : '最近更新时间'}：${tc.updatedAt || '--'}`)}
        </div>
        <div id="test-collector-list" class="timeline" style="margin-top:0.75rem">${tcRows || `<p class="panel-desc">${isEn ? 'No test notices yet.' : '暂无测试通知，先点击「注入测试通知」。'}</p>`}</div>
      </mdui-card>
      <mdui-card class="panel-card" style="grid-column:1 / -1">
        <div class="panel-title">${t('collectorsMessageList', '通知列表')}</div>
        <div class="overview-actions" style="margin:0.6rem 0;flex-wrap:wrap;">
          <mdui-text-field id="sc-search-q" label="${t('collectorsSearchKeyword', '关键词')}" variant="outlined" value="${q.q || ''}" style="min-width:220px;"></mdui-text-field>
          <mdui-text-field id="sc-search-sender" label="${t('collectorsSearchSender', '发送方')}" variant="outlined" value="${q.sender || ''}" style="min-width:180px;"></mdui-text-field>
          <mdui-select id="sc-read-state" value="${q.read_state || 'all'}" label="${t('collectorsReadFilter', '已读筛选')}" variant="outlined" style="min-width:140px;">
            <mdui-menu-item value="all">${t('collectorsReadAll', '全部')}</mdui-menu-item>
            <mdui-menu-item value="read">${t('collectorsReadOnly', '仅已读')}</mdui-menu-item>
            <mdui-menu-item value="unread">${t('collectorsUnreadOnly', '仅未读')}</mdui-menu-item>
          </mdui-select>
          <mdui-select id="sc-sort-by" value="${q.sort_by || 'fetched_at'}" label="${t('collectorsSortBy', '排序字段')}" variant="outlined" style="min-width:160px;">
            <mdui-menu-item value="fetched_at">${t('collectorsSortFetchedAt', '采集时间')}</mdui-menu-item>
            <mdui-menu-item value="occurred_at_text">${t('collectorsSortOccurredAt', '通知时间')}</mdui-menu-item>
            <mdui-menu-item value="title">${t('collectorsSortTitle', '标题')}</mdui-menu-item>
            <mdui-menu-item value="sender">${t('collectorsSortSender', '发送方')}</mdui-menu-item>
          </mdui-select>
          <mdui-select id="sc-sort-dir" value="${q.sort_dir || 'desc'}" label="${t('collectorsSortOrder', '顺序')}" variant="outlined" style="min-width:120px;">
            <mdui-menu-item value="desc">${t('collectorsSortDesc', '降序')}</mdui-menu-item>
            <mdui-menu-item value="asc">${t('collectorsSortAsc', '升序')}</mdui-menu-item>
          </mdui-select>
          <mdui-button type="button" variant="outlined" id="apply-smart-campus-query-btn">${t('collectorsApplyFilter', '应用筛选')}</mdui-button>
          <mdui-button type="button" variant="text" id="reset-smart-campus-query-btn">${t('collectorsReset', '重置')}</mdui-button>
        </div>
        <div id="smart-campus-list" class="timeline">${rows || `<p class="panel-desc">${t('collectorsEmptyHint', '暂无通知，先点击“同步通知”。')}</p>`}</div>
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
        <div class="panel-title">${title} - ${t('skeletonNextSteps', '下一步')}</div>
        <ol class="steps">
          <li>${t('skeletonStep1', '完成后端接口定义与鉴权策略。')}</li>
          <li>${t('skeletonStep2', '补齐增删改查表单和保存逻辑。')}</li>
          <li>${t('skeletonStep3', '接入变更日志与测试用例。')}</li>
        </ol>
      </mdui-card>
    </section>
  `;
  }

  function renderRules() {
    const rulesState = appState.rules || { items: [], loading: false, error: '', updatedAt: '' };
    const rows = (rulesState.items || [])
      .map((rule) => {
        const sources = formatRuleSourcesForDisplay(rule.config?.sources);
        const channels = formatRulePushersForDisplay(rule.config?.channel_keys);
        const includeAny = esc((rule.config?.match?.include_any || []).join('，') || '无');
        const excludeAny = esc((rule.config?.match?.exclude_any || []).join('，') || '无');
        const mode = rule.config?.match?.mode === 'any' ? '任一命中' : '全部命中';
        return `
      <article class="timeline-item">
        <header>
          <strong>${esc(rule.name)}</strong>
          <time>${rule.enabled ? '启用中' : '已停用'}</time>
        </header>
        <p>来源：${sources}</p>
        <p>匹配模式：${mode} | 包含：${includeAny} | 排除：${excludeAny}</p>
        <p>推送器：${channels}</p>
        <p style="font-size:0.82rem;">更新时间：${esc(rule.updated_at || '--')}</p>
        <div class="overview-actions" style="margin-top:0.55rem">
          <button type="button" data-action="edit" data-rule-id="${rule.id}">编辑</button>
          <button type="button" data-action="toggle" data-rule-id="${rule.id}">${rule.enabled ? '禁用' : '启用'}</button>
          <button type="button" data-action="delete" data-rule-id="${rule.id}">删除</button>
        </div>
      </article>
    `;
      })
      .join('');
    return `
    <section class="lower-grid">
      <mdui-card class="panel-card" style="grid-column:1 / -1">
        <div class="panel-title" id="rules-page-title">转发规则</div>
        <p class="panel-desc" id="rules-page-desc">基于通知内容匹配条件，将命中的通知按模板路由到指定渠道。</p>
        <div id="rules-status" class="result-card ${rulesState.error ? 'error' : 'muted'}">
          ${rulesState.error ? rulesState.error : (rulesState.loading ? '正在加载规则…' : `最近更新时间：${rulesState.updatedAt || '--'}`)}
        </div>
        <div class="overview-actions" style="margin-top:0.7rem">
          <mdui-button type="button" variant="outlined" id="refresh-rules-btn">刷新规则</mdui-button>
          <mdui-button type="button" variant="text" id="rule-reset-btn">重置表单</mdui-button>
        </div>
      </mdui-card>
      <mdui-card class="panel-card" style="grid-column:1 / -1">
        <div class="panel-title" id="rules-form-title">创建 / 编辑规则</div>
        <input id="rule-id" type="hidden" />
        <div class="login-form">
          <mdui-text-field id="rule-name" label="规则名称" variant="outlined"></mdui-text-field>
          <mdui-switch id="rule-enabled" checked>启用规则</mdui-switch>
          <div class="rule-field-block">
            <div class="rule-field-label" id="rule-sources-label">通知来源（采集器）</div>
            <p class="panel-desc rule-field-hint" id="rule-sources-hint">不勾选表示匹配全部来源。</p>
            <div id="rule-sources-box" class="rule-multi-box"></div>
          </div>
          <mdui-select id="rule-match-mode" label="匹配模式" value="all" variant="outlined">
            <mdui-menu-item value="all">全部关键字命中</mdui-menu-item>
            <mdui-menu-item value="any">任一关键字命中</mdui-menu-item>
          </mdui-select>
          <mdui-switch id="rule-use-regex">使用正则匹配</mdui-switch>
          <mdui-text-field id="rule-include-any" label="包含关键字（逗号或换行）" variant="outlined"></mdui-text-field>
          <mdui-text-field id="rule-exclude-any" label="排除关键字（逗号或换行）" variant="outlined"></mdui-text-field>
          <mdui-text-field id="rule-template-subject" label="主题模板" variant="outlined" value="{{title}}"></mdui-text-field>
          <mdui-text-field id="rule-template-body" label="正文模板" variant="outlined" value="{{content_text}}"></mdui-text-field>
          <div class="rule-field-block">
            <div class="rule-field-label" id="rule-pushers-label">推送器（可多选）</div>
            <p class="panel-desc rule-field-hint" id="rule-pushers-hint">至少选择一项；测试联调可选「测试推送」将内容写入数据库并在下方列表展示。</p>
            <div id="rule-pushers-box" class="rule-multi-box"></div>
          </div>
        </div>
        <div class="overview-actions" style="margin-top:0.8rem">
          <mdui-button type="button" variant="filled" id="rule-save-btn">创建规则</mdui-button>
        </div>
      </mdui-card>
      <mdui-card class="panel-card" style="grid-column:1 / -1">
        <div class="panel-title" id="test-pusher-feed-title">测试推送记录</div>
        <p class="panel-desc" id="test-pusher-feed-desc">由「测试推送」渠道写入，用于与规则转发联调。</p>
        <div id="test-pusher-feed-status" class="result-card muted"></div>
        <div class="overview-actions" style="margin-top:0.55rem">
          <mdui-button type="button" variant="outlined" id="refresh-test-pusher-btn">刷新记录</mdui-button>
        </div>
        <div id="test-pusher-feed-list" class="timeline" style="margin-top:0.75rem"></div>
      </mdui-card>
      <mdui-card class="panel-card" style="grid-column:1 / -1">
        <div class="panel-title" id="rules-list-title">规则列表</div>
        <div id="rules-list" class="timeline">${rows || '<p class="panel-desc">暂无规则，请先创建。</p>'}</div>
      </mdui-card>
    </section>
  `;
  }

  function renderRoute(route) {
    if (route === '/home') return renderHome();
    if (route === '/login') return renderLogin();
    if (route === '/overview') return renderOverview();
    if (route === '/collectors') return renderCollectors();
    if (route === '/rules') return renderRules();
    if (route === '/pushers') {
      return renderSkeleton('推送器', [
        { title: t('skeletonOneBot', 'OneBot'), label: t('skeletonQQBot', 'QQ 机器人'), desc: t('skeletonOneBotDesc', '连接地址与鉴权配置。'), status: t('skeletonStatus', '骨架') },
        { title: t('skeletonWxPusher', 'WxPusher'), label: t('skeletonWeChatPush', '微信推送'), desc: t('skeletonWxPusherDesc', 'AppToken 与 UID 管理。'), status: t('skeletonStatus', '骨架') },
        { title: t('skeletonFeishu', '飞书'), label: t('skeletonWebhookBot', 'Webhook 机器人'), desc: t('skeletonFeishuDesc', '签名与路由配置。'), status: t('skeletonStatus', '骨架') },
      ]);
    }
    return '';
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
    if (displayName) displayName.textContent = `${t('overviewRealName', '真实姓名')}: ${realtime.user?.real_name || '--'}`;
    if (health) health.textContent = realtime.health?.status || '--';
    if (updatedAt) updatedAt.textContent = realtime.updatedAt || '--';
    if (loadingNote) loadingNote.textContent = realtime.loading ? t('overviewLoading', '正在刷新…') : t('overviewRefreshHint', '点击此处可手动刷新');
    if (errorBox) {
      errorBox.textContent = realtime.error || '';
      errorBox.style.display = realtime.error ? '' : 'none';
    }
    if (cookieBox) {
      const cookieEmpty = t('overviewNoCookies', '当前会话暂无 Cookies 记录。');
      const lines = appState.lastLoginResult?.cas_cookies?.length
        ? formatCookies(appState.lastLoginResult.cas_cookies)
        : appState.storedCookies?.length
          ? formatCookies(appState.storedCookies)
          : cookieEmpty;
      cookieBox.textContent = lines;
    }
  }

  function applyTestCollectorToDom() {
    if (appState.currentRoute !== '/collectors') return;
    const lang = localStorage.getItem('guet_notifier_language') || 'zh';
    const isEn = lang === 'en';
    const senderFallback = isEn ? 'System Notice' : '系统通知';
    const untitled = isEn ? '(Untitled)' : '(无标题)';
    const readText = isEn ? 'Read' : '已读';
    const unreadText = isEn ? 'Unread' : '未读';
    const statusLabel = isEn ? 'Status' : '状态';
    const emptyHint = isEn ? 'No test notices yet.' : '暂无测试通知，先点击「注入测试通知」。';
    const tc = appState.testCollector || { messages: [], loading: false, error: '', updatedAt: '' };
    const statusNode = document.querySelector('#test-collector-status');
    const listNode = document.querySelector('#test-collector-list');
    if (statusNode) {
      statusNode.className = `result-card ${tc.error ? 'error' : 'muted'}`;
      statusNode.textContent = tc.error
        ? tc.error
        : tc.loading
          ? (isEn ? 'Working…' : '处理中…')
          : `${isEn ? 'Last updated' : '最近更新时间'}：${tc.updatedAt || '--'}`;
    }
    if (!listNode) return;
    if (!tc.messages?.length) {
      listNode.innerHTML = `<p class="panel-desc">${emptyHint}</p>`;
      return;
    }
    listNode.innerHTML = tc.messages
      .map(
        (item) => `
      <article class="timeline-item">
        <header><strong>${item.sender || senderFallback}</strong><time>${item.occurred_at_text || item.fetched_at || '--'}</time></header>
        <div class="timeline-title">${item.title || untitled}</div>
        <p style="margin:0.25rem 0;color:var(--guet-muted);font-size:0.85rem;">${statusLabel}: ${item.is_marked_read ? readText : unreadText} | source: ${item.source || '--'} | ${item.external_id || '--'}</p>
        <p>${item.content_text || item.content_html || ''}</p>
      </article>
    `,
      )
      .join('');
  }

  function applySmartCampusToDom() {
    if (appState.currentRoute !== '/collectors') return;
    const sc = appState.smartCampus;
    const statusNode = document.querySelector('#smart-campus-status');
    const listNode = document.querySelector('#smart-campus-list');
    if (statusNode) {
      statusNode.className = `result-card ${sc.error ? 'error' : 'muted'}`;
      statusNode.textContent = sc.error ? sc.error : (sc.loading ? t('collectorsSyncing', '正在同步智慧校园通知…') : `${t('collectorsLastUpdated', '最近更新时间')}: ${sc.updatedAt || '--'}`);
    }
    if (listNode) {
      if (!sc.messages.length) {
        listNode.innerHTML = `<p class="panel-desc">${t('collectorsEmptyHint', '暂无通知，先点击“同步通知”。')}</p>`;
        return;
      }
      listNode.innerHTML = sc.messages
        .map(
          (item) => `
      <article class="timeline-item">
        <header><strong>${item.sender || t('collectorsSystemNotice', '系统通知')}</strong><time>${item.occurred_at_text || item.fetched_at || '--'}</time></header>
        <div class="timeline-title">${item.title || t('collectorsUntitled', '(无标题)')}</div>
        <p>${item.content_text || item.content_html || ''}</p>
      </article>
    `,
        )
        .join('');
    }
  }

  function applyRulesToDom() {
    if (appState.currentRoute !== '/rules') return;
    const rulesState = appState.rules || { items: [], loading: false, error: '', updatedAt: '' };
    const statusNode = document.querySelector('#rules-status');
    const listNode = document.querySelector('#rules-list');
    if (statusNode) {
      statusNode.className = `result-card ${rulesState.error ? 'error' : 'muted'}`;
      statusNode.textContent = rulesState.error
        ? rulesState.error
        : (rulesState.loading ? '正在加载规则…' : `最近更新时间：${rulesState.updatedAt || '--'}`);
    }
    if (!listNode) return;
    if (!rulesState.items?.length) {
      listNode.innerHTML = '<p class="panel-desc">暂无规则，请先创建。</p>';
      return;
    }
    listNode.innerHTML = rulesState.items
      .map((rule) => {
        const sources = formatRuleSourcesForDisplay(rule.config?.sources);
        const channels = formatRulePushersForDisplay(rule.config?.channel_keys);
        const includeAny = esc((rule.config?.match?.include_any || []).join('，') || '无');
        const excludeAny = esc((rule.config?.match?.exclude_any || []).join('，') || '无');
        const mode = rule.config?.match?.mode === 'any' ? '任一命中' : '全部命中';
        return `
      <article class="timeline-item">
        <header><strong>${esc(rule.name)}</strong><time>${rule.enabled ? '启用中' : '已停用'}</time></header>
        <p>来源：${sources}</p>
        <p>匹配模式：${mode} | 包含：${includeAny} | 排除：${excludeAny}</p>
        <p>推送器：${channels}</p>
        <p style="font-size:0.82rem;">更新时间：${esc(rule.updated_at || '--')}</p>
        <div class="overview-actions" style="margin-top:0.55rem">
          <button type="button" data-action="edit" data-rule-id="${rule.id}">编辑</button>
          <button type="button" data-action="toggle" data-rule-id="${rule.id}">${rule.enabled ? '禁用' : '启用'}</button>
          <button type="button" data-action="delete" data-rule-id="${rule.id}">删除</button>
        </div>
      </article>
      `;
      })
      .join('');
  }

  function applyTestPusherFeedToDom() {
    if (appState.currentRoute !== '/rules') return;
    const feed = appState.testPusherFeed || { items: [], loading: false, error: '' };
    const statusEl = document.querySelector('#test-pusher-feed-status');
    const listEl = document.querySelector('#test-pusher-feed-list');
    if (statusEl) {
      const lang = localStorage.getItem('guet_notifier_language') === 'en' ? 'en' : 'zh';
      if (feed.error) {
        statusEl.className = 'result-card error';
        statusEl.textContent = feed.error;
      } else if (feed.loading) {
        statusEl.className = 'result-card muted';
        statusEl.textContent = lang === 'en' ? 'Loading…' : '正在加载…';
      } else {
        statusEl.className = 'result-card muted';
        statusEl.textContent =
          lang === 'en'
            ? `${feed.items?.length || 0} record(s). Sync messages after saving a rule with Test DB pusher.`
            : `共 ${feed.items?.length || 0} 条。保存含「测试推送」的规则后同步采集消息即可产生记录。`;
      }
    }
    if (!listEl) return;
    if (!feed.items?.length) {
      listEl.innerHTML = `<p class="panel-desc">${localStorage.getItem('guet_notifier_language') === 'en' ? 'No test deliveries yet.' : '暂无测试推送记录。'}</p>`;
      return;
    }
    listEl.innerHTML = feed.items
      .map(
        (row) => `
      <article class="timeline-item">
        <header><strong>${esc(row.subject || row.title || '(无主题)')}</strong><time>${esc(row.created_at)}</time></header>
        <p class="timeline-meta">${esc(row.source)} · rule #${esc(String(row.rule_id))} · msg #${esc(String(row.notification_item_id))}</p>
        <div class="timeline-title">${esc(row.title)}</div>
        <p>${esc(row.body)}</p>
      </article>`,
      )
      .join('');
  }

  return {
    renderTimeline,
    renderRoute,
    applyRealtimeToOverviewDom,
    applySmartCampusToDom,
    applyTestCollectorToDom,
    applyRulesToDom,
    applyTestPusherFeedToDom,
  };
}
