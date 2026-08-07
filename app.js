const STORAGE_KEY = "growth-workbench-v1";
const LOCAL_UPDATED_KEY = "growth-workbench-local-updated-at";
const DEVICE_ID_KEY = "growth-workbench-device-id";
const CLOUD_TABLE = "user_workbench";

const initialState = {
  profile: { displayName: "我的工作台", examDate: "", studyHours: "8.5" },
  dailyStatus: {},
  tasks: [],
  journals: [],
  ielts: [],
  applications: [],
  applicationOrderVersion: 1,
  sortPreferences: {},
  speakingSampleCleanupVersion: 1,
  workouts: [],
  reading: [],
  readingMigrationVersion: 1,
  readingGoals: [],
  monthlyReadingPlans: [],
  books: [],
  readingLogs: [],
  quotes: [],
  bookNotes: [],
  speakingTopics: [
    { id: "speaking-topic-technology", part: 1, title: "Technology", color: "#303030" },
    { id: "speaking-topic-hometown", part: 1, title: "Hometown", color: "#686868" },
    { id: "speaking-topic-people", part: 2, title: "People", color: "#9a9a9a" },
    { id: "speaking-topic-education", part: 3, title: "Education", color: "#c2c2c2" }
  ],
  speakingQuestions: []
};

let state = loadState();
let activeIeltsFilter = "all";
let activeIeltsTab = "records";
let activeView = "home";
let activeSpeakingPart = 1;
let activeSpeakingTopicId = "";
let activeSpeakingQuestionId = "";
let speakingSearch = "";
let speakingStatusFilter = "all";
let applicationDragState = null;
let editingApplicationId = "";
let editingSpeakingTopicId = "";
let editingSpeakingQuestionId = "";
let activeReadingTab = "dashboard";
let bookSearch = "";
let bookCategoryFilter = "all";
let supabaseClient = null;
let cloudUser = null;
let cloudSyncTimer = null;
let cloudSyncInProgress = false;
let cloudSubscription = null;
let applyingCloudState = false;

function deviceId() {
  let value = localStorage.getItem(DEVICE_ID_KEY);
  if (!value) {
    value = `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(DEVICE_ID_KEY, value);
  }
  return value;
}

function writeLocalState(value = state, { markModified = true, queueSync = true } = {}) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  if (markModified) localStorage.setItem(LOCAL_UPDATED_KEY, String(Date.now()));
  if (queueSync && !applyingCloudState) scheduleCloudSync();
}

const viewNames = {
  home: "首页",
  today: "今日计划",
  ielts: "雅思学习",
  applications: "申请项目",
  reading: "阅读成长",
  records: "习惯记录",
  growth: "成长复盘",
  settings: "设置"
};

const sortOptions = {
  tasks: [
    ["priority", "优先级"],
    ["latest", "最新添加"],
    ["oldest", "最早添加"],
    ["name", "名称 A-Z"],
    ["completed", "完成状态"]
  ],
  ielts: [
    ["latest", "日期最新"],
    ["oldest", "日期最早"],
    ["name", "科目名称"],
    ["duration", "时长从高到低"]
  ],
  speaking: [
    ["latest", "最新添加"],
    ["oldest", "最早添加"],
    ["name", "题目 A-Z"],
    ["status", "复习状态"]
  ],
  applications: [
    ["manual", "自定义顺序"],
    ["deadline-asc", "截止日期最近"],
    ["deadline-desc", "截止日期最晚"],
    ["name", "学校 A-Z"],
    ["status", "申请状态"]
  ],
  workouts: [
    ["latest", "日期最新"],
    ["oldest", "日期最早"],
    ["name", "运动类型"],
    ["duration", "时长从高到低"]
  ],
  "reading-dashboard": [
    ["latest", "最新添加"],
    ["name", "书名 A-Z"],
    ["progress-desc", "进度从高到低"],
    ["progress-asc", "进度从低到高"]
  ],
  "reading-monthly": [
    ["latest", "月份最新"],
    ["oldest", "月份最早"],
    ["name", "主题 A-Z"]
  ],
  "reading-library": [
    ["latest", "最新添加"],
    ["oldest", "最早添加"],
    ["name", "书名 A-Z"],
    ["progress-desc", "进度从高到低"],
    ["rating", "评分从高到低"]
  ],
  "reading-logs": [
    ["latest", "日期最新"],
    ["oldest", "日期最早"],
    ["name", "书名 A-Z"],
    ["duration", "时长从高到低"]
  ],
  "reading-quotes": [
    ["latest", "最新添加"],
    ["oldest", "最早添加"],
    ["name", "书名 A-Z"]
  ],
  "reading-notes": [
    ["latest", "最新添加"],
    ["oldest", "最早添加"],
    ["name", "书名 A-Z"]
  ],
  growth: [
    ["default", "默认顺序"],
    ["name", "名称 A-Z"]
  ]
};

function currentSortContext() {
  if (["home", "today"].includes(activeView)) return "tasks";
  if (activeView === "ielts") return activeIeltsTab === "speaking" ? "speaking" : "ielts";
  if (activeView === "applications") return "applications";
  if (activeView === "records") return "workouts";
  if (activeView === "reading") return `reading-${activeReadingTab}`;
  if (activeView === "growth") return "growth";
  return "";
}

function sortMode(context) {
  const options = sortOptions[context] || [];
  const saved = state.sortPreferences?.[context];
  return options.some(([value]) => value === saved) ? saved : options[0]?.[0] || "default";
}

function updatePageSort() {
  const select = document.getElementById("pageSort");
  const context = currentSortContext();
  const options = sortOptions[context] || [];
  select.disabled = options.length < 2;
  select.title = options.length < 2 ? "当前页面没有可排序列表" : "选择当前页面的排序方式";
  select.innerHTML = options.length
    ? options.map(([value, label]) =>
      `<option value="${value}" ${value === sortMode(context) ? "selected" : ""}>${label}</option>`
    ).join("")
    : `<option value="default">无需排序</option>`;
}

function compareText(a, b) {
  return String(a || "").localeCompare(String(b || ""), "zh-CN", { numeric: true });
}

function dateValue(item) {
  return String(item.date || item.month || item.updatedAt || item.createdAt || "");
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return structuredClone(initialState);
    const loaded = { ...structuredClone(initialState), ...saved };
    loaded.applications = Array.isArray(loaded.applications) ? loaded.applications : [];
    ["reading", "readingGoals", "monthlyReadingPlans", "books", "readingLogs", "quotes", "bookNotes"]
      .forEach(collection => {
        loaded[collection] = Array.isArray(loaded[collection]) ? loaded[collection] : [];
      });
    if (saved.readingMigrationVersion !== 1 && loaded.reading.length) {
      const migratedBooks = new Map();
      [...loaded.reading]
        .sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0))
        .forEach(item => {
          const normalizedTitle = String(item.book || "未命名书籍").trim();
          let book = migratedBooks.get(normalizedTitle.toLowerCase());
          if (!book) {
            book = {
              id: `migrated-book-${item.id}`,
              title: normalizedTitle,
              author: "",
              category: "其他",
              language: "中文",
              startDate: item.date || "",
              finishDate: "",
              totalPages: Number(item.totalPages || 1),
              currentPage: Number(item.currentPage || 0),
              status: Number(item.currentPage || 0) >= Number(item.totalPages || 1) ? "已读" : "在读",
              rating: "",
              createdAt: Number(item.createdAt || Date.now())
            };
            migratedBooks.set(normalizedTitle.toLowerCase(), book);
            loaded.books.push(book);
          } else {
            book.currentPage = Math.max(book.currentPage, Number(item.currentPage || 0));
            book.totalPages = Math.max(book.totalPages, Number(item.totalPages || 1));
          }
          loaded.readingLogs.push({
            id: `migrated-log-${item.id}`,
            bookId: book.id,
            date: item.date || localDate(),
            minutes: 0,
            pagesRead: 0,
            currentPage: Number(item.currentPage || 0),
            chapter: "",
            summary: "",
            takeaway: "",
            keyIdea: "",
            reflection: item.note || "",
            createdAt: Number(item.createdAt || Date.now())
          });
        });
      loaded.readingMigrationVersion = 1;
      writeLocalState(loaded, { markModified: false, queueSync: false });
    }
    if (saved.applicationOrderVersion !== 1) {
      loaded.applications.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
      loaded.applicationOrderVersion = 1;
    }
    if (saved.speakingSampleCleanupVersion !== 1) {
      const sampleQuestionIds = new Set([
        "speaking-question-technology-1",
        "speaking-question-technology-2",
        "speaking-question-people-1",
        "speaking-question-education-1"
      ]);
      loaded.speakingQuestions = loaded.speakingQuestions.filter(
        question => !sampleQuestionIds.has(question.id)
      );
      loaded.speakingSampleCleanupVersion = 1;
      writeLocalState(loaded, { markModified: false, queueSync: false });
    }
    return loaded;
  } catch {
    return structuredClone(initialState);
  }
}

function saveState(message = "已保存") {
  writeLocalState();
  setCloudStatus(cloudUser ? "等待云同步" : "本机数据已保存", cloudUser ? "syncing" : "local");
  renderAll();
  showToast(message);
}

function id() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function localDate(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function formatDate(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function startOfWeek() {
  const date = new Date();
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function isThisWeek(dateString) {
  return new Date(`${dateString}T12:00:00`) >= startOfWeek();
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 1800);
}

function cloudConfig() {
  const config = window.SUPABASE_CONFIG || {};
  const valid = /^https:\/\/.+\.supabase\.co$/i.test(String(config.url || ""))
    && String(config.anonKey || "").length > 30;
  return { ...config, valid };
}

function setAccountMessage(message = "", type = "") {
  const element = document.getElementById("accountMessage");
  if (!element) return;
  element.textContent = message;
  element.className = `account-message ${type}`.trim();
}

function setCloudStatus(message, status = "local") {
  const saveStatus = document.getElementById("saveStatus");
  if (saveStatus) saveStatus.textContent = message;
  const accountStatus = document.getElementById("accountSyncStatus");
  if (accountStatus && cloudUser) accountStatus.textContent = message;
  const settings = document.getElementById("cloudSettingsStatus");
  if (!settings) return;
  const title = cloudUser ? cloudUser.email : "尚未登录云端";
  const detail = cloudUser ? message : (cloudConfig().valid
    ? "登录同一账号后即可在不同设备同步。"
    : "配置 Supabase 后可注册账号并跨设备同步。");
  settings.className = `cloud-settings-status ${status}`;
  settings.innerHTML = `
    <span class="sync-state-dot ${cloudUser ? "connected" : ""}"></span>
    <div><strong>${escapeHtml(title || "云端账号")}</strong><small>${escapeHtml(detail)}</small></div>`;
}

function renderAccountState() {
  const configured = cloudConfig().valid && Boolean(window.supabase?.createClient);
  const warning = document.getElementById("cloudConfigWarning");
  const signedOut = document.getElementById("accountSignedOut");
  const signedIn = document.getElementById("accountSignedIn");
  if (!warning || !signedOut || !signedIn) return;
  warning.hidden = configured;
  signedOut.hidden = Boolean(cloudUser);
  signedIn.hidden = !cloudUser;
  signedOut.querySelectorAll("input, button").forEach(control => {
    control.disabled = !configured;
  });
  document.getElementById("accountUserEmail").textContent = cloudUser?.email || "";
  const avatar = document.getElementById("profileButton");
  avatar.textContent = cloudUser?.email ? cloudUser.email.slice(0, 2).toUpperCase() : "ME";
  avatar.title = cloudUser ? `云端账号：${cloudUser.email}` : "账号与云同步";
  setCloudStatus(
    cloudUser ? "云端已连接" : (configured ? "本机数据已保存" : "本机模式"),
    cloudUser ? "connected" : "local"
  );
}

function cloudStatePayload() {
  return JSON.parse(JSON.stringify(state));
}

function localUpdatedAt() {
  return Number(localStorage.getItem(LOCAL_UPDATED_KEY) || 0);
}

function normalizeState(value) {
  const normalized = { ...structuredClone(initialState), ...(value || {}) };
  [
    "tasks", "journals", "ielts", "applications", "workouts", "reading",
    "readingGoals", "monthlyReadingPlans", "books", "readingLogs", "quotes",
    "bookNotes", "speakingTopics", "speakingQuestions"
  ].forEach(collection => {
    normalized[collection] = Array.isArray(normalized[collection])
      ? normalized[collection]
      : [];
  });
  normalized.profile = normalized.profile && typeof normalized.profile === "object"
    ? { ...initialState.profile, ...normalized.profile }
    : structuredClone(initialState.profile);
  normalized.dailyStatus = normalized.dailyStatus && typeof normalized.dailyStatus === "object"
    ? normalized.dailyStatus
    : {};
  normalized.sortPreferences = normalized.sortPreferences
    && typeof normalized.sortPreferences === "object"
    ? normalized.sortPreferences
    : {};
  return normalized;
}

function scheduleCloudSync() {
  if (!cloudUser || !supabaseClient || applyingCloudState) return;
  clearTimeout(cloudSyncTimer);
  setCloudStatus("等待云同步", "syncing");
  cloudSyncTimer = setTimeout(() => uploadCloudState(), 1200);
}

async function uploadCloudState({ force = false } = {}) {
  if (!cloudUser || !supabaseClient) return false;
  if (cloudSyncInProgress) {
    clearTimeout(cloudSyncTimer);
    cloudSyncTimer = setTimeout(() => uploadCloudState({ force }), 1000);
    return false;
  }
  if (!navigator.onLine && !force) {
    setCloudStatus("离线，联网后同步", "offline");
    return false;
  }
  cloudSyncInProgress = true;
  setCloudStatus("正在上传云端", "syncing");
  const sourceLocalTime = localUpdatedAt();
  const { data, error } = await supabaseClient
    .from(CLOUD_TABLE)
    .upsert({
      user_id: cloudUser.id,
      state_data: cloudStatePayload(),
      updated_by: deviceId()
    }, { onConflict: "user_id" })
    .select("updated_at")
    .single();
  cloudSyncInProgress = false;
  if (error) {
    setCloudStatus("云同步失败", "error");
    setAccountMessage(error.message, "error");
    return false;
  }
  const serverUpdatedAt = Date.parse(data?.updated_at) || Date.now();
  if (localUpdatedAt() <= sourceLocalTime) {
    localStorage.setItem(LOCAL_UPDATED_KEY, String(serverUpdatedAt));
  } else {
    scheduleCloudSync();
  }
  setCloudStatus("已同步到云端", "connected");
  setAccountMessage("同步完成。", "success");
  return true;
}

function applyDownloadedState(cloudState, updatedAt) {
  if (!cloudState || typeof cloudState !== "object") return false;
  applyingCloudState = true;
  state = normalizeState(cloudState);
  writeLocalState(state, { markModified: false, queueSync: false });
  localStorage.setItem(LOCAL_UPDATED_KEY, String(Date.parse(updatedAt) || Date.now()));
  renderAll();
  updatePageSort();
  applyingCloudState = false;
  setCloudStatus("已获取最新云端数据", "connected");
  return true;
}

async function getCloudRow() {
  if (!cloudUser || !supabaseClient) return { row: null, error: null };
  const { data, error } = await supabaseClient
    .from(CLOUD_TABLE)
    .select("state_data, updated_at, updated_by")
    .eq("user_id", cloudUser.id)
    .maybeSingle();
  return { row: data, error };
}

async function syncWithCloud({ prefer = "newest" } = {}) {
  if (!cloudUser || !supabaseClient || cloudSyncInProgress) return false;
  cloudSyncInProgress = true;
  setCloudStatus("正在检查云端数据", "syncing");
  const { row, error } = await getCloudRow();
  cloudSyncInProgress = false;
  if (error) {
    setCloudStatus("云同步失败", "error");
    setAccountMessage(error.message, "error");
    return false;
  }
  if (!row) return uploadCloudState({ force: true });

  const cloudTime = Date.parse(row.updated_at) || 0;
  const localTime = localUpdatedAt();
  if (prefer === "cloud" || (prefer === "newest" && cloudTime > localTime)) {
    const applied = applyDownloadedState(row.state_data, row.updated_at);
    if (applied) setAccountMessage("已使用云端的最新数据。", "success");
    return applied;
  }
  if (prefer === "local" || localTime > cloudTime) {
    return uploadCloudState({ force: true });
  }
  setCloudStatus("本机与云端已一致", "connected");
  setAccountMessage("当前已经是最新数据。", "success");
  return true;
}

function subscribeToCloudChanges() {
  if (!supabaseClient || !cloudUser) return;
  if (cloudSubscription) supabaseClient.removeChannel(cloudSubscription);
  cloudSubscription = supabaseClient
    .channel(`workbench-${cloudUser.id}`)
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: CLOUD_TABLE,
      filter: `user_id=eq.${cloudUser.id}`
    }, payload => {
      if (payload.new?.updated_by === deviceId()) return;
      syncWithCloud({ prefer: "newest" });
    })
    .subscribe();
}

async function handleCloudSession(session) {
  const nextUser = session?.user || null;
  const userChanged = nextUser?.id !== cloudUser?.id;
  cloudUser = nextUser;
  if (!cloudUser && cloudSubscription && supabaseClient) {
    await supabaseClient.removeChannel(cloudSubscription);
    cloudSubscription = null;
  }
  renderAccountState();
  if (cloudUser && userChanged) {
    subscribeToCloudChanges();
    await syncWithCloud({ prefer: "newest" });
  }
}

async function initializeCloudSync() {
  renderAccountState();
  const config = cloudConfig();
  if (!config.valid || !window.supabase?.createClient) return;
  supabaseClient = window.supabase.createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) setAccountMessage(error.message, "error");
  await handleCloudSession(data?.session || null);
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    setTimeout(() => handleCloudSession(session), 0);
  });
}

function openAccountDialog() {
  renderAccountState();
  setAccountMessage("");
  openDialog("accountDialog");
}

async function submitAccount(mode) {
  if (!supabaseClient) {
    setAccountMessage("请先完成 Supabase 配置。", "error");
    return;
  }
  const email = document.getElementById("accountEmail").value.trim();
  const password = document.getElementById("accountPassword").value;
  if (!email || password.length < 6) {
    setAccountMessage("请输入有效邮箱和至少 6 位密码。", "error");
    return;
  }
  setAccountMessage(mode === "register" ? "正在创建账号…" : "正在登录…");
  const result = mode === "register"
    ? await supabaseClient.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}${window.location.pathname}` }
    })
    : await supabaseClient.auth.signInWithPassword({ email, password });
  if (result.error) {
    setAccountMessage(result.error.message, "error");
    return;
  }
  if (mode === "register" && !result.data.session) {
    setAccountMessage("注册成功，请打开邮箱完成验证后再登录。", "success");
    return;
  }
  setAccountMessage(mode === "register" ? "账号创建成功，正在同步…" : "登录成功，正在同步…", "success");
}

function switchView(view) {
  if (!viewNames[view] || !document.getElementById(`${view}View`)) return;
  activeView = view;
  document.querySelectorAll(".view").forEach(el => el.classList.remove("active"));
  document.getElementById(`${view}View`).classList.add("active");
  document.querySelectorAll("[data-view]").forEach(button => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  document.getElementById("viewTitle").textContent = viewNames[view];
  if (window.location.hash !== `#${view}`) {
    history.replaceState(null, "", `#${view}`);
  }
  updatePageSort();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderDate() {
  const date = new Date();
  const weekdays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  document.getElementById("dateLabel").textContent =
    `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 · ${weekdays[date.getDay()]}`;
}

function todaysTasks() {
  const today = localDate();
  const tasks = state.tasks.filter(task => task.date === today);
  const mode = sortMode("tasks");
  return [...tasks].sort((a, b) => {
    if (mode === "latest") return Number(b.createdAt || 0) - Number(a.createdAt || 0);
    if (mode === "oldest") return Number(a.createdAt || 0) - Number(b.createdAt || 0);
    if (mode === "name") return compareText(a.title, b.title);
    if (mode === "completed") return Number(a.done) - Number(b.done) || compareText(a.priority, b.priority);
    return compareText(a.priority, b.priority) || Number(a.createdAt || 0) - Number(b.createdAt || 0);
  });
}

function renderTasks() {
  const tasks = todaysTasks();
  const priorities = tasks.slice(0, 3);
  const priorityList = document.getElementById("priorityList");
  priorityList.innerHTML = "";

  priorities.forEach(task => {
    priorityList.insertAdjacentHTML("beforeend", `
      <article class="task-card ${task.done ? "done" : ""}">
        <span class="priority-badge">${escapeHtml(task.priority)} · ${escapeHtml(task.module)}</span>
        <div class="task-actions">
          <button class="task-action" data-toggle-task="${task.id}" title="${task.done ? "恢复任务" : "标记完成"}">${task.done ? "↶" : "✓"}</button>
        </div>
        <h3>${escapeHtml(task.title)}</h3>
        <div class="task-meta">${escapeHtml(task.minutes)} 分钟 · ${escapeHtml(task.criteria)}</div>
      </article>`);
  });

  for (let i = priorities.length; i < 3; i += 1) {
    priorityList.insertAdjacentHTML("beforeend", `<button class="empty-slot" data-open-task>添加优先任务</button>`);
  }

  const allTasks = document.getElementById("allTasks");
  if (!tasks.length) {
    allTasks.innerHTML = `<div class="empty-state">今天还没有任务。先添加最多三项真正重要的事情。</div>`;
  } else {
    allTasks.innerHTML = tasks.map(task => `
      <article class="stack-item ${task.done ? "done" : ""}">
        <button class="check-button ${task.done ? "checked" : ""}" data-toggle-task="${task.id}" aria-label="切换完成状态">${task.done ? "✓" : ""}</button>
        <div>
          <div class="item-title">${escapeHtml(task.title)}</div>
          <div class="item-subtitle">${escapeHtml(task.module)} · ${escapeHtml(task.priority)} · ${escapeHtml(task.minutes)} 分钟 · ${escapeHtml(task.criteria)}</div>
        </div>
        <button class="remove-button" data-remove-task="${task.id}" title="删除任务">×</button>
      </article>`).join("");
  }

  const completed = tasks.filter(task => task.done).length;
  const progress = tasks.length ? Math.round(completed / tasks.length * 100) : 0;
  document.getElementById("todayProgress").textContent = `${progress}%`;
}

function renderDailyStatus() {
  const today = localDate();
  const daily = state.dailyStatus[today] || {};
  document.getElementById("energyButton").textContent = daily.energy || "待记录";
  document.getElementById("moodButton").textContent = daily.mood || "待记录";
}

function renderIelts() {
  const mode = sortMode("ielts");
  const records = [...state.ielts].sort((a, b) => {
    if (mode === "oldest") return compareText(dateValue(a), dateValue(b));
    if (mode === "name") return compareText(a.skill, b.skill) || compareText(dateValue(b), dateValue(a));
    if (mode === "duration") return Number(b.minutes || 0) - Number(a.minutes || 0);
    return compareText(dateValue(b), dateValue(a));
  });
  const visible = activeIeltsFilter === "all" ? records : records.filter(r => r.skill === activeIeltsFilter);
  const container = document.getElementById("ieltsRecords");

  container.innerHTML = visible.length ? visible.map(record => `
    <article class="record-item">
      <div class="record-head">
        <strong>${escapeHtml(record.skill)} · ${escapeHtml(record.source)}</strong>
        <span class="record-date">${formatDate(record.date)}</span>
      </div>
      <div class="record-result">${escapeHtml(record.result)}</div>
      <div class="record-note">${record.problem ? `主要问题：${escapeHtml(record.problem)}<br>` : ""}下一步：${escapeHtml(record.nextFocus)}</div>
      <div class="record-footer"><span>${record.minutes} 分钟</span><button class="remove-button" data-remove-ielts="${record.id}">删除</button></div>
    </article>`).join("") : `<div class="empty-state">暂无${activeIeltsFilter === "all" ? "" : activeIeltsFilter}记录。</div>`;

  const thisWeek = records.filter(r => isThisWeek(r.date));
  const minutes = thisWeek.reduce((sum, r) => sum + Number(r.minutes || 0), 0);
  document.getElementById("weeklyIeltsTime").textContent = `${(minutes / 60).toFixed(1)} 小时`;

  const skills = ["阅读", "听力", "写作", "口语"];
  document.getElementById("skillBars").innerHTML = skills.map(skill => {
    const skillMinutes = thisWeek.filter(r => r.skill === skill).reduce((sum, r) => sum + Number(r.minutes || 0), 0);
    const percent = minutes ? Math.round(skillMinutes / minutes * 100) : 0;
    return `<div class="skill-row"><span>${skill}</span><div class="bar-track"><div class="bar-fill" style="width:${percent}%"></div></div><em>${skillMinutes} 分钟</em></div>`;
  }).join("");

  document.getElementById("predictedScore").textContent = records.length ? "待人工确认" : "暂无数据";
}

function renderApplications() {
  const applicationSort = sortMode("applications");
  const projects = [...state.applications].sort((a, b) => {
    const statusOrder = ["考虑中", "准备中", "已提交", "已录取", "已结束"];
    if (applicationSort === "deadline-asc") return compareText(a.deadline || "9999-12-31", b.deadline || "9999-12-31");
    if (applicationSort === "deadline-desc") return compareText(b.deadline || "", a.deadline || "");
    if (applicationSort === "name") return compareText(a.school, b.school) || compareText(a.program, b.program);
    if (applicationSort === "status") {
      return statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status) || compareText(a.school, b.school);
    }
    return 0;
  });
  const activeProjects = projects.filter(project => !["已录取", "已结束"].includes(project.status));
  const submittedProjects = projects.filter(project => project.status === "已提交").length;
  const admittedProjects = projects.filter(project => project.status === "已录取").length;

  document.getElementById("applicationOverview").innerHTML = `
    <div><span>项目总数</span><strong>${projects.length}</strong></div>
    <div><span>进行中</span><strong>${activeProjects.length}</strong></div>
    <div><span>已提交</span><strong>${submittedProjects}</strong></div>
    <div><span>已录取</span><strong>${admittedProjects}</strong></div>`;

  const projectList = document.getElementById("applicationProjects");
  projectList.innerHTML = projects.length ? projects.map(project => `
    <article class="application-project ${applicationSort === "manual" ? "" : "auto-sorted"}" data-application-project="${project.id}">
      ${applicationSort === "manual" ? `<span class="application-drag-handle" data-application-drag-handle tabindex="0"
        role="button" aria-label="拖动调整 ${escapeHtml(project.school)} ${escapeHtml(project.program)} 的顺序"
        title="拖动排序；也可使用上下方向键">⠿</span>` : ""}
      <div class="application-project-main">
        <span class="status-tag">${escapeHtml(project.status)}</span>
        <h3>${escapeHtml(project.school)}</h3>
        <p>${escapeHtml(project.program)}</p>
      </div>
      <dl class="application-project-meta">
        <div><dt>地区</dt><dd>${escapeHtml(project.region || "未填写")}</dd></div>
        <div><dt>截止日期</dt><dd>${project.deadline ? formatDate(project.deadline) : "未填写"}</dd></div>
      </dl>
      <div class="application-project-actions">
        <button class="application-edit-button" data-edit-application="${project.id}">编辑</button>
        <button class="application-delete-button" data-delete-application="${project.id}" aria-label="删除 ${escapeHtml(project.school)} ${escapeHtml(project.program)}">删除</button>
      </div>
    </article>`).join("") : `
      <div class="empty-state application-empty">
        <strong>还没有申请项目</strong>
        <span>新建学校与专业项目后，可在这里集中查看和删除。</span>
        <button class="primary-button" data-open-application>新建项目</button>
      </div>`;

  const summary = document.getElementById("applicationSummary");
  if (!projects.length) {
    summary.className = "empty-state compact";
    summary.textContent = "暂无申请项目。创建后可在这里查看进度。";
    return;
  }
  summary.className = "application-home-summary";
  summary.innerHTML = `
    <div><span>全部项目</span><strong>${projects.length}</strong></div>
    <div><span>进行中</span><strong>${activeProjects.length}</strong></div>
    <div><span>已提交</span><strong>${submittedProjects}</strong></div>`;
}

function applicationOrderFromDom() {
  return [...document.querySelectorAll("[data-application-project]")]
    .map(element => element.dataset.applicationProject);
}

function persistApplicationOrder(order, message = "项目顺序已更新") {
  const projectsById = new Map(state.applications.map(project => [String(project.id), project]));
  const reordered = order.map(projectId => projectsById.get(projectId)).filter(Boolean);
  if (reordered.length !== state.applications.length) return;
  state.applications = reordered;
  state.applicationOrderVersion = 1;
  saveState(message);
}

function moveApplicationWithKeyboard(projectId, direction) {
  const currentIndex = state.applications.findIndex(project => String(project.id) === projectId);
  const nextIndex = currentIndex + direction;
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= state.applications.length) return;
  const reordered = [...state.applications];
  [reordered[currentIndex], reordered[nextIndex]] = [reordered[nextIndex], reordered[currentIndex]];
  persistApplicationOrder(reordered.map(project => String(project.id)));
  requestAnimationFrame(() => {
    document.querySelector(
      `[data-application-project="${CSS.escape(projectId)}"] [data-application-drag-handle]`
    )?.focus();
  });
}

function openApplicationDialog(projectId = "") {
  editingApplicationId = projectId;
  const form = document.getElementById("applicationForm");
  const project = state.applications.find(item => String(item.id) === projectId);
  form.reset();
  document.getElementById("applicationDialogTitle").textContent =
    project ? "编辑申请项目" : "新建申请项目";
  document.getElementById("applicationSubmitButton").textContent =
    project ? "保存修改" : "创建项目";
  if (project) {
    form.elements.school.value = project.school || "";
    form.elements.program.value = project.program || "";
    form.elements.region.value = project.region || "";
    form.elements.deadline.value = project.deadline || "";
    form.elements.status.value = project.status || "考虑中";
  }
  openDialog("applicationDialog");
}

function renderHabits() {
  const mode = sortMode("workouts");
  const workouts = [...state.workouts].sort((a, b) => {
    if (mode === "oldest") return compareText(dateValue(a), dateValue(b));
    if (mode === "name") return compareText(a.type, b.type);
    if (mode === "duration") return Number(b.minutes || 0) - Number(a.minutes || 0);
    return compareText(dateValue(b), dateValue(a));
  });

  document.getElementById("workoutRecords").innerHTML = workouts.length ? workouts.map(item => `
    <article class="record-item">
      <div class="record-head"><strong>${escapeHtml(item.type)}</strong><span class="record-date">${formatDate(item.date)}</span></div>
      <div class="record-result">${item.minutes} 分钟</div>
      <div class="record-note">疲劳：${escapeHtml(item.fatigue)}${item.feeling ? ` · ${escapeHtml(item.feeling)}` : ""}</div>
      <div class="record-footer"><span>真实记录</span><button class="remove-button" data-remove-workout="${item.id}">删除</button></div>
    </article>`).join("") : `<div class="empty-state">暂无运动记录。</div>`;

  const weeklyWorkouts = workouts.filter(item => isThisWeek(item.date)).length;
  const weeklyMinutes = workouts
    .filter(item => isThisWeek(item.date))
    .reduce((sum, item) => sum + Number(item.minutes || 0), 0);
  document.getElementById("workoutCount").textContent = `${weeklyWorkouts} 次`;
  document.getElementById("workoutMinutes").textContent = `${weeklyMinutes} 分钟`;
}

function currentReadingYear() {
  return new Date().getFullYear();
}

function getReadingGoal(year = currentReadingYear()) {
  return state.readingGoals.find(goal => Number(goal.year) === Number(year)) || {
    year,
    targetBooks: 6,
    targetHours: 60,
    themes: ["英文原版", "心理学", "文学"]
  };
}

function getBook(bookId) {
  return state.books.find(book => String(book.id) === String(bookId));
}

function bookProgress(book) {
  if (!book?.totalPages) return 0;
  return Math.min(100, Math.round(Number(book.currentPage || 0) / Number(book.totalPages) * 100));
}

function readingMinutesForYear(year) {
  return state.readingLogs
    .filter(log => String(log.date || "").startsWith(`${year}-`))
    .reduce((sum, log) => sum + Number(log.minutes || 0), 0);
}

function completedBooksForYear(year) {
  return state.books.filter(book =>
    book.status === "已读" &&
    String(book.finishDate || book.startDate || "").startsWith(`${year}-`)
  );
}

function monthLabel(month) {
  const [year, monthNumber] = String(month).split("-");
  return `${year}年${Number(monthNumber)}月`;
}

function renderReadingHomeSummary() {
  const year = currentReadingYear();
  const goal = getReadingGoal(year);
  const completed = completedBooksForYear(year).length;
  const minutes = readingMinutesForYear(year);
  const activeBooks = state.books.filter(book => book.status === "在读");
  document.getElementById("readingHomeSummary").innerHTML = `
    <div class="reading-home-progress">
      <div><span>${year} 年完成</span><strong>${completed} / ${goal.targetBooks} 本</strong></div>
      <div class="reading-progress-track"><i style="width:${Math.min(100, Math.round(completed / Math.max(1, goal.targetBooks) * 100))}%"></i></div>
    </div>
    <div class="reading-home-metrics">
      <div><span>累计阅读</span><strong>${(minutes / 60).toFixed(1)} 小时</strong></div>
      <div><span>当前在读</span><strong>${activeBooks.length} 本</strong></div>
      <div><span>摘抄积累</span><strong>${state.quotes.length} 条</strong></div>
    </div>`;
}

function renderReadingDashboard() {
  const year = currentReadingYear();
  const goal = getReadingGoal(year);
  const completed = completedBooksForYear(year).length;
  const minutes = readingMinutesForYear(year);
  const completion = Math.min(100, Math.round(completed / Math.max(1, goal.targetBooks) * 100));
  const timeCompletion = Math.min(100, Math.round(minutes / Math.max(60, Number(goal.targetHours) * 60) * 100));
  document.getElementById("readingYearLabel").textContent = year;
  document.getElementById("readingKpis").innerHTML = [
    ["年度目标", `${goal.targetBooks} 本`, "以核心任务优先"],
    ["已完成", `${completed} 本`, `${completion}% 书籍目标`],
    ["阅读时间", `${(minutes / 60).toFixed(1)} 小时`, `${timeCompletion}% 时间目标`],
    ["知识资产", `${state.quotes.length + state.bookNotes.length} 条`, `${state.quotes.length} 摘抄 · ${state.bookNotes.length} 笔记`]
  ].map(([label, value, note]) => `<div><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`).join("");

  const readingDashboardSort = sortMode("reading-dashboard");
  const activeBooks = state.books
    .filter(book => book.status === "在读")
    .sort((a, b) => {
      if (readingDashboardSort === "name") return compareText(a.title, b.title);
      if (readingDashboardSort === "progress-desc") return bookProgress(b) - bookProgress(a);
      if (readingDashboardSort === "progress-asc") return bookProgress(a) - bookProgress(b);
      return Number(b.createdAt || 0) - Number(a.createdAt || 0);
    });
  document.getElementById("currentReadingBooks").innerHTML = activeBooks.length ? activeBooks.map(book => `
    <article class="current-book-card">
      <div class="book-mark">${escapeHtml(book.title.slice(0, 1))}</div>
      <div>
        <strong>${escapeHtml(book.title)}</strong>
        <span>${escapeHtml(book.author || "作者未填写")} · ${escapeHtml(book.category)}</span>
        <div class="reading-progress-track"><i style="width:${bookProgress(book)}%"></i></div>
        <small>${book.currentPage} / ${book.totalPages} 页 · ${bookProgress(book)}%</small>
      </div>
      <button class="text-button" data-reading-action="log" data-book-id="${book.id}">继续阅读</button>
    </article>`).join("") : `<div class="empty-state compact">当前没有在读书籍。先从一本与雅思、申请或个人兴趣相关的书开始。</div>`;

  const themes = Array.isArray(goal.themes) ? goal.themes : String(goal.themes || "").split(",").filter(Boolean);
  document.getElementById("readingThemes").innerHTML = themes.length
    ? themes.map(theme => `<span>${escapeHtml(theme.trim())}</span>`).join("")
    : `<span>尚未设置年度主题</span>`;

  const months = [];
  const now = new Date();
  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const value = state.readingLogs
      .filter(log => String(log.date || "").startsWith(key))
      .reduce((sum, log) => sum + Number(log.minutes || 0), 0);
    months.push({ label: `${date.getMonth() + 1}月`, value });
  }
  const max = Math.max(60, ...months.map(item => item.value));
  document.getElementById("readingTrend").innerHTML = months.map(item => `
    <div class="trend-column">
      <span>${item.value}</span>
      <div><i style="height:${Math.max(4, Math.round(item.value / max * 100))}%"></i></div>
      <small>${item.label}</small>
    </div>`).join("");
}

function renderMonthlyPlans() {
  const mode = sortMode("reading-monthly");
  const plans = [...state.monthlyReadingPlans].sort((a, b) => {
    if (mode === "oldest") return compareText(a.month, b.month);
    if (mode === "name") return compareText(a.theme, b.theme) || compareText(b.month, a.month);
    return compareText(b.month, a.month);
  });
  document.getElementById("monthlyPlans").innerHTML = plans.length ? plans.map(plan => {
    const logs = state.readingLogs.filter(log => String(log.date || "").startsWith(plan.month));
    const pages = logs.reduce((sum, log) => sum + Number(log.pagesRead || 0), 0);
    const minutes = logs.reduce((sum, log) => sum + Number(log.minutes || 0), 0);
    const progress = Math.min(100, Math.round((pages / Math.max(1, plan.targetPages) + minutes / Math.max(1, plan.targetMinutes)) / 2 * 100));
    return `<article class="monthly-plan-card">
      <div class="monthly-plan-head">
        <div><span>${monthLabel(plan.month)}</span><strong>${escapeHtml(plan.targetBooks)}</strong></div>
        <button class="remove-button" data-remove-monthly-plan="${plan.id}">删除</button>
      </div>
      <div class="monthly-plan-metrics">
        <div><span>页数</span><strong>${pages} / ${plan.targetPages}</strong></div>
        <div><span>时间</span><strong>${minutes} / ${plan.targetMinutes} 分钟</strong></div>
        <div><span>主题</span><strong>${escapeHtml(plan.theme || "未设置")}</strong></div>
      </div>
      <div class="reading-progress-track"><i style="width:${progress}%"></i></div>
      <p>${escapeHtml(plan.summary || "月度总结尚未填写。")}</p>
    </article>`;
  }).join("") : `<div class="empty-state">还没有月度计划。建议每月只安排一本主读书或一个明确章节目标。</div>`;
}

function renderBookLibrary() {
  const search = bookSearch.trim().toLowerCase();
  const mode = sortMode("reading-library");
  const books = [...state.books]
    .filter(book => bookCategoryFilter === "all" || book.category === bookCategoryFilter)
    .filter(book => !search || `${book.title} ${book.author}`.toLowerCase().includes(search))
    .sort((a, b) => {
      if (mode === "oldest") return Number(a.createdAt || 0) - Number(b.createdAt || 0);
      if (mode === "name") return compareText(a.title, b.title);
      if (mode === "progress-desc") return bookProgress(b) - bookProgress(a);
      if (mode === "rating") return Number(b.rating || 0) - Number(a.rating || 0);
      return Number(b.createdAt || 0) - Number(a.createdAt || 0);
    });
  document.getElementById("bookLibrary").innerHTML = books.length ? books.map(book => `
    <article class="library-book-card">
      <div class="library-book-cover"><span>${escapeHtml(book.title.slice(0, 1))}</span><small>${escapeHtml(book.language)}</small></div>
      <div class="library-book-body">
        <div class="library-book-top"><span class="status-tag purple">${escapeHtml(book.status)}</span><button class="remove-button" data-remove-book="${book.id}">删除</button></div>
        <h3>${escapeHtml(book.title)}</h3>
        <p>${escapeHtml(book.author || "作者未填写")}</p>
        <div class="book-meta-row"><span>${escapeHtml(book.category)}</span><span>${book.rating ? `${book.rating} / 5` : "未评分"}</span></div>
        <div class="book-date-row"><span>开始 ${book.startDate || "未设置"}</span><span>完成 ${book.finishDate || "未完成"}</span></div>
        <div class="reading-progress-track"><i style="width:${bookProgress(book)}%"></i></div>
        <div class="book-progress-label"><span>${book.currentPage} / ${book.totalPages} 页</span><strong>${bookProgress(book)}%</strong></div>
        <button class="secondary-button full-width" data-reading-action="log" data-book-id="${book.id}">记录阅读</button>
      </div>
    </article>`).join("") : `<div class="empty-state">没有找到书籍。添加第一本书后，可以持续记录进度、摘抄与思考。</div>`;
}

function renderReadingLogs() {
  const mode = sortMode("reading-logs");
  const logs = [...state.readingLogs].sort((a, b) => {
    if (mode === "oldest") {
      return compareText(a.date, b.date) || Number(a.createdAt || 0) - Number(b.createdAt || 0);
    }
    if (mode === "name") return compareText(getBook(a.bookId)?.title, getBook(b.bookId)?.title);
    if (mode === "duration") return Number(b.minutes || 0) - Number(a.minutes || 0);
    return compareText(b.date, a.date) || Number(b.createdAt || 0) - Number(a.createdAt || 0);
  });
  document.getElementById("readingLogList").innerHTML = logs.length ? logs.map(log => {
    const book = getBook(log.bookId);
    return `<article class="reading-log-card">
      <div class="reading-log-date"><strong>${String(log.date).slice(8, 10)}</strong><span>${String(log.date).slice(5, 7)}月</span></div>
      <div class="reading-log-content">
        <div class="reading-log-head"><div><span>${escapeHtml(book?.title || "已删除书籍")}</span><strong>${escapeHtml(log.chapter || "自由阅读")}</strong></div><button class="remove-button" data-remove-reading-log="${log.id}">删除</button></div>
        <div class="reading-log-stats"><span>${log.pagesRead || 0} 页</span><span>${log.minutes || 0} 分钟</span><span>读至 ${log.currentPage || 0} 页</span></div>
        ${log.summary ? `<p><b>内容总结</b>${escapeHtml(log.summary)}</p>` : ""}
        ${log.takeaway ? `<p><b>今日收获</b>${escapeHtml(log.takeaway)}</p>` : ""}
        ${log.keyIdea ? `<blockquote>${escapeHtml(log.keyIdea)}</blockquote>` : ""}
        ${log.reflection ? `<p><b>我的思考</b>${escapeHtml(log.reflection)}</p>` : ""}
      </div>
    </article>`;
  }).join("") : `<div class="empty-state">暂无阅读记录。手机端可直接点击右上角“快速记录”。</div>`;
}

function renderQuoteBank() {
  const mode = sortMode("reading-quotes");
  const quotes = [...state.quotes].sort((a, b) => {
    if (mode === "oldest") return Number(a.createdAt || 0) - Number(b.createdAt || 0);
    if (mode === "name") return compareText(getBook(a.bookId)?.title, getBook(b.bookId)?.title);
    return Number(b.createdAt || 0) - Number(a.createdAt || 0);
  });
  document.getElementById("quoteBank").innerHTML = quotes.length ? quotes.map(quote => {
    const book = getBook(quote.bookId);
    return `<article class="quote-card ${escapeHtml(quote.highlight || "yellow")}">
      <div class="quote-card-head"><span>${escapeHtml(quote.language || "中文")}</span><button class="remove-button" data-remove-quote="${quote.id}">删除</button></div>
      <blockquote>${escapeHtml(quote.content)}</blockquote>
      ${quote.image ? `<img class="quote-image" src="${quote.image}" alt="摘抄图片">` : ""}
      <p class="quote-source">《${escapeHtml(book?.title || "已删除书籍")}》${quote.page ? ` · 第 ${quote.page} 页` : ""}</p>
      <div class="quote-tags">${(quote.tags || []).map(tag => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
      ${quote.understanding ? `<p><b>我的理解</b>${escapeHtml(quote.understanding)}</p>` : ""}
      ${quote.application ? `<p><b>可以应用</b>${escapeHtml(quote.application)}</p>` : ""}
    </article>`;
  }).join("") : `<div class="empty-state">摘抄库还是空的。保存真正值得反复回看的句子，并写下自己的理解。</div>`;
}

function renderBookNotes() {
  const mode = sortMode("reading-notes");
  const notes = [...state.bookNotes].sort((a, b) => {
    if (mode === "oldest") return Number(a.createdAt || 0) - Number(b.createdAt || 0);
    if (mode === "name") return compareText(getBook(a.bookId)?.title, getBook(b.bookId)?.title);
    return Number(b.createdAt || 0) - Number(a.createdAt || 0);
  });
  document.getElementById("bookNotes").innerHTML = notes.length ? notes.map(note => {
    const book = getBook(note.bookId);
    return `<article class="book-note-card">
      <div class="book-note-head"><div><span>Reading Reflection</span><h3>${escapeHtml(book?.title || "已删除书籍")}</h3></div><button class="remove-button" data-remove-book-note="${note.id}">删除</button></div>
      <section><strong>书籍核心观点</strong><p>${escapeHtml(note.coreIdeas)}</p></section>
      ${note.understanding ? `<section><strong>我的理解</strong><p>${escapeHtml(note.understanding)}</p></section>` : ""}
      ${note.insights ? `<section><strong>三个启发</strong><p>${escapeHtml(note.insights)}</p></section>` : ""}
      ${note.experience ? `<section><strong>与我的经历联系</strong><p>${escapeHtml(note.experience)}</p></section>` : ""}
      ${note.impact ? `<section><strong>未来影响</strong><p>${escapeHtml(note.impact)}</p></section>` : ""}
      ${note.application ? `<section><strong>实际应用</strong><p>${escapeHtml(note.application)}</p></section>` : ""}
    </article>`;
  }).join("") : `<div class="empty-state">完成一本书后，用自己的语言写下核心观点、三个启发和可执行的应用。</div>`;
}

function populateBookOptions(selectedBookId = "") {
  document.querySelectorAll("[data-book-options]").forEach(select => {
    select.innerHTML = state.books.length
      ? state.books.map(book => `<option value="${book.id}" ${String(book.id) === String(selectedBookId) ? "selected" : ""}>${escapeHtml(book.title)}</option>`).join("")
      : `<option value="">请先添加书籍</option>`;
  });
}

function renderReading() {
  renderReadingHomeSummary();
  renderReadingDashboard();
  renderMonthlyPlans();
  renderBookLibrary();
  renderReadingLogs();
  renderQuoteBank();
  renderBookNotes();
  populateBookOptions();
}

function switchReadingTab(tab) {
  activeReadingTab = tab;
  document.querySelectorAll("[data-reading-tab]").forEach(button => {
    button.classList.toggle("active", button.dataset.readingTab === tab);
  });
  document.querySelectorAll(".reading-module").forEach(module => module.classList.remove("active"));
  const moduleName = `${tab.charAt(0).toUpperCase()}${tab.slice(1)}`;
  document.getElementById(`reading${moduleName}Module`)?.classList.add("active");
  if (activeView === "reading") updatePageSort();
}

function openReadingAction(action, selectedBookId = "") {
  const dialogMap = {
    goal: "readingGoalDialog",
    month: "monthlyPlanDialog",
    book: "bookDialog",
    log: "readingLogDialog",
    quote: "quoteDialog",
    note: "bookNoteDialog"
  };
  if (["log", "quote", "note"].includes(action) && !state.books.length) {
    showToast("请先添加一本书");
    openDialog("bookDialog");
    return;
  }
  if (action === "goal") {
    const goal = getReadingGoal();
    const form = document.getElementById("readingGoalForm");
    form.elements.year.value = goal.year;
    form.elements.targetBooks.value = goal.targetBooks;
    form.elements.targetHours.value = goal.targetHours;
    form.elements.themes.value = (goal.themes || []).join(", ");
  }
  if (action === "month") {
    document.getElementById("monthlyPlanForm").elements.month.value = localDate().slice(0, 7);
  }
  if (action === "log") {
    const form = document.getElementById("readingLogForm");
    form.elements.date.value = localDate();
    populateBookOptions(selectedBookId);
    const book = getBook(selectedBookId) || state.books[0];
    form.elements.currentPage.value = book?.currentPage || 0;
  }
  if (["quote", "note"].includes(action)) populateBookOptions(selectedBookId);
  openDialog(dialogMap[action]);
}

function journalStreak() {
  const dates = new Set(state.journals.map(j => j.date));
  let streak = 0;
  const date = new Date();
  while (dates.has(localDate(date))) {
    streak += 1;
    date.setDate(date.getDate() - 1);
  }
  return streak;
}

function renderJournals() {
  const today = localDate();
  const journal = state.journals.find(j => j.date === today);
  const form = document.getElementById("journalForm");
  ["gratitude", "improvements", "affirmation"].forEach(field => {
    form.elements[field].value = journal?.[field] || "";
  });
  document.getElementById("journalStreak").textContent = `${journalStreak()} 天`;
  document.getElementById("journalCount").textContent = `${state.journals.filter(j => isThisWeek(j.date)).length} 篇`;
}

function renderGrowth() {
  const tasks = state.tasks.filter(t => isThisWeek(t.date));
  const completed = tasks.filter(t => t.done).length;
  const ieltsMinutes = state.ielts.filter(i => isThisWeek(i.date)).reduce((sum, item) => sum + Number(item.minutes || 0), 0);
  const workouts = state.workouts.filter(w => isThisWeek(w.date)).length;
  const journalCount = state.journals.filter(j => isThisWeek(j.date)).length;
  let stats = [
    ["任务完成率", tasks.length ? `${Math.round(completed / tasks.length * 100)}%` : "暂无足够记录"],
    ["雅思投入", ieltsMinutes ? `${(ieltsMinutes / 60).toFixed(1)} 小时` : "暂无足够记录"],
    ["运动次数", workouts ? `${workouts} 次` : "暂无足够记录"],
    ["日记天数", journalCount ? `${journalCount} 天` : "暂无足够记录"]
  ];
  if (sortMode("growth") === "name") {
    stats = stats.sort((a, b) => compareText(a[0], b[0]));
  }
  document.getElementById("weeklyStats").innerHTML = stats.map(([label, value]) =>
    `<div><span>${label}</span><strong>${value}</strong></div>`).join("");

  const enough = journalCount >= 3 || state.ielts.filter(i => isThisWeek(i.date)).length >= 3;
  const advice = document.getElementById("weeklyAdvice");
  const summary = document.getElementById("growthSummary");
  if (!enough) {
    advice.className = "empty-state";
    advice.textContent = "暂无足够记录。累积至少 3 天记录后，再根据事实提出调整建议。";
    summary.className = "empty-state compact";
    summary.textContent = "累积至少 3 天记录后，这里会显示基于真实数据的阶段总结。";
    return;
  }

  const completionText = tasks.length
    ? `本周任务完成率为 ${Math.round(completed / tasks.length * 100)}%。`
    : "本周任务数据不足。";
  const ieltsText = ieltsMinutes ? `雅思累计投入 ${(ieltsMinutes / 60).toFixed(1)} 小时。` : "雅思投入数据不足。";
  advice.className = "empty-state";
  advice.textContent = `${completionText}${ieltsText} 下周先保留三项最高优先级，未完成任务重新判断，不自动累积。`;
  summary.className = "empty-state compact";
  summary.textContent = `${completionText}${ieltsText} 已运动 ${workouts} 次，记录日记 ${journalCount} 天。`;
}

function renderProfile() {
  const form = document.getElementById("profileForm");
  form.elements.displayName.value = state.profile.displayName || "";
  form.elements.examDate.value = state.profile.examDate || "";
  form.elements.studyHours.value = state.profile.studyHours || "";
}

function speakingStatusLabel(status) {
  return {
    not_started: "未学习",
    learning: "学习中",
    mastered: "已掌握"
  }[status] || "未学习";
}

function speakingPartDescription(part) {
  return {
    1: "短回答训练",
    2: "Cue Card 素材",
    3: "深度观点训练"
  }[part];
}

function getSpeakingTopic(topicId = activeSpeakingTopicId) {
  return state.speakingTopics.find(topic => topic.id === topicId);
}

function getSpeakingQuestion(questionId = activeSpeakingQuestionId) {
  return state.speakingQuestions.find(question => question.id === questionId);
}

function speakingTopicColor(topic) {
  const palette = ["#303030", "#686868", "#9a9a9a", "#c2c2c2"];
  if (palette.includes(topic.color)) return topic.color;
  const seed = [...topic.title].reduce((total, character) => total + character.charCodeAt(0), topic.part);
  return palette[seed % palette.length];
}

function normalizeSpeakingKeywords(question) {
  const rawKeywords = question?.keywords;
  const values = Array.isArray(rawKeywords)
    ? rawKeywords
    : String(rawKeywords || "").split(/[,，\n]/);
  const keywords = values.map(item => {
    if (item && typeof item === "object") {
      return {
        id: String(item.id || id()),
        text: String(item.text || "").trim(),
        starred: Boolean(item.starred)
      };
    }
    return { id: id(), text: String(item || "").trim(), starred: false };
  }).filter(item => item.text);
  if (question) question.keywords = keywords;
  return keywords;
}

function speakingKeywordText(question) {
  return normalizeSpeakingKeywords(question).map(keyword => keyword.text).join(" ");
}

function renderSpeakingSummary() {
  const questions = state.speakingQuestions;
  document.getElementById("speakingQuestionCount").textContent = questions.length;
  document.getElementById("speakingLearningCount").textContent =
    questions.filter(question => question.reviewStatus === "learning").length;
  document.getElementById("speakingMasteredCount").textContent =
    questions.filter(question => question.reviewStatus === "mastered").length;
}

function renderSpeakingKnowledgeBase() {
  renderSpeakingSummary();
  const speakingSort = sortMode("speaking");

  document.querySelectorAll("[data-speaking-part]").forEach(button => {
    button.classList.toggle("active", Number(button.dataset.speakingPart) === activeSpeakingPart);
  });

  const topics = state.speakingTopics
    .filter(topic => topic.part === activeSpeakingPart)
    .sort((a, b) => {
      if (speakingSort === "oldest") return Number(a.createdAt || 0) - Number(b.createdAt || 0);
      if (speakingSort === "name") return compareText(a.title, b.title);
      return Number(b.createdAt || 0) - Number(a.createdAt || 0);
    });
  if (!topics.some(topic => topic.id === activeSpeakingTopicId)) {
    activeSpeakingTopicId = topics[0]?.id || "";
  }

  const topicList = document.getElementById("speakingTopicList");
  topicList.innerHTML = topics.length ? topics.map(topic => {
    const count = state.speakingQuestions.filter(question => question.topicId === topic.id).length;
    return `<div class="speaking-list-row">
      <button class="speaking-topic ${topic.id === activeSpeakingTopicId ? "active" : ""}" data-speaking-topic="${topic.id}">
        <i style="background:${speakingTopicColor(topic)}"></i>
        <span>${escapeHtml(topic.title)}</span>
        <em>${count}</em>
      </button>
      <div class="speaking-item-actions">
        <button class="speaking-item-edit" data-edit-speaking-topic="${topic.id}" title="编辑 ${escapeHtml(topic.title)}">编辑话题</button>
        <button class="speaking-item-delete" data-delete-speaking-topic-id="${topic.id}" title="删除 ${escapeHtml(topic.title)}">删除话题</button>
      </div>
    </div>`;
  }).join("") : `<div class="speaking-list-empty">还没有 Part ${activeSpeakingPart} 话题。</div>`;

  const activeTopic = getSpeakingTopic();
  document.getElementById("speakingQuestionPaneTitle").textContent =
    activeTopic ? activeTopic.title : "Questions";

  const search = speakingSearch.trim().toLowerCase();
  let questions = state.speakingQuestions.filter(question => question.topicId === activeSpeakingTopicId);
  if (speakingStatusFilter !== "all") {
    questions = questions.filter(question => question.reviewStatus === speakingStatusFilter);
  }
  if (search) {
    questions = questions.filter(question => [
      question.question, question.original, question.improved, question.final,
      speakingKeywordText(question), question.notes, question.storyMaterial, question.opinion,
      ...(question.tags || [])
    ].join(" ").toLowerCase().includes(search));
  }
  questions.sort((a, b) => {
    const statusOrder = { not_started: 0, learning: 1, mastered: 2 };
    if (speakingSort === "oldest") return Number(a.createdAt || 0) - Number(b.createdAt || 0);
    if (speakingSort === "name") return compareText(a.question, b.question);
    if (speakingSort === "status") {
      return (statusOrder[a.reviewStatus] ?? 9) - (statusOrder[b.reviewStatus] ?? 9)
        || compareText(a.question, b.question);
    }
    return Number(b.createdAt || 0) - Number(a.createdAt || 0);
  });

  if (!questions.some(question => question.id === activeSpeakingQuestionId)) {
    activeSpeakingQuestionId = questions[0]?.id || "";
  }

  const questionList = document.getElementById("speakingQuestionList");
  questionList.innerHTML = questions.length ? questions.map(question => `
    <div class="speaking-list-row speaking-question-row">
      <button class="speaking-question ${question.id === activeSpeakingQuestionId ? "active" : ""}" data-speaking-question="${question.id}">
        <strong>${escapeHtml(question.question)}</strong>
        <span><i class="${escapeHtml(question.reviewStatus)}"></i>${speakingStatusLabel(question.reviewStatus)} · ${(question.tags || []).length} 标签</span>
      </button>
      <div class="speaking-item-actions">
        <button class="speaking-item-edit" data-edit-speaking-question="${question.id}" title="编辑题目">编辑题目</button>
        <button class="speaking-item-delete" data-delete-speaking-question-id="${question.id}" title="删除题目">删除题目</button>
      </div>
    </div>`).join("") : `<div class="speaking-list-empty">当前筛选下没有问题。</div>`;

  renderSpeakingEditor();
}

function speakingTextField(label, field, value, placeholder, rows = 3) {
  return `<label class="speaking-field">${label}
    <textarea rows="${rows}" data-speaking-field="${field}" placeholder="${escapeHtml(placeholder)}">${escapeHtml(value || "")}</textarea>
  </label>`;
}

function speakingAnswerCard(value) {
  return `<section class="answer-version">
    <div class="answer-version-head">
      <div><strong>Answer</strong><small>记录并整理你的口语回答</small></div>
    </div>
    <div class="annotation-toolbar" aria-label="答案格式工具">
      <span>选择文字后标记</span>
      <button class="highlight-red" data-answer-highlight="#ecc5c2" title="错误或待修改" aria-label="红色：错误或待修改"></button>
      <button class="highlight-blue" data-answer-highlight="#c9dce8" title="重要表达" aria-label="蓝色：重要表达"></button>
      <button class="highlight-gray" data-answer-highlight="#dededc" title="补充信息" aria-label="灰色：补充信息"></button>
      <button class="format-button" data-answer-command="bold" title="加粗" aria-label="加粗"><strong>B</strong></button>
      <button class="format-button underline-button" data-answer-command="underline" title="下划线" aria-label="下划线">U</button>
      <button class="clear-highlight" data-answer-highlight="transparent">清除</button>
    </div>
    <div class="answer-content" contenteditable="true" data-speaking-answer="original" data-placeholder="输入或编辑 Answer">${value || ""}</div>
  </section>`;
}

function speakingKeywordSection(question) {
  const keywords = [...normalizeSpeakingKeywords(question)]
    .sort((a, b) => Number(b.starred) - Number(a.starred));
  return `<section class="speaking-keyword-section" id="speakingKeywordSection">
    <div class="speaking-keyword-heading">
      <div><strong>关键词</strong><small>点亮星标可标记重点关键词</small></div>
      <span>${keywords.length} 个</span>
    </div>
    <div class="speaking-keyword-entry">
      <input id="speakingKeywordInput" maxlength="40" placeholder="输入一个关键词">
      <button class="secondary-button" type="button" data-add-speaking-keyword>添加</button>
    </div>
    <div class="speaking-keyword-list">
      ${keywords.length ? keywords.map(keyword => `
        <div class="speaking-keyword ${keyword.starred ? "starred" : ""}">
          <button class="speaking-keyword-star" type="button"
            data-toggle-speaking-keyword="${keyword.id}"
            aria-label="${keyword.starred ? "取消重点" : "标记为重点"}"
            aria-pressed="${keyword.starred}">${keyword.starred ? "★" : "☆"}</button>
          <span>${escapeHtml(keyword.text)}</span>
          <button class="speaking-keyword-remove" type="button"
            data-remove-speaking-keyword="${keyword.id}"
            aria-label="删除关键词 ${escapeHtml(keyword.text)}">×</button>
        </div>`).join("") : `<div class="speaking-keyword-empty">还没有关键词，逐个添加后会整齐排列在这里。</div>`}
    </div>
  </section>`;
}

function renderSpeakingEditor() {
  const editor = document.getElementById("speakingEditor");
  const question = getSpeakingQuestion();
  if (!question) {
    editor.innerHTML = `<div class="speaking-empty">
      <strong>选择或添加一个问题</strong>
      <span>Answer、关键词与批注会显示在这里。</span>
    </div>`;
    return;
  }

  const topic = getSpeakingTopic(question.topicId);
  const specialFields = question.part === 2 ? `
    ${speakingTextField("我的故事素材", "storyMaterial", question.storyMaterial, "记录人物、地点、时间、冲突与结果", 4)}
    ${speakingTextField("相关 Part 3 问题", "relatedPart3", question.relatedPart3, "每行一个延伸问题", 3)}
  ` : question.part === 3 ? `
    ${speakingTextField("My Opinion", "opinion", question.opinion, "先写一句明确立场", 3)}
    ${speakingTextField("Supporting Examples", "supportingExamples", question.supportingExamples, "添加原因、案例或对比", 3)}
  ` : "";

  editor.innerHTML = `<div class="speaking-editor-scroll">
    <div class="speaking-editor-heading">
      <div>
        <p class="eyebrow">Part ${question.part} · ${escapeHtml(topic?.title || "")}</p>
        <h3>${escapeHtml(question.question)}</h3>
      </div>
      <div class="speaking-editor-actions">
        <select data-speaking-field="reviewStatus" aria-label="复习状态">
          <option value="not_started" ${question.reviewStatus === "not_started" ? "selected" : ""}>未学习</option>
          <option value="learning" ${question.reviewStatus === "learning" ? "selected" : ""}>学习中</option>
          <option value="mastered" ${question.reviewStatus === "mastered" ? "selected" : ""}>已掌握</option>
        </select>
        <button class="edit-speaking-button" data-edit-speaking-question="${question.id}">编辑题目</button>
        <button class="delete-speaking-button" data-delete-speaking-question>删除题目</button>
      </div>
    </div>

    <div class="speaking-tag-row">
      ${(question.tags || []).map(tag => `<span>${escapeHtml(tag)}<button data-remove-speaking-tag="${escapeHtml(tag)}" aria-label="删除标签">×</button></span>`).join("")}
      <input id="speakingTagInput" placeholder="+ 添加标签">
    </div>

    ${speakingAnswerCard(question.original || question.final || question.improved)}
    ${speakingKeywordSection(question)}
    ${specialFields}
    ${speakingTextField("Notes / Comments", "notes", question.notes, "例如：适合 Technology 话题；这个句型可用于 Part 3；考试容易忘记", 4)}
  </div>`;
}

function updateSpeakingField(field, value) {
  const question = getSpeakingQuestion();
  if (!question) return;
  question[field] = value;
  question.updatedAt = Date.now();
  writeLocalState();
  setCloudStatus(cloudUser ? "等待云同步" : "本机数据已保存", cloudUser ? "syncing" : "local");
}

function saveSpeakingKeywords(message) {
  const question = getSpeakingQuestion();
  if (!question) return;
  question.updatedAt = Date.now();
  writeLocalState();
  setCloudStatus(cloudUser ? "等待云同步" : "本机数据已保存", cloudUser ? "syncing" : "local");
  const section = document.getElementById("speakingKeywordSection");
  if (section) section.outerHTML = speakingKeywordSection(question);
  showToast(message);
}

function addSpeakingKeyword() {
  const question = getSpeakingQuestion();
  const input = document.getElementById("speakingKeywordInput");
  const text = input?.value.trim();
  if (!question || !text) return;
  const keywords = normalizeSpeakingKeywords(question);
  if (keywords.some(keyword => keyword.text.toLowerCase() === text.toLowerCase())) {
    showToast("这个关键词已经存在");
    input.select();
    return;
  }
  keywords.push({ id: id(), text, starred: false });
  question.keywords = keywords;
  saveSpeakingKeywords("关键词已添加");
  requestAnimationFrame(() => document.getElementById("speakingKeywordInput")?.focus());
}

function openSpeakingTopicDialog(topicId = "") {
  editingSpeakingTopicId = topicId;
  const form = document.getElementById("speakingTopicForm");
  const topic = getSpeakingTopic(topicId);
  form.reset();
  document.getElementById("speakingTopicDialogTitle").textContent =
    topic ? "编辑口语话题" : "新建口语话题";
  document.getElementById("speakingTopicSubmitButton").textContent =
    topic ? "保存修改" : "创建话题";
  form.elements.part.value = String(topic?.part || activeSpeakingPart);
  form.elements.title.value = topic?.title || "";
  form.elements.color.value = topic?.color || "#303030";
  openDialog("speakingTopicDialog");
}

function openSpeakingQuestionDialog(questionId = "") {
  editingSpeakingQuestionId = questionId;
  const editingQuestion = getSpeakingQuestion(questionId);
  if (editingQuestion) {
    activeSpeakingPart = editingQuestion.part;
    activeSpeakingTopicId = editingQuestion.topicId;
    activeSpeakingQuestionId = editingQuestion.id;
  }
  const topics = state.speakingTopics.filter(topic => topic.part === activeSpeakingPart);
  if (!topics.length) {
    showToast("请先创建当前 Part 的话题");
    openSpeakingTopicDialog();
    return;
  }
  document.getElementById("speakingQuestionDialogTitle").textContent =
    editingQuestion
      ? (activeSpeakingPart === 2 ? "编辑 Cue Card" : `编辑 Part ${activeSpeakingPart} 问题`)
      : (activeSpeakingPart === 2 ? "添加 Cue Card" : `添加 Part ${activeSpeakingPart} 问题`);
  document.getElementById("speakingQuestionLabel").textContent =
    activeSpeakingPart === 2 ? "Cue Card 题目" : "Question";
  document.getElementById("speakingQuestionSubmitButton").textContent =
    editingQuestion ? "保存修改" : "添加到题库";
  document.getElementById("speakingQuestionTopic").innerHTML = topics.map(topic =>
    `<option value="${topic.id}" ${topic.id === (editingQuestion?.topicId || activeSpeakingTopicId) ? "selected" : ""}>${escapeHtml(topic.title)}</option>`
  ).join("");
  const form = document.getElementById("speakingQuestionForm");
  form.elements.question.value = editingQuestion?.question || "";
  form.elements.tags.value = editingQuestion
    ? (editingQuestion.tags || []).filter(tag => tag !== `Part ${editingQuestion.part}`).join(", ")
    : "";
  openDialog("speakingQuestionDialog");
}

function renderAll() {
  renderDate();
  renderTasks();
  renderDailyStatus();
  renderIelts();
  renderApplications();
  renderSpeakingKnowledgeBase();
  renderHabits();
  renderReading();
  renderJournals();
  renderGrowth();
  renderProfile();
}

function openDialog(id) {
  document.getElementById(id).showModal();
}

function switchIeltsTab(tab) {
  activeIeltsTab = tab;
  document.getElementById("ieltsRecordsModule").hidden = tab !== "records";
  document.getElementById("speakingModule").hidden = tab !== "speaking";
  document.querySelectorAll("[data-ielts-tab]").forEach(button => {
    button.classList.toggle("active", button.dataset.ieltsTab === tab);
  });
  document.getElementById("openSpeakingTopic").hidden = tab !== "speaking";
  document.getElementById("openIelts").hidden = tab !== "records";
  if (tab === "speaking") renderSpeakingKnowledgeBase();
  if (activeView === "ielts") updatePageSort();
}

document.addEventListener("click", event => {
  const closeDialogButton = event.target.closest("[data-close-dialog]");
  if (closeDialogButton) {
    event.preventDefault();
    closeDialogButton.closest("dialog")?.close();
    return;
  }

  const viewButton = event.target.closest("[data-view]");
  if (viewButton) switchView(viewButton.dataset.view);

  const viewTarget = event.target.closest("[data-view-target]");
  if (viewTarget) switchView(viewTarget.dataset.viewTarget);

  if (event.target.closest("[data-open-account]")) {
    openAccountDialog();
    return;
  }

  if (event.target.closest("[data-open-task]")) openDialog("taskDialog");
  if (event.target.closest("[data-open-application]")) openApplicationDialog();

  const editApplication = event.target.closest("[data-edit-application]");
  if (editApplication) {
    openApplicationDialog(editApplication.dataset.editApplication);
    return;
  }

  const ieltsTab = event.target.closest("[data-ielts-tab]");
  if (ieltsTab) switchIeltsTab(ieltsTab.dataset.ieltsTab);

  const readingTab = event.target.closest("[data-reading-tab]");
  if (readingTab) switchReadingTab(readingTab.dataset.readingTab);

  const readingAction = event.target.closest("[data-reading-action]");
  if (readingAction) {
    openReadingAction(readingAction.dataset.readingAction, readingAction.dataset.bookId || "");
  }

  const speakingPart = event.target.closest("[data-speaking-part]");
  if (speakingPart) {
    activeSpeakingPart = Number(speakingPart.dataset.speakingPart);
    activeSpeakingTopicId = "";
    activeSpeakingQuestionId = "";
    renderSpeakingKnowledgeBase();
  }

  const speakingTopic = event.target.closest("[data-speaking-topic]");
  if (speakingTopic) {
    activeSpeakingTopicId = speakingTopic.dataset.speakingTopic;
    activeSpeakingQuestionId = "";
    renderSpeakingKnowledgeBase();
  }

  const speakingQuestion = event.target.closest("[data-speaking-question]");
  if (speakingQuestion) {
    activeSpeakingQuestionId = speakingQuestion.dataset.speakingQuestion;
    renderSpeakingKnowledgeBase();
  }

  if (event.target.closest("[data-open-speaking-topic]")) {
    openSpeakingTopicDialog();
  }
  if (event.target.closest("[data-open-speaking-question]")) openSpeakingQuestionDialog();

  const editSpeakingTopic = event.target.closest("[data-edit-speaking-topic]");
  if (editSpeakingTopic) {
    openSpeakingTopicDialog(editSpeakingTopic.dataset.editSpeakingTopic);
    return;
  }

  if (event.target.closest("[data-edit-current-speaking-topic]")) {
    const topic = getSpeakingTopic();
    if (!topic) {
      showToast("当前没有可编辑的话题");
      return;
    }
    openSpeakingTopicDialog(topic.id);
    return;
  }

  const editSpeakingQuestion = event.target.closest("[data-edit-speaking-question]");
  if (editSpeakingQuestion) {
    openSpeakingQuestionDialog(editSpeakingQuestion.dataset.editSpeakingQuestion);
    return;
  }

  if (event.target.closest("[data-edit-current-speaking-question]")) {
    const question = getSpeakingQuestion();
    if (!question) {
      showToast("当前没有可编辑的题目");
      return;
    }
    openSpeakingQuestionDialog(question.id);
    return;
  }

  const deleteSpeakingTopic = event.target.closest("[data-delete-speaking-topic-id], [data-delete-speaking-topic]");
  if (deleteSpeakingTopic) {
    const topic = getSpeakingTopic(deleteSpeakingTopic.dataset.deleteSpeakingTopicId);
    if (!topic) {
      showToast("当前没有可删除的话题");
      return;
    }
    const questionCount = state.speakingQuestions.filter(question => question.topicId === topic.id).length;
    const message = questionCount
      ? `确认删除“${topic.title}”话题及其下 ${questionCount} 道题目？此操作无法撤销。`
      : `确认删除“${topic.title}”话题？此操作无法撤销。`;
    if (!confirm(message)) return;
    state.speakingTopics = state.speakingTopics.filter(item => item.id !== topic.id);
    state.speakingQuestions = state.speakingQuestions.filter(question => question.topicId !== topic.id);
    activeSpeakingTopicId = "";
    activeSpeakingQuestionId = "";
    saveState("话题及相关题目已删除");
    return;
  }

  const deleteSpeakingQuestion = event.target.closest("[data-delete-speaking-question-id], [data-delete-speaking-question]");
  if (deleteSpeakingQuestion) {
    const question = getSpeakingQuestion(deleteSpeakingQuestion.dataset.deleteSpeakingQuestionId);
    if (!question) {
      showToast("当前没有可删除的题目");
      return;
    }
    if (!confirm(`确认删除题目“${question.question}”？此操作无法撤销。`)) return;
    state.speakingQuestions = state.speakingQuestions.filter(item => item.id !== question.id);
    activeSpeakingQuestionId = "";
    saveState("题目已删除");
    return;
  }

  const deleteApplication = event.target.closest("[data-delete-application]");
  if (deleteApplication) {
    const project = state.applications.find(item => item.id === deleteApplication.dataset.deleteApplication);
    if (!project) return;
    if (!confirm(`确认删除“${project.school} · ${project.program}”项目？此操作无法撤销。`)) return;
    state.applications = state.applications.filter(item => item.id !== project.id);
    saveState("申请项目已删除");
    return;
  }

  const removeSpeakingTag = event.target.closest("[data-remove-speaking-tag]");
  if (removeSpeakingTag) {
    const question = getSpeakingQuestion();
    question.tags = (question.tags || []).filter(tag => tag !== removeSpeakingTag.dataset.removeSpeakingTag);
    saveState("标签已删除");
  }

  if (event.target.closest("[data-add-speaking-keyword]")) {
    addSpeakingKeyword();
    return;
  }

  const toggleSpeakingKeyword = event.target.closest("[data-toggle-speaking-keyword]");
  if (toggleSpeakingKeyword) {
    const question = getSpeakingQuestion();
    const keyword = normalizeSpeakingKeywords(question)
      .find(item => item.id === toggleSpeakingKeyword.dataset.toggleSpeakingKeyword);
    if (!keyword) return;
    keyword.starred = !keyword.starred;
    saveSpeakingKeywords(keyword.starred ? "已标记为重点关键词" : "已取消重点标记");
    return;
  }

  const removeSpeakingKeyword = event.target.closest("[data-remove-speaking-keyword]");
  if (removeSpeakingKeyword) {
    const question = getSpeakingQuestion();
    question.keywords = normalizeSpeakingKeywords(question)
      .filter(keyword => keyword.id !== removeSpeakingKeyword.dataset.removeSpeakingKeyword);
    saveSpeakingKeywords("关键词已删除");
    return;
  }

  const readingRemovals = [
    ["removeMonthlyPlan", "monthlyReadingPlans", "月度计划"],
    ["removeReadingLog", "readingLogs", "阅读记录"],
    ["removeQuote", "quotes", "摘抄"],
    ["removeBookNote", "bookNotes", "思考笔记"]
  ];
  for (const [datasetKey, collection, label] of readingRemovals) {
    const selector = `[data-${datasetKey.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`)}]`;
    const button = event.target.closest(selector);
    if (button) {
      if (!confirm(`确认删除这条${label}？`)) return;
      state[collection] = state[collection].filter(item => String(item.id) !== String(button.dataset[datasetKey]));
      saveState(`${label}已删除`);
      return;
    }
  }

  const removeBook = event.target.closest("[data-remove-book]");
  if (removeBook) {
    const book = getBook(removeBook.dataset.removeBook);
    if (!book) return;
    const linkedCount = state.readingLogs.filter(item => item.bookId === book.id).length
      + state.quotes.filter(item => item.bookId === book.id).length
      + state.bookNotes.filter(item => item.bookId === book.id).length;
    const warning = linkedCount
      ? `“${book.title}”关联 ${linkedCount} 条记录。删除书籍后记录仍保留，但来源会显示为已删除书籍。确认删除？`
      : `确认从书库删除“${book.title}”？`;
    if (!confirm(warning)) return;
    state.books = state.books.filter(item => String(item.id) !== String(book.id));
    saveState("书籍已删除");
    return;
  }

  const toggle = event.target.closest("[data-toggle-task]");
  if (toggle) {
    const task = state.tasks.find(item => item.id === toggle.dataset.toggleTask);
    if (task) {
      task.done = !task.done;
      saveState(task.done ? "任务已完成" : "任务已恢复");
    }
  }

  const removals = [
    ["removeTask", "tasks"], ["removeIelts", "ielts"],
    ["removeWorkout", "workouts"], ["removeReading", "reading"]
  ];
  removals.forEach(([datasetKey, collection]) => {
    const button = event.target.closest(`[data-${datasetKey.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)}]`);
    if (button && confirm("确认删除这条记录？")) {
      state[collection] = state[collection].filter(item => item.id !== button.dataset[datasetKey]);
      saveState("记录已删除");
    }
  });
});

document.addEventListener("change", event => {
  if (event.target.id === "pageSort") {
    const context = currentSortContext();
    if (!context) return;
    state.sortPreferences ||= {};
    state.sortPreferences[context] = event.target.value;
    writeLocalState();
    renderAll();
    updatePageSort();
    return;
  }
  if (event.target.matches("[data-speaking-field]")) {
    updateSpeakingField(event.target.dataset.speakingField, event.target.value);
    if (event.target.dataset.speakingField === "reviewStatus") {
      renderSpeakingKnowledgeBase();
    }
  }
});

document.addEventListener("focusout", event => {
  if (event.target.matches("[data-speaking-answer]")) {
    updateSpeakingField(event.target.dataset.speakingAnswer, event.target.innerHTML);
  }
});

document.addEventListener("mousedown", event => {
  const highlightButton = event.target.closest("[data-answer-highlight]");
  const formatButton = event.target.closest("[data-answer-command]");
  if (!highlightButton && !formatButton) return;
  event.preventDefault();
  if (highlightButton) {
    document.execCommand("hiliteColor", false, highlightButton.dataset.answerHighlight);
  } else {
    document.execCommand(formatButton.dataset.answerCommand, false);
  }
});

document.addEventListener("keydown", event => {
  const applicationHandle = event.target.closest("[data-application-drag-handle]");
  if (applicationHandle && ["ArrowUp", "ArrowDown"].includes(event.key)) {
    event.preventDefault();
    const projectId = applicationHandle.closest("[data-application-project]").dataset.applicationProject;
    moveApplicationWithKeyboard(projectId, event.key === "ArrowUp" ? -1 : 1);
    return;
  }

  if (event.target.id === "speakingTagInput" && event.key === "Enter") {
    event.preventDefault();
    const value = event.target.value.trim();
    if (!value) return;
    const question = getSpeakingQuestion();
    question.tags = [...new Set([...(question.tags || []), value])];
    saveState("标签已添加");
  }

  if (event.target.id === "speakingKeywordInput" && event.key === "Enter") {
    event.preventDefault();
    addSpeakingKeyword();
  }
});

document.addEventListener("pointerdown", event => {
  const handle = event.target.closest("[data-application-drag-handle]");
  if (!handle || (event.pointerType === "mouse" && event.button !== 0)) return;
  const card = handle.closest("[data-application-project]");
  const list = card?.closest("#applicationProjects");
  if (!card || !list) return;
  event.preventDefault();
  applicationDragState = {
    pointerId: event.pointerId,
    startY: event.clientY,
    moved: false,
    card,
    list,
    handle,
    originalOrder: applicationOrderFromDom()
  };
  try {
    handle.setPointerCapture?.(event.pointerId);
  } catch {
    // Synthetic pointer events and older browsers may not provide active capture.
  }
});

document.addEventListener("pointermove", event => {
  const drag = applicationDragState;
  if (!drag || drag.pointerId !== event.pointerId) return;
  if (!drag.moved && Math.abs(event.clientY - drag.startY) < 5) return;
  event.preventDefault();
  if (!drag.moved) {
    drag.moved = true;
    drag.card.classList.add("dragging");
    drag.list.classList.add("sorting");
    document.body.classList.add("application-is-sorting");
  }

  const siblings = [...drag.list.querySelectorAll("[data-application-project]")]
    .filter(element => element !== drag.card);
  const insertBefore = siblings.find(element => {
    const rect = element.getBoundingClientRect();
    return event.clientY < rect.top + rect.height / 2;
  });
  if (insertBefore) {
    drag.list.insertBefore(drag.card, insertBefore);
  } else {
    drag.list.append(drag.card);
  }
});

function finishApplicationDrag(event, cancelled = false) {
  const drag = applicationDragState;
  if (!drag || drag.pointerId !== event.pointerId) return;
  drag.card.classList.remove("dragging");
  drag.list.classList.remove("sorting");
  document.body.classList.remove("application-is-sorting");
  try {
    drag.handle.releasePointerCapture?.(event.pointerId);
  } catch {
    // The pointer may already have been released by the browser.
  }
  applicationDragState = null;
  if (!drag.moved) return;
  const nextOrder = applicationOrderFromDom();
  if (cancelled) {
    renderApplications();
    return;
  }
  if (nextOrder.join("|") !== drag.originalOrder.join("|")) {
    persistApplicationOrder(nextOrder);
  }
}

document.addEventListener("pointerup", event => finishApplicationDrag(event));
document.addEventListener("pointercancel", event => finishApplicationDrag(event, true));

document.getElementById("quickAdd").addEventListener("click", () => openDialog("taskDialog"));
document.getElementById("profileButton").addEventListener("click", openAccountDialog);
document.getElementById("openIelts").addEventListener("click", () => openDialog("ieltsDialog"));
document.getElementById("openSpeakingTopic").addEventListener("click", () => {
  openSpeakingTopicDialog();
});
document.getElementById("openWorkout").addEventListener("click", () => openDialog("workoutDialog"));

document.getElementById("bookSearch").addEventListener("input", event => {
  bookSearch = event.target.value;
  renderBookLibrary();
});

document.getElementById("bookCategoryFilter").addEventListener("change", event => {
  bookCategoryFilter = event.target.value;
  renderBookLibrary();
});

document.getElementById("speakingSearch").addEventListener("input", event => {
  speakingSearch = event.target.value;
  renderSpeakingKnowledgeBase();
  document.getElementById("speakingSearch").focus();
  document.getElementById("speakingSearch").setSelectionRange(speakingSearch.length, speakingSearch.length);
});

document.getElementById("speakingStatusFilter").addEventListener("change", event => {
  speakingStatusFilter = event.target.value;
  renderSpeakingKnowledgeBase();
});

document.getElementById("accountForm").addEventListener("submit", event => {
  event.preventDefault();
  submitAccount("login");
});

document.getElementById("registerAccount").addEventListener("click", () => submitAccount("register"));

document.getElementById("signOutAccount").addEventListener("click", async () => {
  if (!supabaseClient) return;
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    setAccountMessage(error.message, "error");
    return;
  }
  setAccountMessage("已退出云端账号。", "success");
});

document.getElementById("syncNow").addEventListener("click", () => syncWithCloud({ prefer: "newest" }));

document.getElementById("downloadCloudData").addEventListener("click", () => {
  if (!confirm("确认用云端数据覆盖本机？建议先导出本机备份。")) return;
  syncWithCloud({ prefer: "cloud" });
});

document.getElementById("uploadLocalData").addEventListener("click", () => {
  if (!confirm("确认用本机数据覆盖云端？其他设备稍后会收到这份数据。")) return;
  syncWithCloud({ prefer: "local" });
});

document.getElementById("energyButton").addEventListener("click", () => {
  const options = ["较低", "一般", "良好", "充足"];
  const today = localDate();
  state.dailyStatus[today] ||= {};
  const current = options.indexOf(state.dailyStatus[today].energy);
  state.dailyStatus[today].energy = options[(current + 1) % options.length];
  saveState("精力状态已更新");
});

document.getElementById("moodButton").addEventListener("click", () => {
  const options = ["低落", "平静", "不错", "很好"];
  const today = localDate();
  state.dailyStatus[today] ||= {};
  const current = options.indexOf(state.dailyStatus[today].mood);
  state.dailyStatus[today].mood = options[(current + 1) % options.length];
  saveState("心情已更新");
});

document.getElementById("taskForm").addEventListener("submit", event => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  state.tasks.push({
    id: id(),
    date: localDate(),
    title: data.get("title").trim(),
    module: data.get("module"),
    priority: data.get("priority"),
    minutes: Number(data.get("minutes")),
    criteria: data.get("criteria").trim(),
    done: false,
    createdAt: Date.now()
  });
  event.currentTarget.reset();
  document.getElementById("taskDialog").close();
  saveState("任务已添加");
});

document.getElementById("ieltsForm").addEventListener("submit", event => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  state.ielts.push({
    id: id(), date: localDate(), createdAt: Date.now(),
    skill: data.get("skill"), minutes: Number(data.get("minutes")),
    source: data.get("source").trim(), result: data.get("result").trim(),
    problem: data.get("problem").trim(), nextFocus: data.get("nextFocus").trim()
  });
  event.currentTarget.reset();
  document.getElementById("ieltsDialog").close();
  saveState("雅思记录已保存");
});

document.getElementById("applicationForm").addEventListener("submit", event => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const values = {
    school: data.get("school").trim(),
    program: data.get("program").trim(),
    region: data.get("region").trim(),
    deadline: data.get("deadline"),
    status: data.get("status")
  };
  const project = state.applications.find(item => String(item.id) === editingApplicationId);
  if (project) {
    Object.assign(project, values, { updatedAt: Date.now() });
  } else {
    state.applications.unshift({
      id: id(),
      ...values,
      createdAt: Date.now()
    });
  }
  const wasEditing = Boolean(project);
  editingApplicationId = "";
  event.currentTarget.reset();
  document.getElementById("applicationDialog").close();
  saveState(wasEditing ? "申请项目已更新" : "申请项目已创建");
  switchView("applications");
});

document.getElementById("speakingTopicForm").addEventListener("submit", event => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const part = Number(data.get("part"));
  const title = data.get("title").trim();
  const duplicate = state.speakingTopics.some(topic =>
    topic.id !== editingSpeakingTopicId &&
    topic.part === part && topic.title.toLowerCase() === title.toLowerCase()
  );
  if (duplicate) {
    showToast("当前 Part 已有同名话题");
    return;
  }
  let topic = getSpeakingTopic(editingSpeakingTopicId);
  const wasEditing = Boolean(topic);
  if (topic) {
    Object.assign(topic, { part, title, color: data.get("color"), updatedAt: Date.now() });
    state.speakingQuestions
      .filter(question => question.topicId === topic.id)
      .forEach(question => {
        question.part = part;
        question.tags = [
          `Part ${part}`,
          ...(question.tags || []).filter(tag => !/^Part [123]$/.test(tag))
        ];
      });
  } else {
    topic = {
      id: id(),
      part,
      title,
      color: data.get("color"),
      createdAt: Date.now()
    };
    state.speakingTopics.push(topic);
  }
  editingSpeakingTopicId = "";
  activeSpeakingPart = part;
  activeSpeakingTopicId = topic.id;
  activeSpeakingQuestionId = "";
  event.currentTarget.reset();
  document.getElementById("speakingTopicDialog").close();
  saveState(wasEditing ? "口语话题已更新" : "口语话题已创建");
  switchIeltsTab("speaking");
});

document.getElementById("speakingQuestionForm").addEventListener("submit", event => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const topicId = data.get("topicId");
  const topic = getSpeakingTopic(topicId);
  if (!topic) {
    showToast("请选择有效话题");
    return;
  }
  let question = getSpeakingQuestion(editingSpeakingQuestionId);
  const wasEditing = Boolean(question);
  const tags = [...new Set([
    `Part ${topic.part}`,
    ...String(data.get("tags") || "").split(",").map(tag => tag.trim()).filter(Boolean)
  ])];
  if (question) {
    Object.assign(question, {
      topicId,
      part: topic.part,
      question: data.get("question").trim(),
      tags,
      updatedAt: Date.now()
    });
  } else {
    question = {
      id: id(),
      topicId,
      part: topic.part,
      question: data.get("question").trim(),
      original: "",
      improved: "",
      final: "",
      storyMaterial: "",
      opinion: "",
      supportingExamples: "",
      keywords: [],
      relatedPart3: "",
      notes: "",
      tags,
      reviewStatus: "not_started",
      expressions: [],
      createdAt: Date.now()
    };
    state.speakingQuestions.unshift(question);
  }
  editingSpeakingQuestionId = "";
  activeSpeakingPart = topic.part;
  activeSpeakingTopicId = topicId;
  activeSpeakingQuestionId = question.id;
  event.currentTarget.reset();
  document.getElementById("speakingQuestionDialog").close();
  saveState(wasEditing ? "口语问题已更新" : "口语问题已添加");
  switchIeltsTab("speaking");
});

document.getElementById("workoutForm").addEventListener("submit", event => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  state.workouts.push({
    id: id(), date: localDate(), createdAt: Date.now(),
    type: data.get("type"), minutes: Number(data.get("minutes")),
    fatigue: data.get("fatigue"), feeling: data.get("feeling").trim()
  });
  event.currentTarget.reset();
  document.getElementById("workoutDialog").close();
  saveState("运动记录已保存");
});

document.getElementById("readingGoalForm").addEventListener("submit", event => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const year = Number(data.get("year"));
  const goal = {
    id: state.readingGoals.find(item => Number(item.year) === year)?.id || id(),
    year,
    targetBooks: Number(data.get("targetBooks")),
    targetHours: Number(data.get("targetHours")),
    themes: String(data.get("themes") || "").split(/[,，]/).map(item => item.trim()).filter(Boolean),
    updatedAt: Date.now()
  };
  state.readingGoals = state.readingGoals.filter(item => Number(item.year) !== year);
  state.readingGoals.push(goal);
  document.getElementById("readingGoalDialog").close();
  saveState("年度阅读目标已保存");
});

document.getElementById("monthlyPlanForm").addEventListener("submit", event => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const month = data.get("month");
  const existing = state.monthlyReadingPlans.find(item => item.month === month);
  const plan = {
    id: existing?.id || id(),
    month,
    targetBooks: data.get("targetBooks").trim(),
    targetPages: Number(data.get("targetPages")),
    targetMinutes: Number(data.get("targetMinutes")),
    theme: data.get("theme").trim(),
    summary: data.get("summary").trim(),
    createdAt: existing?.createdAt || Date.now(),
    updatedAt: Date.now()
  };
  state.monthlyReadingPlans = state.monthlyReadingPlans.filter(item => item.month !== month);
  state.monthlyReadingPlans.push(plan);
  event.currentTarget.reset();
  document.getElementById("monthlyPlanDialog").close();
  saveState(existing ? "月度阅读计划已更新" : "月度阅读计划已创建");
  switchReadingTab("monthly");
});

document.getElementById("bookForm").addEventListener("submit", event => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const currentPage = Number(data.get("currentPage"));
  const totalPages = Number(data.get("totalPages"));
  if (currentPage > totalPages) {
    showToast("当前页不能大于总页数");
    return;
  }
  const finishDate = data.get("finishDate");
  const status = data.get("status");
  state.books.unshift({
    id: id(),
    title: data.get("title").trim(),
    author: data.get("author").trim(),
    category: data.get("category"),
    language: data.get("language"),
    startDate: data.get("startDate"),
    finishDate,
    totalPages,
    currentPage,
    status: finishDate || currentPage === totalPages ? "已读" : status,
    rating: data.get("rating") ? Number(data.get("rating")) : "",
    createdAt: Date.now()
  });
  event.currentTarget.reset();
  document.getElementById("bookDialog").close();
  saveState("书籍已加入书库");
  switchReadingTab("library");
});

document.getElementById("readingLogForm").addEventListener("submit", event => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const book = getBook(data.get("bookId"));
  if (!book) {
    showToast("请选择有效书籍");
    return;
  }
  const currentPage = Number(data.get("currentPage"));
  if (currentPage > Number(book.totalPages)) {
    showToast(`当前页不能超过总页数 ${book.totalPages}`);
    return;
  }
  state.readingLogs.unshift({
    id: id(),
    bookId: book.id,
    date: data.get("date"),
    minutes: Number(data.get("minutes")),
    pagesRead: Number(data.get("pagesRead")),
    currentPage,
    chapter: data.get("chapter").trim(),
    summary: data.get("summary").trim(),
    takeaway: data.get("takeaway").trim(),
    keyIdea: data.get("keyIdea").trim(),
    reflection: data.get("reflection").trim(),
    createdAt: Date.now()
  });
  book.currentPage = Math.max(Number(book.currentPage || 0), currentPage);
  if (!book.startDate) book.startDate = data.get("date");
  if (currentPage >= Number(book.totalPages)) {
    book.status = "已读";
    book.finishDate ||= data.get("date");
  } else if (book.status === "想读") {
    book.status = "在读";
  }
  event.currentTarget.reset();
  document.getElementById("readingLogDialog").close();
  saveState("本次阅读已记录");
  switchReadingTab("logs");
});

document.getElementById("quoteForm").addEventListener("submit", async event => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const imageFile = data.get("image");
  if (imageFile?.size > 1_500_000) {
    showToast("图片过大，请选择小于 1.5 MB 的图片");
    return;
  }
  const image = imageFile?.size ? await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(imageFile);
  }) : "";
  state.quotes.unshift({
    id: id(),
    bookId: data.get("bookId"),
    content: data.get("content").trim(),
    image,
    page: data.get("page") ? Number(data.get("page")) : "",
    language: data.get("language"),
    highlight: data.get("highlight"),
    tags: String(data.get("tags") || "").split(/[,，]/).map(item => item.trim()).filter(Boolean),
    understanding: data.get("understanding").trim(),
    application: data.get("application").trim(),
    createdAt: Date.now()
  });
  event.currentTarget.reset();
  document.getElementById("quoteDialog").close();
  saveState("摘抄已保存");
  switchReadingTab("quotes");
});

document.getElementById("bookNoteForm").addEventListener("submit", event => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  state.bookNotes.unshift({
    id: id(),
    bookId: data.get("bookId"),
    coreIdeas: data.get("coreIdeas").trim(),
    understanding: data.get("understanding").trim(),
    insights: data.get("insights").trim(),
    experience: data.get("experience").trim(),
    impact: data.get("impact").trim(),
    application: data.get("application").trim(),
    createdAt: Date.now()
  });
  event.currentTarget.reset();
  document.getElementById("bookNoteDialog").close();
  saveState("思考笔记已保存");
  switchReadingTab("notes");
});

document.getElementById("journalForm").addEventListener("submit", event => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const today = localDate();
  const existing = state.journals.find(item => item.date === today) || {};
  const record = {
    ...existing,
    id: existing.id || id(),
    date: today, createdAt: Date.now(),
    gratitude: data.get("gratitude").trim(),
    improvements: data.get("improvements").trim(),
    affirmation: data.get("affirmation").trim()
  };
  state.journals = state.journals.filter(item => item.date !== today);
  state.journals.push(record);
  saveState("今日复盘已保存");
});

document.getElementById("profileForm").addEventListener("submit", event => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  state.profile = {
    displayName: data.get("displayName").trim(),
    examDate: data.get("examDate"),
    studyHours: data.get("studyHours")
  };
  saveState("设置已保存");
});

document.getElementById("ieltsFilters").addEventListener("click", event => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  activeIeltsFilter = button.dataset.filter;
  document.querySelectorAll("#ieltsFilters .filter").forEach(item => item.classList.toggle("active", item === button));
  renderIelts();
});

document.getElementById("exportData").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `growth-workbench-${localDate()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("数据已导出");
});

document.getElementById("importData").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    state = { ...structuredClone(initialState), ...imported };
    saveState("数据已导入");
  } catch {
    showToast("导入失败：文件格式不正确");
  }
  event.target.value = "";
});

document.getElementById("clearData").addEventListener("click", () => {
  if (!confirm("确认清空本机的全部工作台数据？此操作无法撤销。")) return;
  state = structuredClone(initialState);
  saveState("本机数据已清空");
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js"));
}

renderAll();
switchIeltsTab(activeIeltsTab);
switchReadingTab(activeReadingTab);
switchView(window.location.hash.slice(1) || "home");
initializeCloudSync();

window.addEventListener("hashchange", () => {
  switchView(window.location.hash.slice(1) || "home");
});

window.addEventListener("online", () => {
  if (cloudUser) syncWithCloud({ prefer: "newest" });
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && cloudUser) {
    syncWithCloud({ prefer: "newest" });
  }
});
