const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'ivf2026admin';
const DATA_FILE = path.join(__dirname, 'votes.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const CANDIDATES = ['이삼열', '강옥림', '권오윤', '이상길', '이상엽', '최용철', '한삼전'];
const TOTAL_TARGET = 75;

// Upstash Redis 환경변수가 설정되어 있으면 그걸 영구 저장소로 사용하고,
// 없으면 로컬 테스트를 위해 votes.json 파일을 그대로 사용합니다.
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const USE_REDIS = Boolean(UPSTASH_URL && UPSTASH_TOKEN);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

async function redisCommand(commandArray) {
  const res = await fetch(UPSTASH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commandArray),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

function readVotesFile() {
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

function appendVoteFile(vote) {
  const votes = readVotesFile();
  votes.push(vote);
  fs.writeFileSync(DATA_FILE, JSON.stringify(votes, null, 2));
}

async function readVotes() {
  if (USE_REDIS) {
    const raw = await redisCommand(['LRANGE', 'votes', '0', '-1']);
    return (raw || []).map((s) => JSON.parse(s));
  }
  return readVotesFile();
}

async function appendVote(vote) {
  if (USE_REDIS) {
    await redisCommand(['RPUSH', 'votes', JSON.stringify(vote)]);
    return;
  }
  appendVoteFile(vote);
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
  req.on('end', async () => {
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

    try {
      await appendVote({ category, choices, ts: Date.now() });
      sendJson(res, 200, { ok: true });
    } catch (e) {
      sendJson(res, 500, { ok: false, error: '저장에 실패했습니다: ' + e.message });
    }
  });
}

async function handleCount(req, res) {
  try {
    const votes = await readVotes();
    sendJson(res, 200, { count: votes.length, total: TOTAL_TARGET });
  } catch (e) {
    sendJson(res, 500, { ok: false, error: '불러오기에 실패했습니다: ' + e.message });
  }
}

async function handleResults(req, res) {
  const key = req.headers['x-admin-key'];
  if (key !== ADMIN_KEY) {
    return sendJson(res, 401, { ok: false, error: '관리자 인증이 필요합니다.' });
  }

  try {
    const votes = await readVotes();
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
  } catch (e) {
    sendJson(res, 500, { ok: false, error: '불러오기에 실패했습니다: ' + e.message });
  }
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
  console.log(USE_REDIS ? '저장소: Upstash Redis (영구 저장)' : '저장소: votes.json 파일 (재배포 시 초기화됨 — 테스트용)');
});
