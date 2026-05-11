const STORAGE_KEY = "tools.finance.recurring_expenses.v1";
const SCHEMA_VERSION = 1;

const state = {
  records: [],
  selectedIds: new Set(),
  filters: {
    category: "all",
    status: "all",
    sort: "nextChargeDate",
  },
};

const els = {
  form: document.querySelector("#expenseForm"),
  formTitle: document.querySelector("#formTitle"),
  recordId: document.querySelector("#recordId"),
  name: document.querySelector("#nameInput"),
  amount: document.querySelector("#amountInput"),
  currency: document.querySelector("#currencyInput"),
  cycle: document.querySelector("#cycleInput"),
  nextChargeDate: document.querySelector("#nextChargeDateInput"),
  category: document.querySelector("#categoryInput"),
  paymentAccount: document.querySelector("#paymentAccountInput"),
  status: document.querySelector("#statusInput"),
  notes: document.querySelector("#notesInput"),
  resetForm: document.querySelector("#resetFormButton"),
  clearAll: document.querySelector("#clearAllButton"),
  deleteSelected: document.querySelector("#deleteSelectedButton"),
  selectAll: document.querySelector("#selectAllCheckbox"),
  exportJson: document.querySelector("#exportJsonButton"),
  importJson: document.querySelector("#importJsonButton"),
  importJsonInput: document.querySelector("#importJsonInput"),
  monthlyTotal: document.querySelector("#monthlyTotal"),
  annualTotal: document.querySelector("#annualTotal"),
  next30Total: document.querySelector("#next30Total"),
  activeCount: document.querySelector("#activeCount"),
  upcomingList: document.querySelector("#upcomingList"),
  tableBody: document.querySelector("#expenseTableBody"),
  emptyState: document.querySelector("#emptyState"),
  categoryFilter: document.querySelector("#categoryFilter"),
  statusFilter: document.querySelector("#statusFilter"),
  sortSelect: document.querySelector("#sortSelect"),
};

function todayAtStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function parseLocalDate(value) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatLocalDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysBetween(start, end) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((end - start) / msPerDay);
}

function addMonths(date, count) {
  const result = new Date(date);
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + count);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}

function addCycle(date, cycle) {
  if (cycle === "weekly") {
    const result = new Date(date);
    result.setDate(result.getDate() + 7);
    return result;
  }
  if (cycle === "quarterly") return addMonths(date, 3);
  if (cycle === "semiannual") return addMonths(date, 6);
  if (cycle === "yearly") return addMonths(date, 12);
  return addMonths(date, 1);
}

function nextOccurrenceOnOrAfter(record, fromDate) {
  let date = parseLocalDate(record.nextChargeDate);
  if (!date) return null;
  while (date < fromDate) {
    date = addCycle(date, record.cycle);
  }
  return date;
}

function occurrencesUntil(record, fromDate, endDate) {
  const dates = [];
  let date = nextOccurrenceOnOrAfter(record, fromDate);
  while (date && date <= endDate) {
    dates.push(new Date(date));
    date = addCycle(date, record.cycle);
  }
  return dates;
}

function monthlyCost(record) {
  const amount = Number(record.amount) || 0;
  if (record.status !== "active") return 0;
  if (record.cycle === "weekly") return (amount * 52) / 12;
  if (record.cycle === "quarterly") return amount / 3;
  if (record.cycle === "semiannual") return amount / 6;
  if (record.cycle === "yearly") return amount / 12;
  return amount;
}

function annualCost(record) {
  return monthlyCost(record) * 12;
}

function formatMoney(amount, currency = "CNY") {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(Number(amount) || 0);
}

function formatMoneyMap(amountsByCurrency) {
  const entries = Object.entries(amountsByCurrency).filter(([, amount]) => Math.abs(amount) > 0.0001);
  if (!entries.length) return formatMoney(0, "CNY");
  return entries.map(([currency, amount]) => formatMoney(amount, currency)).join(" + ");
}

function addToMoneyMap(map, currency, amount) {
  const key = currency || "CNY";
  map[key] = (map[key] || 0) + amount;
  return map;
}

function cycleLabel(cycle) {
  return {
    weekly: "每周",
    monthly: "每月",
    quarterly: "每季度",
    semiannual: "每半年",
    yearly: "每年",
  }[cycle] || "每月";
}

function statusLabel(status) {
  return {
    active: "启用",
    paused: "暂停",
    canceled: "取消",
  }[status] || "启用";
}

function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `rec_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function normalizeRecord(record) {
  return {
    id: String(record.id || makeId()),
    type: "recurring_expense",
    name: String(record.name || "").trim(),
    amount: Number(record.amount) || 0,
    currency: String(record.currency || "CNY").trim() || "CNY",
    cycle: ["weekly", "monthly", "quarterly", "semiannual", "yearly"].includes(record.cycle)
      ? record.cycle
      : "monthly",
    nextChargeDate: String(record.nextChargeDate || ""),
    category: String(record.category || "未分类").trim() || "未分类",
    paymentAccount: String(record.paymentAccount || "").trim(),
    status: ["active", "paused", "canceled"].includes(record.status) ? record.status : "active",
    notes: String(record.notes || "").trim(),
    createdAt: record.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function loadRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const payload = JSON.parse(raw);
    const records = Array.isArray(payload) ? payload : payload.records;
    if (!Array.isArray(records)) return [];
    return records.map(normalizeRecord).filter((record) => record.name && record.nextChargeDate);
  } catch (error) {
    console.error("Failed to load recurring expenses", error);
    return [];
  }
}

function saveRecords() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      source: "TOOLS/Finance/subscription-manager",
      records: state.records,
    })
  );
}

function buildExportPayload() {
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    source: "TOOLS/Finance/subscription-manager",
    storageKey: STORAGE_KEY,
    records: state.records,
  };
}

function resetForm() {
  els.form.reset();
  els.recordId.value = "";
  els.currency.value = "CNY";
  els.cycle.value = "monthly";
  els.status.value = "active";
  els.formTitle.textContent = "新增固定支出";
}

function recordFromForm() {
  const existing = state.records.find((record) => record.id === els.recordId.value);
  return normalizeRecord({
    id: els.recordId.value || makeId(),
    name: els.name.value,
    amount: els.amount.value,
    currency: els.currency.value,
    cycle: els.cycle.value,
    nextChargeDate: els.nextChargeDate.value,
    category: els.category.value,
    paymentAccount: els.paymentAccount.value,
    status: els.status.value,
    notes: els.notes.value,
    createdAt: existing?.createdAt,
  });
}

function applyFilters(records) {
  const filtered = records.filter((record) => {
    const categoryMatch = state.filters.category === "all" || record.category === state.filters.category;
    const statusMatch = state.filters.status === "all" || record.status === state.filters.status;
    return categoryMatch && statusMatch;
  });

  return filtered.sort((a, b) => {
    if (state.filters.sort === "amountDesc") return Number(b.amount) - Number(a.amount);
    if (state.filters.sort === "name") return a.name.localeCompare(b.name, "zh-CN");
    if (state.filters.sort === "category") return a.category.localeCompare(b.category, "zh-CN");
    const today = todayAtStart();
    const aDate = nextOccurrenceOnOrAfter(a, today)?.getTime() || Infinity;
    const bDate = nextOccurrenceOnOrAfter(b, today)?.getTime() || Infinity;
    return aDate - bDate;
  });
}

function renderSummary() {
  const activeRecords = state.records.filter((record) => record.status === "active");
  const monthly = activeRecords.reduce(
    (sum, record) => addToMoneyMap(sum, record.currency, monthlyCost(record)),
    {}
  );
  const annual = activeRecords.reduce(
    (sum, record) => addToMoneyMap(sum, record.currency, annualCost(record)),
    {}
  );
  const today = todayAtStart();
  const in30Days = new Date(today);
  in30Days.setDate(in30Days.getDate() + 30);
  const next30 = activeRecords.reduce((sum, record) => {
    const amount = occurrencesUntil(record, today, in30Days).length * Number(record.amount || 0);
    return addToMoneyMap(sum, record.currency, amount);
  }, {});

  els.monthlyTotal.textContent = formatMoneyMap(monthly);
  els.annualTotal.textContent = formatMoneyMap(annual);
  els.next30Total.textContent = formatMoneyMap(next30);
  els.activeCount.textContent = String(activeRecords.length);
}

function renderUpcoming() {
  const today = todayAtStart();
  const in30Days = new Date(today);
  in30Days.setDate(in30Days.getDate() + 30);

  const upcoming = state.records
    .filter((record) => record.status === "active")
    .map((record) => ({
      record,
      date: nextOccurrenceOnOrAfter(record, today),
    }))
    .filter((item) => item.date && item.date <= in30Days)
    .sort((a, b) => a.date - b.date);

  els.upcomingList.innerHTML = "";

  if (!upcoming.length) {
    els.upcomingList.innerHTML = '<p class="empty-state visible">未来 30 天没有扣费项目。</p>';
    return;
  }

  for (const item of upcoming) {
    const days = daysBetween(today, item.date);
    const row = document.createElement("article");
    row.className = `upcoming-item${days <= 7 ? " soon" : ""}`;
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(item.record.name)}</strong>
        <span>${formatLocalDate(item.date)} · ${days === 0 ? "今天" : `${days} 天后`} · ${escapeHtml(item.record.category)}</span>
      </div>
      <div class="upcoming-amount">${formatMoney(item.record.amount, item.record.currency)}</div>
    `;
    els.upcomingList.appendChild(row);
  }
}

function renderCategoryFilter() {
  const current = els.categoryFilter.value || "all";
  const categories = [...new Set(state.records.map((record) => record.category).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "zh-CN")
  );
  els.categoryFilter.innerHTML = '<option value="all">全部分类</option>';
  for (const category of categories) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    els.categoryFilter.appendChild(option);
  }
  els.categoryFilter.value = categories.includes(current) ? current : "all";
  state.filters.category = els.categoryFilter.value;
}

function renderTable() {
  const records = applyFilters([...state.records]);
  els.tableBody.innerHTML = "";
  els.emptyState.classList.toggle("visible", records.length === 0);

  for (const record of records) {
    const nextDate = nextOccurrenceOnOrAfter(record, todayAtStart());
    const row = document.createElement("tr");
    row.innerHTML = `
      <td class="selection-cell">
        <input class="row-select" type="checkbox" data-id="${record.id}" aria-label="选择 ${escapeHtml(record.name)}"${state.selectedIds.has(record.id) ? " checked" : ""}>
      </td>
      <td>
        <strong>${escapeHtml(record.name)}</strong>
        ${record.notes ? `<div class="muted-note">${escapeHtml(record.notes)}</div>` : ""}
      </td>
      <td>${formatMoney(record.amount, record.currency)}</td>
      <td>${cycleLabel(record.cycle)}</td>
      <td>${nextDate ? formatLocalDate(nextDate) : "-"}</td>
      <td>${escapeHtml(record.category)}</td>
      <td>${escapeHtml(record.paymentAccount || "-")}</td>
      <td><span class="status-badge status-${record.status}">${statusLabel(record.status)}</span></td>
      <td>
        <div class="actions-cell">
          <button class="button subtle table-action" type="button" data-action="edit" data-id="${record.id}">编辑</button>
        </div>
      </td>
    `;
    els.tableBody.appendChild(row);
  }
  syncSelectionControls(records);
}

function render() {
  renderCategoryFilter();
  renderSummary();
  renderUpcoming();
  renderTable();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function editRecord(id) {
  const record = state.records.find((item) => item.id === id);
  if (!record) return;
  els.recordId.value = record.id;
  els.name.value = record.name;
  els.amount.value = record.amount;
  els.currency.value = record.currency;
  els.cycle.value = record.cycle;
  els.nextChargeDate.value = record.nextChargeDate;
  els.category.value = record.category;
  els.paymentAccount.value = record.paymentAccount;
  els.status.value = record.status;
  els.notes.value = record.notes;
  els.formTitle.textContent = "编辑固定支出";
  els.name.focus();
}

function syncSelectionControls(visibleRecords = applyFilters([...state.records])) {
  const visibleIds = visibleRecords.map((record) => record.id);
  const selectedVisibleCount = visibleIds.filter((id) => state.selectedIds.has(id)).length;
  els.deleteSelected.disabled = state.selectedIds.size === 0;
  els.deleteSelected.textContent = state.selectedIds.size
    ? `删除选中 (${state.selectedIds.size})`
    : "删除选中";
  els.selectAll.checked = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;
  els.selectAll.indeterminate = selectedVisibleCount > 0 && selectedVisibleCount < visibleIds.length;
}

function deleteSelectedRecords() {
  const selectedRecords = state.records.filter((record) => state.selectedIds.has(record.id));
  if (!selectedRecords.length) return;
  if (!confirm(`删除选中的 ${selectedRecords.length} 条固定支出？`)) return;
  state.records = state.records.filter((record) => !state.selectedIds.has(record.id));
  state.selectedIds.clear();
  saveRecords();
  render();
}

function exportJson() {
  const blob = new Blob([JSON.stringify(buildExportPayload(), null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `recurring-expenses-${formatLocalDate(todayAtStart())}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importJsonFile(file) {
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const payload = JSON.parse(String(reader.result));
      const records = Array.isArray(payload) ? payload : payload.records;
      if (!Array.isArray(records)) {
        throw new Error("JSON 中没有 records 数组。");
      }
      const normalized = records.map(normalizeRecord).filter((record) => record.name && record.nextChargeDate);
      if (!confirm(`导入 ${normalized.length} 条记录并覆盖当前数据？`)) return;
      state.records = normalized;
      saveRecords();
      resetForm();
      render();
    } catch (error) {
      alert(`导入失败：${error.message}`);
    } finally {
      els.importJsonInput.value = "";
    }
  });
  reader.readAsText(file);
}

els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const record = recordFromForm();
  if (!record.name || !record.nextChargeDate) return;
  const existingIndex = state.records.findIndex((item) => item.id === record.id);
  if (existingIndex >= 0) {
    state.records[existingIndex] = record;
  } else {
    state.records.push(record);
  }
  state.selectedIds.delete(record.id);
  saveRecords();
  resetForm();
  render();
});

els.resetForm.addEventListener("click", resetForm);

els.clearAll.addEventListener("click", () => {
  if (!state.records.length) return;
  if (!confirm("清空所有固定支出记录？建议先导出 JSON 备份。")) return;
  state.records = [];
  state.selectedIds.clear();
  saveRecords();
  resetForm();
  render();
});

els.deleteSelected.addEventListener("click", deleteSelectedRecords);

els.selectAll.addEventListener("change", () => {
  const visibleRecords = applyFilters([...state.records]);
  for (const record of visibleRecords) {
    if (els.selectAll.checked) {
      state.selectedIds.add(record.id);
    } else {
      state.selectedIds.delete(record.id);
    }
  }
  renderTable();
});

els.exportJson.addEventListener("click", exportJson);
els.importJson.addEventListener("click", () => els.importJsonInput.click());
els.importJsonInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (file) importJsonFile(file);
});

els.categoryFilter.addEventListener("change", () => {
  state.filters.category = els.categoryFilter.value;
  renderTable();
});

els.statusFilter.addEventListener("change", () => {
  state.filters.status = els.statusFilter.value;
  renderTable();
});

els.sortSelect.addEventListener("change", () => {
  state.filters.sort = els.sortSelect.value;
  renderTable();
});

els.tableBody.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const id = button.dataset.id;
  if (button.dataset.action === "edit") editRecord(id);
});

els.tableBody.addEventListener("change", (event) => {
  const checkbox = event.target.closest(".row-select");
  if (!checkbox) return;
  if (checkbox.checked) {
    state.selectedIds.add(checkbox.dataset.id);
  } else {
    state.selectedIds.delete(checkbox.dataset.id);
  }
  syncSelectionControls();
});

state.records = loadRecords();
resetForm();
render();
