const battersCSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT7qAaMm3tG_1oEuIPbn4pLZiDzzwl6d-Ur-y3_fw9fXIjJN-SYwdap5rbmOk63nDApmzCiqYYa495j/pub?gid=0&single=true&output=csv";
const pitchersCSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT7qAaMm3tG_1oEuIPbn4pLZiDzzwl6d-Ur-y3_fw9fXIjJN-SYwdap5rbmOk63nDApmzCiqYYa495j/pub?gid=249730824&single=true&output=csv";
// League 시트의 GID 번호를 확인해서 수정하세요!
const leagueCSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT7qAaMm3tG_1oEuIPbn4pLZiDzzwl6d-Ur-y3_fw9fXIjJN-SYwdap5rbmOk63nDApmzCiqYYa495j/pub?gid=776680138&single=true&output=csv";

const dataStore = { batters: { rows: [], map: {} }, pitchers: { rows: [], map: {} } };

document.addEventListener("DOMContentLoaded", () => {
  loadData();
  setupEvents();
});

async function loadData() {
  try {
    const [bRes, pRes, lRes] = await Promise.all([fetch(battersCSV), fetch(pitchersCSV), fetch(leagueCSV)]);
    
    const bText = await bRes.text();
    const pText = await pRes.text();
    const lText = await lRes.text();

    dataStore.batters.rows = toObjects(parseCSV(bText));
    dataStore.pitchers.rows = toObjects(parseCSV(pText));
    dataStore.batters.map = mapByName(dataStore.batters.rows);
    dataStore.pitchers.map = mapByName(dataStore.pitchers.rows);

    renderTop5(parseCSV(lText));
    renderTable("battersTable", ["Player", "타율", "홈런", "OPS", "wRC+", "소속 팀"], dataStore.batters.rows);
    renderTable("pitchersTable", ["Player", "이닝", "ERA", "WHIP", "pWAR", "소속 팀"], dataStore.pitchers.rows);
  } catch (e) { console.error("데이터 로드 실패", e); }
}

function renderTop5(raw) {
  const container = document.getElementById("leaderContainer");
  const colPairs = [1, 4, 7, 10, 13]; 
  const rowGroups = [{start: 44, titleRow: 44}, {start: 51, titleRow: 51}];

  container.innerHTML = "";
  rowGroups.forEach(group => {
    colPairs.forEach(colIdx => {
      const title = raw[group.titleRow]?.[colIdx + 1];
      if (!title) return;
      let html = `<div class="leader-card"><h3>${title}</h3><ul class="leader-list">`;
      for(let i=1; i<=5; i++) {
        const name = raw[group.start+i]?.[colIdx];
        const val = raw[group.start+i]?.[colIdx+1];
        if(name) html += `<li class="leader-item"><span class="leader-rank">${i}</span><span class="leader-name player-link" data-player="${name}">${name}</span><span class="leader-value">${val}</span></li>`;
      }
      container.innerHTML += html + `</ul></div>`;
    });
  });
}

function renderTable(id, cols, rows) {
  const table = document.getElementById(id);
  table.querySelector("thead").innerHTML = `<tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr>`;
  table.querySelector("tbody").innerHTML = rows.map(r => `<tr>${cols.map(c=>`<td class="${c==='Player'?'player-link':''}" data-player="${r['Player']}">${r[c]||'-'}</td>`).join('')}</tr>`).join('');
}

function setupEvents() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".tab-btn, .tab-content").forEach(el => el.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
    };
  });

  document.addEventListener("click", e => {
    if(e.target.classList.contains("player-link")) openModal(e.target.dataset.player);
  });

  const closeModal = () => document.getElementById("playerModal").classList.remove("active");
  document.querySelector(".modal__close").onclick = closeModal;
  document.querySelector(".modal__overlay").onclick = closeModal;
}

function openModal(name) {
  document.getElementById("modalPlayerName").textContent = name;
  const b = dataStore.batters.map[name], p = dataStore.pitchers.map[name];
  document.getElementById("detailBatters").innerHTML = b ? "<h4>타자 기록</h4>" + Object.entries(b).map(([k,v])=>`<span>${k}:${v}</span>`).join(' | ') : "";
  document.getElementById("detailPitchers").innerHTML = p ? "<h4>투수 기록</h4>" + Object.entries(p).map(([k,v])=>`<span>${k}:${v}</span>`).join(' | ') : "";
  document.getElementById("playerModal").classList.add("active");
}

function parseCSV(t) { return t.split("\n").map(r => r.split(",").map(c => c.trim())); }
function toObjects(csv) {
  const h = csv[0];
  return csv.slice(1).map(r => { let o = {}; h.forEach((k,i) => o[k]=r[i]); return o; }).filter(r => r["Player"]);
}

function mapByName(rows) { let m = {}; rows.forEach(r => m[r["Player"]] = r); return m; }
