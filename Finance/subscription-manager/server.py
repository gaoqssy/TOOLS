#!/usr/bin/env python3
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import argparse
import json
import os
from pathlib import Path
import tempfile
from urllib.parse import urlparse


APP_DIR = Path(__file__).resolve().parent
DATA_DIR = APP_DIR / "data"
DATA_FILE = DATA_DIR / "recurring-expenses.json"
SCHEMA_VERSION = 1
SOURCE = "TOOLS/Finance/subscription-manager"


def empty_payload():
    return {
        "schemaVersion": SCHEMA_VERSION,
        "updatedAt": None,
        "source": SOURCE,
        "records": [],
    }


def schema_version_from(payload):
    try:
        return int(payload.get("schemaVersion", SCHEMA_VERSION))
    except (TypeError, ValueError, AttributeError):
        return SCHEMA_VERSION


def read_payload():
    if not DATA_FILE.exists():
        return empty_payload()
    try:
        with DATA_FILE.open("r", encoding="utf-8") as file:
            payload = json.load(file)
    except (OSError, json.JSONDecodeError):
        return empty_payload()

    records = payload if isinstance(payload, list) else payload.get("records", [])
    if not isinstance(records, list):
        records = []

    return {
        "schemaVersion": schema_version_from(payload) if isinstance(payload, dict) else SCHEMA_VERSION,
        "updatedAt": payload.get("updatedAt") if isinstance(payload, dict) else None,
        "source": payload.get("source", SOURCE) if isinstance(payload, dict) else SOURCE,
        "records": records,
    }


def write_payload(payload):
    records = payload if isinstance(payload, list) else payload.get("records", [])
    if not isinstance(records, list):
        raise ValueError("records must be an array")

    output = {
        "schemaVersion": SCHEMA_VERSION,
        "updatedAt": payload.get("updatedAt") if isinstance(payload, dict) else None,
        "source": SOURCE,
        "records": records,
    }

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=DATA_DIR, delete=False) as file:
        json.dump(output, file, ensure_ascii=False, indent=2)
        file.write("\n")
        temp_name = file.name
    os.replace(temp_name, DATA_FILE)
    return output


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(APP_DIR), **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, PUT, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/health":
            self.respond_json({"ok": True, "source": SOURCE, "dataFile": str(DATA_FILE)})
            return
        if path == "/api/records":
            self.respond_json(read_payload())
            return
        super().do_GET()

    def do_PUT(self):
        path = urlparse(self.path).path
        if path != "/api/records":
            self.send_error(404, "Not found")
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            body = self.rfile.read(length).decode("utf-8")
            payload = json.loads(body) if body else {}
            self.respond_json(write_payload(payload))
        except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as error:
            self.respond_json({"error": str(error)}, status=400)

    def respond_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    parser = argparse.ArgumentParser(description="Run the subscription manager data service.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8787, type=int)
    args = parser.parse_args()

    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"Subscription manager running at http://{args.host}:{args.port}/")
    print(f"Data file: {DATA_FILE}")
    server.serve_forever()


if __name__ == "__main__":
    main()
