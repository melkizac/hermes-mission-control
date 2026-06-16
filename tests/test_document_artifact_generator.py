import importlib.util
import json
import sys
import zipfile
from pathlib import Path

WRAPPER_PATH = Path(__file__).resolve().parents[1] / "scripts" / "document_artifact_generator.py"
spec = importlib.util.spec_from_file_location("document_artifact_generator", WRAPPER_PATH)
assert spec is not None and spec.loader is not None
module = importlib.util.module_from_spec(spec)
sys.modules["document_artifact_generator"] = module
spec.loader.exec_module(module)

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "research_deliverable_notes.md"


def test_generate_editable_pptx_docx_and_manifest_from_fixture_notes(tmp_path):
    result = module.generate_from_notes(
        notes_path=FIXTURE,
        output_dir=tmp_path,
        title="AI Workforce for SMEs",
        brand="Nexius Academy",
        audience="Singapore SME leaders",
    )

    pptx_path = Path(result["artifacts"]["pptx"]["path"])
    docx_path = Path(result["artifacts"]["docx"]["path"])
    manifest_path = Path(result["manifestPath"])

    assert pptx_path.exists() and pptx_path.suffix == ".pptx"
    assert docx_path.exists() and docx_path.suffix == ".docx"
    assert manifest_path.exists()
    assert result["artifacts"]["pptx"]["editable"] is True
    assert result["artifacts"]["docx"]["editable"] is True

    with zipfile.ZipFile(pptx_path) as pptx:
        names = set(pptx.namelist())
        assert "ppt/presentation.xml" in names
        assert "ppt/slides/slide1.xml" in names
        assert any(name.startswith("ppt/notesSlides/") for name in names)
        deck_text = "\n".join(pptx.read(name).decode("utf-8", "ignore") for name in names if name.startswith("ppt/slides/slide"))
        assert "AI Workforce for SMEs" in deck_text
        assert "30-day implementation roadmap" in deck_text

    with zipfile.ZipFile(docx_path) as docx:
        names = set(docx.namelist())
        assert "word/document.xml" in names
        document_xml = docx.read("word/document.xml").decode("utf-8")
        assert "AI Workforce for SMEs" in document_xml
        assert "Governance" in document_xml
        assert "Nexius workshop notes" in document_xml

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert manifest["qa"]["status"] == "passed"
    assert manifest["qa"]["checks"]["pptxZipValid"] is True
    assert manifest["qa"]["checks"]["docxZipValid"] is True
    assert manifest["qa"]["checks"]["pptxSlideCount"] >= 5
    assert manifest["qa"]["checks"]["docxParagraphCount"] >= 8


def test_preview_excerpt_truncates_at_word_boundary_with_ellipsis():
    excerpt = module.preview_excerpt(
        "AI adoption succeeds when owners define process outcomes before choosing tools.",
        max_chars=62,
    )

    assert excerpt.endswith("…")
    assert "choosi" not in excerpt
    assert len(excerpt) <= 63


def test_validation_rejects_non_office_zip(tmp_path):
    broken = tmp_path / "broken.pptx"
    broken.write_text("not a zip", encoding="utf-8")

    validation = module.validate_artifact(broken, expected_kind="pptx")

    assert validation["ok"] is False
    assert validation["kind"] == "pptx"
    assert validation["errors"]


def test_cli_sample_writes_preview_and_evidence(tmp_path):
    args = module.build_parser().parse_args([
        "generate",
        "--notes", str(FIXTURE),
        "--out", str(tmp_path),
        "--title", "AI Workforce for SMEs",
        "--brand", "Nexius Academy",
        "--audience", "Singapore SME leaders",
    ])

    result = module.run_action(args)

    evidence = result["evidence"]
    preview_paths = [Path(item["path"]) for item in evidence if item["type"].startswith("preview_")]
    assert preview_paths
    assert all(path.exists() for path in preview_paths)
    assert any(path.suffix == ".png" for path in preview_paths)
    assert result["qa"]["status"] == "passed"
