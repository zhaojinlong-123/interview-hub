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


def make_post(payload):
    title = clean_text(payload.get("title"), 120)
    company = clean_text(payload.get("company"), 60)
    role = clean_text(payload.get("role"), 60)
    content = clean_text(payload.get("content"), 5000)
    post_type = clean_text(payload.get("type"), 20)
    difficulty = clean_text(payload.get("difficulty"), 20)
    tags = clean_text(payload.get("tags"), 160)

    if post_type not in ("experience", "question"):
        post_type = "experience"

    if difficulty not in ("入门", "中等", "困难", "综合"):
        difficulty = "综合"

    missing = []
    if not title:
        missing.append("标题")
    if not company:
        missing.append("公司")
    if not role:
        missing.append("岗位")
    if not content:
        missing.append("内容")
    if missing:
        raise ValueError("请填写：" + "、".join(missing))

    now = int(time.time())
    return {
        "id": str(uuid.uuid4()),
        "title": title,
        "company": company,
        "role": role,
        "type": post_type,
        "difficulty": difficulty,
        "tags": [tag.strip() for tag in tags.replace("，", ",").split(",") if tag.strip()][:8],
        "content": content,
        "createdAt": now,
        "updatedAt": now,
    }


def filter_posts(posts, query):
    keyword = query.get("q", [""])[0].strip().lower()
    role = query.get("role", [""])[0].strip().lower()
    company = query.get("company", [""])[0].strip().lower()
    post_type = query.get("type", [""])[0].strip()

    results = []
    for post in posts:
        haystack = " ".join([
            post.get("title", ""),
            post.get("company", ""),
            post.get("role", ""),
            post.get("content", ""),
            " ".join(post.get("tags", [])),
        ]).lower()
        if keyword and keyword not in haystack:
            continue
        if role and role not in post.get("role", "").lower():
            continue
        if company and company not in post.get("company", "").lower():
            continue
        if post_type and post_type != "all" and post_type != post.get("type"):
            continue
        results.append(post)
    return results


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
            posts = sorted(read_posts(), key=lambda item: item.get("createdAt", 0), reverse=True)
            self.send_json(200, {"posts": filter_posts(posts, parse_qs(parsed.query))})
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
