from __future__ import annotations

from . import create_app


def run() -> None:
    app = create_app()
    app.run(host="127.0.0.1", port=5000)

