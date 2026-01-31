const battersCSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT7qAaMm3tG_1oEuIPbn4pLZiDzzwl6d-Ur-y3_fw9fXIjJN-SYwdap5rbmOk63nDApmzCiqYYa495j/pub?gid=0&single=true&output=csv";
const pitchersCSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT7qAaMm3tG_1oEuIPbn4pLZiDzzwl6d-Ur-y3_fw9fXIjJN-SYwdap5rbmOk63nDApmzCiqYYa495j/pub?gid=249730824&single=true&output=csv";
const leagueCSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT7qAaMm3tG_1oEuIPbn4pLZiDzzwl6d-Ur-y3_fw9fXIjJN-SYwdap5rbmOk63nDApmzCiqYYa495j/pub?gid=776680138&single=true&output=csv";

const COLUMN_CONFIG = {
  playerName: "Player",
  table: {
    batters: ["Player", "타석", "안타", "2루타", "3루타", "홈런", "볼넷", "삼진", "도루", "타점", "득점", "타율", "출루율", "장타율", "OPS", "wRC+", "hWAR", "종합 WAR", "소속 팀"],
    pitchers: ["Player", "출장 수", "선발등판 수", "이닝", "자책점", "탈삼진", "피안타", "피홈런", "볼넷", "승리", "패배", "세이브", "ERA", "WHIP", "pWAR", "종합 WAR", "소속 팀"]
  },
  detail: {
    batters: ["Player", "타석", "안타", "2루타", "3루타", "홈런", "볼넷", "삼진", "도루", "타점", "득점", "타율", "출루율", "장타율", "OPS", "wOBA", "wRC", "wRC+", "소속 팀", "wRAA", "hWAR", "FA 등급", "종합 WAR"],
    pitchers: ["Player", "출장 수", "선발등판 수", "이닝", "자책점", "탈삼진", "피안타", "피홈런", "볼넷", "승리", "패배", "세이브", "ERA", "WHIP", "ERA+", "pWAR", "소속 팀", "FIP", "FA 등급", "RAA", "종합 WAR"]
  }
};

const dataStore = {
  batters: { header: [], rows: [], map: new Map() },
  pitchers: { header: [], rows: [], map: new Map() }
};

const sortState = {};
const filters = {
  batters: { col: null, min: null, max: null },
  pitchers: { col: null, min: null, max: null }
};

// CSV 파서 및 데이터 변환 함수 (기존과 동일)
function parseCSV(text) {
  const rows = []; let row = []; let field = ""; let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]; const next = text[i + 1];
    if (ch === '"') { if (inQuotes && next === '"') { field += '"'; i++; } else { inQuotes = !inQuotes; } }
    else if (ch === "," && !inQuotes) { row.push(field); field = ""; }
    else if ((ch === "\n" || ch === "\r") && !inQuotes) { if (ch === "\r" && next === "\n") i++; row.push(field); rows.push(row); row = []; field = ""; }
    else { field += ch; }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 0).map((r) => r.map((cell) => cell.replace(/^"(.*)"$/s, "$1").replace(/""/g, '"').trim()));
}

function toObjects(raw) {
  if (!raw.length) return { header: [], rows: [] };
  const header = raw[0];
  const rows = raw.slice(1).filter((row) => row.slice(0, 11).some((cell) => (cell || "").trim() !== "")).map((row) => {
    const obj = {}; header.forEach((key, idx) => { obj[key] = row[idx] ?? ""; }); return obj;
  });
  return { header, rows };
}

function mapByName(rows) {
  const m = new Map(); rows.forEach((row) => { const name = row[COLUMN_CONFIG.playerName]; if (name) m.set(name, row); });
  return m;
}

function zeroRow(columns, name) {
  const obj = {}; columns.forEach((col) => { obj[col] = ""; });
  if (name) obj[COLUMN_CONFIG.playerName] = name; return obj;
}

function pick(row, columns) { return columns.map((col) => row?.[col] ?? ""); }
function getActiveTab() { return document.querySelector(".tab-content.active")?.id || "batters"; }
function getNumericColumns(tab) {
  const skip = new Set([COLUMN_CONFIG.playerName, "소속 팀", "팀명"]);
  return COLUMN_CONFIG.table[tab].filter((col) => !skip.has(col));
}

function populateFilterOptions(tab) {
  const select = document.getElementById("filterColumn");
  if (!select) return;
  select.innerHTML = "";
  const emptyOpt = document.createElement("option");
  emptyOpt.value = ""; emptyOpt.textContent = "전체"; select.appendChild(emptyOpt);
  getNumericColumns(tab).forEach((col) => {
    const opt = document.createElement("option"); opt.value = col; opt.textContent = col; select.appendChild(opt);
  });
  const state = filters[tab]; select.value = state.col || "";
  document.getElementById("filterMin").value = state.min ?? "";
  document.getElementById("filterMax").value = state.max ?? "";
}

// --- 수정된 부분: 순위 업데이트 로직 ---
function updateRankNumbers(tableBody) {
  let count = 1;
  tableBody.querySelectorAll("tr").forEach((row) => {
    if (row.style.display !== "none") {
      const rankCell = row.querySelector(".rank-cell");
      if (rankCell) rankCell.textContent = count++;
    }
  });
}

function renderTable(category, tableId, columns, rows) {
  const table = document.getElementById(tableId);
  const thead = table.querySelector("thead");
  const tbody = table.querySelector("tbody");
  const nameField = COLUMN_CONFIG.playerName;

  thead.innerHTML = "";
  const headerRow = document.createElement("tr");

  // [수정] 순위 헤더 추가
  const rankTh = document.createElement("th");
  rankTh.textContent = "순위";
  headerRow.appendChild(rankTh);

  columns.forEach((label, i) => {
    const th = document.createElement("th");
    th.textContent = label;
    th.dataset.col = i;
    th.addEventListener("click", () => sortTable(tableId, i));
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  tbody.innerHTML = "";
  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = columns.length + 1; // 순위 컬럼 포함
    td.textContent = "데이터를 불러오지 못했습니다.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  rows.forEach((row, rowIndex) => {
    const tr = document.createElement("tr");
    
    // [수정] 순위 데이터 셀 추가
    const rankTd = document.createElement("td");
    rankTd.className = "rank-cell";
    rankTd.textContent = rowIndex + 1;
    tr.appendChild(rankTd);

    pick(row, columns).forEach((cell, idx) => {
      const td = document.createElement("td");
      if (columns[idx] === nameField) {
        const span = document.createElement("span");
        span.className = "clickable player-link";
        span.dataset.player = cell;
        span.dataset.category = category;
        span.textContent = cell;
        td.appendChild(span);
      } else {
        td.textContent = cell;
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

function sortTable(tableId, col) {
  const table = document.getElementById(tableId);
  const tbody = table.querySelector("tbody");
  const rows = Array.from(tbody.querySelectorAll("tr"));

  // [수정] 순위 컬럼이 추가되었으므로 데이터 컬럼 인덱스는 col + 1입니다.
  const dataColIndex = col + 1;

  const isAsc = sortState[tableId] && sortState[tableId].col === col && sortState[tableId].dir === "asc";
  sortState[tableId] = { col, dir: isAsc ? "desc" : "asc" };

  rows.sort((a, b) => {
    const aText = a.children[dataColIndex].textContent.replace(/,/g, "");
    const bText = b.children[dataColIndex].textContent.replace(/,/g, "");
    const aNum = parseFloat(aText);
    const bNum = parseFloat(bText);
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return isAsc ? bNum - aNum : aNum - bNum;
    }
    return isAsc ? bText.localeCompare(aText) : aText.localeCompare(bText);
  });

  tbody.innerHTML = "";
  rows.forEach((r) => tbody.appendChild(r));

  // [수정] 정렬 후 번호 재부여
  updateRankNumbers(tbody);

  table.querySelectorAll("th").forEach((th) => th.classList.remove("sort-asc", "sort-desc"));
  const th = table.querySelector(`th:nth-child(${dataColIndex + 1})`);
  if (th) th.classList.add(isAsc ? "sort-desc" : "sort-asc");
}

function applyAllFilters() {
  const activeTab = getActiveTab();
  const searchText = document.getElementById("searchInput").value.toLowerCase();
  const filter = filters[activeTab];
  const table = document.querySelector(`#${activeTab} table`);
  const tbody = table.querySelector("tbody");
  const headerCells = Array.from(table.querySelectorAll("th"));
  const colIndex = filter.col ? headerCells.findIndex((th) => th.textContent === filter.col) : -1;

  tbody.querySelectorAll("tr").forEach((row) => {
    const textMatch = row.textContent.toLowerCase().includes(searchText);
    let numericMatch = true;

    if (filter.col && colIndex >= 0) {
      const raw = row.children[colIndex]?.textContent || "";
      const num = parseFloat(raw.replace(/,/g, ""));
      if (raw.trim() === "" || isNaN(num)) {
        numericMatch = false;
      } else {
        if (filter.min !== null && num < filter.min) numericMatch = false;
        if (filter.max !== null && num > filter.max) numericMatch = false;
      }
    }

    row.style.display = textMatch && numericMatch ? "" : "none";
  });

  // [수정] 필터링 적용 후 보이는 결과에만 순서대로 번호 재부여
  updateRankNumbers(tbody);
}

// 이하 Modal 및 초기화 로직 (기존과 동일)
function renderDetail(containerId, columns, row) {
  const container = document.getElementById(containerId); container.innerHTML = "";
  const grid = document.createElement("div"); grid.className = "detail-grid";
  columns.forEach((col) => {
    const item = document.createElement("div"); item.className = "detail-item";
    const label = document.createElement("strong"); label.textContent = col;
    const value = document.createElement("span"); value.textContent = row?.[col] ?? "0";
    item.appendChild(label); item.appendChild(value); grid.appendChild(item);
  });
  container.appendChild(grid);
}

function openModal(playerName) {
  const modal = document.getElementById("playerModal");
  document.getElementById("modalPlayerName").textContent = playerName;
  const batterRow = dataStore.batters.map.get(playerName) || zeroRow(COLUMN_CONFIG.detail.batters, playerName);
  const pitcherRow = dataStore.pitchers.map.get(playerName) || zeroRow(COLUMN_CONFIG.detail.pitchers, playerName);
  renderDetail("detailBatters", COLUMN_CONFIG.detail.batters, batterRow);
  renderDetail("detailPitchers", COLUMN_CONFIG.detail.pitchers, pitcherRow);
  document.querySelectorAll("[data-detail-tab]").forEach((btn) => btn.classList.remove("active"));
  document.querySelectorAll(".detail-content").forEach((c) => c.classList.remove("active"));
  document.querySelector("[data-detail-tab='detailBatters']").classList.add("active");
  document.getElementById("detailBatters").classList.add("active");
  modal.classList.add("show"); modal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  const modal = document.getElementById("playerModal");
  modal.classList.remove("show"); modal.setAttribute("aria-hidden", "true");
}

function setupModalEvents() {
  const modal = document.getElementById("playerModal");
  modal.addEventListener("click", (e) => { if (e.target.classList.contains("modal__overlay")) closeModal(); });
  modal.querySelector(".modal__close").addEventListener("click", closeModal);
  document.querySelectorAll("[data-detail-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-detail-tab]").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".detail-content").forEach((c) => c.classList.remove("active"));
      btn.classList.add("active"); document.getElementById(btn.dataset.detailTab).classList.add("active");
    });
  });
}

function setupTableClick() {
  document.querySelectorAll("table").forEach((table) => {
    table.addEventListener("click", (e) => {
      const target = e.target.closest(".player-link");
      if (!target) return;
      const name = target.dataset.player;
      if (name) openModal(name);
    });
  });
}

document.getElementById("searchInput").addEventListener("input", applyAllFilters);
document.getElementById("applyFilter").addEventListener("click", () => {
  const tab = getActiveTab();
  const col = document.getElementById("filterColumn").value || null;
  const minVal = parseFloat(document.getElementById("filterMin").value);
  const maxVal = parseFloat(document.getElementById("filterMax").value);
  filters[tab] = { col, min: isNaN(minVal) ? null : minVal, max: isNaN(maxVal) ? null : maxVal };
  applyAllFilters();
});
document.getElementById("clearFilter").addEventListener("click", () => {
  const tab = getActiveTab(); filters[tab] = { col: null, min: null, max: null };
  document.getElementById("filterColumn").value = ""; document.getElementById("filterMin").value = ""; document.getElementById("filterMax").value = "";
  applyAllFilters();
});
document.querySelectorAll(".tab-btn[data-tab]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn[data-tab]").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
    btn.classList.add("active"); document.getElementById(btn.dataset.tab).classList.add("active");
    populateFilterOptions(btn.dataset.tab); applyAllFilters();
  });
});

async function loadData() {
  try {
    const [bRes, pRes] = await Promise.all([fetch(battersCSV), fetch(pitchersCSV)]);
    const bData = toObjects(parseCSV(await bRes.text()));
    const pData = toObjects(parseCSV(await pRes.text()));
    dataStore.batters = { ...bData, map: mapByName(bData.rows) };
    dataStore.pitchers = { ...pData, map: mapByName(pData.rows) };
    renderTable("batters", "battersTable", COLUMN_CONFIG.table.batters, dataStore.batters.rows);
    renderTable("pitchers", "pitchersTable", COLUMN_CONFIG.table.pitchers, dataStore.pitchers.rows);
    setupTableClick(); populateFilterOptions(getActiveTab()); applyAllFilters();
  } catch (err) {
    console.error("데이터 오류", err);
    renderTable("batters", "battersTable", COLUMN_CONFIG.table.batters, []);
    renderTable("pitchers", "pitchersTable", COLUMN_CONFIG.table.pitchers, []);
  }
}

async function loadData() {
  try {
    const [bRes, pRes, lRes] = await Promise.all([
      fetch(battersCSV), 
      fetch(pitchersCSV),
      fetch(leagueCSV) // 추가
    ]);
    
    const bData = toObjects(parseCSV(await bRes.text()));
    const pData = toObjects(parseCSV(await pRes.text()));
    const lRaw = parseCSV(await lRes.text()); // 추가

    dataStore.batters = { ...bData, map: mapByName(bData.rows) };
    dataStore.pitchers = { ...pData, map: mapByName(pData.rows) };
    
    // 리더보드 실행 함수 추가
    renderTop5(lRaw); 

    renderTable("batters", "battersTable", COLUMN_CONFIG.table.batters, dataStore.batters.rows);
    renderTable("pitchers", "pitchersTable", COLUMN_CONFIG.table.pitchers, dataStore.pitchers.rows);
    setupTableClick();
    populateFilterOptions(getActiveTab());
    applyAllFilters();
  } catch (err) {
    console.error("데이터 로드 에러:", err);
  }
}

// 3. 파일 맨 아래에 renderTop5 함수 추가
function renderTop5(raw) {
  const container = document.getElementById("leaderContainer");
  if (!container) return;
  container.innerHTML = "";

  const colPairs = [1, 4, 7, 10, 13]; // B, E, H, K, N열
  const rowGroups = [{start: 44, titleRow: 50}, {start: 51, titleRow: 58}]; 

  rowGroups.forEach(group => {
    colPairs.forEach(colIdx => {
      const title = raw[group.titleRow]?.[colIdx + 1];
      if (!title) return;
      
      let listHtml = "";
      for (let i = 1; i <= 5; i++) {
        const name = raw[group.start + i]?.[colIdx];
        const val = raw[group.start + i]?.[colIdx + 1];
        if (name) {
          listHtml += `
            <li class="leader-item">
              <span class="leader-rank">${i}</span>
              <span class="leader-name" onclick="openModal('${name}')">${name}</span>
              <span class="leader-value">${val}</span>
            </li>`;
        }
      }
      container.innerHTML += `
        <div class="leader-card">
          <h3>${title}</h3>
          <ul class="leader-list">${listHtml}</ul>
        </div>`;
    });
  });
}

setupModalEvents();
document.addEventListener("DOMContentLoaded", loadData);
