export function createRenderers({
  appState,
  timelineData,
  storageKeys,
  formatCookies,
  loginAccountManager,
}) {
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

  function renderRoute(route) {
    if (route === '/home') return renderHome();
    if (route === '/login') return renderLogin();
    if (route === '/overview') return renderOverview();
    if (route === '/collectors') return renderCollectors();
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
    if (displayName) displayName.textContent = `真实姓名：${realtime.user?.real_name || '--'}`;
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
        .map(
          (item) => `
      <article class="timeline-item">
        <header><strong>${item.sender || '系统通知'}</strong><time>${item.occurred_at_text || item.fetched_at || '--'}</time></header>
        <div class="timeline-title">${item.title || '(无标题)'}</div>
        <p>${item.content_text || item.content_html || ''}</p>
      </article>
    `,
        )
        .join('');
    }
  }

  return {
    renderTimeline,
    renderRoute,
    applyRealtimeToOverviewDom,
    applySmartCampusToDom,
  };
}
