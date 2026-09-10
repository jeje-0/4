const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'ivf2026admin';
const DATA_FILE = path.join(__dirname, 'votes.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const CANDIDATES = ['김길동', '이길동', '박길동', '소길동', '한길동'];
const TOTAL_TARGET = 75;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function readVotes() {
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

function writeVotes(votes) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(votes, null, 2));
}

function groupOf(category) {
  if (category === '학생' || category === '학사') return '학생·학사';
  return category;
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function serveStatic(req, res) {
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(PUBLIC_DIR, filePath.split('?')[0]);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not found');
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function handleVote(req, res) {
  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', () => {
    let payload;
    try {
      payload = JSON.parse(body);
    } catch (e) {
      return sendJson(res, 400, { ok: false, error: '잘못된 요청입니다.' });
    }

    const CHOICES = ['찬성', '반대', '기권'];
    const { category, choices } = payload || {};
    const validCategory = ['학생', '학사', '이사', '간사'].includes(category);
    const validChoices =
      choices && CANDIDATES.every((name) => CHOICES.includes(choices[name]));

    if (!validCategory || !validChoices) {
      return sendJson(res, 400, { ok: false, error: '입력값이 올바르지 않습니다.' });
    }

    const votes = readVotes();
    votes.push({ category, choices, ts: Date.now() });
    writeVotes(votes);

    sendJson(res, 200, { ok: true });
  });
}

function handleCount(req, res) {
  const votes = readVotes();
  sendJson(res, 200, { count: votes.length, total: TOTAL_TARGET });
}

function handleResults(req, res) {
  const key = req.headers['x-admin-key'];
  if (key !== ADMIN_KEY) {
    return sendJson(res, 401, { ok: false, error: '관리자 인증이 필요합니다.' });
  }

  const votes = readVotes();
  const count = votes.length;

  const groups = { '학생·학사': {}, 이사: {}, 간사: {} };
  Object.keys(groups).forEach((g) => {
    CANDIDATES.forEach((name) => {
      groups[g][name] = { 찬성: 0, 반대: 0, 기권: 0 };
    });
  });

  votes.forEach((v) => {
    const g = groupOf(v.category);
    if (!groups[g]) return;
    CANDIDATES.forEach((name) => {
      const c = v.choices[name];
      if (c === '찬성' || c === '반대' || c === '기권') groups[g][name][c]++;
    });
  });

  sendJson(res, 200, { count, total: TOTAL_TARGET, candidates: CANDIDATES, groups });
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/vote') {
    return handleVote(req, res);
  }
  if (req.method === 'GET' && req.url === '/api/count') {
    return handleCount(req, res);
  }
  if (req.method === 'GET' && req.url === '/api/results') {
    return handleResults(req, res);
  }
  return serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`IVF 투표 서버 실행 중: http://localhost:${PORT}`);
});
