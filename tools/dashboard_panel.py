#!/usr/bin/env python3
"""Generate a static snapshot page for the TOOLS dashboard."""

from __future__ import annotations

import argparse
import html
import json
import sys
from pathlib import Path


ROOT_DEFAULT = Path("/Users/gao/Desktop/TOOLS")


def load_dashboard(root: Path) -> dict:
    sys.path.insert(0, str(root))
    from tools_server import build_dashboard  # pylint: disable=import-outside-toplevel

    return build_dashboard()


def render_static_html(payload: dict) -> str:
    escaped_payload = html.escape(json.dumps(payload, ensure_ascii=False), quote=False)
    return f"""<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>TOOLS 总看板</title>
    <link rel="stylesheet" href="styles.css">
  </head>
  <body>
    <header class="page-header">
      <div>
        <p class="eyebrow">TOOLS Dashboard</p>
        <h1>今日看板</h1>
        <p id="generatedAt">正在读取工具数据...</p>
      </div>
      <button id="refreshButton" type="button">刷新</button>
    </header>

    <main class="shell">
      <section class="summary-grid">
        <article>
          <span>活跃固定支出</span>
          <strong id="activeCount">0</strong>
        </article>
        <article>
          <span>月均固定支出</span>
          <strong id="monthlyTotal">¥0.00</strong>
        </article>
        <article>
          <span>未来 7 天</span>
          <strong id="next7Total">¥0.00</strong>
        </article>
        <article>
          <span>未来 30 天</span>
          <strong id="next30Total">¥0.00</strong>
        </article>
        <article>
          <span>今日日历清单</span>
          <strong id="todayCalendarCount">0</strong>
        </article>
      </section>

      <section class="grid">
        <article class="panel">
          <h2>今日日历清单</h2>
          <div id="todayCalendarItems" class="list"></div>
        </article>
        <article class="panel">
          <h2>未来 7 天扣费</h2>
          <div id="upcoming7" class="list"></div>
        </article>
        <article class="panel">
          <h2>注意事项</h2>
          <div id="notices" class="list"></div>
        </article>
      </section>

      <section class="panel">
        <h2>纪念日</h2>
        <div id="anniversaries" class="list compact"></div>
      </section>

      <section class="panel">
        <h2>未来 7 天日程 / 清单</h2>
        <div id="calendarNext7" class="list compact"></div>
      </section>

      <section class="panel">
        <h2>未来 30 天扣费</h2>
        <div id="upcoming30" class="list compact"></div>
      </section>
    </main>

    <script id="dashboard-data" type="application/json">{escaped_payload}</script>
    <script src="app.js"></script>
  </body>
</html>
"""


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT_DEFAULT)
    args = parser.parse_args()

    root = args.root.expanduser().resolve()
    dashboard_dir = root / "dashboard"
    dashboard_dir.mkdir(parents=True, exist_ok=True)
    payload = load_dashboard(root)
    output = dashboard_dir / "static.html"
    output.write_text(render_static_html(payload), encoding="utf-8")
    print(f"Generated {output}")
    print(f"Date: {payload.get('date')}")


if __name__ == "__main__":
    main()
