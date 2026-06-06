const queueRoot = document.querySelector("#publishQueueRoot");
const staticAssetVersion = "20260606-xhs-cover-v2";

function staticUrl(path) {
  const separator = path.includes("?") ? "&" : "?";
  return `./${path}${separator}v=${staticAssetVersion}`;
}

function safeHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

async function copyText(text, button) {
  await navigator.clipboard.writeText(text);
  const previous = button.textContent;
  button.textContent = "已复制";
  setTimeout(() => {
    button.textContent = previous;
  }, 1600);
}

function renderRecord(record) {
  const card = document.createElement("article");
  card.className = "publish-queue-card";

  const header = document.createElement("div");
  header.className = "publish-queue-header";
  const status = document.createElement("span");
  status.className = `status-pill ${record.status === "published" ? "published" : "manual"}`;
  status.textContent = record.status === "published" ? "已发布/审核中" : "待手机确认";
  const time = document.createElement("span");
  time.textContent = record.updatedAt ? new Date(record.updatedAt).toLocaleString("zh-CN") : "";
  header.append(status, time);

  const title = document.createElement("h2");
  title.textContent = record.title;

  const reason = document.createElement("p");
  reason.className = "queue-reason";
  reason.textContent = record.reason || "等待发布";

  const cover = document.createElement("div");
  cover.className = "xhs-cover-preview";
  if (record.coverImage) {
    const img = document.createElement("img");
    img.src = staticUrl(record.coverImage);
    img.alt = record.coverTitle || record.title || "小红书封面";
    cover.appendChild(img);
  } else {
    const coverTitle = document.createElement("strong");
    coverTitle.textContent = record.coverTitle || record.title;
    const coverSubtitle = document.createElement("span");
    coverSubtitle.textContent = record.coverSubtitle || "每日精选学习笔记";
    cover.append(coverTitle, coverSubtitle);
  }

  const body = document.createElement("pre");
  body.textContent = record.body;

  const actions = document.createElement("div");
  actions.className = "reader-actions";
  const copyTitle = document.createElement("button");
  copyTitle.type = "button";
  copyTitle.textContent = "复制标题";
  copyTitle.addEventListener("click", () => copyText(record.title || "", copyTitle));
  const copyCover = document.createElement("button");
  copyCover.type = "button";
  copyCover.textContent = "复制封面";
  copyCover.addEventListener("click", () => copyText(`${record.coverTitle || record.title}\n${record.coverSubtitle || ""}`.trim(), copyCover));
  const copyBody = document.createElement("button");
  copyBody.type = "button";
  copyBody.className = "primary-button";
  copyBody.textContent = "复制正文";
  copyBody.addEventListener("click", () => copyText(record.body || "", copyBody));
  actions.append(copyBody, copyTitle, copyCover);

  const source = safeHttpUrl(record.sourceUrl);
  if (source) {
    const sourceLink = document.createElement("a");
    sourceLink.className = "source-link";
    sourceLink.href = source;
    sourceLink.textContent = "查看引用来源";
    sourceLink.target = "_blank";
    sourceLink.rel = "noopener noreferrer nofollow";
    sourceLink.referrerPolicy = "no-referrer";
    actions.appendChild(sourceLink);
  }

  card.append(header, title, reason, cover, body, actions);
  return card;
}

async function main() {
  const response = await fetch(staticUrl("data/publish-queue.json"));
  const queue = response.ok ? await response.json() : [];
  queueRoot.innerHTML = "";
  if (!queue.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "当前没有待发布文案。";
    queueRoot.appendChild(empty);
    return;
  }
  queue.forEach((record) => queueRoot.appendChild(renderRecord(record)));
}

main().catch(() => {
  queueRoot.innerHTML = "<div class=\"empty\">加载待发布队列失败。</div>";
});
