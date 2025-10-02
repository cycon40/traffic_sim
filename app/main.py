from __future__ import annotations

from . import create_app


def run() -> None:
    app = create_app()
    app.run(host="0.0.0.0")


if __name__ == "__main__":
    run()
