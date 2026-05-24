/**
 * 配置文件模板
 *
 * 此文件展示所有可配置项及其说明。
 * 实际配置在 config.js 中修改，两个文件结构相同。
 *
 * 本地切换为 Node.js 模式：将 config.js 中的 BACKEND_MODE 改为 'local'
 */

// 'gas'   = Google Apps Script（适合 GitHub Pages 公开部署）
// 'local' = 本地 Node.js 服务器（运行 node server.js）
const BACKEND_MODE = 'gas';

// Google Apps Script Web App URL（BACKEND_MODE='gas' 时使用）
// 将 google_apps_script.js 部署为 Google Web App 后，填入生成的 URL
const APPS_SCRIPT_URL = 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE';

// 本地服务器地址（BACKEND_MODE='local' 时使用）
// 默认 localhost:3000，如修改了 server.js 中的 PORT 则同步修改
const LOCAL_API_URL = 'http://localhost:3000/api';

// 工作地点列表（修改后 admin.html 自动同步）
const LOCATIONS = [
  'Ume Amager',
  'Ume Kødbyen',
  'Ume Vanløse',
  'Ume Lager',
  'Ume Lyngby',
  'Comé Kødbyen',
  'Comé Reffen',
];
