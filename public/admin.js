let adminKey = '';

const GROUP_ORDER = ['이사', '간사', '학생·학사'];
const GROUP_LABEL = { '이사': '이사', '간사': '간사', '학생·학사': '학사/학생' };
const CHOICE_ORDER = ['찬성', '반대'];
const CHOICE_CLASS = { '찬성': 'yes', '반대': 'no' };

async function tryLoad(){
  try{
    const res = await fetch('/api/results', {
      headers: { 'x-admin-key': adminKey }
    });
    const data = await res.json();
    if(res.status === 401){
      return { ok: false, error: '비밀번호가 올바르지 않습니다.' };
    }
    if(!res.ok){
      return { ok: false, error: data.error || '집계를 불러오지 못했습니다.' };
    }
    return { ok: true, data };
  }catch(e){
    return { ok: false, error: '불러오기에 실패했습니다.' };
  }
}

function buildTable(data){
  const table = document.getElementById('resultsTable');
  table.innerHTML = '';

  const groupParticipants = data.groupParticipants || {};
  const groupTotals = data.groupTotals || {};

  // ---- 헤더 0행: 후보명(3행 병합) / 구분별 참여인원·찬성 합계 요약 ----
  const summaryRow = document.createElement('tr');
  summaryRow.innerHTML = `<th class="cand-head" rowspan="3">후보명</th>`;
  GROUP_ORDER.forEach(g => {
    const p = groupParticipants[g] ?? 0;
    const yes = groupTotals[g] ? groupTotals[g].찬성 : 0;
    summaryRow.innerHTML += `<th class="summary-head" colspan="${CHOICE_ORDER.length}">총 ${p} 명 참여 / 찬성 ${yes}표</th>`;
  });
  const totalYesAll = GROUP_ORDER.reduce((s, g) => s + (groupTotals[g] ? groupTotals[g].찬성 : 0), 0);
  summaryRow.innerHTML += `<th class="summary-head total-group" colspan="${CHOICE_ORDER.length}">전체 ${data.count}명 / 찬성 ${totalYesAll}표</th>`;

  // ---- 헤더 1행: 이사 / 간사 / 학사·학생 / 합계 ----
  const headRow1 = document.createElement('tr');
  GROUP_ORDER.forEach(g => {
    headRow1.innerHTML += `<th class="group-head" colspan="${CHOICE_ORDER.length}">${GROUP_LABEL[g]}</th>`;
  });
  headRow1.innerHTML += `<th class="group-head total-group" colspan="${CHOICE_ORDER.length}">합계</th>`;

  // ---- 헤더 2행: 찬성/반대 반복 ----
  const headRow2 = document.createElement('tr');
  GROUP_ORDER.forEach(() => {
    CHOICE_ORDER.forEach(c => {
      headRow2.innerHTML += `<th class="choice-head choice-${CHOICE_CLASS[c]}">${c}</th>`;
    });
  });
  CHOICE_ORDER.forEach(c => {
    headRow2.innerHTML += `<th class="choice-head choice-${CHOICE_CLASS[c]} total-group">${c}</th>`;
  });

  const thead = document.createElement('thead');
  thead.appendChild(summaryRow);
  thead.appendChild(headRow1);
  thead.appendChild(headRow2);
  table.appendChild(thead);

  // ---- 본문: 후보별 행 ----
  const tbody = document.createElement('tbody');
  data.candidates.forEach(name => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="cand-name">${name}</td>`;

    const totals = { 찬성: 0, 반대: 0 };
    GROUP_ORDER.forEach(g => {
      CHOICE_ORDER.forEach(c => {
        const v = data.groups[g][name][c];
        totals[c] += v;
        tr.innerHTML += `<td class="cell-${CHOICE_CLASS[c]}">${v}</td>`;
      });
    });
    CHOICE_ORDER.forEach(c => {
      tr.innerHTML += `<td class="cell-${CHOICE_CLASS[c]} total-cell">${totals[c]}</td>`;
    });

    tbody.appendChild(tr);
  });

  // ---- 맨 아래: 구분별 합계 행 ----
  const totalRow = document.createElement('tr');
  totalRow.className = 'group-total-row';
  totalRow.innerHTML = `<td class="cand-name">구분별 합계</td>`;
  let grandYes = 0, grandNo = 0;
  GROUP_ORDER.forEach(g => {
    const t = groupTotals[g] || { 찬성: 0, 반대: 0 };
    grandYes += t.찬성; grandNo += t.반대;
    CHOICE_ORDER.forEach(c => {
      totalRow.innerHTML += `<td class="cell-${CHOICE_CLASS[c]} total-cell">${t[c]}</td>`;
    });
  });
  totalRow.innerHTML += `<td class="cell-yes total-cell">${grandYes}</td><td class="cell-no total-cell">${grandNo}</td>`;
  tbody.appendChild(totalRow);

  table.appendChild(tbody);
}

function renderResults(data){
  document.getElementById('voteCount').textContent = data.count;
  document.getElementById('totalTarget').textContent = data.total;
  const pct = Math.min(100, Math.round((data.count / data.total) * 100));
  document.getElementById('barFill').style.width = pct + '%';

  buildTable(data);
}

document.getElementById('loginBtn').addEventListener('click', async () => {
  const errBox = document.getElementById('loginErr');
  errBox.style.display = 'none';
  adminKey = document.getElementById('adminKeyInput').value;

  const result = await tryLoad();
  if(!result.ok){
    errBox.textContent = result.error;
    errBox.style.display = 'block';
    return;
  }

  document.getElementById('loginView').style.display = 'none';
  document.getElementById('resultsView').style.display = 'block';
  renderResults(result.data);

  setInterval(async () => {
    const r = await tryLoad();
    if(r.ok) renderResults(r.data);
  }, 5000);
});
