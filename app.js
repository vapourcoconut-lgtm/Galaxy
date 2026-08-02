const STORAGE_KEY = "growth-workbench-v1";

const initialState = {
  profile: { displayName: "我的工作台", examDate: "", studyHours: "8.5" },
  dailyStatus: {},
  tasks: [],
  journals: [],
  ielts: [],
  workouts: [],
  reading: [],
  speakingTopics: [
    { id: "speaking-topic-technology", part: 1, title: "Technology", color: "#9aafc1" },
    { id: "speaking-topic-hometown", part: 1, title: "Hometown", color: "#c9a7a5" },
    { id: "speaking-topic-people", part: 2, title: "People", color: "#a8b5a2" },
    { id: "speaking-topic-education", part: 3, title: "Education", color: "#b8b0c5" }
  ],
  speakingQuestions: [
    {
      id: "speaking-question-technology-1",
      topicId: "speaking-topic-technology",
      part: 1,
      question: "How often do you use technology in your daily life?",
      original: "I use technology every day. I use my phone to study English and contact my friends. Sometimes I spend too much time on short videos.",
      improved: "Technology is a big part of my daily routine. I mainly use my phone to study English and keep in touch with friends, although I sometimes get caught up in short videos and lose track of time.",
      final: "I use technology every day, mainly to study English and keep in touch with friends. The only downside is that I sometimes get caught up in short videos.",
      storyMaterial: "",
      opinion: "",
      supportingExamples: "",
      keywords: "",
      relatedPart3: "",
      notes: "练习 get caught up in 的连读，答案控制在 25 秒左右。",
      tags: ["Part 1", "Personal Experience", "Technology"],
      reviewStatus: "learning",
      expressions: [
        {
          type: "Vocabulary",
          expression: "get caught up in something",
          meaning: "Become so involved in something that you lose track of time.",
          example: "I sometimes get caught up in short videos.",
          topics: "Technology / Social Media / Daily Life"
        },
        {
          type: "Sentence Pattern",
          expression: "The only downside is that...",
          meaning: "自然地引出一个缺点。",
          example: "The only downside is that it can be distracting.",
          topics: "Most Part 1 topics"
        }
      ],
      createdAt: Date.now()
    },
    {
      id: "speaking-question-technology-2",
      topicId: "speaking-topic-technology",
      part: 1,
      question: "Is there any technology you find difficult to use?",
      original: "", improved: "", final: "", storyMaterial: "", opinion: "",
      supportingExamples: "", keywords: "", relatedPart3: "", notes: "",
      tags: ["Part 1", "Technology"], reviewStatus: "not_started",
      expressions: [], createdAt: Date.now() - 1
    },
    {
      id: "speaking-question-people-1",
      topicId: "speaking-topic-people",
      part: 2,
      question: "Describe a person who encouraged you to achieve a goal.",
      original: "", improved: "", final: "",
      storyMaterial: "大学英语老师鼓励我参加第一次英文演讲；准备两周；虽然紧张但完成了。",
      opinion: "", supportingExamples: "",
      keywords: "teacher, encouragement, public speaking",
      relatedPart3: "Why do some people need encouragement?\nWho influences young people most?",
      notes: "可复用到 teacher / helpful person / difficult goal。",
      tags: ["Part 2", "Personal Story", "People"], reviewStatus: "not_started",
      expressions: [], createdAt: Date.now() - 2
    },
    {
      id: "speaking-question-education-1",
      topicId: "speaking-topic-education",
      part: 3,
      question: "Should schools teach more practical skills?",
      original: "", improved: "", final: "", storyMaterial: "",
      opinion: "Yes, but academic subjects should remain the foundation.",
      supportingExamples: "Financial literacy, communication and basic first aid.",
      keywords: "", relatedPart3: "", notes: "",
      tags: ["Part 3", "Opinion", "Education"], reviewStatus: "not_started",
      expressions: [], createdAt: Date.now() - 3
    }
  ]
};

let state = loadState();
let activeIeltsFilter = "all";
let activeIeltsTab = "records";
let activeSpeakingPart = 1;
let activeSpeakingTopicId = "";
let activeSpeakingQuestionId = "";
let speakingSearch = "";
let speakingStatusFilter = "all";

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
    return `<button class="speaking-topic ${topic.id === activeSpeakingTopicId ? "active" : ""}" data-speaking-topic="${topic.id}">
      <i style="background:${escapeHtml(topic.color)}"></i>
      <span>${escapeHtml(topic.title)}</span>
      <em>${count}</em>
    </button>`;
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
    <button class="speaking-question ${question.id === activeSpeakingQuestionId ? "active" : ""}" data-speaking-question="${question.id}">
      <strong>${escapeHtml(question.question)}</strong>
      <span><i class="${escapeHtml(question.reviewStatus)}"></i>${speakingStatusLabel(question.reviewStatus)} · ${(question.tags || []).length} 标签</span>
    </button>`).join("") : `<div class="speaking-list-empty">当前筛选下没有问题。</div>`;

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
      <select data-speaking-field="reviewStatus" aria-label="复习状态">
        <option value="not_started" ${question.reviewStatus === "not_started" ? "selected" : ""}>未学习</option>
        <option value="learning" ${question.reviewStatus === "learning" ? "selected" : ""}>学习中</option>
        <option value="mastered" ${question.reviewStatus === "mastered" ? "selected" : ""}>已掌握</option>
      </select>
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

function openSpeakingQuestionDialog() {
  const topics = state.speakingTopics.filter(topic => topic.part === activeSpeakingPart);
  if (!topics.length) {
    showToast("请先创建当前 Part 的话题");
    openDialog("speakingTopicDialog");
    document.querySelector("#speakingTopicForm [name=part]").value = String(activeSpeakingPart);
    return;
  }
  document.getElementById("speakingQuestionDialogTitle").textContent =
    activeSpeakingPart === 2 ? "添加 Cue Card" : `添加 Part ${activeSpeakingPart} 问题`;
  document.getElementById("speakingQuestionLabel").textContent =
    activeSpeakingPart === 2 ? "Cue Card 题目" : "Question";
  document.getElementById("speakingQuestionTopic").innerHTML = topics.map(topic =>
    `<option value="${topic.id}" ${topic.id === activeSpeakingTopicId ? "selected" : ""}>${escapeHtml(topic.title)}</option>`
  ).join("");
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
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) switchView(viewButton.dataset.view);

  const viewTarget = event.target.closest("[data-view-target]");
  if (viewTarget) switchView(viewTarget.dataset.viewTarget);

  if (event.target.closest("[data-open-task]")) openDialog("taskDialog");

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
    openDialog("speakingTopicDialog");
    document.querySelector("#speakingTopicForm [name=part]").value = String(activeSpeakingPart);
  }
  if (event.target.closest("[data-open-speaking-question]")) openSpeakingQuestionDialog();

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
  if (event.target.id === "speakingTagInput" && event.key === "Enter") {
    event.preventDefault();
    const value = event.target.value.trim();
    if (!value) return;
    const question = getSpeakingQuestion();
    question.tags = [...new Set([...(question.tags || []), value])];
    saveState("标签已添加");
  }
});

document.getElementById("quickAdd").addEventListener("click", () => openDialog("taskDialog"));
document.getElementById("profileButton").addEventListener("click", () => switchView("settings"));
document.getElementById("openIelts").addEventListener("click", () => openDialog("ieltsDialog"));
document.getElementById("openSpeakingTopic").addEventListener("click", () => {
  openDialog("speakingTopicDialog");
  document.querySelector("#speakingTopicForm [name=part]").value = String(activeSpeakingPart);
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

document.getElementById("speakingTopicForm").addEventListener("submit", event => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const part = Number(data.get("part"));
  const title = data.get("title").trim();
  const duplicate = state.speakingTopics.some(topic =>
    topic.part === part && topic.title.toLowerCase() === title.toLowerCase()
  );
  if (duplicate) {
    showToast("当前 Part 已有同名话题");
    return;
  }
  const topic = {
    id: id(),
    part,
    title,
    color: data.get("color"),
    createdAt: Date.now()
  };
  state.speakingTopics.push(topic);
  activeSpeakingPart = part;
  activeSpeakingTopicId = topic.id;
  activeSpeakingQuestionId = "";
  event.currentTarget.reset();
  document.getElementById("speakingTopicDialog").close();
  saveState("口语话题已创建");
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
  const question = {
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
    tags: [
      `Part ${topic.part}`,
      ...String(data.get("tags") || "").split(",").map(tag => tag.trim()).filter(Boolean)
    ],
    reviewStatus: "not_started",
    expressions: [],
    createdAt: Date.now()
  };
  question.tags = [...new Set(question.tags)];
  state.speakingQuestions.unshift(question);
  activeSpeakingPart = topic.part;
  activeSpeakingTopicId = topicId;
  activeSpeakingQuestionId = question.id;
  event.currentTarget.reset();
  document.getElementById("speakingQuestionDialog").close();
  saveState("口语问题已添加");
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
