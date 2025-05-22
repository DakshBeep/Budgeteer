"""Minimal stub of the ``python-multipart`` package used for tests.

Only the small subset of functionality required by Starlette's form parsing is
implemented. This is sufficient for the application's form based authentication
endpoints without requiring the real dependency which is unavailable in the
testing environment.
"""

from .multipart import parse_options_header, QuerystringParser

__version__ = "0.0"

__all__ = ["parse_options_header", "QuerystringParser", "__version__"]

