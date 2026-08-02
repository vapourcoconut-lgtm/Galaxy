const STORAGE_KEY = "growth-workbench-v1";

const initialState = {
  profile: { displayName: "我的工作台", examDate: "", studyHours: "8.5" },
  dailyStatus: {},
  tasks: [],
  journals: [],
  ielts: [],
  workouts: [],
  reading: []
};

let state = loadState();
let activeIeltsFilter = "all";

const viewNames = {
  home: "首页",
  today: "今日计划",
  ielts: "雅思学习",
  records: "习惯记录",
  growth: "成长复盘",
  settings: "设置"
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved ? { ...structuredClone(initialState), ...saved } : structuredClone(initialState);
  } catch {
    return structuredClone(initialState);
  }
}

function saveState(message = "已保存") {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  document.getElementById("saveStatus").textContent = "本机数据已保存";
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

function switchView(view) {
  document.querySelectorAll(".view").forEach(el => el.classList.remove("active"));
  document.getElementById(`${view}View`).classList.add("active");
  document.querySelectorAll("[data-view]").forEach(button => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  document.getElementById("viewTitle").textContent = viewNames[view];
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
  return state.tasks
    .filter(task => task.date === today)
    .sort((a, b) => a.priority.localeCompare(b.priority) || a.createdAt - b.createdAt);
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
  const records = [...state.ielts].sort((a, b) => b.createdAt - a.createdAt);
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

function renderHabits() {
  const workouts = [...state.workouts].sort((a, b) => b.createdAt - a.createdAt);
  const reading = [...state.reading].sort((a, b) => b.createdAt - a.createdAt);

  document.getElementById("workoutRecords").innerHTML = workouts.length ? workouts.map(item => `
    <article class="record-item">
      <div class="record-head"><strong>${escapeHtml(item.type)}</strong><span class="record-date">${formatDate(item.date)}</span></div>
      <div class="record-result">${item.minutes} 分钟</div>
      <div class="record-note">疲劳：${escapeHtml(item.fatigue)}${item.feeling ? ` · ${escapeHtml(item.feeling)}` : ""}</div>
      <div class="record-footer"><span>真实记录</span><button class="remove-button" data-remove-workout="${item.id}">删除</button></div>
    </article>`).join("") : `<div class="empty-state">暂无运动记录。</div>`;

  document.getElementById("readingRecords").innerHTML = reading.length ? reading.map(item => {
    const progress = Math.min(100, Math.round(item.currentPage / item.totalPages * 100));
    return `<article class="record-item">
      <div class="record-head"><strong>${escapeHtml(item.book)}</strong><span class="record-date">${formatDate(item.date)}</span></div>
      <div class="record-result">${item.currentPage} / ${item.totalPages} 页 · ${progress}%</div>
      <div class="record-note">${escapeHtml(item.note || "未填写笔记")}</div>
      <div class="record-footer"><span>阅读进度</span><button class="remove-button" data-remove-reading="${item.id}">删除</button></div>
    </article>`;
  }).join("") : `<div class="empty-state">暂无阅读记录。</div>`;

  const weeklyWorkouts = workouts.filter(item => isThisWeek(item.date)).length;
  document.getElementById("workoutCount").textContent = `${weeklyWorkouts} 次`;
  document.getElementById("readingProgress").textContent = reading.length ?
    `${Math.min(100, Math.round(reading[0].currentPage / reading[0].totalPages * 100))}%` : "暂无数据";
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
  ["completed", "blocker", "learned", "tomorrow"].forEach(field => {
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
  const stats = [
    ["任务完成率", tasks.length ? `${Math.round(completed / tasks.length * 100)}%` : "暂无足够记录"],
    ["雅思投入", ieltsMinutes ? `${(ieltsMinutes / 60).toFixed(1)} 小时` : "暂无足够记录"],
    ["运动次数", workouts ? `${workouts} 次` : "暂无足够记录"],
    ["日记天数", journalCount ? `${journalCount} 天` : "暂无足够记录"]
  ];
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

function renderAll() {
  renderDate();
  renderTasks();
  renderDailyStatus();
  renderIelts();
  renderHabits();
  renderJournals();
  renderGrowth();
  renderProfile();
}

function openDialog(id) {
  document.getElementById(id).showModal();
}

document.addEventListener("click", event => {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) switchView(viewButton.dataset.view);

  const viewTarget = event.target.closest("[data-view-target]");
  if (viewTarget) switchView(viewTarget.dataset.viewTarget);

  if (event.target.closest("[data-open-task]")) openDialog("taskDialog");

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

document.getElementById("quickAdd").addEventListener("click", () => openDialog("taskDialog"));
document.getElementById("profileButton").addEventListener("click", () => switchView("settings"));
document.getElementById("openIelts").addEventListener("click", () => openDialog("ieltsDialog"));
document.getElementById("openWorkout").addEventListener("click", () => openDialog("workoutDialog"));
document.getElementById("openReading").addEventListener("click", () => openDialog("readingDialog"));

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

document.getElementById("readingForm").addEventListener("submit", event => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const currentPage = Number(data.get("currentPage"));
  const totalPages = Number(data.get("totalPages"));
  if (currentPage > totalPages) {
    showToast("当前页不能大于总页数");
    return;
  }
  state.reading.push({
    id: id(), date: localDate(), createdAt: Date.now(),
    book: data.get("book").trim(), currentPage, totalPages,
    note: data.get("note").trim()
  });
  event.currentTarget.reset();
  document.getElementById("readingDialog").close();
  saveState("阅读记录已保存");
});

document.getElementById("journalForm").addEventListener("submit", event => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const today = localDate();
  const record = {
    id: state.journals.find(item => item.date === today)?.id || id(),
    date: today, createdAt: Date.now(),
    completed: data.get("completed").trim(),
    blocker: data.get("blocker").trim(),
    learned: data.get("learned").trim(),
    tomorrow: data.get("tomorrow").trim()
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
