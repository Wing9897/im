"""Entry point: ``python -m server`` binds uvicorn on the fixed service port."""

from __future__ import annotations

import logging
import os

import uvicorn

from server.constants import HOST_ENV, SERVICE_PORT


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    uvicorn.run(
        "server.main:app",
        host=os.environ.get(HOST_ENV, "127.0.0.1"),
        port=SERVICE_PORT,
        log_level="info",
        # Recycle idle HTTP connections; reduces half-open sockets on long Windows dev runs.
        timeout_keep_alive=20,
    )


if __name__ == "__main__":
    main()
