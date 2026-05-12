#!/usr/bin/env python3
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import argparse
from datetime import date, datetime, timedelta
import json
import os
from pathlib import Path
import tempfile
from urllib.parse import urlparse


ROOT_DIR = Path(__file__).resolve().parent
SUBSCRIPTION_DATA_FILE = ROOT_DIR / "Finance/subscription-manager/data/recurring-expenses.json"
AGENT_STATE_DIR = ROOT_DIR / ".agent-state"
DAILY_DASHBOARD_FILE = AGENT_STATE_DIR / "daily-dashboard.json"
SCHEMA_VERSION = 1
SOURCE = "TOOLS/root-dashboard"


def read_json(path, fallback):
    if not path.exists():
        return fallback
    try:
        with path.open("r", encoding="utf-8") as file:
            return json.load(file)
    except (OSError, json.JSONDecodeError):
        return fallback


def write_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as file:
        json.dump(payload, file, ensure_ascii=False, indent=2)
        file.write("\n")
        temp_name = file.name
    os.replace(temp_name, path)
    return payload


def subscription_payload():
    payload = read_json(
        SUBSCRIPTION_DATA_FILE,
        {
            "schemaVersion": SCHEMA_VERSION,
            "updatedAt": None,
            "source": "TOOLS/Finance/subscription-manager",
            "records": [],
        },
    )
    records = payload if isinstance(payload, list) else payload.get("records", [])
    if not isinstance(records, list):
        records = []
    return {
        "schemaVersion": payload.get("schemaVersion", SCHEMA_VERSION) if isinstance(payload, dict) else SCHEMA_VERSION,
        "updatedAt": payload.get("updatedAt") if isinstance(payload, dict) else None,
        "source": payload.get("source", "TOOLS/Finance/subscription-manager") if isinstance(payload, dict) else "TOOLS/Finance/subscription-manager",
        "records": records,
    }


def write_subscription_payload(payload):
    records = payload if isinstance(payload, list) else payload.get("records", [])
    if not isinstance(records, list):
        raise ValueError("records must be an array")
    output = {
        "schemaVersion": SCHEMA_VERSION,
        "updatedAt": payload.get("updatedAt") if isinstance(payload, dict) else datetime.utcnow().isoformat() + "Z",
        "source": "TOOLS/Finance/subscription-manager",
        "records": records,
    }
    return write_json(SUBSCRIPTION_DATA_FILE, output)


def parse_date(value):
    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError):
        return None


def add_months(value, count):
    month_index = value.month - 1 + count
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    last_day = [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
    return date(year, month, min(value.day, last_day))


def add_cycle(value, cycle):
    if cycle == "weekly":
        return value + timedelta(days=7)
    if cycle == "quarterly":
        return add_months(value, 3)
    if cycle == "semiannual":
        return add_months(value, 6)
    if cycle == "yearly":
        return add_months(value, 12)
    return add_months(value, 1)


def next_occurrence(record, from_day):
    value = parse_date(record.get("nextChargeDate"))
    if value is None:
        return None
    while value < from_day:
        value = add_cycle(value, record.get("cycle", "monthly"))
    return value


def occurrences_until(record, from_day, end_day):
    dates = []
    current = next_occurrence(record, from_day)
    while current and current <= end_day:
        dates.append(current)
        current = add_cycle(current, record.get("cycle", "monthly"))
    return dates


def monthly_cost(record):
    if record.get("status", "active") != "active":
        return 0
    amount = float(record.get("amount") or 0)
    cycle = record.get("cycle", "monthly")
    if cycle == "weekly":
        return amount * 52 / 12
    if cycle == "quarterly":
        return amount / 3
    if cycle == "semiannual":
        return amount / 6
    if cycle == "yearly":
        return amount / 12
    return amount


def add_money(target, currency, amount):
    key = currency or "CNY"
    target[key] = round(target.get(key, 0) + amount, 2)
    return target


def build_dashboard():
    today = date.today()
    seven_days = today + timedelta(days=7)
    thirty_days = today + timedelta(days=30)
    records = subscription_payload()["records"]
    active_records = [record for record in records if record.get("status", "active") == "active"]

    monthly = {}
    annual = {}
    next_7_total = {}
    next_30_total = {}
    upcoming_7 = []
    upcoming_30 = []
    stale_dates = []

    for record in active_records:
        currency = record.get("currency", "CNY")
        add_money(monthly, currency, monthly_cost(record))
        add_money(annual, currency, monthly_cost(record) * 12)

        stored_date = parse_date(record.get("nextChargeDate"))
        effective_date = next_occurrence(record, today)
        if stored_date and stored_date < today:
            stale_dates.append({
                "id": record.get("id"),
                "name": record.get("name"),
                "storedNextChargeDate": stored_date.isoformat(),
                "effectiveNextChargeDate": effective_date.isoformat() if effective_date else None,
            })

        for due_date in occurrences_until(record, today, seven_days):
            add_money(next_7_total, currency, float(record.get("amount") or 0))
            upcoming_7.append(upcoming_item(record, due_date, today))
        for due_date in occurrences_until(record, today, thirty_days):
            add_money(next_30_total, currency, float(record.get("amount") or 0))
            upcoming_30.append(upcoming_item(record, due_date, today))

    upcoming_7.sort(key=lambda item: item["date"])
    upcoming_30.sort(key=lambda item: item["date"])

    return {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "date": today.isoformat(),
        "source": SOURCE,
        "tools": {
            "subscriptionManager": {
                "recordCount": len(records),
                "activeCount": len(active_records),
                "monthlyTotal": monthly,
                "annualTotal": annual,
                "next7Total": next_7_total,
                "next30Total": next_30_total,
                "upcoming7": upcoming_7,
                "upcoming30": upcoming_30,
                "staleNextChargeDates": stale_dates,
                "dataFile": str(SUBSCRIPTION_DATA_FILE),
            }
        },
    }


def upcoming_item(record, due_date, today):
    return {
        "id": record.get("id"),
        "name": record.get("name"),
        "amount": record.get("amount", 0),
        "currency": record.get("currency", "CNY"),
        "category": record.get("category", "未分类"),
        "paymentAccount": record.get("paymentAccount", ""),
        "date": due_date.isoformat(),
        "daysUntil": (due_date - today).days,
    }


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT_DIR), **kwargs)

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
            self.respond_json({"ok": True, "source": SOURCE, "root": str(ROOT_DIR)})
            return
        if path in ["/api/dashboard", "/api/tools-dashboard"]:
            self.respond_json(build_dashboard())
            return
        if path in ["/api/records", "/api/subscription-records"]:
            self.respond_json(subscription_payload())
            return
        if path == "/api/agent-state/daily-dashboard":
            self.respond_json(read_json(DAILY_DASHBOARD_FILE, {}))
            return
        super().do_GET()

    def do_PUT(self):
        path = urlparse(self.path).path
        try:
            payload = self.read_body()
            if path in ["/api/records", "/api/subscription-records"]:
                self.respond_json(write_subscription_payload(payload))
                return
            if path == "/api/agent-state/daily-dashboard":
                self.respond_json(write_json(DAILY_DASHBOARD_FILE, payload))
                return
            self.send_error(404, "Not found")
        except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as error:
            self.respond_json({"error": str(error)}, status=400)

    def read_body(self):
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length).decode("utf-8")
        return json.loads(body) if body else {}

    def respond_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    parser = argparse.ArgumentParser(description="Run the TOOLS root dashboard service.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8790, type=int)
    args = parser.parse_args()

    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"TOOLS dashboard running at http://{args.host}:{args.port}/dashboard/")
    print(f"Root: {ROOT_DIR}")
    server.serve_forever()


if __name__ == "__main__":
    main()

