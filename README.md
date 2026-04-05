# GUET-AllinOne-Notifier

适用于桂林电子科技大学的消息全能推送平台 | A Comprehensive Message Push Platform Tailored for GUET

## 项目结构

```text
backend/   FastAPI 后端服务（Poetry 管理）
frontend/  基于 MDUI CDN 的静态前端
```

- 前后端分离。
- 前端不使用 npm，不需要打包，直接由静态文件构成。
- 前端通过浏览器 `fetch` 调用 `backend` REST API。

## Backend 开发与运行（Poetry）

需要已安装 [Poetry](https://python-poetry.org/docs/#installation) 与 Python 3.11+。

```bash
cd backend
poetry install
poetry run guet-notifier
```

默认启动后：

- 健康检查：<http://127.0.0.1:8000/health>
- OpenAPI 文档：<http://127.0.0.1:8000/docs>

### 已实现接口

- `POST /api/v1/auth/cas/login`
- `GET /api/v1/me`

### 常用命令

```bash
cd backend
poetry run ruff check src tests
poetry run pytest
```

## Frontend 使用

`frontend/` 是纯静态文件，可直接双击 `index.html` 打开，或部署到任意静态托管环境。

前端特性：

- 使用 **MDUI 2**，资源直接从 CDN 引入。
- 不使用 npm / Vite / Webpack。
- 默认后端地址为 `http://127.0.0.1:8000`，可在页面表单中修改。
- 登录成功后，access token 存储在浏览器本地存储中，供演示阶段调用 `/api/v1/me`。

## 配置

后端环境变量见 [backend/.env.example](backend/.env.example)。

- 默认 SQLite 会自动创建到 `backend/.data/app.db`。
- 生产部署时建议显式设置 `GUET_DATABASE_URL` 并切换到 MySQL。

## 规划文档

详见 [plan/规划与实现.md](plan/规划与实现.md) 与 [plan/origin.md](plan/origin.md)。
