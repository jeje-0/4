const CANDIDATES = ["강옥림", "권오윤", "이상길", "이상엽", "최용철", "한삼전", "이삼열"];
let choices = {};
let selectedCategory = '';

function buildCandidateArea(){
  const area = document.getElementById('candidateArea');
  area.innerHTML = '';
  CANDIDATES.forEach(name => {
    const div = document.createElement('div');
    div.className = 'candidate';
    div.innerHTML = `
      <div class="name">${name}</div>
      <div class="toggle">
        <button type="button" data-name="${name}" data-val="찬성">찬성</button>
        <button type="button" data-name="${name}" data-val="반대">반대</button>
        <button type="button" data-name="${name}" data-val="기권">기권</button>
      </div>
    `;
    area.appendChild(div);
  });
  area.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.name, val = btn.dataset.val;
      choices[name] = val;
      area.querySelectorAll(`button[data-name="${name}"]`).forEach(b => {
        b.classList.remove('active-yes','active-no','active-abstain');
      });
      const cls = val === '찬성' ? 'active-yes' : (val === '반대' ? 'active-no' : 'active-abstain');
      btn.classList.add(cls);
      checkSubmitReady();
    });
  });
}

function checkSubmitReady(){
  const allChosen = CANDIDATES.every(n => choices[n]);
  document.getElementById('submitBtn').disabled = !allChosen;
}

// Step 1: category selection
document.getElementById('category').addEventListener('change', (e) => {
  document.getElementById('toStep2Btn').disabled = !e.target.value;
});

document.getElementById('toStep2Btn').addEventListener('click', () => {
  selectedCategory = document.getElementById('category').value;
  document.getElementById('step1').style.display = 'none';
  document.getElementById('step2').style.display = 'block';
  document.getElementById('dot1').classList.remove('active');
  document.getElementById('dot2').classList.add('active');
});

document.getElementById('backBtn').addEventListener('click', () => {
  document.getElementById('step2').style.display = 'none';
  document.getElementById('step1').style.display = 'block';
  document.getElementById('dot2').classList.remove('active');
  document.getElementById('dot1').classList.add('active');
});

function showDone(){
  document.getElementById('formArea').style.display = 'none';
  document.getElementById('doneArea').style.display = 'block';
}

document.getElementById('submitBtn').addEventListener('click', async () => {
  const btn = document.getElementById('submitBtn');
  const errorMsg = document.getElementById('errorMsg');
  errorMsg.style.display = 'none';
  btn.disabled = true;
  btn.textContent = '제출 중...';
  try{
    const res = await fetch('/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: selectedCategory, choices })
    });
    const data = await res.json();
    if(!data.ok) throw new Error(data.error || '제출 실패');

    showDone();
    loadCount();
  }catch(e){
    errorMsg.textContent = '제출에 실패했습니다: ' + e.message;
    errorMsg.style.display = 'block';
    btn.disabled = false;
    btn.textContent = '투표 제출하기';
  }
});

async function loadCount(){
  try{
    const res = await fetch('/api/count');
    const data = await res.json();
    document.getElementById('voteCount').textContent = data.count;
    const pct = Math.min(100, Math.round((data.count / data.total) * 100));
    document.getElementById('barFill').style.width = pct + '%';
  }catch(e){}
}

function init(){
  buildCandidateArea();
  loadCount();
  setInterval(loadCount, 5000);
}
init();
