from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Tuple
from urllib.parse import unquote
from wsgiref.simple_server import make_server

_STATUS_MAP = {
    200: "OK",
    404: "Not Found",
    405: "Method Not Allowed",
}

_MIME_MAP = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
}


@dataclass
class Response:
    status_code: int
    data: bytes
    headers: Tuple[Tuple[str, str], ...]


class TestClient:
    def __init__(self, app: "TrafficSimulationApp") -> None:
        self._app = app

    def get(self, path: str) -> Response:
        status, body, headers = self._app.handle_request("GET", path)
        return Response(status, body, tuple(headers.items()))


class TrafficSimulationApp:
    def __init__(self) -> None:
        self.root = Path(__file__).resolve().parent
        self.template_path = self.root / "templates" / "index.html"
        self.static_root = self.root / "static"

    # Public API -----------------------------------------------------------------
    def run(self, host: str = "127.0.0.1", port: int = 5000) -> None:
        with make_server(host, port, self.wsgi_app) as server:
            print(f"Serving traffic simulation on http://{host}:{port}")
            try:
                server.serve_forever()
            except KeyboardInterrupt:
                print("\nServer stopped")

    def test_client(self) -> TestClient:
        return TestClient(self)

    # Internal request handling ---------------------------------------------------
    def wsgi_app(self, environ, start_response):
        method = environ.get("REQUEST_METHOD", "GET").upper()
        path = unquote(environ.get("PATH_INFO", "/"))
        status, body, headers = self.handle_request(method, path)
        status_line = f"{status} {_STATUS_MAP.get(status, 'OK')}"
        start_response(status_line, list(headers.items()))
        return [body]

    def handle_request(self, method: str, path: str) -> Tuple[int, bytes, dict[str, str]]:
        if method not in {"GET", "HEAD"}:
            return self._respond(405, b"Method Not Allowed", "text/plain; charset=utf-8")

        if path in {"", "/"}:
            body = self.template_path.read_bytes()
            return self._respond(200, body, _MIME_MAP[".html"])

        if path.startswith("/static/"):
            return self._serve_static(path.removeprefix("/static/"))

        return self._respond(404, b"Not Found", "text/plain; charset=utf-8")

    def _serve_static(self, relative: str) -> Tuple[int, bytes, dict[str, str]]:
        safe_parts = [part for part in Path(relative).parts if part not in {"..", "."}]
        static_path = self.static_root.joinpath(*safe_parts)
        if not static_path.is_file():
            return self._respond(404, b"Not Found", "text/plain; charset=utf-8")
        body = static_path.read_bytes()
        mime = _MIME_MAP.get(static_path.suffix, "application/octet-stream")
        return self._respond(200, body, mime)

    def _respond(self, status: int, body: bytes, content_type: str) -> Tuple[int, bytes, dict[str, str]]:
        headers = {"Content-Type": content_type, "Content-Length": str(len(body))}
        return status, body, headers


def create_app() -> TrafficSimulationApp:
    return TrafficSimulationApp()
