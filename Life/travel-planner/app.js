const STORAGE_KEY = "tools.life.travel_planner.v1";
const SOURCE = "TOOLS/Life/travel-planner";
const SCHEMA_VERSION = 1;

const state = {
  payload: emptyPayload(),
  selectedTripId: "",
  activeTab: "overview",
  serviceMode: false,
  highlightedPlaceId: "",
  map: null,
  markerLayer: null,
  searchResults: [],
};

const els = {};

const statusLabels = {
  planning: "规划中",
  booked: "已预订",
  traveling: "旅行中",
  done: "已完成",
  archived: "已归档",
};

const checklistTypeLabels = {
  todo: "行前待办",
  packing: "打包清单",
  document: "证件 / 预订",
};

const priorityLabels = {
  must: "必去",
  nice: "可选",
  backup: "备选",
};

const currencySymbols = {
  CNY: "¥",
  USD: "$",
  HKD: "HK$",
  EUR: "€",
  JPY: "¥",
};

const DEFAULT_MAP_CENTER = [39.9042, 116.4074];
const PAGES_URL = "https://gaoqssy.github.io/TOOLS/Life/travel-planner/";

document.addEventListener("DOMContentLoaded", init);

async function init() {
  cacheElements();
  bindEvents();
  await loadPayload();
  ensureSelection();
  render();
}

function cacheElements() {
  for (const element of document.querySelectorAll("[id]")) {
    els[element.id] = element;
  }
}

function bindEvents() {
  els.newTripButton.addEventListener("click", () => {
    state.selectedTripId = "";
    resetTripForm();
    render();
    els.tripNameInput.focus();
  });
  els.tripForm.addEventListener("submit", saveTripFromForm);
  els.deleteTripButton.addEventListener("click", deleteSelectedTrip);
  els.tripList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-trip-id]");
    if (!button) return;
    state.selectedTripId = button.dataset.tripId;
    resetAllItemForms();
    render();
  });

  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeTab = button.dataset.tab;
      renderTabs();
    });
  });

  els.budgetForm.addEventListener("submit", saveBudgetFromForm);
  els.itineraryForm.addEventListener("submit", saveItineraryFromForm);
  els.placeForm.addEventListener("submit", savePlaceFromForm);
  els.checklistForm.addEventListener("submit", saveChecklistFromForm);

  els.resetBudgetButton.addEventListener("click", resetBudgetForm);
  els.resetItineraryButton.addEventListener("click", resetItineraryForm);
  els.resetPlaceButton.addEventListener("click", resetPlaceForm);
  els.resetChecklistButton.addEventListener("click", resetChecklistForm);

  els.budgetTableBody.addEventListener("click", handleBudgetAction);
  els.itineraryList.addEventListener("click", handleItineraryAction);
  els.placeList.addEventListener("click", handlePlaceAction);
  els.mapCanvas.addEventListener("click", handleMapAction);
  els.mapSearchForm.addEventListener("submit", searchPlaces);
  els.mapSearchResults.addEventListener("click", handleSearchResultClick);
  els.checklistList.addEventListener("click", handleChecklistAction);
  els.checklistList.addEventListener("change", handleChecklistToggle);

  els.copySiteLinkButton.addEventListener("click", copySiteLink);
  els.exportJsonButton.addEventListener("click", exportJson);
  els.importJsonButton.addEventListener("click", () => els.importJsonInput.click());
  els.importJsonInput.addEventListener("change", importJson);
}

function emptyPayload() {
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: null,
    source: SOURCE,
    storageKey: STORAGE_KEY,
    trips: [],
  };
}

function normalizePayload(payload) {
  const trips = Array.isArray(payload?.trips) ? payload.trips : Array.isArray(payload) ? payload : [];
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: payload?.updatedAt || null,
    source: payload?.source || SOURCE,
    storageKey: payload?.storageKey || STORAGE_KEY,
    trips: trips.map(normalizeTrip),
  };
}

function normalizeTrip(trip) {
  const now = new Date().toISOString();
  return {
    id: trip.id || crypto.randomUUID(),
    type: "trip",
    name: trip.name || "未命名旅行",
    destination: trip.destination || "",
    startDate: trip.startDate || "",
    endDate: trip.endDate || "",
    status: trip.status || "planning",
    members: normalizeMembers(trip.members),
    budgets: Array.isArray(trip.budgets) ? trip.budgets.map(normalizeBudget) : [],
    itinerary: Array.isArray(trip.itinerary) ? trip.itinerary.map(normalizeItineraryItem) : [],
    places: Array.isArray(trip.places) ? trip.places.map(normalizePlace) : [],
    checklist: Array.isArray(trip.checklist) ? trip.checklist.map(normalizeChecklistItem) : [],
    notes: trip.notes || "",
    createdAt: trip.createdAt || now,
    updatedAt: trip.updatedAt || now,
  };
}

function normalizeMembers(members) {
  if (!Array.isArray(members)) return [];
  return members
    .map((member) => {
      if (typeof member === "string") return { id: crypto.randomUUID(), name: member.trim() };
      return { id: member.id || crypto.randomUUID(), name: (member.name || "").trim() };
    })
    .filter((member) => member.name);
}

function normalizeBudget(item) {
  return {
    id: item.id || crypto.randomUUID(),
    category: item.category || "其他",
    amount: Number(item.amount) || 0,
    currency: item.currency || "CNY",
    applicableMembers: item.applicableMembers || "",
    notes: item.notes || "",
  };
}

function normalizeItineraryItem(item) {
  return {
    id: item.id || crypto.randomUUID(),
    date: item.date || "",
    startTime: item.startTime || "",
    endTime: item.endTime || "",
    title: item.title || "未命名行程",
    placeId: item.placeId || "",
    category: item.category || "其他",
    estimatedCost: Number(item.estimatedCost) || 0,
    currency: item.currency || "CNY",
    owner: item.owner || "",
    notes: item.notes || "",
  };
}

function normalizePlace(item) {
  return {
    id: item.id || crypto.randomUUID(),
    name: item.name || "未命名地点",
    address: item.address || "",
    latitude: item.latitude === "" || item.latitude === null || item.latitude === undefined ? "" : Number(item.latitude),
    longitude: item.longitude === "" || item.longitude === null || item.longitude === undefined ? "" : Number(item.longitude),
    category: item.category || "其他",
    priority: item.priority || "nice",
    notes: item.notes || "",
  };
}

function normalizeChecklistItem(item) {
  return {
    id: item.id || crypto.randomUUID(),
    type: item.type || "todo",
    content: item.content || "未命名事项",
    owner: item.owner || "",
    status: item.status || "open",
    dueDate: item.dueDate || "",
    notes: item.notes || "",
  };
}

async function loadPayload() {
  try {
    const response = await fetch("api/records", { cache: "no-store" });
    if (!response.ok) throw new Error("service unavailable");
    state.payload = normalizePayload(await response.json());
    state.serviceMode = true;
    setSyncStatus("已连接本地数据服务");
  } catch (error) {
    const local = localStorage.getItem(STORAGE_KEY);
    state.payload = normalizePayload(local ? JSON.parse(local) : emptyPayload());
    state.serviceMode = false;
    setSyncStatus("本地浏览器模式");
  }
}

async function persist() {
  state.payload.updatedAt = new Date().toISOString();
  const payload = normalizePayload(state.payload);
  state.payload = payload;

  if (state.serviceMode) {
    try {
      const response = await fetch("api/records", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("save failed");
      state.payload = normalizePayload(await response.json());
      setSyncStatus("已同步到后台 JSON");
      return;
    } catch (error) {
      state.serviceMode = false;
      setSyncStatus("服务断开，已切换到浏览器模式");
    }
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function setSyncStatus(text) {
  els.syncStatus.textContent = text;
}

function ensureSelection() {
  if (state.selectedTripId && getSelectedTrip()) return;
  const visibleTrips = state.payload.trips.filter((trip) => trip.status !== "archived");
  state.selectedTripId = (visibleTrips[0] || state.payload.trips[0] || {}).id || "";
}

function getSelectedTrip() {
  return state.payload.trips.find((trip) => trip.id === state.selectedTripId) || null;
}

function updateSelectedTrip(updater) {
  const trip = getSelectedTrip();
  if (!trip) return null;
  updater(trip);
  trip.updatedAt = new Date().toISOString();
  return trip;
}

function render() {
  ensureSelection();
  renderTripList();
  renderTripForm();
  renderMemberSuggestions();
  renderPlaceOptions();
  renderSummary();
  renderOverview();
  renderBudget();
  renderItinerary();
  renderPlaces();
  renderChecklist();
  renderTabs();
}

function renderTripList() {
  const trips = [...state.payload.trips].sort((a, b) => {
    if (a.status === "archived" && b.status !== "archived") return 1;
    if (a.status !== "archived" && b.status === "archived") return -1;
    return (b.updatedAt || "").localeCompare(a.updatedAt || "");
  });
  els.tripList.innerHTML = trips.map((trip) => {
    const active = trip.id === state.selectedTripId ? " active" : "";
    return `<button class="trip-card${active}" data-trip-id="${escapeHtml(trip.id)}" type="button">
      <strong>${escapeHtml(trip.name)}</strong>
      <span>${escapeHtml(trip.destination || "未设置目的地")}</span>
      <span>${formatDateRange(trip.startDate, trip.endDate)} · ${statusLabels[trip.status] || trip.status}</span>
    </button>`;
  }).join("");
  els.tripEmptyState.hidden = trips.length > 0;
}

function renderTripForm() {
  const trip = getSelectedTrip();
  els.deleteTripButton.disabled = !trip;
  if (!trip) {
    resetTripForm();
    els.detailTitle.textContent = "新建旅行";
    els.detailSubtitle.textContent = "维护旅行基础信息、成员和状态。";
    return;
  }
  els.detailTitle.textContent = trip.name;
  els.detailSubtitle.textContent = `${trip.destination || "未设置目的地"} · ${formatDateRange(trip.startDate, trip.endDate)}`;
  els.tripIdInput.value = trip.id;
  els.tripNameInput.value = trip.name;
  els.destinationInput.value = trip.destination;
  els.startDateInput.value = trip.startDate;
  els.endDateInput.value = trip.endDate;
  els.tripStatusInput.value = trip.status;
  els.membersInput.value = trip.members.map((member) => member.name).join(", ");
  els.tripNotesInput.value = trip.notes;
}

function resetTripForm() {
  els.tripForm.reset();
  els.tripIdInput.value = "";
  els.tripStatusInput.value = "planning";
  els.detailTitle.textContent = "新建旅行";
  els.detailSubtitle.textContent = "维护旅行基础信息、成员和状态。";
  els.deleteTripButton.disabled = true;
}

async function saveTripFromForm(event) {
  event.preventDefault();
  const id = els.tripIdInput.value || crypto.randomUUID();
  const now = new Date().toISOString();
  const trip = {
    id,
    type: "trip",
    name: els.tripNameInput.value.trim(),
    destination: els.destinationInput.value.trim(),
    startDate: els.startDateInput.value,
    endDate: els.endDateInput.value,
    status: els.tripStatusInput.value,
    members: splitNames(els.membersInput.value).map((name) => ({ id: crypto.randomUUID(), name })),
    notes: els.tripNotesInput.value.trim(),
    createdAt: now,
    updatedAt: now,
    budgets: [],
    itinerary: [],
    places: [],
    checklist: [],
  };

  const existing = state.payload.trips.find((item) => item.id === id);
  if (existing) {
    Object.assign(existing, {
      name: trip.name,
      destination: trip.destination,
      startDate: trip.startDate,
      endDate: trip.endDate,
      status: trip.status,
      members: trip.members,
      notes: trip.notes,
      updatedAt: now,
    });
  } else {
    state.payload.trips.unshift(trip);
  }
  state.selectedTripId = id;
  await persist();
  render();
}

async function deleteSelectedTrip() {
  const trip = getSelectedTrip();
  if (!trip) return;
  if (!confirm(`删除旅行「${trip.name}」？这个操作会删除预算、行程、地点和清单。`)) return;
  state.payload.trips = state.payload.trips.filter((item) => item.id !== trip.id);
  state.selectedTripId = "";
  resetAllItemForms();
  await persist();
  render();
}

function renderSummary() {
  const trip = getSelectedTrip();
  if (!trip) {
    els.totalBudget.textContent = "¥0.00";
    els.perPersonBudget.textContent = "¥0.00";
    els.tripDays.textContent = "0";
    els.openChecklistCount.textContent = "0";
    return;
  }
  const budgetTotals = sumMoney(trip.budgets, "amount");
  const memberCount = Math.max(trip.members.length, 1);
  els.totalBudget.textContent = formatMoneyMap(budgetTotals);
  els.perPersonBudget.textContent = formatMoneyMap(divideMoneyMap(budgetTotals, memberCount));
  els.tripDays.textContent = String(countTripDays(trip.startDate, trip.endDate));
  els.openChecklistCount.textContent = String(trip.checklist.filter((item) => item.status !== "done").length);
}

function renderOverview() {
  const trip = getSelectedTrip();
  if (!trip) {
    els.upcomingItinerary.innerHTML = emptyMessage("选择或新建旅行后显示近期行程。");
    els.budgetOverview.innerHTML = emptyMessage("还没有预算分类。");
    els.checklistOverview.innerHTML = emptyMessage("还没有清单项。");
    return;
  }

  const itinerary = sortedItinerary(trip.itinerary).slice(0, 5);
  els.upcomingItinerary.innerHTML = itinerary.length ? itinerary.map((item) => listItemHtml({
    title: item.title,
    meta: [item.date || "未定日期", formatTimeRange(item.startTime, item.endTime), item.category, placeName(trip, item.placeId)].filter(Boolean),
    notes: item.notes,
  })).join("") : emptyMessage("还没有行程。去“行程”页添加第一项。");

  const byCategory = groupBudgetByCategory(trip.budgets);
  els.budgetOverview.innerHTML = byCategory.length ? byCategory.map(({ category, totals }) => `<div class="budget-bar">
    <header><strong>${escapeHtml(category)}</strong><span>${escapeHtml(formatMoneyMap(totals))}</span></header>
  </div>`).join("") : emptyMessage("还没有预算。去“预算”页添加分类预算。");

  const openItems = sortedChecklist(trip.checklist).filter((item) => item.status !== "done").slice(0, 6);
  els.checklistOverview.innerHTML = openItems.length ? openItems.map((item) => listItemHtml({
    title: item.content,
    meta: [checklistTypeLabels[item.type], item.owner && `负责人：${item.owner}`, item.dueDate && `截止：${item.dueDate}`].filter(Boolean),
    notes: item.notes,
  })).join("") : emptyMessage("没有未完成清单项。");
}

function renderBudget() {
  const trip = getSelectedTrip();
  if (!trip || !trip.budgets.length) {
    els.budgetTableBody.innerHTML = `<tr><td colspan="5" class="muted">还没有预算分类。</td></tr>`;
    return;
  }
  els.budgetTableBody.innerHTML = trip.budgets.map((item) => `<tr>
    <td>${escapeHtml(item.category)}</td>
    <td>${escapeHtml(formatMoney(item.amount, item.currency))}</td>
    <td>${escapeHtml(item.applicableMembers || "全员")}</td>
    <td>${escapeHtml(item.notes || "")}</td>
    <td>
      <div class="item-actions">
        <button class="action-button" data-action="edit-budget" data-id="${escapeHtml(item.id)}" type="button">编辑</button>
        <button class="action-button danger" data-action="delete-budget" data-id="${escapeHtml(item.id)}" type="button">删除</button>
      </div>
    </td>
  </tr>`).join("");
}

async function saveBudgetFromForm(event) {
  event.preventDefault();
  const trip = getSelectedTrip();
  if (!trip) return alert("请先新建或选择一个旅行。");
  const id = els.budgetIdInput.value || crypto.randomUUID();
  const item = normalizeBudget({
    id,
    category: els.budgetCategoryInput.value,
    amount: els.budgetAmountInput.value,
    currency: els.budgetCurrencyInput.value,
    applicableMembers: els.budgetMembersInput.value.trim(),
    notes: els.budgetNotesInput.value.trim(),
  });
  const existing = trip.budgets.find((entry) => entry.id === id);
  if (existing) Object.assign(existing, item);
  else trip.budgets.push(item);
  trip.updatedAt = new Date().toISOString();
  await persist();
  resetBudgetForm();
  render();
}

function handleBudgetAction(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const trip = getSelectedTrip();
  if (!trip) return;
  const item = trip.budgets.find((entry) => entry.id === button.dataset.id);
  if (!item) return;
  if (button.dataset.action === "edit-budget") {
    els.budgetIdInput.value = item.id;
    els.budgetCategoryInput.value = item.category;
    els.budgetAmountInput.value = item.amount;
    els.budgetCurrencyInput.value = item.currency;
    els.budgetMembersInput.value = item.applicableMembers;
    els.budgetNotesInput.value = item.notes;
    els.budgetFormTitle.textContent = "编辑预算";
  }
  if (button.dataset.action === "delete-budget") {
    trip.budgets = trip.budgets.filter((entry) => entry.id !== item.id);
    trip.updatedAt = new Date().toISOString();
    persist().then(() => render());
  }
}

function resetBudgetForm() {
  els.budgetForm.reset();
  els.budgetIdInput.value = "";
  els.budgetCurrencyInput.value = "CNY";
  els.budgetFormTitle.textContent = "新增预算";
}

function renderItinerary() {
  const trip = getSelectedTrip();
  if (!trip || !trip.itinerary.length) {
    els.itineraryList.innerHTML = emptyMessage("还没有行程项。");
    return;
  }
  const groups = groupBy(sortedItinerary(trip.itinerary), (item) => item.date || "未定日期");
  els.itineraryList.innerHTML = Object.entries(groups).map(([date, items]) => `<section class="group-block">
    <header><h3>${escapeHtml(date)}</h3><span class="tag blue">${items.length} 项</span></header>
    <div class="list">${items.map((item) => itineraryItemHtml(trip, item)).join("")}</div>
  </section>`).join("");
}

function itineraryItemHtml(trip, item) {
  const meta = [formatTimeRange(item.startTime, item.endTime), item.category, placeName(trip, item.placeId), item.owner && `负责人：${item.owner}`, item.estimatedCost ? formatMoney(item.estimatedCost, item.currency) : ""].filter(Boolean);
  return `<article class="list-item">
    <header>
      <div><strong>${escapeHtml(item.title)}</strong><div class="item-meta">${meta.map(tagHtml).join("")}</div></div>
      <div class="item-actions">
        <button class="action-button" data-action="edit-itinerary" data-id="${escapeHtml(item.id)}" type="button">编辑</button>
        <button class="action-button danger" data-action="delete-itinerary" data-id="${escapeHtml(item.id)}" type="button">删除</button>
      </div>
    </header>
    ${item.notes ? `<p class="muted">${escapeHtml(item.notes)}</p>` : ""}
  </article>`;
}

async function saveItineraryFromForm(event) {
  event.preventDefault();
  const trip = getSelectedTrip();
  if (!trip) return alert("请先新建或选择一个旅行。");
  const id = els.itineraryIdInput.value || crypto.randomUUID();
  const item = normalizeItineraryItem({
    id,
    title: els.itineraryTitleInput.value.trim(),
    date: els.itineraryDateInput.value,
    startTime: els.startTimeInput.value,
    endTime: els.endTimeInput.value,
    placeId: els.itineraryPlaceInput.value,
    category: els.itineraryCategoryInput.value,
    estimatedCost: els.estimatedCostInput.value,
    currency: els.itineraryCurrencyInput.value,
    owner: els.itineraryOwnerInput.value.trim(),
    notes: els.itineraryNotesInput.value.trim(),
  });
  const existing = trip.itinerary.find((entry) => entry.id === id);
  if (existing) Object.assign(existing, item);
  else trip.itinerary.push(item);
  trip.updatedAt = new Date().toISOString();
  await persist();
  resetItineraryForm();
  render();
}

function handleItineraryAction(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const trip = getSelectedTrip();
  if (!trip) return;
  const item = trip.itinerary.find((entry) => entry.id === button.dataset.id);
  if (!item) return;
  if (button.dataset.action === "edit-itinerary") {
    els.itineraryIdInput.value = item.id;
    els.itineraryTitleInput.value = item.title;
    els.itineraryDateInput.value = item.date;
    els.startTimeInput.value = item.startTime;
    els.endTimeInput.value = item.endTime;
    els.itineraryPlaceInput.value = item.placeId;
    els.itineraryCategoryInput.value = item.category;
    els.estimatedCostInput.value = item.estimatedCost || "";
    els.itineraryCurrencyInput.value = item.currency;
    els.itineraryOwnerInput.value = item.owner;
    els.itineraryNotesInput.value = item.notes;
    els.itineraryFormTitle.textContent = "编辑行程";
  }
  if (button.dataset.action === "delete-itinerary") {
    trip.itinerary = trip.itinerary.filter((entry) => entry.id !== item.id);
    trip.updatedAt = new Date().toISOString();
    persist().then(() => render());
  }
}

function resetItineraryForm() {
  els.itineraryForm.reset();
  els.itineraryIdInput.value = "";
  els.itineraryCurrencyInput.value = "CNY";
  els.itineraryFormTitle.textContent = "新增行程";
}

function renderPlaces() {
  const trip = getSelectedTrip();
  if (state.activeTab === "places" || state.map) {
    renderMap(trip);
  }
  if (!trip || !trip.places.length) {
    els.placeList.innerHTML = emptyMessage("还没有地点。");
    return;
  }
  els.placeList.innerHTML = [...trip.places].sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || a.name.localeCompare(b.name, "zh-Hans-CN")).map((place) => {
    const active = place.id === state.highlightedPlaceId ? " active" : "";
    const meta = [place.category, priorityLabels[place.priority], coordinateText(place)].filter(Boolean);
    return `<article class="place-item${active}" data-place-row="${escapeHtml(place.id)}">
      <header>
        <div><strong>${escapeHtml(place.name)}</strong><div class="item-meta">${meta.map(tagHtml).join("")}</div></div>
        <div class="item-actions">
          <button class="action-button" data-action="edit-place" data-id="${escapeHtml(place.id)}" type="button">编辑</button>
          <button class="action-button danger" data-action="delete-place" data-id="${escapeHtml(place.id)}" type="button">删除</button>
        </div>
      </header>
      ${place.address ? `<p class="muted">${escapeHtml(place.address)}</p>` : ""}
      ${place.notes ? `<p class="muted">${escapeHtml(place.notes)}</p>` : ""}
    </article>`;
  }).join("");
}

function renderMap(trip) {
  if (ensureLeafletMap()) {
    renderLeafletMarkers(trip);
    return;
  }
  renderFallbackMap(trip);
}

function ensureLeafletMap() {
  if (!window.L) {
    els.mapHint.textContent = "地图组件未加载，已退回到相对位置视图。";
    return false;
  }
  if (state.map) return true;

  els.mapCanvas.innerHTML = "";
  state.map = L.map(els.mapCanvas, {
    scrollWheelZoom: true,
  }).setView(DEFAULT_MAP_CENTER, 11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(state.map);
  state.markerLayer = L.layerGroup().addTo(state.map);
  state.map.on("click", handleLeafletMapClick);
  els.mapHint.textContent = "点击地图可填入经纬度；搜索结果可直接填入地点草稿。";
  return true;
}

function renderLeafletMarkers(trip) {
  if (!state.markerLayer) return;
  state.markerLayer.clearLayers();
  const withCoordinates = trip ? trip.places.filter(hasCoordinates) : [];
  if (!withCoordinates.length) {
    state.map.setView(DEFAULT_MAP_CENTER, state.map.getZoom() || 11);
    setTimeout(() => state.map.invalidateSize(), 0);
    return;
  }

  const markers = withCoordinates.map((place, index) => {
    const marker = L.marker([Number(place.latitude), Number(place.longitude)], {
      title: place.name,
      icon: L.divIcon({
        className: `leaflet-trip-marker ${place.priority}`,
        html: String(index + 1),
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -30],
      }),
    });
    marker.bindPopup(`<strong>${escapeHtml(place.name)}</strong><br>${escapeHtml(place.address || place.category || "")}`);
    marker.on("click", () => {
      state.highlightedPlaceId = place.id;
      renderPlaces();
    });
    marker.addTo(state.markerLayer);
    return marker;
  });

  const highlighted = withCoordinates.find((place) => place.id === state.highlightedPlaceId);
  if (highlighted) {
    state.map.setView([Number(highlighted.latitude), Number(highlighted.longitude)], Math.max(state.map.getZoom(), 13));
  } else if (markers.length === 1) {
    state.map.setView(markers[0].getLatLng(), 13);
  } else {
    state.map.fitBounds(L.featureGroup(markers).getBounds().pad(0.16));
  }
  setTimeout(() => state.map.invalidateSize(), 0);
}

function renderFallbackMap(trip) {
  if (!trip || !trip.places.length) {
    els.mapCanvas.innerHTML = `<div class="map-empty">添加带经纬度的地点后，这里会显示手动点位地图。</div>`;
    return;
  }
  const withCoordinates = trip.places.filter(hasCoordinates);
  if (!withCoordinates.length) {
    els.mapCanvas.innerHTML = `<div class="map-empty">地点已保存；补充经纬度后会显示在地图上。</div>`;
    return;
  }
  const lats = withCoordinates.map((place) => Number(place.latitude));
  const lngs = withCoordinates.map((place) => Number(place.longitude));
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpan = Math.max(maxLat - minLat, 0.01);
  const lngSpan = Math.max(maxLng - minLng, 0.01);
  els.mapCanvas.innerHTML = withCoordinates.map((place, index) => {
    const left = 8 + ((Number(place.longitude) - minLng) / lngSpan) * 84;
    const top = 92 - ((Number(place.latitude) - minLat) / latSpan) * 84;
    return `<button class="map-marker ${escapeHtml(place.priority)}" style="left:${left}%; top:${top}%;" data-action="highlight-place" data-id="${escapeHtml(place.id)}" type="button" title="${escapeHtml(place.name)}">${index + 1}</button>`;
  }).join("");
}

async function savePlaceFromForm(event) {
  event.preventDefault();
  const trip = getSelectedTrip();
  if (!trip) return alert("请先新建或选择一个旅行。");
  const id = els.placeIdInput.value || crypto.randomUUID();
  const item = normalizePlace({
    id,
    name: els.placeNameInput.value.trim(),
    address: els.placeAddressInput.value.trim(),
    latitude: els.latitudeInput.value,
    longitude: els.longitudeInput.value,
    category: els.placeCategoryInput.value,
    priority: els.placePriorityInput.value,
    notes: els.placeNotesInput.value.trim(),
  });
  const existing = trip.places.find((entry) => entry.id === id);
  if (existing) Object.assign(existing, item);
  else trip.places.push(item);
  state.highlightedPlaceId = id;
  trip.updatedAt = new Date().toISOString();
  await persist();
  resetPlaceForm();
  render();
}

function handlePlaceAction(event) {
  const button = event.target.closest("[data-action]");
  const row = event.target.closest("[data-place-row]");
  const trip = getSelectedTrip();
  if (!trip) return;
  if (row && !button) {
    state.highlightedPlaceId = row.dataset.placeRow;
    focusMapOnPlace(state.highlightedPlaceId);
    renderPlaces();
    return;
  }
  if (!button) return;
  const item = trip.places.find((entry) => entry.id === button.dataset.id);
  if (!item) return;
  if (button.dataset.action === "edit-place") {
    fillPlaceForm(item);
  }
  if (button.dataset.action === "delete-place") {
    trip.places = trip.places.filter((entry) => entry.id !== item.id);
    trip.itinerary.forEach((entry) => {
      if (entry.placeId === item.id) entry.placeId = "";
    });
    trip.updatedAt = new Date().toISOString();
    persist().then(() => render());
  }
}

function handleMapAction(event) {
  const button = event.target.closest("[data-action='highlight-place']");
  if (!button) return;
  state.highlightedPlaceId = button.dataset.id;
  focusMapOnPlace(state.highlightedPlaceId);
  renderPlaces();
}

function handleLeafletMapClick(event) {
  els.latitudeInput.value = event.latlng.lat.toFixed(6);
  els.longitudeInput.value = event.latlng.lng.toFixed(6);
  if (!els.placeNameInput.value.trim()) {
    els.placeNameInput.value = "地图选点";
  }
  els.mapHint.textContent = `已填入坐标：${event.latlng.lat.toFixed(6)}, ${event.latlng.lng.toFixed(6)}`;
}

function fillPlaceForm(item) {
  els.placeIdInput.value = item.id;
  els.placeNameInput.value = item.name;
  els.placeAddressInput.value = item.address;
  els.latitudeInput.value = item.latitude;
  els.longitudeInput.value = item.longitude;
  els.placeCategoryInput.value = item.category;
  els.placePriorityInput.value = item.priority;
  els.placeNotesInput.value = item.notes;
  els.placeFormTitle.textContent = "编辑地点";
  focusMapOnPlace(item.id);
}

function resetPlaceForm() {
  els.placeForm.reset();
  els.placeIdInput.value = "";
  els.placePriorityInput.value = "must";
  els.placeFormTitle.textContent = "新增地点";
}

async function searchPlaces(event) {
  event.preventDefault();
  const query = els.mapSearchInput.value.trim();
  if (!query) return;
  els.mapSearchResults.innerHTML = `<p class="muted">正在搜索...</p>`;
  try {
    state.searchResults = await fetchPlaceSearchResults(query);
    renderSearchResults();
  } catch (error) {
    els.mapSearchResults.innerHTML = `<p class="empty-state">搜索暂时不可用。可以直接点击地图或手动输入经纬度。</p>`;
  }
}

async function fetchPlaceSearchResults(query) {
  if (state.serviceMode) {
    const response = await fetch(`api/place-search?q=${encodeURIComponent(query)}`, { cache: "no-store" });
    if (response.ok) {
      const payload = await response.json();
      return Array.isArray(payload.results) ? payload.results : [];
    }
  }

  const params = new URLSearchParams({ q: query, limit: "8" });
  const response = await fetch(`https://photon.komoot.io/api/?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("search failed");
  const payload = await response.json();
  return (payload.features || []).map((feature) => {
    const properties = feature.properties || {};
    const coordinates = feature.geometry?.coordinates || [];
    return {
      name: properties.name || query,
      displayName: [properties.street, properties.district, properties.city, properties.state, properties.country].filter(Boolean).join(", ") || properties.name || query,
      latitude: coordinates[1],
      longitude: coordinates[0],
      source: "photon",
    };
  }).filter((result) => Number.isFinite(Number(result.latitude)) && Number.isFinite(Number(result.longitude)));
}

function renderSearchResults() {
  if (!state.searchResults.length) {
    els.mapSearchResults.innerHTML = `<p class="empty-state">没有找到匹配地点。试试更具体的名称或城市。</p>`;
    return;
  }
  els.mapSearchResults.innerHTML = state.searchResults.map((result, index) => {
    const title = result.name || result.displayName?.split(",")[0] || "未命名地点";
    const address = result.displayName || "";
    return `<button class="search-result" data-result-index="${index}" type="button">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(address)}</span>
    </button>`;
  }).join("");
}

function handleSearchResultClick(event) {
  const button = event.target.closest("[data-result-index]");
  if (!button) return;
  const result = state.searchResults[Number(button.dataset.resultIndex)];
  if (!result) return;
  const title = result.name || result.displayName?.split(",")[0] || els.mapSearchInput.value.trim();
  els.placeNameInput.value = title;
  els.placeAddressInput.value = result.displayName || "";
  els.latitudeInput.value = Number(result.latitude).toFixed(6);
  els.longitudeInput.value = Number(result.longitude).toFixed(6);
  els.mapHint.textContent = `已填入搜索结果坐标：${els.latitudeInput.value}, ${els.longitudeInput.value}`;
  if (state.map) {
    state.map.setView([Number(result.latitude), Number(result.longitude)], 15);
    L.popup()
      .setLatLng([Number(result.latitude), Number(result.longitude)])
      .setContent(`<strong>${escapeHtml(title)}</strong><br>保存地点后会出现在点位列表。`)
      .openOn(state.map);
  }
}

function focusMapOnPlace(placeId) {
  const trip = getSelectedTrip();
  const place = trip?.places.find((entry) => entry.id === placeId);
  if (!place || !hasCoordinates(place) || !state.map) return;
  state.map.setView([Number(place.latitude), Number(place.longitude)], Math.max(state.map.getZoom(), 14));
}

function renderChecklist() {
  const trip = getSelectedTrip();
  if (!trip || !trip.checklist.length) {
    els.checklistList.innerHTML = emptyMessage("还没有清单项。");
    return;
  }
  const groups = groupBy(sortedChecklist(trip.checklist), (item) => checklistTypeLabels[item.type] || item.type);
  els.checklistList.innerHTML = Object.entries(groups).map(([type, items]) => `<section class="group-block">
    <header><h3>${escapeHtml(type)}</h3><span class="tag green">${items.filter((item) => item.status !== "done").length} 未完成</span></header>
    <div class="list">${items.map(checklistItemHtml).join("")}</div>
  </section>`).join("");
}

function checklistItemHtml(item) {
  const meta = [item.owner && `负责人：${item.owner}`, item.dueDate && `截止：${item.dueDate}`, item.status === "done" ? "已完成" : "未完成"].filter(Boolean);
  return `<article class="list-item">
    <div class="check-row">
      <input data-action="toggle-checklist" data-id="${escapeHtml(item.id)}" type="checkbox" ${item.status === "done" ? "checked" : ""} aria-label="切换完成状态">
      <div>
        <header>
          <div><strong>${escapeHtml(item.content)}</strong><div class="item-meta">${meta.map(tagHtml).join("")}</div></div>
          <div class="item-actions">
            <button class="action-button" data-action="edit-checklist" data-id="${escapeHtml(item.id)}" type="button">编辑</button>
            <button class="action-button danger" data-action="delete-checklist" data-id="${escapeHtml(item.id)}" type="button">删除</button>
          </div>
        </header>
        ${item.notes ? `<p class="muted">${escapeHtml(item.notes)}</p>` : ""}
      </div>
    </div>
  </article>`;
}

async function saveChecklistFromForm(event) {
  event.preventDefault();
  const trip = getSelectedTrip();
  if (!trip) return alert("请先新建或选择一个旅行。");
  const id = els.checklistIdInput.value || crypto.randomUUID();
  const item = normalizeChecklistItem({
    id,
    content: els.checklistContentInput.value.trim(),
    type: els.checklistTypeInput.value,
    status: els.checklistStatusInput.value,
    owner: els.checklistOwnerInput.value.trim(),
    dueDate: els.checklistDueDateInput.value,
    notes: els.checklistNotesInput.value.trim(),
  });
  const existing = trip.checklist.find((entry) => entry.id === id);
  if (existing) Object.assign(existing, item);
  else trip.checklist.push(item);
  trip.updatedAt = new Date().toISOString();
  await persist();
  resetChecklistForm();
  render();
}

function handleChecklistAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const trip = getSelectedTrip();
  if (!trip) return;
  const item = trip.checklist.find((entry) => entry.id === button.dataset.id);
  if (!item) return;
  if (button.dataset.action === "edit-checklist") {
    els.checklistIdInput.value = item.id;
    els.checklistContentInput.value = item.content;
    els.checklistTypeInput.value = item.type;
    els.checklistStatusInput.value = item.status;
    els.checklistOwnerInput.value = item.owner;
    els.checklistDueDateInput.value = item.dueDate;
    els.checklistNotesInput.value = item.notes;
    els.checklistFormTitle.textContent = "编辑清单项";
  }
  if (button.dataset.action === "delete-checklist") {
    trip.checklist = trip.checklist.filter((entry) => entry.id !== item.id);
    trip.updatedAt = new Date().toISOString();
    persist().then(() => render());
  }
}

function handleChecklistToggle(event) {
  const input = event.target.closest("input[data-action='toggle-checklist']");
  if (!input) return;
  updateSelectedTrip((trip) => {
    const item = trip.checklist.find((entry) => entry.id === input.dataset.id);
    if (item) item.status = input.checked ? "done" : "open";
  });
  persist().then(() => render());
}

function resetChecklistForm() {
  els.checklistForm.reset();
  els.checklistIdInput.value = "";
  els.checklistStatusInput.value = "open";
  els.checklistFormTitle.textContent = "新增清单项";
}

function renderPlaceOptions() {
  const trip = getSelectedTrip();
  const current = els.itineraryPlaceInput.value;
  const places = trip ? trip.places : [];
  els.itineraryPlaceInput.innerHTML = `<option value="">不关联地点</option>${places.map((place) => `<option value="${escapeHtml(place.id)}">${escapeHtml(place.name)}</option>`).join("")}`;
  if (places.some((place) => place.id === current)) els.itineraryPlaceInput.value = current;
}

function renderMemberSuggestions() {
  const trip = getSelectedTrip();
  const members = trip ? trip.members : [];
  els.memberSuggestions.innerHTML = members.map((member) => `<option value="${escapeHtml(member.name)}"></option>`).join("");
}

function renderTabs() {
  document.querySelectorAll(".tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === state.activeTab);
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `${state.activeTab}Tab`);
  });
  if (state.activeTab === "places") {
    renderPlaces();
    if (state.map) {
      setTimeout(() => state.map.invalidateSize(), 0);
    }
  }
}

function resetAllItemForms() {
  resetBudgetForm();
  resetItineraryForm();
  resetPlaceForm();
  resetChecklistForm();
  state.highlightedPlaceId = "";
}

function exportJson() {
  const output = {
    ...normalizePayload(state.payload),
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(output, null, 2) + "\n"], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `travel-planner-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function copySiteLink() {
  const isHosted = location.protocol.startsWith("http") && !["127.0.0.1", "localhost"].includes(location.hostname);
  const url = isHosted ? location.href.split("#")[0] : PAGES_URL;
  try {
    await navigator.clipboard.writeText(url);
    els.copySiteLinkButton.textContent = "已复制链接";
    setTimeout(() => {
      els.copySiteLinkButton.textContent = "复制网站链接";
    }, 1600);
  } catch (error) {
    prompt("复制这个网站链接：", url);
  }
}

async function importJson(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const payload = normalizePayload(JSON.parse(await file.text()));
    state.payload = payload;
    state.selectedTripId = payload.trips[0]?.id || "";
    await persist();
    resetAllItemForms();
    render();
  } catch (error) {
    alert("导入失败：JSON 格式不正确。");
  } finally {
    event.target.value = "";
  }
}

function splitNames(value) {
  return value.split(/[,，、\n]/).map((item) => item.trim()).filter(Boolean);
}

function sumMoney(items, amountKey) {
  return items.reduce((totals, item) => {
    const currency = item.currency || "CNY";
    totals[currency] = Math.round(((totals[currency] || 0) + (Number(item[amountKey]) || 0)) * 100) / 100;
    return totals;
  }, {});
}

function divideMoneyMap(map, divisor) {
  return Object.fromEntries(Object.entries(map).map(([currency, value]) => [currency, Math.round((value / divisor) * 100) / 100]));
}

function formatMoneyMap(map) {
  const entries = Object.entries(map).filter(([, value]) => Math.abs(value) > 0.0001);
  if (!entries.length) return "¥0.00";
  return entries.map(([currency, value]) => formatMoney(value, currency)).join(" / ");
}

function formatMoney(value, currency = "CNY") {
  const symbol = currencySymbols[currency] || `${currency} `;
  return `${symbol}${Number(value || 0).toFixed(2)}`;
}

function countTripDays(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  return Math.round((end - start) / 86400000) + 1;
}

function sortedItinerary(items) {
  return [...items].sort((a, b) => `${a.date || "9999"} ${a.startTime || "99:99"}`.localeCompare(`${b.date || "9999"} ${b.startTime || "99:99"}`));
}

function sortedChecklist(items) {
  return [...items].sort((a, b) => {
    if (a.status !== b.status) return a.status === "open" ? -1 : 1;
    return (a.dueDate || "9999-99-99").localeCompare(b.dueDate || "9999-99-99");
  });
}

function groupBudgetByCategory(items) {
  const groups = new Map();
  items.forEach((item) => {
    if (!groups.has(item.category)) groups.set(item.category, {});
    const totals = groups.get(item.category);
    totals[item.currency] = Math.round(((totals[item.currency] || 0) + Number(item.amount || 0)) * 100) / 100;
  });
  return [...groups.entries()].map(([category, totals]) => ({ category, totals }));
}

function groupBy(items, getKey) {
  return items.reduce((groups, item) => {
    const key = getKey(item);
    groups[key] = groups[key] || [];
    groups[key].push(item);
    return groups;
  }, {});
}

function placeName(trip, placeId) {
  if (!placeId) return "";
  return trip.places.find((place) => place.id === placeId)?.name || "地点已删除";
}

function hasCoordinates(place) {
  return Number.isFinite(Number(place.latitude)) && Number.isFinite(Number(place.longitude));
}

function coordinateText(place) {
  if (!hasCoordinates(place)) return "";
  return `${Number(place.latitude).toFixed(4)}, ${Number(place.longitude).toFixed(4)}`;
}

function priorityRank(priority) {
  return { must: 0, nice: 1, backup: 2 }[priority] ?? 9;
}

function formatDateRange(startDate, endDate) {
  if (startDate && endDate) return `${startDate} 至 ${endDate}`;
  if (startDate) return `${startDate} 出发`;
  if (endDate) return `${endDate} 结束`;
  return "未设置日期";
}

function formatTimeRange(startTime, endTime) {
  if (startTime && endTime) return `${startTime}-${endTime}`;
  return startTime || endTime || "";
}

function listItemHtml({ title, meta = [], notes = "" }) {
  return `<article class="list-item">
    <header><strong>${escapeHtml(title)}</strong></header>
    ${meta.length ? `<div class="item-meta">${meta.map(tagHtml).join("")}</div>` : ""}
    ${notes ? `<p class="muted">${escapeHtml(notes)}</p>` : ""}
  </article>`;
}

function tagHtml(value) {
  return `<span class="tag">${escapeHtml(value)}</span>`;
}

function emptyMessage(text) {
  return `<p class="empty-state">${escapeHtml(text)}</p>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
