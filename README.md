# GUET-AllinOne-Notifier

适用于桂林电子科技大学的消息全能推送平台 | A Comprehensive Message Push Platform Tailored for GUET

## 项目结构

```text
backend/   FastAPI 后端服务（Poetry 管理）
frontend/  基于 MDUI 的静态前端（依赖本地资源）
```

- 前后端分离。
- 前端不使用 npm，不需要打包，直接由静态文件构成。
- 前端通过浏览器 `fetch` 调用 `backend` REST API。

## 后端（Poetry）

需要已安装 [Poetry](https://python-poetry.org/docs/#installation) 与 Python 3.11+。

```bash
cd backend
poetry install
# 生产环境
poetry run guet-notifier
# 开发环境
poetry run dev
```

默认启动在本机 8080 端口, 可在 env 中进行修改  

- 健康检查：<http://127.0.0.1:8000/health>
- OpenAPI 文档：<http://127.0.0.1:8000/docs>

### 常用命令

```bash
poetry run ruff check src tests
poetry run pytest
```

## 前端

`frontend/` 是纯静态文件，部署到任意静态托管环境即可使用。后端已增加跨域头

前端特性：

- 使用 **MDUI 2**，不依赖外部 CDN 以加快加载速度(嗯，取决于你托管在哪)
- 不使用 npm / Vite / Webpack 等黑洞级技术栈，不需要在电脑里留下一坨 node_modules
- 默认后端地址为 `http://127.0.0.1:8000`，可在页面表单中修改。
- 登录成功后，access token 存储在浏览器本地存储中，供演示阶段调用 `/api/v1/me`。
- 登录页支持最近账号选择、快速切换、保存密码与自动登录（仅前端本地加密存储，不上传后端）。


前端文件组成：  

- 样式按功能拆分：`app.css`（通用）+ `app.login.css`（登录页）。  
- js 按功能拆分：  
  - `app.js`（主流程与初始化）
  - `modules/auth-flow.js`（CAS 登录、2FA 与自动登录流程）
  - `modules/login-account-manager.js`（账号记忆与自动登录）
  - `modules/profile-session-manager.js`（用户资料、会话恢复、概览刷新）
  - `modules/renderers.js`（页面渲染与局部 DOM 回填）
  - `modules/smart-campus-manager.js`（采集器设置与消息同步）
  - `modules/ui-manager.js`（主题切换、头像菜单与抽屉交互）

## 配置

后端环境变量见 [backend/.env.example](backend/.env.example)。

- 默认 SQLite 会自动创建到 `backend/.data/app.db`。
- 生产部署时建议显式设置 `GUET_DATABASE_URL` 并切换到 MySQL。

~~## 规划文档~~

~~内部用：详见 [plan/规划与实现.md](plan/规划与实现.md) 与 [plan/origin.md](plan/origin.md)。~~
