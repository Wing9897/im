# Docs index

| Doc | When to read |
|-----|----------------|
| [../README.md](../README.md) | Install, run, ports, desktop host/client, product overview |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design, API contract, frontend layering |
| [SCHEMA-BASELINE.md](SCHEMA-BASELINE.md) | Schema wipe-only contract: stamp/semver, support matrix, explicit reset |
| [AUTH.md](AUTH.md) | Authentication: device sessions, API keys, setup routes, manual checklist |
| [DESKTOP-ICS.md](DESKTOP-ICS.md) | Desktop one-shot ICS import: supported subset, limits, remote-URL policy |
| [RETIRED-API.md](RETIRED-API.md) | Index of retired HTTP paths; lock is `test_dead_endpoints` |
| [KNOWN-SIMPLIFICATIONS.md](KNOWN-SIMPLIFICATIONS.md) | Intentional deltas／quirks only; contract detail → ARCHITECTURE／`docs/agent/*` |
| [I18N-GLOSSARY.md](I18N-GLOSSARY.md) | UI locale keys, error_code vocabulary, preset display Sot |
| [agent/assistant.md](agent/assistant.md) | Built-in Agent + voice assistant contract |
| [agent/a2a.md](agent/a2a.md) | Agent-to-Agent（客戶經理 / Account manager）natural-language agent API |
| [agent/mcp.md](agent/mcp.md) | MCP Streamable HTTP tool surface（OpenClaw 等；無本機 LLM） |
| [agent/agent.md](agent/agent.md) | Agent schedule ticks（產品預設「專案調和」；UI URL 僅 `/tasks/:taskId/agent`） |
| [diagrams/README.md](diagrams/README.md) | Mermaid structure: Input → Process → Output, timer, agent loop |
| [../CHANGELOG.md](../CHANGELOG.md) | Release notes; stable baseline starts at `1.0.0` |
| [../Dockerfile](../Dockerfile)／[../docker-compose.yml](../docker-compose.yml) | Headless server+SPA container (GHCR) |
| [../desktop/resources/README.md](../desktop/resources/README.md) | Packaged icon assets |

**Do not** create `docs/api/`, `docs/schema/`, or `docs/frontend/` trees — big topics live as flat standalone files in `docs/` (like SCHEMA-BASELINE／AUTH／DESKTOP-ICS) or as sections inside ARCHITECTURE.

Drift checks: `npm run check`, `npm run verify:deploy`, `server/tests/test_contract_*.py`, `server/tests/test_dead_endpoints.py`.
