import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const QUEUE_FILE = path.join(ROOT, "data", "publish-queue.json");
const OUT_ROOT = path.join(ROOT, "content", "xiaohongshu-edit-assets");

const NOTE_IDS = new Map([
  ["missed-20260615-morning-rl", "6a3165f6000000001603d7f9"],
  ["missed-20260616-afternoon-inference", "6a31616b0000000015024a0f"],
  ["missed-20260615-afternoon-video", "6a3160b0000000001603fbc4"],
]);

for (const post of JSON.parse(await fs.readFile(QUEUE_FILE, "utf8"))) {
  if (!NOTE_IDS.has(post.postId)) continue;
  const assetId = `fix-overlap-${post.postId.replace(/^missed-/, "")}`;
  const dir = path.join(OUT_ROOT, assetId);
  await fs.mkdir(dir, { recursive: true });
  const payload = {
    title: post.title,
    body: post.body,
    noteId: NOTE_IDS.get(post.postId),
    imageFiles: post.imageCardFiles,
    reason: "Replace overlapped image cards with rerendered cards.",
    sourceQueueId: post.id,
    updatedAt: new Date().toISOString(),
  };
  await fs.writeFile(path.join(dir, "post.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`${assetId} ${payload.noteId}`);
}
