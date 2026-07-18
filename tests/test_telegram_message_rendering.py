from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def test_shared_renderer_supports_telegram_style_readability_without_raw_html():
    wrapper = read("src/components/TelegramMessage.tsx")
    renderer = read("src/components/TelegramMarkdown.tsx")
    package = read("package.json")

    assert 'lazy(() => import("./TelegramMarkdown")' in wrapper
    assert "containsRichFormatting" in wrapper
    assert 'className={`${classes} plain`}' in wrapper
    assert 'import ReactMarkdown from "react-markdown"' in renderer
    assert 'import remarkGfm from "remark-gfm"' in renderer
    assert "remarkPlugins={[remarkGfm]}" in renderer
    assert "skipHtml" in renderer
    assert "message-table-scroll" in renderer
    assert 'label="Copy quote"' in renderer
    assert 'label="Copy code"' in renderer
    assert 'target="_blank"' in renderer
    assert 'rel="noopener noreferrer"' in renderer
    assert 'protocol === "http:" || protocol === "https:" || protocol === "mailto:" || protocol === "tel:"' in renderer
    assert '"react-markdown"' in package
    assert '"remark-gfm"' in package


def test_desktop_and_mobile_chat_share_the_same_rich_message_renderer():
    thread = read("src/components/ChatThread.tsx")
    mission = read("src/views/MissionControl.tsx")

    assert 'import { TelegramMessage } from "./TelegramMessage"' in thread
    assert 'import { TelegramMessage } from "../components/TelegramMessage"' in mission
    assert '<TelegramMessage text={visibleText}' in thread
    assert '<TelegramMessage text={visibleChatText(message)}' in mission
    assert '<TelegramMessage text={visiblePendingMainMessage.text}' in mission


def test_rich_messages_are_mobile_safe_and_copy_controls_are_keyboard_visible():
    styles = read("src/styles/app.css")

    assert ".telegram-message" in styles
    assert ".message-table-scroll" in styles
    assert "overflow-x: auto" in styles
    assert ".message-rich-copy:focus-visible" in styles
    assert "max-width: 100%" in styles
