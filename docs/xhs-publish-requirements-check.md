# Xiaohongshu Publish Requirements Check

Updated: 2026-06-15

## 1. Answer-question alignment

Status: implemented and checked.

- `scripts/audit-xhs-publish.mjs --fix --fail-on-risk` reports `answerMismatchCount: 0`.
- `scripts/publish-xiaohongshu.mjs` blocks known dangerous mismatches before publishing.
- VLA action questions are blocked if the answer contains generic VLM connector signals.
- Robot data questions are blocked if the answer contains generic multimodal data signals.

## 2. Source-question alignment

Status: partially automated; historical Xiaohongshu `search_result` links still need replacement or manual confirmation.

- New publishing requires `sourcePlatform` and `sourceUrl`.
- New publishing requires the post body to include the source platform and source URL.
- `scripts/verify-xhs-source-links.mjs` checks historical Xiaohongshu source links through the logged-in Chrome CDP session.
- Current report: `data/xhs-source-verification.json`.
- Current result: 9 historical `xiaohongshu.com/search_result` links could not be automatically proven as direct post links, so they remain flagged for source replacement or manual verification.

## 3. Duplicate published questions

Status: future publishing is blocked; historical duplicate posts still need online editing.

- `data/published-question-registry.json` records already published question keys.
- `scripts/generate-daily-feature.mjs` filters out already published questions before selecting daily topics.
- `scripts/publish-xiaohongshu.mjs` now checks both `data/publish-queue.json` and `data/published-question-registry.json`; if a selected question was already published, the publish is skipped.
- Current audit still finds historical duplicate groups. These are old online posts and should be edited rather than deleted, following `data/xhs-remediation-plan.json`.

## 4. Answer coverage for all interview questions

Status: implemented and checked.

- Current `data/posts.json`: 492 posts.
- Current total questions in posts: 111.
- Current missing answers: 0.
- Future weekly import flow runs `boost-interview-questions`, `dedupe-post-questions`, and `audit-xhs-publish --fix`, so new questions are answered before entering the usable question bank.

## Current Verification Command

```powershell
cd E:\workshop\interview-hub
node scripts\audit-xhs-publish.mjs --fix --fail-on-risk
node scripts\verify-xhs-source-links.mjs
```

Expected hard-pass fields:

- `missingAnswerCount: 0`
- `answerMismatchCount: 0`

Known non-blocking historical cleanup fields:

- `duplicatePublishedQuestionCount`
- `sourceCheckCount`

