#!/usr/bin/env python3
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import argparse
import json
import os
from pathlib import Path
import tempfile
from urllib.parse import urlparse
from urllib.parse import parse_qs
from urllib.parse import urlencode
from urllib.request import Request
from urllib.request import urlopen


APP_DIR = Path(__file__).resolve().parent
DATA_DIR = APP_DIR / "data"
DATA_FILE = DATA_DIR / "trips.json"
SCHEMA_VERSION = 1
SOURCE = "TOOLS/Life/travel-planner"
STORAGE_KEY = "tools.life.travel_planner.v1"
SEARCH_USER_AGENT = "TOOLS-travel-planner/1.0 (sg22@mails.tsinghua.edu.cn)"
SEARCH_ALIAS_PAIRS = [
    ("东京", "東京"),
    ("京都", "京都"),
    ("大阪", "大阪"),
    ("名古屋", "名古屋"),
    ("札幌", "札幌"),
    ("奈良", "奈良"),
    ("神户", "神戸"),
    ("横滨", "横浜"),
    ("福冈", "福岡"),
    ("新宿", "新宿"),
    ("涩谷", "渋谷"),
    ("站", "駅"),
    ("机场", "空港"),
]
SEARCH_ENGLISH_PAIRS = [
    ("东京", "Tokyo"),
    ("京都", "Kyoto"),
    ("大阪", "Osaka"),
    ("名古屋", "Nagoya"),
    ("札幌", "Sapporo"),
    ("奈良", "Nara"),
    ("神户", "Kobe"),
    ("横滨", "Yokohama"),
    ("福冈", "Fukuoka"),
    ("新宿", "Shinjuku"),
    ("涩谷", "Shibuya"),
    ("站", " Station"),
    ("机场", " Airport"),
]


def empty_payload():
    return {
        "schemaVersion": SCHEMA_VERSION,
        "updatedAt": None,
        "source": SOURCE,
        "storageKey": STORAGE_KEY,
        "trips": [],
    }


def schema_version_from(payload):
    try:
        return int(payload.get("schemaVersion", SCHEMA_VERSION))
    except (TypeError, ValueError, AttributeError):
        return SCHEMA_VERSION


def normalize_payload(payload):
    if isinstance(payload, list):
        trips = payload
    elif isinstance(payload, dict):
        trips = payload.get("trips", [])
    else:
        trips = []
    if not isinstance(trips, list):
        trips = []

    return {
        "schemaVersion": schema_version_from(payload) if isinstance(payload, dict) else SCHEMA_VERSION,
        "updatedAt": payload.get("updatedAt") if isinstance(payload, dict) else None,
        "source": payload.get("source", SOURCE) if isinstance(payload, dict) else SOURCE,
        "storageKey": payload.get("storageKey", STORAGE_KEY) if isinstance(payload, dict) else STORAGE_KEY,
        "trips": trips,
    }


def read_payload():
    if not DATA_FILE.exists():
        return empty_payload()
    try:
        with DATA_FILE.open("r", encoding="utf-8") as file:
            payload = json.load(file)
    except (OSError, json.JSONDecodeError):
        return empty_payload()
    return normalize_payload(payload)


def write_payload(payload):
    output = normalize_payload(payload)
    output["schemaVersion"] = SCHEMA_VERSION
    output["source"] = SOURCE
    output["storageKey"] = STORAGE_KEY

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=DATA_DIR, delete=False) as file:
        json.dump(output, file, ensure_ascii=False, indent=2)
        file.write("\n")
        temp_name = file.name
    os.replace(temp_name, DATA_FILE)
    return output


def search_places(query):
    query = (query or "").strip()
    if not query:
        return {"results": []}

    results = []
    seen = set()
    for candidate in search_query_variants(query):
        for result in photon_search(candidate):
            key = (round(float(result["latitude"]), 6), round(float(result["longitude"]), 6), result["name"])
            if key in seen:
                continue
            seen.add(key)
            results.append(result)
        if len(results) >= 8:
            break
    return {"results": results[:8]}


def search_query_variants(query):
    localized = query
    for source, target in SEARCH_ALIAS_PAIRS:
        localized = localized.replace(source, target)
    english = query
    for source, target in SEARCH_ENGLISH_PAIRS:
        english = english.replace(source, target)

    variants = []
    preferred_values = [localized, english, query] if localized != query or english != query else [query]
    for value in preferred_values:
        value = " ".join(value.split())
        if value and value not in variants:
            variants.append(value)
    return variants


def photon_search(query):
    params = urlencode({"q": query, "limit": 8})
    request = Request(
        f"https://photon.komoot.io/api/?{params}",
        headers={
            "Accept": "application/json",
            "User-Agent": SEARCH_USER_AGENT,
        },
    )
    with urlopen(request, timeout=8) as response:
        payload = json.loads(response.read().decode("utf-8"))

    results = []
    for feature in payload.get("features", []):
        properties = feature.get("properties") or {}
        geometry = feature.get("geometry") or {}
        coordinates = geometry.get("coordinates") or []
        if len(coordinates) < 2:
            continue
        title = properties.get("name") or query
        address_parts = [
            properties.get("street"),
            properties.get("district"),
            properties.get("city"),
            properties.get("state"),
            properties.get("country"),
        ]
        address = ", ".join([part for part in address_parts if part])
        results.append({
            "name": title,
            "displayName": address or title,
            "latitude": coordinates[1],
            "longitude": coordinates[0],
            "source": "photon",
        })
    return results


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
        if path == "/api/place-search":
            query = parse_qs(urlparse(self.path).query).get("q", [""])[0]
            try:
                self.respond_json(search_places(query))
            except (OSError, TimeoutError, json.JSONDecodeError) as error:
                self.respond_json({"error": str(error), "results": []}, status=502)
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
    parser = argparse.ArgumentParser(description="Run the travel planner data service.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8788, type=int)
    args = parser.parse_args()

    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"Travel planner running at http://{args.host}:{args.port}/")
    print(f"Data file: {DATA_FILE}")
    server.serve_forever()


if __name__ == "__main__":
    main()
