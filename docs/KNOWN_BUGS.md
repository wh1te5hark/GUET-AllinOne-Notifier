# 已知问题与处理方式

本文汇总开发与部署中**已确认**的现象、原因与可行处理办法，便于排查与后续修代码时对照。条目会随版本迭代增删。

---

## 1. 根 README 中后端端口写错（8080 vs 8000）

**现象**  
按 README 以为服务在 `8080`，实际默认监听 `8000`，前端默认 API 基址也是 `http://127.0.0.1:8000`，导致联调时连错端口。

**原因**  
文档笔误；代码与 `backend/.env.example` 中 `GUET_PORT` 均为 `8000`。

**处理**  
- 以 `backend/.env.example` 与前端 `localStorage` / 表单中的 API 基址为准，使用 **8000**。  
- 根目录 `README.md` 已与本仓库同步修正为 8000。

---

## 2. 用 `file://` 直接打开前端 HTML 时接口调用失败

**现象**  
双击打开 `frontend/index.html`，登录或请求 API 报错（网络错误、CORS 或请求被拦截）。

**原因**  
浏览器对 `file://` 源的 `fetch` 限制严格；且后端 CORS 与 Cookie 策略面向 `http(s)` 页面设计。

**处理**  
- **推荐**：启动后端后通过 `http://127.0.0.1:8000/static/index.html`（或根路径重定向）访问前端（见 `backend/src/guet_notifier/main.py` 中静态挂载）。  
- 或将 `frontend/` 放到任意 HTTP 静态服务器上，并保证页面里的「API 基址」指向可访问的后端地址。

---

## 3. 前端能打开但一直连不上后端

**现象**  
页面加载正常，但登录或数据请求失败。

**处理清单**  
1. 确认后端已启动，且 `GUET_HOST`/`GUET_PORT` 与浏览器里配置的 API 基址一致。  
2. 若前端与后端不在同一主机或端口，在登录页将 API 基址改为实际后端 URL（会写入 `localStorage`）。  
3. 若走 HTTPS 页面访问 HTTP API，可能被浏览器拦截（混合内容）；改为同源 HTTPS 或本地全用 HTTP 调试。

---

## 4. SQLite 数据库无法创建或写入失败

**现象**  
启动报错与数据库/文件权限相关，或表结构异常。

**原因**  
默认库路径在 `backend/.data/app.db`（见 `guet_notifier/settings.py`），进程需要对 `backend/.data/` 有读写权限。

**处理**  
- 在 `backend` 目录下启动服务，或显式设置 `GUET_DATABASE_URL` 到有写权限的路径。  
- 生产环境建议按 `backend/.env.example` 说明配置 `GUET_DATABASE_URL`（如 MySQL）。

---

## 5. CAS 登录或二次验证失败

**现象**  
返回 400、`CasAuthError` 提示，或 2FA 流程卡住。

**处理清单**  
1. 检查 `GUET_CAS_BASE_URL` 是否与学校当前 CAS 入口一致（默认 `https://cas.guet.edu.cn`）。  
2. 确认本机到校园网的连通性（部分场景需校园网或 VPN）。  
3. 学校侧改版时，需对照 `guet_notifier.auth` 中 CAS/2FA 逻辑更新适配（属上游变更，不在本文「一行配置」范围内）。

---

## 如何贡献新条目

若你遇到可复现的问题并已验证处理方式，欢迎在本文件按同一结构追加 PR（现象 / 原因 / 处理），或在 Issue 中说明后由维护者整理进本文。
