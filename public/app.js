const form = document.querySelector("#postForm");
const formMessage = document.querySelector("#formMessage");
const postsRoot = document.querySelector("#posts");
const template = document.querySelector("#postTemplate");
const categoryChips = document.querySelector("#categoryChips");
const collectionsRoot = document.querySelector("#collectionsRoot");
const collectionForm = document.querySelector("#collectionForm");
const collectionName = document.querySelector("#collectionName");
const exportCollectionsButton = document.querySelector("#exportCollections");
const collectionExport = document.querySelector("#collectionExport");

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
  startDate: document.querySelector("#startDate"),
  endDate: document.querySelector("#endDate"),
};

const formCategory = document.querySelector("#formCategory");
const totalCount = document.querySelector("#totalCount");
const questionCount = document.querySelector("#questionCount");
const experienceCount = document.querySelector("#experienceCount");
const collectionCount = document.querySelector("#collectionCount");
const resultSummary = document.querySelector("#resultSummary");

const collectionKey = "interview-hub-collections";
const statusKey = "interview-hub-statuses";
const defaultCollection = "默认收藏";

let allPosts = [];
let catalogPosts = [];
let meta = {};

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

function formatDate(value) {
  return value || "未知时间";
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

  const sorters = {
    "date-desc": (a, b) => (b.sourceDate || "").localeCompare(a.sourceDate || ""),
    "date-asc": (a, b) => (a.sourceDate || "").localeCompare(b.sourceDate || ""),
    "difficulty-desc": (a, b) => difficultyRank(b.difficulty) - difficultyRank(a.difficulty),
    "company-asc": (a, b) => (a.company || "").localeCompare(b.company || "", "zh-CN"),
  };
  result.sort(sorters[filters.sort.value] || sorters["date-desc"]);
  return result;
}

function updateStats(posts) {
  totalCount.textContent = posts.length;
  questionCount.textContent = posts.filter((post) => post.type === "question" || post.type === "collection").length;
  experienceCount.textContent = posts.filter((post) => post.type === "experience" || post.type === "video").length;
  collectionCount.textContent = Object.keys(readCollections()).length;
}

function updateResultSummary(posts) {
  const active = [];
  if (filters.keyword.value.trim()) active.push(`关键词「${filters.keyword.value.trim()}」`);
  if (filters.category.value !== "all") active.push(filters.category.value);
  if (filters.platform.value !== "all") active.push(filters.platform.value);
  if (filters.difficulty.value !== "all") active.push(filters.difficulty.value);
  if (filters.status.value !== "all") active.push(statusLabel(filters.status.value));
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
      loadPosts();
    });
    categoryChips.appendChild(button);
  });
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

  if (!posts.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "没有匹配内容，换个关键词或清空筛选试试。";
    postsRoot.appendChild(empty);
    return;
  }

  posts.forEach((post) => {
    const card = template.content.cloneNode(true);
    const status = statuses[post.id] || "unread";
    card.querySelector(".type-pill").textContent = typeLabel(post.type);
    card.querySelector(".difficulty").textContent = post.difficulty;
    card.querySelector(".category").textContent = post.category || "未分类";
    card.querySelector(".date").textContent = formatDate(post.sourceDate);
    card.querySelector(".status-pill").textContent = statusLabel(status);
    card.querySelector(".status-pill").dataset.status = status;
    card.querySelector("h3").textContent = post.title;
    card.querySelector(".company-role").textContent = `${post.company} · ${post.role}`;
    card.querySelector(".domain-line").textContent = `${post.direction || "未标方向"} · ${post.domain || "未标领域"} · ${post.sourcePlatform || "未知来源"}`;
    card.querySelector(".content").textContent = post.content;

    const questionBlock = card.querySelector(".question-block");
    if (post.questions && post.questions.length) {
      const title = document.createElement("strong");
      title.textContent = "高频问题";
      const list = document.createElement("ul");
      post.questions.forEach((question) => {
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
        loadPosts();
      });
      tags.appendChild(node);
    });

    const source = card.querySelector(".source-link");
    if (post.sourceUrl) {
      source.href = post.sourceUrl;
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

async function loadCatalog() {
  const response = await fetch("/api/posts");
  const payload = await response.json();
  catalogPosts = payload.posts || [];
}

async function loadPosts() {
  const query = buildServerQuery();
  const response = await fetch(`/api/posts${query ? `?${query}` : ""}`);
  const payload = await response.json();
  meta = payload.meta || meta;
  renderPosts(applyClientFilters(payload.posts || []));
  renderCollections();
}

async function loadMeta() {
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
  input.addEventListener("input", loadPosts);
  input.addEventListener("change", loadPosts);
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
  filters.startDate.value = "";
  filters.endDate.value = "";
  loadPosts();
});

ensureDefaultCollection();
Promise.all([loadMeta(), loadCatalog()]).then(loadPosts);
