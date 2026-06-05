# -*- coding: utf-8 -*-
import json
import os
import posixpath
import time
import uuid
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, unquote, urlparse


ROOT = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(ROOT, "public")
DATA_DIR = os.path.join(ROOT, "data")
POSTS_FILE = os.path.join(DATA_DIR, "posts.json")

HOST = "0.0.0.0"
PORT = int(os.environ.get("PORT", "8088"))

CATEGORIES = [
    "多模态大模型",
    "VLA / 具身智能",
    "视频 / 视觉理解",
    "世界模型",
    "自动驾驶 / 数据闭环",
    "Agent / RAG / 大模型应用",
    "推理优化 / 模型压缩",
    "强化学习 / 对齐训练",
]

DIFFICULTIES = ["入门", "中等", "困难", "综合"]
POST_TYPES = ["experience", "question", "video", "collection"]


def ensure_data_file():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(POSTS_FILE):
        with open(POSTS_FILE, "w", encoding="utf-8") as file:
            json.dump([], file, ensure_ascii=False, indent=2)


def read_posts():
    ensure_data_file()
    with open(POSTS_FILE, "r", encoding="utf-8") as file:
        return json.load(file)


def write_posts(posts):
    ensure_data_file()
    tmp_file = POSTS_FILE + ".tmp"
    with open(tmp_file, "w", encoding="utf-8") as file:
        json.dump(posts, file, ensure_ascii=False, indent=2)
    os.replace(tmp_file, POSTS_FILE)


def clean_text(value, limit):
    if not isinstance(value, str):
        return ""
    return value.strip()[:limit]


def clean_tags(value):
    if isinstance(value, list):
        raw_tags = value
    else:
        raw_tags = clean_text(value, 240).replace("，", ",").split(",")
    tags = []
    for tag in raw_tags:
        text = clean_text(tag, 32)
        if text and text not in tags:
            tags.append(text)
    return tags[:8]


def make_post(payload):
    title = clean_text(payload.get("title"), 120)
    company = clean_text(payload.get("company"), 60)
    role = clean_text(payload.get("role"), 60)
    content = clean_text(payload.get("content"), 6000)
    post_type = clean_text(payload.get("type"), 20)
    difficulty = clean_text(payload.get("difficulty"), 20)
    category = clean_text(payload.get("category"), 40)
    direction = clean_text(payload.get("direction"), 80)
    domain = clean_text(payload.get("domain"), 80)
    source_platform = clean_text(payload.get("sourcePlatform"), 40)
    source_url = clean_text(payload.get("sourceUrl"), 400)

    if post_type not in POST_TYPES:
        post_type = "experience"
    if difficulty not in DIFFICULTIES:
        difficulty = "综合"
    if category not in CATEGORIES:
        category = "多模态大模型"

    missing = []
    for label, value in [("标题", title), ("公司", company), ("岗位", role), ("内容", content)]:
        if not value:
            missing.append(label)
    if missing:
        raise ValueError("请填写：" + "、".join(missing))

    now = int(time.time())
    return {
        "id": str(uuid.uuid4()),
        "title": title,
        "company": company,
        "role": role,
        "direction": direction or category,
        "domain": domain or category,
        "category": category,
        "type": post_type,
        "difficulty": difficulty,
        "sourcePlatform": source_platform or "用户发布",
        "sourceDate": time.strftime("%Y-%m-%d"),
        "sourceUrl": source_url,
        "tags": clean_tags(payload.get("tags")),
        "questions": [],
        "content": content,
        "prepTips": clean_text(payload.get("prepTips"), 1000),
        "createdAt": now,
        "updatedAt": now,
    }


def query_value(query, key):
    return query.get(key, [""])[0].strip()


def post_text(post):
    values = [
        post.get("title", ""),
        post.get("company", ""),
        post.get("role", ""),
        post.get("direction", ""),
        post.get("domain", ""),
        post.get("category", ""),
        post.get("difficulty", ""),
        post.get("sourcePlatform", ""),
        post.get("content", ""),
        post.get("prepTips", ""),
        " ".join(post.get("tags", [])),
        " ".join(post.get("questions", [])),
    ]
    return " ".join(values).lower()


def filter_posts(posts, query):
    keyword = query_value(query, "q").lower()
    role = query_value(query, "role").lower()
    company = query_value(query, "company").lower()
    post_type = query_value(query, "type")
    category = query_value(query, "category")
    platform = query_value(query, "platform")
    difficulty = query_value(query, "difficulty")
    tag = query_value(query, "tag")
    start_date = query_value(query, "startDate")
    end_date = query_value(query, "endDate")

    results = []
    for post in posts:
        haystack = post_text(post)
        if keyword and keyword not in haystack:
            continue
        if role and role not in post.get("role", "").lower():
            continue
        if company and company not in post.get("company", "").lower():
            continue
        if post_type and post_type != "all" and post_type != post.get("type"):
            continue
        if category and category != "all" and category != post.get("category"):
            continue
        if platform and platform != "all" and platform != post.get("sourcePlatform"):
            continue
        if difficulty and difficulty != "all" and difficulty != post.get("difficulty"):
            continue
        if tag and tag != "all" and tag not in post.get("tags", []):
            continue
        if start_date and post.get("sourceDate", "") < start_date:
            continue
        if end_date and post.get("sourceDate", "") > end_date:
            continue
        results.append(post)
    return results


def meta_from_posts(posts):
    def unique(key):
        values = []
        for post in posts:
            value = post.get(key)
            if value and value not in values:
                values.append(value)
        return sorted(values)

    tags = []
    for post in posts:
        for tag in post.get("tags", []):
            if tag not in tags:
                tags.append(tag)

    return {
        "categories": CATEGORIES,
        "companies": unique("company"),
        "platforms": unique("sourcePlatform"),
        "difficulties": DIFFICULTIES,
        "tags": sorted(tags),
    }


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print("[%s] %s" % (self.log_date_time_string(), fmt % args))

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/posts":
            posts = sorted(read_posts(), key=lambda item: item.get("sourceDate", ""), reverse=True)
            self.send_json(200, {"posts": filter_posts(posts, parse_qs(parsed.query)), "meta": meta_from_posts(posts)})
            return
        if parsed.path == "/api/meta":
            self.send_json(200, meta_from_posts(read_posts()))
            return
        self.serve_static(parsed.path)

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != "/api/posts":
            self.send_json(404, {"error": "接口不存在"})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(length).decode("utf-8")
            payload = json.loads(raw or "{}")
            post = make_post(payload)
            posts = read_posts()
            posts.append(post)
            write_posts(posts)
            self.send_json(201, {"post": post})
        except ValueError as error:
            self.send_json(400, {"error": str(error)})
        except Exception:
            self.send_json(500, {"error": "保存失败，请稍后再试"})

    def serve_static(self, request_path):
        path = unquote(request_path)
        if path == "/":
            path = "/index.html"

        normalized = posixpath.normpath(path).lstrip("/")
        file_path = os.path.abspath(os.path.join(PUBLIC_DIR, normalized))
        if not file_path.startswith(os.path.abspath(PUBLIC_DIR)):
            self.send_error(403)
            return
        if not os.path.exists(file_path) or os.path.isdir(file_path):
            self.send_error(404)
            return

        content_type = "text/plain; charset=utf-8"
        if file_path.endswith(".html"):
            content_type = "text/html; charset=utf-8"
        elif file_path.endswith(".css"):
            content_type = "text/css; charset=utf-8"
        elif file_path.endswith(".js"):
            content_type = "application/javascript; charset=utf-8"

        with open(file_path, "rb") as file:
            body = file.read()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    ensure_data_file()
    server = HTTPServer((HOST, PORT), Handler)
    print("Interview Hub running at http://127.0.0.1:%s" % PORT)
    print("LAN users can visit http://<your-ip>:%s after firewall allows the port." % PORT)
    server.serve_forever()
