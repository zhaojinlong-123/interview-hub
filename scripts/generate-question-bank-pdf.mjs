import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const postsPath = path.join(root, "data", "posts.json");
const outDir = path.join(root, "public", "downloads");
const tmpDir = path.join(root, "tmp", "pdf");
const htmlPath = path.join(tmpDir, "interview-question-bank-v1.html");
const pdfPath = path.join(outDir, "interview-question-bank-v1.pdf");

const posts = JSON.parse(fs.readFileSync(postsPath, "utf8"));

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeQuestion(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function answerFor(post, question, index) {
  const answers = post.questionAnswers || [];
  const exact = answers.find((item) => normalizeQuestion(item.question) === normalizeQuestion(question));
  return exact?.answer || answers[index]?.answer || "";
}

function sourceHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function groupKey(item) {
  return item.category || item.direction || "未分类";
}

function shortUrl(url) {
  if (!url) return "无";
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname}`.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const seen = new Set();
const questions = [];

for (const post of posts) {
  const list = post.questions || [];
  list.forEach((questionRaw, index) => {
    const question = typeof questionRaw === "string" ? questionRaw : questionRaw?.question;
    const key = normalizeQuestion(question);
    if (!question || seen.has(key)) return;
    seen.add(key);
    questions.push({
      number: questions.length + 1,
      question,
      answer: answerFor(post, question, index),
      title: post.title || "",
      company: post.company || "",
      role: post.role || "",
      direction: post.direction || "",
      domain: post.domain || "",
      category: post.category || "",
      difficulty: post.difficulty || "",
      platform: post.sourcePlatform || "",
      sourceDate: post.sourceDate || "",
      sourceUrl: post.sourceUrl || "",
      tags: post.tags || [],
    });
  });
}

const groups = new Map();
for (const item of questions) {
  const key = groupKey(item);
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(item);
}

const sortedGroups = [...groups.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], "zh-CN"));
let displayNumber = 1;
for (const [, items] of sortedGroups) {
  for (const item of items) {
    item.displayNumber = displayNumber;
    displayNumber += 1;
  }
}
const platforms = new Map();
for (const post of posts) {
  const key = post.sourcePlatform || "未知";
  platforms.set(key, (platforms.get(key) || 0) + 1);
}
const dates = posts.map((post) => post.sourceDate).filter(Boolean).sort();
const generatedAt = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
}).format(new Date());

const toc = sortedGroups
  .map(([name, items], index) => `<a href="#group-${index + 1}"><span>${escapeHtml(name)}</span><strong>${items.length} 题</strong></a>`)
  .join("");

const platformBadges = [...platforms.entries()]
  .sort((a, b) => b[1] - a[1])
  .map(([name, count]) => `<span>${escapeHtml(name)} ${count}</span>`)
  .join("");

const groupHtml = sortedGroups
  .map(([name, items], groupIndex) => {
    const rows = items
      .map((item) => {
        const tags = item.tags.slice(0, 8).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
        const source = item.sourceUrl
          ? `<a href="${escapeHtml(item.sourceUrl)}">${escapeHtml(shortUrl(item.sourceUrl))}</a>`
          : "无";
        return `
          <article class="question-card">
            <div class="q-head">
              <span class="q-no">Q${item.displayNumber}</span>
              <h3>${escapeHtml(item.question)}</h3>
            </div>
            <div class="meta-grid">
              <p><b>方向</b>${escapeHtml(item.direction || item.category || "未标注")}</p>
              <p><b>岗位</b>${escapeHtml(item.role || "综合岗位")}</p>
              <p><b>难度</b>${escapeHtml(item.difficulty || "未标注")}</p>
              <p><b>来源</b>${escapeHtml(item.platform || sourceHost(item.sourceUrl) || "未标注")} ${escapeHtml(item.sourceDate || "")}</p>
            </div>
            <section class="answer">
              <h4>参考回答</h4>
              <p>${escapeHtml(item.answer || "暂无模型回答，建议后续补充。")}</p>
            </section>
            <div class="source-line">
              <b>来源链接</b>${source}
            </div>
            ${tags ? `<div class="tags">${tags}</div>` : ""}
          </article>
        `;
      })
      .join("");
    return `
      <section class="group" id="group-${groupIndex + 1}">
        <div class="group-title">
          <p>Part ${groupIndex + 1}</p>
          <h2>${escapeHtml(name)}</h2>
          <strong>${items.length} 题</strong>
        </div>
        ${rows}
      </section>
    `;
  })
  .join("");

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>大模型与具身智能面经题库第一版</title>
  <style>
    @page { size: A4; margin: 16mm 14mm 18mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #14202b;
      background: #f5f8fb;
      font-family: "Noto Sans SC", "Microsoft YaHei", "SimHei", Arial, sans-serif;
      line-height: 1.72;
      font-size: 12px;
    }
    a { color: #0667c8; text-decoration: none; overflow-wrap: anywhere; }
    .cover {
      min-height: 260mm;
      padding: 30mm 13mm 20mm;
      color: #f6fbff;
      background:
        linear-gradient(135deg, rgba(8, 16, 25, .96), rgba(10, 47, 61, .95)),
        radial-gradient(circle at 78% 12%, rgba(102, 228, 255, .34), transparent 34%);
      page-break-after: always;
      border-radius: 0;
    }
    .cover .eyebrow { color: #72ffc6; font-size: 13px; font-weight: 800; letter-spacing: .08em; }
    h1 { margin: 12px 0 18px; font-size: 38px; line-height: 1.14; letter-spacing: 0; }
    .subtitle { max-width: 560px; color: #b8cad7; font-size: 15px; }
    .cover-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 28px; }
    .metric { padding: 14px; border: 1px solid rgba(114,255,198,.25); background: rgba(255,255,255,.06); border-radius: 10px; }
    .metric strong { display: block; color: #66e4ff; font-size: 26px; line-height: 1.1; }
    .metric span { color: #c3d8e7; font-size: 11px; }
    .scope { margin-top: 24px; padding: 16px; border-left: 4px solid #72ffc6; background: rgba(255,255,255,.06); }
    .scope p { margin: 6px 0; }
    .section { page-break-after: always; }
    .section h2, .group-title h2 { margin: 0; font-size: 24px; color: #0b3346; }
    .section-lead { color: #52697a; }
    .toc { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 16px; }
    .toc a { display: flex; justify-content: space-between; gap: 10px; padding: 9px 10px; border: 1px solid #d6e5ee; border-radius: 8px; background: #fff; color: #14202b; }
    .toc strong { color: #07866b; white-space: nowrap; }
    .badges { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; }
    .badges span, .tags span { padding: 3px 7px; border: 1px solid #c8e3ed; border-radius: 999px; background: #edf8fb; color: #155066; font-size: 10px; }
    .group { page-break-before: auto; }
    .group + .group { page-break-before: always; }
    .group-title { display: grid; grid-template-columns: 1fr auto; align-items: end; gap: 12px; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 2px solid #0e6177; }
    .group-title p { grid-column: 1 / -1; margin: 0; color: #07866b; font-weight: 800; text-transform: uppercase; }
    .group-title strong { color: #07866b; font-size: 16px; }
    .question-card {
      page-break-inside: avoid;
      margin: 0 0 10px;
      padding: 12px 13px;
      border: 1px solid #d9e6ee;
      border-radius: 10px;
      background: #fff;
      box-shadow: 0 5px 18px rgba(17, 42, 61, .06);
    }
    .q-head { display: grid; grid-template-columns: auto 1fr; gap: 8px; align-items: start; }
    .q-no { padding: 3px 7px; border-radius: 999px; background: #103142; color: #72ffc6; font-weight: 900; }
    h3 { margin: 0 0 8px; font-size: 15px; line-height: 1.45; color: #071923; }
    .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px 10px; margin: 8px 0; color: #52697a; }
    .meta-grid p { margin: 0; }
    b { color: #0b3346; margin-right: 5px; }
    .answer { margin-top: 9px; padding: 9px 10px; border-left: 3px solid #23b58f; background: #f0fbf7; border-radius: 6px; }
    .answer h4 { margin: 0 0 4px; color: #07866b; font-size: 12px; }
    .answer p { margin: 0; white-space: pre-wrap; }
    .source-line { margin-top: 8px; color: #52697a; font-size: 10px; }
    .tags { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px; }
    .footer-note { margin-top: 14px; color: #678; font-size: 10px; }
  </style>
</head>
<body>
  <section class="cover">
    <p class="eyebrow">Interview Hub / Version 1</p>
    <h1>大模型与具身智能<br />完整面经题库</h1>
    <p class="subtitle">聚焦多模态大模型、VLA/具身智能、世界模型、视频理解、训练框架、推理部署与自动驾驶数据闭环。所有题目按归一化题面去重，并保留来源信息与模型参考回答。</p>
    <div class="cover-grid">
      <div class="metric"><strong>${questions.length}</strong><span>唯一题目</span></div>
      <div class="metric"><strong>${posts.length}</strong><span>来源记录</span></div>
      <div class="metric"><strong>${sortedGroups.length}</strong><span>方向分组</span></div>
      <div class="metric"><strong>${platforms.size}</strong><span>来源平台</span></div>
    </div>
    <div class="scope">
      <p><b>起止时间</b>${escapeHtml(dates[0] || "-")} 至 ${escapeHtml(dates.at(-1) || "-")}</p>
      <p><b>生成时间</b>${escapeHtml(generatedAt)} Asia/Shanghai</p>
      <p><b>覆盖范围</b>多模态、VLA/具身智能、视频理解、世界模型、训练框架、推理部署、自动驾驶与数据闭环。</p>
    </div>
  </section>
  <section class="section">
    <h2>目录</h2>
    <p class="section-lead">按题目方向分组，点击目录项可跳转到对应章节。PDF 内每题包含题目、方向、岗位、来源和参考回答。</p>
    <div class="toc">${toc}</div>
    <h2 style="margin-top:22px;">来源平台统计</h2>
    <div class="badges">${platformBadges}</div>
  </section>
  ${groupHtml}
</body>
</html>`;

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(tmpDir, { recursive: true });
fs.writeFileSync(htmlPath, html, "utf8");

const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].filter(Boolean);
const chrome = chromeCandidates.find((candidate) => fs.existsSync(candidate));
if (!chrome) {
  throw new Error("Chrome executable not found. Set CHROME_PATH to enable PDF export.");
}

const fileUrl = `file:///${htmlPath.replaceAll("\\", "/")}`;
const result = spawnSync(chrome, [
  "--headless=new",
  "--disable-gpu",
  "--no-pdf-header-footer",
  `--print-to-pdf=${pdfPath}`,
  fileUrl,
], { encoding: "utf8" });

if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout || "");
  process.exit(result.status || 1);
}

const stat = fs.statSync(pdfPath);
console.log(JSON.stringify({
  htmlPath,
  pdfPath,
  bytes: stat.size,
  posts: posts.length,
  questions: questions.length,
  groups: sortedGroups.length,
}, null, 2));
