"""Domain failures routes translate back to HTTP."""

from __future__ import annotations


class SourceFlowError(Exception):
    """A source flow the route should surface as an HTTP error.

    Connect failures that stay in the response body (row left at status
    ``error``) are not this type.
    """

    def __init__(self, message: str, *, http_status: int, error_code: str) -> None:
        super().__init__(message)
        self.http_status = http_status
        self.error_code = error_code
