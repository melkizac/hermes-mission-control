import capability_registry


def fake_fetcher(url):
    if "registry.npmjs.org" in url:
        return {
            "ok": True,
            "status": 200,
            "json": {
                "name": "@modelcontextprotocol/server-filesystem",
                "description": "MCP filesystem server",
                "license": "MIT",
                "dist-tags": {"latest": "1.0.0"},
                "time": {"1.0.0": "2026-01-01T00:00:00.000Z"},
                "versions": {"1.0.0": {"dependencies": {"zod": "^1.0.0"}, "bin": {"mcp-server-filesystem": "dist/index.js"}}},
            },
        }
    if "pypi.org" in url:
        return {
            "ok": True,
            "status": 200,
            "json": {
                "info": {"version": "24.0.0", "summary": "Python formatter", "license": "MIT", "requires_dist": ["click"]},
                "releases": {"24.0.0": [{"upload_time_iso_8601": "2026-01-02T00:00:00Z"}]},
            },
        }
    if "hub.docker.com" in url:
        return {"ok": True, "status": 200, "json": {"name": "latest", "last_updated": "2026-01-03T00:00:00Z", "images": [{"digest": "sha256:abc"}]}}
    return {"ok": False, "status": 404, "json": {}}


def test_explicit_npm_mcp_assessment_returns_governed_install_without_installing():
    result = capability_registry.assess_capability_source(
        {
            "sourceType": "mcp-server",
            "sourceRef": "@modelcontextprotocol/server-filesystem",
            "permissions": ["filesystem-write"],
            "requiredSecrets": [{"name": "FS_ROOT", "value": "/tmp/secret-root"}],
        },
        fetcher=fake_fetcher,
    )

    assert result["sourceType"] == "mcp-server"
    assert result["category"] == "mcp-server"
    assert result["installMethod"]["kind"] == "npm"
    assert result["installMethod"]["wrapperType"] == "mcp"
    assert result["suggestedWrapperType"] == "mcp"
    assert result["smokeTestCommand"] == "npx @modelcontextprotocol/server-filesystem --help"
    assert "filesystem-write" in result["permissions"]
    assert "requires-secret" in result["riskLevels"]
    assert "local-write" in result["riskLevels"]
    assert result["requiredSecrets"] == [{"name": "FS_ROOT", "required": True, "source": "operator-provided"}]
    assert "value" not in str(result)
    assert "secret-root" not in str(result)


def test_explicit_python_package_assessment_uses_pypi_metadata():
    result = capability_registry.assess_capability_source({"sourceType": "python-package", "sourceRef": "black"}, fetcher=fake_fetcher)

    assert result["sourceType"] == "python-package"
    assert result["sourceLabel"] == "PyPI"
    assert result["license"]["name"] == "MIT"
    assert result["installMethod"]["commandPreview"] == "pip install black"
    assert result["dependencyWeight"]["signals"]["pythonRequirements"] == 1
    assert "network" in result["riskLevels"]


def test_docker_image_assessment_is_heavy_and_has_rollback_notes():
    result = capability_registry.assess_capability_source("docker://qdrant/qdrant:latest", fetcher=fake_fetcher)

    assert result["sourceType"] == "docker-image"
    assert result["installMethod"]["kind"] == "docker"
    assert result["dependencyWeight"]["level"] == "heavy"
    assert "docker image rm qdrant/qdrant:latest" in result["rollbackNotes"]["uninstallSteps"]
    assert "production-control" in result["riskLevels"]


def test_secret_url_query_is_redacted_in_assessment_source_uri():
    result = capability_registry.assess_capability_source(
        {"sourceType": "cli-tool", "sourceUri": "https://example.com/tool?api_key=super-secret&ok=1"},
        fetcher=fake_fetcher,
    )

    assert result["sourceUri"] == "https://example.com/tool?api_key=[REDACTED]&ok=1"
    assert "super-secret" not in str(result)


def test_url_userinfo_credentials_are_redacted_in_assessment_source_uri():
    result = capability_registry.assess_capability_source(
        {"sourceType": "cli-tool", "sourceUri": "https://user:supersecret@example.com/tool?api_key=abc&ok=1"},
        fetcher=fake_fetcher,
    )

    assert result["sourceUri"] == "https://[REDACTED]@example.com/tool?api_key=[REDACTED]&ok=1"
    assert "user:supersecret" not in str(result)
    assert "api_key=abc" not in str(result)
