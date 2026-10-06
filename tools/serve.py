"""Preview the static site with the same 404 page as GitHub Pages."""

from functools import partial
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class PreviewHandler(SimpleHTTPRequestHandler):
    def send_error(self, code, message=None, explain=None):
        if code != HTTPStatus.NOT_FOUND:
            return super().send_error(code, message, explain)

        # Keep the missing URL and HTTP status; only replace the response body.
        body = (ROOT / "404.html").read_bytes()
        self.send_response(code)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)


if __name__ == "__main__":
    handler = partial(PreviewHandler, directory=str(ROOT))
    with ThreadingHTTPServer(("127.0.0.1", 8000), handler) as server:
        print("Preview: http://localhost:8000", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
