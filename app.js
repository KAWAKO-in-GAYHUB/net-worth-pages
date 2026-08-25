const FIELD_DEFS = [
  { key: "ccb", label: "建设银行净值", input: "ccbValue" },
  { key: "icbc", label: "工商银行净值", input: "icbcValue" },
  { key: "boc", label: "中国银行净值", input: "bocValue" },
  { key: "bocom", label: "交通银行净值", input: "bocomValue" },
  { key: "fund", label: "基金净值", input: "fundValue" },
];

const MONTH_LABELS = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
const STORAGE_KEY = "netWorthTracker.repoSettings.v1";

const state = {
  records: [],
  view: "day",
  selectedDate: toDateValue(new Date()),
  selectedMonth: toDateValue(new Date()).slice(0, 7),
  selectedYear: new Date().getFullYear(),
  token: "",
  githubSha: null,
  dirty: false,
  adminVisible: false,
  settings: {
    owner: "",
    repo: "",
    branch: "main",
    path: "data/records.json",
  },
};

const els = {};

document.addEventListener("DOMContentLoaded", init);
window.addEventListener("resize", debounce(renderTrendChart, 120));

async function init() {
  cacheElements();
  loadSettings();
  bindEvents();
  setControlValues();
  setFormEnabled(false);
  await loadLocalData();
  pickLatestDate();
  render();
}

function cacheElements() {
  [
    "refreshData",
    "adminToggle",
    "adminPanel",
    "syncStatus",
    "githubOwner",
    "githubRepo",
    "githubBranch",
    "githubPath",
    "githubToken",
    "loadGithub",
    "commitGithub",
    "clearToken",
    "latestTotal",
    "latestDate",
    "latestDelta",
    "latestDeltaNote",
    "trendChart",
    "chartCaption",
    "selectedDate",
    "selectedMonth",
    "selectedYear",
    "dayControl",
    "monthControl",
    "yearControl",
    "dayView",
    "monthView",
    "yearView",
    "annualView",
    "dayTotal",
    "dayDelta",
    "dayBreakdown",
    "monthSummary",
    "monthCalendar",
    "dayInspector",
    "yearGrid",
    "annualGrid",
    "recordForm",
    "recordDate",
    "ccbValue",
    "icbcValue",
    "bocValue",
    "bocomValue",
    "fundValue",
    "formTotal",
    "saveRecord",
    "resetForm",
    "deleteCurrent",
    "editStatus",
    "filterStart",
    "filterEnd",
    "clearFilters",
    "recordsTable",
    "toast",
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

function bindEvents() {
  els.refreshData.addEventListener("click", loadLocalDataAndRender);
  els.adminToggle.addEventListener("click", toggleAdmin);
  els.loadGithub.addEventListener("click", loadFromGithub);
  els.commitGithub.addEventListener("click", commitToGithub);
  els.clearToken.addEventListener("click", clearToken);

  [els.githubOwner, els.githubRepo, els.githubBranch, els.githubPath].forEach((input) => {
    input.addEventListener("change", saveSettingsFromInputs);
  });

  els.githubToken.addEventListener("input", () => {
    state.token = els.githubToken.value.trim();
    setFormEnabled(Boolean(state.token));
    renderStatus();
  });

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      render();
    });
  });

  els.selectedDate.addEventListener("change", () => {
    state.selectedDate = els.selectedDate.value || state.selectedDate;
    state.selectedMonth = state.selectedDate.slice(0, 7);
    state.selectedYear = Number(state.selectedDate.slice(0, 4));
    setRecordFormDate(state.selectedDate);
    render();
  });

  els.selectedMonth.addEventListener("change", () => {
    state.selectedMonth = els.selectedMonth.value || state.selectedMonth;
    state.selectedYear = Number(state.selectedMonth.slice(0, 4));
    render();
  });

  els.selectedYear.addEventListener("change", () => {
    state.selectedYear = Number(els.selectedYear.value) || new Date().getFullYear();
    render();
  });

  FIELD_DEFS.forEach((field) => {
    els[field.input].addEventListener("input", updateFormTotal);
  });

  els.recordDate.addEventListener("change", updateFormTotal);
  els.recordForm.addEventListener("submit", saveRecord);
  els.resetForm.addEventListener("click", () => resetForm(state.selectedDate));
  els.deleteCurrent.addEventListener("click", () => deleteRecord(els.recordDate.value));

  els.monthCalendar.addEventListener("click", (event) => {
    const button = event.target.closest("[data-date]");
    if (!button) return;
    const date = button.dataset.date;
    state.selectedDate = date;
    state.selectedMonth = date.slice(0, 7);
    setRecordFormDate(date);
    const existing = getRecord(date);
    if (existing) fillForm(existing);
    render();
  });

  els.yearGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-month]");
    if (!button) return;
    state.selectedMonth = button.dataset.month;
    state.selectedYear = Number(state.selectedMonth.slice(0, 4));
    state.view = "month";
    render();
  });

  els.annualGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-year]");
    if (!button) return;
    state.selectedYear = Number(button.dataset.year);
    state.view = "year";
    render();
  });

  els.recordsTable.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit]");
    const deleteButton = event.target.closest("[data-delete]");
    if (editButton) {
      const record = getRecord(editButton.dataset.edit);
      if (record) {
        state.view = "day";
        state.selectedDate = record.date;
        state.selectedMonth = record.date.slice(0, 7);
        state.selectedYear = Number(record.date.slice(0, 4));
        fillForm(record);
        render();
      }
    }
    if (deleteButton) {
      deleteRecord(deleteButton.dataset.delete);
    }
  });

  [els.filterStart, els.filterEnd].forEach((input) => {
    input.addEventListener("change", renderTable);
  });

  els.clearFilters.addEventListener("click", () => {
    els.filterStart.value = "";
    els.filterEnd.value = "";
    renderTable();
  });
}

async function loadLocalDataAndRender() {
  await loadLocalData();
  pickLatestDate();
  render();
}

async function loadLocalData() {
  try {
    const response = await fetch(`data/records.json?ts=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    state.records = normalizeRecords(readRecordsPayload(payload));
    state.githubSha = null;
    state.dirty = false;
    showToast("已读取本地数据文件");
  } catch (error) {
    state.records = [];
    state.githubSha = null;
    state.dirty = false;
    showToast("没有读取到 data/records.json，已使用空数据");
  }
}

function readRecordsPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.records)) return payload.records;
  return [];
}

function normalizeRecords(records) {
  return records
    .filter((record) => isValidDate(record.date))
    .map((record) => {
      const normalized = { date: record.date };
      FIELD_DEFS.forEach((field) => {
        normalized[field.key] = toNumber(record[field.key]);
      });
      normalized.total = calculateTotal(normalized);
      return normalized;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

function loadSettings() {
  const inferred = inferRepoSettings();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    state.settings = {
      owner: saved.owner || inferred.owner || "",
      repo: saved.repo || inferred.repo || "",
      branch: saved.branch || "main",
      path: saved.path || "data/records.json",
    };
  } catch (error) {
    state.settings = {
      owner: inferred.owner || "",
      repo: inferred.repo || "",
      branch: "main",
      path: "data/records.json",
    };
  }
}

function inferRepoSettings() {
  const host = window.location.hostname;
  if (!host.endsWith(".github.io")) return {};
  const owner = host.replace(".github.io", "");
  const firstPath = window.location.pathname.split("/").filter(Boolean)[0];
  const repo = firstPath || `${owner}.github.io`;
  return { owner, repo };
}

function setControlValues() {
  els.githubOwner.value = state.settings.owner;
  els.githubRepo.value = state.settings.repo;
  els.githubBranch.value = state.settings.branch;
  els.githubPath.value = state.settings.path;
  els.selectedDate.value = state.selectedDate;
  els.selectedMonth.value = state.selectedMonth;
  els.selectedYear.value = state.selectedYear;
  resetForm(state.selectedDate);
}

function saveSettingsFromInputs() {
  state.settings = {
    owner: els.githubOwner.value.trim(),
    repo: els.githubRepo.value.trim(),
    branch: els.githubBranch.value.trim() || "main",
    path: els.githubPath.value.trim() || "data/records.json",
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
  renderStatus();
}

function toggleAdmin() {
  state.adminVisible = !state.adminVisible;
  els.adminPanel.classList.toggle("is-hidden", !state.adminVisible);
  els.adminToggle.textContent = state.adminVisible ? "收起管理" : "管理模式";
  renderStatus();
}

function clearToken() {
  state.token = "";
  els.githubToken.value = "";
  setFormEnabled(false);
  renderStatus();
  showToast("Token 已清除，页面恢复只读");
}

function setFormEnabled(enabled) {
  FIELD_DEFS.forEach((field) => {
    els[field.input].disabled = !enabled;
  });
  els.recordDate.disabled = !enabled;
  els.saveRecord.disabled = !enabled;
  els.resetForm.disabled = !enabled;
  els.deleteCurrent.disabled = !enabled;
}

async function loadFromGithub() {
  saveSettingsFromInputs();
  if (!validateGithubSettings(false)) return;

  setSyncStatus("读取中", "is-dirty");
  try {
    const file = await githubGetFile();
    const payload = JSON.parse(decodeBase64(file.content));
    state.records = normalizeRecords(readRecordsPayload(payload));
    state.githubSha = file.sha;
    state.dirty = false;
    pickLatestDate();
    render();
    showToast("已从 GitHub 读取数据");
  } catch (error) {
    setSyncStatus("读取失败", "");
    showToast(readableGithubError(error));
  }
}

async function commitToGithub() {
  saveSettingsFromInputs();
  if (!validateGithubSettings(true)) return;

  setSyncStatus("提交中", "is-dirty");
  try {
    let currentSha = state.githubSha;
    try {
      const currentFile = await githubGetFile();
      currentSha = currentFile.sha;
    } catch (error) {
      if (error.status !== 404) throw error;
      currentSha = null;
    }

    const payload = {
      schemaVersion: 1,
      updatedAt: new Date().toISOString(),
      records: state.records.map((record) => ({
        date: record.date,
        ccb: record.ccb,
        icbc: record.icbc,
        boc: record.boc,
        bocom: record.bocom,
        fund: record.fund,
        total: calculateTotal(record),
      })),
    };

    const body = {
      message: `更新净值数据 ${toDateValue(new Date())}`,
      branch: state.settings.branch,
      content: encodeBase64(`${JSON.stringify(payload, null, 2)}\n`),
    };
    if (currentSha) body.sha = currentSha;

    const response = await fetch(githubContentsUrl(), {
      method: "PUT",
      headers: githubHeaders(true),
      body: JSON.stringify(body),
    });

    if (!response.ok) throw await githubApiError(response);
    const result = await response.json();
    state.githubSha = result.content ? result.content.sha : null;
    state.dirty = false;
    renderStatus();
    showToast("已提交到 GitHub。GitHub Pages 可能需要一点时间刷新。");
  } catch (error) {
    setSyncStatus("提交失败", "");
    showToast(readableGithubError(error));
  }
}

function validateGithubSettings(requireToken) {
  if (!state.settings.owner || !state.settings.repo || !state.settings.path) {
    showToast("请先填写 GitHub Owner、Repository 和数据路径");
    return false;
  }
  if (requireToken && !state.token) {
    showToast("提交需要先输入 Fine-grained Token");
    return false;
  }
  return true;
}

async function githubGetFile() {
  const branch = state.settings.branch ? `?ref=${encodeURIComponent(state.settings.branch)}` : "";
  const response = await fetch(`${githubContentsUrl()}${branch}`, {
    headers: githubHeaders(Boolean(state.token)),
  });
  if (!response.ok) throw await githubApiError(response);
  return response.json();
}

function githubContentsUrl() {
  const owner = encodeURIComponent(state.settings.owner);
  const repo = encodeURIComponent(state.settings.repo);
  const path = state.settings.path
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
}

function githubHeaders(includeToken) {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (includeToken && state.token) headers.Authorization = `Bearer ${state.token}`;
  return headers;
}

async function githubApiError(response) {
  let message = `GitHub API 请求失败：HTTP ${response.status}`;
  try {
    const payload = await response.json();
    if (payload.message) message = payload.message;
  } catch (error) {
    // Keep the HTTP fallback.
  }
  const error = new Error(message);
  error.status = response.status;
  return error;
}

function readableGithubError(error) {
  if (error.status === 401 || error.status === 403) return "Token 无权限或已过期。请确认仓库 Contents 权限为 Read and write。";
  if (error.status === 404) return "没有找到仓库或数据文件。请检查 Owner、Repository、Branch 和数据路径。";
  if (error.status === 409) return "提交冲突。请先从 GitHub 读取最新数据，再重新提交。";
  return error.message || "GitHub 操作失败";
}

function saveRecord(event) {
  event.preventDefault();
  if (!state.token) {
    showToast("请先进入管理模式并输入 Token");
    return;
  }

  const record = collectFormRecord();
  if (!record) return;

  const existingIndex = state.records.findIndex((item) => item.date === record.date);
  if (existingIndex >= 0) {
    state.records[existingIndex] = record;
  } else {
    state.records.push(record);
  }
  state.records = normalizeRecords(state.records);
  state.selectedDate = record.date;
  state.selectedMonth = record.date.slice(0, 7);
  state.selectedYear = Number(record.date.slice(0, 4));
  state.dirty = true;
  render();
  showToast("记录已保存，记得提交到 GitHub");
}

function collectFormRecord() {
  const date = els.recordDate.value;
  if (!isValidDate(date)) {
    showToast("请选择有效日期");
    return null;
  }
  const record = { date };
  FIELD_DEFS.forEach((field) => {
    record[field.key] = toNumber(els[field.input].value);
  });
  record.total = calculateTotal(record);
  return record;
}

function deleteRecord(date) {
  if (!state.token) {
    showToast("请先进入管理模式并输入 Token");
    return;
  }
  if (!isValidDate(date)) {
    showToast("请选择要删除的日期");
    return;
  }
  const record = getRecord(date);
  if (!record) {
    showToast("该日期没有记录");
    return;
  }
  if (!window.confirm(`确认删除 ${date} 的净值记录吗？`)) return;

  state.records = state.records.filter((item) => item.date !== date);
  state.dirty = true;
  pickLatestDate();
  resetForm(state.selectedDate);
  render();
  showToast("记录已删除，记得提交到 GitHub");
}

function fillForm(record) {
  els.recordDate.value = record.date;
  FIELD_DEFS.forEach((field) => {
    els[field.input].value = record[field.key] ? trimNumber(record[field.key]) : "";
  });
  updateFormTotal();
}

function resetForm(date = state.selectedDate) {
  els.recordDate.value = date;
  FIELD_DEFS.forEach((field) => {
    els[field.input].value = "";
  });
  updateFormTotal();
}

function setRecordFormDate(date) {
  els.recordDate.value = date;
  const existing = getRecord(date);
  if (existing) {
    fillForm(existing);
  } else {
    FIELD_DEFS.forEach((field) => {
      els[field.input].value = "";
    });
    updateFormTotal();
  }
}

function updateFormTotal() {
  const record = {};
  FIELD_DEFS.forEach((field) => {
    record[field.key] = toNumber(els[field.input].value);
  });
  els.formTotal.textContent = formatMoney(calculateTotal(record));
}

function render() {
  state.records = normalizeRecords(state.records);
  syncControlsFromState();
  renderStatus();
  renderSummary();
  renderViews();
  renderTable();
  renderTrendChart();
}

function syncControlsFromState() {
  els.selectedDate.value = state.selectedDate;
  els.selectedMonth.value = state.selectedMonth;
  els.selectedYear.value = state.selectedYear;

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === state.view);
  });

  els.dayView.classList.toggle("is-hidden", state.view !== "day");
  els.monthView.classList.toggle("is-hidden", state.view !== "month");
  els.yearView.classList.toggle("is-hidden", state.view !== "year");
  els.annualView.classList.toggle("is-hidden", state.view !== "annual");
  els.dayControl.classList.toggle("is-hidden", state.view !== "day");
  els.monthControl.classList.toggle("is-hidden", state.view !== "month");
  els.yearControl.classList.toggle("is-hidden", state.view !== "year");
}

function renderStatus() {
  const unlocked = Boolean(state.token);
  els.editStatus.textContent = unlocked ? "可编辑" : "只读";
  els.editStatus.className = `status-pill ${unlocked ? "is-ready" : ""}`;
  if (state.dirty) {
    setSyncStatus("有未提交更改", "is-dirty");
  } else if (unlocked) {
    setSyncStatus("Token 已输入", "is-ready");
  } else {
    setSyncStatus("未连接", "");
  }
  els.commitGithub.disabled = !unlocked || !state.dirty;
}

function setSyncStatus(text, className) {
  els.syncStatus.textContent = text;
  els.syncStatus.className = `status-pill ${className || ""}`;
}

function renderSummary() {
  const latest = getLatestRecord();
  if (!latest) {
    els.latestTotal.textContent = "--";
    els.latestDate.textContent = "暂无数据";
    els.latestDelta.textContent = "--";
    els.latestDelta.className = "metric-value is-neutral";
    els.latestDeltaNote.textContent = "需要连续两日数据";
    return;
  }

  const delta = getDailyDelta(latest.date);
  const deltaPercent = getDailyDeltaPercent(latest.date);
  els.latestTotal.textContent = formatMoney(latest.total);
  els.latestDate.textContent = latest.date;
  els.latestDelta.innerHTML = formatDeltaWithPercent(delta, deltaPercent);
  els.latestDelta.className = `metric-value ${deltaClass(delta)}`;
  els.latestDeltaNote.textContent = delta === null ? "没有前一日数据" : "按前一日总净值计算";
}

function renderViews() {
  renderDayView();
  renderMonthView();
  renderYearView();
  renderAnnualView();
}

function renderDayView() {
  const record = getRecord(state.selectedDate);
  const delta = getDailyDelta(state.selectedDate);
  const deltaPercent = getDailyDeltaPercent(state.selectedDate);
  if (!record) {
    els.dayTotal.textContent = "--";
    els.dayDelta.textContent = "该日暂无数据";
    els.dayDelta.className = "metric-subline is-neutral";
    els.dayBreakdown.innerHTML = `<div class="empty-state">选择有数据的日期，或在右侧新增每日记录。</div>`;
    return;
  }

  els.dayTotal.textContent = formatMoney(record.total);
  els.dayDelta.innerHTML = formatDeltaWithPercent(delta, deltaPercent, "较前一日：");
  els.dayDelta.className = `metric-subline ${deltaClass(delta)}`;
  els.dayBreakdown.innerHTML = FIELD_DEFS.map(
    (field) => `
      <article class="breakdown-item">
        <span>${field.label}</span>
        <strong>${formatMoney(record[field.key])}</strong>
      </article>
    `,
  ).join("");
}

function renderMonthView() {
  const [year, month] = state.selectedMonth.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startWeekday = new Date(year, month - 1, 1).getDay();
  const monthRecords = getRecordsForMonth(state.selectedMonth);
  const monthLast = monthRecords.at(-1) || null;
  const monthDelta = getMonthlyDelta(state.selectedMonth);
  const monthDeltaPercent = getMonthlyDeltaPercent(state.selectedMonth);

  els.monthSummary.innerHTML = `
    <div>
      <span class="metric-label">本月月末总净值</span>
      <strong class="metric-value">${monthLast ? formatMoney(monthLast.total) : "--"}</strong>
    </div>
    <div>
      <span class="metric-label">较前一月变化</span>
      <strong class="metric-value ${deltaClass(monthDelta)}">${formatDeltaWithPercent(monthDelta, monthDeltaPercent)}</strong>
    </div>
  `;

  const cells = [];
  for (let i = 0; i < startWeekday; i += 1) {
    cells.push(`<div class="calendar-empty"></div>`);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${state.selectedMonth}-${String(day).padStart(2, "0")}`;
    const record = getRecord(date);
    const delta = getDailyDelta(date);
    const deltaPercent = getDailyDeltaPercent(date);
    const selected = state.selectedDate === date;
    cells.push(`
      <button type="button" class="calendar-day ${record ? "has-record" : ""} ${toneClass(delta)} ${selected ? "is-selected" : ""}" data-date="${date}">
        <span class="day-number">${day}</span>
        ${
          record
            ? `<span><span class="day-change ${deltaClass(delta)}">${formatDeltaWithPercent(delta, deltaPercent)}</span><span class="day-total">${formatCompact(record.total)}</span></span>`
            : `<span class="day-change is-neutral">无数据</span>`
        }
      </button>
    `);
  }
  els.monthCalendar.innerHTML = cells.join("");
  renderDayInspector();
}

function renderDayInspector() {
  const record = getRecord(state.selectedDate);
  if (!state.selectedDate.startsWith(state.selectedMonth)) {
    els.dayInspector.innerHTML = `<span>点击当月某一天查看明细。</span>`;
    return;
  }
  if (!record) {
    els.dayInspector.innerHTML = `
      <span>${state.selectedDate}</span>
      <strong>暂无数据</strong>
      <span>有 Token 时，点击该日后可在右侧新增记录。</span>
    `;
    return;
  }
  const delta = getDailyDelta(record.date);
  const deltaPercent = getDailyDeltaPercent(record.date);
  els.dayInspector.innerHTML = `
    <span>${record.date}</span>
    <strong>${formatMoney(record.total)}</strong>
    <span class="${deltaClass(delta)}">${formatDeltaWithPercent(delta, deltaPercent, "较前一日：")}</span>
    <div class="breakdown-grid" style="margin-top: 12px;">
      ${FIELD_DEFS.map(
        (field) => `
          <article class="breakdown-item">
            <span>${field.label}</span>
            <strong>${formatMoney(record[field.key])}</strong>
          </article>
        `,
      ).join("")}
    </div>
  `;
}

function renderYearView() {
  const year = Number(state.selectedYear);
  els.yearGrid.innerHTML = Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, "0")}`;
    const records = getRecordsForMonth(month);
    const last = records.at(-1) || null;
    const delta = getMonthlyDelta(month);
    const deltaPercent = getMonthlyDeltaPercent(month);
    return `
      <button type="button" class="month-card ${last ? "has-data" : ""} ${toneClass(delta)}" data-month="${month}">
        <div class="month-card-title">
          <span>${MONTH_LABELS[index]}</span>
          <span>${records.length} 条</span>
        </div>
        <span>当月净值变化</span>
        <strong class="${deltaClass(delta)}">${formatDeltaWithPercent(delta, deltaPercent)}</strong>
        <span style="margin-top: 10px;">月末总净值：${last ? formatMoney(last.total) : "--"}</span>
      </button>
    `;
  }).join("");
}

function renderAnnualView() {
  const years = getAvailableYears();
  if (!years.length) {
    els.annualGrid.innerHTML = `<div class="empty-state">暂无年度收益数据。</div>`;
    return;
  }

  els.annualGrid.innerHTML = years
    .map((year) => {
      const records = getRecordsForYear(year);
      const first = records[0] || null;
      const last = records.at(-1) || null;
      const baseline = getAnnualBaseline(year);
      const delta = getAnnualDelta(year);
      const deltaPercent = getAnnualDeltaPercent(year);
      return `
        <button type="button" class="annual-card ${last ? "has-data" : ""} ${toneClass(delta)}" data-year="${year}">
          <div class="annual-card-title">
            <span>${year}年</span>
            <span>${records.length} 条</span>
          </div>
          <span>全年总收益</span>
          <strong class="${deltaClass(delta)}">${formatDeltaWithPercent(delta, deltaPercent)}</strong>
          <span style="margin-top: 10px;">年末总净值：${last ? formatMoney(last.total) : "--"}</span>
          <span>基准日期：${baseline ? baseline.date : first ? first.date : "--"}</span>
        </button>
      `;
    })
    .join("");
}

function renderTable() {
  const start = els.filterStart.value;
  const end = els.filterEnd.value;
  const filtered = state.records
    .filter((record) => (!start || record.date >= start) && (!end || record.date <= end))
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));

  if (!filtered.length) {
    els.recordsTable.innerHTML = `
      <tr>
        <td colspan="10">
          <div class="empty-state">没有匹配的数据。</div>
        </td>
      </tr>
    `;
    return;
  }

  els.recordsTable.innerHTML = filtered
    .map((record) => {
      const delta = getDailyDelta(record.date);
      const deltaPercent = getDailyDeltaPercent(record.date);
      return `
        <tr>
          <td>${record.date}</td>
          <td>${formatMoney(record.ccb)}</td>
          <td>${formatMoney(record.icbc)}</td>
          <td>${formatMoney(record.boc)}</td>
          <td>${formatMoney(record.bocom)}</td>
          <td>${formatMoney(record.fund)}</td>
          <td><strong>${formatMoney(record.total)}</strong></td>
          <td class="${deltaClass(delta)}">${formatDelta(delta)}</td>
          <td class="${deltaClass(delta)}">${formatPercent(deltaPercent)}</td>
          <td>
            <div class="row-actions">
              <button type="button" class="ghost-button" data-edit="${record.date}" ${state.token ? "" : "disabled"}>编辑</button>
              <button type="button" class="danger-button" data-delete="${record.date}" ${state.token ? "" : "disabled"}>删除</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderTrendChart() {
  const canvas = els.trendChart;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const records = state.records.slice(-30);
  els.chartCaption.textContent = records.length ? `最近 ${records.length} 条记录` : "暂无记录";

  const padding = { top: 18, right: 18, bottom: 28, left: 48 };
  const width = rect.width - padding.left - padding.right;
  const height = rect.height - padding.top - padding.bottom;

  ctx.strokeStyle = "#d9e0dc";
  ctx.lineWidth = 1;
  ctx.font = "12px system-ui, sans-serif";
  ctx.fillStyle = "#66747b";
  for (let i = 0; i <= 3; i += 1) {
    const y = padding.top + (height / 3) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + width, y);
    ctx.stroke();
  }

  if (!records.length) {
    ctx.fillText("暂无数据", padding.left, padding.top + height / 2);
    return;
  }

  const totals = records.map((record) => record.total);
  const min = Math.min(...totals);
  const max = Math.max(...totals);
  const range = max - min || 1;
  const points = records.map((record, index) => {
    const x = padding.left + (records.length === 1 ? width : (width / (records.length - 1)) * index);
    const y = padding.top + height - ((record.total - min) / range) * height;
    return { x, y, record };
  });

  ctx.strokeStyle = "#176b63";
  ctx.lineWidth = 3;
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();

  points.forEach((point) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 3.8, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "#176b63";
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  ctx.fillStyle = "#66747b";
  ctx.fillText(formatCompact(max), 4, padding.top + 4);
  ctx.fillText(formatCompact(min), 4, padding.top + height);
  ctx.fillText(records[0].date.slice(5), padding.left, rect.height - 8);
  ctx.textAlign = "right";
  ctx.fillText(records.at(-1).date.slice(5), padding.left + width, rect.height - 8);
  ctx.textAlign = "left";
}

function pickLatestDate() {
  const latest = getLatestRecord();
  if (!latest) return;
  state.selectedDate = latest.date;
  state.selectedMonth = latest.date.slice(0, 7);
  state.selectedYear = Number(latest.date.slice(0, 4));
}

function getRecord(date) {
  return state.records.find((record) => record.date === date) || null;
}

function getLatestRecord() {
  return state.records.at(-1) || null;
}

function getDailyDelta(date) {
  const record = getRecord(date);
  const previous = getRecord(addDays(date, -1));
  if (!record || !previous) return null;
  return record.total - previous.total;
}

function getDailyDeltaPercent(date) {
  const previous = getRecord(addDays(date, -1));
  return calculatePercent(getDailyDelta(date), previous ? previous.total : null);
}

function getRecordsForMonth(month) {
  return state.records.filter((record) => record.date.startsWith(month));
}

function getMonthlyDelta(month) {
  const current = getRecordsForMonth(month).at(-1) || null;
  const previous = getRecordsForMonth(addMonths(month, -1)).at(-1) || null;
  if (!current || !previous) return null;
  return current.total - previous.total;
}

function getMonthlyDeltaPercent(month) {
  const previous = getRecordsForMonth(addMonths(month, -1)).at(-1) || null;
  return calculatePercent(getMonthlyDelta(month), previous ? previous.total : null);
}

function getRecordsForYear(year) {
  return state.records.filter((record) => record.date.startsWith(`${year}-`));
}

function getAvailableYears() {
  return [...new Set(state.records.map((record) => Number(record.date.slice(0, 4))))].sort((a, b) => b - a);
}

function getAnnualDelta(year) {
  const current = getRecordsForYear(year).at(-1) || null;
  const baseline = getAnnualBaseline(year);
  if (!current || !baseline) return null;
  return current.total - baseline.total;
}

function getAnnualDeltaPercent(year) {
  const baseline = getAnnualBaseline(year);
  return calculatePercent(getAnnualDelta(year), baseline ? baseline.total : null);
}

function getAnnualBaseline(year) {
  const firstDay = `${year}-01-01`;
  const previous = state.records.filter((record) => record.date < firstDay).at(-1) || null;
  return previous || getRecordsForYear(year)[0] || null;
}

function calculateTotal(record) {
  return FIELD_DEFS.reduce((sum, field) => sum + toNumber(record[field.key]), 0);
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function trimNumber(value) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

function formatMoney(value) {
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

function formatCompact(value) {
  return new Intl.NumberFormat("zh-CN", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

function formatDelta(value) {
  if (value === null || Number.isNaN(value)) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatMoney(value)}`;
}

function formatPercent(value) {
  if (value === null || !Number.isFinite(value)) return "--";
  const normalized = Math.abs(value) < 0.005 ? 0 : value;
  const sign = normalized > 0 ? "+" : "";
  return `${sign}${new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(normalized)}%`;
}

function formatDeltaWithPercent(delta, percent, label = "") {
  if (delta === null || Number.isNaN(delta)) return "--";
  return `<span class="delta-amount">${label}${formatDelta(delta)}</span><span class="delta-percent">${formatPercent(percent)}</span>`;
}

function calculatePercent(delta, base) {
  if (delta === null || !Number.isFinite(delta) || !Number.isFinite(base) || base === 0) return null;
  return (delta / base) * 100;
}

function deltaClass(value) {
  if (value === null || Number.isNaN(value) || value === 0) return "is-neutral";
  return value > 0 ? "is-positive" : "is-negative";
}

function toneClass(value) {
  if (value === null || Number.isNaN(value) || value === 0) return "";
  return value > 0 ? "tone-positive" : "tone-negative";
}

function toDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

function addDays(dateValue, days) {
  if (!isValidDate(dateValue)) return dateValue;
  const date = new Date(`${dateValue}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toDateValue(date);
}

function addMonths(monthValue, months) {
  const [year, month] = monthValue.split("-").map(Number);
  const date = new Date(year, month - 1 + months, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function encodeBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary);
}

function decodeBase64(base64) {
  const binary = window.atob(base64.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    els.toast.classList.remove("is-visible");
  }, 3200);
}

function debounce(fn, delay) {
  let timer = null;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), delay);
  };
}
