import fs from "node:fs";

const now = new Date().toISOString();

const fixes = new Map([
  ["auto-20260620-5df12524a523", {
    title: "Qwen-VL视觉语言题目精讲",
    company: "",
    note: "Qwen is a model family/product name in this source, not a confirmed interview company.",
  }],
  ["auto-20260618-f7b3282f50d8", {
    title: "Qwen2.5大模型题目精讲",
    company: "",
    note: "Qwen is a model family/product name in this source, not a confirmed interview company.",
  }],
  ["auto-20260613-5567a52c6128", {
    title: "自动驾驶数据闭环题目精讲",
    company: "",
    note: "Historical mojibake company cleared; online title already uses topic-only wording.",
  }],
  ["auto-20260613-ce5f69daa751", {
    title: "视频时序理解题目精讲",
    company: "",
    note: "Historical mojibake title/company fixed; source is topic content, no confirmed company.",
  }],
  ["auto-20260613-9d9a46d8887a", {
    title: "世界模型规划题目精讲",
    company: "",
    note: "Historical mojibake title/company fixed; source is topic content, no confirmed company.",
  }],
  ["auto-20260606-566028bd9c5c", {
    title: "普渡VLA具身智能题目精讲",
    company: "普渡",
    note: "Source title identifies Pudu Robotics / 普渡机器人.",
  }],
  ["auto-20260606-4b438e6d70ba", {
    title: "字节多图VQA题目精讲",
    company: "字节",
    note: "Source title identifies ByteDance multimodal interview content.",
  }],
  ["auto-20260606-66b769a6c484", {
    title: "火山引擎VLA具身智能题目精讲",
    company: "火山引擎",
    note: "Source title identifies Volcano Engine, not NVIDIA.",
  }],
]);

function updateTitleLike(record, fix) {
  if (!record || !fix) return;
  record.title = fix.title;
  record.company = fix.company;
  record.companyAuditNote = fix.note;
  record.companyAuditUpdatedAt = now;
}

function updateQueue(record, fix) {
  if (!record || !fix) return;
  record.title = fix.title;
  record.company = fix.company;
  record.companyAuditNote = fix.note;
  record.companyAuditUpdatedAt = now;
  if (record.body) {
    record.body = record.body.replace(/^.*题目精讲/m, fix.title);
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
}

const posts = JSON.parse(fs.readFileSync("data/posts.json", "utf8"));
for (const post of posts) updateTitleLike(post, fixes.get(post.id));
writeJson("data/posts.json", posts);

const queue = JSON.parse(fs.readFileSync("data/publish-queue.json", "utf8"));
for (const item of queue) updateQueue(item, fixes.get(item.postId));
writeJson("data/publish-queue.json", queue);

const features = JSON.parse(fs.readFileSync("data/daily-features.json", "utf8"));
for (const feature of features) updateTitleLike(feature, fixes.get(feature.postId));
writeJson("data/daily-features.json", features);

console.log(JSON.stringify({ updatedAt: now, fixedPostIds: [...fixes.keys()] }, null, 2));
