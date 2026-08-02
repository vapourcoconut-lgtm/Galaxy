const STORAGE_KEY = "growth-workbench-v1";

const initialState = {
  profile: { displayName: "我的工作台", examDate: "", studyHours: "8.5" },
  dailyStatus: {},
  tasks: [],
  journals: [],
  ielts: [],
  applications: [],
  applicationOrderVersion: 1,
  speakingSampleCleanupVersion: 1,
  workouts: [],
  reading: [],
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
let activeSpeakingPart = 1;
let activeSpeakingTopicId = "";
let activeSpeakingQuestionId = "";
let speakingSearch = "";
let speakingStatusFilter = "all";
let applicationDragState = null;
let editingApplicationId = "";
let editingSpeakingTopicId = "";
let editingSpeakingQuestionId = "";

const viewNames = {
  home: "首页",
  today: "今日计划",
  ielts: "雅思学习",
  applications: "申请项目",
  records: "习惯记录",
  growth: "成长复盘",
  settings: "设置"
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return structuredClone(initialState);
    const loaded = { ...structuredClone(initialState), ...saved };
    loaded.applications = Array.isArray(loaded.applications) ? loaded.applications : [];
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(loaded));
    }
    return loaded;
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

function renderApplications() {
  const projects = state.applications;
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
    <article class="application-project" data-application-project="${project.id}">
      <span class="application-drag-handle" data-application-drag-handle tabindex="0"
        role="button" aria-label="拖动调整 ${escapeHtml(project.school)} ${escapeHtml(project.program)} 的顺序"
        title="拖动排序；也可使用上下方向键">⠿</span>
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

function stripAnswerHtml(value = "") {
  const element = document.createElement("div");
  element.innerHTML = value;
  return element.textContent || "";
}

function renderSpeakingSummary() {
  const questions = state.speakingQuestions;
  const expressions = questions.reduce((total, question) => total + (question.expressions || []).length, 0);
  document.getElementById("speakingQuestionCount").textContent = questions.length;
  document.getElementById("speakingLearningCount").textContent =
    questions.filter(question => question.reviewStatus === "learning").length;
  document.getElementById("speakingMasteredCount").textContent =
    questions.filter(question => question.reviewStatus === "mastered").length;
  document.getElementById("speakingExpressionCount").textContent = expressions;
}

function renderSpeakingKnowledgeBase() {
  renderSpeakingSummary();

  document.querySelectorAll("[data-speaking-part]").forEach(button => {
    button.classList.toggle("active", Number(button.dataset.speakingPart) === activeSpeakingPart);
  });

  const topics = state.speakingTopics.filter(topic => topic.part === activeSpeakingPart);
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
      question.notes, question.storyMaterial, question.opinion,
      ...(question.tags || []),
      ...(question.expressions || []).flatMap(item => [
        item.expression, item.meaning, item.example, item.topics
      ])
    ].join(" ").toLowerCase().includes(search));
  }

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

function speakingAnswerCard(index, title, description, field, value) {
  return `<section class="answer-version">
    <div class="answer-version-head">
      <span>${index}</span>
      <div><strong>${title}</strong><small>${description}</small></div>
    </div>
    <div class="annotation-toolbar" aria-label="文本高亮工具">
      <span>选择文字后标记</span>
      <button class="highlight-yellow" data-answer-highlight="#f4e7a1" title="重要表达" aria-label="黄色：重要表达"></button>
      <button class="highlight-blue" data-answer-highlight="#c9dce8" title="高级替换" aria-label="蓝色：高级替换"></button>
      <button class="highlight-red" data-answer-highlight="#ecc5c2" title="错误或待修改" aria-label="红色：错误或待修改"></button>
      <button class="highlight-green" data-answer-highlight="#cadfc5" title="个人素材" aria-label="绿色：个人素材"></button>
      <button class="clear-highlight" data-answer-highlight="transparent">清除</button>
    </div>
    <div class="answer-content" contenteditable="true" data-speaking-answer="${field}" data-placeholder="输入或编辑 ${title}">${value || ""}</div>
  </section>`;
}

function speakingExpressionCard(item) {
  return `<article class="expression-card">
    <span>${escapeHtml(item.type)}</span>
    <strong>${escapeHtml(item.expression)}</strong>
    <p>${escapeHtml(item.meaning || "")}</p>
    <dl>
      <div><dt>Example</dt><dd>${escapeHtml(item.example || "")}</dd></div>
      <div><dt>Suitable Topics</dt><dd>${escapeHtml(item.topics || "")}</dd></div>
    </dl>
  </article>`;
}

function renderSpeakingEditor() {
  const editor = document.getElementById("speakingEditor");
  const question = getSpeakingQuestion();
  if (!question) {
    editor.innerHTML = `<div class="speaking-empty">
      <strong>选择或添加一个问题</strong>
      <span>三个答案版本、表达与批注会显示在这里。</span>
    </div>`;
    return;
  }

  const topic = getSpeakingTopic(question.topicId);
  const specialFields = question.part === 2 ? `
    ${speakingTextField("我的故事素材", "storyMaterial", question.storyMaterial, "记录人物、地点、时间、冲突与结果", 4)}
    ${speakingTextField("关键词", "keywords", question.keywords, "例如 teacher, encouragement, public speaking", 2)}
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

    ${specialFields}
    ${speakingAnswerCard("1", "Original Answer", "保留真实表达，不自动覆盖", "original", question.original)}
    <div class="speaking-ai-actions">
      <button class="primary-button" id="improveSpeakingAnswer">AI 优化答案</button>
      <button class="secondary-button" id="extractSpeakingExpressions">提取重点表达</button>
    </div>
    ${speakingAnswerCard("2", "AI Improved Answer", "保留原观点，提升自然度与语言质量", "improved", question.improved)}
    ${speakingAnswerCard("3", "Final Version", "更简洁、易记忆、适合考试现场", "final", question.final)}

    <section class="speaking-expression-section">
      <div class="subsection-heading">
        <div><p class="eyebrow">Language Assets</p><h4>Useful Expressions</h4></div>
        <span>${(question.expressions || []).length} 条</span>
      </div>
      <div class="speaking-expression-grid">
        ${(question.expressions || []).map(speakingExpressionCard).join("") ||
          `<div class="empty-state compact">点击“提取重点表达”，建立 Vocabulary Bank 与 Sentence Patterns。</div>`}
      </div>
    </section>

    ${speakingTextField("Notes / Comments", "notes", question.notes, "例如：适合 Technology 话题；这个句型可用于 Part 3；考试容易忘记", 4)}
  </div>`;
}

function updateSpeakingField(field, value) {
  const question = getSpeakingQuestion();
  if (!question) return;
  question[field] = value;
  question.updatedAt = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  document.getElementById("saveStatus").textContent = "本机数据已保存";
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

function improveSpeakingAnswer() {
  const question = getSpeakingQuestion();
  const original = stripAnswerHtml(question?.original || "").trim();
  if (!original) {
    showToast("请先填写 Original Answer");
    return;
  }
  const normalized = original
    .replace(/\s+/g, " ")
    .replace(/\bcontact my friends\b/gi, "keep in touch with my friends")
    .replace(/\bvery good\b/gi, "particularly useful")
    .replace(/\bI think\b/gi, "I'd say");
  const lowerStart = normalized.charAt(0).toLowerCase() + normalized.slice(1);
  question.improved = `I'd say ${lowerStart} What I particularly appreciate is that it fits naturally into my daily routine.`;
  question.final = `${normalized} Overall, it is a simple but meaningful part of my life.`;
  question.reviewStatus = "learning";
  saveState("已生成优化版与最终版");
}

function extractSpeakingExpressions() {
  const question = getSpeakingQuestion();
  const source = stripAnswerHtml(question?.improved || question?.original || "").trim();
  if (!source) {
    showToast("请先填写或生成答案");
    return;
  }
  const topic = getSpeakingTopic(question.topicId)?.title || "General";
  const suggestions = [
    {
      type: "Sentence Pattern",
      expression: "I'd say...",
      meaning: "A natural way to introduce a personal opinion.",
      example: `I'd say ${topic.toLowerCase()} plays an important role in my life.`,
      topics: `${topic} / Opinion`
    },
    {
      type: "Sentence Pattern",
      expression: "What I particularly appreciate is that...",
      meaning: "用于自然强调最欣赏的特点。",
      example: "What I particularly appreciate is that it saves me a lot of time.",
      topics: "People / Places / Technology / Daily Life"
    },
    {
      type: "Collocation",
      expression: "fit naturally into my daily routine",
      meaning: "自然融入我的日常生活。",
      example: "Reading fits naturally into my daily routine.",
      topics: `${topic} / Habits / Daily Life`
    }
  ];
  question.expressions ||= [];
  suggestions.forEach(item => {
    if (!question.expressions.some(existing => existing.expression === item.expression)) {
      question.expressions.push(item);
    }
  });
  saveState("已提取可复用表达");
}

function renderAll() {
  renderDate();
  renderTasks();
  renderDailyStatus();
  renderIelts();
  renderApplications();
  renderSpeakingKnowledgeBase();
  renderHabits();
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

  if (event.target.closest("[data-open-task]")) openDialog("taskDialog");
  if (event.target.closest("[data-open-application]")) openApplicationDialog();

  const editApplication = event.target.closest("[data-edit-application]");
  if (editApplication) {
    openApplicationDialog(editApplication.dataset.editApplication);
    return;
  }

  const ieltsTab = event.target.closest("[data-ielts-tab]");
  if (ieltsTab) switchIeltsTab(ieltsTab.dataset.ieltsTab);

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

  if (event.target.closest("#improveSpeakingAnswer")) improveSpeakingAnswer();
  if (event.target.closest("#extractSpeakingExpressions")) extractSpeakingExpressions();

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
  if (!highlightButton) return;
  event.preventDefault();
  document.execCommand("hiliteColor", false, highlightButton.dataset.answerHighlight);
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
document.getElementById("profileButton").addEventListener("click", () => switchView("settings"));
document.getElementById("openIelts").addEventListener("click", () => openDialog("ieltsDialog"));
document.getElementById("openSpeakingTopic").addEventListener("click", () => {
  openSpeakingTopicDialog();
});
document.getElementById("openWorkout").addEventListener("click", () => openDialog("workoutDialog"));
document.getElementById("openReading").addEventListener("click", () => openDialog("readingDialog"));

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
      keywords: "",
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
