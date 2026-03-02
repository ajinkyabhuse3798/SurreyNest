"""Shared rate limiter singleton.

Imported by both main.py (to attach to app state) and by routers
(to decorate endpoints). Lives in its own module to avoid circular imports
between main.py and the router modules.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
