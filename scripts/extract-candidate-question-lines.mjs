import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const INPUT_FILE = path.join(ROOT, "logs", "candidate-source-text-2026-06-24.json");
const OUTPUT_FILE = path.join(ROOT, "logs", "candidate-question-lines-2026-06-24.json");

function cleanLine(value) {
  return String(value || "")
    .replace(/^[•·●▪◦\-*]\s*/, "")
    .replace(/^\d+\s*[.、)）]\s*/, "")
    .replace(/^Q\d*\s*[:：]\s*/i, "")
    .replace(/^问题\s*\d*\s*[:：]?\s*/, "")
    .trim();
}

function looksLikeQuestion(line) {
  if (line.length < 8 || line.length > 180) return false;
  if (/[?？]$/.test(line)) return true;
  return /^(为什么|如何|怎么|怎样|什么是|介绍一下|解释一下|说一下|谈谈|对比|区别|能否|是否|请实现|手撕|推导)/.test(line);
}

function extract(text) {
  const lines = String(text || "")
    .split(/\r?\n+/)
    .map(cleanLine)
    .filter(Boolean);
  const candidates = [];
  for (const line of lines) {
    const pieces = line.split(/(?<=[？?])\s+/);
    for (const piece of pieces) {
      const cleaned = cleanLine(piece);
      if (!looksLikeQuestion(cleaned)) continue;
      if (/登录|扫码|验证码|隐私|服务协议|评论|点赞|收藏|发布于/.test(cleaned)) continue;
      candidates.push(cleaned);
    }
  }
  return [...new Set(candidates)].slice(0, 20);
}

const records = JSON.parse(await fs.readFile(INPUT_FILE, "utf8"));
const result = records.map((record) => ({
  id: record.id,
  sourceUrl: record.sourceUrl,
  finalUrl: record.finalUrl,
  pageTitle: record.pageTitle,
  textLength: String(record.text || "").length,
  questions: extract(record.text),
})).filter((record) => record.questions.length);

await fs.writeFile(OUTPUT_FILE, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  sourcesWithQuestions: result.length,
  extractedQuestions: result.reduce((sum, record) => sum + record.questions.length, 0),
  output: path.relative(ROOT, OUTPUT_FILE).replaceAll("\\", "/"),
  samples: result.slice(0, 12),
}, null, 2));
