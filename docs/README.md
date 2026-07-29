# Docs index

| Doc | When to read |
|-----|----------------|
| [../README.md](../README.md) | Install, run, ports, desktop host/client |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design, schema matrix, API contract, frontend layering, auth |
| [KNOWN-SIMPLIFICATIONS.md](KNOWN-SIMPLIFICATIONS.md) | Intentional deltas／quirks only; contract detail → ARCHITECTURE／`docs/agent/*` |
| [I18N-GLOSSARY.md](I18N-GLOSSARY.md) | UI locale keys, error_code vocabulary, preset display Sot |
| [agent/assistant.md](agent/assistant.md) | Built-in Agent + voice assistant contract |
| [agent/a2a.md](agent/a2a.md) | Agent-to-Agent（客戶經理 / Account manager）natural-language agent API |
| [agent/project.md](agent/project.md) | Closed-loop project-manager schedule ticks |
| [diagrams/README.md](diagrams/README.md) | Mermaid structure: Input → Process → Output, timer, project loop |
| [../CHANGELOG.md](../CHANGELOG.md) | Release notes, starting at the first public release `0.1.0-beta.1` |
| [../Dockerfile](../Dockerfile)／[../docker-compose.yml](../docker-compose.yml) | Headless server+SPA container (GHCR) |
| [../desktop/resources/README.md](../desktop/resources/README.md) | Packaged icon assets |

**Do not** create `docs/api/`, `docs/schema/`, or `docs/frontend/` trees — keep those topics as sections inside ARCHITECTURE.

Drift checks: `npm run check`, `npm run verify:fast`, `server/tests/test_contract_*.py`, `server/tests/test_dead_endpoints.py`.
