let adminKey = '';

const GROUP_ORDER = ['학생·학사', '이사', '간사'];
const CHOICE_ORDER = ['기권', '반대', '찬성']; // 왼쪽 -> 오른쪽 (게이지), 컬럼 순서는 별도 지정
const COLUMN_ORDER = ['찬성', '반대', '기권'];

const GAUGE_COLOR = { 찬성: '#2a6e47', 반대: '#e0c800', 기권: '#e05a97' };

// 각 컬럼(찬성/반대/기권)의 그룹별 색상 (아래: 학생·학사(진함) -> 이사(중간) -> 간사(연함, 위))
const STACK_COLORS = {
  찬성: { '학생·학사': '#2a6e47', '이사': '#6fae82', '간사': '#c3ddca' },
  반대: { '학생·학사': '#c9b400', '이사': '#e0c800', '간사': '#f5eeb0' },
  기권: { '학생·학사': '#c2477b', '이사': '#e05a97', '간사': '#f8c9de' },
};

async function tryLoad(){
  try{
    const res = await fetch('/api/results', {
      headers: { 'x-admin-key': adminKey }
    });
    if(res.status === 401){
      return { ok: false, error: '비밀번호가 올바르지 않습니다.' };
    }
    const data = await res.json();
    return { ok: true, data };
  }catch(e){
    return { ok: false, error: '불러오기에 실패했습니다.' };
  }
}

function polar(cx, cy, r, angleDeg){
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

function arcPath(cx, cy, r, startAngle, endAngle){
  const start = polar(cx, cy, r, startAngle);
  const end = polar(cx, cy, r, endAngle);
  const largeArc = Math.abs(startAngle - endAngle) > 180 ? 1 : 0;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

function buildGaugeSVG(totals){
  const cx = 160, cy = 150, r = 118, strokeW = 34;
  const total = totals['찬성'] + totals['반대'] + totals['기권'];

  let angleCursor = 180;
  let segs = '';
  let labels = '';

  if(total === 0){
    segs += `<path d="${arcPath(cx, cy, r, 180, 0)}" stroke="#e4ddd0" stroke-width="${strokeW}" fill="none" stroke-linecap="round"/>`;
  } else {
    CHOICE_ORDER.forEach(key => {
      const count = totals[key];
      if(count <= 0) return;
      const sweep = 180 * (count / total);
      const endAngle = angleCursor - sweep;
      const path = arcPath(cx, cy, r, angleCursor, endAngle);
      segs += `<path d="${path}" stroke="${GAUGE_COLOR[key]}" stroke-width="${strokeW}" fill="none" stroke-linecap="butt"/>`;

      const midAngle = (angleCursor + endAngle) / 2;
      const labelPt = polar(cx, cy, r + 34, midAngle);
      labels += `<text x="${labelPt.x.toFixed(1)}" y="${labelPt.y.toFixed(1)}" text-anchor="middle" font-size="15" font-weight="800" fill="${GAUGE_COLOR[key]}">${key}</text>`;
      labels += `<text x="${labelPt.x.toFixed(1)}" y="${(labelPt.y+17).toFixed(1)}" text-anchor="middle" font-size="15" font-weight="800" fill="${GAUGE_COLOR[key]}">${count}표</text>`;

      angleCursor = endAngle;
    });
  }

  return `<svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg">${segs}${labels}</svg>`;
}

function buildStackChart(groups, candidateName){
  const MAX_H = 150;

  // 컬럼별(찬성/반대/기권) 총합
  const colTotals = {};
  COLUMN_ORDER.forEach(col => {
    colTotals[col] = GROUP_ORDER.reduce((sum, g) => sum + groups[g][candidateName][col], 0);
  });
  const grandTotal = COLUMN_ORDER.reduce((s, c) => s + colTotals[c], 0) || 1;

  let html = '<div class="stack-chart">';
  COLUMN_ORDER.forEach(col => {
    const colTotal = colTotals[col];
    const colHeight = Math.round((colTotal / grandTotal) * MAX_H);

    let segHtml = '';
    // DOM 순서: 위(간사) -> 아래(학생·학사). flex justify-content:flex-end 로 바닥 정렬.
    ['간사', '이사', '학생·학사'].forEach(g => {
      const subCount = groups[g][candidateName][col];
      if(subCount <= 0) return;
      const segH = colTotal > 0 ? Math.max(2, Math.round((subCount / colTotal) * colHeight)) : 0;
      segHtml += `<div class="stack-seg" style="height:${segH}px;background:${STACK_COLORS[col][g]};">${g}<br>${subCount}표</div>`;
    });

    html += `
      <div class="stack-col">
        <div class="stack-bar"><div style="height:${MAX_H - colHeight}px;flex:none;"></div>${segHtml}</div>
        <div class="stack-col-label">${col}</div>
        <div class="stack-col-total">총 ${colTotal}표</div>
      </div>
    `;
  });
  html += '</div>';
  return html;
}

function renderResults(data){
  document.getElementById('voteCount').textContent = data.count;
  const pct = Math.min(100, Math.round((data.count / data.total) * 100));
  document.getElementById('barFill').style.width = pct + '%';

  const area = document.getElementById('candidatesArea');
  area.innerHTML = '';

  data.candidates.forEach(name => {
    const totals = { 찬성: 0, 반대: 0, 기권: 0 };
    GROUP_ORDER.forEach(g => {
      totals['찬성'] += data.groups[g][name]['찬성'];
      totals['반대'] += data.groups[g][name]['반대'];
      totals['기권'] += data.groups[g][name]['기권'];
    });

    const block = document.createElement('div');
    block.className = 'candidate-block';
    block.innerHTML = `
      <div class="gauge-wrap">${buildGaugeSVG(totals)}</div>
      ${buildStackChart(data.groups, name)}
      <div class="candidate-name">${name}</div>
      <div class="legend-row">
        <div class="legend-item"><span class="legend-dot" style="background:#2a6e47;"></span>학생·학사</div>
        <div class="legend-item"><span class="legend-dot" style="background:#6fae82;"></span>이사</div>
        <div class="legend-item"><span class="legend-dot" style="background:#c3ddca;"></span>간사</div>
      </div>
    `;
    area.appendChild(block);
  });
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
