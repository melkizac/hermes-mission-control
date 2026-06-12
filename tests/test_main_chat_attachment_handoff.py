import base64
import importlib.util
import sys
import tempfile
from pathlib import Path

ROOT = Path('/opt/hermes-mission-control/source')
MISSION_PATH = ROOT / 'src/views/MissionControl.tsx'
STORE_PATH = ROOT / 'src/services/store.tsx'
APP_PATH = Path('/opt/hermes-mission-control/app.py')


def test_main_chat_uploads_selected_files_before_routing_or_sending():
    mission = MISSION_PATH.read_text(encoding='utf-8')
    store = STORE_PATH.read_text(encoding='utf-8')

    assert 'uploadAttachmentToAgent: (agentId: string, file: File)' in store
    assert 'uploadAttachmentToAgent("default", item.file)' in mission
    assert 'const uploadedAttachments = sentAttachments.length ? await uploadMainChatAttachments(sentAttachments) : [];' in mission
    assert 'activeMainUploadedAttachmentsRef.current = uploadedAttachments;' in mission
    assert 'sendToAgent("default", composeInstructionContext(current.instruction, current.decision), activeMainUploadedAttachmentsRef.current' in mission
    assert 'sendToAgent("default", composeClarificationContext(current.instruction, current.decision, current.preview), activeMainUploadedAttachmentsRef.current' in mission


def test_research_deliverable_route_carries_uploaded_attachment_paths_to_backend():
    mission = MISSION_PATH.read_text(encoding='utf-8')

    assert 'attachments: activeMainUploadedAttachmentsRef.current.map((attachment) => ({' in mission
    assert 'path: attachment.path' in mission
    assert 'url: attachment.url' in mission
    assert 'sizeBytes: attachment.sizeBytes' in mission


def test_main_chat_generated_output_does_not_link_untrusted_server_paths():
    mission = MISSION_PATH.read_text(encoding='utf-8')
    app = APP_PATH.read_text(encoding='utf-8')

    assert "GENERATED_OUTPUT_DIR = Path(os.environ.get('HMC_GENERATED_OUTPUT_DIR', HOME / '.hermes' / 'output'))" in app
    assert "elif parsed.path == '/api/generated-output/download':" in app
    assert "downloadablePathFromText" not in mission
    assert "/api/generated-output/download?path=${encodeURIComponent" not in mission
    assert "artifact.downloadUrl || artifact.url || \"\"" in mission
    assert "fallbackText: [artifact.filename, artifact.preview].filter(Boolean).join(\"\\n\")" in mission


def test_backend_attachment_save_normalize_and_prompt_block_exposes_server_path(monkeypatch):
    upload_root = tempfile.mkdtemp(prefix='hmc-attachment-regression-')
    monkeypatch.setenv('HMC_UPLOAD_DIR', upload_root)
    monkeypatch.setenv('HMC_MAX_ATTACHMENT_BYTES', str(50 * 1024 * 1024))

    spec = importlib.util.spec_from_file_location('hmc_app_attachment_regression', APP_PATH)
    assert spec is not None and spec.loader is not None
    app = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = app
    spec.loader.exec_module(app)

    payload = {
        'filename': 'CSPN LINKEDIN – 2026_04_22 15_04 GMT+08_00 – Notes by Gemini.docx',
        'mime': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'sizeBytes': 12,
        'data': base64.b64encode(b'fake-docx-bytes').decode('ascii'),
    }
    attachment, status = app.save_attachment('mc-admin__default', payload)

    assert status == 201
    assert app.MAX_ATTACHMENT_BYTES == 50 * 1024 * 1024
    assert Path(attachment['path']).exists()
    normalized = app.normalize_message_attachments('mc-admin__default', [attachment])
    assert normalized and normalized[0]['path'] == attachment['path']
    prompt = app.attachment_prompt_block(normalized)
    assert attachment['filename'] in prompt
    assert attachment['path'] in prompt
    assert 'Attached files available on the Mission Control server' in prompt
