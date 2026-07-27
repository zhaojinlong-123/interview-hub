import json
import os
import re
from collections import Counter, defaultdict
from datetime import datetime
from html import escape
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    CondPageBreak,
    Frame,
    KeepTogether,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.platypus.tableofcontents import TableOfContents


ROOT = Path(__file__).resolve().parents[1]
POSTS_FILE = ROOT / "data" / "posts.json"
OUTPUT_DIR = ROOT / "output" / "pdf"
OUTPUT_FILE = OUTPUT_DIR / "第一版面经题库_2026-06-05_至_2026-06-24.pdf"

PAGE_W, PAGE_H = A4
MARGIN_X = 18 * mm
MARGIN_TOP = 19 * mm
MARGIN_BOTTOM = 17 * mm

NAVY = colors.HexColor("#071824")
INK = colors.HexColor("#152735")
MUTED = colors.HexColor("#5F7280")
CYAN = colors.HexColor("#11B8B1")
CYAN_DARK = colors.HexColor("#087E7A")
CYAN_LIGHT = colors.HexColor("#E8F8F6")
BLUE_LIGHT = colors.HexColor("#EAF2F8")
LINE = colors.HexColor("#D8E4E8")
WARM = colors.HexColor("#F4B740")
WHITE = colors.white


def register_fonts():
    regular = Path(r"C:\Windows\Fonts\Deng.ttf")
    bold = Path(r"C:\Windows\Fonts\Dengb.ttf")
    if not regular.exists():
        regular = Path(r"C:\Windows\Fonts\simsunb.ttf")
    if not bold.exists():
        bold = Path(r"C:\Windows\Fonts\simhei.ttf")
    pdfmetrics.registerFont(TTFont("InterviewSans", str(regular)))
    pdfmetrics.registerFont(TTFont("InterviewSansBold", str(bold)))


def clean_text(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()


def normalized_company(value):
    value = clean_text(value)
    generic = {"", "综合", "未知", "未明确", "其他", "开源社区"}
    return "" if value in generic else value


def canonical_section(post):
    text = " ".join(
        clean_text(post.get(key))
        for key in ("direction", "category", "domain", "title")
    )
    if re.search(r"VLA|具身|机器人|遥操作|机械臂|Diffusion Policy|Sim-to-real", text, re.I):
        return "VLA 与具身智能"
    if re.search(r"自动驾驶|世界模型|BEV|occupancy|驾驶数据|座舱", text, re.I):
        return "世界模型与自动驾驶"
    if re.search(r"视频|时序|temporal|Video", text, re.I):
        return "视频与视觉理解"
    if re.search(r"训练框架|DeepSpeed|Megatron|ZeRO|并行训练|显存|训练优化", text, re.I):
        return "训练框架与大规模训练"
    if re.search(r"推理|部署|量化|KV Cache|PagedAttention|vLLM|模型压缩", text, re.I):
        return "推理部署与模型压缩"
    if re.search(r"RLHF|DPO|GRPO|PPO|强化学习|对齐训练|奖励模型|MoE", text, re.I):
        return "强化学习与模型对齐"
    if re.search(r"音频|语音|ASR", text, re.I):
        return "音频多模态"
    return "多模态大模型"


SECTION_ORDER = [
    "多模态大模型",
    "VLA 与具身智能",
    "视频与视觉理解",
    "世界模型与自动驾驶",
    "训练框架与大规模训练",
    "推理部署与模型压缩",
    "强化学习与模型对齐",
    "音频多模态",
]


def answer_for(post, question):
    for item in post.get("questionAnswers") or []:
        if item.get("question") == question:
            return clean_text(item.get("answer"))
    return ""


class InterviewDocTemplate(BaseDocTemplate):
    def __init__(self, filename, **kwargs):
        super().__init__(filename, **kwargs)
        cover_frame = Frame(
            0,
            0,
            PAGE_W,
            PAGE_H,
            leftPadding=0,
            rightPadding=0,
            topPadding=0,
            bottomPadding=0,
            id="cover_frame",
        )
        content_frame = Frame(
            MARGIN_X,
            MARGIN_BOTTOM,
            PAGE_W - 2 * MARGIN_X,
            PAGE_H - MARGIN_TOP - MARGIN_BOTTOM,
            leftPadding=0,
            rightPadding=0,
            topPadding=0,
            bottomPadding=0,
            id="content_frame",
        )
        self.addPageTemplates(
            [
                PageTemplate(id="cover", frames=[cover_frame], onPage=self.draw_cover_background),
                PageTemplate(id="content", frames=[content_frame], onPage=self.draw_content_page),
            ]
        )

    def draw_cover_background(self, canvas, doc):
        canvas.saveState()
        canvas.setFillColor(NAVY)
        canvas.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
        canvas.setStrokeColor(colors.HexColor("#154653"))
        canvas.setLineWidth(0.6)
        for y in range(65, 810, 52):
            canvas.line(0, y, PAGE_W, y + 16)
        canvas.setFillColor(CYAN)
        canvas.rect(0, PAGE_H - 12 * mm, PAGE_W, 3 * mm, stroke=0, fill=1)
        canvas.restoreState()

    def draw_content_page(self, canvas, doc):
        page_num = canvas.getPageNumber()
        canvas.saveState()
        canvas.setStrokeColor(LINE)
        canvas.setLineWidth(0.5)
        canvas.line(MARGIN_X, PAGE_H - 13 * mm, PAGE_W - MARGIN_X, PAGE_H - 13 * mm)
        canvas.setFont("InterviewSans", 8)
        canvas.setFillColor(MUTED)
        canvas.drawString(MARGIN_X, PAGE_H - 10 * mm, "第一版面经题库")
        canvas.drawRightString(PAGE_W - MARGIN_X, PAGE_H - 10 * mm, "2026-06-05 至 2026-06-24")
        canvas.line(MARGIN_X, 12 * mm, PAGE_W - MARGIN_X, 12 * mm)
        canvas.drawCentredString(PAGE_W / 2, 7.5 * mm, str(page_num))
        canvas.restoreState()

    def afterFlowable(self, flowable):
        if not isinstance(flowable, Paragraph):
            return
        level = getattr(flowable, "_outline_level", None)
        key = getattr(flowable, "_bookmark_name", None)
        text = getattr(flowable, "_outline_text", None)
        if level is None or not key or not text:
            return
        self.canv.bookmarkPage(key)
        self.canv.addOutlineEntry(text, key, level=level, closed=level > 0)
        if level <= 1:
            self.notify("TOCEntry", (level, text, self.page, key))


def heading(text, style, key, level, outline_text=None):
    p = Paragraph(f'<a name="{key}"/>{escape(text)}', style)
    p._bookmark_name = key
    p._outline_level = level
    p._outline_text = outline_text or text
    return p


def make_styles():
    base = getSampleStyleSheet()
    return {
        "cover_eyebrow": ParagraphStyle(
            "cover_eyebrow",
            parent=base["Normal"],
            fontName="InterviewSansBold",
            fontSize=13,
            leading=18,
            textColor=CYAN,
            alignment=TA_LEFT,
        ),
        "cover_title": ParagraphStyle(
            "cover_title",
            parent=base["Title"],
            fontName="InterviewSansBold",
            fontSize=34,
            leading=44,
            textColor=WHITE,
            alignment=TA_LEFT,
            spaceAfter=8 * mm,
        ),
        "cover_subtitle": ParagraphStyle(
            "cover_subtitle",
            parent=base["Normal"],
            fontName="InterviewSans",
            fontSize=14,
            leading=23,
            textColor=colors.HexColor("#B8D1DB"),
            alignment=TA_LEFT,
        ),
        "h1": ParagraphStyle(
            "SectionHeading",
            parent=base["Heading1"],
            fontName="InterviewSansBold",
            fontSize=22,
            leading=29,
            textColor=NAVY,
            spaceBefore=3 * mm,
            spaceAfter=5 * mm,
        ),
        "h2": ParagraphStyle(
            "SourceHeading",
            parent=base["Heading2"],
            fontName="InterviewSansBold",
            fontSize=14,
            leading=20,
            textColor=CYAN_DARK,
            spaceBefore=4 * mm,
            spaceAfter=2 * mm,
        ),
        "question": ParagraphStyle(
            "QuestionHeading",
            parent=base["Heading3"],
            fontName="InterviewSansBold",
            fontSize=12,
            leading=18,
            textColor=INK,
            spaceBefore=4 * mm,
            spaceAfter=2 * mm,
            keepWithNext=True,
        ),
        "answer": ParagraphStyle(
            "AnswerBody",
            parent=base["BodyText"],
            fontName="InterviewSans",
            fontSize=10,
            leading=17,
            textColor=INK,
            alignment=TA_JUSTIFY,
            wordWrap="CJK",
            spaceAfter=2.5 * mm,
        ),
        "body": ParagraphStyle(
            "Body",
            parent=base["BodyText"],
            fontName="InterviewSans",
            fontSize=10,
            leading=17,
            textColor=INK,
            wordWrap="CJK",
        ),
        "small": ParagraphStyle(
            "Small",
            parent=base["BodyText"],
            fontName="InterviewSans",
            fontSize=8.5,
            leading=13,
            textColor=MUTED,
            wordWrap="CJK",
        ),
        "meta": ParagraphStyle(
            "Meta",
            parent=base["BodyText"],
            fontName="InterviewSans",
            fontSize=8.5,
            leading=13,
            textColor=MUTED,
            wordWrap="CJK",
        ),
        "toc_h": ParagraphStyle(
            "TOCHeading",
            parent=base["Heading1"],
            fontName="InterviewSansBold",
            fontSize=22,
            leading=28,
            textColor=NAVY,
            spaceAfter=5 * mm,
        ),
        "index": ParagraphStyle(
            "Index",
            parent=base["BodyText"],
            fontName="InterviewSans",
            fontSize=8,
            leading=11.5,
            textColor=INK,
            wordWrap="CJK",
        ),
    }


def cover_story(styles, stats):
    companies = "、".join(stats["companies"])
    cover_meta = ParagraphStyle(
        "CoverMeta",
        parent=styles["cover_subtitle"],
        fontName="InterviewSans",
        fontSize=9.5,
        leading=14,
        textColor=WHITE,
        wordWrap="CJK",
    )
    return [
        Spacer(1, 32 * mm),
        Table(
            [
                [
                    Paragraph("INTERVIEW BANK · VERSION 1", styles["cover_eyebrow"]),
                ]
            ],
            colWidths=[PAGE_W - 36 * mm],
            style=TableStyle(
                [
                    ("LEFTPADDING", (0, 0), (-1, -1), 18 * mm),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                    ("TOPPADDING", (0, 0), (-1, -1), 0),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ]
            ),
        ),
        Spacer(1, 8 * mm),
        Table(
            [[Paragraph("第一版面经题库", styles["cover_title"])]],
            colWidths=[PAGE_W - 36 * mm],
            style=TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 18 * mm)]),
        ),
        Table(
            [[Paragraph("多模态 · VLA/具身智能 · 视频理解 · 世界模型 · 训练框架 · 推理部署", styles["cover_subtitle"])]],
            colWidths=[PAGE_W - 36 * mm],
            style=TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 18 * mm)]),
        ),
        Spacer(1, 18 * mm),
        Table(
            [
                ["收录时间", Paragraph(f'{stats["start"]} 至 {stats["end"]}', cover_meta)],
                ["题目规模", Paragraph(f'{stats["questions"]} 道题 · {stats["sources"]} 个来源', cover_meta)],
                ["覆盖方向", Paragraph(f'{stats["section_count"]} 个核心方向', cover_meta)],
                ["公司/机构", Paragraph(companies, cover_meta)],
                ["生成日期", Paragraph(datetime.now().strftime("%Y-%m-%d"), cover_meta)],
            ],
            colWidths=[32 * mm, PAGE_W - 72 * mm],
            style=TableStyle(
                [
                    ("FONTNAME", (0, 0), (-1, -1), "InterviewSans"),
                    ("FONTNAME", (0, 0), (0, -1), "InterviewSansBold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 10),
                    ("TEXTCOLOR", (0, 0), (0, -1), CYAN),
                    ("TEXTCOLOR", (1, 0), (1, -1), WHITE),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LINEBELOW", (0, 0), (-1, -1), 0.3, colors.HexColor("#28505B")),
                    ("LEFTPADDING", (0, 0), (0, -1), 18 * mm),
                    ("LEFTPADDING", (1, 0), (1, -1), 2 * mm),
                    ("RIGHTPADDING", (1, 0), (1, -1), 18 * mm),
                    ("TOPPADDING", (0, 0), (-1, -1), 3 * mm),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm),
                ]
            ),
        ),
        Spacer(1, 18 * mm),
        Table(
            [[Paragraph("使用说明：目录、题目索引和 PDF 书签均支持点击跳转。每道题保留来源、公司、方向和完整模型回答。", styles["cover_subtitle"])]],
            colWidths=[PAGE_W - 36 * mm],
            style=TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 18 * mm), ("RIGHTPADDING", (0, 0), (-1, -1), 18 * mm)]),
        ),
    ]


def build_pdf():
    register_fonts()
    styles = make_styles()
    posts = json.loads(POSTS_FILE.read_text(encoding="utf-8"))
    posts = [p for p in posts if p.get("questions")]
    posts.sort(key=lambda p: (SECTION_ORDER.index(canonical_section(p)), p.get("sourceDate") or "", p.get("company") or "", p.get("title") or ""))

    dates = sorted(p.get("sourceDate") for p in posts if p.get("sourceDate"))
    companies = sorted({normalized_company(p.get("company")) for p in posts if normalized_company(p.get("company"))})
    sections = defaultdict(list)
    for post in posts:
        sections[canonical_section(post)].append(post)

    stats = {
        "start": dates[0],
        "end": dates[-1],
        "questions": sum(len(p.get("questions") or []) for p in posts),
        "sources": len(posts),
        "section_count": len([s for s in SECTION_ORDER if sections[s]]),
        "companies": companies,
    }

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    doc = InterviewDocTemplate(
        str(OUTPUT_FILE),
        pagesize=A4,
        title="第一版面经题库",
        author="Interview Hub",
        subject="多模态、VLA/具身智能、视频理解、世界模型、训练框架与推理部署面经",
    )

    story = []
    story.extend(cover_story(styles, stats))
    story.append(NextPageTemplate("content"))
    story.append(PageBreak())

    story.append(heading("版本说明与覆盖范围", styles["h1"], "overview", 0))
    overview_data = [
        ["版本", Paragraph("第一版", styles["body"])],
        ["来源起止时间", Paragraph(f'{stats["start"]} 至 {stats["end"]}', styles["body"])],
        ["题目总数", Paragraph(str(stats["questions"]), styles["body"])],
        ["来源总数", Paragraph(str(stats["sources"]), styles["body"])],
        ["覆盖公司/机构", Paragraph("、".join(companies), styles["body"])],
        ["覆盖范围", Paragraph("多模态大模型、VLA/具身智能、视频与视觉理解、世界模型与自动驾驶、训练框架、推理部署与模型压缩、强化学习与对齐、音频多模态", styles["body"])],
    ]
    story.append(
        Table(
            overview_data,
            colWidths=[34 * mm, PAGE_W - 2 * MARGIN_X - 34 * mm],
            style=TableStyle(
                [
                    ("FONTNAME", (0, 0), (-1, -1), "InterviewSans"),
                    ("FONTNAME", (0, 0), (0, -1), "InterviewSansBold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("TEXTCOLOR", (0, 0), (0, -1), CYAN_DARK),
                    ("TEXTCOLOR", (1, 0), (1, -1), INK),
                    ("BACKGROUND", (0, 0), (0, -1), CYAN_LIGHT),
                    ("GRID", (0, 0), (-1, -1), 0.4, LINE),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm),
                    ("TOPPADDING", (0, 0), (-1, -1), 2.5 * mm),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5 * mm),
                ]
            ),
        )
    )
    story.append(Spacer(1, 5 * mm))

    direction_counts = Counter()
    for section, section_posts in sections.items():
        direction_counts[section] = sum(len(p.get("questions") or []) for p in section_posts)
    direction_table = [["方向", "题目数", "来源数"]]
    for section in SECTION_ORDER:
        if sections[section]:
            direction_table.append([section, str(direction_counts[section]), str(len(sections[section]))])
    story.append(Paragraph("方向分布", styles["h2"]))
    story.append(
        Table(
            direction_table,
            colWidths=[92 * mm, 28 * mm, 28 * mm],
            repeatRows=1,
            style=TableStyle(
                [
                    ("FONTNAME", (0, 0), (-1, -1), "InterviewSans"),
                    ("FONTNAME", (0, 0), (-1, 0), "InterviewSansBold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                    ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
                    ("TEXTCOLOR", (0, 1), (-1, -1), INK),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, BLUE_LIGHT]),
                    ("GRID", (0, 0), (-1, -1), 0.35, LINE),
                    ("ALIGN", (1, 1), (-1, -1), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("TOPPADDING", (0, 0), (-1, -1), 2.3 * mm),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 2.3 * mm),
                ]
            ),
        )
    )
    story.append(PageBreak())

    story.append(heading("目录", styles["toc_h"], "toc", 0))
    toc = TableOfContents()
    toc.levelStyles = [
        ParagraphStyle(
            "TOCLevel0",
            fontName="InterviewSansBold",
            fontSize=11,
            leading=17,
            leftIndent=0,
            firstLineIndent=0,
            textColor=INK,
            spaceBefore=3,
        ),
        ParagraphStyle(
            "TOCLevel1",
            fontName="InterviewSans",
            fontSize=9,
            leading=14,
            leftIndent=10 * mm,
            firstLineIndent=0,
            textColor=MUTED,
        ),
    ]
    story.append(toc)
    story.append(PageBreak())

    question_records = []
    q_num = 0
    for section in SECTION_ORDER:
        for post in sections[section]:
            for question in post.get("questions") or []:
                q_num += 1
                question_records.append(
                    {
                        "number": q_num,
                        "section": section,
                        "company": normalized_company(post.get("company")) or "未标明",
                        "question": clean_text(question),
                        "key": f"q{q_num:03d}",
                    }
                )

    story.append(heading("题目索引", styles["h1"], "question-index", 0))
    story.append(Paragraph("按编号快速定位。点击题目可跳转到完整回答。", styles["body"]))
    story.append(Spacer(1, 3 * mm))
    index_rows = [["编号", "方向 / 公司", "题目"]]
    for record in question_records:
        short = record["question"]
        if len(short) > 42:
            short = short[:41] + "..."
        index_rows.append(
            [
                f'{record["number"]:03d}',
                f'{record["section"]}<br/><font color="#5F7280">{escape(record["company"])}</font>',
                f'<link href="#{record["key"]}" color="#087E7A">{escape(short)}</link>',
            ]
        )
    story.append(
        Table(
            [[Paragraph(str(cell), styles["index"]) for cell in row] for row in index_rows],
            colWidths=[14 * mm, 45 * mm, PAGE_W - 2 * MARGIN_X - 59 * mm],
            repeatRows=1,
            style=TableStyle(
                [
                    ("FONTNAME", (0, 0), (-1, -1), "InterviewSans"),
                    ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                    ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, colors.HexColor("#F7FAFB")]),
                    ("GRID", (0, 0), (-1, -1), 0.25, LINE),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("ALIGN", (0, 1), (0, -1), "CENTER"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 2 * mm),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 2 * mm),
                    ("TOPPADDING", (0, 0), (-1, -1), 1.5 * mm),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5 * mm),
                ]
            ),
        )
    )
    story.append(PageBreak())

    q_num = 0
    for section_index, section in enumerate(SECTION_ORDER, start=1):
        section_posts = sections[section]
        if not section_posts:
            continue
        story.append(CondPageBreak(55 * mm))
        story.append(heading(f"{section_index}. {section}", styles["h1"], f"section-{section_index}", 0))
        section_count = sum(len(p.get("questions") or []) for p in section_posts)
        story.append(
            Paragraph(
                f"本章收录 {section_count} 道题，来自 {len(section_posts)} 个来源。",
                styles["body"],
            )
        )
        story.append(Spacer(1, 3 * mm))

        for source_index, post in enumerate(section_posts, start=1):
            company = normalized_company(post.get("company")) or "未标明"
            title = clean_text(post.get("title"))
            source_key = f"source-{section_index}-{source_index}"
            source_heading = f"{section_index}.{source_index} {company} · {title}"
            story.append(heading(source_heading, styles["h2"], source_key, 1, outline_text=source_heading))

            source_url = clean_text(post.get("sourceUrl"))
            meta_parts = [
                f"公司/机构：{company}",
                f"方向：{clean_text(post.get('direction') or post.get('category'))}",
                f"来源平台：{clean_text(post.get('sourcePlatform'))}",
                f"来源日期：{clean_text(post.get('sourceDate'))}",
            ]
            story.append(
                Table(
                    [
                        [
                            Paragraph(" &nbsp; | &nbsp; ".join(escape(x) for x in meta_parts), styles["meta"]),
                        ]
                    ],
                    colWidths=[PAGE_W - 2 * MARGIN_X],
                    style=TableStyle(
                        [
                            ("BACKGROUND", (0, 0), (-1, -1), CYAN_LIGHT),
                            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#A9DDD8")),
                            ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm),
                            ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm),
                            ("TOPPADDING", (0, 0), (-1, -1), 2 * mm),
                            ("BOTTOMPADDING", (0, 0), (-1, -1), 2 * mm),
                        ]
                    ),
                )
            )
            if source_url:
                story.append(
                    Paragraph(
                        f'来源链接：<link href="{escape(source_url)}" color="#087E7A">{escape(source_url)}</link>',
                        styles["small"],
                    )
                )

            for local_index, question in enumerate(post.get("questions") or [], start=1):
                q_num += 1
                key = f"q{q_num:03d}"
                question_text = clean_text(question)
                answer = answer_for(post, question)
                q_heading = f"Q{q_num:03d} · {question_text}"
                q_para = heading(q_heading, styles["question"], key, 2, outline_text=q_heading)
                answer_label = Paragraph(
                    '<font color="#087E7A"><b>回答</b></font>',
                    styles["small"],
                )
                answer_para = Paragraph(escape(answer), styles["answer"])
                story.append(q_para)
                story.append(
                    Table(
                        [[answer_label], [answer_para]],
                        colWidths=[PAGE_W - 2 * MARGIN_X],
                        style=TableStyle(
                            [
                                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F2FBFA")),
                                ("BACKGROUND", (0, 1), (-1, 1), WHITE),
                                ("BOX", (0, 0), (-1, -1), 0.45, LINE),
                                ("LINEBEFORE", (0, 0), (0, -1), 2.2, CYAN),
                                ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm),
                                ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm),
                                ("TOPPADDING", (0, 0), (-1, -1), 1.7 * mm),
                                ("BOTTOMPADDING", (0, 0), (-1, -1), 1.7 * mm),
                                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                            ]
                        ),
                    )
                )
                story.append(Spacer(1, 2 * mm))

    doc.multiBuild(story)
    return OUTPUT_FILE


if __name__ == "__main__":
    output = build_pdf()
    print(json.dumps({"output": str(output)}, ensure_ascii=False, indent=2))
