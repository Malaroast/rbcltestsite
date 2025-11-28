const battersCSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT7qAaMm3tG_1oEuIPbn4pLZiDzzwl6d-Ur-y3_fw9fXIjJN-SYwdap5rbmOk63nDApmzCiqYYa495j/pub?gid=0&single=true&output=csv";
const pitchersCSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT7qAaMm3tG_1oEuIPbn4pLZiDzzwl6d-Ur-y3_fw9fXIjJN-SYwdap5rbmOk63nDApmzCiqYYa495j/pub?gid=249730824&single=true&output=csv";

const COLUMN_SETS = {
  batters: ['순위', '선수명', '팀명', 'AVG', 'PA', 'R', 'H', '2B', '3B', 'HR', 'RBI'],
  pitchers: ['순위', '선수명', '팀명', 'ERA', 'G', 'W', 'L', 'SV', 'IP', 'H', 'HR', 'BB', 'SO', 'ER', 'WHIP']
};

function parseCSV(text) {
  return text.trim().split(/\r?\n/).map((row) => row.split(","));
}

function shapeData(raw, columns) {
  if (!raw.length) return [];
  const headerRow = raw[0];
  return raw.slice(1).map((row) =>
    columns.map((col, idx) => {
      const colIndex = headerRow.indexOf(col);
      if (colIndex !== -1 && row[colIndex] !== undefined) return row[colIndex];
      return row[idx] ?? "";
    })
  );
}

function renderTable(tableId, columns, rows) {
  const table = document.getElementById(tableId);
  const thead = table.querySelector("thead");
  const tbody = table.querySelector("tbody");

  thead.innerHTML = "";
  const headerRow = document.createElement("tr");
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
    td.colSpan = columns.length;
    td.textContent = "데이터를 불러오지 몯핻슴니다.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  rows.forEach((row) => {
    const tr = document.createElement("tr");
    row.forEach((cell) => {
      const td = document.createElement("td");
      td.textContent = cell;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

const sortState = {};

function sortTable(tableId, col) {
  const table = document.getElementById(tableId);
  const tbody = table.querySelector("tbody");
  const rows = Array.from(tbody.querySelectorAll("tr"));

  const isAsc = sortState[tableId] && sortState[tableId].col === col && sortState[tableId].dir === "asc";
  sortState[tableId] = { col, dir: isAsc ? "desc" : "asc" };

  rows.sort((a, b) => {
    const aText = a.children[col].textContent.replace(/,/g, "");
    const bText = b.children[col].textContent.replace(/,/g, "");
    const aNum = parseFloat(aText);
    const bNum = parseFloat(bText);
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return isAsc ? bNum - aNum : aNum - bNum;
    }
    return isAsc ? bText.localeCompare(aText) : aText.localeCompare(bText);
  });

  tbody.innerHTML = "";
  rows.forEach((r) => tbody.appendChild(r));

  table.querySelectorAll("th").forEach((th) => th.classList.remove("sort-asc", "sort-desc"));
  const th = table.querySelector(`th:nth-child(${col + 1})`);
  if (th) th.classList.add(isAsc ? "sort-desc" : "sort-asc");
}

function applySearchFilter() {
  const filter = document.getElementById("searchInput").value.toLowerCase();
  document.querySelectorAll(".tab-content").forEach((section) => {
    const isActive = section.classList.contains("active");
    section.querySelectorAll("tbody tr").forEach((row) => {
      if (!isActive) {
        row.style.display = "";
        return;
      }
      row.style.display = row.textContent.toLowerCase().includes(filter) ? "" : "none";
    });
  });
}

document.getElementById("searchInput").addEventListener("input", applySearchFilter);

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
    applySearchFilter();
  });
});

async function loadData() {
  try {
    const [bRes, pRes] = await Promise.all([fetch(battersCSV), fetch(pitchersCSV)]);
    const bData = parseCSV(await bRes.text());
    const pData = parseCSV(await pRes.text());
    renderTable("battersTable", COLUMN_SETS.batters, shapeData(bData, COLUMN_SETS.batters));
    renderTable("pitchersTable", COLUMN_SETS.pitchers, shapeData(pData, COLUMN_SETS.pitchers));
  } catch (err) {
    console.error("데이터를 불러오는 중 문제가 발생핻슴니다.", err);
    renderTable("battersTable", COLUMN_SETS.batters, []);
    renderTable("pitchersTable", COLUMN_SETS.pitchers, []);
  }
}

document.addEventListener("DOMContentLoaded", loadData);
