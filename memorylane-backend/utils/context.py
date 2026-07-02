from contextvars import ContextVar

# ContextVar to store the base URL of the active HTTP request (e.g., "https://api.memorylaneapps.in/")
request_base_url: ContextVar[str] = ContextVar("request_base_url", default="")
