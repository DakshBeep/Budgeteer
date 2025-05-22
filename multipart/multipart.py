"""Lightweight helpers mimicking a tiny portion of ``python-multipart``.

This module only implements the :class:`QuerystringParser` used by Starlette
when handling ``application/x-www-form-urlencoded`` data and a minimal
``parse_options_header`` function. The implementation is intentionally simple
but adequate for the unit tests.
"""

from __future__ import annotations

from typing import Callable, Dict, Tuple


def parse_options_header(value: str) -> Tuple[bytes, Dict[str, str]]:
    """Parse a Content-Type style header into its value and parameters."""
    if not value:
        return b"", {}
    parts = [p.strip() for p in value.split(";")]
    main_value = parts[0]
    params: Dict[str, str] = {}
    for item in parts[1:]:
        if "=" in item:
            k, v = item.split("=", 1)
            v = v.strip().strip('"')
            params[k.strip()] = v
    return main_value.encode(), params


class QuerystringParser:
    """Very small parser for URL encoded form bodies.

    The real package supports incremental parsing with callbacks. This stripped
    down version buffers the entire body then invokes the callbacks for each
    field when ``finalize`` is called.
    """

    def __init__(self, callbacks: Dict[str, Callable]):
        self.callbacks = callbacks
        self.buffer = bytearray()

    def write(self, data: bytes) -> None:  # pragma: no cover - trivial
        self.buffer.extend(data)

    def finalize(self) -> None:
        body = self.buffer.decode()
        first = True
        for pair in body.split("&") if body else []:
            if first:
                first = False
            self.callbacks.get("on_field_start", lambda: None)()
            if "=" in pair:
                name, value = pair.split("=", 1)
            else:
                name, value = pair, ""
            cb_name = self.callbacks.get("on_field_name")
            if cb_name:
                b = name.encode()
                cb_name(b, 0, len(b))
            cb_data = self.callbacks.get("on_field_data")
            if cb_data:
                b = value.encode()
                cb_data(b, 0, len(b))
            if self.callbacks.get("on_field_end"):
                self.callbacks["on_field_end"]()
        if self.callbacks.get("on_end"):
            self.callbacks["on_end"]()

