const readerRoot = document.querySelector("#dailyReader");
const staticAssetVersion = "20260606-daily-readable";

function staticUrl(path) {
  const separator = path.includes("?") ? "&" : "?";
  return `./${path}${separator}v=${staticAssetVersion}`;
}

function isStaticHost() {
  return location.hostname.endsWith("github.io") || location.protocol === "file:";
}

function cleanLine(line) {
  return String(line || "").trim();
}

function appendTextBlock(parent, tag, text, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = text;
  parent.appendChild(node);
  return node;
}

function renderMarkdown(markdown, feature) {
  readerRoot.innerHTML = "";

  const meta = document.createElement("div");
  meta.className = "reader-meta";
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

  const body = document.createElement("div");
  body.className = "markdown-body";
  let currentList = null;

  markdown.split(/\r?\n/).forEach((rawLine) => {
    const line = cleanLine(rawLine);
    if (!line) {
      currentList = null;
      return;
    }

    if (line.startsWith("# ")) {
      appendTextBlock(readerRoot, "p", "Daily Study", "eyebrow");
      appendTextBlock(readerRoot, "h1", line.replace(/^#\s+/, ""));
      readerRoot.appendChild(meta);
      return;
    }

    if (line.startsWith("## ")) {
      currentList = null;
      appendTextBlock(body, "h2", line.replace(/^##\s+/, ""));
      return;
    }

    if (line.startsWith("### ")) {
      currentList = null;
      appendTextBlock(body, "h3", line.replace(/^###\s+/, ""));
      return;
    }

    if (/^[-*]\s+/.test(line)) {
      if (!currentList) {
        currentList = document.createElement("ul");
        body.appendChild(currentList);
      }
      appendTextBlock(currentList, "li", line.replace(/^[-*]\s+/, ""));
      return;
    }

    currentList = null;
    appendTextBlock(body, "p", line);
  });

  const actions = document.createElement("div");
  actions.className = "reader-actions";
  const back = document.createElement("a");
  back.className = "source-link primary-doc-link";
  back.href = "./#daily";
  back.textContent = "返回每日精选";
  const source = document.createElement("a");
  source.className = "source-link";
  source.href = feature.sourceUrl || "#";
  source.textContent = "查看来源";
  source.target = "_blank";
  source.rel = "noopener noreferrer nofollow";
  source.referrerPolicy = "no-referrer";
  actions.append(back, source);

  readerRoot.append(body, actions);
}

async function main() {
  const id = new URLSearchParams(location.search).get("id");
  const features = isStaticHost()
    ? await fetch(staticUrl("data/daily-features.json")).then((response) => response.json())
    : await fetch("/api/daily-features").then((response) => response.json()).then((payload) => payload.features || []);
  const feature = features.find((item) => item.id === id) || features[0];
  if (!feature) {
    readerRoot.innerHTML = "";
    appendTextBlock(readerRoot, "h1", "暂无每日精选分析");
    return;
  }

  const markdown = await fetch(staticUrl(feature.articlePath)).then((response) => response.text());
  renderMarkdown(markdown, feature);
}

main().catch(() => {
  readerRoot.innerHTML = "";
  appendTextBlock(readerRoot, "h1", "加载失败");
  appendTextBlock(readerRoot, "p", "请稍后刷新，或返回首页查看每日精选。");
});
