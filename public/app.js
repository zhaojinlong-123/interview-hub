const form = document.querySelector("#postForm");
const formMessage = document.querySelector("#formMessage");
const postsRoot = document.querySelector("#posts");
const template = document.querySelector("#postTemplate");

const filters = {
  keyword: document.querySelector("#keyword"),
  company: document.querySelector("#companyFilter"),
  role: document.querySelector("#roleFilter"),
  type: document.querySelector("#typeFilter"),
};

const totalCount = document.querySelector("#totalCount");
const questionCount = document.querySelector("#questionCount");
const experienceCount = document.querySelector("#experienceCount");

function formatDate(timestamp) {
  return new Date(timestamp * 1000).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function typeLabel(type) {
  return type === "question" ? "面试题目" : "面试经验";
}

function buildQuery() {
  const params = new URLSearchParams();
  if (filters.keyword.value.trim()) params.set("q", filters.keyword.value.trim());
  if (filters.company.value.trim()) params.set("company", filters.company.value.trim());
  if (filters.role.value.trim()) params.set("role", filters.role.value.trim());
  if (filters.type.value !== "all") params.set("type", filters.type.value);
  return params.toString();
}

function renderPosts(posts) {
  postsRoot.innerHTML = "";
  totalCount.textContent = posts.length;
  questionCount.textContent = posts.filter((post) => post.type === "question").length;
  experienceCount.textContent = posts.filter((post) => post.type === "experience").length;

  if (!posts.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "还没有匹配内容，换个关键词或发布第一条面经。";
    postsRoot.appendChild(empty);
    return;
  }

  posts.forEach((post) => {
    const card = template.content.cloneNode(true);
    card.querySelector(".type-pill").textContent = typeLabel(post.type);
    card.querySelector(".difficulty").textContent = post.difficulty;
    card.querySelector(".date").textContent = formatDate(post.createdAt);
    card.querySelector("h3").textContent = post.title;
    card.querySelector(".company-role").textContent = `${post.company} · ${post.role}`;
    card.querySelector(".content").textContent = post.content;

    const tags = card.querySelector(".tags");
    post.tags.forEach((tag) => {
      const node = document.createElement("span");
      node.className = "tag";
      node.textContent = tag;
      tags.appendChild(node);
    });

    postsRoot.appendChild(card);
  });
}

async function loadPosts() {
  const query = buildQuery();
  const response = await fetch(`/api/posts${query ? `?${query}` : ""}`);
  const payload = await response.json();
  renderPosts(payload.posts || []);
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
  formMessage.textContent = "发布成功，所有用户刷新后都能看到。";
  await loadPosts();
});

Object.values(filters).forEach((input) => {
  input.addEventListener("input", loadPosts);
  input.addEventListener("change", loadPosts);
});

document.querySelector("#clearFilters").addEventListener("click", () => {
  filters.keyword.value = "";
  filters.company.value = "";
  filters.role.value = "";
  filters.type.value = "all";
  loadPosts();
});

loadPosts();
