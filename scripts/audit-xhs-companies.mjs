import fs from "node:fs";

const posts = JSON.parse(fs.readFileSync("data/posts.json", "utf8"));
const queue = JSON.parse(fs.readFileSync("data/publish-queue.json", "utf8"));
const features = JSON.parse(fs.readFileSync("data/daily-features.json", "utf8"));

const postById = new Map(posts.map((post) => [post.id, post]));
const featureByPost = new Map(features.map((feature) => [feature.postId, feature]));

const genericCompanies = new Set(["综合", "未明确", "未知", "不明", "??", "????", ""]);
const companyAliases = {
  字节: ["字节", "字节跳动"],
  字节跳动: ["字节", "字节跳动"],
  阿里: ["阿里", "阿里云", "通义", "Qwen", "千问"],
  腾讯: ["腾讯"],
  百度: ["百度"],
  快手: ["快手"],
  美团: ["美团"],
  小鹏: ["小鹏"],
  汇川: ["汇川"],
  智元: ["智元"],
  蔚来: ["蔚来"],
  NVIDIA: ["NVIDIA", "英伟达"],
  火山引擎: ["火山引擎"],
  高德: ["高德"],
  中国移动: ["中国移动"],
  普渡: ["普渡"],
};

const knownCompanyPattern = /字节|字节跳动|阿里|阿里云|通义|Qwen|千问|腾讯|百度|快手|美团|小鹏|汇川|智元|蔚来|NVIDIA|英伟达|火山引擎|高德|中国移动|普渡/;

function aliasesFor(company) {
  return companyAliases[company] || [company].filter(Boolean);
}

function hasAlias(text, company) {
  if (!company || genericCompanies.has(company)) return false;
  const normalized = text.toLowerCase();
  return aliasesFor(company).some((alias) => normalized.includes(String(alias).toLowerCase()));
}

function compactText(value) {
  if (Array.isArray(value)) return value.join(" ");
  return value || "";
}

const rows = queue
  .filter((item) => item.status === "published")
  .map((item) => {
    const post = postById.get(item.postId) || {};
    const feature = featureByPost.get(item.postId) || {};
    const company = item.company || feature.company || post.company || "";
    const sourceText = [
      item.title,
      item.coverTitle,
      item.coverSubtitle,
      item.primaryQuestion,
      item.body,
      feature.title,
      post.title,
      post.content,
      compactText(post.questions),
    ].join("\n");
    const suspicious = [];
    const supported = hasAlias(sourceText, company);
    const titleHasCompany = hasAlias(item.title || "", company);
    if (!genericCompanies.has(company) && !supported) suspicious.push("company_not_supported_by_source_text");
    if (!genericCompanies.has(company) && !titleHasCompany) suspicious.push("title_may_not_show_company");
    if (genericCompanies.has(company) && knownCompanyPattern.test(sourceText)) suspicious.push("generic_company_but_source_has_company");
    if (["Qwen", "NVIDIA"].includes(company)) suspicious.push("manual_company_review");
    return {
      postId: item.postId,
      publishTitle: item.title,
      company,
      primaryQuestion: item.primaryQuestion,
      sourcePlatform: item.sourcePlatform,
      sourceUrl: item.sourceUrl,
      postTitle: post.title,
      featureTitle: feature.title,
      supported,
      titleHasCompany,
      suspicious,
    };
  });

const result = {
  publishedCount: rows.length,
  suspiciousCount: rows.filter((row) => row.suspicious.length).length,
  hardErrors: rows.filter((row) => {
    if (/[?]{2,}|QwenQwen|NVIDIAVLA/.test(row.publishTitle || "")) return true;
    if (/[?]{2,}/.test(row.company || "")) return true;
    if (!genericCompanies.has(row.company) && !row.supported) return true;
    return false;
  }),
  suspicious: rows.filter((row) => row.suspicious.length),
  rows,
};

fs.writeFileSync("logs/xhs-company-audit.json", JSON.stringify(result, null, 2) + "\n", "utf8");
console.log(JSON.stringify({
  publishedCount: result.publishedCount,
  suspiciousCount: result.suspiciousCount,
  hardErrorCount: result.hardErrors.length,
  hardErrors: result.hardErrors.map((row) => ({
    postId: row.postId,
    publishTitle: row.publishTitle,
    company: row.company,
    suspicious: row.suspicious,
  })),
  suspicious: result.suspicious.map((row) => ({
    postId: row.postId,
    publishTitle: row.publishTitle,
    company: row.company,
    suspicious: row.suspicious,
    postTitle: row.postTitle,
    primaryQuestion: row.primaryQuestion,
    sourceUrl: row.sourceUrl,
  })),
}, null, 2));
