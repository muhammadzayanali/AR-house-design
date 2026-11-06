import logging
import time

logger = logging.getLogger("plotline.api")


class ApiRequestLogMiddleware:
    """Log each /api call so a phone or tunnel failure can be traced.

    Bodies, tokens, and passwords are not written. Status and a short
    error detail are enough to see whether Django handled the request.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path or ""
        if not path.startswith("/api/"):
            return self.get_response(request)

        started = time.perf_counter()
        try:
            response = self.get_response(request)
        except Exception:
            elapsed = (time.perf_counter() - started) * 1000
            logger.exception("api FAIL %s %s after %.0fms", request.method, path, elapsed)
            raise

        elapsed = (time.perf_counter() - started) * 1000
        detail = ""
        if response.status_code >= 400:
            payload = getattr(response, "data", None)
            if isinstance(payload, dict):
                raw = payload.get("error") or payload.get("detail") or ""
                detail = " " + str(raw).replace("\n", " ")[:180]
        user = getattr(request, "user", None)
        who = getattr(user, "username", "") if getattr(user, "is_authenticated", False) else "-"
        level = logging.WARNING if response.status_code >= 400 else logging.INFO
        logger.log(
            level,
            "api %s %s -> %s %.0fms user=%s%s",
            request.method,
            path,
            response.status_code,
            elapsed,
            who,
            detail,
        )
        return response
