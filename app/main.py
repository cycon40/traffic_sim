from __future__ import annotations

import sys
from pathlib import Path

if __package__ in {None, ""}:
    sys.path.append(str(Path(__file__).resolve().parent.parent))

from app import create_app  # type: ignore


def run() -> None:
    app = create_app()
    app.run(host="127.0.0.1", port=5000)


if __name__ == "__main__":
    run()
