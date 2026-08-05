# Build context: repository root.
# Image: server + built SPA (no Electron). Push target: ghcr.io/<owner>/<repo>

ARG NODE_VERSION=20.19.0
ARG PYTHON_VERSION=3.11

# ── Web SPA ──────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm AS web
WORKDIR /src
COPY package.json package-lock.json .nvmrc ./
COPY web/package.json web/
COPY desktop/package.json desktop/
RUN npm ci
COPY web web
COPY scripts scripts
COPY shared shared
# Theme / i18n scripts may read root files; copy minimal extras used by build-web.
COPY VERSION ./
RUN npm run build:web

# ── Python deps (uv) ─────────────────────────────────────────────────
FROM ghcr.io/astral-sh/uv:python${PYTHON_VERSION}-bookworm-slim AS python-deps
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy
COPY pyproject.toml uv.lock README.md ./
COPY server server
RUN uv sync --frozen --no-dev --no-editable

# ── Runtime ──────────────────────────────────────────────────────────
FROM python:${PYTHON_VERSION}-slim-bookworm AS runtime
WORKDIR /app

RUN useradd --create-home --uid 10001 im \
  && mkdir -p /data \
  && chown -R im:im /data /app

COPY --from=python-deps /app/.venv /app/.venv
COPY --from=python-deps /app/server /app/server
COPY --from=python-deps /app/pyproject.toml /app/pyproject.toml
COPY --from=web /src/web/dist /app/web-dist
COPY VERSION /app/VERSION
# Runtime catalog for server.presets.task_presets → /app/shared/task_presets.json
COPY shared /app/shared

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONPATH=/app \
    PYTHONUNBUFFERED=1 \
    INTELLIGENCE_MONITOR_HOST=0.0.0.0 \
    INTELLIGENCE_MONITOR_DATA_DIR=/data \
    IM_FRONTEND_DIST=/app/web-dist

EXPOSE 18820
VOLUME ["/data"]
USER im

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:18820/api/v1/health', timeout=3)"

CMD ["python", "-m", "server"]
