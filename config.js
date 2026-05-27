/**
 * 配置文件
 *
 * 切换部署方式只需修改 BACKEND_MODE：
 *   'gas'   = Google Apps Script（GitHub Pages 部署）
 *   'local' = 本地 Node.js 服务器（运行 node server.js）
 *
 * 本地开发时如需覆盖配置，可在本地创建 config.local.js 并在 HTML 中引用。
 */

// 'gas' = Google Apps Script | 'local' = 本地 Node.js 服务器
const BACKEND_MODE = 'gas';

// Google Apps Script Web App URL（BACKEND_MODE='gas' 时使用）
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyRsT5HNRkKQIF30iPai1Frth5r8-HJrku6HzXfAvfZAPQdwifqXoC82PMv2dwfwLkP/exec';

// 本地服务器地址（BACKEND_MODE='local' 时使用）
const LOCAL_API_URL = 'http://localhost:3000/api';

// 管理员账号名映射：登录名 → 内部 ID
// 修改此处即可更换登录账号名，内部逻辑仍使用 ID（1/2/3）
const ADMIN_ACCOUNTS = {
  'ume01': '1',
  'ume02': '2',
  'ume03': '3',
};

// 工作地点列表
const LOCATIONS = [
  'Ume Amager',
  'Ume Kødbyen',
  'Ume Vanløse',
  'Ume Lager',
  'Ume Lyngby',
  'Comé Kødbyen',
  'Comé Reffen',
];
