#!/usr/bin/env python3
"""Generate editable PPTX and DOCX artifacts from research notes.

This wrapper intentionally uses only Python stdlib + Pillow (when present for PNG
previews) so Mission Control can produce local draft artifacts without requiring
cloud document APIs. The generated files are simple Office Open XML packages:
editable text boxes/slides for PPTX and real paragraphs/lists for DOCX.
"""

from __future__ import annotations

import argparse
import json
import re
import textwrap
import zipfile
from dataclasses import dataclass, field
from datetime import datetime, timezone
from html import escape
from pathlib import Path
from typing import Iterable

try:
    from PIL import Image, ImageDraw, ImageFont
except Exception:  # pragma: no cover - preview text fallback covers this
    Image = ImageDraw = ImageFont = None


@dataclass
class ResearchNotes:
    title: str
    audience: str = "General operators"
    brand: str = "Melverick / Nexius"
    tone: str = "clear, practical"
    thesis: str = ""
    findings: list[str] = field(default_factory=list)
    outline: list[str] = field(default_factory=list)
    slide_notes: list[str] = field(default_factory=list)
    report_notes: str = ""
    sources: list[str] = field(default_factory=list)


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "research-deliverable"


def parse_notes(text: str, *, title: str | None = None, brand: str | None = None, audience: str | None = None) -> ResearchNotes:
    lines = [line.rstrip() for line in text.splitlines()]
    detected_title = title or "Research Deliverable"
    for line in lines:
        if line.startswith("# "):
            detected_title = line[2:].strip()
            break
    notes = ResearchNotes(title=detected_title)
    current = None
    buckets: dict[str, list[str]] = {}
    for raw in lines:
        line = raw.strip()
        if not line:
            continue
        lowered = line.lower()
        if lowered.startswith("audience:"):
            notes.audience = line.split(":", 1)[1].strip()
            continue
        if lowered.startswith("brand:"):
            notes.brand = line.split(":", 1)[1].strip()
            continue
        if lowered.startswith("tone:"):
            notes.tone = line.split(":", 1)[1].strip()
            continue
        if line.startswith("## "):
            current = line[3:].strip().lower()
            buckets[current] = []
            continue
        if current:
            buckets[current].append(line)

    if brand:
        notes.brand = brand
    if audience:
        notes.audience = audience

    notes.thesis = " ".join(_strip_list_marker(v) for v in buckets.get("thesis", []))
    notes.findings = [_strip_list_marker(v) for v in buckets.get("key findings", []) if _strip_list_marker(v)]
    notes.outline = [_strip_list_marker(v) for v in buckets.get("outline", []) if _strip_list_marker(v)]
    notes.slide_notes = [_strip_list_marker(v) for v in buckets.get("slide notes", []) if _strip_list_marker(v)]
    notes.report_notes = " ".join(_strip_list_marker(v) for v in buckets.get("report notes", []))
    notes.sources = sorted(set(re.findall(r"\[Source:\s*([^\]]+)\]", text)))
    return notes


def _strip_list_marker(value: str) -> str:
    return re.sub(r"^(?:[-*]|\d+[.)])\s+", "", value).strip()


def build_deck_outline(notes: ResearchNotes) -> list[dict[str, object]]:
    findings = notes.findings or [notes.thesis]
    outline = notes.outline or ["Context", "Operating model", "Governance", "Roadmap"]
    return [
        {"title": notes.title, "body": [notes.thesis, f"Audience: {notes.audience}", f"Brand: {notes.brand}"], "notes": notes.slide_notes[:1]},
        {"title": "Core message", "body": [notes.thesis] + findings[:2], "notes": notes.slide_notes[:2]},
        {"title": "What the research says", "body": findings[:4], "notes": ["Use cited source labels when discussing each finding."]},
        {"title": "Workflow roadmap", "body": outline[:5], "notes": ["Frame this as a practical implementation sequence."]},
        {"title": "Governance and next steps", "body": ["Keep human review for sensitive decisions", "Capture audit evidence before scaling", "Start with one repeatable workflow"] + notes.sources[:2], "notes": ["Close with a concrete pilot invitation."]},
    ]


def generate_from_notes(notes_path: str | Path, output_dir: str | Path, *, title: str | None = None, brand: str | None = None, audience: str | None = None) -> dict:
    notes_path = Path(notes_path).resolve()
    output_dir = Path(output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    notes = parse_notes(notes_path.read_text(encoding="utf-8"), title=title, brand=brand, audience=audience)
    stem = slugify(notes.title)
    pptx_path = output_dir / f"{stem}.pptx"
    docx_path = output_dir / f"{stem}.docx"
    preview_png = output_dir / f"{stem}-pptx-preview.png"
    preview_txt = output_dir / f"{stem}-docx-preview.txt"
    manifest_path = output_dir / f"{stem}-artifact-manifest.json"

    slides = build_deck_outline(notes)
    write_pptx(pptx_path, notes, slides)
    write_docx(docx_path, notes, slides)
    write_preview_png(preview_png, notes, slides)
    preview_txt.write_text(render_docx_preview_text(notes, slides), encoding="utf-8")

    pptx_validation = validate_artifact(pptx_path, expected_kind="pptx")
    docx_validation = validate_artifact(docx_path, expected_kind="docx")
    passed = pptx_validation["ok"] and docx_validation["ok"]
    now = datetime.now(timezone.utc).isoformat()
    manifest = {
        "createdAt": now,
        "generator": "scripts/document_artifact_generator.py",
        "input": {"notesPath": str(notes_path), "title": notes.title, "brand": notes.brand, "audience": notes.audience},
        "artifacts": {
            "pptx": {"path": str(pptx_path), "type": "pptx", "editable": True, "validation": pptx_validation},
            "docx": {"path": str(docx_path), "type": "docx", "editable": True, "validation": docx_validation},
        },
        "evidence": [
            {"type": "preview_pptx_png", "path": str(preview_png), "summary": "Generated visual preview contact sheet from slide text layout."},
            {"type": "preview_docx_text", "path": str(preview_txt), "summary": "Generated text preview extracted from the DOCX source outline."},
            {"type": "artifact_validation", "path": str(pptx_path), "summary": "; ".join(pptx_validation.get("checks", []))},
            {"type": "artifact_validation", "path": str(docx_path), "summary": "; ".join(docx_validation.get("checks", []))},
        ],
        "qa": {
            "status": "passed" if passed else "failed",
            "checks": {
                "pptxZipValid": pptx_validation["ok"],
                "docxZipValid": docx_validation["ok"],
                "pptxSlideCount": pptx_validation.get("slideCount", 0),
                "docxParagraphCount": docx_validation.get("paragraphCount", 0),
                "previewGenerated": preview_png.exists() and preview_txt.exists(),
            },
        },
    }
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    manifest["manifestPath"] = str(manifest_path)
    return manifest


def write_pptx(path: Path, notes: ResearchNotes, slides: list[dict[str, object]]) -> None:
    content_types = _pptx_content_types(len(slides))
    root_rels = _rels([("rId1", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument", "ppt/presentation.xml")])
    pres_rels_items = [(f"rId{i}", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide", f"slides/slide{i}.xml") for i in range(1, len(slides)+1)]
    pres_rels_items += [(f"rIdNotes{i}", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide", f"notesSlides/notesSlide{i}.xml") for i in range(1, len(slides)+1)]
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", content_types)
        z.writestr("_rels/.rels", root_rels)
        z.writestr("ppt/presentation.xml", _presentation_xml(len(slides)))
        z.writestr("ppt/_rels/presentation.xml.rels", _rels(pres_rels_items))
        z.writestr("ppt/theme/theme1.xml", _theme_xml())
        z.writestr("ppt/slideMasters/slideMaster1.xml", _empty_ppt_part("sldMaster"))
        z.writestr("ppt/slideLayouts/slideLayout1.xml", _empty_ppt_part("sldLayout"))
        z.writestr("ppt/notesMasters/notesMaster1.xml", _empty_ppt_part("notesMaster"))
        for idx, slide in enumerate(slides, 1):
            z.writestr(f"ppt/slides/slide{idx}.xml", _slide_xml(idx, str(slide["title"]), list(slide["body"]), notes.brand))
            z.writestr(f"ppt/slides/_rels/slide{idx}.xml.rels", _rels([("rId1", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide", f"../notesSlides/notesSlide{idx}.xml")]))
            z.writestr(f"ppt/notesSlides/notesSlide{idx}.xml", _notes_slide_xml(str(slide["title"]), list(slide.get("notes") or [])))
            z.writestr(f"ppt/notesSlides/_rels/notesSlide{idx}.xml.rels", _rels([("rId1", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide", f"../slides/slide{idx}.xml")]))


def _pptx_content_types(count: int) -> str:
    overrides = [
        '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>',
        '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>',
        '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>',
        '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>',
        '<Override PartName="/ppt/notesMasters/notesMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesMaster+xml"/>',
    ]
    for i in range(1, count + 1):
        overrides.append(f'<Override PartName="/ppt/slides/slide{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>')
        overrides.append(f'<Override PartName="/ppt/notesSlides/notesSlide{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>')
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' + ''.join(overrides) + '</Types>'


def _presentation_xml(count: int) -> str:
    ids = ''.join(f'<p:sldId id="{255+i}" r:id="rId{i}"/>' for i in range(1, count + 1))
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rIdMaster1"/></p:sldMasterIdLst><p:sldIdLst>{ids}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>'''


def _slide_xml(idx: int, title: str, body: list[str], brand: str) -> str:
    body_text = '\n'.join(str(item) for item in body if str(item).strip())
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="0B1020"/></a:solidFill></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>{_ppt_textbox(2, 'Title', 650000, 500000, 10900000, 1100000, title, 3600, 'FFFFFF', True)}{_ppt_textbox(3, 'Body', 850000, 1750000, 10300000, 3600000, body_text, 1900, 'EAF2FF', False)}{_ppt_textbox(4, 'Footer', 850000, 6150000, 10300000, 350000, f'{brand} • editable draft • slide {idx}', 900, '7DD3FC', False)}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>'''


def _ppt_textbox(shape_id: int, name: str, x: int, y: int, cx: int, cy: int, text: str, size: int, color: str, bold: bool) -> str:
    bold_attr = ' b="1"' if bold else ''
    paragraphs = ''.join(
        f'<a:p><a:r><a:rPr lang="en-US" sz="{size}"{bold_attr}><a:solidFill><a:srgbClr val="{color}"/></a:solidFill></a:rPr><a:t>{escape(line)}</a:t></a:r></a:p>'
        for line in str(text).split('\n')
        if line.strip()
    )
    return f'<p:sp><p:nvSpPr><p:cNvPr id="{shape_id}" name="{escape(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm><a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="101A35"/></a:solidFill><a:ln><a:solidFill><a:srgbClr val="1D4ED8"/></a:solidFill></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" lIns="180000" tIns="120000" rIns="180000" bIns="120000"/><a:lstStyle/>{paragraphs}</p:txBody></p:sp>'


def _notes_slide_xml(title: str, notes: list[str]) -> str:
    note_text = title + "\n" + "\n".join(notes or ["Speaker notes placeholder: review and adapt before delivery."])
    return f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:notes xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>{_ppt_textbox(2, "Notes", 500000, 500000, 5800000, 7800000, note_text, 1200, "111827", False)}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>'


def _empty_ppt_part(tag: str) -> str:
    return f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:{tag} xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld></p:{tag}>'


def _theme_xml() -> str:
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Nexius Default"><a:themeElements><a:clrScheme name="Nexius"><a:dk1><a:srgbClr val="0B1020"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="111827"/></a:dk2><a:lt2><a:srgbClr val="EAF2FF"/></a:lt2><a:accent1><a:srgbClr val="2563EB"/></a:accent1><a:accent2><a:srgbClr val="14B8A6"/></a:accent2><a:accent3><a:srgbClr val="F59E0B"/></a:accent3><a:accent4><a:srgbClr val="7C3AED"/></a:accent4><a:accent5><a:srgbClr val="06B6D4"/></a:accent5><a:accent6><a:srgbClr val="F43F5E"/></a:accent6><a:hlink><a:srgbClr val="2563EB"/></a:hlink><a:folHlink><a:srgbClr val="7C3AED"/></a:folHlink></a:clrScheme><a:fontScheme name="Arial"><a:majorFont><a:latin typeface="Arial"/></a:majorFont><a:minorFont><a:latin typeface="Arial"/></a:minorFont></a:fontScheme><a:fmtScheme name="Default"><a:fillStyleLst/><a:lnStyleLst/><a:effectStyleLst/><a:bgFillStyleLst/></a:fmtScheme></a:themeElements></a:theme>'


def write_docx(path: Path, notes: ResearchNotes, slides: list[dict[str, object]]) -> None:
    paragraphs = [
        _doc_p(notes.title, style="Heading1"),
        _doc_p(f"Audience: {notes.audience}"),
        _doc_p(f"Brand: {notes.brand}"),
        _doc_p("Executive summary", style="Heading2"),
        _doc_p(notes.thesis or "Research summary prepared from supplied notes."),
        _doc_p("Key findings", style="Heading2"),
    ]
    paragraphs += [_doc_p(finding, bullet=True) for finding in notes.findings]
    paragraphs += [_doc_p("Recommended deck outline", style="Heading2")]
    paragraphs += [_doc_p(str(slide["title"]), bullet=True) for slide in slides]
    paragraphs += [_doc_p("Source labels", style="Heading2")]
    paragraphs += [_doc_p(source, bullet=True) for source in (notes.sources or ["No source labels supplied"])]
    paragraphs += [_doc_p("Report notes", style="Heading2"), _doc_p(notes.report_notes or "Use the source labels above when expanding into a formal report.")]
    document = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + ''.join(paragraphs) + '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>'
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>')
        z.writestr("_rels/.rels", _rels([("rId1", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument", "word/document.xml")]))
        z.writestr("word/_rels/document.xml.rels", _rels([]))
        z.writestr("word/document.xml", document)
        z.writestr("word/styles.xml", _docx_styles())


def _doc_p(text: str, *, style: str | None = None, bullet: bool = False) -> str:
    ppr = ""
    if style:
        ppr += f'<w:pStyle w:val="{style}"/>'
    if bullet:
        ppr += '<w:pStyle w:val="ListParagraph"/><w:ind w:left="720" w:hanging="360"/>'
        text = f'• {text}'
    return f'<w:p>{f"<w:pPr>{ppr}</w:pPr>" if ppr else ""}<w:r><w:t>{escape(str(text))}</w:t></w:r></w:p>'


def _docx_styles() -> str:
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="22"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/><w:pPr><w:spacing w:before="240" w:after="160"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/><w:pPr><w:spacing w:before="220" w:after="120"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/></w:style></w:styles>'


def _rels(items: Iterable[tuple[str, str, str]]) -> str:
    body = ''.join(f'<Relationship Id="{escape(rid)}" Type="{escape(rel_type)}" Target="{escape(target)}"/>' for rid, rel_type, target in items)
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + body + '</Relationships>'


def render_docx_preview_text(notes: ResearchNotes, slides: list[dict[str, object]]) -> str:
    return "\n".join([notes.title, f"Audience: {notes.audience}", f"Brand: {notes.brand}", "", notes.thesis, "", "Slides:"] + [f"- {slide['title']}" for slide in slides])


def preview_excerpt(text: str, max_chars: int = 70) -> str:
    text = re.sub(r"\s+", " ", str(text)).strip()
    if len(text) <= max_chars:
        return text
    truncated = text[:max_chars].rsplit(" ", 1)[0].rstrip(" .,;:-")
    if not truncated:
        truncated = text[:max_chars].rstrip(" .,;:-")
    return truncated + "…"


def write_preview_png(path: Path, notes: ResearchNotes, slides: list[dict[str, object]]) -> None:
    if Image is None:
        path.with_suffix(".txt").write_text(render_docx_preview_text(notes, slides), encoding="utf-8")
        return
    width, height = 1200, 675
    img = Image.new("RGB", (width, height), "#0B1020")
    draw = ImageDraw.Draw(img)
    try:
        font_title = ImageFont.truetype("DejaVuSans-Bold.ttf", 44)
        font_body = ImageFont.truetype("DejaVuSans.ttf", 24)
        font_small = ImageFont.truetype("DejaVuSans.ttf", 18)
    except Exception:
        font_title = font_body = font_small = None
    draw.rounded_rectangle((50, 45, width - 50, 145), radius=24, fill="#101A35", outline="#2563EB", width=3)
    draw.text((80, 70), notes.title[:55], fill="#FFFFFF", font=font_title)
    x, y = 70, 185
    for idx, slide in enumerate(slides, 1):
        col = (idx - 1) % 2
        row = (idx - 1) // 2
        bx, by = x + col * 560, y + row * 155
        draw.rounded_rectangle((bx, by, bx + 510, by + 125), radius=18, fill="#EAF2FF", outline="#14B8A6", width=2)
        draw.text((bx + 20, by + 16), f"{idx}. {slide['title']}"[:42], fill="#0B1020", font=font_body)
        body_items = slide.get("body") or [""]
        if not isinstance(body_items, list):
            body_items = [str(body_items)]
        body = preview_excerpt(str(body_items[0]), max_chars=82)
        for line_no, wrapped in enumerate(textwrap.wrap(body, width=44)[:2]):
            draw.text((bx + 24, by + 58 + line_no * 24), wrapped, fill="#334155", font=font_small)
    draw.text((70, height - 40), f"{notes.brand} editable draft preview", fill="#7DD3FC", font=font_small)
    img.save(path)


def validate_artifact(path: str | Path, *, expected_kind: str) -> dict:
    path = Path(path)
    result = {"ok": False, "kind": expected_kind, "path": str(path), "errors": [], "checks": []}
    try:
        with zipfile.ZipFile(path) as z:
            names = set(z.namelist())
            result["checks"].append("zip package opened")
            if expected_kind == "pptx":
                required = {"[Content_Types].xml", "_rels/.rels", "ppt/presentation.xml"}
                missing = sorted(required - names)
                if missing:
                    result["errors"].append(f"missing required PPTX parts: {', '.join(missing)}")
                slide_names = sorted(name for name in names if re.match(r"ppt/slides/slide\d+\.xml$", name))
                result["slideCount"] = len(slide_names)
                if not slide_names:
                    result["errors"].append("no editable slide XML parts found")
                for name in slide_names:
                    xml = z.read(name).decode("utf-8")
                    if "<a:t>" not in xml:
                        result["errors"].append(f"{name} has no text runs")
                if any(name.startswith("ppt/notesSlides/") for name in names):
                    result["checks"].append("speaker notes parts present")
            elif expected_kind == "docx":
                required = {"[Content_Types].xml", "_rels/.rels", "word/document.xml"}
                missing = sorted(required - names)
                if missing:
                    result["errors"].append(f"missing required DOCX parts: {', '.join(missing)}")
                if "word/document.xml" in names:
                    xml = z.read("word/document.xml").decode("utf-8")
                    result["paragraphCount"] = xml.count("<w:p")
                    if "<w:t>" not in xml:
                        result["errors"].append("document has no editable text runs")
                    result["checks"].append("document XML contains editable text runs")
            else:
                result["errors"].append(f"unsupported expected kind: {expected_kind}")
    except Exception as exc:
        result["errors"].append(str(exc))
    result["ok"] = not result["errors"]
    return result


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Generate editable PPTX/DOCX artifacts from research notes")
    sub = parser.add_subparsers(dest="action", required=True)
    gen = sub.add_parser("generate")
    gen.add_argument("--notes", required=True, help="Markdown research notes path")
    gen.add_argument("--out", required=True, help="Output directory")
    gen.add_argument("--title")
    gen.add_argument("--brand")
    gen.add_argument("--audience")
    val = sub.add_parser("validate")
    val.add_argument("path")
    val.add_argument("--kind", choices=["pptx", "docx"], required=True)
    return parser


def run_action(args: argparse.Namespace) -> dict:
    if args.action == "generate":
        return generate_from_notes(args.notes, args.out, title=args.title, brand=args.brand, audience=args.audience)
    if args.action == "validate":
        return validate_artifact(args.path, expected_kind=args.kind)
    raise ValueError(f"unsupported action {args.action}")


def main() -> None:
    print(json.dumps(run_action(build_parser().parse_args()), indent=2))


if __name__ == "__main__":
    main()
