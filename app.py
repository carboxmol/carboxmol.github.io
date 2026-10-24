from http.server import BaseHTTPRequestHandler

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(308)
        self.send_header("Location", f"https://carboxmol.github.io{self.path}")
        self.end_headers()

app = handler
