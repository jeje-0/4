let adminKey = '';

const GROUP_ORDER = ['이사', '간사', '학생·학사'];
const GROUP_LABEL = { '이사': '이사', '간사': '간사', '학생·학사': '학사/학생' };
const CHOICE_ORDER = ['찬성', '반대', '기권'];
const CHOICE_CLASS = { '찬성': 'yes', '반대': 'no', '기권': 'abstain' };

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

  // ---- 헤더 1행: 후보명 / 이사 / 간사 / 학사·학생 / 합계 ----
  const headRow1 = document.createElement('tr');
  headRow1.innerHTML = `<th class="cand-head" rowspan="2">후보명</th>`;
  GROUP_ORDER.forEach(g => {
    headRow1.innerHTML += `<th class="group-head" colspan="3">${GROUP_LABEL[g]}</th>`;
  });
  headRow1.innerHTML += `<th class="group-head total-group" colspan="3">합계</th>`;

  // ---- 헤더 2행: 찬성/반대/기권 반복 ----
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
  thead.appendChild(headRow1);
  thead.appendChild(headRow2);
  table.appendChild(thead);

  // ---- 본문: 후보별 행 ----
  const tbody = document.createElement('tbody');
  data.candidates.forEach(name => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="cand-name">${name}</td>`;

    const totals = { 찬성: 0, 반대: 0, 기권: 0 };
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
