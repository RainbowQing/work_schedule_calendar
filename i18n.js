// ── i18n.js ── 中英双语支持
// 使用方式：t('key') 返回当前语言的字符串
// HTML 静态文字：加 data-i18n="key" 属性，applyI18n() 会批量替换
// 语言切换：setLang('zh'|'en')

const I18N = {
  zh: {
    // ── 通用 ──
    lang_zh: '中文',
    lang_en: 'English',
    save: '保存',
    cancel: '取消',
    confirm: '确认',
    close: '关闭',
    loading: '加载中…',
    refresh: '刷新',
    logout: '退出',
    unknown_error: '未知错误',

    // ── 员工端 登录 ──
    emp_login_title: '员工班表',
    emp_login_sub: 'Ume & Comé 排班系统',
    emp_login_name_ph: '姓名',
    emp_login_pw_ph: '密码',
    emp_login_btn: '登录',
    emp_login_verifying: '验证中…',
    emp_login_no_account: '账号不存在，请联系管理员创建账号',
    emp_login_wrong_pw: '密码错误',
    emp_login_enter_name: '请输入姓名',
    emp_login_enter_pw: '请输入密码',

    // ── 员工端 导航 ──
    nav_schedule: '班表',
    nav_roster: '可工作时段',
    nav_change_pw: '修改密码',
    nav_logout: '退出',
    nav_logout_title: '退出登录',
    nav_change_pw_title: '修改密码',

    // ── 员工端 修改密码 ──
    cpw_title: '🔑 修改密码',
    cpw_old_ph: '当前密码',
    cpw_new_ph: '新密码（至少4位）',
    cpw_new2_ph: '再次输入新密码',
    cpw_submit: '确认修改',
    cpw_fill_all: '请填写所有字段',
    cpw_min4: '新密码至少4位',
    cpw_mismatch: '两次输入的新密码不一致',
    cpw_wrong_old: '当前密码错误',
    cpw_success: '密码修改成功，请重新登录',

    // ── 员工端 日历 ──
    cal_hint_current_with_prev: '本月 · 已过去的日期自动沿用上次提交数据，仅可编辑今天及之后的日期',
    cal_hint_current_no_prev: '本月 · 仅可编辑今天及之后的日期（无历史提交，过去日期默认休息）',
    cal_hint_next: '下月 · 请填写下个月可工作时间',
    cal_tab_current: '本月',
    cal_tab_next: '下月',
    cal_wd_0: '一', cal_wd_1: '二', cal_wd_2: '三', cal_wd_3: '四',
    cal_wd_4: '五', cal_wd_5: '六', cal_wd_6: '日',
    cal_legend_am: '上午可工作',
    cal_legend_pm: '下午可工作',
    cal_legend_full: '全天可工作',
    cal_legend_half: '半天可工作',
    cal_legend_off: '休息',
    cal_hint_click_date: '点击日期可手动覆盖排班',
    settings_day_hint: '点击星期设置可工作时段，再次点击切换全天／半天／清除：',
    cal_clear_all: '🔄 全部清除',
    override_select_label: '选择该日排班：',
    override_restore_default: '↩ 恢复默认',
    cal_slot_full: '全天',
    cal_slot_half: '半天',
    cal_slot_off: '休息',
    cal_slot_custom: '自定义',
    cal_day_off: '休息',
    cal_days: ['一','二','三','四','五','六','日'],
    cal_months: ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'],
    cal_override_title: '修改 {date}',

    // ── 员工端 设置 ──
    settings_full_day: '全天时段',
    settings_half_day: '半天时段',
    settings_start: '开始',
    settings_end: '结束',
    settings_rule: '规则设置',
    settings_rule_preview_empty: '（尚未设置任何规则，所有日期默认休息）',
    settings_rule_preview: '默认：{days} 工作',
    settings_generate: '生成班表 →',

    // ── 员工端 自定义时间 ──
    custom_time_start: '开始',
    custom_time_end: '结束',
    custom_time_start_ph: '如 09:00',
    custom_time_end_ph: '如 24:00',
    custom_time_invalid: '请填写有效的开始和结束时间（格式 HH:MM，可输入 24:00）',
    custom_time_order: '结束时间必须晚于开始时间',

    // ── 员工端 备注 ──
    note_label: '💬 备注说明（选填）',
    note_ph: '可在此填写本次填写说明或修改说明，管理员可见…',

    // ── 员工端 提交 ──
    submit_btn: '提交班表',
    submit_modal_title: '📋 确认提交班表',
    submit_confirm_btn: '确认提交',
    submit_submitting: '提交中…',
    submit_no_roster: '请先生成班表再提交。',
    submit_no_login: '请先登录后再提交班表。',
    submit_no_backend: '⚠️ 尚未配置 Google Sheets 连接。请联系管理员设置后端接口。',
    submit_waiting: '⏳ 正在提交，请稍候…',
    submit_success: '✅ 班表已成功提交！管理员将在排班时参考您的可工作时段。',
    submit_fail: '❌ 提交失败：{error}',
    submit_network_fail: '❌ 提交失败，请检查网络连接后重试。',

    // ── 员工端 班表视图 ──
    roster_title: '{year}年{month} · {name}的可工作时段',
    roster_available: '可工作时段',

    // ── 员工端 导出 ──
    export_safari_alert: '请在 Safari 设置中允许弹出式窗口',
    export_fail: '导出失败，请重试',
    export_long_press: '长按图片 → 存储到照片',

    // ── 管理员端 通用 ──
    admin_title: '排班管理后台',
    admin_loading: '加载数据中…',

    // ── 管理员端 登录 ──
    admin_login_title: '排班管理后台',
    admin_login_pw_ph: '管理员密码',
    admin_login_btn: '登录',
    admin_login_verifying: '验证中…',
    admin_login_wrong: '密码错误',
    admin_login_enter_pw: '请输入密码',

    // ── 管理员端 导航标签 ──
    tab_employees: '👥 员工管理',
    tab_submissions: '📋 员工提交',
    tab_locations: '📍 地点标记',
    tab_scheduling: '🗓️ 排班',

    // ── 管理员端 员工管理 ──
    emp_mgmt_title: '👥 员工管理',
    emp_mgmt_subtitle: '管理在职员工账号。新建员工后员工可用姓名和默认密码（123456）登录员工端。',
    emp_mgmt_new_ph: '输入员工姓名',
    emp_mgmt_new_btn: '＋ 新建员工',
    emp_mgmt_col_name: '姓名',
    emp_mgmt_col_location: '工作地点',
    emp_mgmt_col_account: '登录账号',
    emp_mgmt_col_action: '操作',
    emp_mgmt_no_loc: '未分配地点',
    emp_mgmt_has_account: '✅ 已创建',
    emp_mgmt_no_account: '—',
    emp_mgmt_reset_pw: '重置密码',
    emp_mgmt_create_account: '创建账号',
    emp_mgmt_delete: '删除',
    emp_mgmt_empty: '暂无员工记录，请点击「新建员工」创建账号',
    emp_mgmt_resigned_section: '已离职员工',
    emp_mgmt_resigned_label: '（已离职）',
    emp_mgmt_restore: '恢复在职',
    emp_mgmt_perm_delete: '永久删除',
    emp_already_exists: '员工"{name}"已存在',
    emp_created: '✅ 已创建员工"{name}"，默认密码：123456',
    emp_account_created: '✅ 已为"{name}"创建账号，默认密码：123456',
    emp_pw_reset: '✅ 已将"{name}"的密码重置为：123456',
    emp_restored: '✅ 已恢复员工"{name}"为在职状态',
    emp_restore_confirm: '确定将"{name}"恢复为在职员工吗？',
    emp_deleted: '✅ 已删除员工"{name}"',
    emp_perm_deleted: '✅ 已永久删除员工"{name}"',
    emp_delete_has_schedule: '⚠️ "{name}" 在以下月份/地点有排班记录：\n\n{list}\n\n确认删除将一并清除以上所有排班。是否继续？',
    emp_perm_delete_has_schedule: '⚠️ "{name}" 在以下月份/地点还有排班记录：\n\n{list}\n\n永久删除将一并清除以上所有排班。此操作不可撤销，是否继续？',
    emp_perm_delete_confirm: '永久删除"{name}"？此操作不可撤销，将清除其所有历史数据。',

    // ── 管理员端 员工提交 ──
    sub_title: '📋 员工提交',
    sub_month_label: '查看月份：',
    sub_refresh: '刷新',
    sub_new_emp_notice: '⚠️ 有新员工提交了班表，请前往「地点标记」标记其工作地点。',
    sub_col_name: '姓名',
    sub_col_submitted: '提交时间',
    sub_col_days: '可工作天数',
    sub_col_avail: '可用时段',
    sub_col_action: '操作',
    sub_no_account: '未设账号',
    sub_not_submitted: '未提交',
    sub_detail_btn: '详情',
    sub_updated_badge: '已更新',
    sub_no_loc_badge: '未分配地点',
    sub_detail_title: '{name} — {year}年{month}月 可工作时段',
    sub_detail_updated: '{name} — {year}年{month}月 可工作时段【已更新】',
    sub_changes_title: '⚡ 本次更新变化（共 {count} 天）',
    sub_no_changes: '✅ 提交时间有更新，但班表内容与上次相同。',
    sub_note_title: '💬 员工备注',
    sub_legend_work: '可工作',
    sub_legend_off: '休息',
    sub_legend_changed: '本次有变化',

    // ── 管理员端 地点标记 ──
    loc_title: '📍 地点标记',
    loc_add_ph: '新地点名称',
    loc_add_btn: '＋ 添加地点',
    loc_col_name: '员工姓名',
    loc_delete_confirm: '删除地点"{loc}"？该地点的所有排班数据将一并清除。',
    loc_delete_has_schedule: '地点"{loc}"下有已确认的排班，无法直接删除。请先取消确认相关排班后再删除。',

    // ── 管理员端 排班 ──
    sched_loc_label: '工作地点：',
    sched_month_label: '月份：',
    sched_refresh: '刷新',
    sched_edit_emp: '✏️ 编辑员工',
    sched_settings: '⚙️ 设置',
    sched_save: '💾 保存',
    sched_saved: '✓ 数据已保存',
    sched_save_fail: '保存失败，请检查网络连接。',
    sched_no_loc_notice: '⚠️ 当前没有员工被标记到"{loc}"，请先在「地点标记」中为员工分配地点。',
    sched_no_emp: '请先标记员工地点',
    sched_confirm_week: '✅ 确认排班',
    sched_confirmed: '✅ 已确认',
    sched_clear_week: '🗑️ 清空班表',
    sched_auto: '⚡ 自动排班',
    sched_edit_time: '⏱️ 编辑时间',
    sched_undo: '↩',
    sched_week_confirmed_lock: '本周排班已确认，如需修改请在「设置」中取消确认。',
    sched_week_confirmed_no_auto: '本周已确认，无法进行自动排班。',
    sched_week_confirmed_no_clear: '本周已确认，如需清空请先点击「已确认」按钮取消确认。',
    sched_col_emp: '员工',
    sched_col_start: '起始',
    sched_col_end: '结束',
    sched_col_hours: '周工时',
    sched_mark_loc_first: '请先标记员工地点',
    sched_confirm_week_label: '确认排班',
    sched_confirmed_label: '已确认',
    sched_confirmed_unlock_hint: '点击取消确认',
    sched_clear_week_label: '清空班表',
    sched_auto_label: '自动排班',
    sched_edit_time_label: '编辑时间',
    sched_edit_time_hint: '点击进入编辑时间模式，再点员工姓名选人，选好后再点此按钮打开修改面板',
    sched_undo_empty: '暂无可撤销操作',
    sched_undo_hint: '撤销（{count}步）',
    sched_pdf_hint: 'Ctrl+P / Cmd+P 打印并保存为PDF，建议横向打印',
    sub_updated_suffix: '【已更新】',
    sub_detail_title_work: '可工作时段',
    loc_empty_state: '请先在「员工提交」页面加载员工数据',
    loc_hint: '💡 点击 ✓ 为员工标记工作地点（可多选）。修改后自动保存，并同步至排班系统。',
    loc_table_title: '员工工作地点标记',
    sched_location_label: '工作地点：',
    sched_legend_unsubmitted: '未填写',
    sched_legend_avail: '可工作',
    sched_legend_unavail: '不可工作',
    sched_legend_elsewhere: '已在他处排班',
    sched_legend_p1: '已排班（第1人）',
    sched_legend_p2: '已排班（第2人）',
    sched_legend_confirmed: '已确认排班',
    sched_legend_time_override: '时间改动',
    sched_days: ['周一','周二','周三','周四','周五','周六','周日'],
    sched_months: ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'],

    // ── 管理员端 设置 ──
    settings_title: '⚙️ 排班设置',
    settings_slot_limit: '排班人数限制',
    settings_default_time: '默认上下班时间（用于标准化员工提交数据）',
    settings_default_time_desc: '设置每个地点的标准工作时段。员工提交时间超出范围的端点自动调整为默认值，未超出的端点保持原样。\n例：默认 10:00–19:00，员工提交 07:00–15:00 → 自动调整为 10:00–15:00。',
    settings_save: '保存设置',
    settings_cancel: '取消',

    // ── 管理员端 编辑时间面板 ──
    time_panel_title: '⏱️ 批量修改排班时间',
    time_panel_daytype: '选择修改哪种工作时段：',
    time_panel_full: '全天',
    time_panel_half: '半天',
    time_panel_start: '开始时间',
    time_panel_end: '结束时间',
    time_panel_start_ph: '如 08:00（留空不改）',
    time_panel_end_ph: '如 19:00（留空不改）',
    time_panel_cancel: '取消',
    time_panel_confirm: '确认修改',

    // ── 管理员端 删除员工弹窗 ──
    del_emp_title: '删除员工',
    del_emp_resigned_label: '离职员工',
    del_emp_resigned_desc: '保留已确认班次、历史班次及地点标记数据，不再显示在员工管理和地点标记中',
    del_emp_all_label: '删除全部数据',
    del_emp_all_desc: '清除该员工的所有排班、提交记录及账号，操作不可撤销',

    // ── 管理员端 提交汇总（静态HTML部分）──
    sub_card_title: '员工可工作时段提交汇总',
    sub_col_name_th: '姓名',
    sub_col_submitted_th: '提交时间',
    sub_col_days_th: '可工作天数',
    sub_col_avail_th: '时段预览',
    sub_col_action_th: '操作',
    sub_initial_hint: '请选择月份并点击刷新，或载入示例数据',
    sub_legend_full: '全天',
    sub_legend_half: '半天',

    // ── 管理员端 详情弹窗 ──
    detail_modal_title: '员工详情',
    detail_modal_close: '关闭',

    // ── 管理员端 编辑当月员工弹窗 ──
    edit_emp_modal_title: '✏️ 编辑当月员工',
    edit_emp_modal_desc: '仅影响当月排班列表，不影响地点标记。',
    edit_emp_select_ph: '— 从已提交员工中选择 —',
    edit_emp_add_btn: '添加',
    edit_emp_cancel: '取消',
    edit_emp_confirm: '确认',

    // ── 管理员端 地点标记 ──
    loc_col_name_th: '姓名',
    loc_initial_hint: '请先在「员工提交」页面加载员工数据',
    loc_mgmt_subtitle: '新增或删除工作地点，地点将同步显示在「地点标记」和「排班」界面。',

    // ── 员工班表应用（schedule_app.html）──
    app_tab_calendar: '日历',
    app_tab_roster: '班表',
    app_name_ph: '请输入名称',
    app_cal_hint: '请填写下个月可工作时间',
    app_legend_am: '上午可工作',
    app_legend_pm: '下午可工作',
    app_legend_off: '休息',
    app_click_hint: '点击日期可手动覆盖排班',
    app_default_rules: '默认规则',
    app_rule_hint: '点击星期设置可工作时段，再次点击切换全天／半天／清除：',
    app_btn_full: '☀️ 全天',
    app_btn_half: '🌤 半天',
    app_btn_clear_all: '🔄 全部清除',
    app_full_time_section: '全天时段',
    app_half_time_section: '半天时段',
    app_time_start: '开始',
    app_time_end: '结束',
    app_generate_btn: '生成班表 →',
    app_slot_full: '全天',
    app_slot_half: '半天',
    app_slot_off: '休息',
    app_submit_btn: '✉️ 提交班表给管理员',
    app_override_hint: '选择该日排班：',
    app_override_full: '☀️ 全天',
    app_override_half: '🌤 半天',
    app_override_off: '💤 休息',
    app_override_custom: '🕐 自定时间',
    app_override_restore: '↩ 恢复默认',
    app_custom_time_title: '自定义上班时间',
    app_custom_time_confirm: '确认自定时间',
    app_submit_title: '📋 确认提交班表',
    app_submit_body: '确认将您的可工作时段提交给管理员吗？提交后管理员将根据此信息安排上班时间。',
    app_submit_confirm_btn: '确认提交',
  },

  en: {
    // ── General ──
    lang_zh: '中文',
    lang_en: 'English',
    save: 'Save',
    cancel: 'Cancel',
    confirm: 'Confirm',
    close: 'Close',
    loading: 'Loading…',
    refresh: 'Refresh',
    logout: 'Logout',
    unknown_error: 'Unknown error',

    // ── Employee Login ──
    emp_login_title: 'Staff Schedule',
    emp_login_sub: 'Ume & Comé Scheduling System',
    emp_login_name_ph: 'Name',
    emp_login_pw_ph: 'Password',
    emp_login_btn: 'Login',
    emp_login_verifying: 'Verifying…',
    emp_login_no_account: 'Account not found. Please contact your manager.',
    emp_login_wrong_pw: 'Incorrect password',
    emp_login_enter_name: 'Please enter your name',
    emp_login_enter_pw: 'Please enter your password',

    // ── Employee Nav ──
    nav_schedule: 'Schedule',
    nav_roster: 'Availability',
    nav_change_pw: 'Change Password',
    nav_logout: 'Logout',
    nav_logout_title: 'Logout',
    nav_change_pw_title: 'Change Password',

    // ── Employee Change Password ──
    cpw_title: '🔑 Change Password',
    cpw_old_ph: 'Current password',
    cpw_new_ph: 'New password (min. 4 chars)',
    cpw_new2_ph: 'Confirm new password',
    cpw_submit: 'Change Password',
    cpw_fill_all: 'Please fill in all fields',
    cpw_min4: 'New password must be at least 4 characters',
    cpw_mismatch: 'Passwords do not match',
    cpw_wrong_old: 'Current password is incorrect',
    cpw_success: 'Password changed. Please log in again.',

    // ── Employee Calendar ──
    cal_hint_current_with_prev: 'Current month · Past dates carry over from your last submission. Only today and future dates are editable.',
    cal_hint_current_no_prev: 'Current month · Only today and future dates are editable (no previous submission found).',
    cal_hint_next: 'Next month · Please fill in your availability for next month.',
    cal_tab_current: 'This Month',
    cal_tab_next: 'Next Month',
    cal_wd_0: 'Mon', cal_wd_1: 'Tue', cal_wd_2: 'Wed', cal_wd_3: 'Thu',
    cal_wd_4: 'Fri', cal_wd_5: 'Sat', cal_wd_6: 'Sun',
    cal_legend_am: 'AM available',
    cal_legend_pm: 'PM available',
    cal_legend_full: 'Full Day',
    cal_legend_half: 'Half Day',
    cal_legend_off: 'Off',
    cal_hint_click_date: 'Tap a date to manually override the schedule',
    settings_day_hint: 'Tap a day to set availability; tap again to cycle Full Day / Half Day / Clear:',
    cal_clear_all: '🔄 Clear All',
    override_select_label: 'Choose schedule for this day:',
    override_restore_default: '↩ Restore Default',
    cal_slot_full: 'Full Day',
    cal_slot_half: 'Half Day',
    cal_slot_off: 'Day Off',
    cal_slot_custom: 'Custom',
    cal_day_off: 'Off',
    cal_days: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
    cal_months: ['January','February','March','April','May','June','July','August','September','October','November','December'],
    cal_override_title: 'Edit {date}',

    // ── Employee Settings ──
    settings_full_day: 'Full Day Hours',
    settings_half_day: 'Half Day Hours',
    settings_start: 'Start',
    settings_end: 'End',
    settings_rule: 'Rule Setup',
    settings_rule_preview_empty: '(No rules set — all days default to day off)',
    settings_rule_preview: 'Default: work on {days}',
    settings_generate: 'Generate Roster →',

    // ── Employee Custom Time ──
    custom_time_start: 'Start',
    custom_time_end: 'End',
    custom_time_start_ph: 'e.g. 09:00',
    custom_time_end_ph: 'e.g. 24:00',
    custom_time_invalid: 'Please enter valid start and end times (HH:MM format, 24:00 allowed)',
    custom_time_order: 'End time must be after start time',

    // ── Employee Note ──
    note_label: '💬 Note (optional)',
    note_ph: 'Add a note about this submission or any changes — visible to the manager…',

    // ── Employee Submit ──
    submit_btn: 'Submit Schedule',
    submit_modal_title: '📋 Confirm Submission',
    submit_confirm_btn: 'Confirm & Submit',
    submit_submitting: 'Submitting…',
    submit_no_roster: 'Please generate your roster before submitting.',
    submit_no_login: 'Please log in before submitting.',
    submit_no_backend: '⚠️ Google Sheets connection not configured. Please contact your manager.',
    submit_waiting: '⏳ Submitting, please wait…',
    submit_success: '✅ Schedule submitted successfully! Your manager will consider your availability when scheduling.',
    submit_fail: '❌ Submission failed: {error}',
    submit_network_fail: '❌ Submission failed. Please check your connection and try again.',

    // ── Employee Roster ──
    roster_title: '{month} {year} · {name}\'s Availability',
    roster_available: 'Availability',

    // ── Employee Export ──
    export_safari_alert: 'Please allow pop-ups in Safari settings',
    export_fail: 'Export failed, please try again',
    export_long_press: 'Long press image → Save to Photos',

    // ── Admin General ──
    admin_title: 'Schedule Admin',
    admin_loading: 'Loading data…',

    // ── Admin Login ──
    admin_login_title: 'Schedule Admin',
    admin_login_pw_ph: 'Admin password',
    admin_login_btn: 'Login',
    admin_login_verifying: 'Verifying…',
    admin_login_wrong: 'Incorrect password',
    admin_login_enter_pw: 'Please enter your password',

    // ── Admin Nav Tabs ──
    tab_employees: '👥 Staff',
    tab_submissions: '📋 Submissions',
    tab_locations: '📍 Locations',
    tab_scheduling: '🗓️ Scheduling',

    // ── Admin Staff Management ──
    emp_mgmt_title: '👥 Staff Management',
    emp_mgmt_subtitle: 'Manage staff accounts. New staff can log in with their name and the default password (123456).',
    emp_mgmt_new_ph: 'Enter staff name',
    emp_mgmt_new_btn: '＋ New Staff',
    emp_mgmt_col_name: 'Name',
    emp_mgmt_col_location: 'Location',
    emp_mgmt_col_account: 'Account',
    emp_mgmt_col_action: 'Actions',
    emp_mgmt_no_loc: 'No location assigned',
    emp_mgmt_has_account: '✅ Created',
    emp_mgmt_no_account: '—',
    emp_mgmt_reset_pw: 'Reset Password',
    emp_mgmt_create_account: 'Create Account',
    emp_mgmt_delete: 'Delete',
    emp_mgmt_empty: 'No staff found. Click "New Staff" to create an account.',
    emp_mgmt_resigned_section: 'Former Staff',
    emp_mgmt_resigned_label: '(Former)',
    emp_mgmt_restore: 'Reinstate',
    emp_mgmt_perm_delete: 'Delete Permanently',
    emp_already_exists: 'Staff "{name}" already exists',
    emp_created: '✅ Created staff "{name}" — default password: 123456',
    emp_account_created: '✅ Account created for "{name}" — default password: 123456',
    emp_pw_reset: '✅ Password for "{name}" has been reset to: 123456',
    emp_restored: '✅ "{name}" has been reinstated as active staff',
    emp_restore_confirm: 'Reinstate "{name}" as active staff?',
    emp_deleted: '✅ Staff "{name}" deleted',
    emp_perm_deleted: '✅ Staff "{name}" permanently deleted',
    emp_delete_has_schedule: '⚠️ "{name}" has schedule records in:\n\n{list}\n\nThese records will also be cleared. Continue?',
    emp_perm_delete_has_schedule: '⚠️ "{name}" still has schedule records in:\n\n{list}\n\nPermanent deletion will clear all records. This cannot be undone. Continue?',
    emp_perm_delete_confirm: 'Permanently delete "{name}"? This cannot be undone and will remove all historical data.',

    // ── Admin Submissions ──
    sub_title: '📋 Staff Submissions',
    sub_month_label: 'Month:',
    sub_refresh: 'Refresh',
    sub_new_emp_notice: '⚠️ New staff have submitted schedules. Please assign them a location in the Locations tab.',
    sub_col_name: 'Name',
    sub_col_submitted: 'Submitted',
    sub_col_days: 'Available Days',
    sub_col_avail: 'Availability',
    sub_col_action: 'Action',
    sub_no_account: 'No account',
    sub_not_submitted: 'Not submitted',
    sub_detail_btn: 'Details',
    sub_updated_badge: 'Updated',
    sub_no_loc_badge: 'No location',
    sub_detail_title: '{name} — {month} {year} Availability',
    sub_detail_updated: '{name} — {month} {year} Availability [Updated]',
    sub_changes_title: '⚡ Changes this submission ({count} day(s))',
    sub_no_changes: '✅ Submission timestamp updated, but availability is unchanged.',
    sub_note_title: '💬 Staff Note',
    sub_legend_work: 'Available',
    sub_legend_off: 'Day Off',
    sub_legend_changed: 'Changed',

    // ── Admin Locations ──
    loc_title: '📍 Location Management',
    loc_add_ph: 'New location name',
    loc_add_btn: '＋ Add Location',
    loc_col_name: 'Staff Name',
    loc_delete_confirm: 'Delete location "{loc}"? All schedule data for this location will be cleared.',
    loc_delete_has_schedule: 'Location "{loc}" has confirmed schedules and cannot be deleted. Please un-confirm those schedules first.',

    // ── Admin Scheduling ──
    sched_loc_label: 'Location:',
    sched_month_label: 'Month:',
    sched_refresh: 'Refresh',
    sched_edit_emp: '✏️ Edit Staff',
    sched_settings: '⚙️ Settings',
    sched_save: '💾 Save',
    sched_saved: '✓ Saved',
    sched_save_fail: 'Save failed. Please check your connection.',
    sched_no_loc_notice: '⚠️ No staff assigned to "{loc}". Please assign staff in the Locations tab.',
    sched_no_emp: 'Please assign staff to this location first',
    sched_confirm_week: '✅ Confirm Schedule',
    sched_confirmed: '✅ Confirmed',
    sched_clear_week: '🗑️ Clear',
    sched_auto: '⚡ Auto-Schedule',
    sched_edit_time: '⏱️ Edit Times',
    sched_undo: '↩',
    sched_week_confirmed_lock: 'This week is confirmed. To make changes, please un-confirm it in Settings.',
    sched_week_confirmed_no_auto: 'This week is confirmed. Auto-schedule is not available.',
    sched_week_confirmed_no_clear: 'This week is confirmed. Click "Confirmed" to un-confirm before clearing.',
    sched_col_emp: 'Staff',
    sched_col_start: 'Start',
    sched_col_end: 'End',
    sched_col_hours: 'Hrs/Wk',
    sched_mark_loc_first: 'Please assign staff locations first',
    sched_confirm_week_label: 'Confirm',
    sched_confirmed_label: 'Confirmed',
    sched_confirmed_unlock_hint: 'Click to un-confirm',
    sched_clear_week_label: 'Clear',
    sched_auto_label: 'Auto-Schedule',
    sched_edit_time_label: 'Edit Times',
    sched_edit_time_hint: 'Click to enter time-edit mode, then click staff names to select, then click this button again to open the edit panel',
    sched_undo_empty: 'Nothing to undo',
    sched_undo_hint: 'Undo ({count} step(s))',
    sched_pdf_hint: 'Press Ctrl+P / Cmd+P to print or save as PDF. Landscape orientation recommended.',
    sub_updated_suffix: '[Updated]',
    sub_detail_title_work: 'Availability',
    loc_empty_state: 'Please load staff data from the Submissions tab first',
    loc_hint: '💡 Click ✓ to assign work locations to staff (multiple allowed). Changes are saved automatically and synced to the schedule.',
    loc_table_title: 'Staff Work Location Assignment',
    sched_location_label: 'Location:',
    sched_legend_unsubmitted: 'Not submitted',
    sched_legend_avail: 'Available',
    sched_legend_unavail: 'Unavailable',
    sched_legend_elsewhere: 'Scheduled elsewhere',
    sched_legend_p1: 'Scheduled (1st)',
    sched_legend_p2: 'Scheduled (2nd)',
    sched_legend_confirmed: 'Confirmed',
    sched_legend_time_override: 'Time modified',
    sched_days: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
    sched_months: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],

    // ── Admin Settings ──
    settings_title: '⚙️ Schedule Settings',
    settings_slot_limit: 'Staff limit per shift',
    settings_default_time: 'Default shift hours (for normalising staff submissions)',
    settings_default_time_desc: 'Set standard shift hours per location. Submitted times outside this range are adjusted to the boundary; times within range are kept as-is.\nExample: default 10:00–19:00, staff submits 07:00–15:00 → adjusted to 10:00–15:00.',
    settings_save: 'Save Settings',
    settings_cancel: 'Cancel',

    // ── Admin Time Edit Panel ──
    time_panel_title: '⏱️ Edit Shift Times',
    time_panel_daytype: 'Select shift type to edit:',
    time_panel_full: 'Full Day',
    time_panel_half: 'Half Day',
    time_panel_start: 'Start Time',
    time_panel_end: 'End Time',
    time_panel_start_ph: 'e.g. 08:00 (leave blank to keep)',
    time_panel_end_ph: 'e.g. 19:00 (leave blank to keep)',
    time_panel_cancel: 'Cancel',
    time_panel_confirm: 'Apply Changes',

    // ── Admin Delete Staff Modal ──
    del_emp_title: 'Remove Staff',
    del_emp_resigned_label: 'Mark as Former Staff',
    del_emp_resigned_desc: 'Keeps confirmed shifts, history, and location data but hides this person from staff management and location tabs',
    del_emp_all_label: 'Delete All Data',
    del_emp_all_desc: 'Removes all schedules, submissions, and the account permanently. This cannot be undone.',

    // ── Admin Submissions (static HTML) ──
    sub_card_title: 'Staff Availability Submissions',
    sub_col_name_th: 'Name',
    sub_col_submitted_th: 'Submitted',
    sub_col_days_th: 'Available Days',
    sub_col_avail_th: 'Availability Preview',
    sub_col_action_th: 'Action',
    sub_initial_hint: 'Select a month and click Refresh, or load sample data',
    sub_legend_full: 'Full Day',
    sub_legend_half: 'Half Day',

    // ── Admin Detail Modal ──
    detail_modal_title: 'Staff Detail',
    detail_modal_close: 'Close',

    // ── Admin Edit Staff Modal ──
    edit_emp_modal_title: '✏️ Edit Month Staff',
    edit_emp_modal_desc: 'Only affects the scheduling list for this month. Does not affect location assignments.',
    edit_emp_select_ph: '— Select from submitted staff —',
    edit_emp_add_btn: 'Add',
    edit_emp_cancel: 'Cancel',
    edit_emp_confirm: 'Confirm',

    // ── Admin Locations ──
    loc_col_name_th: 'Name',
    loc_initial_hint: 'Load staff data from the Submissions tab first',
    loc_mgmt_subtitle: 'Add or remove work locations. Changes sync to the Locations and Scheduling tabs.',

    // ── Staff Schedule App (schedule_app.html) ──
    app_tab_calendar: 'Calendar',
    app_tab_roster: 'Availability',
    app_name_ph: 'Enter your name',
    app_cal_hint: 'Fill in your availability for next month',
    app_legend_am: 'Morning available',
    app_legend_pm: 'Afternoon available',
    app_legend_off: 'Off',
    app_click_hint: 'Click a date to manually override',
    app_default_rules: 'Default Rules',
    app_rule_hint: 'Click a weekday to set availability; click again to cycle Full / Half / Clear:',
    app_btn_full: '☀️ Full Day',
    app_btn_half: '🌤 Half Day',
    app_btn_clear_all: '🔄 Clear All',
    app_full_time_section: 'Full-Day Hours',
    app_half_time_section: 'Half-Day Hours',
    app_time_start: 'Start',
    app_time_end: 'End',
    app_generate_btn: 'Generate Availability →',
    app_slot_full: 'Full Day',
    app_slot_half: 'Half Day',
    app_slot_off: 'Off',
    app_submit_btn: '✉️ Submit to Manager',
    app_override_hint: 'Select shift for this day:',
    app_override_full: '☀️ Full Day',
    app_override_half: '🌤 Half Day',
    app_override_off: '💤 Off',
    app_override_custom: '🕐 Custom Time',
    app_override_restore: '↩ Reset to Default',
    app_custom_time_title: 'Custom Work Hours',
    app_custom_time_confirm: 'Apply Custom Time',
    app_submit_title: '📋 Confirm Submission',
    app_submit_body: 'Submit your availability for the month to your manager? They will use this to arrange your schedule.',
    app_submit_confirm_btn: 'Submit',
  }
};

// ── 当前语言 ──
let _currentLang = 'zh';

function _detectBrowserLang() {
  const bl = (navigator.language || navigator.userLanguage || 'zh').toLowerCase();
  return bl.startsWith('en') ? 'en' : 'zh';
}

function initLang() {
  // 优先 localStorage 缓存
  const stored = localStorage.getItem('ume_lang');
  if (stored === 'zh' || stored === 'en') {
    _currentLang = stored;
  } else {
    _currentLang = _detectBrowserLang();
  }
}

function setLang(lang) {
  if (lang !== 'zh' && lang !== 'en') return;
  _currentLang = lang;
  localStorage.setItem('ume_lang', lang);
  applyI18n();
  // 若有账号在线，把语言偏好写入账号（employee端 / admin端各自处理）
  if (typeof onLangChanged === 'function') onLangChanged(lang);
}

function getLang() { return _currentLang; }

// 翻译函数：支持 {placeholder} 替换
function t(key, vars) {
  const dict = I18N[_currentLang] || I18N.zh;
  let str = dict[key];
  if (str === undefined) {
    // fallback 到中文
    str = I18N.zh[key];
  }
  if (str === undefined) return key;
  if (vars) {
    Object.entries(vars).forEach(([k, v]) => {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    });
  }
  return str;
}

// 批量替换页面上所有 data-i18n 元素
function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const attr = el.getAttribute('data-i18n-attr'); // 可指定 placeholder/title 等属性
    const val = t(key);
    if (attr) {
      el.setAttribute(attr, val);
    } else if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.placeholder = val;
    } else {
      el.textContent = val;
    }
  });
  // 更新语言切换按钮状态
  document.querySelectorAll('.lang-switch-btn').forEach(btn => {
    const l = btn.getAttribute('data-lang');
    btn.style.fontWeight = l === _currentLang ? '700' : '400';
    btn.style.opacity    = l === _currentLang ? '1' : '0.55';
  });
  // 更新 html lang 属性
  document.documentElement.lang = _currentLang === 'en' ? 'en' : 'zh-CN';
}

// 生成语言切换按钮 HTML（插入到导航右上角）
function langSwitchHTML() {
  const zh = _currentLang === 'zh';
  return `<span style="display:inline-flex;align-items:center;gap:2px;font-size:12px;">
    <button class="lang-switch-btn topnav-tab" data-lang="zh" onclick="setLang('zh')"
      style="font-weight:${zh?'700':'400'};opacity:${zh?'1':'0.55'};padding:4px 7px;">中文</button>
    <span style="color:rgba(255,255,255,0.4);font-size:10px;">|</span>
    <button class="lang-switch-btn topnav-tab" data-lang="en" onclick="setLang('en')"
      style="font-weight:${zh?'400':'700'};opacity:${zh?'0.55':'1'};padding:4px 7px;">EN</button>
  </span>`;
}

// 初始化（文件加载时自动执行）
initLang();
