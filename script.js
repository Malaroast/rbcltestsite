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

// CSV 파서
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
function getActiveTab() { return document.querySelector(".tab-content.active")?.id || "top5"; }

function getNumericColumns(tab) {
  if (tab === 'top5') return [];
  const skip = new Set([COLUMN_CONFIG.playerName, "소속 팀", "팀명"]);
  return COLUMN_CONFIG.table[tab].filter((col) => !skip.has(col));
}

function populateFilterOptions(tab) {
  const select = document.getElementById("filterColumn");
  if (!select) return;

  const filtersDiv = document.querySelector('.filters');
  if (tab === 'top5') {
    if (filtersDiv) filtersDiv.style.display = 'none';
    return;
  } else {
    if (filtersDiv) filtersDiv.style.display = 'flex';
  }

  select.innerHTML = "";
  const emptyOpt = document.createElement("option");
  emptyOpt.value = ""; emptyOpt.textContent = "전체"; select.appendChild(emptyOpt);
  
  const numericCols = getNumericColumns(tab);
  numericCols.forEach((col) => {
    const opt = document.createElement("option"); opt.value = col; opt.textContent = col; select.appendChild(opt);
  });

  const state = filters[tab] || { col: null, min: null, max: null };
  select.value = state.col || "";
  document.getElementById("filterMin").value = state.min ?? "";
  document.getElementById("filterMax").value = state.max ?? "";
}

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
  if (!table) return;
  const thead = table.querySelector("thead");
  const tbody = table.querySelector("tbody");
  const nameField = COLUMN_CONFIG.playerName;

  thead.innerHTML = "";
  const headerRow = document.createElement("tr");
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
    td.colSpan = columns.length + 1;
    td.textContent = "데이터를 불러오지 못했습니다.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  rows.forEach((row, rowIndex) => {
    const tr = document.createElement("tr");
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
  updateRankNumbers(tbody);

  table.querySelectorAll("th").forEach((th) => th.classList.remove("sort-asc", "sort-desc"));
  const th = table.querySelector(`th:nth-child(${dataColIndex + 1})`);
  if (th) th.classList.add(isAsc ? "sort-desc" : "sort-asc");
}

function applyAllFilters() {
  const activeTab = getActiveTab();
  if (activeTab === 'top5') return; // 에러 방지: 리더보드 탭은 필터 무시

  const searchText = document.getElementById("searchInput").value.toLowerCase();
  const filter = filters[activeTab];
  const table = document.querySelector(`#${activeTab} table`);
  if (!table) return;
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
  updateRankNumbers(tbody);
}

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
  if (!modal) return;
  document.getElementById("modalPlayerName").textContent = playerName;
  const batterRow = dataStore.batters.map.get(playerName) || zeroRow(COLUMN_CONFIG.detail.batters, playerName);
  const pitcherRow = dataStore.pitchers.map.get(playerName) || zeroRow(COLUMN_CONFIG.detail.pitchers, playerName);
  renderDetail("detailBatters", COLUMN_CONFIG.detail.batters, batterRow);
  renderDetail("detailPitchers", COLUMN_CONFIG.detail.pitchers, pitcherRow);
  
  document.querySelectorAll("[data-detail-tab]").forEach((btn) => btn.classList.remove("active"));
  document.querySelectorAll(".detail-content").forEach((c) => c.classList.remove("active"));
  
  const defaultTabBtn = document.querySelector("[data-detail-tab='detailBatters']");
  if (defaultTabBtn) defaultTabBtn.classList.add("active");
  const defaultContent = document.getElementById("detailBatters");
  if (defaultContent) defaultContent.classList.add("active");
  
  modal.classList.add("show"); modal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  const modal = document.getElementById("playerModal");
  modal.classList.remove("show"); modal.setAttribute("aria-hidden", "true");
}

function setupModalEvents() {
  const modal = document.getElementById("playerModal");
  if (!modal) return;
  modal.addEventListener("click", (e) => { if (e.target.classList.contains("modal__overlay")) closeModal(); });
  const closeBtn = modal.querySelector(".modal__close");
  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  
  document.querySelectorAll("[data-detail-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-detail-tab]").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".detail-content").forEach((c) => c.classList.remove("active"));
      btn.classList.add("active"); 
      const targetId = btn.dataset.detailTab;
      const targetContent = document.getElementById(targetId);
      if (targetContent) targetContent.classList.add("active");
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

async function renderTop5(raw) {
  const container = document.getElementById("leaderContainer");
  if (!container) return;
  container.innerHTML = "";

  const colPairs = [1, 4, 7, 10, 13]; 
  const rowGroups = [{start: 44, titleRow: 44}, {start: 51, titleRow: 51}]; 

  for (const group of rowGroups) {
    for (const colIdx of colPairs) {
      const title = raw[group.titleRow]?.[colIdx + 1];
      if (!title) continue;
      
      let listHtml = "";
      let topPlayerImage = ""; // 1등 사진 저장용

      for (let i = 1; i <= 5; i++) {
        const name = raw[group.start + i]?.[colIdx];
        const val = raw[group.start + i]?.[colIdx + 1];
        
        if (name && name.trim() !== "") {
          // 1등인 경우 로블록스 사진 가져오기
          if (i === 1) {
            const avatarUrl = await getRobloxAvatar(name);
            if (avatarUrl) {
              topPlayerImage = `<div class="top-player-img"><img src="${avatarUrl}" alt="${name}"></div>`;
            }
          }

          listHtml += `
            <li class="leader-item">
              <span class="leader-rank">${i}</span>
              <span class="leader-name" onclick="openModal('${name}')">${name}</span>
              <span class="leader-value">${val}</span>
            </li>`;
        }
      }

      if (listHtml !== "") {
        container.innerHTML += `
          <div class="leader-card">
            ${topPlayerImage} <h3>${title}</h3>
            <ul class="leader-list">${listHtml}</ul>
          </div>`;
      }
    }
  }
}

// 이벤트 바인딩
document.getElementById("searchInput").addEventListener("input", applyAllFilters);

document.getElementById("applyFilter").addEventListener("click", () => {
  const tab = getActiveTab();
  if (tab === 'top5') return;
  const col = document.getElementById("filterColumn").value || null;
  const minVal = parseFloat(document.getElementById("filterMin").value);
  const maxVal = parseFloat(document.getElementById("filterMax").value);
  filters[tab] = { col, min: isNaN(minVal) ? null : minVal, max: isNaN(maxVal) ? null : maxVal };
  applyAllFilters();
});

document.getElementById("clearFilter").addEventListener("click", () => {
  const tab = getActiveTab();
  if (tab === 'top5') return;
  filters[tab] = { col: null, min: null, max: null };
  document.getElementById("filterColumn").value = ""; 
  document.getElementById("filterMin").value = ""; 
  document.getElementById("filterMax").value = "";
  applyAllFilters();
});

document.querySelectorAll(".tab-btn[data-tab]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const tabName = btn.dataset.tab;
    document.querySelectorAll(".tab-btn[data-tab]").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
    
    btn.classList.add("active"); 
    const content = document.getElementById(tabName);
    if (content) content.classList.add("active");
    
    populateFilterOptions(tabName); 
    if (tabName !== 'top5') {
      applyAllFilters();
    }
  });
});

async function loadData() {
  try {
    const [bRes, pRes, lRes] = await Promise.all([
      fetch(battersCSV), 
      fetch(pitchersCSV),
      fetch(leagueCSV)
    ]);
    
    const bRaw = parseCSV(await bRes.text());
    const pRaw = parseCSV(await pRes.text());
    const lRaw = parseCSV(await lRes.text());

    const bData = toObjects(bRaw);
    const pData = toObjects(pRaw);

    dataStore.batters = { ...bData, map: mapByName(bData.rows) };
    dataStore.pitchers = { ...pData, map: mapByName(pData.rows) };
    
    renderTop5(lRaw); 
    renderTable("batters", "battersTable", COLUMN_CONFIG.table.batters, dataStore.batters.rows);
    renderTable("pitchers", "pitchersTable", COLUMN_CONFIG.table.pitchers, dataStore.pitchers.rows);
    
    setupTableClick();
    const currentTab = getActiveTab();
    populateFilterOptions(currentTab);
    
    if (currentTab !== 'top5') {
      applyAllFilters();
    }
  } catch (err) {
    console.error("데이터 로드 에러:", err);
  }
}

async function getRobloxAvatar(username) {
  try {
    // [중요] 여기에 본인의 Cloudflare Worker 주소를 넣으세요.
    const myProxy = "https://floral-recipe-7246.mhr090830.workers.dev/"; 
    const target = "https://users.roblox.com/v1/usernames/users";
    
    // 1. 유저 ID 가져오기
    const res = await fetch(`${myProxy}?url=${encodeURIComponent(target)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: true })
    });

    const data = await res.json();

    if (data.data && data.data.length > 0) {
      const userId = data.data[0].id;
      // 2. 헤드샷 썸네일 URL 반환 (이미지 주소는 프록시 없이도 잘 작동합니다)
      return `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=150&height=150&format=png`;
    }
  } catch (err) {
    console.error("로블록스 이미지 로드 실패:", err);
  }
  // 실패 시 기본 아바타
  return "https://tr.rbxcdn.com/38c6ed8c6360255caffabcde41f13903/150/150/AvatarBust/Png";
}

// 초기화 실행
setupModalEvents();
document.addEventListener("DOMContentLoaded", loadData);
