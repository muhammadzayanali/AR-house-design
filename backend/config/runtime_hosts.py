"""Host and CORS resolution that does not depend on DEBUG being true."""

from __future__ import annotations


def resolve_hosts(debug: bool, allowed_hosts: str, cors_origins: str) -> dict:
    hosts = [part.strip() for part in (allowed_hosts or "").split(",") if part.strip()]
    origins = [part.strip() for part in (cors_origins or "").split(",") if part.strip()]
    if debug:
        for extra in ("0.0.0.0", "*"):
            if extra not in hosts:
                hosts.append(extra)
        return {"hosts": hosts, "cors_allow_all": True, "cors_origins": []}
    return {"hosts": hosts, "cors_allow_all": False, "cors_origins": origins}
