"""Native desktop window; --browser also exposes a loopback-only preview."""
from __future__ import annotations

import argparse
import base64
import json
import mimetypes
import os
import secrets
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

from toolbox.core import MAX_INPUT, run

ROOT = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))


class Bridge:
    def __init__(self):
        self.window = None

    def save_file(self, filename, content):
        import webview
        name = Path(filename).name
        selected = self.window.create_file_dialog(webview.FileDialog.SAVE, save_filename=name)
        if not selected:
            return {"cancelled": True}
        target = Path(selected if isinstance(selected, str) else selected[0])
        data = base64.b64decode(content, validate=True)
        temp = None
        try:
            with tempfile.NamedTemporaryFile(dir=target.parent, delete=False) as f:
                temp = Path(f.name)
                f.write(data)
            os.replace(temp, target)
        finally:
            if temp and temp.exists():
                temp.unlink()
        return {"saved": True, "name": target.name}


def make_server(port=0):
    token = secrets.token_urlsafe(32)

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def respond(self, status, data, mime="application/json; charset=utf-8"):
            if isinstance(data, dict):
                data = json.dumps(data, ensure_ascii=False).encode()
            self.send_response(status)
            self.send_header("Content-Type", mime)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Referrer-Policy", "no-referrer")
            self.send_header("Content-Security-Policy", "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' blob:; worker-src 'self' blob:; frame-src 'self' blob:; object-src 'none'; base-uri 'self'")
            self.end_headers()
            self.wfile.write(data)

        def valid_host(self):
            return self.headers.get("Host") == f"127.0.0.1:{self.server.server_port}"

        def do_GET(self):
            if not self.valid_host():
                return self.respond(403, {"error": "Invalid host"})
            path = unquote(urlsplit(self.path).path)
            if path == "/session.js":
                return self.respond(200, f"window.TOOLBOX_TOKEN={json.dumps(token)};".encode(), "text/javascript")
            if path.startswith("/editor/"):
                base = ROOT / "vendor" / "minipaint"
                rel = path.removeprefix("/editor/") or "index.html"
            else:
                base = ROOT / "web"
                rel = path.lstrip("/") or "index.html"
            file = (base / rel).resolve()
            if not file.is_relative_to(base.resolve()) or not file.is_file():
                return self.respond(404, {"error": "Not found"})
            mime = mimetypes.guess_type(file.name)[0] or "application/octet-stream"
            self.respond(200, file.read_bytes(), mime)

        def do_POST(self):
            origin = f"http://127.0.0.1:{self.server.server_port}"
            if (not self.valid_host() or self.path != "/api" or self.headers.get("X-Toolbox-Token") != token
                    or self.headers.get("Origin", origin) != origin):
                return self.respond(403, {"error": "请求已拒绝，请重新打开工具箱"})
            try:
                length = int(self.headers.get("Content-Length", 0))
                if length <= 0 or length > MAX_INPUT * 4 // 3 + 1024 * 1024:
                    return self.respond(413, {"error": "文件过大，一次最多处理 120 MB"})
                request = json.loads(self.rfile.read(length))
                files = [(Path(f["name"]).name, base64.b64decode(f["data"], validate=True)) for f in request.get("files", [])]
                result = run(request["action"], files, request.get("options", {}))
                self.respond(200, result)
            except Exception as e:
                self.respond(400, {"error": str(e) or "处理失败，请检查文件格式"})

    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    server.daemon_threads = True
    return server


def main():
    if "--cli" in sys.argv:
        sys.argv.remove("--cli")
        from toolbox.cli import main as cli_main
        return cli_main()
    parser = argparse.ArgumentParser(description="轻巧工具箱")
    parser.add_argument("--browser", action="store_true", help="仅启动本地浏览器预览服务")
    parser.add_argument("--port", type=int, default=0)
    args = parser.parse_args()
    server = make_server(args.port)
    url = f"http://127.0.0.1:{server.server_port}"
    if args.browser:
        print(url, flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
        finally:
            server.server_close()
    else:
        import webview
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        bridge = Bridge()
        bridge.window = webview.create_window("轻巧工具箱 · 图片与 PDF", url, js_api=bridge,
                                             width=1280, height=860, min_size=(960, 680), background_color="#f5f6f8")
        try:
            webview.start()
        finally:
            server.shutdown()
            server.server_close()


if __name__ == "__main__":
    main()
