/**
 * Google Apps Script 后端代码
 *
 * 使用步骤：
 * 1. 打开 Google Sheets，创建一个新表格
 * 2. 点击菜单：扩展程序 → Apps Script
 * 3. 将此文件的全部内容粘贴进去，替换原有代码
 * 4. 点击部署 → 新建部署 → 类型选"网络应用"
 *    - 执行身份：我
 *    - 具有访问权限的用户：所有人
 * 5. 复制生成的 Web App URL，填入本地 config.js 的 APPS_SCRIPT_URL
 *
 * Sheet 结构：
 *   Submissions  — 员工班表提交（每行一条）
 *   AdminState   — 管理员排班数据（单行 JSON）
 *   Schedules    — 排班表数据（每行一个地点+月份）
 *   Config       — 系统配置（管理员密码哈希等）
 *   EmpAccounts  — 员工账号（每行一个员工：姓名 + 密码哈希）
 */

const SHEET_SUBMISSIONS  = 'Submissions';
const SHEET_ADMIN_STATE  = 'AdminState';
const SHEET_SCHEDULES    = 'Schedules';
const SHEET_CONFIG       = 'Config';
const SHEET_EMP_ACCOUNTS = 'EmpAccounts';

// SHA-256 哈希（GAS 内置 Utilities）
function sha256(str) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, str);
  return bytes.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

// 默认密码哈希（123456）
const DEFAULT_PW_HASH = sha256('123456');

// ── Sheet helpers ─────────────────────────────────────────────────
function getOrCreateSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (headers) sheet.appendRow(headers);
  }
  return sheet;
}

// ── Config (管理员密码) ───────────────────────────────────────────
function getConfig() {
  const sheet = getOrCreateSheet(SHEET_CONFIG, ['Key', 'Value']);
  const rows = sheet.getDataRange().getValues();
  const cfg = {};
  for (let i = 1; i < rows.length; i++) {
    cfg[rows[i][0]] = rows[i][1];
  }
  if (!cfg['passwordHash']) cfg['passwordHash'] = DEFAULT_PW_HASH;
  return cfg;
}

function setConfigKey(key, value) {
  const sheet = getOrCreateSheet(SHEET_CONFIG, ['Key', 'Value']);
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  sheet.appendRow([key, value]);
}

// 将某员工的密码同步写入 AdminState JSON（保持两个存储源一致）
function syncEmpPasswordToAdminState(name, newPasswordHash) {
  try {
    const adminSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ADMIN_STATE);
    if (!adminSheet || adminSheet.getLastRow() < 2) return;
    const stateJson = adminSheet.getRange(2, 2).getValue();
    if (!stateJson) return;
    const state = JSON.parse(stateJson);
    if (!state.employeeAccounts) state.employeeAccounts = {};
    state.employeeAccounts[name] = { passwordHash: newPasswordHash };
    adminSheet.getRange(2, 1).setValue(new Date().toISOString());
    adminSheet.getRange(2, 2).setValue(JSON.stringify(state));
  } catch(e) {
    // 静默失败，不影响主流程
  }
}

// ── EmpAccounts helpers ───────────────────────────────────────────
function readEmpAccounts() {
  const sheet = getOrCreateSheet(SHEET_EMP_ACCOUNTS, ['Name', 'PasswordHash']);
  const rows = sheet.getDataRange().getValues();
  const accounts = {};
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0]) accounts[rows[i][0]] = { passwordHash: rows[i][1] };
  }
  return accounts;
}

function writeEmpAccounts(accounts) {
  const sheet = getOrCreateSheet(SHEET_EMP_ACCOUNTS, ['Name', 'PasswordHash']);
  const rows = [['Name', 'PasswordHash']];
  for (const [name, acct] of Object.entries(accounts)) {
    rows.push([name, acct.passwordHash || '']);
  }
  sheet.getRange(1, 1, rows.length, 2).setValues(rows);
  if (sheet.getLastRow() > rows.length) {
    sheet.deleteRows(rows.length + 1, sheet.getLastRow() - rows.length);
  }
}

function upsertEmpAccount(name, passwordHash) {
  const sheet = getOrCreateSheet(SHEET_EMP_ACCOUNTS, ['Name', 'PasswordHash']);
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === name) {
      sheet.getRange(i + 1, 2).setValue(passwordHash);
      return;
    }
  }
  sheet.appendRow([name, passwordHash]);
}

function deleteEmpAccount(name) {
  const sheet = getOrCreateSheet(SHEET_EMP_ACCOUNTS, ['Name', 'PasswordHash']);
  const rows = sheet.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    if (rows[i][0] === name) {
      sheet.deleteRow(i + 1);
    }
  }
}

// ── doPost ────────────────────────────────────────────────────────
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    // ── 提交员工班表 ──
    if (!action || action === 'submitSchedule') {
      const sheet = getOrCreateSheet(SHEET_SUBMISSIONS, ['Name','Year','Month','Version','SubmittedAt','ScheduleJSON','Note']);
      const rows = sheet.getDataRange().getValues();
      const todayStr = new Date().toISOString().slice(0, 10);

      let currentRowIdx = -1;
      let prevRowIdx    = -1;
      let currentSchedule = null;
      for (let i = rows.length - 1; i >= 1; i--) {
        if (rows[i][0] === data.name && rows[i][1] === data.year && rows[i][2] === data.month) {
          const ver = rows[i][3];
          if (ver === 'prev' && prevRowIdx === -1) prevRowIdx = i + 1;
          else if (ver !== 'prev' && currentRowIdx === -1) {
            currentRowIdx = i + 1;
            try { currentSchedule = JSON.parse(rows[i][5] || rows[i][4] || '[]'); } catch(e) { currentSchedule = []; }
          }
        }
      }

      if (currentRowIdx === -1) {
        sheet.appendRow([data.name, data.year, data.month, 'current', data.submittedAt, JSON.stringify(data.schedule), data.note || '']);
      } else {
        const mergedSchedule = (data.schedule || []).map(entry => {
          if (entry.date < todayStr) {
            const oldEntry = (currentSchedule || []).find(e => e.date === entry.date);
            return oldEntry || entry;
          }
          return entry;
        });

        if (prevRowIdx !== -1) {
          const delFirst  = Math.max(prevRowIdx, currentRowIdx);
          const delSecond = Math.min(prevRowIdx, currentRowIdx);
          sheet.deleteRow(delFirst);
          sheet.deleteRow(delSecond);
        } else {
          sheet.deleteRow(currentRowIdx);
        }

        const oldNote = prevRowIdx !== -1
          ? (rows[Math.min(prevRowIdx, currentRowIdx) - 1][6] || '')
          : (rows[currentRowIdx - 1][6] || rows[currentRowIdx - 1][5] || '');
        const oldSubmittedAt = rows[currentRowIdx - 1][4] || rows[currentRowIdx - 1][3] || '';
        sheet.appendRow([data.name, data.year, data.month, 'prev', oldSubmittedAt, JSON.stringify(currentSchedule), oldNote]);
        sheet.appendRow([data.name, data.year, data.month, 'current', data.submittedAt, JSON.stringify(mergedSchedule), data.note || '']);
      }
      return jsonResponse({ success: true });
    }

    // ── 清除员工提交的 prev 记录 ──
    if (action === 'clearPrevSubmission') {
      const { name, year, month } = data;
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SUBMISSIONS);
      if (!sheet) return jsonResponse({ success: true });
      const rows = sheet.getDataRange().getValues();
      for (let i = rows.length - 1; i >= 1; i--) {
        if (rows[i][0] === name && rows[i][1] === year && rows[i][2] === month && rows[i][3] === 'prev') {
          sheet.deleteRow(i + 1);
        }
      }
      return jsonResponse({ success: true });
    }

    // ── 保存管理员排班数据 ──
    if (action === 'saveAdminState') {
      const sheet = getOrCreateSheet(SHEET_ADMIN_STATE, ['UpdatedAt', 'StateJSON']);
      const stateJson = JSON.stringify(data.state);
      if (sheet.getLastRow() < 1) {
        sheet.appendRow(['UpdatedAt', 'StateJSON']);
      } else {
        sheet.getRange(1, 1, 1, 2).setValues([['UpdatedAt', 'StateJSON']]);
      }
      if (sheet.getLastRow() < 2) {
        sheet.appendRow([new Date().toISOString(), stateJson]);
      } else {
        sheet.getRange(2, 1, 1, 2).setValues([[new Date().toISOString(), stateJson]]);
      }
      if (sheet.getLastRow() > 2) {
        sheet.deleteRows(3, sheet.getLastRow() - 2);
      }
      if (data.state && data.state.employeeAccounts) {
        writeEmpAccounts(data.state.employeeAccounts);
      }
      return jsonResponse({ success: true });
    }

    // ── 保存排班表（单个地点单月）──
    if (action === 'saveSchedule') {
      const { loc, year, month, schedule } = data;
      const sheet = getOrCreateSheet(SHEET_SCHEDULES, ['Loc','Year','Month','UpdatedAt','ScheduleJSON']);
      const rows = sheet.getDataRange().getValues();
      const schedJson = JSON.stringify(schedule);
      const updatedAt = new Date().toISOString();
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === loc && rows[i][1] === year && rows[i][2] === month) {
          sheet.getRange(i + 1, 4, 1, 2).setValues([[updatedAt, schedJson]]);
          return jsonResponse({ success: true });
        }
      }
      sheet.appendRow([loc, year, month, updatedAt, schedJson]);
      return jsonResponse({ success: true });
    }

    // ── 删除某员工的所有提交记录 ──
    if (action === 'deleteEmployeeSubmissions') {
      const name = data.name;
      const sheet = getOrCreateSheet(SHEET_SUBMISSIONS, ['Name','Year','Month','SubmittedAt','ScheduleJSON']);
      const rows = sheet.getDataRange().getValues();
      for (let i = rows.length - 1; i >= 1; i--) {
        if (rows[i][0] === name) sheet.deleteRow(i + 1);
      }
      return jsonResponse({ success: true });
    }

    // ── 修改管理员密码 ──
    if (action === 'changePassword') {
      const cfg = getConfig();
      if (sha256(data.oldPassword) !== cfg['passwordHash']) {
        return jsonResponse({ success: false, error: '当前密码错误' });
      }
      setConfigKey('passwordHash', sha256(data.newPassword));
      return jsonResponse({ success: true });
    }

    // ── 员工修改自己的密码 ──
    if (action === 'changeEmpPassword') {
      const { name, oldPasswordHash, newPasswordHash } = data;
      const accounts = readEmpAccounts();
      if (!accounts[name]) return jsonResponse({ success: false, error: '账号不存在' });
      if (accounts[name].passwordHash !== oldPasswordHash) {
        return jsonResponse({ success: false, error: '当前密码错误' });
      }
      upsertEmpAccount(name, newPasswordHash);
      syncEmpPasswordToAdminState(name, newPasswordHash);
      return jsonResponse({ success: true });
    }

    // ── 管理员重置员工密码 ──
    if (action === 'resetEmpPassword') {
      const { name } = data;
      upsertEmpAccount(name, DEFAULT_PW_HASH);
      syncEmpPasswordToAdminState(name, DEFAULT_PW_HASH);
      return jsonResponse({ success: true });
    }

    // ── 管理员删除员工账号 ──
    if (action === 'deleteEmpAccount') {
      deleteEmpAccount(data.name);
      return jsonResponse({ success: true });
    }

    // ── 管理员创建员工账号 ──
    if (action === 'createEmpAccount') {
      const { name } = data;
      upsertEmpAccount(name, DEFAULT_PW_HASH);
      return jsonResponse({ success: true });
    }

    return jsonResponse({ success: false, error: 'Unknown action' });

  } catch(err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

// ── doGet ─────────────────────────────────────────────────────────
function doGet(e) {
  const action = e.parameter.action;

  // ── 获取员工班表提交 ──
  if (action === 'getSubmissions') {
    const year  = parseInt(e.parameter.year);
    const month = parseInt(e.parameter.month);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SUBMISSIONS);
    if (!sheet) return jsonResponse({ submissions: [] });
    const rows = sheet.getDataRange().getValues();
    const submissions = [];
    const prevMap = {};
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[1] === year && row[2] === month) {
        const hasVersion = row[3] === 'current' || row[3] === 'prev';
        if (hasVersion) {
          if (row[3] === 'prev') {
            prevMap[row[0]] = { schedule: JSON.parse(row[5] || '[]'), submittedAt: row[4] };
          } else {
            const entry = { name: row[0], year: row[1], month: row[2], submittedAt: row[4], schedule: JSON.parse(row[5] || '[]') };
            if (row[6]) entry.note = row[6];
            submissions.push(entry);
          }
        } else {
          const entry = { name: row[0], year: row[1], month: row[2], submittedAt: row[3], schedule: JSON.parse(row[4] || '[]') };
          if (row[5]) entry.note = row[5];
          submissions.push(entry);
        }
      }
    }
    submissions.forEach(s => {
      if (prevMap[s.name]) s.prev = prevMap[s.name];
    });
    return jsonResponse({ submissions });
  }

  // ── 获取管理员排班数据 ──
  if (action === 'getAdminState') {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ADMIN_STATE);
    if (!sheet || sheet.getLastRow() < 2) return jsonResponse({ success: true, state: {} });
    const stateJson = sheet.getRange(2, 2).getValue();
    const state = stateJson ? JSON.parse(stateJson) : {};
    return jsonResponse({ success: true, state });
  }

  // ── 验证管理员密码 ──
  if (action === 'verifyPassword') {
    const cfg = getConfig();
    const ok = sha256(e.parameter.password) === cfg['passwordHash'];
    return jsonResponse({ success: ok });
  }

  // ── 获取员工账号列表 ──
  if (action === 'getEmpAccounts') {
    const adminSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ADMIN_STATE);
    if (adminSheet && adminSheet.getLastRow() >= 2) {
      try {
        const stateJson = adminSheet.getRange(2, 2).getValue();
        const state = stateJson ? JSON.parse(stateJson) : {};
        if (state.employeeAccounts && Object.keys(state.employeeAccounts).length > 0) {
          writeEmpAccounts(state.employeeAccounts);
          return jsonResponse({ success: true, accounts: state.employeeAccounts });
        }
      } catch(e) {}
    }
    const accounts = readEmpAccounts();
    return jsonResponse({ success: true, accounts });
  }

  // ── 获取排班表（单个地点单月）──
  if (action === 'getSchedule') {
    const loc   = e.parameter.loc;
    const year  = parseInt(e.parameter.year);
    const month = parseInt(e.parameter.month);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SCHEDULES);
    if (!sheet || sheet.getLastRow() < 2) return jsonResponse({ success: true, schedule: null });
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === loc && rows[i][1] === year && rows[i][2] === month) {
        try {
          const schedule = JSON.parse(rows[i][4] || '{}');
          return jsonResponse({ success: true, schedule });
        } catch(err) {
          return jsonResponse({ success: true, schedule: null });
        }
      }
    }
    return jsonResponse({ success: true, schedule: null });
  }

  return jsonResponse({ error: 'Unknown action' });
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
