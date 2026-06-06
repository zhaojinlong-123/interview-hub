const form = document.querySelector("#postForm");
const formMessage = document.querySelector("#formMessage");
const postsRoot = document.querySelector("#posts");
const paginationRoot = document.querySelector("#pagination");
const template = document.querySelector("#postTemplate");
const categoryChips = document.querySelector("#categoryChips");
const collectionsRoot = document.querySelector("#collectionsRoot");
const collectionForm = document.querySelector("#collectionForm");
const collectionName = document.querySelector("#collectionName");
const exportCollectionsButton = document.querySelector("#exportCollections");
const collectionExport = document.querySelector("#collectionExport");
const platformForm = document.querySelector("#platformForm");
const platformList = document.querySelector("#platformList");
const platformMessage = document.querySelector("#platformMessage");
const dailyFeatureRoot = document.querySelector("#dailyFeatureRoot");

const filters = {
  keyword: document.querySelector("#keyword"),
  company: document.querySelector("#companyFilter"),
  role: document.querySelector("#roleFilter"),
  type: document.querySelector("#typeFilter"),
  category: document.querySelector("#categoryFilter"),
  platform: document.querySelector("#platformFilter"),
  difficulty: document.querySelector("#difficultyFilter"),
  tag: document.querySelector("#tagFilter"),
  status: document.querySelector("#statusFilter"),
  sort: document.querySelector("#sortMode"),
  questionOnly: document.querySelector("#questionOnly"),
  startDate: document.querySelector("#startDate"),
  endDate: document.querySelector("#endDate"),
};

const formCategory = document.querySelector("#formCategory");
const totalCount = document.querySelector("#totalCount");
const questionCount = document.querySelector("#questionCount");
const experienceCount = document.querySelector("#experienceCount");
const collectionCount = document.querySelector("#collectionCount");
const focusCount = document.querySelector("#focusCount");
const reviewCount = document.querySelector("#reviewCount");
const sourceCount = document.querySelector("#sourceCount");
const avgQuestionCount = document.querySelector("#avgQuestionCount");
const resultSummary = document.querySelector("#resultSummary");
const sourceBreakdown = document.querySelector("#sourceBreakdown");
const categoryBreakdown = document.querySelector("#categoryBreakdown");
const hotTags = document.querySelector("#hotTags");

const collectionKey = "interview-hub-collections";
const statusKey = "interview-hub-statuses";
const defaultCollection = "默认收藏";

let allPosts = [];
let catalogPosts = [];
let meta = {};
let searchPlatforms = [];
let dailyFeatures = [];
let currentPage = 1;
const pageSize = 10;

const staticDataPrefix = location.pathname.includes("/public/") ? ".." : ".";
const staticAssetVersion = "20260606-platform-templates";

function isStaticHost() {
  return location.hostname.endsWith("github.io") || location.protocol === "file:";
}

function safeHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function platformPreviewUrl(searchUrl, query = "大模型 面经") {
  const encoded = encodeURIComponent(query);
  return String(searchUrl || "")
    .replaceAll("{query}", encoded)
    .replaceAll("{keyword}", encoded);
}

function staticUrl(path) {
  const separator = path.includes("?") ? "&" : "?";
  return `${staticDataPrefix}/${path}${separator}v=${staticAssetVersion}`;
}

function uniqueValues(posts, key) {
  return [...new Set(posts.map((post) => post[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function buildMetaFromPosts(posts) {
  const tags = [...new Set(posts.flatMap((post) => post.tags || []))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  return {
    categories: [
      "多模态大模型",
      "VLA / 具身智能",
      "视频 / 视觉理解",
      "世界模型",
      "自动驾驶 / 数据闭环",
      "推理优化 / 模型压缩",
      "强化学习 / 对齐训练",
    ],
    companies: uniqueValues(posts, "company"),
    platforms: uniqueValues(posts, "sourcePlatform"),
    difficulties: ["入门", "中等", "困难", "综合"],
    tags,
  };
}

async function readStaticPosts() {
  const response = await fetch(staticUrl("data/posts.json"));
  const posts = await response.json();
  return { posts, meta: buildMetaFromPosts(posts) };
}

async function readStaticDailyFeatures() {
  const response = await fetch(staticUrl("data/daily-features.json"));
  return response.json();
}

function filterStaticPosts(posts) {
  const query = new URLSearchParams(buildServerQuery());
  let result = [...posts];
  const q = (query.get("q") || "").toLowerCase();
  const company = (query.get("company") || "").toLowerCase();
  const role = (query.get("role") || "").toLowerCase();
  const exactFilters = ["type", "category", "platform", "difficulty", "tag"];

  if (q) result = result.filter((post) => postTextForStatic(post).includes(q));
  if (company) result = result.filter((post) => (post.company || "").toLowerCase().includes(company));
  if (role) result = result.filter((post) => (post.role || "").toLowerCase().includes(role));
  exactFilters.forEach((key) => {
    const value = query.get(key);
    if (!value || value === "all") return;
    if (key === "platform") result = result.filter((post) => post.sourcePlatform === value);
    else if (key === "tag") result = result.filter((post) => (post.tags || []).includes(value));
    else result = result.filter((post) => post[key] === value);
  });
  if (query.get("startDate")) result = result.filter((post) => (post.sourceDate || "") >= query.get("startDate"));
  if (query.get("endDate")) result = result.filter((post) => (post.sourceDate || "") <= query.get("endDate"));
  return result;
}

function postTextForStatic(post) {
  return [
    post.title,
    post.company,
    post.role,
    post.direction,
    post.domain,
    post.category,
    post.difficulty,
    post.sourcePlatform,
    post.content,
    post.prepTips,
    ...(post.tags || []),
    ...(post.questions || []),
  ].filter(Boolean).join(" ").toLowerCase();
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function readCollections() {
  return readJson(collectionKey, {});
}

function writeCollections(collections) {
  writeJson(collectionKey, collections);
}

function readStatuses() {
  return readJson(statusKey, {});
}

function writeStatuses(statuses) {
  writeJson(statusKey, statuses);
}

function ensureDefaultCollection() {
  const collections = readCollections();
  if (!collections[defaultCollection]) {
    collections[defaultCollection] = [];
    writeCollections(collections);
  }
}

function typeLabel(type) {
  const labels = {
    experience: "面经",
    question: "题目",
    video: "视频复盘",
    collection: "题库合集",
  };
  return labels[type] || "面经";
}

function statusLabel(status) {
  const labels = {
    read: "已读",
    focus: "重点",
    review: "待复习",
    unread: "未读",
  };
  return labels[status || "unread"];
}

function difficultyRank(value) {
  const ranks = { 困难: 4, 综合: 3, 中等: 2, 入门: 1 };
  return ranks[value] || 0;
}

function countBy(items, getter) {
  return items.reduce((acc, item) => {
    const key = getter(item) || "未标注";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function topEntries(record, limit = 6) {
  return Object.entries(record)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"))
    .slice(0, limit);
}

function setOptions(select, values, allLabel = "全部") {
  select.innerHTML = "";
  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = allLabel;
  select.appendChild(allOption);
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function setFormCategories(values) {
  formCategory.innerHTML = "";
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    formCategory.appendChild(option);
  });
}

function buildServerQuery() {
  const params = new URLSearchParams();
  if (filters.keyword.value.trim()) params.set("q", filters.keyword.value.trim());
  if (filters.company.value.trim()) params.set("company", filters.company.value.trim());
  if (filters.role.value.trim()) params.set("role", filters.role.value.trim());
  if (filters.type.value !== "all") params.set("type", filters.type.value);
  if (filters.category.value !== "all") params.set("category", filters.category.value);
  if (filters.platform.value !== "all") params.set("platform", filters.platform.value);
  if (filters.difficulty.value !== "all") params.set("difficulty", filters.difficulty.value);
  if (filters.tag.value !== "all") params.set("tag", filters.tag.value);
  if (filters.startDate.value) params.set("startDate", filters.startDate.value);
  if (filters.endDate.value) params.set("endDate", filters.endDate.value);
  return params.toString();
}

function applyClientFilters(posts) {
  const statuses = readStatuses();
  let result = [...posts];

  if (filters.status.value !== "all") {
    result = result.filter((post) => (statuses[post.id] || "unread") === filters.status.value);
  }
  if (filters.questionOnly.checked) {
    result = result.filter((post) => (post.questions || []).length > 0);
  }

  const sorters = {
    "date-desc": (a, b) => (b.sourceDate || "").localeCompare(a.sourceDate || ""),
    "date-asc": (a, b) => (a.sourceDate || "").localeCompare(b.sourceDate || ""),
    "difficulty-desc": (a, b) => difficultyRank(b.difficulty) - difficultyRank(a.difficulty),
    "question-desc": (a, b) => (b.questions || []).length - (a.questions || []).length,
    "company-asc": (a, b) => (a.company || "").localeCompare(b.company || "", "zh-CN"),
  };
  result.sort(sorters[filters.sort.value] || sorters["date-desc"]);
  return result;
}

function updateStats(posts) {
  const collections = readCollections();
  const statuses = readStatuses();
  totalCount.textContent = posts.length;
  questionCount.textContent = posts.filter((post) => post.type === "question" || post.type === "collection").length;
  experienceCount.textContent = posts.filter((post) => post.type === "experience" || post.type === "video").length;
  collectionCount.textContent = Object.keys(collections).length;
  focusCount.textContent = Object.values(statuses).filter((status) => status === "focus").length;
  reviewCount.textContent = Object.values(statuses).filter((status) => status === "review").length;
  sourceCount.textContent = new Set(catalogPosts.map((post) => post.sourcePlatform).filter(Boolean)).size;
  const totalQuestions = posts.reduce((sum, post) => sum + (post.questions || []).length, 0);
  avgQuestionCount.textContent = posts.length ? (totalQuestions / posts.length).toFixed(1) : "0";
}

function renderRankList(root, entries) {
  root.innerHTML = "";
  entries.forEach(([label, count]) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "rank-row";
    const text = document.createElement("span");
    text.textContent = label;
    const value = document.createElement("strong");
    value.textContent = count;
    row.append(text, value);
    root.appendChild(row);
  });
}

function platformTypeLabel(type) {
  const labels = {
    login: "已登录",
    public: "公开检索",
    manual: "人工处理",
  };
  return labels[type] || "公开检索";
}

function renderPlatforms() {
  if (!platformList) return;
  platformList.innerHTML = "";
  if (!searchPlatforms.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "还没有检索平台，可以先添加一个公开搜索链接。";
    platformList.appendChild(empty);
    return;
  }

  searchPlatforms.forEach((platform) => {
    const row = document.createElement("article");
    row.className = "platform-row";

    const info = document.createElement("div");
    info.className = "platform-info";
    const title = document.createElement("h3");
    title.textContent = platform.name;
    const metaLine = document.createElement("p");
    const domains = (platform.matchDomains || []).join(", ") || "未设置域名匹配";
    metaLine.textContent = `${platformTypeLabel(platform.type)} · ${platform.enabled ? "已启用" : "已停用"} · ${domains}`;
    const url = document.createElement("p");
    url.className = "platform-url";
    if (platform.searchUrl) {
      const previewUrl = safeHttpUrl(platformPreviewUrl(platform.searchUrl));
      const link = document.createElement("a");
      link.textContent = platform.searchUrl;
      link.title = "打开示例关键词：大模型 面经";
      if (previewUrl) {
        link.href = previewUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }
      url.appendChild(link);
    } else {
      url.textContent = "无自动搜索链接";
    }
    info.appendChild(title);
    info.appendChild(metaLine);
    info.appendChild(url);

    const actions = document.createElement("div");
    actions.className = "platform-actions";
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.textContent = platform.enabled ? "停用" : "启用";
    toggle.addEventListener("click", () => updatePlatform(platform.id, { enabled: !platform.enabled }));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "删除";
    remove.addEventListener("click", () => deletePlatform(platform.id));
    actions.appendChild(toggle);
    actions.appendChild(remove);

    row.appendChild(info);
    row.appendChild(actions);
    platformList.appendChild(row);
  });
}

async function loadPlatforms() {
  if (!platformList) return;
  if (isStaticHost()) {
    const response = await fetch(staticUrl("data/platforms.json"));
    searchPlatforms = await response.json();
    renderPlatforms();
    return;
  }
  const response = await fetch("/api/platforms");
  const payload = await response.json();
  searchPlatforms = payload.platforms || [];
  renderPlatforms();
}

async function updatePlatform(id, patch) {
  if (isStaticHost()) {
    platformMessage.textContent = "GitHub Pages 是静态页面，平台配置修改需要在本地或服务器后端中进行。";
    return;
  }
  platformMessage.textContent = "正在更新平台...";
  const response = await fetch("/api/platforms", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...patch }),
  });
  const payload = await response.json();
  platformMessage.textContent = response.ok ? "平台已更新。" : payload.error || "更新失败";
  await loadPlatforms();
}

async function deletePlatform(id) {
  if (isStaticHost()) {
    platformMessage.textContent = "GitHub Pages 是静态页面，平台配置删除需要在本地或服务器后端中进行。";
    return;
  }
  platformMessage.textContent = "正在删除平台...";
  const response = await fetch(`/api/platforms?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  const payload = await response.json();
  platformMessage.textContent = response.ok ? "平台已删除。" : payload.error || "删除失败";
  await loadPlatforms();
}

function renderDashboard() {
  const sourceEntries = topEntries(countBy(catalogPosts, (post) => post.sourcePlatform));
  const categoryEntries = topEntries(countBy(catalogPosts, (post) => post.category));
  const tagCounts = {};
  catalogPosts.forEach((post) => {
    (post.tags || []).forEach((tag) => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });

  renderRankList(sourceBreakdown, sourceEntries);
  renderRankList(categoryBreakdown, categoryEntries);
  hotTags.innerHTML = "";
  topEntries(tagCounts, 14).forEach(([tag, count]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tag hot-tag";
    button.textContent = `${tag} ${count}`;
    button.addEventListener("click", () => {
      filters.tag.value = tag;
      resetPage();
      loadPosts();
      document.querySelector("#browse").scrollIntoView({ behavior: "smooth" });
    });
    hotTags.appendChild(button);
  });
}

function excerptMarkdown(markdown) {
  return markdown
    .split(/\n+/)
    .map((line) => line.replace(/^#+\s*/, "").trim())
    .filter((line) => line && !line.startsWith("- ") && !line.startsWith("#"))
    .slice(0, 5)
    .join(" ");
}

function stripMarkdown(line) {
  return String(line || "")
    .replace(/^#+\s*/, "")
    .replace(/^[-*]\s*/, "")
    .replace(/\*\*/g, "")
    .trim();
}

function markdownTitle(markdown) {
  return stripMarkdown(markdown.split(/\n/).find((line) => line.startsWith("# ")) || "");
}

function markdownSection(markdown, heading, limit = 5) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => stripMarkdown(line) === heading);
  if (start < 0) return [];
  const out = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^#{2,}\s+/.test(line)) break;
    const clean = stripMarkdown(line);
    if (clean) out.push(clean);
    if (out.length >= limit) break;
  }
  return out;
}

function makeDailyList(titleText, items, className = "daily-list") {
  const box = document.createElement("div");
  box.className = className;
  const title = document.createElement("strong");
  title.textContent = titleText;
  const list = document.createElement("ul");
  items.forEach((item) => {
    const node = document.createElement("li");
    node.textContent = item;
    list.appendChild(node);
  });
  box.append(title, list);
  return box;
}

async function loadDailyArticle(feature) {
  if (!feature.articlePath) return "";
  try {
    const response = await fetch(staticUrl(feature.articlePath));
    if (!response.ok) return "";
    return response.text();
  } catch {
    return "";
  }
}

async function renderDailyPanel() {
  if (!dailyFeatureRoot) return;
  dailyFeatureRoot.innerHTML = "";
  const features = dailyFeatures.slice(0, 6);
  if (!features.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "还没有每日精选分析文档。后台脚本生成后会显示在这里。";
    dailyFeatureRoot.appendChild(empty);
    return;
  }

  for (const feature of features) {
    const card = document.createElement("article");
    card.className = "daily-card";
    const article = await loadDailyArticle(feature);
    const titleText = markdownTitle(article) || `${feature.company}｜${feature.direction}`;
    const conclusion = markdownSection(article, "今日结论", 1)[0] || excerptMarkdown(article) || feature.title;
    const reasons = markdownSection(article, "为什么值得看", 3);
    const keyPoints = markdownSection(article, "核心考点", 4);

    const header = document.createElement("div");
    header.className = "daily-card-header";
    const badge = document.createElement("span");
    badge.className = "daily-badge";
    badge.textContent = "今日精选";
    const title = document.createElement("h3");
    title.textContent = titleText;
    header.append(badge, title);

    const meta = document.createElement("div");
    meta.className = "daily-meta";
    [
      ["日期", feature.date],
      ["公司", feature.company],
      ["方向", feature.direction],
      ["价值分", String(feature.score || "-")],
    ].forEach(([label, value]) => {
      const item = document.createElement("span");
      item.textContent = `${label}：${value || "-"}`;
      meta.appendChild(item);
    });

    const summary = document.createElement("p");
    summary.className = "daily-summary";
    summary.textContent = conclusion;

    const body = document.createElement("div");
    body.className = "daily-readable";
    if (keyPoints.length) body.appendChild(makeDailyList("核心考点", keyPoints.slice(0, 4), "daily-list daily-keypoints"));
    if (reasons.length) body.appendChild(makeDailyList("为什么值得读", reasons.slice(0, 3)));

    const actions = document.createElement("div");
    actions.className = "card-actions";
    const doc = document.createElement("a");
    doc.className = "source-link primary-doc-link";
    doc.textContent = "阅读全文";
    doc.href = `daily.html?id=${encodeURIComponent(feature.id)}`;
    doc.target = "_blank";
    doc.rel = "noopener noreferrer nofollow";
    doc.referrerPolicy = "no-referrer";
    const source = document.createElement("a");
    source.className = "source-link";
    source.textContent = "来源链接";
    source.href = safeHttpUrl(feature.sourceUrl);
    source.target = "_blank";
    source.rel = "noopener noreferrer nofollow";
    source.referrerPolicy = "no-referrer";
    if (!source.href) source.hidden = true;
    actions.append(doc, source);
    card.append(header, meta, summary, body, actions);
    dailyFeatureRoot.appendChild(card);
  }
}

async function loadDaily() {
  if (!dailyFeatureRoot) return;
  if (isStaticHost()) {
    dailyFeatures = await readStaticDailyFeatures();
  } else {
    const response = await fetch("/api/daily-features");
    const payload = await response.json();
    dailyFeatures = payload.features || [];
  }
  await renderDailyPanel();
}

function updateResultSummary(posts) {
  const active = [];
  if (filters.keyword.value.trim()) active.push(`关键词「${filters.keyword.value.trim()}」`);
  if (filters.category.value !== "all") active.push(filters.category.value);
  if (filters.platform.value !== "all") active.push(filters.platform.value);
  if (filters.difficulty.value !== "all") active.push(filters.difficulty.value);
  if (filters.status.value !== "all") active.push(statusLabel(filters.status.value));
  if (filters.questionOnly.checked) active.push("带高频问题");
  resultSummary.textContent = active.length
    ? `${posts.length} 条结果，筛选：${active.join(" / ")}`
    : `${posts.length} 条结果，显示全部内容`;
}

function renderCategoryChips(categories) {
  categoryChips.innerHTML = "";
  categories.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip";
    button.textContent = category;
    button.addEventListener("click", () => {
      filters.category.value = category;
      resetPage();
      loadPosts();
    });
    categoryChips.appendChild(button);
  });
}

function renderPagination(total) {
  if (!paginationRoot) return;
  paginationRoot.innerHTML = "";
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return;

  const prev = document.createElement("button");
  prev.type = "button";
  prev.textContent = "上一页";
  prev.disabled = currentPage === 1;
  prev.addEventListener("click", () => {
    currentPage = Math.max(1, currentPage - 1);
    renderPosts(allPosts);
    document.querySelector("#browse").scrollIntoView({ behavior: "smooth" });
  });

  const info = document.createElement("span");
  info.textContent = `第 ${currentPage} / ${totalPages} 页`;

  const next = document.createElement("button");
  next.type = "button";
  next.textContent = "下一页";
  next.disabled = currentPage === totalPages;
  next.addEventListener("click", () => {
    currentPage = Math.min(totalPages, currentPage + 1);
    renderPosts(allPosts);
    document.querySelector("#browse").scrollIntoView({ behavior: "smooth" });
  });

  paginationRoot.append(prev, info, next);
}

function resetPage() {
  currentPage = 1;
}

function makeCollectionPicker(postId) {
  const collections = readCollections();
  const select = document.createElement("select");
  select.setAttribute("aria-label", "选择收藏夹");
  Object.keys(collections).forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
  });
  select.addEventListener("change", () => addToCollection(postId, select.value));
  return select;
}

function addToCollection(postId, name = defaultCollection) {
  const collections = readCollections();
  if (!collections[name]) collections[name] = [];
  if (!collections[name].includes(postId)) collections[name].push(postId);
  writeCollections(collections);
  renderCollections();
  updateStats(allPosts);
}

function removeFromCollection(postId, name) {
  const collections = readCollections();
  collections[name] = (collections[name] || []).filter((id) => id !== postId);
  writeCollections(collections);
  renderCollections();
  updateStats(allPosts);
}

function setStatus(postId, status) {
  const statuses = readStatuses();
  statuses[postId] = status;
  writeStatuses(statuses);
  loadPosts();
}

function buildReviewCard(post) {
  const questions = (post.questions || []).map((question) => `- ${question}`).join("\n");
  return [
    `# ${post.company} - ${post.title}`,
    `方向：${post.direction || "未标注"} / ${post.domain || "未标注"}`,
    `岗位：${post.role}`,
    `难度：${post.difficulty}`,
    `来源：${post.sourcePlatform || "未知"} ${post.sourceDate || ""}`,
    `标签：${(post.tags || []).join(", ")}`,
    "",
    "## 摘要",
    post.content,
    "",
    "## 高频问题",
    questions || "暂无",
    "",
    "## 准备建议",
    post.prepTips || "暂无",
  ].join("\n");
}

function questionFocusLine(post) {
  const parts = [post.category, post.direction, post.domain].filter(Boolean);
  const unique = [...new Set(parts)].slice(0, 3);
  return unique.length ? `考点概览：${unique.join(" / ")}` : "考点概览：综合面试题";
}

function answerHint(question) {
  const rules = [
    [/Vision encoder|LLM token|Q-Former|projector|cross-attention/i, "核心是把视觉特征压缩/投影到 LLM 可消费的 token 空间；比较 projector 简单高效、Q-Former 查询压缩、cross-attention 保留交互但成本更高。"],
    [/grounding|OCR|空间关系|幻觉/i, "按任务拆指标：grounding 看定位，OCR 看文字识别，空间关系看关系推理，幻觉看无依据生成；人工集、自动指标和负样本压力测试结合。"],
    [/指令微调|数据|噪声|偏见|泄漏/i, "先讲数据来源和配比，再讲清洗、去重、OCR/答案泄漏过滤、难例构造和评测集隔离，最后说明线上反馈如何回流。"],
    [/action token|连续动作|diffusion policy/i, "离散 action token 适合语言式规划，连续回归适合低延迟控制，diffusion policy 更适合多峰动作分布和复杂操作轨迹。"],
    [/遥操作|时间同步|轨迹切分|失败样本/i, "重点是多传感器时间戳对齐、episode 切分、成功/失败标签、异常轨迹过滤，以及用失败样本提升鲁棒性。"],
    [/帧采样|temporal token|long-context/i, "回答维度是信息量、成本和时序覆盖：均匀/关键帧采样降成本，temporal token 压缩保留动态，长上下文 attention 处理长程依赖。"],
    [/时序一致性|动作理解|事件边界|身份保持/i, "评估要覆盖动作类别、事件起止、跨帧身份一致和因果顺序；视频生成还要看物理合理性和主体漂移。"],
    [/DeepSpeed|ZeRO|Megatron|张量并行|流水并行|数据并行/i, "数据并行扩 batch，张量并行切矩阵计算，流水并行切层，ZeRO 切优化器/梯度/参数状态；核心权衡是通信和负载均衡。"],
    [/显存|参数|梯度|优化器|激活值|KV cache/i, "显存拆成参数、梯度、优化器状态、激活值和 KV cache；优化手段包括 ZeRO、checkpoint、混合精度、FlashAttention 和量化。"],
    [/KV cache|PagedAttention|continuous batching|speculative decoding/i, "KV cache 避免重复算历史 token，PagedAttention 管理碎片，continuous batching 提升吞吐，speculative decoding 用小模型草稿降延迟。"],
    [/INT8|INT4|AWQ|GPTQ|LoRA|蒸馏/i, "INT8/INT4 降显存和带宽，AWQ/GPTQ 偏离线量化，LoRA 合并减少推理额外开销，蒸馏用小模型换成本和速度。"],
    [/BEV|occupancy|轨迹预测|仿真闭环|世界模型/i, "世界模型要学习环境状态和未来演化；BEV/occupancy 表示空间，轨迹预测建模交互，仿真闭环验证策略泛化。"],
    [/场景挖掘|长尾样本|自动标注|仿真评测/i, "数据闭环链路是线上触发、长尾挖掘、自动/人工标注、训练回流、仿真和实车评测，关键是覆盖率和安全收益。"],
    [/RLHF|DPO|GRPO|PPO|优化目标/i, "PPO 依赖 reward model 做在线式策略优化，DPO 直接用偏好对优化，GRPO 减少 value model 依赖；比较目标、稳定性和成本。"],
    [/Reward model|reward hacking|长度偏置|分布外/i, "Reward model 要控制偏好数据质量、长度偏置和分布外泛化；用对抗样本、校准集和人工复核降低 reward hacking。"],
  ];
  return rules.find(([pattern]) => pattern.test(question))?.[1] || "先回答核心机制，再补关键取舍、常见失败模式和可量化评估指标。";
}

async function copyReviewCard(post) {
  const text = buildReviewCard(post);
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    return;
  }
  window.prompt("复制复习卡", text);
}

function renderPosts(posts) {
  postsRoot.innerHTML = "";
  allPosts = posts;
  const statuses = readStatuses();
  updateStats(posts);
  updateResultSummary(posts);
  const totalPages = Math.max(1, Math.ceil(posts.length / pageSize));
  currentPage = Math.min(Math.max(1, currentPage), totalPages);
  const pagePosts = posts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (!posts.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "没有匹配内容，换个关键词或清空筛选试试。";
    postsRoot.appendChild(empty);
    renderPagination(0);
    return;
  }

  pagePosts.forEach((post) => {
    const card = template.content.cloneNode(true);
    const status = statuses[post.id] || "unread";
    card.querySelector(".type-pill").textContent = typeLabel(post.type);
    card.querySelector(".difficulty").textContent = post.difficulty;
    card.querySelector(".category").textContent = post.category || "未分类";
    card.querySelector(".date").textContent = post.sourceDate || "未知时间";
    card.querySelector(".status-pill").textContent = statusLabel(status);
    card.querySelector(".status-pill").dataset.status = status;
    card.querySelector("h3").textContent = post.title;
    card.querySelector(".company-role").textContent = `${post.company} · ${post.role}`;
    card.querySelector(".domain-line").textContent = `${post.direction || "未标方向"} · ${post.domain || "未标领域"} · ${post.sourcePlatform || "未知来源"}`;
    const questions = post.questions || [];
    const answerHints = card.querySelector(".answer-hints");
    answerHints.hidden = !questions.length;
    const questionSummary = card.querySelector(".question-summary");
    if (questions.length) {
      const title = document.createElement("strong");
      title.textContent = `题目摘要 (${questions.length})`;
      const focus = document.createElement("p");
      focus.className = "question-focus";
      focus.textContent = questionFocusLine(post);
      const list = document.createElement("ol");
      questions.slice(0, 4).forEach((question) => {
        const item = document.createElement("li");
        item.textContent = question;
        list.appendChild(item);
      });
      questionSummary.appendChild(title);
      questionSummary.appendChild(focus);
      questionSummary.appendChild(list);
      const answerTitle = document.createElement("strong");
      answerTitle.textContent = "简答提示";
      const answerList = document.createElement("ul");
      questions.slice(0, 4).forEach((question) => {
        const item = document.createElement("li");
        const questionText = document.createElement("span");
        questionText.className = "answer-question";
        questionText.textContent = question;
        const answerText = document.createElement("p");
        answerText.textContent = answerHint(question);
        item.append(questionText, answerText);
        answerList.appendChild(item);
      });
      answerHints.append(answerTitle, answerList);
      if (questions.length > 4) {
        const more = document.createElement("p");
        more.className = "question-more";
        more.textContent = `另有 ${questions.length - 4} 个问题，可复制复习卡查看完整内容。`;
        questionSummary.appendChild(more);
      }
    } else {
      questionSummary.hidden = true;
    }

    const questionBlock = card.querySelector(".question-block");
    if (questions.length > 4) {
      const title = document.createElement("strong");
      title.textContent = `完整问题 (${questions.length})`;
      const list = document.createElement("ul");
      questions.forEach((question) => {
        const item = document.createElement("li");
        item.textContent = question;
        list.appendChild(item);
      });
      questionBlock.appendChild(title);
      questionBlock.appendChild(list);
    } else {
      questionBlock.hidden = true;
    }

    const prepTips = card.querySelector(".prep-tips");
    if (post.prepTips) {
      prepTips.textContent = `准备建议：${post.prepTips}`;
    } else {
      prepTips.hidden = true;
    }

    const tags = card.querySelector(".tags");
    (post.tags || []).forEach((tag) => {
      const node = document.createElement("button");
      node.className = "tag";
      node.type = "button";
      node.textContent = tag;
      node.addEventListener("click", () => {
        filters.tag.value = tag;
        resetPage();
        loadPosts();
      });
      tags.appendChild(node);
    });

    const source = card.querySelector(".source-link");
    const sourceUrl = safeHttpUrl(post.sourceUrl);
    if (sourceUrl) {
      source.href = sourceUrl;
    } else {
      source.hidden = true;
    }

    card.querySelector(".favorite-button").addEventListener("click", () => addToCollection(post.id));
    card.querySelector(".read-button").addEventListener("click", () => setStatus(post.id, "read"));
    card.querySelector(".focus-button").addEventListener("click", () => setStatus(post.id, "focus"));
    card.querySelector(".review-button").addEventListener("click", () => setStatus(post.id, "review"));
    card.querySelector(".copy-button").addEventListener("click", () => copyReviewCard(post));
    card.querySelector(".card-actions").appendChild(makeCollectionPicker(post.id));

    postsRoot.appendChild(card);
  });
  renderPagination(posts.length);
}

function renderCollections() {
  const collections = readCollections();
  collectionsRoot.innerHTML = "";
  const postsById = new Map(catalogPosts.map((post) => [post.id, post]));

  Object.entries(collections).forEach(([name, ids]) => {
    const box = document.createElement("article");
    box.className = "collection-card";
    const title = document.createElement("h3");
    title.textContent = `${name} (${ids.length})`;
    box.appendChild(title);

    if (!ids.length) {
      const empty = document.createElement("p");
      empty.textContent = "还没有收藏内容。";
      box.appendChild(empty);
    }

    ids.forEach((id) => {
      const post = postsById.get(id);
      const row = document.createElement("div");
      row.className = "collection-row";
      const text = document.createElement("span");
      text.textContent = post ? `${post.company} · ${post.title}` : id;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "移除";
      remove.addEventListener("click", () => removeFromCollection(id, name));
      row.appendChild(text);
      row.appendChild(remove);
      box.appendChild(row);
    });
    collectionsRoot.appendChild(box);
  });
  collectionCount.textContent = Object.keys(collections).length;
}

function exportCollections() {
  const collections = readCollections();
  const postsById = new Map(catalogPosts.map((post) => [post.id, post]));
  const payload = Object.fromEntries(
    Object.entries(collections).map(([name, ids]) => [
      name,
      ids.map((id) => postsById.get(id) || { id, missing: true }),
    ])
  );
  collectionExport.hidden = false;
  collectionExport.textContent = JSON.stringify(payload, null, 2);
}

function applyPreset(preset) {
  const presets = {
    vla: { category: "VLA / 具身智能", keyword: "" },
    multimodal: { category: "多模态大模型", keyword: "" },
    training: { category: "all", keyword: "训练框架 DeepSpeed Megatron" },
  };
  const config = presets[preset];
  if (!config) return;
  filters.category.value = config.category;
  filters.keyword.value = config.keyword;
  filters.questionOnly.checked = true;
  resetPage();
  loadPosts();
  document.querySelector("#browse").scrollIntoView({ behavior: "smooth" });
}

async function loadCatalog() {
  if (isStaticHost()) {
    const payload = await readStaticPosts();
    catalogPosts = payload.posts || [];
    meta = payload.meta || meta;
    renderDashboard();
    return;
  }
  const response = await fetch("/api/posts");
  const payload = await response.json();
  catalogPosts = payload.posts || [];
  renderDashboard();
}

async function loadPosts() {
  if (isStaticHost()) {
    const payload = await readStaticPosts();
    meta = payload.meta || meta;
    renderPosts(applyClientFilters(filterStaticPosts(payload.posts || [])));
    renderCollections();
    return;
  }
  const query = buildServerQuery();
  const response = await fetch(`/api/posts${query ? `?${query}` : ""}`);
  const payload = await response.json();
  meta = payload.meta || meta;
  renderPosts(applyClientFilters(payload.posts || []));
  renderCollections();
}

async function loadMeta() {
  if (isStaticHost()) {
    const payload = await readStaticPosts();
    meta = payload.meta;
    setOptions(filters.category, meta.categories || [], "全部分类");
    setOptions(filters.platform, meta.platforms || [], "全部平台");
    setOptions(filters.difficulty, meta.difficulties || [], "全部难度");
    setOptions(filters.tag, meta.tags || [], "全部标签");
    setFormCategories(meta.categories || []);
    renderCategoryChips(meta.categories || []);
    return;
  }
  const response = await fetch("/api/meta");
  meta = await response.json();
  setOptions(filters.category, meta.categories || [], "全部分类");
  setOptions(filters.platform, meta.platforms || [], "全部平台");
  setOptions(filters.difficulty, meta.difficulties || [], "全部难度");
  setOptions(filters.tag, meta.tags || [], "全部标签");
  setFormCategories(meta.categories || []);
  renderCategoryChips(meta.categories || []);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (isStaticHost()) {
    formMessage.textContent = "GitHub Pages 是静态页面，发布内容需要在本地或服务器后端中进行。";
    return;
  }
  formMessage.textContent = "正在发布...";
  const data = Object.fromEntries(new FormData(form).entries());
  const response = await fetch("/api/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const payload = await response.json();
  if (!response.ok) {
    formMessage.textContent = payload.error || "发布失败";
    return;
  }
  form.reset();
  formMessage.textContent = "发布成功。";
  await loadMeta();
  await loadCatalog();
  await loadPosts();
});

if (platformForm) {
  platformForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (isStaticHost()) {
      platformMessage.textContent = "GitHub Pages 是静态页面，添加平台需要在本地或服务器后端中进行。";
      return;
    }
    platformMessage.textContent = "正在添加平台...";
    const data = Object.fromEntries(new FormData(platformForm).entries());
    data.enabled = true;
    data.matchDomains = (data.matchDomains || "")
      .split(/[，,]/)
      .map((item) => item.trim())
      .filter(Boolean);

    const response = await fetch("/api/platforms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const payload = await response.json();
    if (!response.ok) {
      platformMessage.textContent = payload.error || "添加失败";
      return;
    }
    platformForm.reset();
    platformMessage.textContent = "平台已添加，下次自动检索会使用最新配置。";
    await loadPlatforms();
  });
}

collectionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = collectionName.value.trim();
  if (!name) return;
  const collections = readCollections();
  if (!collections[name]) collections[name] = [];
  writeCollections(collections);
  collectionName.value = "";
  renderCollections();
  updateStats(allPosts);
});

exportCollectionsButton.addEventListener("click", exportCollections);

Object.values(filters).forEach((input) => {
  input.addEventListener("input", () => {
    resetPage();
    loadPosts();
  });
  input.addEventListener("change", () => {
    resetPage();
    loadPosts();
  });
});

document.querySelectorAll(".preset-button").forEach((button) => {
  button.addEventListener("click", () => applyPreset(button.dataset.preset));
});

document.querySelector("#clearFilters").addEventListener("click", () => {
  filters.keyword.value = "";
  filters.company.value = "";
  filters.role.value = "";
  filters.type.value = "all";
  filters.category.value = "all";
  filters.platform.value = "all";
  filters.difficulty.value = "all";
  filters.tag.value = "all";
  filters.status.value = "all";
  filters.sort.value = "date-desc";
  filters.questionOnly.checked = false;
  filters.startDate.value = "";
  filters.endDate.value = "";
  resetPage();
  loadPosts();
});

ensureDefaultCollection();
Promise.all([loadMeta(), loadCatalog(), loadPlatforms(), loadDaily()]).then(loadPosts);
