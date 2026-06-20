from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]


def test_workspace_nav_uses_distinct_relevant_icons_for_visible_items():
    nav = (ROOT / "src/components/NavRail.tsx").read_text()
    icon_source = (ROOT / "src/components/Icon.tsx").read_text()

    workspace_block = nav.split('const simplifiedWorkspaceGroups', 1)[1].split('const adminConsoleGroups', 1)[0]
    icon_names = re.findall(r'icon: "([^"]+)"', workspace_block)
    assert len(icon_names) == len(set(icon_names)), f"Repeated workspace nav icons: {icon_names}"

    for expected in [
        '{ key: "projects", label: "Projects", icon: "projects" }',
        '{ key: "files", label: "Files", icon: "folder" }',
        '{ key: "workflow-library", label: "Workflows", icon: "workflow" }',
        '{ key: "tools", label: "Tools", icon: "tools" }',
        '{ key: "plugins", label: "Plugins", icon: "plugins" }',
        '{ key: "reflections", label: "Reflections", icon: "reflections" }',
    ]:
        assert expected in workspace_block

    assert '| "workflow"' in icon_source
    assert '| "tools"' in icon_source
    assert '| "plugins"' in icon_source
    assert '| "reflections"' in icon_source

    paths_block = icon_source.split('const paths: Record<Name, string> = {', 1)[1].split('};', 1)[0]
    path_values = dict(re.findall(r'\n\s+(\w+): "([^"]+)"', paths_block))
    assert path_values['projects'] != path_values['folder']
    assert path_values['tools'] != path_values['plugins']
    assert path_values['memory'] != path_values['reflections']
