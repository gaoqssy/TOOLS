const els = {
  generatedAt: document.querySelector("#generatedAt"),
  refreshButton: document.querySelector("#refreshButton"),
  activeCount: document.querySelector("#activeCount"),
  monthlyTotal: document.querySelector("#monthlyTotal"),
  next7Total: document.querySelector("#next7Total"),
  next30Total: document.querySelector("#next30Total"),
  todayCalendarCount: document.querySelector("#todayCalendarCount"),
  upcoming7: document.querySelector("#upcoming7"),
  upcoming30: document.querySelector("#upcoming30"),
  notices: document.querySelector("#notices"),
  todayCalendarItems: document.querySelector("#todayCalendarItems"),
  calendarNext7: document.querySelector("#calendarNext7"),
};

function formatMoney(amount, currency = "CNY") {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(Number(amount) || 0);
}

function formatMoneyMap(amounts) {
  const entries = Object.entries(amounts || {}).filter(([, value]) => Math.abs(value) > 0.0001);
  if (!entries.length) return formatMoney(0, "CNY");
  return entries.map(([currency, amount]) => formatMoney(amount, currency)).join(" + ");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderList(container, items, emptyText) {
  container.innerHTML = "";
  if (!items.length) {
    container.innerHTML = `<p class="empty">${emptyText}</p>`;
    return;
  }
  for (const item of items) {
    const row = document.createElement("article");
    row.className = `item${item.daysUntil <= 7 ? " soon" : ""}`;
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(item.name)}</strong>
        <span>${escapeHtml(item.date)} · ${item.daysUntil === 0 ? "今天" : `${item.daysUntil} 天后`} · ${escapeHtml(item.category)} · ${escapeHtml(item.paymentAccount || "未记录账户")}</span>
      </div>
      <div class="amount">${formatMoney(item.amount, item.currency)}</div>
    `;
    container.appendChild(row);
  }
}

function renderCalendarItems(container, items, emptyText) {
  container.innerHTML = "";
  if (!items.length) {
    container.innerHTML = `<p class="empty">${emptyText}</p>`;
    return;
  }
  for (const item of items) {
    const row = document.createElement("article");
    row.className = `item calendar${item.daysUntil === 0 ? " today" : ""}`;
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(item.date)} · ${item.daysUntil === 0 ? "今天" : `${item.daysUntil} 天后`} · 日历清单</span>
      </div>
    `;
    container.appendChild(row);
  }
}

function calendarNext7Items(calendarTask) {
  const items = (calendarTask.next7Items || []).map((item) => ({
    ...item,
    title: item.lines?.join(" / ") || item.title,
  }));
  const events = (calendarTask.next7Events || []).map((event) => ({
    ...event,
    title: event.title,
  }));
  return [...items, ...events].sort((a, b) => a.date.localeCompare(b.date));
}

function renderNotices(staleRecords) {
  els.notices.innerHTML = "";
  if (!staleRecords.length) {
    els.notices.innerHTML = '<p class="empty">暂无需要处理的数据提醒。</p>';
    return;
  }
  for (const record of staleRecords) {
    const row = document.createElement("article");
    row.className = "item warning";
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(record.name)}</strong>
        <span>存储的下次扣费日是 ${escapeHtml(record.storedNextChargeDate)}，有效下次扣费日应为 ${escapeHtml(record.effectiveNextChargeDate)}。确认已扣费后再更新存储值。</span>
      </div>
    `;
    els.notices.appendChild(row);
  }
}

async function loadDashboard() {
  els.generatedAt.textContent = "正在读取工具数据...";
  const response = await fetch("/api/dashboard", { cache: "no-store" });
  if (!response.ok) throw new Error(`Dashboard API returned ${response.status}`);
  return response.json();
}

async function renderDashboard() {
  try {
    const data = await loadDashboard();
    const finance = data.tools.subscriptionManager;
    const calendarTask = data.tools.calendarTask || {};
    els.generatedAt.textContent = `${data.date} 生成 · ${data.generatedAt}`;
    els.activeCount.textContent = String(finance.activeCount);
    els.monthlyTotal.textContent = formatMoneyMap(finance.monthlyTotal);
    els.next7Total.textContent = formatMoneyMap(finance.next7Total);
    els.next30Total.textContent = formatMoneyMap(finance.next30Total);
    els.todayCalendarCount.textContent = String(calendarTask.todayItems?.length || 0);
    renderList(els.upcoming7, finance.upcoming7, "未来 7 天没有固定支出扣费。");
    renderList(els.upcoming30, finance.upcoming30, "未来 30 天没有固定支出扣费。");
    renderCalendarItems(els.todayCalendarItems, calendarTask.todayItems || [], "今天没有日历清单事项。");
    renderCalendarItems(els.calendarNext7, calendarNext7Items(calendarTask), "未来 7 天没有日历清单事项。");
    renderNotices(finance.staleNextChargeDates);
  } catch (error) {
    els.generatedAt.textContent = "无法连接 TOOLS 数据服务。请先运行 python3 tools_server.py。";
    console.error(error);
  }
}

els.refreshButton.addEventListener("click", renderDashboard);
renderDashboard();
