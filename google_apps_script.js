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
 *   Config       — 系统配置（密码哈希等）
 */

const SHEET_SUBMISSIONS = 'Submissions';
const SHEET_ADMIN_STATE = 'AdminState';
const SHEET_CONFIG      = 'Config';

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

// ── Config (password) ─────────────────────────────────────────────
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

// ── doPost ────────────────────────────────────────────────────────
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    // ── 提交员工班表 ──
    if (!action || action === 'submitSchedule') {
      const sheet = getOrCreateSheet(SHEET_SUBMISSIONS, ['Name','Year','Month','SubmittedAt','ScheduleJSON']);
      const rows = sheet.getDataRange().getValues();
      for (let i = rows.length - 1; i >= 1; i--) {
        if (rows[i][0] === data.name && rows[i][1] === data.year && rows[i][2] === data.month) {
          sheet.deleteRow(i + 1);
        }
      }
      sheet.appendRow([data.name, data.year, data.month, data.submittedAt, JSON.stringify(data.schedule)]);
      return jsonResponse({ success: true });
    }

    // ── 保存管理员排班数据 ──
    if (action === 'saveAdminState') {
      const sheet = getOrCreateSheet(SHEET_ADMIN_STATE, ['UpdatedAt', 'StateJSON']);
      sheet.clearContents();
      sheet.appendRow(['UpdatedAt', 'StateJSON']);
      sheet.appendRow([new Date().toISOString(), JSON.stringify(data.state)]);
      return jsonResponse({ success: true });
    }

    // ── 修改密码 ──
    if (action === 'changePassword') {
      const cfg = getConfig();
      if (sha256(data.oldPassword) !== cfg['passwordHash']) {
        return jsonResponse({ success: false, error: '当前密码错误' });
      }
      setConfigKey('passwordHash', sha256(data.newPassword));
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
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[1] === year && row[2] === month) {
        submissions.push({
          name: row[0], year: row[1], month: row[2],
          submittedAt: row[3], schedule: JSON.parse(row[4] || '[]')
        });
      }
    }
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

  // ── 验证密码 ──
  if (action === 'verifyPassword') {
    const cfg = getConfig();
    const ok = sha256(e.parameter.password) === cfg['passwordHash'];
    return jsonResponse({ success: ok });
  }

  return jsonResponse({ error: 'Unknown action' });
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
