"""Plotline achievement record. Run: python3 scripts/build_achievement_pdf.py"""

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    CondPageBreak,
    HRFlowable,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    Preformatted,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

OUT = Path(__file__).resolve().parents[1] / "docs" / "Plotline_Achievement_Record.pdf"

INK = colors.HexColor("#14110e")
BRASS = colors.HexColor("#8a6a2a")
MUTED = colors.HexColor("#5c564e")
RULE = colors.HexColor("#d9d0c2")
ROW = colors.HexColor("#f7f3ec")
HEAD = colors.HexColor("#221e19")


def styles():
    base = getSampleStyleSheet()
    s = {}
    s["cover_kicker"] = ParagraphStyle(
        "cover_kicker",
        fontName="Times-Bold",
        fontSize=11,
        textColor=BRASS,
        tracking=1.2,
        spaceAfter=8,
    )
    s["cover_title"] = ParagraphStyle(
        "cover_title",
        fontName="Times-Bold",
        fontSize=28,
        leading=32,
        textColor=INK,
        spaceAfter=8,
    )
    s["cover_sub"] = ParagraphStyle(
        "cover_sub",
        fontName="Times-Italic",
        fontSize=12,
        leading=16,
        textColor=MUTED,
        spaceAfter=14,
    )
    s["h1"] = ParagraphStyle(
        "h1",
        fontName="Times-Bold",
        fontSize=16,
        leading=20,
        textColor=INK,
        spaceBefore=14,
        spaceAfter=6,
    )
    s["h2"] = ParagraphStyle(
        "h2",
        fontName="Times-Bold",
        fontSize=13,
        leading=16,
        textColor=BRASS,
        spaceBefore=10,
        spaceAfter=4,
    )
    s["body"] = ParagraphStyle(
        "body",
        fontName="Times-Roman",
        fontSize=10.5,
        leading=14.5,
        textColor=INK,
        alignment=TA_JUSTIFY,
        spaceAfter=6,
    )
    s["bullet"] = ParagraphStyle(
        "bullet",
        parent=s["body"],
        leftIndent=0,
        alignment=TA_LEFT,
        spaceAfter=2,
    )
    s["small"] = ParagraphStyle(
        "small",
        fontName="Times-Roman",
        fontSize=9,
        leading=12,
        textColor=MUTED,
        spaceAfter=4,
    )
    s["code"] = ParagraphStyle(
        "code",
        fontName="Courier",
        fontSize=8,
        leading=10.5,
        textColor=INK,
        backColor=ROW,
        leftIndent=4,
        rightIndent=4,
        spaceBefore=2,
        spaceAfter=8,
    )
    s["th"] = ParagraphStyle(
        "th", fontName="Times-Bold", fontSize=8.5, leading=11, textColor=colors.white
    )
    s["td"] = ParagraphStyle(
        "td", fontName="Times-Roman", fontSize=8.5, leading=11, textColor=INK
    )
    s["footer"] = ParagraphStyle(
        "footer", fontName="Times-Roman", fontSize=8, textColor=MUTED
    )
    return s


S = styles()


def P(text, style="body"):
    return Paragraph(text, S[style])


def bullets(items):
    flow = []
    for item in items:
        flow.append(Paragraph("•  " + item, S["bullet"]))
    flow.append(Spacer(1, 4))
    return flow


def table(headers, rows, col_widths):
    head = [Paragraph(h, S["th"]) for h in headers]
    body = [[Paragraph(str(c), S["td"]) for c in row] for row in rows]
    data = [head] + body
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), HEAD),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("BACKGROUND", (0, 1), (-1, -1), colors.white),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, ROW]),
                ("GRID", (0, 0), (-1, -1), 0.3, RULE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    return t


def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(INK)
    canvas.rect(0, A4[1] - 12 * mm, A4[0], 12 * mm, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont("Times-Roman", 8)
    canvas.drawString(18 * mm, A4[1] - 7.5 * mm, "Plotline  ·  BS Computer Science FYP")
    canvas.drawRightString(A4[0] - 18 * mm, A4[1] - 7.5 * mm, "Achievement record")
    canvas.setFillColor(BRASS)
    canvas.rect(0, 0, A4[0], 2.2 * mm, fill=1, stroke=0)
    canvas.setFillColor(MUTED)
    canvas.setFont("Times-Roman", 8)
    canvas.drawString(18 * mm, 7 * mm, "12 November 2026  ·  Implementation record  ·  not a survey")
    canvas.drawRightString(A4[0] - 18 * mm, 7 * mm, f"{doc.page}")
    canvas.restoreState()


def build():
    from record_sections import add

    def code(text):
        return Preformatted(text, S["code"])

    story = []
    add(story, P, table, code)
    return story


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=16 * mm,
        title="Plotline achievement record",
        author="Plotline FYP",
    )
    doc.build(build(), onFirstPage=header_footer, onLaterPages=header_footer)
    print(OUT)


if __name__ == "__main__":
    main()
