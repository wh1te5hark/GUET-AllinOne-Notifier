import argparse
import os

import uvicorn


def main() -> None:
    parser = argparse.ArgumentParser(description="GUET Notifier Backend")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload")
    parser.add_argument("--host", default=os.environ.get("GUET_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("GUET_PORT", "8000")))
    args = parser.parse_args()

    uvicorn.run(
        "guet_notifier.main:app",
        host=args.host,
        port=args.port,
        reload=args.reload or os.environ.get("GUET_ENV", "").lower() == "development",
    )


def dev() -> None:
    """开发模式快捷入口，默认启用 reload。"""
    host = os.environ.get("GUET_HOST", "127.0.0.1")
    port = int(os.environ.get("GUET_PORT", "8000"))
    uvicorn.run(
        "guet_notifier.main:app",
        host=host,
        port=port,
        reload=True,
    )


if __name__ == "__main__":
    main()
