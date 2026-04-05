# Backend

GUET-AllinOne-Notifier 的后端服务，使用 FastAPI + Poetry。

## 启动

```bash
poetry install
poetry run guet-notifier
```

## 接口

- `POST /api/v1/auth/cas/login`
- `GET /api/v1/me`
- `GET /health`
