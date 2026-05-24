/**
 * 本地 Node.js 后端服务器
 *
 * 提供与 Google Apps Script 相同的 REST 接口，数据存储为本地 JSON 文件。
 * 适合本地开发或自托管部署场景。
 *
 * 使用步骤：
 * 1. 复制配置文件：cp config.example.js config.js，填入 BACKEND_MODE='local'
 * 2. 安装依赖：npm install
 * 3. 启动服务器：node server.js（或 npm start）
 * 4. 访问 http://localhost:3000/admin.html
 *
 * 数据文件保存在 ./data/ 目录，格式：
 *   data/submissions_<year>_<month>.json   员工班表提交
 *   data/admin_state.json                  管理员排班数据（地点标记、排班表等）
 *   data/config.json                       服务器端配置（含管理员密码哈希）
 *   data/emp_accounts.json                 员工账号（姓名 → 密码哈希）
 *   data/schedules.json                    排班表数据（独立存储，按地点+月份）
 */

const express = require('express');
const cors    = require('cors');
const fs      = require('fs');
const path    = require('path');
const crypto  = require('crypto');

const app      = express();
const PORT     = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');

// ── Middleware ──────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ── Helpers ─────────────────────────────────────────────────────
function dataFile(year, month) {
  return path.join(DATA_DIR, `submissions_${year}_${month}.json`);
}
function adminStateFile()   { return path.join(DATA_DIR, 'admin_state.json'); }
function configFile()       { return path.join(DATA_DIR, 'config.json'); }
function empAccountsFile()  { return path.join(DATA_DIR, 'emp_accounts.json'); }
function schedulesFile()    { return path.join(DATA_DIR, 'schedules.json'); }

function readJSON(file, def = null) {
  if (!fs.existsSync(file)) return def;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch(e) { return def; }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function hashPassword(pw) {
  return crypto.createHash('sha256').update(pw).digest('hex');
}

const DEFAULT_PW_HASH = hashPassword('123456');

function getServerConfig() {
  const cfg = readJSON(configFile(), {});
  if (!cfg.passwordHash) cfg.passwordHash = DEFAULT_PW_HASH;
  return cfg;
}
function saveServerConfig(cfg) { writeJSON(configFile(), cfg); }

function readEmpAccounts() {
  return readJSON(empAccountsFile(), {});
}
function saveEmpAccounts(accounts) {
  writeJSON(empAccountsFile(), accounts);
}

// ── GET /api ─────────────────────────────────────────────────────
app.get('/api', (req, res) => {
  const { action, year, month } = req.query;

  // 获取员工班表提交
  if (action === 'getSubmissions') {
    const y = parseInt(year), m = parseInt(month);
    if (isNaN(y) || isNaN(m)) return res.status(400).json({ error: 'Invalid year or month' });
    const all = readJSON(dataFile(y, m), []);
    // 分离 current 和 prev，把 prev 附加到对应 submission 上
    const currents = all.filter(s => s.version !== 'prev');
    const prevMap  = {};
    all.filter(s => s.version === 'prev').forEach(s => { prevMap[s.name] = { schedule: s.schedule, submittedAt: s.submittedAt }; });
    currents.forEach(s => { if (prevMap[s.name]) s.prev = prevMap[s.name]; });
    return res.json({ submissions: currents });
  }

  // 获取管理员排班数据
  if (action === 'getAdminState') {
    const state = readJSON(adminStateFile(), {});
    return res.json({ success: true, state });
  }

  // 验证管理员密码
  if (action === 'verifyPassword') {
    const { password } = req.query;
    const cfg = getServerConfig();
    const ok = hashPassword(password) === cfg.passwordHash;
    return res.json({ success: ok });
  }

  // 获取员工账号列表（员工端登录用）
  if (action === 'getEmpAccounts') {
    const accounts = readEmpAccounts();
    return res.json({ success: true, accounts });
  }

  // 获取排班表（单个地点单月）
  if (action === 'getSchedule') {
    const loc   = req.query.loc;
    const y = parseInt(req.query.year), m = parseInt(req.query.month);
    if (!loc || isNaN(y) || isNaN(m)) return res.status(400).json({ error: 'Invalid params' });
    const all = readJSON(schedulesFile(), []);
    const row = all.find(r => r.loc === loc && r.year === y && r.month === m);
    if (!row) return res.json({ success: true, schedule: null });
    return res.json({ success: true, schedule: row.schedule });
  }

  res.status(400).json({ error: 'Unknown action' });
});

// ── POST /api ─────────────────────────────────────────────────────
app.post('/api', (req, res) => {
  const { action } = req.body;

  // 提交员工班表
  if (action === 'submitSchedule' || !action) {
    try {
      const { name, year, month, submittedAt, schedule, note } = req.body;
      if (!name || !year || !month) return res.status(400).json({ success: false, error: 'Missing fields' });
      const y = parseInt(year), m = parseInt(month);
      const todayStr = new Date().toISOString().slice(0, 10);
      let all = readJSON(dataFile(y, m), []);

      // 找到当前 current 行
      const currentEntry = all.find(s => s.name === name && s.year === y && s.month === m && s.version !== 'prev');
      const currentSchedule = currentEntry ? currentEntry.schedule : null;

      // 删除该员工该月所有旧行（current + prev）
      all = all.filter(s => !(s.name === name && s.year === y && s.month === m));

      if (currentSchedule) {
        // 二次及以后提交：已过去的日期用旧数据，未来日期用新数据
        const mergedSchedule = (schedule || []).map(entry => {
          if (entry.date < todayStr) {
            const oldEntry = currentSchedule.find(e => e.date === entry.date);
            return oldEntry || entry;
          }
          return entry;
        });
        // 旧 current 降为 prev
        const prevEntry = { name, year: y, month: m, version: 'prev', submittedAt: currentEntry.submittedAt, schedule: currentSchedule };
        if (currentEntry.note) prevEntry.note = currentEntry.note;
        all.push(prevEntry);
        // 写入新 current
        const newEntry = { name, year: y, month: m, version: 'current', submittedAt, schedule: mergedSchedule };
        if (note) newEntry.note = note;
        all.push(newEntry);
      } else {
        // 首次提交
        const newEntry = { name, year: y, month: m, version: 'current', submittedAt, schedule: schedule || [] };
        if (note) newEntry.note = note;
        all.push(newEntry);
      }

      writeJSON(dataFile(y, m), all);
      return res.json({ success: true });
    } catch(err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 清除员工提交的 prev 记录（管理员已读后调用）
  if (action === 'clearPrevSubmission') {
    try {
      const { name, year, month } = req.body;
      const y = parseInt(year), m = parseInt(month);
      let all = readJSON(dataFile(y, m), []);
      all = all.filter(s => !(s.name === name && s.year === y && s.month === m && s.version === 'prev'));
      writeJSON(dataFile(y, m), all);
      return res.json({ success: true });
    } catch(err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 保存管理员排班数据
  if (action === 'saveAdminState') {
    try {
      const { state } = req.body;
      if (!state) return res.status(400).json({ success: false, error: 'Missing state' });
      writeJSON(adminStateFile(), state);
      // 同步员工账号到独立文件
      if (state.employeeAccounts) {
        saveEmpAccounts(state.employeeAccounts);
      }
      return res.json({ success: true });
    } catch(err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 保存排班表（单个地点单月）
  if (action === 'saveSchedule') {
    try {
      const { loc, year, month, schedule } = req.body;
      if (!loc || !year || !month) return res.status(400).json({ success: false, error: 'Missing fields' });
      const y = parseInt(year), m = parseInt(month);
      const updatedAt = new Date().toISOString();
      let all = readJSON(schedulesFile(), []);
      const idx = all.findIndex(r => r.loc === loc && r.year === y && r.month === m);
      if (idx >= 0) {
        all[idx] = { loc, year: y, month: m, updatedAt, schedule };
      } else {
        all.push({ loc, year: y, month: m, updatedAt, schedule });
      }
      writeJSON(schedulesFile(), all);
      return res.json({ success: true, updatedAt });
    } catch(err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 删除某员工的所有提交记录
  if (action === 'deleteEmployeeSubmissions') {
    try {
      const { name } = req.body;
      if (!name) return res.status(400).json({ success: false, error: 'Missing name' });
      const files = fs.readdirSync(DATA_DIR).filter(f => f.startsWith('submissions_') && f.endsWith('.json'));
      for (const file of files) {
        const fp = path.join(DATA_DIR, file);
        let subs = readJSON(fp, []);
        const filtered = subs.filter(s => s.name !== name);
        if (filtered.length !== subs.length) writeJSON(fp, filtered);
      }
      return res.json({ success: true });
    } catch(err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 修改管理员密码
  if (action === 'changePassword') {
    try {
      const { oldPassword, newPassword } = req.body;
      const cfg = getServerConfig();
      if (hashPassword(oldPassword) !== cfg.passwordHash) {
        return res.json({ success: false, error: '当前密码错误' });
      }
      cfg.passwordHash = hashPassword(newPassword);
      saveServerConfig(cfg);
      return res.json({ success: true });
    } catch(err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 员工修改自己的密码（传入已哈希的旧密码和新密码）
  if (action === 'changeEmpPassword') {
    try {
      const { name, oldPasswordHash, newPasswordHash } = req.body;
      const accounts = readEmpAccounts();
      if (!accounts[name]) return res.json({ success: false, error: '账号不存在' });
      if (accounts[name].passwordHash !== oldPasswordHash) {
        return res.json({ success: false, error: '当前密码错误' });
      }
      accounts[name].passwordHash = newPasswordHash;
      saveEmpAccounts(accounts);
      return res.json({ success: true });
    } catch(err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 管理员重置员工密码
  if (action === 'resetEmpPassword') {
    try {
      const { name } = req.body;
      const accounts = readEmpAccounts();
      if (!accounts[name]) accounts[name] = {};
      accounts[name].passwordHash = DEFAULT_PW_HASH;
      saveEmpAccounts(accounts);
      return res.json({ success: true });
    } catch(err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 管理员删除员工账号
  if (action === 'deleteEmpAccount') {
    try {
      const { name } = req.body;
      const accounts = readEmpAccounts();
      delete accounts[name];
      saveEmpAccounts(accounts);
      return res.json({ success: true });
    } catch(err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 管理员创建员工账号
  if (action === 'createEmpAccount') {
    try {
      const { name } = req.body;
      const accounts = readEmpAccounts();
      if (!accounts[name]) {
        accounts[name] = { passwordHash: DEFAULT_PW_HASH };
        saveEmpAccounts(accounts);
      }
      return res.json({ success: true });
    } catch(err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  res.status(400).json({ success: false, error: 'Unknown action' });
});

// ── Start ────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ 排班系统本地服务器运行在 http://localhost:${PORT}`);
  console.log(`   数据目录: ${DATA_DIR}`);
  console.log(`   管理员界面: http://localhost:${PORT}/admin.html`);
  console.log(`   员工界面:   http://localhost:${PORT}/schedule_app.html`);
  console.log(`   初始密码: 123456`);
});
