"""Fixtures: app with lifespan (no collector / scheduler start) + seeded DB."""

from __future__ import annotations

from collections.abc import AsyncIterator

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from hypothesis import settings

from server.constants import SECRET_KEY_FILE_ENV
from server.main import create_app
from server.secrets import _fernet
from server.tests.property_strategies import MIN_PROPERTY_EXAMPLES
from server.tests.seed import seed_database

pytest_plugins = ["server.tests.calendar_share_fakes"]

settings.register_profile("property-invariants", max_examples=MIN_PROPERTY_EXAMPLES)
settings.load_profile("property-invariants")


@pytest.fixture(autouse=True)
def isolated_secret_key(tmp_path, monkeypatch):
    monkeypatch.setenv(SECRET_KEY_FILE_ENV, str(tmp_path / "secret.key"))
    _fernet.cache_clear()
    yield
    _fernet.cache_clear()


@pytest.fixture(autouse=True)
def reset_calendar_share_rate_limits():
    from server.calendar_share.rate_limit import reset_calendar_share_rate_limit_for_tests

    reset_calendar_share_rate_limit_for_tests()
    yield
    reset_calendar_share_rate_limit_for_tests()


@pytest.fixture
async def app(tmp_path) -> AsyncIterator[FastAPI]:
    application = create_app(
        db_path=str(tmp_path / "contract-test.db"),
        start_collector=False,
        start_scheduler=False,
        serve_static=False,
    )
    async with application.router.lifespan_context(application):
        await seed_database(application.state.db)
        yield application


@pytest.fixture
async def client(app: FastAPI) -> AsyncIterator[AsyncClient]:
    """Loopback client (httpx ASGI default host is 127.0.0.1 → auth exempt)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as c:
        yield c


@pytest.fixture
async def remote_client(app: FastAPI) -> AsyncIterator[AsyncClient]:
    """Client that presents as a non-loopback (LAN) address."""
    transport = ASGITransport(app=app, client=("203.0.113.9", 51234))
    async with AsyncClient(transport=transport, base_url="http://testserver") as c:
        yield c
