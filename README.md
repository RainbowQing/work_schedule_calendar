# 排班系统 — Work Schedule Calendar

员工在线提交可工作时间，管理员进行排班安排的 Web 系统。

🌐 **在线访问**
- 员工界面：[schedule_app.html](https://rainbowqing.github.io/work_schedule_calendar/schedule_app.html)
- 管理员界面：[admin.html](https://rainbowqing.github.io/work_schedule_calendar/admin.html)（默认密码：`123456`）

---

## 目录

- [文件结构](#文件结构)
- [部署方式](#部署方式)
  - [方式一：GitHub Pages + Google Apps Script（推荐）](#方式一github-pages--google-apps-script推荐)
  - [方式二：本地 Node.js 服务器](#方式二本地-nodejs-服务器)
- [员工使用方法](#员工使用方法)
- [管理员使用方法](#管理员使用方法)
- [常见问题](#常见问题)

---

## 文件结构

| 文件名 | 类型 | 说明 |
|--------|------|------|
| `schedule_app.html` | 员工前端 | 员工填写可工作时间并提交班表的页面。支持选择工作时段（上午/下午）、设置默认规则、查看排班结果。 |
| `admin.html` | 管理员前端 | 管理员排班操作界面。包含班表提交查看、员工地点标记、每周排班表格编辑、自动排班、确认排班等功能。 |
| `config.js` | 前端配置 | 存放 `BACKEND_MODE`、`APPS_SCRIPT_URL`、`LOCATIONS` 等配置。切换部署方式只需修改此文件。 |
| `config.example.js` | 配置模板 | `config.js` 的结构说明，展示所有可配置项。 |
| `server.js` | 本地后端服务器 | Node.js/Express 服务器，提供与 Google Apps Script 相同的 REST 接口，数据存储于本地 JSON 文件。本地部署时使用。 |
| `google_apps_script.js` | Google 云端后端 | 部署到 Google Apps Script 的后端脚本，数据存储于 Google Sheets（Submissions、AdminState、Config 三个 sheet）。GitHub Pages 部署时使用。 |
| `package.json` | Node 依赖配置 | 本地部署所需的 npm 依赖声明（express、cors），运行 `npm install` 安装。 |
| `data/` | 本地数据目录 | 本地部署时自动创建，存放员工班表 JSON 文件、管理员排班数据和密码配置。 |

---

## 部署方式

所有配置集中在 **`config.js`** 中，切换部署方式只需修改其中的 `BACKEND_MODE`。

| | GitHub Pages + Google Apps Script | 本地 Node.js 服务器 |
|---|---|---|
| 适用场景 | 生产环境、团队公开访问 | 本地开发、内网部署 |
| 需要服务器 | 否（GitHub + Google 免费托管） | 是（Node.js 环境） |
| 数据存储 | Google Sheets（3个sheet） | 本地 JSON 文件（`data/`） |
| 密码存储 | Google Sheets Config sheet | `data/config.json`（SHA-256哈希） |
| 管理员数据 | Google Sheets AdminState sheet | `data/admin_state.json` |
| `BACKEND_MODE` 值 | `'gas'` | `'local'` |
| 离线使用 | 不支持 | 支持 |

---

### 方式一：GitHub Pages + Google Apps Script（推荐）

前端部署在 GitHub Pages，后端使用 Google Apps Script，数据存储在 Google Sheets。无需服务器，适合公开访问的生产环境。

#### 第一步：设置 Google Sheets 后端

1. 打开 [Google Sheets](https://sheets.google.com)，新建一个表格
2. 点击菜单：**扩展程序 → Apps Script**
3. 将 `google_apps_script.js` 的内容粘贴进去，替换原有代码
4. 点击 **部署 → 新建部署**，类型选「网络应用」
5. 执行身份选「我」，访问权限选「所有人」，点击部署
6. 复制生成的 **Web App URL**

> **注意：** 每次修改 `google_apps_script.js` 后需要重新部署（新建部署或编辑现有部署），否则改动不生效。

#### 第二步：配置 config.js

打开 `config.js`，修改以下两项：

```js
const BACKEND_MODE = 'gas';
const APPS_SCRIPT_URL = '你的 Web App URL';
```

#### 第三步：推送到 GitHub 并启用 Pages

1. 将所有文件推送到 GitHub 仓库的 `main` 分支
2. 在仓库 **Settings → Pages** 中启用 GitHub Pages，选择 `main` 分支
3. 访问 `https://用户名.github.io/仓库名/schedule_app.html` 即可使用

> **注意：** GitHub Pages 有约 5–10 分钟的缓存延迟，更新后请用 `Ctrl+Shift+R` 强制刷新浏览器。

---

### 方式二：本地 Node.js 服务器

在本地或私有服务器上运行 Node.js，数据以 JSON 文件形式存储在 `data/` 目录。适合内网部署或开发调试。

#### 第一步：修改 config.js

```js
const BACKEND_MODE = 'local';
```

#### 第二步：安装并启动

确保已安装 Node.js（v16 及以上），在项目目录下运行：

```bash
npm install
npm start
```

服务器启动后，在浏览器中访问：

```
http://localhost:3000/admin.html          # 管理员界面
http://localhost:3000/schedule_app.html   # 员工界面
```

> **数据文件** 保存在项目目录下的 `data/` 文件夹，可直接备份或迁移。初始密码为 `123456`。

---

## 员工使用方法

通过 `schedule_app.html` 提交下个月的可工作时间。

### 1. 填写姓名

进入页面后，在左上角的「名称」输入框中填写自己的姓名。姓名会自动保存，下次访问无需重填。

### 2. 设置排班规则（可选）

在日历上方的「排班逻辑」区域设置每周默认工作偏好：

- **选择工作时段**：勾选默认上班的时段（上午/下午/全天），系统自动将所有工作日标记为可工作
- **选择休息时段**：先勾选全天可工作，再标记不想工作的时段
- **每天规则**：可为周一至周日分别设置默认时段

设置后点击「应用规则」，规则会自动填充到下个月日历中。

### 3. 在日历上标记可工作时间

每天有两个格子，分别代表上午和下午：

- 点击格子切换状态：**粉色** = 上午可工作，**蓝色** = 下午可工作，**灰色** = 休息
- 可在规则自动填充的基础上手动调整个别日期

### 4. 查看排班结果

点击顶部「排班结果」标签，可查看管理员已安排的当月或下个月排班表。

### 5. 提交班表

1. 确认日历填写无误后，点击右下角「提交班表」按钮
2. 在弹窗中确认姓名和月份
3. 点击「确认提交」完成提交

提交成功后会显示绿色提示。每个月可重复提交，新提交会覆盖旧记录。

> **注意：** 系统仅允许提交下个月的班表，当月已过期的月份无法提交。

---

## 管理员使用方法

通过 `admin.html` 进行排班管理。**初始密码为 `123456`**，建议首次登录后修改。

所有管理员操作数据（地点标记、排班表、员工顺序等）均持久化保存到后端，清除浏览器缓存不会丢失数据。

### 登录

访问 `admin.html`，输入管理员密码。首次使用可在登录后点击「修改密码」设置新密码。

> 密码以 SHA-256 哈希形式存储在服务器端（GAS 模式存 Google Sheets，本地模式存 `data/config.json`）。

---

### 标签页一：班表提交

查看员工提交的可工作时间：

- 通过顶部月份选择器切换查看月份，点击「刷新」从后端重新加载数据
- 表格显示每位员工的提交时间、可工作天数和时段分布
- 点击员工行可展开查看详细的日历视图
- 若有员工未分配地点，页面顶部会出现黄色提示，需前往「地点标记」处理

---

### 标签页二：地点标记

为每位员工分配工作地点：

- 表格显示所有提交过班表的员工及其各地点的分配状态
- 点击格子勾选/取消该员工在该地点的工作资格（一名员工可分配到多个地点）
- 取消某地点时，该员工在该地点的当月排班数据会同步清除

---

### 标签页三：排班

核心排班操作界面，按地点和周次组织。

#### 手动排班

- 点击格子添加或移除该员工该时段的排班
- 同一时段已有排班时，格子颜色加深（第1人深蓝，第2人绿色）
- 同一员工在其他地点已有排班时，格子显示冲突标记（⚠）

#### 每周操作按钮

| 按钮 | 说明 |
|------|------|
| ⚡ 自动排班 | 根据员工提交的可工作时间，自动填充本周排班 |
| 🗑️ 清空班表 | 清除本周所有排班记录 |
| ✅ 确认排班 | 锁定本周排班，防止误操作修改 |
| 🔓 已确认 | 点击可解锁已确认的周次，恢复编辑 |

确认后的格子显示金色边框。可在「⚙️ 设置」→「已确认班次管理」中批量解锁。

#### 员工管理（编辑员工）

点击「✏️ 编辑员工」进入编辑模式：

- 移除当前地点的员工（其排班数据同步删除）
- 从已提交班表但未分配该地点的员工中临时添加
- 员工顺序支持拖拽排序，排序结果自动保存

#### 设置面板

点击「⚙️ 设置」可配置：

- **每班人数上限**：设置各时段最多排几人
- **已确认班次管理**：查看和解锁所有已确认的周次

---

## 常见问题

**Q：更新文件后，GitHub Pages 显示的还是旧版本？**

GitHub Pages 有最长 10 分钟的 CDN 缓存。推送后等待几分钟，然后按 `Ctrl+Shift+R`（Mac：`Cmd+Shift+R`）强制刷新。

---

**Q：管理员密码忘记了怎么办？**

- **本地模式**：删除 `data/config.json` 文件，重启服务器，密码恢复为 `123456`
- **GAS 模式**：在 Google Sheets 中找到 `Config` sheet，删除 `passwordHash` 那行，下次登录时系统会使用默认密码 `123456`

---

**Q：修改了 google_apps_script.js，为什么后端没有更新？**

每次修改脚本后必须重新部署：Apps Script → 部署 → 管理部署 → 编辑（点击铅笔图标）→ 版本选「新版本」→ 部署。URL 不变，但代码会更新。

---

**Q：排班数据能导出吗？**

- **GitHub Pages 部署**：数据在 Google Sheets 中，可直接导出为 Excel 或 CSV
- **本地部署**：数据在 `data/` 目录下的 JSON 文件中，可直接查看或用脚本转换

---

**Q：如何添加或修改工作地点？**

打开 `config.js`，修改 `LOCATIONS` 数组后重新部署：

```js
const LOCATIONS = ['地点A', '地点B', '地点C'];
```

---

**Q：本地服务器启动失败？**

- 确认已安装 Node.js v16 及以上（运行 `node --version` 查看）
- 确认已在项目目录下运行 `npm install`
- 确认 3000 端口未被占用（可修改 `server.js` 中的 `PORT` 变量）
