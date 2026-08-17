#!/usr/bin/env python3
"""Standalone ChatMock gateway with a minimal protected usage dashboard.

This file embeds the ChatMock Python source from RayBytes/ChatMock commit
ba85f8db5e2fb06a18a3c9f2f0a71d3ab81485ef (ChatMock 1.40). It does not use
Docker and does not download or execute source code at runtime.

Runtime requirements (Python 3.11+):
    pip install blinker==1.9.0 certifi==2025.8.3 flask==3.1.1 \
        flask-sock==0.7.0 requests==2.32.5 websockets==15.0.1

Keep CHATGPT_LOCAL_HOME, GATEWAY_STATE_DIR, GATEWAY_ADMIN_TOKEN, and
GATEWAY_SESSION_SECRET outside this file. Client access uses keys issued by
the dashboard; the raw key is shown once and is never stored.

Embedded ChatMock source license:
MIT License

Copyright (c) 2025 Game_Time

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
"""

from __future__ import annotations

import argparse
import base64
import contextvars
from datetime import datetime, timezone
import hashlib
import hmac
import importlib.abc
import importlib.util
import json
import os
import secrets
import sqlite3
import sys
import threading
import time
from urllib.parse import parse_qs, urlencode, urlparse
from pathlib import Path
from typing import Any

from flask import Flask, Response, g, jsonify, redirect, render_template_string, request, session
import requests


CHATMOCK_SOURCE_COMMIT = "ba85f8db5e2fb06a18a3c9f2f0a71d3ab81485ef"
EMBEDDED_CHATMOCK_SOURCES: dict[str, str] = {'chatmock': 'from __future__ import annotations\n\nfrom .app import create_app\nfrom .cli import main\nfrom .version import __version__\n', 'chatmock.app': 'from __future__ import annotations\n\nimport os\n\nfrom flask import Flask, jsonify\nfrom flask_sock import Sock\n\nfrom .http import build_cors_headers\nfrom .model_catalog import DEFAULT_REFRESH_INTERVAL_SECONDS, ModelCatalog\nfrom .routes_openai import openai_bp\nfrom .routes_ollama import ollama_bp\nfrom .websocket_routes import register_websocket_routes\n\n\ndef create_app(\n    verbose: bool = False,\n    verbose_obfuscation: bool = False,\n    reasoning_effort: str = "medium",\n    reasoning_summary: str = "auto",\n    reasoning_compat: str = "think-tags",\n    fast_mode: bool = False,\n    debug_model: str | None = None,\n    expose_reasoning_models: bool = False,\n    default_web_search: bool = False,\n    model_sync: bool | None = None,\n    model_refresh_interval: float | None = None,\n) -> Flask:\n    app = Flask(__name__)\n    if model_sync is None:\n        model_sync = (os.getenv("CHATGPT_LOCAL_MODEL_SYNC") or "true").strip().lower() in (\n            "1",\n            "true",\n            "yes",\n            "on",\n        )\n    if model_refresh_interval is None:\n        try:\n            model_refresh_interval = float(\n                os.getenv("CHATGPT_LOCAL_MODEL_REFRESH_INTERVAL", DEFAULT_REFRESH_INTERVAL_SECONDS)\n            )\n        except (TypeError, ValueError):\n            model_refresh_interval = DEFAULT_REFRESH_INTERVAL_SECONDS\n\n    app.config.update(\n        VERBOSE=bool(verbose),\n        VERBOSE_OBFUSCATION=bool(verbose_obfuscation),\n        REASONING_EFFORT=reasoning_effort,\n        REASONING_SUMMARY=reasoning_summary,\n        REASONING_COMPAT=reasoning_compat,\n        FAST_MODE=bool(fast_mode),\n        DEBUG_MODEL=debug_model,\n        EXPOSE_REASONING_MODELS=bool(expose_reasoning_models),\n        DEFAULT_WEB_SEARCH=bool(default_web_search),\n        MODEL_SYNC=bool(model_sync),\n        MODEL_REFRESH_INTERVAL=float(model_refresh_interval),\n    )\n    app.extensions["chatmock_model_catalog"] = ModelCatalog(\n        enabled=bool(model_sync),\n        refresh_interval_seconds=float(model_refresh_interval),\n    )\n\n    @app.get("/")\n    @app.get("/health")\n    def health():\n        return jsonify({"status": "ok"})\n\n    @app.after_request\n    def _cors(resp):\n        for k, v in build_cors_headers().items():\n            resp.headers.setdefault(k, v)\n        return resp\n\n    app.register_blueprint(openai_bp)\n    app.register_blueprint(ollama_bp)\n    sock = Sock(app)\n    register_websocket_routes(sock)\n\n    return app\n', 'chatmock.cli': 'from __future__ import annotations\n\nimport errno\nimport argparse\nimport json\nimport os\nimport sys\nimport webbrowser\nfrom datetime import datetime\n\nfrom .app import create_app\nfrom .config import CLIENT_ID_DEFAULT\nfrom .limits import RateLimitWindow, compute_reset_at, load_rate_limit_snapshot\nfrom .oauth import OAuthHTTPServer, OAuthHandler, REQUIRED_PORT, URL_BASE, run_device_code_login\nfrom .utils import eprint, get_home_dir, load_chatgpt_tokens, parse_jwt_claims, read_auth_file\n\n\n_STATUS_LIMIT_BAR_SEGMENTS = 30\n_STATUS_LIMIT_BAR_FILLED = "█"\n_STATUS_LIMIT_BAR_EMPTY = "░"\n_STATUS_LIMIT_BAR_PARTIAL = "▓"\n\n\ndef _float_env(name: str, default: float) -> float:\n    try:\n        return float(os.getenv(name, str(default)))\n    except (TypeError, ValueError):\n        return default\n\n\ndef _clamp_percent(value: float) -> float:\n    try:\n        percent = float(value)\n    except Exception:\n        return 0.0\n    if percent != percent:\n        return 0.0\n    if percent < 0.0:\n        return 0.0\n    if percent > 100.0:\n        return 100.0\n    return percent\n\n\ndef _render_progress_bar(percent_used: float) -> str:\n    ratio = max(0.0, min(1.0, percent_used / 100.0))\n    filled_exact = ratio * _STATUS_LIMIT_BAR_SEGMENTS\n    filled = int(filled_exact)\n    partial = filled_exact - filled\n    \n    has_partial = partial > 0.5\n    if has_partial:\n        filled += 1\n    \n    filled = max(0, min(_STATUS_LIMIT_BAR_SEGMENTS, filled))\n    empty = _STATUS_LIMIT_BAR_SEGMENTS - filled\n    \n    if has_partial and filled > 0:\n        bar = _STATUS_LIMIT_BAR_FILLED * (filled - 1) + _STATUS_LIMIT_BAR_PARTIAL + _STATUS_LIMIT_BAR_EMPTY * empty\n    else:\n        bar = _STATUS_LIMIT_BAR_FILLED * filled + _STATUS_LIMIT_BAR_EMPTY * empty\n    \n    return f"[{bar}]"\n\n\ndef _get_usage_color(percent_used: float) -> str:\n    if percent_used >= 90:\n        return "\\033[91m" \n    elif percent_used >= 75:\n        return "\\033[93m"  \n    elif percent_used >= 50:\n        return "\\033[94m"  \n    else:\n        return "\\033[92m" \n\n\ndef _reset_color() -> str:\n    """ANSI reset color code"""\n    return "\\033[0m"\n\n\ndef _format_window_duration(minutes: int | None) -> str | None:\n    if minutes is None:\n        return None\n    try:\n        total = int(minutes)\n    except Exception:\n        return None\n    if total <= 0:\n        return None\n    minutes = total\n    weeks, remainder = divmod(minutes, 7 * 24 * 60)\n    days, remainder = divmod(remainder, 24 * 60)\n    hours, remainder = divmod(remainder, 60)\n    parts = []\n    if weeks:\n        parts.append(f"{weeks} week" + ("s" if weeks != 1 else ""))\n    if days:\n        parts.append(f"{days} day" + ("s" if days != 1 else ""))\n    if hours:\n        parts.append(f"{hours} hour" + ("s" if hours != 1 else ""))\n    if remainder:\n        parts.append(f"{remainder} minute" + ("s" if remainder != 1 else ""))\n    if not parts:\n        parts.append(f"{minutes} minute" + ("s" if minutes != 1 else ""))\n    return " ".join(parts)\n\n\ndef _format_reset_duration(seconds: int | None) -> str | None:\n    if seconds is None:\n        return None\n    try:\n        value = int(seconds)\n    except Exception:\n        return None\n    if value < 0:\n        value = 0\n    days, remainder = divmod(value, 86400)\n    hours, remainder = divmod(remainder, 3600)\n    minutes, remainder = divmod(remainder, 60)\n    parts: list[str] = []\n    if days:\n        parts.append(f"{days}d")\n    if hours:\n        parts.append(f"{hours}h")\n    if minutes:\n        parts.append(f"{minutes}m")\n    if not parts and remainder:\n        parts.append("under 1m")\n    if not parts:\n        parts.append("0m")\n    return " ".join(parts)\n\n\ndef _format_local_datetime(dt: datetime) -> str:\n    local = dt.astimezone()\n    tz_name = local.tzname() or "local"\n    return f"{local.strftime(\'%b %d, %Y %H:%M\')} {tz_name}"\n\n\ndef _print_usage_limits_block() -> None:\n    stored = load_rate_limit_snapshot()\n    \n    print("📊 Usage Limits")\n    \n    if stored is None:\n        print("  No usage data available yet. Send a request through ChatMock first.")\n        print()\n        return\n\n    update_time = _format_local_datetime(stored.captured_at)\n    print(f"Last updated: {update_time}")\n    print()\n\n    windows: list[tuple[str, str, RateLimitWindow]] = []\n    if stored.snapshot.primary is not None:\n        windows.append(("⚡", "5 hour limit", stored.snapshot.primary))\n    if stored.snapshot.secondary is not None:\n        windows.append(("📅", "Weekly limit", stored.snapshot.secondary))\n\n    if not windows:\n        print("  Usage data was captured but no limit windows were provided.")\n        print()\n        return\n\n    for i, (icon_label, desc, window) in enumerate(windows):\n        if i > 0:\n            print()\n        \n        percent_used = _clamp_percent(window.used_percent)\n        remaining = max(0.0, 100.0 - percent_used)\n        color = _get_usage_color(percent_used)\n        reset = _reset_color()\n        \n        progress = _render_progress_bar(percent_used)\n        usage_text = f"{percent_used:5.1f}% used"\n        remaining_text = f"{remaining:5.1f}% left"\n        \n        print(f"{icon_label} {desc}")\n        print(f"{color}{progress}{reset} {color}{usage_text}{reset} | {remaining_text}")\n        \n        reset_in = _format_reset_duration(window.resets_in_seconds)\n        reset_at = compute_reset_at(stored.captured_at, window)\n        \n        if reset_in and reset_at:\n            reset_at_str = _format_local_datetime(reset_at)\n            print(f"    ⏳ Resets in: {reset_in} at {reset_at_str}")\n        elif reset_in:\n            print(f"    ⏳ Resets in: {reset_in}")\n        elif reset_at:\n            reset_at_str = _format_local_datetime(reset_at)\n            print(f"    ⏳ Resets at: {reset_at_str}")\n\n    print()\n\ndef cmd_login(no_browser: bool, verbose: bool, headless: bool = False) -> int:\n    home_dir = get_home_dir()\n    client_id = CLIENT_ID_DEFAULT\n    if not client_id:\n        eprint("ERROR: No OAuth client id configured. Set CHATGPT_LOCAL_CLIENT_ID.")\n        return 1\n    if headless:\n        return 0 if run_device_code_login(client_id, verbose=verbose) else 1\n\n    try:\n        bind_host = os.getenv("CHATGPT_LOCAL_LOGIN_BIND", "127.0.0.1")\n        httpd = OAuthHTTPServer((bind_host, REQUIRED_PORT), OAuthHandler, home_dir=home_dir, client_id=client_id, verbose=verbose)\n    except OSError as e:\n        eprint(f"ERROR: {e}")\n        if e.errno == errno.EADDRINUSE:\n            return 13\n        return 1\n\n    auth_url = httpd.auth_url()\n    with httpd:\n        eprint(f"Starting local login server on {URL_BASE}")\n        if not no_browser:\n            try:\n                webbrowser.open(auth_url, new=1, autoraise=True)\n            except Exception as e:\n                eprint(f"Failed to open browser: {e}")\n        eprint(f"If your browser did not open, navigate to:\\n{auth_url}")\n        eprint("For headless or remote login, use: chatmock login --headless")\n        try:\n            httpd.serve_forever()\n        except KeyboardInterrupt:\n            eprint("\\nKeyboard interrupt received, exiting.")\n        return httpd.exit_code\n\n\ndef cmd_serve(\n    host: str,\n    port: int,\n    verbose: bool,\n    verbose_obfuscation: bool,\n    reasoning_effort: str,\n    reasoning_summary: str,\n    reasoning_compat: str,\n    fast_mode: bool,\n    debug_model: str | None,\n    expose_reasoning_models: bool,\n    default_web_search: bool,\n    model_sync: bool = True,\n    model_refresh_interval: float = 3600,\n) -> int:\n    app = create_app(\n        verbose=verbose,\n        verbose_obfuscation=verbose_obfuscation,\n        reasoning_effort=reasoning_effort,\n        reasoning_summary=reasoning_summary,\n        reasoning_compat=reasoning_compat,\n        fast_mode=fast_mode,\n        debug_model=debug_model,\n        expose_reasoning_models=expose_reasoning_models,\n        default_web_search=default_web_search,\n        model_sync=model_sync,\n        model_refresh_interval=model_refresh_interval,\n    )\n\n    app.run(host=host, use_reloader=False, port=port, threaded=True)\n    return 0\n\n\ndef main() -> None:\n    parser = argparse.ArgumentParser(description="ChatMock: login & OpenAI-compatible proxy")\n    sub = parser.add_subparsers(dest="command", required=True)\n\n    p_login = sub.add_parser("login", help="Authorize with ChatGPT and store tokens")\n    p_login.add_argument("--no-browser", action="store_true", help="Do not open the browser automatically")\n    p_login.add_argument("--headless", action="store_true", help="Use device-code login instead of localhost browser callback")\n    p_login.add_argument("--verbose", action="store_true", help="Enable verbose logging")\n\n    p_serve = sub.add_parser("serve", help="Run local OpenAI-compatible server")\n    p_serve.add_argument("--host", default="127.0.0.1")\n    p_serve.add_argument("--port", type=int, default=8000)\n    p_serve.add_argument("--verbose", action="store_true", help="Enable verbose logging")\n    p_serve.add_argument(\n        "--verbose-obfuscation",\n        action="store_true",\n        help="Also dump raw SSE/obfuscation events (in addition to --verbose request/response logs).",\n    )\n    p_serve.add_argument(\n        "--debug-model",\n        dest="debug_model",\n        default=os.getenv("CHATGPT_LOCAL_DEBUG_MODEL"),\n        help="Forcibly override requested \'model\' with this value",\n    )\n    p_serve.add_argument(\n        "--fast-mode",\n        action=argparse.BooleanOptionalAction,\n        default=(os.getenv("CHATGPT_LOCAL_FAST_MODE") or "").strip().lower() in ("1", "true", "yes", "on"),\n        help="Enable GPT fast mode by default for supported models; request-level overrides still take precedence.",\n    )\n    p_serve.add_argument(\n        "--reasoning-effort",\n        choices=["none", "minimal", "low", "medium", "high", "xhigh", "max", "ultra"],\n        default=os.getenv("CHATGPT_LOCAL_REASONING_EFFORT", "medium").lower(),\n        help="Reasoning effort level for Responses API (default: medium)",\n    )\n    p_serve.add_argument(\n        "--reasoning-summary",\n        choices=["auto", "concise", "detailed", "none"],\n        default=os.getenv("CHATGPT_LOCAL_REASONING_SUMMARY", "auto").lower(),\n        help="Reasoning summary verbosity (default: auto)",\n    )\n    p_serve.add_argument(\n        "--reasoning-compat",\n        choices=["legacy", "o3", "think-tags", "current"],\n        default=os.getenv("CHATGPT_LOCAL_REASONING_COMPAT", "think-tags").lower(),\n        help=(\n            "Compatibility mode for exposing reasoning to clients (legacy|o3|think-tags). "\n            "\'current\' is accepted as an alias for \'legacy\'"\n        ),\n    )\n    p_serve.add_argument(\n        "--expose-reasoning-models",\n        action="store_true",\n        default=(os.getenv("CHATGPT_LOCAL_EXPOSE_REASONING_MODELS") or "").strip().lower() in ("1", "true", "yes", "on"),\n        help=(\n            "Expose reasoning effort variants reported by each model "\n            "as separate models from /v1/models. This allows choosing effort via model selection in compatible UIs."\n        ),\n    )\n    p_serve.add_argument(\n        "--enable-web-search",\n        action=argparse.BooleanOptionalAction,\n        default=(os.getenv("CHATGPT_LOCAL_ENABLE_WEB_SEARCH") or "").strip().lower() in ("1", "true", "yes", "on"),\n        help=(\n            "Enable default web_search tool when a request omits responses_tools (off by default). "\n            "Also configurable via CHATGPT_LOCAL_ENABLE_WEB_SEARCH."\n        ),\n    )\n    p_serve.add_argument(\n        "--model-sync",\n        action=argparse.BooleanOptionalAction,\n        default=(os.getenv("CHATGPT_LOCAL_MODEL_SYNC") or "true").strip().lower()\n        in ("1", "true", "yes", "on"),\n        help="Discover available models and capabilities from ChatGPT automatically.",\n    )\n    p_serve.add_argument(\n        "--model-refresh-interval",\n        type=float,\n        default=_float_env("CHATGPT_LOCAL_MODEL_REFRESH_INTERVAL", 3600),\n        metavar="SECONDS",\n        help="Refresh the ChatGPT model catalog after this many seconds (default: 3600).",\n    )\n\n    p_info = sub.add_parser("info", help="Print current stored tokens and derived account id")\n    p_info.add_argument("--json", action="store_true", help="Output raw auth.json contents")\n\n    args = parser.parse_args()\n\n    if args.command == "login":\n        sys.exit(cmd_login(no_browser=args.no_browser, verbose=args.verbose, headless=args.headless))\n    elif args.command == "serve":\n        sys.exit(\n            cmd_serve(\n                host=args.host,\n                port=args.port,\n                verbose=args.verbose,\n                verbose_obfuscation=args.verbose_obfuscation,\n                reasoning_effort=args.reasoning_effort,\n                reasoning_summary=args.reasoning_summary,\n                reasoning_compat=args.reasoning_compat,\n                fast_mode=args.fast_mode,\n                debug_model=args.debug_model,\n                expose_reasoning_models=args.expose_reasoning_models,\n                default_web_search=args.enable_web_search,\n                model_sync=args.model_sync,\n                model_refresh_interval=args.model_refresh_interval,\n            )\n        )\n    elif args.command == "info":\n        auth = read_auth_file()\n        if getattr(args, "json", False):\n            print(json.dumps(auth or {}, indent=2))\n            sys.exit(0)\n        access_token, account_id, id_token = load_chatgpt_tokens()\n        if not access_token or not id_token:\n            print("👤 Account")\n            print("  • Not signed in")\n            print("  • Run: python3 chatmock.py login")\n            print("")\n            _print_usage_limits_block()\n            sys.exit(0)\n\n        id_claims = parse_jwt_claims(id_token) or {}\n        access_claims = parse_jwt_claims(access_token) or {}\n\n        email = id_claims.get("email") or id_claims.get("preferred_username") or "<unknown>"\n        plan_raw = (access_claims.get("https://api.openai.com/auth") or {}).get("chatgpt_plan_type") or "unknown"\n        plan_map = {\n            "plus": "Plus",\n            "pro": "Pro",\n            "free": "Free",\n            "team": "Team",\n            "enterprise": "Enterprise",\n        }\n        plan = plan_map.get(str(plan_raw).lower(), str(plan_raw).title() if isinstance(plan_raw, str) else "Unknown")\n\n        print("👤 Account")\n        print("  • Signed in with ChatGPT")\n        print(f"  • Login: {email}")\n        print(f"  • Plan: {plan}")\n        if account_id:\n            print(f"  • Account ID: {account_id}")\n        print("")\n        _print_usage_limits_block()\n        sys.exit(0)\n    else:\n        parser.error("Unknown command")\n\n\nif __name__ == "__main__":\n    main()\n', 'chatmock.config': 'from __future__ import annotations\n\nimport os\n\n\nCLIENT_ID_DEFAULT = os.getenv("CHATGPT_LOCAL_CLIENT_ID") or "app_EMoamEEZ73f0CkXaXp7hrann"\nOAUTH_ISSUER_DEFAULT = os.getenv("CHATGPT_LOCAL_ISSUER") or "https://auth.openai.com"\nOAUTH_TOKEN_URL = f"{OAUTH_ISSUER_DEFAULT}/oauth/token"\nORIGINATOR = "chatmock"\n\nCHATGPT_CODEX_BASE_URL = "https://chatgpt.com/backend-api/codex"\nCHATGPT_RESPONSES_URL = f"{CHATGPT_CODEX_BASE_URL}/responses"\n', 'chatmock.fast_mode': 'from __future__ import annotations\n\nfrom dataclasses import dataclass\nfrom typing import Any\n\nfrom .model_registry import model_supports_service_tier, normalize_model_name\n\n\nPRIORITY_SUPPORTED_MODELS = frozenset(\n    (\n        "gpt-5.4",\n        "gpt-5.6-sol",\n        "gpt-5.6-terra",\n        "gpt-5.6-luna",\n        "gpt-5.2",\n        "gpt-5.1",\n        "gpt-5",\n        "gpt-5.1-codex",\n        "gpt-5-codex",\n    )\n)\n\n_TRUE_STRINGS = {"1", "true", "yes", "on"}\n_FALSE_STRINGS = {"0", "false", "no", "off"}\n\n\ndef parse_optional_bool(value: Any) -> bool | None:\n    if isinstance(value, bool):\n        return value\n    if isinstance(value, str):\n        normalized = value.strip().lower()\n        if normalized in _TRUE_STRINGS:\n            return True\n        if normalized in _FALSE_STRINGS:\n            return False\n    return None\n\n\ndef supports_priority_service_tier(model: str | None) -> bool:\n    catalog_support = model_supports_service_tier(model, "priority")\n    if catalog_support is not None:\n        return catalog_support\n    return normalize_model_name(model) in PRIORITY_SUPPORTED_MODELS\n\n\n@dataclass(frozen=True)\nclass ServiceTierResolution:\n    service_tier: str | None\n    error_message: str | None = None\n    warning_message: str | None = None\n    used_server_default: bool = False\n\n\ndef resolve_service_tier(\n    model: str | None,\n    *,\n    request_fast_mode: Any = None,\n    request_service_tier: Any = None,\n    server_fast_mode: bool = False,\n) -> ServiceTierResolution:\n    explicit_fast_mode = parse_optional_bool(request_fast_mode)\n\n    tier: str | None = None\n    explicit_request = False\n    used_server_default = False\n\n    if explicit_fast_mode is not None:\n        tier = "priority" if explicit_fast_mode else None\n        explicit_request = True\n    elif isinstance(request_service_tier, str) and request_service_tier.strip():\n        tier = request_service_tier.strip().lower()\n        explicit_request = True\n    elif server_fast_mode:\n        tier = "priority"\n        used_server_default = True\n\n    if tier == "priority" and not supports_priority_service_tier(model):\n        normalized = normalize_model_name(model)\n        message = (\n            f"Fast mode is not supported for model \'{normalized}\'. "\n            "Use a supported GPT-5 priority-processing model or disable fast mode for this request."\n        )\n        if explicit_request:\n            return ServiceTierResolution(\n                service_tier=None,\n                error_message=message,\n                used_server_default=used_server_default,\n            )\n        return ServiceTierResolution(\n            service_tier=None,\n            warning_message=message,\n            used_server_default=used_server_default,\n        )\n\n    return ServiceTierResolution(\n        service_tier=tier,\n        used_server_default=used_server_default,\n    )\n', 'chatmock.http': 'from __future__ import annotations\n\nfrom flask import Response, jsonify, request\n\n\ndef build_cors_headers() -> dict:\n    origin = request.headers.get("Origin", "*")\n    req_headers = request.headers.get("Access-Control-Request-Headers")\n    allow_headers = req_headers if req_headers else "Authorization, Content-Type, Accept"\n    return {\n        "Access-Control-Allow-Origin": origin,\n        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",\n        "Access-Control-Allow-Headers": allow_headers,\n        "Access-Control-Max-Age": "86400",\n    }\n\n\ndef json_error(message: str, status: int = 400) -> Response:\n    resp = jsonify({"error": {"message": message}})\n    response: Response = Response(response=resp.response, status=status, mimetype="application/json")\n    for k, v in build_cors_headers().items():\n        response.headers.setdefault(k, v)\n    return response\n\n', 'chatmock.limits': 'from __future__ import annotations\n\nimport json\nimport os\nfrom dataclasses import dataclass\nfrom datetime import datetime, timedelta, timezone\nfrom typing import Any, Mapping, Optional\n\nfrom .utils import get_home_dir\n\n_PRIMARY_USED = "x-codex-primary-used-percent"\n_PRIMARY_WINDOW = "x-codex-primary-window-minutes"\n_PRIMARY_RESET = "x-codex-primary-reset-after-seconds"\n_SECONDARY_USED = "x-codex-secondary-used-percent"\n_SECONDARY_WINDOW = "x-codex-secondary-window-minutes"\n_SECONDARY_RESET = "x-codex-secondary-reset-after-seconds"\n\n_LIMITS_FILENAME = "usage_limits.json"\n\n\n@dataclass\nclass RateLimitWindow:\n    used_percent: float\n    window_minutes: Optional[int]\n    resets_in_seconds: Optional[int]\n\n\n@dataclass\nclass RateLimitSnapshot:\n    primary: Optional[RateLimitWindow]\n    secondary: Optional[RateLimitWindow]\n\n\n@dataclass\nclass StoredRateLimitSnapshot:\n    captured_at: datetime\n    snapshot: RateLimitSnapshot\n\n\ndef _parse_float(value: Any) -> Optional[float]:\n    try:\n        if value is None:\n            return None\n        if isinstance(value, (int, float)):\n            return float(value)\n        value_str = str(value).strip()\n        if not value_str:\n            return None\n        parsed = float(value_str)\n        if not (parsed == parsed and parsed not in (float("inf"), float("-inf"))):\n            return None\n        return parsed\n    except Exception:\n        return None\n\n\ndef _parse_int(value: Any) -> Optional[int]:\n    try:\n        if value is None:\n            return None\n        if isinstance(value, bool):\n            return None\n        if isinstance(value, int):\n            return value\n        value_str = str(value).strip()\n        if not value_str:\n            return None\n        return int(value_str)\n    except Exception:\n        return None\n\n\ndef _parse_window(headers: Mapping[str, Any], used_key: str, window_key: str, reset_key: str) -> Optional[RateLimitWindow]:\n    used_percent = _parse_float(headers.get(used_key))\n    if used_percent is None:\n        return None\n    window_minutes = _parse_int(headers.get(window_key))\n    resets_in_seconds = _parse_int(headers.get(reset_key))\n    return RateLimitWindow(used_percent=used_percent, window_minutes=window_minutes, resets_in_seconds=resets_in_seconds)\n\n\ndef parse_rate_limit_headers(headers: Mapping[str, Any]) -> Optional[RateLimitSnapshot]:\n    try:\n        primary = _parse_window(headers, _PRIMARY_USED, _PRIMARY_WINDOW, _PRIMARY_RESET)\n        secondary = _parse_window(headers, _SECONDARY_USED, _SECONDARY_WINDOW, _SECONDARY_RESET)\n        if primary is None and secondary is None:\n            return None\n        return RateLimitSnapshot(primary=primary, secondary=secondary)\n    except Exception:\n        return None\n\n\ndef _limits_path() -> str:\n    home = get_home_dir()\n    return os.path.join(home, _LIMITS_FILENAME)\n\n\ndef store_rate_limit_snapshot(snapshot: RateLimitSnapshot, captured_at: Optional[datetime] = None) -> None:\n    captured = captured_at or datetime.now(timezone.utc)\n    try:\n        home = get_home_dir()\n        os.makedirs(home, exist_ok=True)\n        payload: dict[str, Any] = {\n            "captured_at": captured.isoformat(),\n        }\n        if snapshot.primary:\n            payload["primary"] = {\n                "used_percent": snapshot.primary.used_percent,\n                "window_minutes": snapshot.primary.window_minutes,\n                "resets_in_seconds": snapshot.primary.resets_in_seconds,\n            }\n        if snapshot.secondary:\n            payload["secondary"] = {\n                "used_percent": snapshot.secondary.used_percent,\n                "window_minutes": snapshot.secondary.window_minutes,\n                "resets_in_seconds": snapshot.secondary.resets_in_seconds,\n            }\n        with open(_limits_path(), "w", encoding="utf-8") as fp:\n            if hasattr(os, "fchmod"):\n                try:\n                    os.fchmod(fp.fileno(), 0o600)\n                except OSError:\n                    pass\n            json.dump(payload, fp, indent=2)\n    except Exception:\n        # Silently ignore persistence errors.\n        pass\n\n\ndef load_rate_limit_snapshot() -> Optional[StoredRateLimitSnapshot]:\n    try:\n        with open(_limits_path(), "r", encoding="utf-8") as fp:\n            raw = json.load(fp)\n    except FileNotFoundError:\n        return None\n    except Exception:\n        return None\n\n    captured_raw = raw.get("captured_at")\n    captured_at = _parse_datetime(captured_raw)\n    if captured_at is None:\n        return None\n\n    snapshot = RateLimitSnapshot(\n        primary=_dict_to_window(raw.get("primary")),\n        secondary=_dict_to_window(raw.get("secondary")),\n    )\n    if snapshot.primary is None and snapshot.secondary is None:\n        return None\n    return StoredRateLimitSnapshot(captured_at=captured_at, snapshot=snapshot)\n\n\ndef _parse_datetime(value: Any) -> Optional[datetime]:\n    if not isinstance(value, str):\n        return None\n    text = value.strip()\n    if not text:\n        return None\n    if text.endswith("Z"):\n        text = text[:-1] + "+00:00"\n    try:\n        dt = datetime.fromisoformat(text)\n        if dt.tzinfo is None:\n            return dt.replace(tzinfo=timezone.utc)\n        return dt\n    except ValueError:\n        return None\n\n\ndef _dict_to_window(value: Any) -> Optional[RateLimitWindow]:\n    if not isinstance(value, dict):\n        return None\n    used = _parse_float(value.get("used_percent"))\n    if used is None:\n        return None\n    window = _parse_int(value.get("window_minutes"))\n    resets = _parse_int(value.get("resets_in_seconds"))\n    return RateLimitWindow(used_percent=used, window_minutes=window, resets_in_seconds=resets)\n\n\ndef record_rate_limits_from_response(response: Any) -> None:\n    if response is None:\n        return\n    headers = getattr(response, "headers", None)\n    if headers is None:\n        return\n    snapshot = parse_rate_limit_headers(headers)\n    if snapshot is None:\n        return\n    store_rate_limit_snapshot(snapshot)\n\n\ndef compute_reset_at(captured_at: datetime, window: RateLimitWindow) -> Optional[datetime]:\n    if window.resets_in_seconds is None:\n        return None\n    try:\n        return captured_at + timedelta(seconds=int(window.resets_in_seconds))\n    except Exception:\n        return None\n\n', 'chatmock.model_catalog': 'from __future__ import annotations\n\nimport datetime\nimport json\nimport os\nimport threading\nimport time\nfrom dataclasses import dataclass\nfrom pathlib import Path\nfrom typing import Any\n\nimport requests\n\nfrom .config import CHATGPT_CODEX_BASE_URL, ORIGINATOR\nfrom .utils import (\n    get_codex_user_agent,\n    get_effective_chatgpt_auth,\n    get_home_dir,\n    read_auth_file,\n    resolve_installation_id,\n)\n\n\nDEFAULT_REFRESH_INTERVAL_SECONDS = 60 * 60\nFAILED_REFRESH_RETRY_SECONDS = 60\nFETCH_TIMEOUT_SECONDS = 5\nMODEL_CACHE_FILE = "chatmock_models_cache.json"\n# Bump only after verifying ChatMock against a newer Codex catalog contract.\nCODEX_MODELS_CLIENT_VERSION = "0.146.0"\n\n\n@dataclass(frozen=True)\nclass CatalogModel:\n    slug: str\n    reasoning_efforts: tuple[str, ...]\n    service_tiers: frozenset[str]\n    priority: int\n    visibility: str\n    supported_in_api: bool\n\n\ndef _now_utc() -> datetime.datetime:\n    return datetime.datetime.now(datetime.timezone.utc)\n\n\ndef _parse_timestamp(value: Any) -> datetime.datetime | None:\n    if not isinstance(value, str) or not value.strip():\n        return None\n    try:\n        parsed = datetime.datetime.fromisoformat(value.replace("Z", "+00:00"))\n    except ValueError:\n        return None\n    if parsed.tzinfo is None:\n        parsed = parsed.replace(tzinfo=datetime.timezone.utc)\n    return parsed.astimezone(datetime.timezone.utc)\n\n\ndef _account_id_from_auth_file() -> str | None:\n    auth = read_auth_file() or {}\n    tokens = auth.get("tokens")\n    if not isinstance(tokens, dict):\n        return None\n    account_id = tokens.get("account_id")\n    return account_id.strip() if isinstance(account_id, str) and account_id.strip() else None\n\n\ndef _parse_models(value: Any) -> tuple[CatalogModel, ...]:\n    if not isinstance(value, list):\n        return ()\n\n    models: list[CatalogModel] = []\n    for item in value:\n        if not isinstance(item, dict):\n            continue\n        slug = item.get("slug")\n        if not isinstance(slug, str) or not slug.strip():\n            continue\n\n        efforts: list[str] = []\n        raw_efforts = item.get("supported_reasoning_levels")\n        if isinstance(raw_efforts, list):\n            for raw_effort in raw_efforts:\n                effort = raw_effort.get("effort") if isinstance(raw_effort, dict) else raw_effort\n                if isinstance(effort, str) and effort.strip() and effort.strip() not in efforts:\n                    efforts.append(effort.strip())\n\n        service_tiers: set[str] = set()\n        raw_tiers = item.get("service_tiers")\n        if isinstance(raw_tiers, list):\n            for raw_tier in raw_tiers:\n                tier = raw_tier.get("id") if isinstance(raw_tier, dict) else raw_tier\n                if isinstance(tier, str) and tier.strip():\n                    service_tiers.add(tier.strip())\n\n        priority = item.get("priority")\n        models.append(\n            CatalogModel(\n                slug=slug.strip(),\n                reasoning_efforts=tuple(efforts),\n                service_tiers=frozenset(service_tiers),\n                priority=priority if isinstance(priority, int) else 1_000_000,\n                visibility=item.get("visibility") if isinstance(item.get("visibility"), str) else "none",\n                supported_in_api=bool(item.get("supported_in_api", False)),\n            )\n        )\n    return tuple(models)\n\n\nclass ModelCatalog:\n    """Account-scoped model metadata with stale-while-revalidate refresh."""\n\n    def __init__(\n        self,\n        *,\n        enabled: bool = True,\n        refresh_interval_seconds: float = DEFAULT_REFRESH_INTERVAL_SECONDS,\n        cache_path: str | os.PathLike[str] | None = None,\n        session: requests.Session | None = None,\n    ) -> None:\n        self.enabled = bool(enabled)\n        self.refresh_interval_seconds = max(float(refresh_interval_seconds), 0.0)\n        self.cache_path = Path(cache_path) if cache_path else Path(get_home_dir()) / MODEL_CACHE_FILE\n        self._session = session or requests.Session()\n        self._lock = threading.Lock()\n        self._models: tuple[CatalogModel, ...] = ()\n        self._raw_models: list[dict[str, Any]] = []\n        self._fetched_at: datetime.datetime | None = None\n        self._etag: str | None = None\n        self._account_id: str | None = None\n        self._refresh_in_progress = False\n        self._refresh_done = threading.Event()\n        self._last_attempt_monotonic: float | None = None\n        if self.enabled:\n            self._load_cache()\n\n    def models(self, *, wait_for_refresh: bool = False) -> tuple[CatalogModel, ...]:\n        self.refresh_if_due(wait_for_refresh=wait_for_refresh)\n        with self._lock:\n            return self._models\n\n    def visible_models(self, *, wait_for_refresh: bool = False) -> tuple[CatalogModel, ...]:\n        models = self.models(wait_for_refresh=wait_for_refresh)\n        return tuple(\n            sorted(\n                (model for model in models if model.visibility == "list"),\n                key=lambda model: model.priority,\n            )\n        )\n\n    def refresh_if_due(self, *, wait_for_refresh: bool = False) -> None:\n        if not self.enabled:\n            return\n\n        refresh_active = False\n        with self._lock:\n            due = self._is_due_locked()\n            event = self._refresh_done\n            if due and not self._refresh_in_progress and self._retry_allowed_locked():\n                self._refresh_in_progress = True\n                self._last_attempt_monotonic = time.monotonic()\n                self._refresh_done = threading.Event()\n                event = self._refresh_done\n                threading.Thread(\n                    target=self._refresh_worker,\n                    name="chatmock-model-catalog-refresh",\n                    daemon=True,\n                ).start()\n                refresh_active = True\n            elif self._refresh_in_progress:\n                event = self._refresh_done\n                refresh_active = True\n\n        if wait_for_refresh and refresh_active:\n            event.wait(FETCH_TIMEOUT_SECONDS + 1)\n\n    def _is_due_locked(self) -> bool:\n        if not self._models or self._fetched_at is None:\n            return True\n        age = (_now_utc() - self._fetched_at).total_seconds()\n        return self.refresh_interval_seconds == 0 or age >= self.refresh_interval_seconds\n\n    def _retry_allowed_locked(self) -> bool:\n        if self._last_attempt_monotonic is None:\n            return True\n        return time.monotonic() - self._last_attempt_monotonic >= FAILED_REFRESH_RETRY_SECONDS\n\n    def _refresh_worker(self) -> None:\n        try:\n            self._fetch_and_apply()\n        except Exception:\n            # Model discovery must never take down or block the proxy. The last\n            # successful catalog remains usable and the next request retries.\n            pass\n        finally:\n            with self._lock:\n                self._refresh_in_progress = False\n                self._refresh_done.set()\n\n    def _fetch_and_apply(self) -> None:\n        access_token, account_id = get_effective_chatgpt_auth()\n        if not access_token or not account_id:\n            return\n\n        response = self._request_models(access_token, account_id)\n        if response.status_code == 401:\n            access_token, account_id = get_effective_chatgpt_auth(force_refresh=True)\n            if not access_token or not account_id:\n                return\n            response = self._request_models(access_token, account_id)\n        response.raise_for_status()\n\n        payload = response.json()\n        raw_models = payload.get("models") if isinstance(payload, dict) else None\n        parsed_models = _parse_models(raw_models)\n        if not parsed_models or not any(model.visibility == "list" for model in parsed_models):\n            return\n\n        fetched_at = _now_utc()\n        etag = response.headers.get("etag")\n        with self._lock:\n            self._models = parsed_models\n            self._raw_models = [dict(item) for item in raw_models if isinstance(item, dict)]\n            self._fetched_at = fetched_at\n            self._etag = etag\n            self._account_id = account_id\n        self._persist_cache()\n\n    def _request_models(self, access_token: str, account_id: str) -> requests.Response:\n        return self._session.get(\n            f"{CHATGPT_CODEX_BASE_URL}/models",\n            params={"client_version": CODEX_MODELS_CLIENT_VERSION},\n            headers={\n                "Authorization": f"Bearer {access_token}",\n                "Accept": "application/json",\n                "ChatGPT-Account-ID": account_id,\n                "User-Agent": get_codex_user_agent(),\n                "originator": ORIGINATOR,\n                "x-codex-installation-id": resolve_installation_id(),\n            },\n            timeout=FETCH_TIMEOUT_SECONDS,\n        )\n\n    def _load_cache(self) -> None:\n        try:\n            with self.cache_path.open("r", encoding="utf-8") as cache_file:\n                payload = json.load(cache_file)\n        except (FileNotFoundError, OSError, ValueError):\n            return\n        if not isinstance(payload, dict):\n            return\n\n        cached_account_id = payload.get("account_id")\n        current_account_id = _account_id_from_auth_file()\n        if (\n            not isinstance(cached_account_id, str)\n            or not current_account_id\n            or cached_account_id != current_account_id\n        ):\n            return\n\n        raw_models = payload.get("models")\n        parsed_models = _parse_models(raw_models)\n        if not parsed_models or not any(model.visibility == "list" for model in parsed_models):\n            return\n        with self._lock:\n            self._models = parsed_models\n            self._raw_models = [dict(item) for item in raw_models if isinstance(item, dict)]\n            self._fetched_at = _parse_timestamp(payload.get("fetched_at"))\n            self._etag = payload.get("etag") if isinstance(payload.get("etag"), str) else None\n            self._account_id = cached_account_id\n\n    def _persist_cache(self) -> None:\n        with self._lock:\n            payload = {\n                "fetched_at": self._fetched_at.isoformat().replace("+00:00", "Z")\n                if self._fetched_at\n                else None,\n                "etag": self._etag,\n                "client_version": CODEX_MODELS_CLIENT_VERSION,\n                "account_id": self._account_id,\n                "models": self._raw_models,\n            }\n        try:\n            self.cache_path.parent.mkdir(parents=True, exist_ok=True)\n            temporary_path = self.cache_path.with_name(\n                f".{self.cache_path.name}.{os.getpid()}.{threading.get_ident()}.tmp"\n            )\n            with temporary_path.open("w", encoding="utf-8") as cache_file:\n                json.dump(payload, cache_file, indent=2)\n            os.replace(temporary_path, self.cache_path)\n        except OSError:\n            return\n\n\ndef current_model_catalog() -> ModelCatalog | None:\n    try:\n        from flask import current_app\n\n        catalog = current_app.extensions.get("chatmock_model_catalog")\n    except RuntimeError:\n        return None\n    return catalog if isinstance(catalog, ModelCatalog) else None\n', 'chatmock.model_registry': 'from __future__ import annotations\n\nfrom dataclasses import dataclass\nfrom typing import Iterable\n\nfrom .model_catalog import CatalogModel, current_model_catalog\n\n\nALL_REASONING_EFFORTS = ("none", "minimal", "low", "medium", "high", "xhigh", "max", "ultra")\nDEFAULT_REASONING_EFFORTS = frozenset(ALL_REASONING_EFFORTS)\n\n\n@dataclass(frozen=True)\nclass ModelSpec:\n    public_id: str\n    upstream_id: str\n    aliases: tuple[str, ...]\n    allowed_efforts: frozenset[str]\n    variant_efforts: tuple[str, ...]\n\n\n_MODEL_SPECS = (\n    ModelSpec(\n        public_id="gpt-5",\n        upstream_id="gpt-5",\n        aliases=("gpt5", "gpt-5-latest"),\n        allowed_efforts=DEFAULT_REASONING_EFFORTS,\n        variant_efforts=("high", "medium", "low", "minimal"),\n    ),\n    ModelSpec(\n        public_id="gpt-5.1",\n        upstream_id="gpt-5.1",\n        aliases=(),\n        allowed_efforts=frozenset(("low", "medium", "high")),\n        variant_efforts=("high", "medium", "low"),\n    ),\n    ModelSpec(\n        public_id="gpt-5.2",\n        upstream_id="gpt-5.2",\n        aliases=("gpt5.2", "gpt-5.2-latest"),\n        allowed_efforts=frozenset(("low", "medium", "high", "xhigh")),\n        variant_efforts=("xhigh", "high", "medium", "low"),\n    ),\n    ModelSpec(\n        public_id="gpt-5.4",\n        upstream_id="gpt-5.4",\n        aliases=("gpt5.4", "gpt-5.4-latest"),\n        allowed_efforts=frozenset(("none", "low", "medium", "high", "xhigh")),\n        variant_efforts=("xhigh", "high", "medium", "low", "none"),\n    ),\n    ModelSpec(\n        public_id="gpt-5.4-mini",\n        upstream_id="gpt-5.4-mini",\n        aliases=("gpt5.4-mini", "gpt-5.4-mini-latest"),\n        allowed_efforts=frozenset(("low", "medium", "high", "xhigh")),\n        variant_efforts=("xhigh", "high", "medium", "low"),\n    ),\n    ModelSpec(\n        public_id="gpt-5.5",\n        upstream_id="gpt-5.5",\n        aliases=("gpt5.5", "gpt-5.5-latest"),\n        allowed_efforts=frozenset(("none", "low", "medium", "high", "xhigh")),\n        variant_efforts=("xhigh", "high", "medium", "low", "none"),\n    ),\n    ModelSpec(\n        public_id="gpt-5.6-sol",\n        upstream_id="gpt-5.6-sol",\n        aliases=("gpt5.6-sol", "gpt-5.6-sol-latest"),\n        allowed_efforts=frozenset(("low", "medium", "high", "xhigh", "max", "ultra")),\n        variant_efforts=("low", "medium", "high", "xhigh", "max", "ultra"),\n    ),\n    ModelSpec(\n        public_id="gpt-5.6-terra",\n        upstream_id="gpt-5.6-terra",\n        aliases=("gpt5.6-terra", "gpt-5.6-terra-latest"),\n        allowed_efforts=frozenset(("low", "medium", "high", "xhigh", "max", "ultra")),\n        variant_efforts=("low", "medium", "high", "xhigh", "max", "ultra"),\n    ),\n    ModelSpec(\n        public_id="gpt-5.6-luna",\n        upstream_id="gpt-5.6-luna",\n        aliases=("gpt5.6-luna", "gpt-5.6-luna-latest"),\n        allowed_efforts=frozenset(("low", "medium", "high", "xhigh", "max")),\n        variant_efforts=("low", "medium", "high", "xhigh", "max"),\n    ),\n    ModelSpec(\n        public_id="gpt-5.3-codex",\n        upstream_id="gpt-5.3-codex",\n        aliases=("gpt5.3-codex", "gpt-5.3-codex-latest"),\n        allowed_efforts=frozenset(("low", "medium", "high", "xhigh")),\n        variant_efforts=("xhigh", "high", "medium", "low"),\n    ),\n    ModelSpec(\n        public_id="gpt-5.3-codex-spark",\n        upstream_id="gpt-5.3-codex-spark",\n        aliases=("gpt5.3-codex-spark", "gpt-5.3-codex-spark-latest"),\n        allowed_efforts=frozenset(("low", "medium", "high", "xhigh")),\n        variant_efforts=("xhigh", "high", "medium", "low"),\n    ),\n    ModelSpec(\n        public_id="gpt-5-codex",\n        upstream_id="gpt-5-codex",\n        aliases=("gpt5-codex", "gpt-5-codex-latest"),\n        allowed_efforts=DEFAULT_REASONING_EFFORTS,\n        variant_efforts=("high", "medium", "low"),\n    ),\n    ModelSpec(\n        public_id="gpt-5.2-codex",\n        upstream_id="gpt-5.2-codex",\n        aliases=("gpt5.2-codex", "gpt-5.2-codex-latest"),\n        allowed_efforts=frozenset(("low", "medium", "high", "xhigh")),\n        variant_efforts=("xhigh", "high", "medium", "low"),\n    ),\n    ModelSpec(\n        public_id="gpt-5.1-codex",\n        upstream_id="gpt-5.1-codex",\n        aliases=(),\n        allowed_efforts=frozenset(("low", "medium", "high")),\n        variant_efforts=("high", "medium", "low"),\n    ),\n    ModelSpec(\n        public_id="gpt-5.1-codex-max",\n        upstream_id="gpt-5.1-codex-max",\n        aliases=(),\n        allowed_efforts=frozenset(("low", "medium", "high", "xhigh")),\n        variant_efforts=("xhigh", "high", "medium", "low"),\n    ),\n    ModelSpec(\n        public_id="gpt-5.1-codex-mini",\n        upstream_id="gpt-5.1-codex-mini",\n        aliases=(),\n        allowed_efforts=frozenset(("low", "medium", "high")),\n        variant_efforts=(),\n    ),\n    ModelSpec(\n        public_id="codex-mini",\n        upstream_id="codex-mini-latest",\n        aliases=("codex", "codex-mini-latest"),\n        allowed_efforts=DEFAULT_REASONING_EFFORTS,\n        variant_efforts=(),\n    ),\n)\n\n_SPECS_BY_UPSTREAM = {spec.upstream_id: spec for spec in _MODEL_SPECS}\n_ALIASES = {}\nfor _spec in _MODEL_SPECS:\n    _ALIASES[_spec.public_id] = _spec.upstream_id\n    for _alias in _spec.aliases:\n        _ALIASES[_alias] = _spec.upstream_id\n\n\ndef _strip_model_name(model: str | None) -> tuple[str, str | None]:\n    if not isinstance(model, str):\n        return "", None\n    value = model.strip().lower()\n    if not value:\n        return "", None\n    if ":" in value:\n        base, maybe_effort = value.rsplit(":", 1)\n        if maybe_effort in DEFAULT_REASONING_EFFORTS:\n            return base, maybe_effort\n    for separator in ("-", "_"):\n        for effort in ALL_REASONING_EFFORTS:\n            suffix = f"{separator}{effort}"\n            if value.endswith(suffix):\n                return value[: -len(suffix)], effort\n    return value, None\n\n\ndef _remote_model_spec(model: CatalogModel) -> ModelSpec:\n    return ModelSpec(\n        public_id=model.slug,\n        upstream_id=model.slug,\n        aliases=(),\n        allowed_efforts=frozenset(model.reasoning_efforts),\n        variant_efforts=model.reasoning_efforts,\n    )\n\n\ndef _remote_models(*, wait_for_refresh: bool = False) -> tuple[CatalogModel, ...]:\n    catalog = current_model_catalog()\n    if catalog is None:\n        return ()\n    return catalog.models(wait_for_refresh=wait_for_refresh)\n\n\ndef _resolve_remote_model(model: str | None) -> tuple[ModelSpec | None, str | None]:\n    if not isinstance(model, str) or not model.strip():\n        return None, None\n    requested = model.strip()\n    remote_models = _remote_models()\n\n    for remote_model in remote_models:\n        if requested == remote_model.slug:\n            return _remote_model_spec(remote_model), None\n\n    for remote_model in remote_models:\n        for effort in remote_model.reasoning_efforts:\n            if requested in (\n                f"{remote_model.slug}-{effort}",\n                f"{remote_model.slug}_{effort}",\n                f"{remote_model.slug}:{effort}",\n            ):\n                return _remote_model_spec(remote_model), effort\n    return None, None\n\n\ndef model_spec_for_name(model: str | None) -> ModelSpec | None:\n    remote_spec, _ = _resolve_remote_model(model)\n    if remote_spec is not None:\n        return remote_spec\n    base, _ = _strip_model_name(model)\n    upstream_id = _ALIASES.get(base)\n    if not upstream_id:\n        return None\n    return _SPECS_BY_UPSTREAM.get(upstream_id)\n\n\ndef normalize_model_name(model: str | None, debug_model: str | None = None) -> str:\n    if isinstance(debug_model, str) and debug_model.strip():\n        return debug_model.strip()\n    spec = model_spec_for_name(model)\n    if spec is not None:\n        return spec.upstream_id\n    if isinstance(model, str) and model.strip():\n        return model.strip()\n    return "gpt-5.4"\n\n\ndef allowed_efforts_for_model(model: str | None) -> frozenset[str]:\n    spec = model_spec_for_name(model)\n    if spec is not None:\n        return spec.allowed_efforts\n    return DEFAULT_REASONING_EFFORTS\n\n\ndef extract_reasoning_from_model_name(model: str | None) -> dict[str, str] | None:\n    remote_spec, remote_effort = _resolve_remote_model(model)\n    if remote_spec is not None:\n        return {"effort": remote_effort} if remote_effort else None\n    base, effort = _strip_model_name(model)\n    if not effort or base not in _ALIASES:\n        return None\n    return {"effort": effort}\n\n\ndef list_public_models(expose_reasoning_models: bool = False) -> list[str]:\n    catalog = current_model_catalog()\n    if catalog is not None:\n        remote_models = catalog.visible_models(wait_for_refresh=True)\n        if remote_models:\n            model_ids: list[str] = []\n            for model in remote_models:\n                model_ids.append(model.slug)\n                if expose_reasoning_models:\n                    model_ids.extend(f"{model.slug}-{effort}" for effort in model.reasoning_efforts)\n            return model_ids\n\n    model_ids: list[str] = []\n    for spec in _MODEL_SPECS:\n        model_ids.append(spec.public_id)\n        if expose_reasoning_models:\n            model_ids.extend(f"{spec.public_id}-{effort}" for effort in spec.variant_efforts)\n    return model_ids\n\n\ndef iter_public_models() -> Iterable[ModelSpec]:\n    return _MODEL_SPECS\n\n\ndef model_supports_service_tier(model: str | None, service_tier: str) -> bool | None:\n    spec, _ = _resolve_remote_model(model)\n    if spec is None:\n        return None\n    for remote_model in _remote_models():\n        if remote_model.slug == spec.upstream_id:\n            return service_tier in remote_model.service_tiers\n    return False\n', 'chatmock.models': 'from __future__ import annotations\n\nfrom dataclasses import dataclass\nfrom typing import Optional\n\n\n@dataclass\nclass TokenData:\n    id_token: str\n    access_token: str\n    refresh_token: str\n    account_id: str\n\n\n@dataclass\nclass AuthBundle:\n    api_key: Optional[str]\n    token_data: TokenData\n    last_refresh: str\n\n\n@dataclass\nclass PkceCodes:\n    code_verifier: str\n    code_challenge: str\n\n', 'chatmock.oauth': 'from __future__ import annotations\n\nimport datetime\nimport ssl\nimport http.server\nimport json\nimport secrets\nimport threading\nimport time\nimport urllib.parse\nimport urllib.request\nfrom typing import Any, Dict, Tuple\n\nimport certifi\nimport requests\n\nfrom .config import OAUTH_ISSUER_DEFAULT, ORIGINATOR\nfrom .models import AuthBundle, PkceCodes, TokenData\nfrom .utils import eprint, generate_pkce, parse_jwt_claims, write_auth_file\n\n\nREQUIRED_PORT = 1455\nURL_BASE = f"http://localhost:{REQUIRED_PORT}"\nDEFAULT_ISSUER = OAUTH_ISSUER_DEFAULT\n\n\nLOGIN_SUCCESS_HTML = """<!DOCTYPE html>\n<html lang=\\"en\\">\n  <head>\n    <meta charset=\\"utf-8\\" />\n    <title>Login successful</title>\n  </head>\n  <body>\n    <div style=\\"max-width: 640px; margin: 80px auto; font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;\\"> \n      <h1>Login successful</h1>\n      <p>You can now close this window and return to the terminal and run <code>python3 chatmock.py serve</code> to start the server.</p>\n    </div>\n  </body>\n  </html>\n"""\n\n_SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())\n\n\ndef _now_iso8601() -> str:\n    return datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")\n\n\ndef _account_id_from_token(id_token: str) -> str:\n    claims = parse_jwt_claims(id_token) or {}\n    auth_claims = claims.get("https://api.openai.com/auth", {})\n    if isinstance(auth_claims, dict):\n        account_id = auth_claims.get("chatgpt_account_id")\n        if isinstance(account_id, str):\n            return account_id\n    return ""\n\n\ndef _bundle_from_token_payload(payload: Dict[str, Any], api_key: str | None = None) -> AuthBundle:\n    id_token = payload.get("id_token", "")\n    access_token = payload.get("access_token", "")\n    refresh_token = payload.get("refresh_token", "")\n    return AuthBundle(\n        api_key=api_key,\n        token_data=TokenData(\n            id_token=id_token,\n            access_token=access_token,\n            refresh_token=refresh_token,\n            account_id=_account_id_from_token(id_token),\n        ),\n        last_refresh=_now_iso8601(),\n    )\n\n\ndef persist_auth_bundle(bundle: AuthBundle) -> bool:\n    auth_json_contents = {\n        "OPENAI_API_KEY": bundle.api_key,\n        "tokens": {\n            "id_token": bundle.token_data.id_token,\n            "access_token": bundle.token_data.access_token,\n            "refresh_token": bundle.token_data.refresh_token,\n            "account_id": bundle.token_data.account_id,\n        },\n        "last_refresh": bundle.last_refresh,\n    }\n    return write_auth_file(auth_json_contents)\n\n\ndef run_device_code_login(client_id: str, *, verbose: bool = False) -> bool:\n    issuer = DEFAULT_ISSUER.rstrip("/")\n    headers = {"Content-Type": "application/json", "User-Agent": f"{ORIGINATOR}/device-login"}\n    try:\n        user_code_resp = requests.post(\n            f"{issuer}/api/accounts/deviceauth/usercode",\n            headers=headers,\n            json={"client_id": client_id},\n            timeout=30,\n        )\n        user_code_resp.raise_for_status()\n        user_code_data = user_code_resp.json()\n    except Exception as exc:\n        eprint(f"ERROR: failed to initiate device login: {exc}")\n        return False\n\n    device_auth_id = user_code_data.get("device_auth_id")\n    user_code = user_code_data.get("user_code") or user_code_data.get("usercode")\n    try:\n        interval = max(int(user_code_data.get("interval") or 5), 1)\n    except Exception:\n        interval = 5\n    if not isinstance(device_auth_id, str) or not isinstance(user_code, str):\n        eprint("ERROR: device login response missing expected fields")\n        return False\n\n    print(f"Open this URL and enter the code:\\n{issuer}/codex/device\\n\\nCode: {user_code}")\n    deadline = time.monotonic() + 15 * 60\n    while time.monotonic() < deadline:\n        time.sleep(interval)\n        try:\n            token_resp = requests.post(\n                f"{issuer}/api/accounts/deviceauth/token",\n                headers=headers,\n                json={"device_auth_id": device_auth_id, "user_code": user_code},\n                timeout=30,\n            )\n        except Exception as exc:\n            if verbose:\n                eprint(f"Device login polling failed: {exc}")\n            continue\n\n        if token_resp.status_code in (403, 404):\n            continue\n        if token_resp.status_code >= 400:\n            eprint(f"ERROR: device login failed with status {token_resp.status_code}")\n            return False\n\n        try:\n            data = token_resp.json()\n        except Exception as exc:\n            eprint(f"ERROR: unable to parse device login response: {exc}")\n            return False\n        authorization_code = data.get("authorization_code")\n        code_verifier = data.get("code_verifier")\n        if not isinstance(authorization_code, str) or not isinstance(code_verifier, str):\n            eprint("ERROR: device login token response missing expected fields")\n            return False\n\n        try:\n            exchange_resp = requests.post(\n                f"{issuer}/oauth/token",\n                headers={"Content-Type": "application/x-www-form-urlencoded"},\n                data={\n                    "grant_type": "authorization_code",\n                    "code": authorization_code,\n                    "redirect_uri": f"{issuer}/deviceauth/callback",\n                    "client_id": client_id,\n                    "code_verifier": code_verifier,\n                },\n                timeout=30,\n            )\n        except Exception as exc:\n            eprint(f"ERROR: device login token exchange failed: {exc}")\n            return False\n        if exchange_resp.status_code >= 400:\n            eprint(f"ERROR: device login token exchange failed with status {exchange_resp.status_code}")\n            return False\n        try:\n            token_payload = exchange_resp.json()\n        except Exception as exc:\n            eprint(f"ERROR: unable to parse device login token exchange response: {exc}")\n            return False\n        if persist_auth_bundle(_bundle_from_token_payload(token_payload)):\n            eprint("Login successful. Tokens saved.")\n            return True\n        eprint("ERROR: Unable to persist auth file.")\n        return False\n\n    eprint("ERROR: device login timed out")\n    return False\n\n\nclass OAuthHTTPServer(http.server.HTTPServer):\n    def __init__(\n        self,\n        server_address: tuple[str, int],\n        request_handler_class: type[http.server.BaseHTTPRequestHandler],\n        *,\n        home_dir: str,\n        client_id: str,\n        verbose: bool = False,\n    ) -> None:\n        super().__init__(server_address, request_handler_class, bind_and_activate=True)\n        self.exit_code = 1\n        self.home_dir = home_dir\n        self.verbose = verbose\n        self.issuer = DEFAULT_ISSUER\n        self.token_endpoint = f"{self.issuer}/oauth/token"\n        self.client_id = client_id\n        port = server_address[1]\n        self.redirect_uri = f"http://localhost:{port}/auth/callback"\n        self.pkce = generate_pkce()\n        self.state = secrets.token_hex(32)\n\n    def auth_url(self) -> str:\n        params = {\n            "response_type": "code",\n            "client_id": self.client_id,\n            "redirect_uri": self.redirect_uri,\n            "scope": "openid profile email offline_access",\n            "code_challenge": self.pkce.code_challenge,\n            "code_challenge_method": "S256",\n            "id_token_add_organizations": "true",\n            "codex_cli_simplified_flow": "true",\n            "state": self.state,\n            "originator": ORIGINATOR,\n        }\n        return f"{self.issuer}/oauth/authorize?" + urllib.parse.urlencode(params)\n\n    def exchange_code(self, code: str) -> tuple[AuthBundle, str]:\n        data = urllib.parse.urlencode(\n            {\n                "grant_type": "authorization_code",\n                "code": code,\n                "redirect_uri": self.redirect_uri,\n                "client_id": self.client_id,\n                "code_verifier": self.pkce.code_verifier,\n            }\n        ).encode()\n\n        with urllib.request.urlopen(\n            urllib.request.Request(\n                self.token_endpoint,\n                data=data,\n                method="POST",\n                headers={"Content-Type": "application/x-www-form-urlencoded"},\n            ),\n            context=_SSL_CONTEXT,\n        ) as resp:\n            payload = json.loads(resp.read().decode())\n\n        bundle = _bundle_from_token_payload(payload)\n        id_token_claims = parse_jwt_claims(bundle.token_data.id_token)\n        access_token_claims = parse_jwt_claims(bundle.token_data.access_token)\n\n        api_key, success_url = self.maybe_obtain_api_key(\n            id_token_claims or {}, access_token_claims or {}, bundle.token_data\n        )\n\n        bundle.api_key = api_key\n        return bundle, success_url or f"{URL_BASE}/success"\n\n    def maybe_obtain_api_key(\n        self,\n        token_claims: Dict[str, Any],\n        access_claims: Dict[str, Any],\n        token_data: TokenData,\n    ) -> tuple[str | None, str | None]:\n        org_id = token_claims.get("organization_id")\n        project_id = token_claims.get("project_id")\n        if not org_id or not project_id:\n            query = {\n                "id_token": token_data.id_token,\n                "needs_setup": "false",\n                "org_id": org_id or "",\n                "project_id": project_id or "",\n                "plan_type": access_claims.get("chatgpt_plan_type"),\n                "platform_url": "https://platform.openai.com",\n            }\n            return None, f"{URL_BASE}/success?{urllib.parse.urlencode(query)}"\n\n        today = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")\n        exchange_data = urllib.parse.urlencode(\n            {\n                "grant_type": "urn:ietf:params:oauth:grant-type:token-exchange",\n                "client_id": self.client_id,\n                "requested_token": "openai-api-key",\n                "subject_token": token_data.id_token,\n                "subject_token_type": "urn:ietf:params:oauth:token-type:id_token",\n                "name": f"ChatMock [auto-generated] ({today})",\n            }\n        ).encode()\n\n        with urllib.request.urlopen(\n            urllib.request.Request(\n                self.token_endpoint,\n                data=exchange_data,\n                method="POST",\n                headers={"Content-Type": "application/x-www-form-urlencoded"},\n            ),\n            context=_SSL_CONTEXT,\n        ) as resp:\n            exchange_payload = json.loads(resp.read().decode())\n            exchanged_access_token = exchange_payload.get("access_token")\n\n        chatgpt_plan_type = access_claims.get("chatgpt_plan_type")\n        success_url_query = {\n            "id_token": token_data.id_token,\n            "access_token": token_data.access_token,\n            "refresh_token": token_data.refresh_token,\n            "exchanged_access_token": exchanged_access_token,\n            "org_id": org_id,\n            "project_id": project_id,\n            "plan_type": chatgpt_plan_type,\n            "platform_url": "https://platform.openai.com",\n        }\n        success_url = f"{URL_BASE}/success?{urllib.parse.urlencode(success_url_query)}"\n        return exchanged_access_token, success_url\n\n    def persist_auth(self, bundle: AuthBundle) -> bool:\n        return persist_auth_bundle(bundle)\n\n\nclass OAuthHandler(http.server.BaseHTTPRequestHandler):\n    server: "OAuthHTTPServer"\n\n    def do_GET(self) -> None:\n        path = urllib.parse.urlparse(self.path).path\n        if path == "/success":\n            self._send_html(LOGIN_SUCCESS_HTML)\n            try:\n                self.wfile.flush()\n            except Exception as e:\n                eprint(f"Failed to flush response: {e}")\n            self._shutdown_after_delay(2.0)\n            return\n\n        if path != "/auth/callback":\n            self.send_error(404, "Not Found")\n            self._shutdown()\n            return\n\n        query = urllib.parse.urlparse(self.path).query\n        params = urllib.parse.parse_qs(query)\n\n        code = params.get("code", [None])[0]\n        state = params.get("state", [None])[0]\n        if state != self.server.state:\n            self.send_error(400, "State mismatch")\n            self._shutdown()\n            return\n        if not code:\n            self.send_error(400, "Missing auth code")\n            self._shutdown()\n            return\n\n        try:\n            auth_bundle, success_url = self._exchange_code(code)\n        except Exception as exc:\n            self.send_error(500, f"Token exchange failed: {exc}")\n            self._shutdown()\n            return\n\n        if persist_auth_bundle(auth_bundle):\n            self.server.exit_code = 0\n            self._send_html(LOGIN_SUCCESS_HTML)\n        else:\n            self.send_error(500, "Unable to persist auth file")\n        self._shutdown_after_delay(2.0)\n\n    def do_POST(self) -> None:\n        self.send_error(404, "Not Found")\n        self._shutdown()\n\n    def log_message(self, fmt: str, *args):\n        if getattr(self.server, "verbose", False):\n            super().log_message(fmt, *args)\n\n    def _send_redirect(self, url: str) -> None:\n        self.send_response(302)\n        self.send_header("Location", url)\n        self.end_headers()\n\n    def _send_html(self, body: str) -> None:\n        encoded = body.encode()\n        self.send_response(200)\n        self.send_header("Content-Type", "text/html; charset=utf-8")\n        self.send_header("Content-Length", str(len(encoded)))\n        self.end_headers()\n        self.wfile.write(encoded)\n\n    def _shutdown(self) -> None:\n        threading.Thread(target=self.server.shutdown, daemon=True).start()\n\n    def _shutdown_after_delay(self, seconds: float = 2.0) -> None:\n        def _later():\n            try:\n                time.sleep(seconds)\n            finally:\n                self._shutdown()\n\n        threading.Thread(target=_later, daemon=True).start()\n\n    def _exchange_code(self, code: str) -> Tuple[AuthBundle, str]:\n        return self.server.exchange_code(code)\n\n    def _maybe_obtain_api_key(\n        self,\n        token_claims: Dict[str, Any],\n        access_claims: Dict[str, Any],\n        token_data: TokenData,\n    ) -> Tuple[str | None, str | None]:\n        org_id = token_claims.get("organization_id")\n        project_id = token_claims.get("project_id")\n        if not org_id or not project_id:\n            query = {\n                "id_token": token_data.id_token,\n                "needs_setup": "false",\n                "org_id": org_id or "",\n                "project_id": project_id or "",\n                "plan_type": access_claims.get("chatgpt_plan_type"),\n                "platform_url": "https://platform.openai.com",\n            }\n            return None, f"{URL_BASE}/success?{urllib.parse.urlencode(query)}"\n\n        today = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")\n        exchange_data = urllib.parse.urlencode(\n            {\n                "grant_type": "urn:ietf:params:oauth:grant-type:token-exchange",\n                "client_id": self.server.client_id,\n                "requested_token": "openai-api-key",\n                "subject_token": token_data.id_token,\n                "subject_token_type": "urn:ietf:params:oauth:token-type:id_token",\n                "name": f"ChatMock [auto-generated] ({today})",\n            }\n        ).encode()\n\n        with urllib.request.urlopen(\n            urllib.request.Request(\n                self.server.token_endpoint,\n                data=exchange_data,\n                method="POST",\n                headers={"Content-Type": "application/x-www-form-urlencoded"},\n            ),\n            context=_SSL_CONTEXT,\n        ) as resp:\n            exchange_payload = json.loads(resp.read().decode())\n            exchanged_access_token = exchange_payload.get("access_token")\n\n        chatgpt_plan_type = access_claims.get("chatgpt_plan_type")\n        success_url_query = {\n            "id_token": token_data.id_token,\n            "needs_setup": "false",\n            "org_id": org_id,\n            "project_id": project_id,\n            "plan_type": chatgpt_plan_type,\n            "platform_url": "https://platform.openai.com",\n        }\n        success_url = f"{URL_BASE}/success?{urllib.parse.urlencode(success_url_query)}"\n        return exchanged_access_token, success_url\n', 'chatmock.reasoning': 'from __future__ import annotations\n\nfrom typing import Any, Dict\n\nfrom .model_registry import DEFAULT_REASONING_EFFORTS, allowed_efforts_for_model, extract_reasoning_from_model_name\n\n\ndef build_reasoning_param(\n    base_effort: str = "medium",\n    base_summary: str = "auto",\n    overrides: Dict[str, Any] | None = None,\n    *,\n    allowed_efforts: frozenset[str] | None = None,\n) -> Dict[str, Any]:\n    effort = (base_effort or "").strip().lower()\n    summary = (base_summary or "").strip().lower()\n\n    valid_efforts = allowed_efforts or DEFAULT_REASONING_EFFORTS\n    valid_summaries = {"auto", "concise", "detailed", "none"}\n\n    if isinstance(overrides, dict):\n        o_eff = str(overrides.get("effort", "")).strip().lower()\n        o_sum = str(overrides.get("summary", "")).strip().lower()\n        if o_eff in valid_efforts and o_eff:\n            effort = o_eff\n        if o_sum in valid_summaries and o_sum:\n            summary = o_sum\n    if effort not in valid_efforts:\n        effort = "medium"\n    if summary not in valid_summaries:\n        summary = "auto"\n\n    reasoning: Dict[str, Any] = {"effort": effort}\n    if summary != "none":\n        reasoning["summary"] = summary\n    return reasoning\n\n\ndef apply_reasoning_to_message(\n    message: Dict[str, Any],\n    reasoning_summary_text: str,\n    reasoning_full_text: str,\n    compat: str,\n) -> Dict[str, Any]:\n    try:\n        compat = (compat or "think-tags").strip().lower()\n    except Exception:\n        compat = "think-tags"\n\n    if compat == "o3":\n        rtxt_parts: list[str] = []\n        if isinstance(reasoning_summary_text, str) and reasoning_summary_text.strip():\n            rtxt_parts.append(reasoning_summary_text)\n        if isinstance(reasoning_full_text, str) and reasoning_full_text.strip():\n            rtxt_parts.append(reasoning_full_text)\n        rtxt = "\\n\\n".join([p for p in rtxt_parts if p])\n        if rtxt:\n            message["reasoning"] = {"content": [{"type": "text", "text": rtxt}]}\n        return message\n\n    if compat in ("legacy", "current"):\n        if reasoning_summary_text:\n            message["reasoning_summary"] = reasoning_summary_text\n        if reasoning_full_text:\n            message["reasoning"] = reasoning_full_text\n        return message\n\n    rtxt_parts: list[str] = []\n    if isinstance(reasoning_summary_text, str) and reasoning_summary_text.strip():\n        rtxt_parts.append(reasoning_summary_text)\n    if isinstance(reasoning_full_text, str) and reasoning_full_text.strip():\n        rtxt_parts.append(reasoning_full_text)\n    rtxt = "\\n\\n".join([p for p in rtxt_parts if p])\n    if rtxt:\n        think_block = f"<think>{rtxt}</think>"\n        content_text = message.get("content") or ""\n        if isinstance(content_text, str):\n            message["content"] = think_block + (content_text or "")\n    return message\n', 'chatmock.responses_api': 'from __future__ import annotations\n\nimport json\nfrom dataclasses import dataclass\nfrom typing import Any, Dict, Iterable, Iterator, List\n\nfrom .fast_mode import ServiceTierResolution, resolve_service_tier\nfrom .model_registry import (\n    allowed_efforts_for_model,\n    extract_reasoning_from_model_name,\n    normalize_model_name,\n)\nfrom .reasoning import build_reasoning_param\nfrom .session import ensure_session_id\n\n\n@dataclass(frozen=True)\nclass ResponsesRequestError(Exception):\n    message: str\n    status_code: int = 400\n    code: str | None = None\n\n    def __str__(self) -> str:\n        return self.message\n\n\n@dataclass(frozen=True)\nclass NormalizedResponsesRequest:\n    payload: Dict[str, Any]\n    requested_model: str | None\n    normalized_model: str\n    session_id: str\n    service_tier_resolution: ServiceTierResolution\n\n\ndef extract_client_session_id(headers: Any) -> str | None:\n    try:\n        return headers.get("X-Session-Id") or headers.get("session_id") or None\n    except Exception:\n        return None\n\n\ndef _input_items_for_session(raw_input: Any) -> List[Dict[str, Any]]:\n    if isinstance(raw_input, list):\n        return [item for item in raw_input if isinstance(item, dict)]\n    if isinstance(raw_input, dict):\n        return [raw_input]\n    if isinstance(raw_input, str) and raw_input.strip():\n        return [\n            {\n                "type": "message",\n                "role": "user",\n                "content": [{"type": "input_text", "text": raw_input}],\n            }\n        ]\n    return []\n\n\ndef canonicalize_responses_input(raw_input: Any) -> Any:\n    if isinstance(raw_input, list):\n        return [item for item in raw_input if isinstance(item, dict)]\n    if isinstance(raw_input, dict):\n        return [raw_input]\n    if isinstance(raw_input, str):\n        return _input_items_for_session(raw_input)\n    return raw_input\n\n\ndef normalize_responses_payload(\n    payload: Dict[str, Any],\n    *,\n    config: Dict[str, Any],\n    client_session_id: str | None = None,\n) -> NormalizedResponsesRequest:\n    requested_model = payload.get("model") if isinstance(payload.get("model"), str) else None\n    normalized_model = normalize_model_name(requested_model, config.get("DEBUG_MODEL"))\n\n    normalized = dict(payload)\n    normalized["model"] = normalized_model\n    normalized.pop("max_output_tokens", None)\n\n    if "input" in normalized:\n        normalized["input"] = canonicalize_responses_input(normalized.get("input"))\n\n    if "store" not in normalized:\n        normalized["store"] = False\n\n    instructions = normalized.get("instructions")\n    if not isinstance(instructions, str) or not instructions.strip():\n        normalized.pop("instructions", None)\n\n    reasoning_effort = config.get("REASONING_EFFORT", "medium")\n    reasoning_summary = config.get("REASONING_SUMMARY", "auto")\n    reasoning_overrides = (\n        normalized.get("reasoning")\n        if isinstance(normalized.get("reasoning"), dict)\n        else extract_reasoning_from_model_name(requested_model)\n    )\n    normalized["reasoning"] = build_reasoning_param(\n        reasoning_effort,\n        reasoning_summary,\n        reasoning_overrides,\n        allowed_efforts=allowed_efforts_for_model(normalized_model),\n    )\n\n    include = normalized.get("include")\n    include_list = [item for item in include if isinstance(item, str)] if isinstance(include, list) else []\n    if "reasoning.encrypted_content" not in include_list:\n        include_list.append("reasoning.encrypted_content")\n    normalized["include"] = include_list\n\n    tools = normalized.get("tools")\n    if (not isinstance(tools, list) or not tools) and bool(config.get("DEFAULT_WEB_SEARCH")):\n        tool_choice = normalized.get("tool_choice")\n        if not (isinstance(tool_choice, str) and tool_choice.strip().lower() == "none"):\n            normalized["tools"] = [{"type": "web_search"}]\n\n    service_tier_resolution = resolve_service_tier(\n        normalized_model,\n        request_fast_mode=normalized.get("fast_mode"),\n        request_service_tier=normalized.get("service_tier"),\n        server_fast_mode=bool(config.get("FAST_MODE")),\n    )\n    if service_tier_resolution.error_message:\n        raise ResponsesRequestError(service_tier_resolution.error_message)\n    if service_tier_resolution.service_tier is None:\n        normalized.pop("service_tier", None)\n    else:\n        normalized["service_tier"] = service_tier_resolution.service_tier\n    normalized.pop("fast_mode", None)\n\n    input_items = _input_items_for_session(normalized.get("input"))\n    session_id = ensure_session_id(instructions, input_items, client_session_id)\n    prompt_cache_key = normalized.get("prompt_cache_key")\n    if not isinstance(prompt_cache_key, str) or not prompt_cache_key.strip():\n        normalized["prompt_cache_key"] = session_id\n\n    return NormalizedResponsesRequest(\n        payload=normalized,\n        requested_model=requested_model,\n        normalized_model=normalized_model,\n        session_id=session_id,\n        service_tier_resolution=service_tier_resolution,\n    )\n\n\ndef iter_sse_event_payloads(upstream: Any) -> Iterator[Dict[str, Any]]:\n    for raw in upstream.iter_lines(decode_unicode=False):\n        if not raw:\n            continue\n        line = raw.decode("utf-8", errors="ignore") if isinstance(raw, (bytes, bytearray)) else raw\n        if not line.startswith("data: "):\n            continue\n        data = line[len("data: ") :].strip()\n        if not data or data == "[DONE]":\n            if data == "[DONE]":\n                break\n            continue\n        try:\n            evt = json.loads(data)\n        except Exception:\n            continue\n        if isinstance(evt, dict):\n            yield evt\n\n\ndef aggregate_response_from_sse(\n    upstream: Any,\n    *,\n    on_event: Any | None = None,\n) -> tuple[Dict[str, Any] | None, Dict[str, Any] | None]:\n    response_obj: Dict[str, Any] | None = None\n    error_obj: Dict[str, Any] | None = None\n    try:\n        for evt in iter_sse_event_payloads(upstream):\n            if callable(on_event):\n                try:\n                    on_event(evt)\n                except Exception:\n                    pass\n            response = evt.get("response")\n            if isinstance(response, dict):\n                response_obj = response\n            kind = evt.get("type")\n            if kind == "response.failed":\n                if isinstance(response, dict) and isinstance(response.get("error"), dict):\n                    error_obj = {"error": response.get("error")}\n                else:\n                    error_obj = {"error": {"message": "response.failed"}}\n                break\n            if kind == "response.completed":\n                break\n    finally:\n        upstream.close()\n    return response_obj, error_obj\n\n\ndef stream_upstream_bytes(\n    upstream: Any,\n    *,\n    on_event: Any | None = None,\n) -> Iterable[bytes]:\n    buffer = b""\n    try:\n        for chunk in upstream.iter_content(chunk_size=None):\n            if chunk:\n                if callable(on_event):\n                    if isinstance(chunk, bytes):\n                        buffer += chunk\n                    else:\n                        buffer += str(chunk).encode("utf-8", errors="ignore")\n                    while b"\\n" in buffer:\n                        line, buffer = buffer.split(b"\\n", 1)\n                        line = line.rstrip(b"\\r")\n                        if not line.startswith(b"data: "):\n                            continue\n                        data = line[len(b"data: ") :].strip()\n                        if not data or data == b"[DONE]":\n                            continue\n                        try:\n                            evt = json.loads(data.decode("utf-8", errors="ignore"))\n                        except Exception:\n                            evt = None\n                        if isinstance(evt, dict):\n                            try:\n                                on_event(evt)\n                            except Exception:\n                                pass\n                yield chunk\n    finally:\n        upstream.close()\n', 'chatmock.routes_ollama': 'from __future__ import annotations\n\nimport json\nimport datetime\nimport time\nfrom typing import Any, Dict, List\n\nfrom flask import Blueprint, Response, current_app, jsonify, make_response, request, stream_with_context\n\nfrom .fast_mode import resolve_service_tier\nfrom .limits import record_rate_limits_from_response\nfrom .http import build_cors_headers\nfrom .model_registry import list_public_models\nfrom .reasoning import (\n    allowed_efforts_for_model,\n    build_reasoning_param,\n    extract_reasoning_from_model_name,\n)\nfrom .transform import convert_ollama_messages, normalize_ollama_tools\nfrom .upstream import normalize_model_name, start_upstream_request\nfrom .utils import convert_chat_messages_to_responses_input, convert_tools_chat_to_responses\n\n\nollama_bp = Blueprint("ollama", __name__)\n\n\ndef _log_json(prefix: str, payload: Any) -> None:\n    try:\n        print(f"{prefix}\\n{json.dumps(payload, indent=2, ensure_ascii=False)}")\n    except Exception:\n        try:\n            print(f"{prefix}\\n{payload}")\n        except Exception:\n            pass\n\n\ndef _wrap_stream_logging(label: str, iterator, enabled: bool):\n    if not enabled:\n        return iterator\n\n    def _gen():\n        for chunk in iterator:\n            try:\n                text = (\n                    chunk.decode("utf-8", errors="replace")\n                    if isinstance(chunk, (bytes, bytearray))\n                    else str(chunk)\n                )\n                print(f"{label}\\n{text}")\n            except Exception:\n                pass\n            yield chunk\n\n    return _gen()\n\n\n@ollama_bp.route("/api/version", methods=["GET"])\ndef ollama_version() -> Response:\n    if bool(current_app.config.get("VERBOSE")):\n        print("IN GET /api/version")\n    version = current_app.config.get("OLLAMA_VERSION", "0.12.10")\n    if not isinstance(version, str) or not version.strip():\n        version = "0.12.10"\n    payload = {"version": version}\n    resp = make_response(jsonify(payload), 200)\n    for k, v in build_cors_headers().items():\n        resp.headers.setdefault(k, v)\n    if bool(current_app.config.get("VERBOSE")):\n        _log_json("OUT GET /api/version", payload)\n    return resp\n\n\n_OLLAMA_FAKE_EVAL = {\n    "total_duration": 8497226791,\n    "load_duration": 1747193958,\n    "prompt_eval_count": 24,\n    "prompt_eval_duration": 269219750,\n    "eval_count": 247,\n    "eval_duration": 6413802458,\n}\n\n\n@ollama_bp.route("/api/tags", methods=["GET"])\ndef ollama_tags() -> Response:\n    if bool(current_app.config.get("VERBOSE")):\n        print("IN GET /api/tags")\n    expose_variants = bool(current_app.config.get("EXPOSE_REASONING_MODELS"))\n    model_ids = list_public_models(expose_reasoning_models=expose_variants)\n    models = []\n    for model_id in model_ids:\n        models.append(\n            {\n                "name": model_id,\n                "model": model_id,\n                "modified_at": "2023-10-01T00:00:00Z",\n                "size": 815319791,\n                "digest": "8648f39daa8fbf5b18c7b4e6a8fb4990c692751d49917417b8842ca5758e7ffc",\n                "details": {\n                    "parent_model": "",\n                    "format": "gguf",\n                    "family": "llama",\n                    "families": ["llama"],\n                    "parameter_size": "8.0B",\n                    "quantization_level": "Q4_0",\n                },\n            }\n        )\n    payload = {"models": models}\n    resp = make_response(jsonify(payload), 200)\n    for k, v in build_cors_headers().items():\n        resp.headers.setdefault(k, v)\n    if bool(current_app.config.get("VERBOSE")):\n        _log_json("OUT GET /api/tags", payload)\n    return resp\n\n\n@ollama_bp.route("/api/show", methods=["POST"])\ndef ollama_show() -> Response:\n    verbose = bool(current_app.config.get("VERBOSE"))\n    raw_body = request.get_data(cache=True, as_text=True) or ""\n    if verbose:\n        try:\n            print("IN POST /api/show\\n" + raw_body)\n        except Exception:\n            pass\n    try:\n        payload = json.loads(raw_body) if raw_body else (request.get_json(silent=True) or {})\n    except Exception:\n        payload = request.get_json(silent=True) or {}\n    model = payload.get("model")\n    if not isinstance(model, str) or not model.strip():\n        err = {"error": "Model not found"}\n        if verbose:\n            _log_json("OUT POST /api/show", err)\n        return jsonify(err), 400\n    v1_show_response = {\n        "modelfile": "# Modelfile generated by \\"ollama show\\"\\n# To build a new Modelfile based on this one, replace the FROM line with:\\n# FROM llava:latest\\n\\nFROM /models/blobs/sha256:placeholder\\nTEMPLATE \\"\\"\\"{{ .System }}\\nUSER: {{ .Prompt }}\\nASSISTANT: \\"\\"\\"\\nPARAMETER num_ctx 100000\\nPARAMETER stop \\"</s>\\"\\nPARAMETER stop \\"USER:\\"\\nPARAMETER stop \\"ASSISTANT:\\"",\n        "parameters": "num_keep 24\\nstop \\"<|start_header_id|>\\"\\nstop \\"<|end_header_id|>\\"\\nstop \\"<|eot_id|>\\"",\n        "template": "{{ if .System }}<|start_header_id|>system<|end_header_id|>\\n\\n{{ .System }}<|eot_id|>{{ end }}{{ if .Prompt }}<|start_header_id|>user<|end_header_id|>\\n\\n{{ .Prompt }}<|eot_id|>{{ end }}<|start_header_id|>assistant<|end_header_id|>\\n\\n{{ .Response }}<|eot_id|>",\n        "details": {\n            "parent_model": "",\n            "format": "gguf",\n            "family": "llama",\n            "families": ["llama"],\n            "parameter_size": "8.0B",\n            "quantization_level": "Q4_0",\n        },\n        "model_info": {\n            "general.architecture": "llama",\n            "general.file_type": 2,\n            "llama.context_length": 2000000,\n        },\n        "capabilities": ["completion", "vision", "tools", "thinking"],\n    }\n    if verbose:\n        _log_json("OUT POST /api/show", v1_show_response)\n    resp = make_response(jsonify(v1_show_response), 200)\n    for k, v in build_cors_headers().items():\n        resp.headers.setdefault(k, v)\n    return resp\n\n\n@ollama_bp.route("/api/chat", methods=["POST"])\ndef ollama_chat() -> Response:\n    verbose = bool(current_app.config.get("VERBOSE"))\n    reasoning_effort = current_app.config.get("REASONING_EFFORT", "medium")\n    reasoning_summary = current_app.config.get("REASONING_SUMMARY", "auto")\n    reasoning_compat = current_app.config.get("REASONING_COMPAT", "think-tags")\n\n    try:\n        raw = request.get_data(cache=True, as_text=True) or ""\n        if verbose:\n            print("IN POST /api/chat\\n" + (raw if isinstance(raw, str) else ""))\n        payload = json.loads(raw) if raw else {}\n    except Exception:\n        err = {"error": "Invalid JSON body"}\n        if verbose:\n            _log_json("OUT POST /api/chat", err)\n        return jsonify(err), 400\n\n    model = payload.get("model")\n    raw_messages = payload.get("messages")\n    messages = convert_ollama_messages(\n        raw_messages, payload.get("images") if isinstance(payload.get("images"), list) else None\n    )\n    if isinstance(messages, list):\n        sys_idx = next((i for i, m in enumerate(messages) if isinstance(m, dict) and m.get("role") == "system"), None)\n        if isinstance(sys_idx, int):\n            sys_msg = messages.pop(sys_idx)\n            content = sys_msg.get("content") if isinstance(sys_msg, dict) else ""\n            messages.insert(0, {"role": "user", "content": content})\n    stream_req = payload.get("stream")\n    if stream_req is None:\n        stream_req = True\n    stream_req = bool(stream_req)\n    tools_req = payload.get("tools") if isinstance(payload.get("tools"), list) else []\n    tools_responses = convert_tools_chat_to_responses(normalize_ollama_tools(tools_req))\n    tool_choice = payload.get("tool_choice", "auto")\n    parallel_tool_calls = bool(payload.get("parallel_tool_calls", False))\n\n    # Passthrough Responses API tools (web_search) via ChatMock extension fields\n    extra_tools: List[Dict[str, Any]] = []\n    had_responses_tools = False\n    rt_payload = payload.get("responses_tools") if isinstance(payload.get("responses_tools"), list) else []\n    if isinstance(rt_payload, list):\n        for _t in rt_payload:\n            if not (isinstance(_t, dict) and isinstance(_t.get("type"), str)):\n                continue\n            if _t.get("type") not in ("web_search", "web_search_preview"):\n                err = {"error": "Only web_search/web_search_preview are supported in responses_tools"}\n                if verbose:\n                    _log_json("OUT POST /api/chat", err)\n                return jsonify(err), 400\n            extra_tools.append(_t)\n        if not extra_tools and bool(current_app.config.get("DEFAULT_WEB_SEARCH")):\n            rtc = payload.get("responses_tool_choice")\n            if not (isinstance(rtc, str) and rtc == "none"):\n                extra_tools = [{"type": "web_search"}]\n        if extra_tools:\n            import json as _json\n            MAX_TOOLS_BYTES = 32768\n            try:\n                size = len(_json.dumps(extra_tools))\n            except Exception:\n                size = 0\n            if size > MAX_TOOLS_BYTES:\n                err = {"error": "responses_tools too large"}\n                if verbose:\n                    _log_json("OUT POST /api/chat", err)\n                return jsonify(err), 400\n            had_responses_tools = True\n            tools_responses = (tools_responses or []) + extra_tools\n\n    rtc = payload.get("responses_tool_choice")\n    if isinstance(rtc, str) and rtc in ("auto", "none"):\n        tool_choice = rtc\n\n    if not isinstance(model, str) or not isinstance(messages, list) or not messages:\n        err = {"error": "Invalid request format"}\n        if verbose:\n            _log_json("OUT POST /api/chat", err)\n        return jsonify(err), 400\n\n    input_items = convert_chat_messages_to_responses_input(messages)\n\n    model_reasoning = extract_reasoning_from_model_name(model)\n    normalized_model = normalize_model_name(model, current_app.config.get("DEBUG_MODEL"))\n    service_tier_resolution = resolve_service_tier(\n        normalized_model,\n        request_fast_mode=payload.get("fast_mode"),\n        request_service_tier=payload.get("service_tier"),\n        server_fast_mode=bool(current_app.config.get("FAST_MODE")),\n    )\n    if service_tier_resolution.warning_message and verbose:\n        print(f"[FastMode] {service_tier_resolution.warning_message}")\n    if service_tier_resolution.error_message:\n        err = {"error": service_tier_resolution.error_message}\n        if verbose:\n            _log_json("OUT POST /api/chat", err)\n        return jsonify(err), 400\n    upstream, error_resp = start_upstream_request(\n        normalized_model,\n        input_items,\n        tools=tools_responses,\n        tool_choice=tool_choice,\n        parallel_tool_calls=parallel_tool_calls,\n        reasoning_param=build_reasoning_param(\n            reasoning_effort,\n            reasoning_summary,\n            model_reasoning,\n            allowed_efforts=allowed_efforts_for_model(model),\n        ),\n        service_tier=service_tier_resolution.service_tier,\n    )\n    if error_resp is not None:\n        if verbose:\n            try:\n                body = error_resp.get_data(as_text=True)\n                if body:\n                    try:\n                        parsed = json.loads(body)\n                    except Exception:\n                        parsed = body\n                    _log_json("OUT POST /api/chat", parsed)\n            except Exception:\n                pass\n        return error_resp\n\n    record_rate_limits_from_response(upstream)\n\n    if upstream.status_code >= 400:\n        try:\n            err_body = json.loads(upstream.content.decode("utf-8", errors="ignore")) if upstream.content else {"raw": upstream.text}\n        except Exception:\n            err_body = {"raw": upstream.text}\n        if had_responses_tools:\n            if verbose:\n                print("[Passthrough] Upstream rejected tools; retrying without extras (args redacted)")\n            base_tools_only = convert_tools_chat_to_responses(normalize_ollama_tools(tools_req))\n            safe_choice = payload.get("tool_choice", "auto")\n            upstream2, err2 = start_upstream_request(\n                normalize_model_name(model, current_app.config.get("DEBUG_MODEL")),\n                input_items,\n                tools=base_tools_only,\n                tool_choice=safe_choice,\n                parallel_tool_calls=parallel_tool_calls,\n                reasoning_param=build_reasoning_param(\n                    reasoning_effort,\n                    reasoning_summary,\n                    model_reasoning,\n                    allowed_efforts=allowed_efforts_for_model(model),\n                ),\n                service_tier=service_tier_resolution.service_tier,\n            )\n            record_rate_limits_from_response(upstream2)\n            if err2 is None and upstream2 is not None and upstream2.status_code < 400:\n                upstream = upstream2\n            else:\n                err = {"error": {"message": (err_body.get("error", {}) or {}).get("message", "Upstream error"), "code": "RESPONSES_TOOLS_REJECTED"}}\n                if verbose:\n                    _log_json("OUT POST /api/chat", err)\n                return jsonify(err), (upstream2.status_code if upstream2 is not None else upstream.status_code)\n        else:\n            if verbose:\n                print("/api/chat upstream error status=", upstream.status_code, " body:", json.dumps(err_body)[:2000])\n            err = {"error": (err_body.get("error", {}) or {}).get("message", "Upstream error")}\n            if verbose:\n                _log_json("OUT POST /api/chat", err)\n            return jsonify(err), upstream.status_code\n\n    created_at = datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")\n    model_out = model if isinstance(model, str) and model.strip() else normalized_model\n\n    if stream_req:\n        def _gen():\n            compat = (current_app.config.get("REASONING_COMPAT", "think-tags") or "think-tags").strip().lower()\n            think_open = False\n            think_closed = False\n            saw_any_summary = False\n            pending_summary_paragraph = False\n            full_parts: List[str] = []\n            try:\n                for raw_line in upstream.iter_lines(decode_unicode=False):\n                    if not raw_line:\n                        continue\n                    line = raw_line.decode("utf-8", errors="ignore") if isinstance(raw_line, (bytes, bytearray)) else raw_line\n                    if not line.startswith("data: "):\n                        continue\n                    data = line[len("data: "):].strip()\n                    if not data:\n                        continue\n                    if data == "[DONE]":\n                        break\n                    try:\n                        evt = json.loads(data)\n                    except Exception:\n                        continue\n                    kind = evt.get("type")\n                    if kind == "response.reasoning_summary_part.added":\n                        if compat in ("think-tags", "o3"):\n                            if saw_any_summary:\n                                pending_summary_paragraph = True\n                            else:\n                                saw_any_summary = True\n                    elif kind in ("response.reasoning_summary_text.delta", "response.reasoning_text.delta"):\n                        delta_txt = evt.get("delta") or ""\n                        if compat == "o3":\n                            if kind == "response.reasoning_summary_text.delta" and pending_summary_paragraph:\n                                yield (\n                                    json.dumps(\n                                        {\n                                            "model": model_out,\n                                            "created_at": created_at,\n                                            "message": {"role": "assistant", "content": "\\n"},\n                                            "done": False,\n                                        }\n                                    )\n                                    + "\\n"\n                                )\n                                full_parts.append("\\n")\n                                pending_summary_paragraph = False\n                            if delta_txt:\n                                yield (\n                                    json.dumps(\n                                        {\n                                            "model": model_out,\n                                            "created_at": created_at,\n                                            "message": {"role": "assistant", "content": delta_txt},\n                                            "done": False,\n                                        }\n                                    )\n                                    + "\\n"\n                                )\n                                full_parts.append(delta_txt)\n                        elif compat == "think-tags":\n                            if not think_open and not think_closed:\n                                yield (\n                                    json.dumps(\n                                        {\n                                            "model": model_out,\n                                            "created_at": created_at,\n                                            "message": {"role": "assistant", "content": "<think>"},\n                                            "done": False,\n                                        }\n                                    )\n                                    + "\\n"\n                                )\n                                full_parts.append("<think>")\n                                think_open = True\n                            if think_open and not think_closed:\n                                if kind == "response.reasoning_summary_text.delta" and pending_summary_paragraph:\n                                    yield (\n                                        json.dumps(\n                                            {\n                                                "model": model_out,\n                                                "created_at": created_at,\n                                                "message": {"role": "assistant", "content": "\\n"},\n                                                "done": False,\n                                            }\n                                        )\n                                        + "\\n"\n                                    )\n                                    full_parts.append("\\n")\n                                    pending_summary_paragraph = False\n                                if delta_txt:\n                                    yield (\n                                        json.dumps(\n                                            {\n                                                "model": model_out,\n                                                "created_at": created_at,\n                                                "message": {"role": "assistant", "content": delta_txt},\n                                                "done": False,\n                                            }\n                                        )\n                                        + "\\n"\n                                    )\n                                    full_parts.append(delta_txt)\n                        else:\n                            pass\n                    elif kind == "response.output_text.delta":\n                        delta = evt.get("delta") or ""\n                        if compat == "think-tags" and think_open and not think_closed:\n                            yield (\n                                json.dumps(\n                                    {\n                                        "model": model_out,\n                                        "created_at": created_at,\n                                        "message": {"role": "assistant", "content": "</think>"},\n                                        "done": False,\n                                    }\n                                )\n                                + "\\n"\n                            )\n                            full_parts.append("</think>")\n                            think_open = False\n                            think_closed = True\n                        if delta:\n                            yield (\n                                json.dumps(\n                                    {\n                                        "model": model_out,\n                                        "created_at": created_at,\n                                        "message": {"role": "assistant", "content": delta},\n                                        "done": False,\n                                    }\n                                )\n                                + "\\n"\n                            )\n                            full_parts.append(delta)\n                    elif kind == "response.completed":\n                        break\n            finally:\n                upstream.close()\n                if compat == "think-tags" and think_open and not think_closed:\n                    yield (\n                        json.dumps(\n                            {\n                                "model": model_out,\n                                "created_at": created_at,\n                                "message": {"role": "assistant", "content": "</think>"},\n                                "done": False,\n                            }\n                        )\n                        + "\\n"\n                    )\n                    full_parts.append("</think>")\n                done_obj = {\n                    "model": model_out,\n                    "created_at": created_at,\n                    "message": {"role": "assistant", "content": ""},\n                    "done": True,\n                }\n                done_obj.update(_OLLAMA_FAKE_EVAL)\n                yield json.dumps(done_obj) + "\\n"\n        if verbose:\n            print("OUT POST /api/chat (streaming response)")\n        stream_iter = stream_with_context(_gen())\n        stream_iter = _wrap_stream_logging("STREAM OUT /api/chat", stream_iter, verbose)\n        resp = current_app.response_class(\n            stream_iter,\n            status=200,\n            mimetype="application/x-ndjson",\n        )\n        for k, v in build_cors_headers().items():\n            resp.headers.setdefault(k, v)\n        return resp\n\n    full_text = ""\n    reasoning_summary_text = ""\n    reasoning_full_text = ""\n    tool_calls: List[Dict[str, Any]] = []\n    try:\n        for raw in upstream.iter_lines(decode_unicode=False):\n            if not raw:\n                continue\n            line = raw.decode("utf-8", errors="ignore") if isinstance(raw, (bytes, bytearray)) else raw\n            if not line.startswith("data: "):\n                continue\n            data = line[len("data: "):].strip()\n            if not data:\n                continue\n            if data == "[DONE]":\n                break\n            try:\n                evt = json.loads(data)\n            except Exception:\n                continue\n            kind = evt.get("type")\n            if kind == "response.output_text.delta":\n                full_text += evt.get("delta") or ""\n            elif kind == "response.reasoning_summary_text.delta":\n                reasoning_summary_text += evt.get("delta") or ""\n            elif kind == "response.reasoning_text.delta":\n                reasoning_full_text += evt.get("delta") or ""\n            elif kind == "response.output_item.done":\n                item = evt.get("item") or {}\n                if isinstance(item, dict) and item.get("type") == "function_call":\n                    call_id = item.get("call_id") or item.get("id") or ""\n                    name = item.get("name") or ""\n                    args = item.get("arguments") or ""\n                    if isinstance(call_id, str) and isinstance(name, str) and isinstance(args, str):\n                        tool_calls.append(\n                            {\n                                "id": call_id,\n                                "type": "function",\n                                "function": {"name": name, "arguments": args},\n                            }\n                        )\n            elif kind == "response.completed":\n                break\n    finally:\n        upstream.close()\n\n    if (current_app.config.get("REASONING_COMPAT", "think-tags") or "think-tags").strip().lower() == "think-tags":\n        rtxt_parts = []\n        if isinstance(reasoning_summary_text, str) and reasoning_summary_text.strip():\n            rtxt_parts.append(reasoning_summary_text)\n        if isinstance(reasoning_full_text, str) and reasoning_full_text.strip():\n            rtxt_parts.append(reasoning_full_text)\n        rtxt = "\\n\\n".join([p for p in rtxt_parts if p])\n        if rtxt:\n            full_text = f"<think>{rtxt}</think>" + (full_text or "")\n\n    out_json = {\n        "model": normalize_model_name(model, current_app.config.get("DEBUG_MODEL")),\n        "created_at": created_at,\n        "message": {"role": "assistant", "content": full_text, **({"tool_calls": tool_calls} if tool_calls else {})},\n        "done": True,\n        "done_reason": "stop",\n    }\n    out_json.update(_OLLAMA_FAKE_EVAL)\n    if verbose:\n        _log_json("OUT POST /api/chat", out_json)\n    resp = make_response(jsonify(out_json), 200)\n    for k, v in build_cors_headers().items():\n        resp.headers.setdefault(k, v)\n    return resp\n', 'chatmock.routes_openai': 'from __future__ import annotations\n\nimport json\nimport time\nfrom typing import Any, Dict, List\n\nfrom flask import Blueprint, Response, current_app, jsonify, make_response, request\n\nfrom .fast_mode import resolve_service_tier\nfrom .limits import record_rate_limits_from_response\nfrom .http import build_cors_headers\nfrom .model_registry import list_public_models\nfrom .responses_api import (\n    ResponsesRequestError,\n    aggregate_response_from_sse,\n    extract_client_session_id,\n    normalize_responses_payload,\n    stream_upstream_bytes,\n)\nfrom .reasoning import (\n    allowed_efforts_for_model,\n    apply_reasoning_to_message,\n    build_reasoning_param,\n    extract_reasoning_from_model_name,\n)\nfrom .session import (\n    clear_responses_reuse_state,\n    note_responses_final_response,\n    note_responses_stream_event,\n    prepare_responses_request_for_session,\n)\nfrom .upstream import normalize_model_name, start_upstream_raw_request, start_upstream_request\nfrom .utils import (\n    convert_chat_messages_to_responses_input,\n    convert_tools_chat_to_responses,\n    sse_translate_chat,\n    sse_translate_text,\n)\n\n\nopenai_bp = Blueprint("openai", __name__)\n\n\ndef _log_json(prefix: str, payload: Any) -> None:\n    try:\n        print(f"{prefix}\\n{json.dumps(payload, indent=2, ensure_ascii=False)}")\n    except Exception:\n        try:\n            print(f"{prefix}\\n{payload}")\n        except Exception:\n            pass\n\n\ndef _wrap_stream_logging(label: str, iterator, enabled: bool):\n    if not enabled:\n        return iterator\n\n    def _gen():\n        for chunk in iterator:\n            try:\n                text = (\n                    chunk.decode("utf-8", errors="replace")\n                    if isinstance(chunk, (bytes, bytearray))\n                    else str(chunk)\n                )\n                print(f"{label}\\n{text}")\n            except Exception:\n                pass\n            yield chunk\n\n    return _gen()\n\n\ndef _service_tier_from_payload(\n    model: str,\n    payload: Dict[str, Any],\n    *,\n    verbose: bool = False,\n) -> tuple[str | None, Response | None]:\n    resolution = resolve_service_tier(\n        model,\n        request_fast_mode=payload.get("fast_mode"),\n        request_service_tier=payload.get("service_tier"),\n        server_fast_mode=bool(current_app.config.get("FAST_MODE")),\n    )\n    if resolution.warning_message and verbose:\n        print(f"[FastMode] {resolution.warning_message}")\n    if resolution.error_message:\n        err = {"error": {"message": resolution.error_message}}\n        if verbose:\n            _log_json("OUT POST service_tier resolution", err)\n        resp = make_response(jsonify(err), 400)\n        for k, v in build_cors_headers().items():\n            resp.headers.setdefault(k, v)\n        return None, resp\n    return resolution.service_tier, None\n\n\n@openai_bp.route("/v1/chat/completions", methods=["POST"])\ndef chat_completions() -> Response:\n    verbose = bool(current_app.config.get("VERBOSE"))\n    verbose_obfuscation = bool(current_app.config.get("VERBOSE_OBFUSCATION"))\n    reasoning_effort = current_app.config.get("REASONING_EFFORT", "medium")\n    reasoning_summary = current_app.config.get("REASONING_SUMMARY", "auto")\n    reasoning_compat = current_app.config.get("REASONING_COMPAT", "think-tags")\n\n    raw = request.get_data(cache=True, as_text=True) or ""\n    if verbose:\n        try:\n            print("IN POST /v1/chat/completions\\n" + raw)\n        except Exception:\n            pass\n    try:\n        payload = json.loads(raw) if raw else {}\n    except Exception:\n        try:\n            payload = json.loads(raw.replace("\\r", "").replace("\\n", ""))\n        except Exception:\n            err = {"error": {"message": "Invalid JSON body"}}\n            if verbose:\n                _log_json("OUT POST /v1/chat/completions", err)\n            return jsonify(err), 400\n\n    requested_model = payload.get("model")\n    model = normalize_model_name(requested_model, current_app.config.get("DEBUG_MODEL"))\n    messages = payload.get("messages")\n    if messages is None and isinstance(payload.get("prompt"), str):\n        messages = [{"role": "user", "content": payload.get("prompt") or ""}]\n    if messages is None and isinstance(payload.get("input"), str):\n        messages = [{"role": "user", "content": payload.get("input") or ""}]\n    if messages is None:\n        messages = []\n    if not isinstance(messages, list):\n        err = {"error": {"message": "Request must include messages: []"}}\n        if verbose:\n            _log_json("OUT POST /v1/chat/completions", err)\n        return jsonify(err), 400\n\n    if isinstance(messages, list):\n        sys_idx = next((i for i, m in enumerate(messages) if isinstance(m, dict) and m.get("role") == "system"), None)\n        if isinstance(sys_idx, int):\n            sys_msg = messages.pop(sys_idx)\n            content = sys_msg.get("content") if isinstance(sys_msg, dict) else ""\n            messages.insert(0, {"role": "user", "content": content})\n    is_stream = bool(payload.get("stream"))\n    stream_options = payload.get("stream_options") if isinstance(payload.get("stream_options"), dict) else {}\n    include_usage = bool(stream_options.get("include_usage", False))\n\n    tools_responses = convert_tools_chat_to_responses(payload.get("tools"))\n    tool_choice = payload.get("tool_choice", "auto")\n    parallel_tool_calls = bool(payload.get("parallel_tool_calls", False))\n    responses_tools_payload = payload.get("responses_tools") if isinstance(payload.get("responses_tools"), list) else []\n    extra_tools: List[Dict[str, Any]] = []\n    had_responses_tools = False\n    if isinstance(responses_tools_payload, list):\n        for _t in responses_tools_payload:\n            if not (isinstance(_t, dict) and isinstance(_t.get("type"), str)):\n                continue\n            if _t.get("type") not in ("web_search", "web_search_preview"):\n                err = {\n                    "error": {\n                        "message": "Only web_search/web_search_preview are supported in responses_tools",\n                        "code": "RESPONSES_TOOL_UNSUPPORTED",\n                    }\n                }\n                if verbose:\n                    _log_json("OUT POST /v1/chat/completions", err)\n                return jsonify(err), 400\n            extra_tools.append(_t)\n\n        if not extra_tools and bool(current_app.config.get("DEFAULT_WEB_SEARCH")):\n            responses_tool_choice = payload.get("responses_tool_choice")\n            if not (isinstance(responses_tool_choice, str) and responses_tool_choice == "none"):\n                extra_tools = [{"type": "web_search"}]\n\n        if extra_tools:\n            import json as _json\n            MAX_TOOLS_BYTES = 32768\n            try:\n                size = len(_json.dumps(extra_tools))\n            except Exception:\n                size = 0\n            if size > MAX_TOOLS_BYTES:\n                err = {"error": {"message": "responses_tools too large", "code": "RESPONSES_TOOLS_TOO_LARGE"}}\n                if verbose:\n                    _log_json("OUT POST /v1/chat/completions", err)\n                return jsonify(err), 400\n            had_responses_tools = True\n            tools_responses = (tools_responses or []) + extra_tools\n\n    responses_tool_choice = payload.get("responses_tool_choice")\n    if isinstance(responses_tool_choice, str) and responses_tool_choice in ("auto", "none"):\n        tool_choice = responses_tool_choice\n\n    input_items = convert_chat_messages_to_responses_input(messages)\n    if not input_items and isinstance(payload.get("prompt"), str) and payload.get("prompt").strip():\n        input_items = [\n            {"type": "message", "role": "user", "content": [{"type": "input_text", "text": payload.get("prompt")}]}\n        ]\n\n    model_reasoning = extract_reasoning_from_model_name(requested_model)\n    reasoning_overrides = payload.get("reasoning") if isinstance(payload.get("reasoning"), dict) else model_reasoning\n    reasoning_param = build_reasoning_param(\n        reasoning_effort,\n        reasoning_summary,\n        reasoning_overrides,\n        allowed_efforts=allowed_efforts_for_model(model),\n    )\n    service_tier, tier_error = _service_tier_from_payload(model, payload, verbose=verbose)\n    if tier_error is not None:\n        return tier_error\n\n    upstream, error_resp = start_upstream_request(\n        model,\n        input_items,\n        tools=tools_responses,\n        tool_choice=tool_choice,\n        parallel_tool_calls=parallel_tool_calls,\n        reasoning_param=reasoning_param,\n        service_tier=service_tier,\n    )\n    if error_resp is not None:\n        if verbose:\n            try:\n                body = error_resp.get_data(as_text=True)\n                if body:\n                    try:\n                        parsed = json.loads(body)\n                    except Exception:\n                        parsed = body\n                    _log_json("OUT POST /v1/chat/completions", parsed)\n            except Exception:\n                pass\n        return error_resp\n\n    record_rate_limits_from_response(upstream)\n\n    created = int(time.time())\n    if upstream.status_code >= 400:\n        try:\n            raw = upstream.content\n            err_body = json.loads(raw.decode("utf-8", errors="ignore")) if raw else {"raw": upstream.text}\n        except Exception:\n            err_body = {"raw": upstream.text}\n        if had_responses_tools:\n            if verbose:\n                print("[Passthrough] Upstream rejected tools; retrying without extra tools (args redacted)")\n            base_tools_only = convert_tools_chat_to_responses(payload.get("tools"))\n            safe_choice = payload.get("tool_choice", "auto")\n            upstream2, err2 = start_upstream_request(\n                model,\n                input_items,\n                tools=base_tools_only,\n                tool_choice=safe_choice,\n                parallel_tool_calls=parallel_tool_calls,\n                reasoning_param=reasoning_param,\n                service_tier=service_tier,\n            )\n            record_rate_limits_from_response(upstream2)\n            if err2 is None and upstream2 is not None and upstream2.status_code < 400:\n                upstream = upstream2\n            else:\n                err = {\n                    "error": {\n                        "message": (err_body.get("error", {}) or {}).get("message", "Upstream error"),\n                        "code": "RESPONSES_TOOLS_REJECTED",\n                    }\n                }\n                if verbose:\n                    _log_json("OUT POST /v1/chat/completions", err)\n                return jsonify(err), (upstream2.status_code if upstream2 is not None else upstream.status_code)\n        else:\n            if verbose:\n                print("Upstream error status=", upstream.status_code)\n            err = {"error": {"message": (err_body.get("error", {}) or {}).get("message", "Upstream error")}}\n            if verbose:\n                _log_json("OUT POST /v1/chat/completions", err)\n            return jsonify(err), upstream.status_code\n\n    if is_stream:\n        if verbose:\n            print("OUT POST /v1/chat/completions (streaming response)")\n        stream_iter = sse_translate_chat(\n            upstream,\n            requested_model or model,\n            created,\n            verbose=verbose_obfuscation,\n            vlog=print if verbose_obfuscation else None,\n            reasoning_compat=reasoning_compat,\n            include_usage=include_usage,\n        )\n        stream_iter = _wrap_stream_logging("STREAM OUT /v1/chat/completions", stream_iter, verbose)\n        resp = Response(\n            stream_iter,\n            status=upstream.status_code,\n            mimetype="text/event-stream",\n            headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},\n        )\n        for k, v in build_cors_headers().items():\n            resp.headers.setdefault(k, v)\n        return resp\n\n    full_text = ""\n    reasoning_summary_text = ""\n    reasoning_full_text = ""\n    response_id = "chatcmpl"\n    tool_calls: List[Dict[str, Any]] = []\n    error_message: str | None = None\n    usage_obj: Dict[str, int] | None = None\n\n    def _extract_usage(evt: Dict[str, Any]) -> Dict[str, int] | None:\n        try:\n            usage = (evt.get("response") or {}).get("usage")\n            if not isinstance(usage, dict):\n                return None\n            pt = int(usage.get("input_tokens") or 0)\n            ct = int(usage.get("output_tokens") or 0)\n            tt = int(usage.get("total_tokens") or (pt + ct))\n            return {"prompt_tokens": pt, "completion_tokens": ct, "total_tokens": tt}\n        except Exception:\n            return None\n    try:\n        for raw in upstream.iter_lines(decode_unicode=False):\n            if not raw:\n                continue\n            line = raw.decode("utf-8", errors="ignore") if isinstance(raw, (bytes, bytearray)) else raw\n            if not line.startswith("data: "):\n                continue\n            data = line[len("data: "):].strip()\n            if not data:\n                continue\n            if data == "[DONE]":\n                break\n            try:\n                evt = json.loads(data)\n            except Exception:\n                continue\n            kind = evt.get("type")\n            mu = _extract_usage(evt)\n            if mu:\n                usage_obj = mu\n            if isinstance(evt.get("response"), dict) and isinstance(evt["response"].get("id"), str):\n                response_id = evt["response"].get("id") or response_id\n            if kind == "response.output_text.delta":\n                full_text += evt.get("delta") or ""\n            elif kind == "response.reasoning_summary_text.delta":\n                reasoning_summary_text += evt.get("delta") or ""\n            elif kind == "response.reasoning_text.delta":\n                reasoning_full_text += evt.get("delta") or ""\n            elif kind == "response.output_item.done":\n                item = evt.get("item") or {}\n                if isinstance(item, dict) and item.get("type") == "function_call":\n                    call_id = item.get("call_id") or item.get("id") or ""\n                    name = item.get("name") or ""\n                    args = item.get("arguments") or ""\n                    if isinstance(call_id, str) and isinstance(name, str) and isinstance(args, str):\n                        tool_calls.append(\n                            {\n                                "id": call_id,\n                                "type": "function",\n                                "function": {"name": name, "arguments": args},\n                            }\n                        )\n            elif kind == "response.failed":\n                error_message = evt.get("response", {}).get("error", {}).get("message", "response.failed")\n            elif kind == "response.completed":\n                break\n    finally:\n        upstream.close()\n\n    if error_message:\n        resp = make_response(jsonify({"error": {"message": error_message}}), 502)\n        for k, v in build_cors_headers().items():\n            resp.headers.setdefault(k, v)\n        return resp\n\n    message: Dict[str, Any] = {"role": "assistant", "content": full_text if full_text else None}\n    if tool_calls:\n        message["tool_calls"] = tool_calls\n    message = apply_reasoning_to_message(message, reasoning_summary_text, reasoning_full_text, reasoning_compat)\n    completion = {\n        "id": response_id or "chatcmpl",\n        "object": "chat.completion",\n        "created": created,\n        "model": requested_model or model,\n        "choices": [\n            {\n                "index": 0,\n                "message": message,\n                "finish_reason": "tool_calls" if tool_calls else "stop",\n            }\n        ],\n        **({"usage": usage_obj} if usage_obj else {}),\n    }\n    if verbose:\n        _log_json("OUT POST /v1/chat/completions", completion)\n    resp = make_response(jsonify(completion), upstream.status_code)\n    for k, v in build_cors_headers().items():\n        resp.headers.setdefault(k, v)\n    return resp\n\n\n@openai_bp.route("/v1/completions", methods=["POST"])\ndef completions() -> Response:\n    verbose = bool(current_app.config.get("VERBOSE"))\n    verbose_obfuscation = bool(current_app.config.get("VERBOSE_OBFUSCATION"))\n    reasoning_effort = current_app.config.get("REASONING_EFFORT", "medium")\n    reasoning_summary = current_app.config.get("REASONING_SUMMARY", "auto")\n\n    raw = request.get_data(cache=True, as_text=True) or ""\n    if verbose:\n        try:\n            print("IN POST /v1/completions\\n" + raw)\n        except Exception:\n            pass\n    try:\n        payload = json.loads(raw) if raw else {}\n    except Exception:\n        err = {"error": {"message": "Invalid JSON body"}}\n        if verbose:\n            _log_json("OUT POST /v1/completions", err)\n        return jsonify(err), 400\n\n    requested_model = payload.get("model")\n    model = normalize_model_name(requested_model, current_app.config.get("DEBUG_MODEL"))\n    prompt = payload.get("prompt")\n    if isinstance(prompt, list):\n        prompt = "".join([p if isinstance(p, str) else "" for p in prompt])\n    if not isinstance(prompt, str):\n        prompt = payload.get("suffix") or ""\n    stream_req = bool(payload.get("stream", False))\n    stream_options = payload.get("stream_options") if isinstance(payload.get("stream_options"), dict) else {}\n    include_usage = bool(stream_options.get("include_usage", False))\n\n    messages = [{"role": "user", "content": prompt or ""}]\n    input_items = convert_chat_messages_to_responses_input(messages)\n\n    model_reasoning = extract_reasoning_from_model_name(requested_model)\n    reasoning_overrides = payload.get("reasoning") if isinstance(payload.get("reasoning"), dict) else model_reasoning\n    reasoning_param = build_reasoning_param(\n        reasoning_effort,\n        reasoning_summary,\n        reasoning_overrides,\n        allowed_efforts=allowed_efforts_for_model(model),\n    )\n    service_tier, tier_error = _service_tier_from_payload(model, payload, verbose=verbose)\n    if tier_error is not None:\n        return tier_error\n    upstream, error_resp = start_upstream_request(\n        model,\n        input_items,\n        reasoning_param=reasoning_param,\n        service_tier=service_tier,\n    )\n    if error_resp is not None:\n        if verbose:\n            try:\n                body = error_resp.get_data(as_text=True)\n                if body:\n                    try:\n                        parsed = json.loads(body)\n                    except Exception:\n                        parsed = body\n                    _log_json("OUT POST /v1/completions", parsed)\n            except Exception:\n                pass\n        return error_resp\n\n    record_rate_limits_from_response(upstream)\n\n    created = int(time.time())\n    if upstream.status_code >= 400:\n        try:\n            err_body = json.loads(upstream.content.decode("utf-8", errors="ignore")) if upstream.content else {"raw": upstream.text}\n        except Exception:\n            err_body = {"raw": upstream.text}\n        err = {"error": {"message": (err_body.get("error", {}) or {}).get("message", "Upstream error")}}\n        if verbose:\n            _log_json("OUT POST /v1/completions", err)\n        return jsonify(err), upstream.status_code\n\n    if stream_req:\n        if verbose:\n            print("OUT POST /v1/completions (streaming response)")\n        stream_iter = sse_translate_text(\n            upstream,\n            requested_model or model,\n            created,\n            verbose=verbose_obfuscation,\n            vlog=(print if verbose_obfuscation else None),\n            include_usage=include_usage,\n        )\n        stream_iter = _wrap_stream_logging("STREAM OUT /v1/completions", stream_iter, verbose)\n        resp = Response(\n            stream_iter,\n            status=upstream.status_code,\n            mimetype="text/event-stream",\n            headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},\n        )\n        for k, v in build_cors_headers().items():\n            resp.headers.setdefault(k, v)\n        return resp\n\n    full_text = ""\n    response_id = "cmpl"\n    usage_obj: Dict[str, int] | None = None\n    def _extract_usage(evt: Dict[str, Any]) -> Dict[str, int] | None:\n        try:\n            usage = (evt.get("response") or {}).get("usage")\n            if not isinstance(usage, dict):\n                return None\n            pt = int(usage.get("input_tokens") or 0)\n            ct = int(usage.get("output_tokens") or 0)\n            tt = int(usage.get("total_tokens") or (pt + ct))\n            return {"prompt_tokens": pt, "completion_tokens": ct, "total_tokens": tt}\n        except Exception:\n            return None\n    try:\n        for raw_line in upstream.iter_lines(decode_unicode=False):\n            if not raw_line:\n                continue\n            line = raw_line.decode("utf-8", errors="ignore") if isinstance(raw_line, (bytes, bytearray)) else raw_line\n            if not line.startswith("data: "):\n                continue\n            data = line[len("data: "):].strip()\n            if not data or data == "[DONE]":\n                if data == "[DONE]":\n                    break\n                continue\n            try:\n                evt = json.loads(data)\n            except Exception:\n                continue\n            if isinstance(evt.get("response"), dict) and isinstance(evt["response"].get("id"), str):\n                response_id = evt["response"].get("id") or response_id\n            mu = _extract_usage(evt)\n            if mu:\n                usage_obj = mu\n            kind = evt.get("type")\n            if kind == "response.output_text.delta":\n                full_text += evt.get("delta") or ""\n            elif kind == "response.completed":\n                break\n    finally:\n        upstream.close()\n\n    completion = {\n        "id": response_id or "cmpl",\n        "object": "text_completion",\n        "created": created,\n        "model": requested_model or model,\n        "choices": [\n            {"index": 0, "text": full_text, "finish_reason": "stop", "logprobs": None}\n        ],\n        **({"usage": usage_obj} if usage_obj else {}),\n    }\n    if verbose:\n        _log_json("OUT POST /v1/completions", completion)\n    resp = make_response(jsonify(completion), upstream.status_code)\n    for k, v in build_cors_headers().items():\n        resp.headers.setdefault(k, v)\n    return resp\n\n\n@openai_bp.route("/v1/responses", methods=["POST"])\ndef responses_create() -> Response:\n    verbose = bool(current_app.config.get("VERBOSE"))\n    raw = request.get_data(cache=True, as_text=True) or ""\n    if verbose:\n        try:\n            print("IN POST /v1/responses\\n" + raw)\n        except Exception:\n            pass\n\n    try:\n        payload = json.loads(raw) if raw else {}\n    except Exception:\n        err = {"error": {"message": "Invalid JSON body"}}\n        if verbose:\n            _log_json("OUT POST /v1/responses", err)\n        return jsonify(err), 400\n\n    if not isinstance(payload, dict):\n        err = {"error": {"message": "Request body must be a JSON object"}}\n        if verbose:\n            _log_json("OUT POST /v1/responses", err)\n        return jsonify(err), 400\n\n    try:\n        normalized = normalize_responses_payload(\n            payload,\n            config=current_app.config,\n            client_session_id=extract_client_session_id(request.headers),\n        )\n    except ResponsesRequestError as exc:\n        err: Dict[str, Any] = {"error": {"message": str(exc)}}\n        if exc.code:\n            err["error"]["code"] = exc.code\n        if verbose:\n            _log_json("OUT POST /v1/responses", err)\n        return jsonify(err), exc.status_code\n\n    if normalized.service_tier_resolution.warning_message and verbose:\n        print(f"[FastMode] {normalized.service_tier_resolution.warning_message}")\n\n    prepared = prepare_responses_request_for_session(\n        normalized.session_id,\n        normalized.payload,\n        allow_previous_response_id=False,\n    )\n    stream_req = bool(prepared.payload.get("stream", False))\n    upstream_payload = dict(prepared.payload)\n    upstream_payload["stream"] = True\n    upstream, error_resp = start_upstream_raw_request(\n        upstream_payload,\n        session_id=normalized.session_id,\n        stream=True,\n    )\n    if error_resp is not None:\n        clear_responses_reuse_state(normalized.session_id)\n        if verbose:\n            try:\n                body = error_resp.get_data(as_text=True)\n                if body:\n                    try:\n                        parsed = json.loads(body)\n                    except Exception:\n                        parsed = body\n                    _log_json("OUT POST /v1/responses", parsed)\n            except Exception:\n                pass\n        return error_resp\n\n    record_rate_limits_from_response(upstream)\n\n    if upstream.status_code >= 400:\n        try:\n            err_body = json.loads(upstream.content.decode("utf-8", errors="ignore")) if upstream.content else {"error": {"message": upstream.text}}\n        except Exception:\n            err_body = {"error": {"message": upstream.text or "Upstream error"}}\n        finally:\n            upstream.close()\n        clear_responses_reuse_state(normalized.session_id)\n        if verbose:\n            _log_json("OUT POST /v1/responses", err_body)\n        resp = make_response(jsonify(err_body), upstream.status_code)\n        for k, v in build_cors_headers().items():\n            resp.headers.setdefault(k, v)\n        return resp\n\n    if stream_req:\n        if verbose:\n            print("OUT POST /v1/responses (streaming response)")\n        stream_iter = _wrap_stream_logging(\n            "STREAM OUT /v1/responses",\n            stream_upstream_bytes(\n                upstream,\n                on_event=lambda evt: note_responses_stream_event(normalized.session_id, evt),\n            ),\n            verbose,\n        )\n        resp = Response(\n            stream_iter,\n            status=upstream.status_code,\n            mimetype="text/event-stream",\n            headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},\n        )\n        for k, v in build_cors_headers().items():\n            resp.headers.setdefault(k, v)\n        return resp\n\n    content_type = upstream.headers.get("Content-Type", "")\n    if "application/json" in content_type.lower():\n        try:\n            body = upstream.json()\n        except Exception:\n            body = None\n        finally:\n            upstream.close()\n        if isinstance(body, dict):\n            note_responses_final_response(normalized.session_id, body)\n            if verbose:\n                _log_json("OUT POST /v1/responses", body)\n            resp = make_response(jsonify(body), upstream.status_code)\n            for k, v in build_cors_headers().items():\n                resp.headers.setdefault(k, v)\n            return resp\n\n    response_obj, error_obj = aggregate_response_from_sse(\n        upstream,\n        on_event=lambda evt: note_responses_stream_event(normalized.session_id, evt),\n    )\n    if error_obj is not None:\n        clear_responses_reuse_state(normalized.session_id)\n        if verbose:\n            _log_json("OUT POST /v1/responses", error_obj)\n        resp = make_response(jsonify(error_obj), 502)\n        for k, v in build_cors_headers().items():\n            resp.headers.setdefault(k, v)\n        return resp\n\n    if response_obj is None:\n        clear_responses_reuse_state(normalized.session_id)\n        err = {"error": {"message": "Upstream response stream did not contain a completed response object"}}\n        if verbose:\n            _log_json("OUT POST /v1/responses", err)\n        resp = make_response(jsonify(err), 502)\n        for k, v in build_cors_headers().items():\n            resp.headers.setdefault(k, v)\n        return resp\n\n    if verbose:\n        _log_json("OUT POST /v1/responses", response_obj)\n    resp = make_response(jsonify(response_obj), upstream.status_code)\n    for k, v in build_cors_headers().items():\n        resp.headers.setdefault(k, v)\n    return resp\n\n\n@openai_bp.route("/v1/models", methods=["GET"])\ndef list_models() -> Response:\n    expose_variants = bool(current_app.config.get("EXPOSE_REASONING_MODELS"))\n    model_ids = list_public_models(expose_reasoning_models=expose_variants)\n    data = [{"id": mid, "object": "model", "owned_by": "owner"} for mid in model_ids]\n    models = {"object": "list", "data": data}\n    resp = make_response(jsonify(models), 200)\n    for k, v in build_cors_headers().items():\n        resp.headers.setdefault(k, v)\n    return resp\n', 'chatmock.session': 'from __future__ import annotations\n\nimport copy\nimport hashlib\nimport json\nimport threading\nimport uuid\nfrom dataclasses import dataclass, field\nfrom typing import Any, Dict, List\n\n\n_LOCK = threading.Lock()\n_FINGERPRINT_TO_UUID: Dict[str, str] = {}\n_ORDER: List[str] = []\n_MAX_ENTRIES = 10000\n_RESPONSES_SESSION_STATE: Dict[str, "_ResponsesSessionState"] = {}\n_RESPONSES_ORDER: List[str] = []\n\n\n@dataclass(frozen=True)\nclass PreparedResponsesRequest:\n    payload: Dict[str, Any]\n    session_id: str\n\n\n@dataclass\nclass _ResponsesSessionState:\n    last_request_payload: Dict[str, Any] | None = None\n    last_response_id: str | None = None\n    last_response_items: List[Dict[str, Any]] = field(default_factory=list)\n    inflight_request_payload: Dict[str, Any] | None = None\n    inflight_track_result: bool = False\n    inflight_response_id: str | None = None\n    inflight_response_items: List[Dict[str, Any]] = field(default_factory=list)\n\n\ndef _canonicalize_first_user_message(input_items: List[Dict[str, Any]]) -> Dict[str, Any] | None:\n    """\n    Extract the first stable user message from Responses input items. Good use for a fingerprint for prompt caching.\n    """\n    for item in input_items:\n        if not isinstance(item, dict):\n            continue\n        if item.get("type") != "message":\n            continue\n        role = item.get("role")\n        if role != "user":\n            continue\n        content = item.get("content")\n        if not isinstance(content, list):\n            continue\n        norm_content = []\n        for part in content:\n            if not isinstance(part, dict):\n                continue\n            ptype = part.get("type")\n            if ptype == "input_text":\n                text = part.get("text") if isinstance(part.get("text"), str) else ""\n                if text:\n                    norm_content.append({"type": "input_text", "text": text})\n            elif ptype == "input_image":\n                url = part.get("image_url") if isinstance(part.get("image_url"), str) else None\n                if url:\n                    norm_content.append({"type": "input_image", "image_url": url})\n        if norm_content:\n            return {"type": "message", "role": "user", "content": norm_content}\n    return None\n\n\ndef canonicalize_prefix(instructions: str | None, input_items: List[Dict[str, Any]]) -> str:\n    prefix: Dict[str, Any] = {}\n    if isinstance(instructions, str) and instructions.strip():\n        prefix["instructions"] = instructions.strip()\n    first_user = _canonicalize_first_user_message(input_items)\n    if first_user is not None:\n        prefix["first_user_message"] = first_user\n    return json.dumps(prefix, sort_keys=True, separators=(",", ":"))\n\n\ndef _fingerprint(s: str) -> str:\n    return hashlib.sha256(s.encode("utf-8")).hexdigest()\n\n\ndef _remember(fp: str, sid: str) -> None:\n    if fp in _FINGERPRINT_TO_UUID:\n        return\n    _FINGERPRINT_TO_UUID[fp] = sid\n    _ORDER.append(fp)\n    if len(_ORDER) > _MAX_ENTRIES:\n        oldest = _ORDER.pop(0)\n        _FINGERPRINT_TO_UUID.pop(oldest, None)\n\n\ndef _remember_responses_session(session_id: str) -> _ResponsesSessionState:\n    state = _RESPONSES_SESSION_STATE.get(session_id)\n    if state is None:\n        state = _ResponsesSessionState()\n        _RESPONSES_SESSION_STATE[session_id] = state\n        _RESPONSES_ORDER.append(session_id)\n        if len(_RESPONSES_ORDER) > _MAX_ENTRIES:\n            oldest = _RESPONSES_ORDER.pop(0)\n            _RESPONSES_SESSION_STATE.pop(oldest, None)\n    return state\n\n\ndef _request_without_input(payload: Dict[str, Any]) -> Dict[str, Any]:\n    clone = copy.deepcopy(payload)\n    clone["input"] = []\n    clone.pop("previous_response_id", None)\n    return clone\n\n\ndef _input_list(payload: Dict[str, Any]) -> List[Dict[str, Any]] | None:\n    raw = payload.get("input")\n    if not isinstance(raw, list):\n        return None\n    return [item for item in copy.deepcopy(raw) if isinstance(item, dict)]\n\n\ndef _conversation_output_items(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:\n    reusable: List[Dict[str, Any]] = []\n    for item in items:\n        if not isinstance(item, dict):\n            continue\n        item_type = item.get("type")\n        if item_type == "reasoning":\n            continue\n        reusable.append(copy.deepcopy(item))\n    return reusable\n\n\ndef _clear_reuse_state(state: _ResponsesSessionState) -> None:\n    state.last_request_payload = None\n    state.last_response_id = None\n    state.last_response_items = []\n    state.inflight_request_payload = None\n    state.inflight_track_result = False\n    state.inflight_response_id = None\n    state.inflight_response_items = []\n\n\ndef _clear_inflight(state: _ResponsesSessionState) -> None:\n    state.inflight_request_payload = None\n    state.inflight_track_result = False\n    state.inflight_response_id = None\n    state.inflight_response_items = []\n\n\ndef ensure_session_id(\n    instructions: str | None,\n    input_items: List[Dict[str, Any]],\n    client_supplied: str | None = None,\n) -> str:\n    if isinstance(client_supplied, str) and client_supplied.strip():\n        return client_supplied.strip()\n\n    canon = canonicalize_prefix(instructions, input_items)\n    fp = _fingerprint(canon)\n    with _LOCK:\n        if fp in _FINGERPRINT_TO_UUID:\n            return _FINGERPRINT_TO_UUID[fp]\n        sid = str(uuid.uuid4())\n        _remember(fp, sid)\n        return sid\n\n\ndef prepare_responses_request_for_session(\n    session_id: str,\n    payload: Dict[str, Any],\n    *,\n    allow_previous_response_id: bool = True,\n) -> PreparedResponsesRequest:\n    full_payload = copy.deepcopy(payload)\n    outbound_payload = copy.deepcopy(payload)\n    explicit_previous_response_id = (\n        isinstance(full_payload.get("previous_response_id"), str)\n        and bool(full_payload.get("previous_response_id").strip())\n    )\n\n    with _LOCK:\n        state = _remember_responses_session(session_id)\n\n        if explicit_previous_response_id:\n            _clear_reuse_state(state)\n            return PreparedResponsesRequest(\n                payload=outbound_payload,\n                session_id=session_id,\n            )\n\n        request_input = _input_list(full_payload)\n        if (\n            allow_previous_response_id\n            and\n            state.last_request_payload is not None\n            and state.last_response_id\n            and request_input is not None\n            and _request_without_input(state.last_request_payload) == _request_without_input(full_payload)\n        ):\n            baseline: List[Dict[str, Any]] = []\n            previous_input = _input_list(state.last_request_payload)\n            if previous_input is not None:\n                baseline.extend(previous_input)\n            baseline.extend(copy.deepcopy(state.last_response_items))\n            baseline_len = len(baseline)\n            if request_input[:baseline_len] == baseline and baseline_len <= len(request_input):\n                outbound_payload["input"] = copy.deepcopy(request_input[baseline_len:])\n                outbound_payload["previous_response_id"] = state.last_response_id\n\n        state.inflight_request_payload = full_payload\n        state.inflight_track_result = True\n        state.inflight_response_id = None\n        state.inflight_response_items = []\n\n    return PreparedResponsesRequest(\n        payload=outbound_payload,\n        session_id=session_id,\n    )\n\n\ndef note_responses_stream_event(session_id: str, event: Dict[str, Any]) -> None:\n    if not isinstance(session_id, str) or not session_id.strip():\n        return\n    if not isinstance(event, dict):\n        return\n\n    with _LOCK:\n        state = _RESPONSES_SESSION_STATE.get(session_id)\n        if state is None:\n            return\n\n        kind = event.get("type")\n        if kind == "response.created":\n            response = event.get("response")\n            if isinstance(response, dict) and isinstance(response.get("id"), str):\n                state.inflight_response_id = response.get("id")\n            return\n\n        if kind == "response.output_item.done":\n            item = event.get("item")\n            if isinstance(item, dict):\n                state.inflight_response_items.append(copy.deepcopy(item))\n            return\n\n        if kind == "response.completed":\n            response = event.get("response")\n            response_id = None\n            response_items: List[Dict[str, Any]] = copy.deepcopy(state.inflight_response_items)\n            if isinstance(response, dict):\n                if isinstance(response.get("id"), str):\n                    response_id = response.get("id")\n                output = response.get("output")\n                if isinstance(output, list) and output:\n                    response_items = [copy.deepcopy(item) for item in output if isinstance(item, dict)]\n            if not response_id:\n                response_id = state.inflight_response_id\n\n            if state.inflight_track_result and state.inflight_request_payload is not None and response_id:\n                state.last_request_payload = copy.deepcopy(state.inflight_request_payload)\n                state.last_response_id = response_id\n                state.last_response_items = _conversation_output_items(response_items)\n            else:\n                state.last_request_payload = None\n                state.last_response_id = None\n                state.last_response_items = []\n            _clear_inflight(state)\n            return\n\n        if kind in ("response.failed", "error"):\n            _clear_reuse_state(state)\n\n\ndef note_responses_final_response(session_id: str, response_obj: Dict[str, Any]) -> None:\n    if not isinstance(session_id, str) or not session_id.strip():\n        return\n    if not isinstance(response_obj, dict):\n        return\n\n    with _LOCK:\n        state = _RESPONSES_SESSION_STATE.get(session_id)\n        if state is None:\n            return\n\n        response_id = response_obj.get("id") if isinstance(response_obj.get("id"), str) else None\n        output = response_obj.get("output")\n        output_items = [copy.deepcopy(item) for item in output if isinstance(item, dict)] if isinstance(output, list) else []\n        if state.inflight_track_result and state.inflight_request_payload is not None and response_id:\n            state.last_request_payload = copy.deepcopy(state.inflight_request_payload)\n            state.last_response_id = response_id\n            state.last_response_items = _conversation_output_items(output_items)\n        else:\n            state.last_request_payload = None\n            state.last_response_id = None\n            state.last_response_items = []\n        _clear_inflight(state)\n\n\ndef clear_responses_reuse_state(session_id: str) -> None:\n    if not isinstance(session_id, str) or not session_id.strip():\n        return\n    with _LOCK:\n        state = _RESPONSES_SESSION_STATE.get(session_id)\n        if state is None:\n            return\n        _clear_reuse_state(state)\n\n\ndef reset_session_state() -> None:\n    with _LOCK:\n        _FINGERPRINT_TO_UUID.clear()\n        _ORDER.clear()\n        _RESPONSES_SESSION_STATE.clear()\n        _RESPONSES_ORDER.clear()\n', 'chatmock.transform': 'from __future__ import annotations\n\nimport json\nfrom typing import Any, Dict, List\n\n\ndef to_data_url(image_str: str) -> str:\n    if not isinstance(image_str, str) or not image_str:\n        return image_str\n    s = image_str.strip()\n    if s.startswith("data:image/"):\n        return s\n    if s.startswith("http://") or s.startswith("https://"):\n        return s\n    b64 = s.replace("\\n", "").replace("\\r", "")\n    kind = "image/png"\n    if b64.startswith("/9j/"):\n        kind = "image/jpeg"\n    elif b64.startswith("iVBORw0KGgo"):\n        kind = "image/png"\n    elif b64.startswith("R0lGOD"):\n        kind = "image/gif"\n    return f"data:{kind};base64,{b64}"\n\n\ndef convert_ollama_messages(\n    messages: List[Dict[str, Any]] | None, top_images: List[str] | None\n) -> List[Dict[str, Any]]:\n    out: List[Dict[str, Any]] = []\n    msgs = messages if isinstance(messages, list) else []\n    pending_call_ids: List[str] = []\n    call_counter = 0\n    for m in msgs:\n        if not isinstance(m, dict):\n            continue\n        role = m.get("role") or "user"\n        nm: Dict[str, Any] = {"role": role}\n\n        content = m.get("content")\n        images = m.get("images") if isinstance(m.get("images"), list) else []\n        parts: List[Dict[str, Any]] = []\n        if isinstance(content, list):\n            for p in content:\n                if isinstance(p, dict) and p.get("type") == "text" and isinstance(p.get("text"), str):\n                    parts.append({"type": "text", "text": p.get("text")})\n        elif isinstance(content, str):\n            parts.append({"type": "text", "text": content})\n        for img in images:\n            url = to_data_url(img)\n            if isinstance(url, str) and url:\n                parts.append({"type": "image_url", "image_url": {"url": url}})\n        if parts:\n            nm["content"] = parts\n\n        if role == "assistant" and isinstance(m.get("tool_calls"), list):\n            tcs = []\n            for tc in m.get("tool_calls"):\n                if not isinstance(tc, dict):\n                    continue\n                fn = tc.get("function") if isinstance(tc.get("function"), dict) else {}\n                name = fn.get("name") if isinstance(fn.get("name"), str) else None\n                args = fn.get("arguments")\n                if name is None:\n                    continue\n                call_id = tc.get("id") or tc.get("call_id")\n                if not isinstance(call_id, str) or not call_id:\n                    call_counter += 1\n                    call_id = f"ollama_call_{call_counter}"\n                pending_call_ids.append(call_id)\n                tcs.append(\n                    {\n                        "id": call_id,\n                        "type": "function",\n                        "function": {\n                            "name": name,\n                            "arguments": args if isinstance(args, str) else (json.dumps(args) if isinstance(args, dict) else "{}"),\n                        },\n                    }\n                )\n            if tcs:\n                nm["tool_calls"] = tcs\n\n        if role == "tool":\n            tci = m.get("tool_call_id") or m.get("id")\n            if not isinstance(tci, str) or not tci:\n                if pending_call_ids:\n                    tci = pending_call_ids.pop(0)\n            if isinstance(tci, str) and tci:\n                nm["tool_call_id"] = tci\n\n            if not parts and isinstance(content, str):\n                nm["content"] = content\n\n        out.append(nm)\n\n    if isinstance(top_images, list) and top_images:\n        attach_to = None\n        for i in range(len(out) - 1, -1, -1):\n            if out[i].get("role") == "user":\n                attach_to = out[i]\n                break\n        if attach_to is None:\n            attach_to = {"role": "user", "content": []}\n            out.append(attach_to)\n        attach_to.setdefault("content", [])\n        for img in top_images:\n            url = to_data_url(img)\n            if isinstance(url, str) and url:\n                attach_to["content"].append({"type": "image_url", "image_url": {"url": url}})\n    return out\n\n\ndef normalize_ollama_tools(tools: List[Dict[str, Any]] | None) -> List[Dict[str, Any]]:\n    out: List[Dict[str, Any]] = []\n    if not isinstance(tools, list):\n        return out\n    for t in tools:\n        if not isinstance(t, dict):\n            continue\n        if isinstance(t.get("function"), dict):\n            fn = t.get("function")\n            name = fn.get("name") if isinstance(fn.get("name"), str) else None\n            if not name:\n                continue\n            out.append(\n                {\n                    "type": "function",\n                    "function": {\n                        "name": name,\n                        "description": fn.get("description") or "",\n                        "parameters": fn.get("parameters") if isinstance(fn.get("parameters"), dict) else {"type": "object", "properties": {}},\n                    },\n                }\n            )\n            continue\n        name = t.get("name") if isinstance(t.get("name"), str) else None\n        if name:\n            out.append(\n                {\n                    "type": "function",\n                    "function": {\n                        "name": name,\n                        "description": t.get("description") or "",\n                        "parameters": {"type": "object", "properties": {}},\n                    },\n                }\n            )\n    return out\n\n', 'chatmock.upstream': 'from __future__ import annotations\n\nimport json\nimport time\nfrom typing import Any, Dict, List, Tuple\nfrom urllib.parse import urlparse, urlunparse\n\nimport requests\nfrom flask import Response, current_app, jsonify, make_response\n\nfrom .config import CHATGPT_RESPONSES_URL, ORIGINATOR\nfrom .http import build_cors_headers\nfrom .model_registry import normalize_model_name\nfrom .session import ensure_session_id\nfrom flask import request as flask_request\nfrom .utils import get_codex_user_agent, get_effective_chatgpt_auth, resolve_installation_id\n\n\ndef _log_json(prefix: str, payload: Any) -> None:\n    try:\n        print(f"{prefix}\\n{json.dumps(payload, indent=2, ensure_ascii=False)}")\n    except Exception:\n        try:\n            print(f"{prefix}\\n{payload}")\n        except Exception:\n            pass\n\ndef start_upstream_request(\n    model: str,\n    input_items: List[Dict[str, Any]],\n    *,\n    instructions: str | None = None,\n    tools: List[Dict[str, Any]] | None = None,\n    tool_choice: Any | None = None,\n    parallel_tool_calls: bool = False,\n    reasoning_param: Dict[str, Any] | None = None,\n    service_tier: str | None = None,\n):\n    access_token, account_id = get_effective_chatgpt_auth()\n    if not access_token or not account_id:\n        resp = make_response(\n            jsonify(\n                {\n                    "error": {\n                        "message": "Missing ChatGPT credentials. Run \'python3 chatmock.py login\' first.",\n                    }\n                }\n            ),\n            401,\n        )\n        for k, v in build_cors_headers().items():\n            resp.headers.setdefault(k, v)\n        return None, resp\n\n    include: List[str] = []\n    if isinstance(reasoning_param, dict):\n        include.append("reasoning.encrypted_content")\n\n    client_session_id = None\n    try:\n        client_session_id = (\n            flask_request.headers.get("X-Session-Id")\n            or flask_request.headers.get("session_id")\n            or None\n        )\n    except Exception:\n        client_session_id = None\n    session_id = ensure_session_id(instructions, input_items, client_session_id)\n\n    responses_payload = {\n        "model": model,\n        "input": input_items,\n        "tools": tools or [],\n        "tool_choice": tool_choice if tool_choice in ("auto", "none") or isinstance(tool_choice, dict) else "auto",\n        "parallel_tool_calls": bool(parallel_tool_calls),\n        "store": False,\n        "stream": True,\n        "prompt_cache_key": session_id,\n    }\n    if isinstance(instructions, str) and instructions.strip():\n        responses_payload["instructions"] = instructions\n    if include:\n        responses_payload["include"] = include\n\n    if reasoning_param is not None:\n        responses_payload["reasoning"] = reasoning_param\n    if isinstance(service_tier, str) and service_tier.strip():\n        responses_payload["service_tier"] = service_tier.strip().lower()\n\n    return start_upstream_raw_request(\n        responses_payload,\n        session_id=session_id,\n        stream=True,\n    )\n\n\ndef build_upstream_headers(\n    access_token: str,\n    account_id: str,\n    session_id: str,\n    *,\n    accept: str = "text/event-stream",\n) -> Dict[str, str]:\n    return {\n        "Authorization": f"Bearer {access_token}",\n        "Content-Type": "application/json",\n        "Accept": accept,\n        "ChatGPT-Account-ID": account_id,\n        "User-Agent": get_codex_user_agent(),\n        "originator": ORIGINATOR,\n        "OpenAI-Beta": "responses=experimental",\n        "session-id": session_id,\n        "x-codex-installation-id": resolve_installation_id(),\n    }\n\n\ndef start_upstream_raw_request(\n    responses_payload: Dict[str, Any],\n    *,\n    session_id: str | None = None,\n    stream: bool = True,\n):\n    access_token, account_id = get_effective_chatgpt_auth()\n    if not access_token or not account_id:\n        resp = make_response(\n            jsonify(\n                {\n                    "error": {\n                        "message": "Missing ChatGPT credentials. Run \'python3 chatmock.py login\' first.",\n                    }\n                }\n            ),\n            401,\n        )\n        for k, v in build_cors_headers().items():\n            resp.headers.setdefault(k, v)\n        return None, resp\n\n    effective_session_id = session_id\n    if not isinstance(effective_session_id, str) or not effective_session_id.strip():\n        payload_prompt_cache_key = responses_payload.get("prompt_cache_key")\n        if isinstance(payload_prompt_cache_key, str) and payload_prompt_cache_key.strip():\n            effective_session_id = payload_prompt_cache_key.strip()\n    if not isinstance(effective_session_id, str) or not effective_session_id.strip():\n        effective_session_id = str(int(time.time() * 1000))\n\n    verbose = False\n    try:\n        verbose = bool(current_app.config.get("VERBOSE"))\n    except Exception:\n        verbose = False\n    if verbose:\n        _log_json("OUTBOUND >> ChatGPT Responses API payload", responses_payload)\n\n    payload_to_send = dict(responses_payload)\n    if not (isinstance(payload_to_send.get("instructions"), str) and payload_to_send["instructions"].strip()):\n        payload_to_send.pop("instructions", None)\n    client_metadata = payload_to_send.get("client_metadata")\n    if not isinstance(client_metadata, dict):\n        client_metadata = {}\n    else:\n        client_metadata = dict(client_metadata)\n    client_metadata.setdefault("x-codex-installation-id", resolve_installation_id())\n    payload_to_send["client_metadata"] = client_metadata\n\n    headers = build_upstream_headers(\n        access_token,\n        account_id,\n        effective_session_id,\n        accept=("text/event-stream" if stream else "application/json"),\n    )\n\n    try:\n        upstream = requests.post(\n            CHATGPT_RESPONSES_URL,\n            headers=headers,\n            json=payload_to_send,\n            stream=stream,\n            timeout=600,\n        )\n    except requests.RequestException as e:\n        resp = make_response(jsonify({"error": {"message": f"Upstream ChatGPT request failed: {e}"}}), 502)\n        for k, v in build_cors_headers().items():\n            resp.headers.setdefault(k, v)\n        return None, resp\n\n    if upstream.status_code == 401:\n        refreshed_access_token, refreshed_account_id = get_effective_chatgpt_auth(force_refresh=True)\n        if (\n            isinstance(refreshed_access_token, str)\n            and refreshed_access_token\n            and isinstance(refreshed_account_id, str)\n            and refreshed_account_id\n            and refreshed_access_token != access_token\n        ):\n            try:\n                upstream.close()\n            except Exception:\n                pass\n            retry_headers = build_upstream_headers(\n                refreshed_access_token,\n                refreshed_account_id,\n                effective_session_id,\n                accept=("text/event-stream" if stream else "application/json"),\n            )\n            try:\n                upstream = requests.post(\n                    CHATGPT_RESPONSES_URL,\n                    headers=retry_headers,\n                    json=payload_to_send,\n                    stream=stream,\n                    timeout=600,\n                )\n            except requests.RequestException as e:\n                resp = make_response(jsonify({"error": {"message": f"Upstream ChatGPT request failed after token refresh: {e}"}}), 502)\n                for k, v in build_cors_headers().items():\n                    resp.headers.setdefault(k, v)\n                return None, resp\n    return upstream, None\n\n\ndef build_upstream_websocket_url() -> str:\n    parsed = urlparse(CHATGPT_RESPONSES_URL)\n    scheme = parsed.scheme.lower()\n    if scheme == "https":\n        parsed = parsed._replace(scheme="wss")\n    elif scheme == "http":\n        parsed = parsed._replace(scheme="ws")\n    return urlunparse(parsed)\n', 'chatmock.utils': 'from __future__ import annotations\n\nimport base64\nimport datetime\nimport hashlib\nimport json\nimport os\nimport platform\nimport secrets\nimport sys\nimport uuid\nfrom typing import Any, Dict, List, Optional, Tuple\n\nimport requests\n\nfrom .config import CLIENT_ID_DEFAULT, OAUTH_TOKEN_URL\nfrom .version import __version__\n\n\ndef eprint(*args, **kwargs) -> None:\n    print(*args, file=sys.stderr, **kwargs)\n\n\ndef get_home_dir() -> str:\n    home = os.getenv("CHATGPT_LOCAL_HOME") or os.getenv("CODEX_HOME")\n    if not home:\n        home = os.path.expanduser("~/.chatgpt-local")\n    return home\n\n\ndef get_codex_user_agent() -> str:\n    system = platform.system() or "Unknown OS"\n    release = platform.release() or "unknown"\n    machine = platform.machine() or "unknown"\n    return f"chatmock/{__version__} ({system} {release}; {machine})"\n\n\ndef resolve_installation_id() -> str:\n    home = get_home_dir()\n    path = os.path.join(home, "installation_id")\n    try:\n        os.makedirs(home, exist_ok=True)\n        try:\n            with open(path, "r", encoding="utf-8") as fp:\n                existing = fp.read().strip()\n            return str(uuid.UUID(existing))\n        except Exception:\n            installation_id = str(uuid.uuid4())\n            with open(path, "w", encoding="utf-8") as fp:\n                fp.write(installation_id)\n            return installation_id\n    except Exception:\n        return str(uuid.uuid4())\n\n\ndef read_auth_file() -> Dict[str, Any] | None:\n    for base in [\n        os.getenv("CHATGPT_LOCAL_HOME"),\n        os.getenv("CODEX_HOME"),\n        os.path.expanduser("~/.chatgpt-local"),\n        os.path.expanduser("~/.codex"),\n    ]:\n        if not base:\n            continue\n        path = os.path.join(base, "auth.json")\n        try:\n            with open(path, "r", encoding="utf-8") as f:\n                return json.load(f)\n        except FileNotFoundError:\n            continue\n        except Exception:\n            continue\n    return None\n\n\ndef write_auth_file(auth: Dict[str, Any]) -> bool:\n    home = get_home_dir()\n    try:\n        os.makedirs(home, exist_ok=True)\n    except Exception as exc:\n        eprint(f"ERROR: unable to create auth home directory {home}: {exc}")\n        return False\n    path = os.path.join(home, "auth.json")\n    try:\n        with open(path, "w", encoding="utf-8") as fp:\n            if hasattr(os, "fchmod"):\n                os.fchmod(fp.fileno(), 0o600)\n            json.dump(auth, fp, indent=2)\n        return True\n    except Exception as exc:\n        eprint(f"ERROR: unable to write auth file: {exc}")\n        return False\n\n\ndef parse_jwt_claims(token: str) -> Dict[str, Any] | None:\n    if not token or token.count(".") != 2:\n        return None\n    try:\n        _, payload, _ = token.split(".")\n        padded = payload + "=" * (-len(payload) % 4)\n        data = base64.urlsafe_b64decode(padded.encode())\n        return json.loads(data.decode())\n    except Exception:\n        return None\n\n\ndef generate_pkce() -> "PkceCodes":\n    from .models import PkceCodes\n\n    code_verifier = secrets.token_hex(64)\n    digest = hashlib.sha256(code_verifier.encode()).digest()\n    code_challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()\n    return PkceCodes(code_verifier=code_verifier, code_challenge=code_challenge)\n\n\ndef convert_chat_messages_to_responses_input(messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:\n    def _normalize_image_data_url(url: str) -> str:\n        try:\n            if not isinstance(url, str):\n                return url\n            if not url.startswith("data:image/"):\n                return url\n            if ";base64," not in url:\n                return url\n            header, data = url.split(",", 1)\n            try:\n                from urllib.parse import unquote\n\n                data = unquote(data)\n            except Exception:\n                pass\n            data = data.strip().replace("\\n", "").replace("\\r", "")\n            data = data.replace("-", "+").replace("_", "/")\n            pad = (-len(data)) % 4\n            if pad:\n                data = data + ("=" * pad)\n            try:\n                base64.b64decode(data, validate=True)\n            except Exception:\n                return url\n            return f"{header},{data}"\n        except Exception:\n            return url\n\n    input_items: List[Dict[str, Any]] = []\n    for message in messages:\n        role = message.get("role")\n        if role == "system":\n            continue\n\n        if role == "tool":\n            call_id = message.get("tool_call_id") or message.get("id")\n            if isinstance(call_id, str) and call_id:\n                content = message.get("content", "")\n                if isinstance(content, list):\n                    texts = []\n                    for part in content:\n                        if isinstance(part, dict):\n                            t = part.get("text") or part.get("content")\n                            if isinstance(t, str) and t:\n                                texts.append(t)\n                    content = "\\n".join(texts)\n                if isinstance(content, str):\n                    input_items.append(\n                        {\n                            "type": "function_call_output",\n                            "call_id": call_id,\n                            "output": content,\n                        }\n                    )\n            continue\n        if role == "assistant" and isinstance(message.get("tool_calls"), list):\n            for tc in message.get("tool_calls") or []:\n                if not isinstance(tc, dict):\n                    continue\n                tc_type = tc.get("type", "function")\n                if tc_type != "function":\n                    continue\n                call_id = tc.get("id") or tc.get("call_id")\n                fn = tc.get("function") if isinstance(tc.get("function"), dict) else {}\n                name = fn.get("name") if isinstance(fn, dict) else None\n                args = fn.get("arguments") if isinstance(fn, dict) else None\n                if isinstance(call_id, str) and isinstance(name, str) and isinstance(args, str):\n                    input_items.append(\n                        {\n                            "type": "function_call",\n                            "name": name,\n                            "arguments": args,\n                            "call_id": call_id,\n                        }\n                    )\n\n        content = message.get("content", "")\n        content_items: List[Dict[str, Any]] = []\n        if isinstance(content, list):\n            for part in content:\n                if not isinstance(part, dict):\n                    continue\n                ptype = part.get("type")\n                if ptype == "text":\n                    text = part.get("text") or part.get("content") or ""\n                    if isinstance(text, str) and text:\n                        kind = "output_text" if role == "assistant" else "input_text"\n                        content_items.append({"type": kind, "text": text})\n                elif ptype == "image_url":\n                    image = part.get("image_url")\n                    url = image.get("url") if isinstance(image, dict) else image\n                    if isinstance(url, str) and url:\n                        content_items.append({"type": "input_image", "image_url": _normalize_image_data_url(url)})\n        elif isinstance(content, str) and content:\n            kind = "output_text" if role == "assistant" else "input_text"\n            content_items.append({"type": kind, "text": content})\n\n        if not content_items:\n            continue\n        role_out = "assistant" if role == "assistant" else "user"\n        input_items.append({"type": "message", "role": role_out, "content": content_items})\n    return input_items\n\n\ndef convert_tools_chat_to_responses(tools: Any) -> List[Dict[str, Any]]:\n    out: List[Dict[str, Any]] = []\n    if not isinstance(tools, list):\n        return out\n    for t in tools:\n        if not isinstance(t, dict):\n            continue\n        if t.get("type") != "function":\n            continue\n        fn = t.get("function") if isinstance(t.get("function"), dict) else {}\n        name = fn.get("name") if isinstance(fn, dict) else None\n        if not isinstance(name, str) or not name:\n            continue\n        desc = fn.get("description") if isinstance(fn, dict) else None\n        params = fn.get("parameters") if isinstance(fn, dict) else None\n        if not isinstance(params, dict):\n            params = {"type": "object", "properties": {}}\n        out.append(\n            {\n                "type": "function",\n                "name": name,\n                "description": desc or "",\n                "strict": False,\n                "parameters": params,\n            }\n        )\n    return out\n\n\ndef load_chatgpt_tokens(\n    ensure_fresh: bool = True,\n    *,\n    force_refresh: bool = False,\n) -> tuple[str | None, str | None, str | None]:\n    auth = read_auth_file()\n    if not isinstance(auth, dict):\n        return None, None, None\n\n    tokens = auth.get("tokens") if isinstance(auth.get("tokens"), dict) else {}\n    access_token: Optional[str] = tokens.get("access_token")\n    account_id: Optional[str] = tokens.get("account_id")\n    id_token: Optional[str] = tokens.get("id_token")\n    refresh_token: Optional[str] = tokens.get("refresh_token")\n    last_refresh = auth.get("last_refresh")\n\n    if ensure_fresh and isinstance(refresh_token, str) and refresh_token and CLIENT_ID_DEFAULT:\n        needs_refresh = _should_refresh_access_token(access_token, last_refresh)\n        if force_refresh or needs_refresh or not (isinstance(access_token, str) and access_token):\n            refreshed = _refresh_chatgpt_tokens(refresh_token, CLIENT_ID_DEFAULT)\n            if refreshed:\n                access_token = refreshed.get("access_token") or access_token\n                id_token = refreshed.get("id_token") or id_token\n                refresh_token = refreshed.get("refresh_token") or refresh_token\n                account_id = refreshed.get("account_id") or account_id\n\n                updated_tokens = dict(tokens)\n                if isinstance(access_token, str) and access_token:\n                    updated_tokens["access_token"] = access_token\n                if isinstance(id_token, str) and id_token:\n                    updated_tokens["id_token"] = id_token\n                if isinstance(refresh_token, str) and refresh_token:\n                    updated_tokens["refresh_token"] = refresh_token\n                if isinstance(account_id, str) and account_id:\n                    updated_tokens["account_id"] = account_id\n\n                persisted = _persist_refreshed_auth(auth, updated_tokens)\n                if persisted is not None:\n                    auth, tokens = persisted\n                else:\n                    tokens = updated_tokens\n\n    if not isinstance(account_id, str) or not account_id:\n        account_id = _derive_account_id(id_token)\n\n    access_token = access_token if isinstance(access_token, str) and access_token else None\n    id_token = id_token if isinstance(id_token, str) and id_token else None\n    account_id = account_id if isinstance(account_id, str) and account_id else None\n    return access_token, account_id, id_token\n\n\ndef force_refresh_chatgpt_auth() -> tuple[str | None, str | None]:\n    access_token, account_id, id_token = load_chatgpt_tokens(force_refresh=True)\n    if not account_id:\n        account_id = _derive_account_id(id_token)\n    return access_token, account_id\n\n\ndef force_refresh_chatgpt_auth() -> tuple[str | None, str | None]:\n    access_token, account_id, id_token = load_chatgpt_tokens(force_refresh=True)\n    if not account_id:\n        account_id = _derive_account_id(id_token)\n    return access_token, account_id\n\n\ndef _should_refresh_access_token(access_token: Optional[str], last_refresh: Any) -> bool:\n    if not isinstance(access_token, str) or not access_token:\n        return True\n\n    claims = parse_jwt_claims(access_token) or {}\n    exp = claims.get("exp") if isinstance(claims, dict) else None\n    now = datetime.datetime.now(datetime.timezone.utc)\n    if isinstance(exp, (int, float)):\n        try:\n            expiry = datetime.datetime.fromtimestamp(float(exp), datetime.timezone.utc)\n        except (OverflowError, OSError, ValueError):\n            expiry = None\n        if expiry is not None:\n            return expiry <= now + datetime.timedelta(minutes=5)\n\n    if isinstance(last_refresh, str):\n        refreshed_at = _parse_iso8601(last_refresh)\n        if refreshed_at is not None:\n            return refreshed_at <= now - datetime.timedelta(minutes=55)\n    return False\n\n\ndef _refresh_chatgpt_tokens(refresh_token: str, client_id: str) -> Optional[Dict[str, Optional[str]]]:\n    payload = {\n        "grant_type": "refresh_token",\n        "refresh_token": refresh_token,\n        "client_id": client_id,\n    }\n\n    try:\n        resp = requests.post(\n            OAUTH_TOKEN_URL,\n            data=payload,\n            headers={"Content-Type": "application/x-www-form-urlencoded"},\n            timeout=30,\n        )\n    except requests.RequestException as exc:\n        eprint(f"ERROR: failed to refresh ChatGPT token: {exc}")\n        return None\n\n    if resp.status_code >= 400:\n        eprint(f"ERROR: refresh token request returned status {resp.status_code}")\n        return None\n\n    try:\n        data = resp.json()\n    except ValueError as exc:\n        eprint(f"ERROR: unable to parse refresh token response: {exc}")\n        return None\n\n    id_token = data.get("id_token")\n    access_token = data.get("access_token")\n    new_refresh_token = data.get("refresh_token") or refresh_token\n    if not isinstance(id_token, str) or not isinstance(access_token, str):\n        eprint("ERROR: refresh token response missing expected tokens")\n        return None\n\n    account_id = _derive_account_id(id_token)\n    new_refresh_token = new_refresh_token if isinstance(new_refresh_token, str) and new_refresh_token else refresh_token\n    return {\n        "id_token": id_token,\n        "access_token": access_token,\n        "refresh_token": new_refresh_token,\n        "account_id": account_id,\n    }\n\n\ndef _persist_refreshed_auth(auth: Dict[str, Any], updated_tokens: Dict[str, Any]) -> Optional[Tuple[Dict[str, Any], Dict[str, Any]]]:\n    updated_auth = dict(auth)\n    updated_auth["tokens"] = updated_tokens\n    updated_auth["last_refresh"] = _now_iso8601()\n    if write_auth_file(updated_auth):\n        return updated_auth, updated_tokens\n    eprint("ERROR: unable to persist refreshed auth tokens")\n    return None\n\n\ndef _derive_account_id(id_token: Optional[str]) -> Optional[str]:\n    if not isinstance(id_token, str) or not id_token:\n        return None\n    claims = parse_jwt_claims(id_token) or {}\n    auth_claims = claims.get("https://api.openai.com/auth") if isinstance(claims, dict) else None\n    if isinstance(auth_claims, dict):\n        account_id = auth_claims.get("chatgpt_account_id")\n        if isinstance(account_id, str) and account_id:\n            return account_id\n    return None\n\n\ndef _parse_iso8601(value: str) -> Optional[datetime.datetime]:\n    try:\n        if value.endswith("Z"):\n            value = value[:-1] + "+00:00"\n        dt = datetime.datetime.fromisoformat(value)\n        if dt.tzinfo is None:\n            dt = dt.replace(tzinfo=datetime.timezone.utc)\n        return dt.astimezone(datetime.timezone.utc)\n    except Exception:\n        return None\n\n\ndef _now_iso8601() -> str:\n    return datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")\n\n\ndef get_effective_chatgpt_auth(*, force_refresh: bool = False) -> tuple[str | None, str | None]:\n    access_token, account_id, id_token = load_chatgpt_tokens(force_refresh=force_refresh)\n    if not account_id:\n        account_id = _derive_account_id(id_token)\n    return access_token, account_id\n\n\ndef sse_translate_chat(\n    upstream,\n    model: str,\n    created: int,\n    verbose: bool = False,\n    vlog=None,\n    reasoning_compat: str = "think-tags",\n    *,\n    include_usage: bool = False,\n):\n    response_id = "chatcmpl-stream"\n    compat = (reasoning_compat or "think-tags").strip().lower()\n    think_open = False\n    think_closed = False\n    saw_output = False\n    sent_stop_chunk = False\n    saw_function_call = False\n    saw_any_summary = False\n    pending_summary_paragraph = False\n    upstream_usage = None\n    ws_state: dict[str, Any] = {}\n    ws_index: dict[str, int] = {}\n    ws_next_index: int = 0\n    \n    def _serialize_tool_args(eff_args: Any) -> str:\n        """\n        Serialize tool call arguments with proper JSON handling.\n        \n        Args:\n            eff_args: Arguments to serialize (dict, list, str, or other)\n            \n        Returns:\n            JSON string representation of the arguments\n        """\n        if isinstance(eff_args, (dict, list)):\n            return json.dumps(eff_args)\n        elif isinstance(eff_args, str):\n            try:\n                parsed = json.loads(eff_args)\n                if isinstance(parsed, (dict, list)):\n                    return json.dumps(parsed) \n                else:\n                    return json.dumps({"query": eff_args})  \n            except (json.JSONDecodeError, ValueError):\n                return json.dumps({"query": eff_args})\n        else:\n            return "{}"\n    \n    def _extract_usage(evt: Dict[str, Any]) -> Dict[str, int] | None:\n        try:\n            usage = (evt.get("response") or {}).get("usage")\n            if not isinstance(usage, dict):\n                return None\n            pt = int(usage.get("input_tokens") or 0)\n            ct = int(usage.get("output_tokens") or 0)\n            tt = int(usage.get("total_tokens") or (pt + ct))\n            return {"prompt_tokens": pt, "completion_tokens": ct, "total_tokens": tt}\n        except Exception:\n            return None\n    try:\n        try:\n            line_iterator = upstream.iter_lines(decode_unicode=False)\n        except requests.exceptions.ChunkedEncodingError as e:\n            if verbose and vlog:\n                vlog(f"Failed to start stream: {e}")\n            yield b"data: [DONE]\\n\\n"\n            return\n\n        for raw in line_iterator:\n            try:\n                if not raw:\n                    continue\n                line = (\n                    raw.decode("utf-8", errors="ignore")\n                    if isinstance(raw, (bytes, bytearray))\n                    else raw\n                )\n                if verbose and vlog:\n                    vlog(line)\n                if not line.startswith("data: "):\n                    continue\n                data = line[len("data: ") :].strip()\n                if not data:\n                    continue\n                if data == "[DONE]":\n                    break\n                try:\n                    evt = json.loads(data)\n                except (json.JSONDecodeError, UnicodeDecodeError):\n                    continue\n            except (\n                requests.exceptions.ChunkedEncodingError,\n                ConnectionError,\n                BrokenPipeError,\n            ) as e:\n                # Connection interrupted mid-stream - end gracefully\n                if verbose and vlog:\n                    vlog(f"Stream interrupted: {e}")\n                yield b"data: [DONE]\\n\\n"\n                return\n            kind = evt.get("type")\n            if isinstance(evt.get("response"), dict) and isinstance(evt["response"].get("id"), str):\n                response_id = evt["response"].get("id") or response_id\n\n            if isinstance(kind, str) and ("web_search_call" in kind):\n                try:\n                    call_id = evt.get("item_id") or "ws_call"\n                    if verbose and vlog:\n                        try:\n                            vlog(f"CM_TOOLS {kind} id={call_id} -> tool_calls(web_search)")\n                        except Exception:\n                            pass\n                    item = evt.get(\'item\') if isinstance(evt.get(\'item\'), dict) else {}\n                    params_dict = ws_state.setdefault(call_id, {}) if isinstance(ws_state.get(call_id), dict) else {}\n                    def _merge_from(src):\n                        if not isinstance(src, dict):\n                            return\n                        for whole in (\'parameters\',\'args\',\'arguments\',\'input\'):\n                            if isinstance(src.get(whole), dict):\n                                params_dict.update(src.get(whole))\n                        if isinstance(src.get(\'query\'), str): params_dict.setdefault(\'query\', src.get(\'query\'))\n                        if isinstance(src.get(\'q\'), str): params_dict.setdefault(\'query\', src.get(\'q\'))\n                        for rk in (\'recency\',\'time_range\',\'days\'):\n                            if src.get(rk) is not None and rk not in params_dict: params_dict[rk] = src.get(rk)\n                        for dk in (\'domains\',\'include_domains\',\'include\'):\n                            if isinstance(src.get(dk), list) and \'domains\' not in params_dict: params_dict[\'domains\'] = src.get(dk)\n                        for mk in (\'max_results\',\'topn\',\'limit\'):\n                            if src.get(mk) is not None and \'max_results\' not in params_dict: params_dict[\'max_results\'] = src.get(mk)\n                    _merge_from(item)\n                    _merge_from(evt if isinstance(evt, dict) else None)\n                    params = params_dict if params_dict else None\n                    if isinstance(params, dict):\n                        try:\n                            ws_state.setdefault(call_id, {}).update(params)\n                        except Exception:\n                            pass\n                    eff_params = ws_state.get(call_id, params if isinstance(params, (dict, list, str)) else {})\n                    args_str = _serialize_tool_args(eff_params)\n                    if call_id not in ws_index:\n                        ws_index[call_id] = ws_next_index\n                        ws_next_index += 1\n                    _idx = ws_index.get(call_id, 0)\n                    delta_chunk = {\n                        "id": response_id,\n                        "object": "chat.completion.chunk",\n                        "created": created,\n                        "model": model,\n                        "choices": [\n                            {\n                                "index": 0,\n                                "delta": {\n                                    "tool_calls": [\n                                        {\n                                            "index": _idx,\n                                            "id": call_id,\n                                            "type": "function",\n                                            "function": {"name": "web_search", "arguments": args_str},\n                                        }\n                                    ]\n                                },\n                                "finish_reason": None,\n                            }\n                        ],\n                    }\n                    yield f"data: {json.dumps(delta_chunk)}\\n\\n".encode("utf-8")\n                except Exception:\n                    pass\n\n            if kind == "response.output_text.delta":\n                delta = evt.get("delta") or ""\n                if compat == "think-tags" and think_open and not think_closed:\n                    close_chunk = {\n                        "id": response_id,\n                        "object": "chat.completion.chunk",\n                        "created": created,\n                        "model": model,\n                        "choices": [{"index": 0, "delta": {"content": "</think>"}, "finish_reason": None}],\n                    }\n                    yield f"data: {json.dumps(close_chunk)}\\n\\n".encode("utf-8")\n                    think_open = False\n                    think_closed = True\n                saw_output = True\n                chunk = {\n                    "id": response_id,\n                    "object": "chat.completion.chunk",\n                    "created": created,\n                    "model": model,\n                    "choices": [{"index": 0, "delta": {"content": delta}, "finish_reason": None}],\n                }\n                yield f"data: {json.dumps(chunk)}\\n\\n".encode("utf-8")\n            elif kind == "response.output_item.done":\n                item = evt.get("item") or {}\n                if isinstance(item, dict) and (item.get("type") == "function_call" or item.get("type") == "web_search_call"):\n                    call_id = item.get("call_id") or item.get("id") or ""\n                    name = item.get("name") or ("web_search" if item.get("type") == "web_search_call" else "")\n                    raw_args = item.get("arguments") or item.get("parameters")\n                    if isinstance(raw_args, dict):\n                        try:\n                            ws_state.setdefault(call_id, {}).update(raw_args)\n                        except Exception:\n                            pass\n                    eff_args = ws_state.get(call_id, raw_args if isinstance(raw_args, (dict, list, str)) else {})\n                    try:\n                        args = _serialize_tool_args(eff_args)\n                    except Exception:\n                        args = "{}"\n                    if item.get("type") == "web_search_call" and verbose and vlog:\n                        try:\n                            vlog(f"CM_TOOLS response.output_item.done web_search_call id={call_id} has_args={bool(args)}")\n                        except Exception:\n                            pass\n                    if call_id not in ws_index:\n                        ws_index[call_id] = ws_next_index\n                        ws_next_index += 1\n                    _idx = ws_index.get(call_id, 0)\n                    if isinstance(call_id, str) and isinstance(name, str) and isinstance(args, str):\n                        delta_chunk = {\n                            "id": response_id,\n                            "object": "chat.completion.chunk",\n                            "created": created,\n                            "model": model,\n                            "choices": [\n                                {\n                                    "index": 0,\n                                    "delta": {\n                                        "tool_calls": [\n                                            {\n                                                "index": _idx,\n                                                "id": call_id,\n                                                "type": "function",\n                                                "function": {"name": name, "arguments": args},\n                                            }\n                                        ]\n                                    },\n                                    "finish_reason": None,\n                                }\n                            ],\n                        }\n                        yield f"data: {json.dumps(delta_chunk)}\\n\\n".encode("utf-8")\n\n                        if item.get("type") == "function_call":\n                            saw_function_call = True\n            elif kind == "response.reasoning_summary_part.added":\n                if compat in ("think-tags", "o3"):\n                    if saw_any_summary:\n                        pending_summary_paragraph = True\n                    else:\n                        saw_any_summary = True\n            elif kind in ("response.reasoning_summary_text.delta", "response.reasoning_text.delta"):\n                delta_txt = evt.get("delta") or ""\n                if compat == "o3":\n                    if kind == "response.reasoning_summary_text.delta" and pending_summary_paragraph:\n                        nl_chunk = {\n                            "id": response_id,\n                            "object": "chat.completion.chunk",\n                            "created": created,\n                            "model": model,\n                            "choices": [\n                                {\n                                    "index": 0,\n                                    "delta": {"reasoning": {"content": [{"type": "text", "text": "\\n"}]}},\n                                    "finish_reason": None,\n                                }\n                            ],\n                        }\n                        yield f"data: {json.dumps(nl_chunk)}\\n\\n".encode("utf-8")\n                        pending_summary_paragraph = False\n                    chunk = {\n                        "id": response_id,\n                        "object": "chat.completion.chunk",\n                        "created": created,\n                        "model": model,\n                        "choices": [\n                            {\n                                "index": 0,\n                                "delta": {"reasoning": {"content": [{"type": "text", "text": delta_txt}]}},\n                                "finish_reason": None,\n                            }\n                        ],\n                    }\n                    yield f"data: {json.dumps(chunk)}\\n\\n".encode("utf-8")\n                elif compat == "think-tags":\n                    if not think_open and not think_closed:\n                        open_chunk = {\n                            "id": response_id,\n                            "object": "chat.completion.chunk",\n                            "created": created,\n                            "model": model,\n                            "choices": [{"index": 0, "delta": {"content": "<think>"}, "finish_reason": None}],\n                        }\n                        yield f"data: {json.dumps(open_chunk)}\\n\\n".encode("utf-8")\n                        think_open = True\n                    if think_open and not think_closed:\n                        if kind == "response.reasoning_summary_text.delta" and pending_summary_paragraph:\n                            nl_chunk = {\n                                "id": response_id,\n                                "object": "chat.completion.chunk",\n                                "created": created,\n                                "model": model,\n                                "choices": [{"index": 0, "delta": {"content": "\\n"}, "finish_reason": None}],\n                            }\n                            yield f"data: {json.dumps(nl_chunk)}\\n\\n".encode("utf-8")\n                            pending_summary_paragraph = False\n                        content_chunk = {\n                            "id": response_id,\n                            "object": "chat.completion.chunk",\n                            "created": created,\n                            "model": model,\n                            "choices": [{"index": 0, "delta": {"content": delta_txt}, "finish_reason": None}],\n                        }\n                        yield f"data: {json.dumps(content_chunk)}\\n\\n".encode("utf-8")\n                else:\n                    if kind == "response.reasoning_summary_text.delta":\n                        chunk = {\n                            "id": response_id,\n                            "object": "chat.completion.chunk",\n                            "created": created,\n                            "model": model,\n                            "choices": [\n                                {\n                                    "index": 0,\n                                    "delta": {"reasoning_summary": delta_txt, "reasoning": delta_txt},\n                                    "finish_reason": None,\n                                }\n                            ],\n                        }\n                        yield f"data: {json.dumps(chunk)}\\n\\n".encode("utf-8")\n                    else:\n                        chunk = {\n                            "id": response_id,\n                            "object": "chat.completion.chunk",\n                            "created": created,\n                            "model": model,\n                            "choices": [\n                                {"index": 0, "delta": {"reasoning": delta_txt}, "finish_reason": None}\n                            ],\n                        }\n                        yield f"data: {json.dumps(chunk)}\\n\\n".encode("utf-8")\n            elif isinstance(kind, str) and kind.endswith(".done"):\n                pass\n            elif kind == "response.output_text.done":\n                chunk = {\n                    "id": response_id,\n                    "object": "chat.completion.chunk",\n                    "created": created,\n                    "model": model,\n                    "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}],\n                }\n                yield f"data: {json.dumps(chunk)}\\n\\n".encode("utf-8")\n                sent_stop_chunk = True\n            elif kind == "response.failed":\n                err = evt.get("response", {}).get("error", {}).get("message", "response.failed")\n                chunk = {"error": {"message": err}}\n                yield f"data: {json.dumps(chunk)}\\n\\n".encode("utf-8")\n            elif kind == "response.completed":\n                m = _extract_usage(evt)\n                if m:\n                    upstream_usage = m\n                if compat == "think-tags" and think_open and not think_closed:\n                    close_chunk = {\n                        "id": response_id,\n                        "object": "chat.completion.chunk",\n                        "created": created,\n                        "model": model,\n                        "choices": [{"index": 0, "delta": {"content": "</think>"}, "finish_reason": None}],\n                    }\n                    yield f"data: {json.dumps(close_chunk)}\\n\\n".encode("utf-8")\n                    think_open = False\n                    think_closed = True\n                if not sent_stop_chunk:\n                    finish_reason = "tool_calls" if saw_function_call else "stop"\n                    chunk = {\n                        "id": response_id,\n                        "object": "chat.completion.chunk",\n                        "created": created,\n                        "model": model,\n                        "choices": [{"index": 0, "delta": {}, "finish_reason": finish_reason}],\n                    }\n                    yield f"data: {json.dumps(chunk)}\\n\\n".encode("utf-8")\n                    sent_stop_chunk = True\n\n                if include_usage and upstream_usage:\n                    try:\n                        usage_chunk = {\n                            "id": response_id,\n                            "object": "chat.completion.chunk",\n                            "created": created,\n                            "model": model,\n                            "choices": [{"index": 0, "delta": {}, "finish_reason": None}],\n                            "usage": upstream_usage,\n                        }\n                        yield f"data: {json.dumps(usage_chunk)}\\n\\n".encode("utf-8")\n                    except Exception:\n                        pass\n                yield b"data: [DONE]\\n\\n"\n                break\n    finally:\n        upstream.close()\n\n\ndef sse_translate_text(upstream, model: str, created: int, verbose: bool = False, vlog=None, *, include_usage: bool = False):\n    response_id = "cmpl-stream"\n    upstream_usage = None\n    \n    def _extract_usage(evt: Dict[str, Any]) -> Dict[str, int] | None:\n        try:\n            usage = (evt.get("response") or {}).get("usage")\n            if not isinstance(usage, dict):\n                return None\n            pt = int(usage.get("input_tokens") or 0)\n            ct = int(usage.get("output_tokens") or 0)\n            tt = int(usage.get("total_tokens") or (pt + ct))\n            return {"prompt_tokens": pt, "completion_tokens": ct, "total_tokens": tt}\n        except Exception:\n            return None\n    try:\n        for raw_line in upstream.iter_lines(decode_unicode=False):\n            if not raw_line:\n                continue\n            line = raw_line.decode("utf-8", errors="ignore") if isinstance(raw_line, (bytes, bytearray)) else raw_line\n            if verbose and vlog:\n                vlog(line)\n            if not line.startswith("data: "):\n                continue\n            data = line[len("data: "):].strip()\n            if not data or data == "[DONE]":\n                if data == "[DONE]":\n                    chunk = {\n                        "id": response_id,\n                        "object": "text_completion.chunk",\n                        "created": created,\n                        "model": model,\n                        "choices": [{"index": 0, "text": "", "finish_reason": "stop"}],\n                    }\n                    yield f"data: {json.dumps(chunk)}\\n\\n".encode("utf-8")\n                continue\n            try:\n                evt = json.loads(data)\n            except Exception:\n                continue\n            kind = evt.get("type")\n            if isinstance(evt.get("response"), dict) and isinstance(evt["response"].get("id"), str):\n                response_id = evt["response"].get("id") or response_id\n            if kind == "response.output_text.delta":\n                delta_text = evt.get("delta") or ""\n                chunk = {\n                    "id": response_id,\n                    "object": "text_completion.chunk",\n                    "created": created,\n                    "model": model,\n                    "choices": [{"index": 0, "text": delta_text, "finish_reason": None}],\n                }\n                yield f"data: {json.dumps(chunk)}\\n\\n".encode("utf-8")\n            elif kind == "response.output_text.done":\n                chunk = {\n                    "id": response_id,\n                    "object": "text_completion.chunk",\n                    "created": created,\n                    "model": model,\n                    "choices": [{"index": 0, "text": "", "finish_reason": "stop"}],\n                }\n                yield f"data: {json.dumps(chunk)}\\n\\n".encode("utf-8")\n            elif kind == "response.completed":\n                m = _extract_usage(evt)\n                if m:\n                    upstream_usage = m\n                if include_usage and upstream_usage:\n                    try:\n                        usage_chunk = {\n                            "id": response_id,\n                            "object": "text_completion.chunk",\n                            "created": created,\n                            "model": model,\n                            "choices": [{"index": 0, "text": "", "finish_reason": None}],\n                            "usage": upstream_usage,\n                        }\n                        yield f"data: {json.dumps(usage_chunk)}\\n\\n".encode("utf-8")\n                    except Exception:\n                        pass\n                yield b"data: [DONE]\\n\\n"\n                break\n    finally:\n        upstream.close()\n', 'chatmock.version': 'from __future__ import annotations\n\n\n__version__ = "1.40"\n', 'chatmock.websocket_routes': 'from __future__ import annotations\n\nimport json\nimport os\nimport ssl\nfrom typing import Any, Dict\n\nimport certifi\nfrom flask import current_app, request\nfrom flask_sock import Sock\nfrom websockets.sync.client import connect as websocket_connect\nfrom websockets.exceptions import ConnectionClosed\n\nfrom .responses_api import (\n    ResponsesRequestError,\n    extract_client_session_id,\n    normalize_responses_payload,\n)\nfrom .session import (\n    clear_responses_reuse_state,\n    note_responses_stream_event,\n    prepare_responses_request_for_session,\n)\nfrom .upstream import build_upstream_headers, build_upstream_websocket_url\nfrom .utils import get_effective_chatgpt_auth\n\n\ndef _log_json(prefix: str, payload: Any) -> None:\n    try:\n        print(f"{prefix}\\n{json.dumps(payload, indent=2, ensure_ascii=False)}")\n    except Exception:\n        try:\n            print(f"{prefix}\\n{payload}")\n        except Exception:\n            pass\n\n\ndef _error_event(message: str, *, status_code: int = 400, code: str | None = None) -> Dict[str, Any]:\n    error: Dict[str, Any] = {"message": message}\n    if code:\n        error["code"] = code\n    return {"type": "error", "status_code": status_code, "error": error}\n\n\ndef _is_terminal_event(event: Any) -> bool:\n    if not isinstance(event, dict):\n        return False\n    kind = event.get("type")\n    return kind in ("response.completed", "response.failed", "error")\n\n\ndef _build_websocket_ssl_context() -> ssl.SSLContext:\n    cafile = (\n        os.getenv("CODEX_CA_CERTIFICATE")\n        or os.getenv("SSL_CERT_FILE")\n        or certifi.where()\n    )\n    return ssl.create_default_context(cafile=cafile)\n\n\ndef connect_upstream_websocket(url: str, headers: Dict[str, str]):\n    return websocket_connect(\n        url,\n        additional_headers=headers,\n        open_timeout=15,\n        ssl=_build_websocket_ssl_context(),\n    )\n\n\ndef register_websocket_routes(sock: Sock) -> None:\n    @sock.route("/v1/responses")\n    def responses_websocket(ws) -> None:\n        verbose = bool(current_app.config.get("VERBOSE"))\n        upstream_ws = None\n        upstream_session_id: str | None = None\n        active_session_id: str | None = None\n\n        def _send_error(message: str, *, status_code: int = 400, code: str | None = None) -> None:\n            evt = _error_event(message, status_code=status_code, code=code)\n            if verbose:\n                _log_json("STREAM OUT WS /v1/responses (error)", evt)\n            try:\n                ws.send(json.dumps(evt))\n            except Exception:\n                pass\n\n        try:\n            while True:\n                incoming = ws.receive()\n                if incoming is None:\n                    break\n\n                if isinstance(incoming, bytes):\n                    incoming_text = incoming.decode("utf-8", errors="ignore")\n                else:\n                    incoming_text = str(incoming)\n                if verbose:\n                    print("IN WS /v1/responses\\n" + incoming_text)\n\n                try:\n                    payload = json.loads(incoming_text)\n                except Exception:\n                    _send_error("Websocket frames must be valid JSON objects.", status_code=400)\n                    break\n\n                if not isinstance(payload, dict):\n                    _send_error("Websocket frames must be JSON objects.", status_code=400)\n                    break\n\n                client_session_id = extract_client_session_id(request.headers)\n                outbound_text = incoming_text\n                session_id = upstream_session_id\n\n                if payload.get("type") == "response.create":\n                    try:\n                        normalized = normalize_responses_payload(\n                            payload,\n                            config=current_app.config,\n                            client_session_id=client_session_id,\n                        )\n                    except ResponsesRequestError as exc:\n                        _send_error(str(exc), status_code=exc.status_code, code=exc.code)\n                        continue\n\n                    if normalized.service_tier_resolution.warning_message and verbose:\n                        print(f"[FastMode] {normalized.service_tier_resolution.warning_message}")\n                    prepared = prepare_responses_request_for_session(\n                        normalized.session_id,\n                        normalized.payload,\n                        allow_previous_response_id=True,\n                    )\n                    outbound_text = json.dumps(prepared.payload)\n                    session_id = normalized.session_id\n                    active_session_id = normalized.session_id\n                    if verbose:\n                        _log_json("OUTBOUND >> ChatGPT Responses WS payload", prepared.payload)\n                elif upstream_ws is None:\n                    _send_error(\n                        "The first websocket message must be a response.create request.",\n                        status_code=400,\n                    )\n                    break\n\n                if upstream_ws is None or (session_id and session_id != upstream_session_id):\n                    access_token, account_id = get_effective_chatgpt_auth()\n                    if not access_token or not account_id:\n                        if session_id:\n                            clear_responses_reuse_state(session_id)\n                        _send_error(\n                            "Missing ChatGPT credentials. Run \'python3 chatmock.py login\' first.",\n                            status_code=401,\n                        )\n                        break\n\n                    if upstream_ws is not None:\n                        try:\n                            upstream_ws.close()\n                        except Exception:\n                            pass\n\n                    effective_session_id = session_id or client_session_id or ""\n                    try:\n                        upstream_ws = connect_upstream_websocket(\n                            build_upstream_websocket_url(),\n                            build_upstream_headers(\n                                access_token,\n                                account_id,\n                                effective_session_id,\n                                accept="application/json",\n                            ),\n                        )\n                    except Exception as exc:\n                        if session_id:\n                            clear_responses_reuse_state(session_id)\n                        _send_error(\n                            f"Upstream websocket connection failed: {exc}",\n                            status_code=502,\n                        )\n                        break\n                    upstream_session_id = effective_session_id\n\n                upstream_ws.send(outbound_text)\n\n                while True:\n                    try:\n                        upstream_message = upstream_ws.recv()\n                    except ConnectionClosed:\n                        if active_session_id:\n                            clear_responses_reuse_state(active_session_id)\n                        _send_error("Upstream websocket closed unexpectedly.", status_code=502)\n                        return\n                    if upstream_message is None:\n                        if active_session_id:\n                            clear_responses_reuse_state(active_session_id)\n                        _send_error("Upstream websocket closed unexpectedly.", status_code=502)\n                        return\n                    if verbose:\n                        try:\n                            print("STREAM OUT WS /v1/responses\\n" + str(upstream_message))\n                        except Exception:\n                            pass\n                    ws.send(upstream_message)\n\n                    try:\n                        parsed = json.loads(upstream_message)\n                    except Exception:\n                        parsed = None\n                    if isinstance(parsed, dict) and active_session_id:\n                        note_responses_stream_event(active_session_id, parsed)\n                    if _is_terminal_event(parsed):\n                        if isinstance(parsed, dict) and parsed.get("type") in ("response.failed", "error"):\n                            if upstream_ws is not None:\n                                try:\n                                    upstream_ws.close()\n                                except Exception:\n                                    pass\n                            upstream_ws = None\n                            upstream_session_id = None\n                        break\n        finally:\n            if upstream_ws is not None:\n                try:\n                    upstream_ws.close()\n                except Exception:\n                    pass\n'}


class EmbeddedChatMockFinder(importlib.abc.MetaPathFinder, importlib.abc.Loader):
    """Load vendored ChatMock modules directly from this file."""

    def find_spec(self, fullname: str, path: Any = None, target: Any = None):
        if fullname not in EMBEDDED_CHATMOCK_SOURCES:
            return None
        spec = importlib.util.spec_from_loader(fullname, self, is_package=fullname == "chatmock")
        if spec is not None:
            # Flask resolves the package root from the module origin.
            spec.origin = str(Path(__file__).resolve())
        return spec

    def create_module(self, spec):
        return None

    def exec_module(self, module) -> None:
        fullname = module.__name__
        filename = "__init__.py" if fullname == "chatmock" else fullname.rsplit(".", 1)[-1] + ".py"
        module.__file__ = f"<embedded-chatmock>/{filename}"
        module.__package__ = fullname if fullname == "chatmock" else fullname.rsplit(".", 1)[0]
        exec(compile(EMBEDDED_CHATMOCK_SOURCES[fullname], module.__file__, "exec"), module.__dict__)


def install_embedded_chatmock() -> None:
    if "chatmock" in sys.modules:
        return
    if not any(isinstance(finder, EmbeddedChatMockFinder) for finder in sys.meta_path):
        sys.meta_path.insert(0, EmbeddedChatMockFinder())


PRICE_SOURCE_URL = "https://developers.openai.com/api/docs/pricing"
PRICE_SOURCE_CHECKED_AT = "2026-08-17"

# Standard API pricing in USD per 1M tokens. Values are an official snapshot
# from PRICE_SOURCE_URL. A request is explicitly marked unpriced when its
# model or token usage is not represented here rather than using an estimate.
PRICES_USD_PER_MILLION: dict[str, dict[str, float | None]] = {
    "gpt-5.6-sol": {"input": 5.0, "cached_input": 0.5, "output": 30.0},
    "gpt-5.6-terra": {"input": 2.0, "cached_input": 0.2, "output": 12.0},
    "gpt-5.6-luna": {"input": 0.2, "cached_input": 0.02, "output": 1.2},
    "gpt-5.5": {"input": 5.0, "cached_input": 0.5, "output": 30.0},
    "gpt-5.5-pro": {"input": 30.0, "cached_input": None, "output": 180.0},
    "gpt-5.4": {"input": 2.5, "cached_input": 0.25, "output": 15.0},
    "gpt-5.4-mini": {"input": 0.75, "cached_input": 0.075, "output": 4.5},
    "gpt-5.4-nano": {"input": 0.2, "cached_input": 0.02, "output": 1.25},
    "gpt-5.4-pro": {"input": 30.0, "cached_input": None, "output": 180.0},
    "gpt-5.2": {"input": 1.75, "cached_input": 0.175, "output": 14.0},
    "gpt-5.2-pro": {"input": 21.0, "cached_input": None, "output": 168.0},
    "gpt-5.1": {"input": 1.25, "cached_input": 0.125, "output": 10.0},
    "gpt-5": {"input": 1.25, "cached_input": 0.125, "output": 10.0},
    "gpt-5-mini": {"input": 0.25, "cached_input": 0.025, "output": 2.0},
    "gpt-5-nano": {"input": 0.05, "cached_input": 0.005, "output": 0.4},
    "gpt-5-pro": {"input": 15.0, "cached_input": None, "output": 120.0},
    "gpt-5.3-codex": {"input": 1.75, "cached_input": 0.175, "output": 14.0},
}


def _as_nonnegative_int(value: Any) -> int | None:
    try:
        result = int(value)
    except (TypeError, ValueError):
        return None
    return result if result >= 0 else None


def _usage_from_object(usage: Any) -> tuple[int | None, int | None, int | None]:
    """Extract input, cached input, and output token counts from OpenAI-shaped usage."""
    if not isinstance(usage, dict):
        return None, None, None
    input_tokens = _as_nonnegative_int(usage.get("input_tokens", usage.get("prompt_tokens")))
    output_tokens = _as_nonnegative_int(usage.get("output_tokens", usage.get("completion_tokens")))
    details = usage.get("input_tokens_details", usage.get("prompt_tokens_details", {}))
    cached_tokens = _as_nonnegative_int(usage.get("cached_tokens"))
    if cached_tokens is None and isinstance(details, dict):
        cached_tokens = _as_nonnegative_int(details.get("cached_tokens"))
    return input_tokens, cached_tokens, output_tokens


def _usage_from_response(response: Response) -> tuple[int | None, int | None, int | None]:
    """Extract token counts from a non-streaming JSON response."""
    try:
        body = response.get_json(silent=True)
    except Exception:
        return None, None, None
    return _usage_from_object(body.get("usage") if isinstance(body, dict) else None)


class SSEUsageParser:
    """Read a response stream without retaining response content or prompts."""

    def __init__(self) -> None:
        self._buffer = b""
        self._usage: tuple[int | None, int | None, int | None] = (None, None, None)

    def feed(self, chunk: bytes | str) -> None:
        if isinstance(chunk, str):
            self._buffer += chunk.encode("utf-8", errors="ignore")
        else:
            self._buffer += chunk
        while b"\n" in self._buffer:
            line, self._buffer = self._buffer.split(b"\n", 1)
            line = line.rstrip(b"\r")
            if not line.startswith(b"data: "):
                continue
            try:
                event = json.loads(line[6:].strip().decode("utf-8", errors="ignore"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                continue
            if not isinstance(event, dict):
                continue
            usage = event.get("usage")
            response = event.get("response")
            if not isinstance(usage, dict) and isinstance(response, dict):
                usage = response.get("usage")
            parsed = _usage_from_object(usage)
            if parsed[0] is not None or parsed[2] is not None:
                self._usage = parsed

    @property
    def usage(self) -> tuple[int | None, int | None, int | None]:
        return self._usage


def _price_for(model: str | None, input_tokens: int | None, cached_tokens: int | None, output_tokens: int | None) -> float | None:
    if not model or input_tokens is None or output_tokens is None:
        return None
    normalized = model.strip().lower().split(":", 1)[0]
    for suffix in ("-none", "-minimal", "-low", "-medium", "-high", "-xhigh", "-max", "-ultra"):
        if normalized.endswith(suffix):
            normalized = normalized[: -len(suffix)]
            break
    price = PRICES_USD_PER_MILLION.get(normalized)
    if price is None or price["input"] is None or price["output"] is None:
        return None
    cached = min(max(cached_tokens or 0, 0), input_tokens)
    uncached = input_tokens - cached
    cached_rate = price["cached_input"] if price["cached_input"] is not None else price["input"]
    return (uncached * float(price["input"]) + cached * float(cached_rate) + output_tokens * float(price["output"])) / 1_000_000


def _load_json(path: Path, default: Any) -> Any:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default
    return value


def _write_json_private(path: Path, payload: Any) -> None:
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{secrets.token_hex(8)}.tmp")
    try:
        descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        os.replace(temporary, path)
    finally:
        try:
            temporary.unlink(missing_ok=True)
        except OSError:
            pass


def _load_private_secret(path: Path) -> bytes:
    try:
        secret = path.read_bytes()
        if len(secret) >= 32:
            return secret
    except FileNotFoundError:
        pass
    secret = secrets.token_bytes(32)
    try:
        descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(secret)
        return secret
    except FileExistsError:
        existing = path.read_bytes()
        if len(existing) >= 32:
            return existing
        raise RuntimeError(f"私密状态文件无效: {path.name}")


def _jwt_claims(token: str | None) -> dict[str, Any]:
    if not isinstance(token, str) or token.count(".") != 2:
        return {}
    try:
        payload = token.split(".")[1]
        padded = payload + "=" * (-len(payload) % 4)
        parsed = json.loads(base64.urlsafe_b64decode(padded.encode("ascii")).decode("utf-8"))
        return parsed if isinstance(parsed, dict) else {}
    except (UnicodeDecodeError, ValueError, OSError):
        return {}


def _display_iso(value: Any, empty: str = "-") -> str:
    if not isinstance(value, str) or not value.strip():
        return empty
    try:
        text = value.strip().replace("Z", "+00:00")
        parsed = datetime.fromisoformat(text)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone().strftime("%Y-%m-%d %H:%M")
    except ValueError:
        return value.strip()


def _display_duration(seconds: Any) -> str:
    try:
        total = max(0, int(seconds))
    except (TypeError, ValueError):
        return "-"
    hours, remainder = divmod(total, 3600)
    minutes, remainder = divmod(remainder, 60)
    if hours:
        return f"{hours}小时{minutes}分"
    if minutes:
        return f"{minutes}分{remainder}秒"
    return f"{remainder}秒"


class AccountPool:
    """A request-scoped ChatGPT auth pool stored outside the generated source."""

    def __init__(self, state_dir: Path, legacy_home: Path) -> None:
        self.state_dir = state_dir
        self.root = state_dir / "auth-pool"
        self.config_path = self.root / "pool.json"
        self.legacy_auth_path = legacy_home / "auth.json"
        self._lock = threading.Lock()
        self._cursor = 0
        self._active_slot: contextvars.ContextVar[str | None] = contextvars.ContextVar("chatmock_gateway_pool_slot", default=None)
        self.root.mkdir(mode=0o700, parents=True, exist_ok=True)
        self._migrate_legacy_auth()

    @staticmethod
    def _sort_slots(slot: str) -> tuple[int, str]:
        suffix = slot.removeprefix("slot-")
        try:
            return int(suffix), slot
        except ValueError:
            return 10**9, slot

    def _slot_names_locked(self) -> list[str]:
        return sorted(
            (entry.name for entry in self.root.iterdir() if entry.is_dir() and entry.name.startswith("slot-")),
            key=self._sort_slots,
        )

    def _config_locked(self) -> dict[str, Any]:
        data = _load_json(self.config_path, {"slots": {}})
        if not isinstance(data, dict):
            data = {"slots": {}}
        if not isinstance(data.get("slots"), dict):
            data["slots"] = {}
        return data

    def _save_config_locked(self, config: dict[str, Any]) -> None:
        _write_json_private(self.config_path, config)

    def _settings_locked(self, config: dict[str, Any], slot: str) -> dict[str, Any]:
        slots = config["slots"]
        value = slots.get(slot)
        if not isinstance(value, dict):
            value = {"enabled": True, "frozen_until": 0.0}
            slots[slot] = value
        value["enabled"] = bool(value.get("enabled", True))
        try:
            value["frozen_until"] = max(0.0, float(value.get("frozen_until") or 0.0))
        except (TypeError, ValueError):
            value["frozen_until"] = 0.0
        return value

    def _migrate_legacy_auth(self) -> None:
        with self._lock:
            if self._slot_names_locked() or not self.legacy_auth_path.is_file():
                return
            legacy = _load_json(self.legacy_auth_path, {})
            if not isinstance(legacy, dict) or not isinstance(legacy.get("tokens"), dict):
                return
            slot = "slot-1"
            _write_json_private(self.root / slot / "auth.json", legacy)
            config = self._config_locked()
            self._settings_locked(config, slot)
            self._save_config_locked(config)

    def active_home(self) -> str:
        slot = self._active_slot.get()
        return str(self.root / slot) if slot else str(self.legacy_auth_path.parent)

    def activate(self, slot: str) -> contextvars.Token[str | None]:
        return self._active_slot.set(slot)

    def reset(self, token: contextvars.Token[str | None]) -> None:
        self._active_slot.reset(token)

    def current_slot(self) -> str | None:
        return self._active_slot.get()

    def read_active_auth(self) -> dict[str, Any] | None:
        slot = self.current_slot()
        if slot:
            data = _load_json(self.root / slot / "auth.json", None)
            return data if isinstance(data, dict) else None
        data = _load_json(self.legacy_auth_path, None)
        return data if isinstance(data, dict) else None

    def write_active_auth(self, auth: dict[str, Any]) -> bool:
        slot = self.current_slot()
        if not slot:
            return False
        try:
            _write_json_private(self.root / slot / "auth.json", auth)
            return True
        except OSError:
            return False

    def select(self, preferred_slot: str | None = None) -> str | None:
        now = time.time()
        with self._lock:
            config = self._config_locked()
            candidates: list[str] = []
            changed = False
            for slot in self._slot_names_locked():
                settings = self._settings_locked(config, slot)
                changed = True
                if not (self.root / slot / "auth.json").is_file():
                    continue
                if settings["enabled"] and float(settings["frozen_until"]) <= now:
                    candidates.append(slot)
            if changed:
                self._save_config_locked(config)
            if not candidates:
                return None
            if preferred_slot in candidates:
                return preferred_slot
            selected = candidates[self._cursor % len(candidates)]
            self._cursor = (self._cursor + 1) % max(len(candidates), 1)
            return selected

    def set_enabled(self, slot: str, enabled: bool) -> bool:
        with self._lock:
            if slot not in self._slot_names_locked():
                return False
            config = self._config_locked()
            settings = self._settings_locked(config, slot)
            settings["enabled"] = bool(enabled)
            self._save_config_locked(config)
        return True

    def freeze(self, slot: str, seconds: int) -> bool:
        duration = min(max(int(seconds), 0), 24 * 3600)
        with self._lock:
            if slot not in self._slot_names_locked():
                return False
            config = self._config_locked()
            settings = self._settings_locked(config, slot)
            settings["frozen_until"] = time.time() + duration if duration else 0.0
            self._save_config_locked(config)
        return True

    def _next_slot_locked(self) -> str:
        numbers = [self._sort_slots(slot)[0] for slot in self._slot_names_locked()]
        return f"slot-{max(numbers or [0]) + 1}"

    def save_authorization(self, auth: dict[str, Any], target_slot: str | None = None) -> str:
        tokens = auth.get("tokens") if isinstance(auth, dict) else None
        if not isinstance(tokens, dict) or not all(isinstance(tokens.get(name), str) and tokens[name] for name in ("id_token", "access_token", "refresh_token")):
            raise ValueError("授权结果缺少必要 token")
        account_id = str(tokens.get("account_id") or "").strip()
        with self._lock:
            slot_names = self._slot_names_locked()
            if target_slot and target_slot not in slot_names:
                raise ValueError("账号槽位不存在")
            for slot in slot_names:
                if slot == target_slot:
                    continue
                existing = _load_json(self.root / slot / "auth.json", {})
                existing_tokens = existing.get("tokens") if isinstance(existing, dict) else None
                if account_id and isinstance(existing_tokens, dict) and str(existing_tokens.get("account_id") or "") == account_id:
                    raise ValueError("该 ChatGPT 账号已在普通池中")
            slot = target_slot or self._next_slot_locked()
            _write_json_private(self.root / slot / "auth.json", auth)
            config = self._config_locked()
            settings = self._settings_locked(config, slot)
            settings["enabled"] = True
            settings["frozen_until"] = 0.0
            self._save_config_locked(config)
            return slot

    def slots(self) -> list[dict[str, Any]]:
        now = time.time()
        with self._lock:
            config = self._config_locked()
            rows: list[dict[str, Any]] = []
            changed = False
            for slot in self._slot_names_locked():
                settings = self._settings_locked(config, slot)
                changed = True
                auth = _load_json(self.root / slot / "auth.json", {})
                tokens = auth.get("tokens") if isinstance(auth, dict) and isinstance(auth.get("tokens"), dict) else {}
                claims = _jwt_claims(tokens.get("id_token") or tokens.get("access_token"))
                auth_claims = claims.get("https://api.openai.com/auth") if isinstance(claims.get("https://api.openai.com/auth"), dict) else {}
                limits = _load_json(self.root / slot / "usage_limits.json", {})

                def quota(name: str) -> dict[str, Any]:
                    value = limits.get(name) if isinstance(limits, dict) else {}
                    value = value if isinstance(value, dict) else {}
                    try:
                        used = max(0.0, min(100.0, float(value.get("used_percent"))))
                    except (TypeError, ValueError):
                        used = None
                    remaining = None if used is None else max(0.0, 100.0 - used)
                    return {
                        "used_percent": used,
                        "used_text": "-" if used is None else f"{used:.1f}%",
                        "remaining_percent": remaining,
                        "remaining_text": "-" if remaining is None else f"{remaining:.1f}%",
                        "reset_text": _display_duration(value.get("resets_in_seconds")),
                        "window_text": f"{value.get('window_minutes')} 分钟" if value.get("window_minutes") is not None else "-",
                    }

                frozen_until = float(settings["frozen_until"])
                frozen = frozen_until > now
                rows.append(
                    {
                        "slot": slot,
                        "email": str(claims.get("email") or "-"),
                        "plan": str(auth_claims.get("chatgpt_plan_type") or "-").upper(),
                        "account_id": str(tokens.get("account_id") or auth_claims.get("chatgpt_account_id") or "-"),
                        "subscription_until": _display_iso(auth_claims.get("chatgpt_subscription_active_until")),
                        "last_refresh": _display_iso(auth.get("last_refresh") if isinstance(auth, dict) else None),
                        "quota_captured": _display_iso(limits.get("captured_at") if isinstance(limits, dict) else None),
                        "enabled": bool(settings["enabled"]),
                        "frozen": frozen,
                        "frozen_until": _display_iso(datetime.fromtimestamp(frozen_until, timezone.utc).isoformat()) if frozen else "-",
                        "primary": quota("primary"),
                        "secondary": quota("secondary"),
                    }
                )
            if changed:
                self._save_config_locked(config)
            return rows


class PoolAffinityStore:
    """Persist a privacy-preserving client-session-to-slot mapping."""

    max_entries = 5000
    max_age_seconds = 30 * 24 * 3600

    def __init__(self, state_dir: Path) -> None:
        self.path = state_dir / "pool-affinity.json"
        self._secret = _load_private_secret(state_dir / "pool-affinity-secret.bin")
        self._lock = threading.Lock()
        self._mapping: dict[str, dict[str, Any]] = {}
        with self._lock:
            self._load_locked()

    @staticmethod
    def _text(value: Any) -> str:
        return value.strip()[:2048] if isinstance(value, str) else ""

    @classmethod
    def _content_text(cls, value: Any) -> str:
        if isinstance(value, str):
            return cls._text(value)
        if isinstance(value, dict):
            for key in ("text", "content", "value"):
                text = cls._content_text(value.get(key))
                if text:
                    return text
            return ""
        if isinstance(value, list):
            parts: list[str] = []
            for item in value:
                text = cls._content_text(item)
                if text:
                    parts.append(text)
                if len("\n".join(parts)) >= 2048:
                    break
            return "\n".join(parts)[:2048]
        return ""

    @classmethod
    def _first_user_text(cls, payload: dict[str, Any]) -> str:
        for collection_name in ("messages", "input"):
            collection = payload.get(collection_name)
            if not isinstance(collection, list):
                continue
            for item in collection:
                if not isinstance(item, dict):
                    continue
                role = str(item.get("role") or "").lower()
                item_type = str(item.get("type") or "").lower()
                if role != "user" and item_type not in {"message", "input_text"}:
                    continue
                text = cls._content_text(item.get("content", item.get("text")))
                if text:
                    return text
        return cls._text(payload.get("prompt"))

    @classmethod
    def _hint(cls, payload: dict[str, Any], headers: Any) -> str:
        for name in ("X-Session-Id", "X-Conversation-Id", "X-Thread-Id", "X-Cache-Key", "Session-Id"):
            value = cls._text(headers.get(name) if hasattr(headers, "get") else None)
            if value:
                return value
        for name in ("session_id", "conversation_id", "thread_id", "prompt_cache_key", "cache_key", "context_id", "previous_response_id"):
            value = cls._text(payload.get(name))
            if value:
                return value
        metadata = payload.get("metadata")
        if isinstance(metadata, dict):
            for name in ("session_id", "conversation_id", "thread_id", "prompt_cache_key", "cache_key", "context_id"):
                value = cls._text(metadata.get(name))
                if value:
                    return value
        return ""

    def derive_key(self, api_key_id: int, model: str | None, payload: dict[str, Any], headers: Any) -> str | None:
        hint = self._hint(payload, headers)
        if hint:
            material = f"key:{api_key_id}\nsession:{hint}"
        else:
            first_user = self._first_user_text(payload)
            if not first_user:
                return None
            material = f"key:{api_key_id}\nmodel:{model or ''}\nfirst-user:{first_user}"
        return hmac.new(self._secret, material.encode("utf-8"), hashlib.sha256).hexdigest()

    def _load_locked(self) -> None:
        raw = _load_json(self.path, {"bindings": {}})
        bindings = raw.get("bindings") if isinstance(raw, dict) else {}
        if not isinstance(bindings, dict):
            return
        self._mapping = {key: value for key, value in bindings.items() if isinstance(key, str) and isinstance(value, dict)}
        self._prune_locked(save=False)

    def _prune_locked(self, *, save: bool) -> bool:
        now = time.time()
        kept: list[tuple[str, dict[str, Any]]] = []
        for key, value in self._mapping.items():
            slot = self._text(value.get("slot"))
            try:
                updated_at = float(value.get("updated_at") or 0.0)
            except (TypeError, ValueError):
                updated_at = 0.0
            if slot and updated_at >= now - self.max_age_seconds:
                kept.append((key, {"slot": slot, "updated_at": updated_at}))
        kept.sort(key=lambda item: item[1]["updated_at"], reverse=True)
        next_mapping = dict(kept[: self.max_entries])
        changed = next_mapping != self._mapping
        self._mapping = next_mapping
        if changed and save:
            _write_json_private(self.path, {"bindings": self._mapping})
        return changed

    def preferred_slot(self, affinity_key: str | None) -> str | None:
        if not affinity_key:
            return None
        with self._lock:
            self._prune_locked(save=True)
            value = self._mapping.get(affinity_key)
            return self._text(value.get("slot")) if isinstance(value, dict) else None

    def remember(self, affinity_key: str | None, slot: str) -> None:
        if not affinity_key or not self._text(slot):
            return
        with self._lock:
            now = time.time()
            current = self._mapping.get(affinity_key)
            if isinstance(current, dict) and current.get("slot") == slot:
                try:
                    if now - float(current.get("updated_at") or 0.0) < 3600:
                        return
                except (TypeError, ValueError):
                    pass
            self._mapping[affinity_key] = {"slot": slot, "updated_at": now}
            self._prune_locked(save=False)
            _write_json_private(self.path, {"bindings": self._mapping})

    def forget(self, affinity_key: str | None, slot: str | None = None) -> None:
        if not affinity_key:
            return
        with self._lock:
            current = self._mapping.get(affinity_key)
            if not isinstance(current, dict) or (slot and current.get("slot") != slot):
                return
            self._mapping.pop(affinity_key, None)
            _write_json_private(self.path, {"bindings": self._mapping})

    def count(self) -> int:
        with self._lock:
            self._prune_locked(save=True)
            return len(self._mapping)


class PoolProtection:
    """Optional low-quota model override using primary-window pool capacity."""

    default_config = {
        "enabled": False,
        "threshold_percent": 15.0,
        "model": "gpt-5.6-luna",
        "reasoning_effort": "max",
    }
    allowed_efforts = {"none", "minimal", "low", "medium", "high", "xhigh", "max", "ultra"}

    def __init__(self, state_dir: Path, pool: AccountPool) -> None:
        self.path = state_dir / "pool-protection.json"
        self.pool = pool
        self._lock = threading.Lock()

    @staticmethod
    def _model(value: Any) -> str:
        model = str(value or "").strip().lower()
        if not model or len(model) > 120 or any(ord(char) < 33 for char in model):
            raise ValueError("目标模型格式无效")
        return model

    @classmethod
    def _normalize(cls, value: Any) -> dict[str, Any]:
        source = value if isinstance(value, dict) else {}
        result = dict(cls.default_config)
        result["enabled"] = bool(source.get("enabled", result["enabled"]))
        try:
            threshold = float(source.get("threshold_percent", result["threshold_percent"]))
        except (TypeError, ValueError) as error:
            raise ValueError("低额度阈值必须是数字") from error
        if not 0.0 <= threshold <= 100.0:
            raise ValueError("低额度阈值必须在 0 到 100 之间")
        result["threshold_percent"] = threshold
        result["model"] = cls._model(source.get("model", result["model"]))
        effort = str(source.get("reasoning_effort", result["reasoning_effort"]) or "").strip().lower()
        if effort not in cls.allowed_efforts:
            raise ValueError("思考强度无效")
        result["reasoning_effort"] = effort
        return result

    def config(self) -> dict[str, Any]:
        with self._lock:
            return self._normalize(_load_json(self.path, self.default_config))

    def update(self, value: dict[str, Any]) -> dict[str, Any]:
        config = self._normalize(value)
        with self._lock:
            _write_json_private(self.path, config)
        return config

    def status(self) -> dict[str, Any]:
        config = self.config()
        eligible = [account for account in self.pool.slots() if account["enabled"] and not account["frozen"]]
        percentages = [account["primary"]["remaining_percent"] for account in eligible]
        ready = bool(percentages) and all(isinstance(value, (float, int)) for value in percentages)
        remaining = sum(float(value) for value in percentages) / len(percentages) if ready else None
        active = bool(config["enabled"] and ready and remaining is not None and remaining < config["threshold_percent"])
        return {
            **config,
            "active": active,
            "ready": ready,
            "eligible_accounts": len(eligible),
            "remaining_percent": remaining,
            "remaining_text": "-" if remaining is None else f"{remaining:.1f}%",
            "target_model": f"{config['model']}-{config['reasoning_effort']}",
        }


class PoolLoginSessions:
    """Short-lived PKCE sessions for adding or replacing one pool account."""

    redirect_uri = "http://localhost:1455/auth/callback"

    def __init__(self, state_dir: Path, pool: AccountPool, client_id: str, issuer: str, token_url: str) -> None:
        self.path = state_dir / "pool-login-sessions.json"
        self.pool = pool
        self.client_id = client_id
        self.issuer = issuer.rstrip("/")
        self.token_url = token_url
        self._lock = threading.Lock()

    def _sessions_locked(self) -> list[dict[str, Any]]:
        data = _load_json(self.path, {"sessions": []})
        sessions = data.get("sessions") if isinstance(data, dict) else []
        valid: list[dict[str, Any]] = []
        now = time.time()
        for item in sessions if isinstance(sessions, list) else []:
            if not isinstance(item, dict):
                continue
            if float(item.get("expires_at") or 0) > now - 12 * 3600:
                valid.append(item)
        return valid

    def _save_locked(self, sessions: list[dict[str, Any]]) -> None:
        _write_json_private(self.path, {"sessions": sessions})

    @staticmethod
    def _public(item: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": item.get("id"),
            "slot": item.get("slot") or "",
            "mode": "重新登录" if item.get("slot") else "添加账号",
            "authorize_url": item.get("authorize_url") if item.get("status") == "pending" else "",
            "expires_at": _display_iso(datetime.fromtimestamp(float(item.get("expires_at") or 0), timezone.utc).isoformat()),
            "status": item.get("status"),
        }

    def current(self) -> dict[str, Any] | None:
        with self._lock:
            pending = [item for item in self._sessions_locked() if item.get("status") == "pending" and float(item.get("expires_at") or 0) > time.time()]
            return self._public(pending[-1]) if pending else None

    def start(self, target_slot: str | None = None) -> dict[str, Any]:
        if not self.client_id:
            raise ValueError("未配置 ChatGPT OAuth client id")
        slot = str(target_slot or "").strip()
        if slot and slot not in {item["slot"] for item in self.pool.slots()}:
            raise ValueError("账号槽位不存在")
        with self._lock:
            sessions = self._sessions_locked()
            for item in sessions:
                if item.get("status") == "pending" and float(item.get("expires_at") or 0) > time.time():
                    return self._public(item)
            verifier = secrets.token_urlsafe(64)
            challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode("utf-8")).digest()).rstrip(b"=").decode("ascii")
            state = secrets.token_urlsafe(32)
            query = urlencode(
                {
                    "response_type": "code",
                    "client_id": self.client_id,
                    "redirect_uri": self.redirect_uri,
                    "scope": "openid profile email offline_access",
                    "code_challenge": challenge,
                    "code_challenge_method": "S256",
                    "state": state,
                    "id_token_add_organizations": "true",
                }
            )
            item = {
                "id": secrets.token_urlsafe(18),
                "slot": slot,
                "status": "pending",
                "state": state,
                "verifier": verifier,
                "authorize_url": f"{self.issuer}/oauth/authorize?{query}",
                "expires_at": time.time() + 20 * 60,
            }
            sessions.append(item)
            self._save_locked(sessions)
            return self._public(item)

    @staticmethod
    def _authorization_input(value: str) -> tuple[str, str]:
        text = value.strip()
        query = urlparse(text).query if "://" in text or "?" in text else text.lstrip("?")
        parsed = parse_qs(query)
        return str((parsed.get("code") or [""])[0]), str((parsed.get("state") or [""])[0])

    def complete(self, session_id: str, authorization_input: str) -> dict[str, Any]:
        with self._lock:
            sessions = self._sessions_locked()
            item = next((entry for entry in sessions if entry.get("id") == session_id), None)
            if item is None or item.get("status") != "pending" or float(item.get("expires_at") or 0) <= time.time():
                raise ValueError("登录会话不存在或已过期")
            code, state = self._authorization_input(authorization_input)
            if not code or not state or not hmac.compare_digest(state, str(item.get("state") or "")):
                raise ValueError("回调地址无效")
            verifier = str(item.get("verifier") or "")

        try:
            response = requests.post(
                self.token_url,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.redirect_uri,
                    "client_id": self.client_id,
                    "code_verifier": verifier,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json"},
                timeout=30,
            )
            response.raise_for_status()
            result = response.json()
        except (requests.RequestException, ValueError) as error:
            raise ValueError("ChatGPT 授权兑换失败") from error

        id_token = result.get("id_token") if isinstance(result, dict) else None
        access_token = result.get("access_token") if isinstance(result, dict) else None
        refresh_token = result.get("refresh_token") if isinstance(result, dict) else None
        if not all(isinstance(value, str) and value for value in (id_token, access_token, refresh_token)):
            raise ValueError("ChatGPT 授权结果不完整")
        claims = _jwt_claims(id_token)
        auth_claims = claims.get("https://api.openai.com/auth") if isinstance(claims.get("https://api.openai.com/auth"), dict) else {}
        account_id = str(auth_claims.get("chatgpt_account_id") or "")
        auth = {
            "tokens": {
                "id_token": id_token,
                "access_token": access_token,
                "refresh_token": refresh_token,
                "account_id": account_id,
            },
            "last_refresh": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        }
        slot = self.pool.save_authorization(auth, str(item.get("slot") or "") or None)

        with self._lock:
            sessions = self._sessions_locked()
            for entry in sessions:
                if entry.get("id") == session_id:
                    entry["status"] = "completed"
                    entry["slot"] = slot
                    entry.pop("state", None)
                    entry.pop("verifier", None)
                    entry.pop("authorize_url", None)
            self._save_locked(sessions)
        return {"slot": slot, "email": str(claims.get("email") or "-"), "plan": str(auth_claims.get("chatgpt_plan_type") or "-").upper()}


class PoolQuotaRefresher:
    def __init__(self, pool: AccountPool, refresh_slot) -> None:
        self.pool = pool
        self.refresh_slot = refresh_slot
        self._lock = threading.Lock()
        self._state: dict[str, Any] = {"status": "idle", "started_at": None, "finished_at": None, "completed": 0, "failed": 0}

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            state = dict(self._state)
        state["started_at_display"] = _display_iso(state.get("started_at"))
        state["finished_at_display"] = _display_iso(state.get("finished_at"))
        return state

    def start(self) -> dict[str, Any]:
        with self._lock:
            if self._state.get("status") == "running":
                running = True
            else:
                running = False
                self._state = {"status": "running", "started_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"), "finished_at": None, "completed": 0, "failed": 0}
        if not running:
            threading.Thread(target=self._worker, name="chatmock-gateway-quota-refresh", daemon=True).start()
        return self.snapshot()

    def _worker(self) -> None:
        completed = 0
        failed = 0
        for account in self.pool.slots():
            if not account["enabled"]:
                continue
            try:
                if self.refresh_slot(account["slot"]):
                    completed += 1
                else:
                    failed += 1
            except Exception:
                failed += 1
        with self._lock:
            self._state.update(
                {
                    "status": "completed",
                    "finished_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                    "completed": completed,
                    "failed": failed,
                }
            )


class UsageStore:
    """Local key registry and request ledger. Request bodies and raw keys are never stored."""

    def __init__(self, state_dir: Path) -> None:
        state_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._key_secret = self._load_key_secret(state_dir)
        self._connection = sqlite3.connect(state_dir / "usage.sqlite3", check_same_thread=False, timeout=5)
        self._migrate()

    @staticmethod
    def _load_key_secret(state_dir: Path) -> bytes:
        return _load_private_secret(state_dir / "key-secret.bin")

    def _migrate(self) -> None:
        with self._lock, self._connection:
            self._connection.execute(
                """
                CREATE TABLE IF NOT EXISTS api_keys (
                    id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL COLLATE NOCASE UNIQUE,
                    token_hash TEXT NOT NULL UNIQUE,
                    token_prefix TEXT NOT NULL,
                    created_at REAL NOT NULL,
                    disabled_at REAL,
                    last_used_at REAL
                )
                """
            )
            self._connection.execute(
                """
                CREATE TABLE IF NOT EXISTS requests (
                    id INTEGER PRIMARY KEY,
                    occurred_at REAL NOT NULL,
                    path TEXT NOT NULL,
                    method TEXT NOT NULL,
                    status INTEGER NOT NULL,
                    duration_ms INTEGER NOT NULL
                )
                """
            )
            columns = {
                "api_key_id": "INTEGER",
                "model": "TEXT",
                "input_tokens": "INTEGER",
                "cached_input_tokens": "INTEGER",
                "output_tokens": "INTEGER",
                "cost_usd": "REAL",
            }
            existing = {row[1] for row in self._connection.execute("PRAGMA table_info(requests)")}
            for name, definition in columns.items():
                if name not in existing:
                    self._connection.execute(f"ALTER TABLE requests ADD COLUMN {name} {definition}")
            self._connection.execute("CREATE INDEX IF NOT EXISTS requests_occurred_at_idx ON requests(occurred_at)")
            self._connection.execute("CREATE INDEX IF NOT EXISTS requests_api_key_idx ON requests(api_key_id)")

    def _hash_key(self, raw_key: str) -> str:
        return hmac.new(self._key_secret, raw_key.encode("utf-8"), hashlib.sha256).hexdigest()

    def create_key(self, name: str) -> dict[str, Any]:
        display_name = name.strip()
        if not display_name or len(display_name) > 80 or any(ord(char) < 32 for char in display_name):
            raise ValueError("密钥名称长度必须为 1 到 80 个字符")
        raw_key = "cmg_" + secrets.token_urlsafe(30)
        now = time.time()
        token_hash = self._hash_key(raw_key)
        with self._lock, self._connection:
            try:
                cursor = self._connection.execute(
                    "INSERT INTO api_keys(name, token_hash, token_prefix, created_at) VALUES (?, ?, ?, ?)",
                    (display_name, token_hash, raw_key[:14], now),
                )
            except sqlite3.IntegrityError as error:
                raise ValueError("已存在同名的密钥") from error
        return {"id": int(cursor.lastrowid), "name": display_name, "key": raw_key, "prefix": raw_key[:14]}

    def resolve_key(self, raw_key: str | None) -> dict[str, Any] | None:
        if not raw_key or not raw_key.startswith("cmg_"):
            return None
        token_hash = self._hash_key(raw_key)
        with self._lock, self._connection:
            row = self._connection.execute(
                "SELECT id, name, token_prefix FROM api_keys WHERE token_hash = ? AND disabled_at IS NULL",
                (token_hash,),
            ).fetchone()
            if row is None:
                return None
            self._connection.execute("UPDATE api_keys SET last_used_at = ? WHERE id = ?", (time.time(), row[0]))
        return {"id": int(row[0]), "name": str(row[1]), "prefix": str(row[2])}

    def set_enabled(self, key_id: int, enabled: bool) -> bool:
        value = None if enabled else time.time()
        with self._lock, self._connection:
            cursor = self._connection.execute("UPDATE api_keys SET disabled_at = ? WHERE id = ?", (value, key_id))
        return cursor.rowcount == 1

    def record(
        self,
        key_id: int,
        path: str,
        method: str,
        status: int,
        duration_ms: int,
        model: str | None,
        input_tokens: int | None,
        cached_tokens: int | None,
        output_tokens: int | None,
    ) -> None:
        now = time.time()
        cost = _price_for(model, input_tokens, cached_tokens, output_tokens)
        with self._lock, self._connection:
            self._connection.execute(
                """
                INSERT INTO requests(
                    occurred_at, path, method, status, duration_ms, api_key_id, model,
                    input_tokens, cached_input_tokens, output_tokens, cost_usd
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (now, path, method, status, duration_ms, key_id, model, input_tokens, cached_tokens, output_tokens, cost),
            )
            self._connection.execute("DELETE FROM requests WHERE occurred_at < ?", (now - 30 * 24 * 3600,))

    def summary(self) -> dict[str, Any]:
        since = time.time() - 24 * 3600
        with self._lock:
            row = self._connection.execute(
                """
                SELECT COUNT(*),
                       COALESCE(SUM(CASE WHEN status >= 500 THEN 1 ELSE 0 END), 0),
                       COALESCE(AVG(duration_ms), 0),
                       COALESCE(SUM(input_tokens), 0),
                       COALESCE(SUM(output_tokens), 0),
                       COALESCE(SUM(cost_usd), 0),
                       COALESCE(SUM(CASE WHEN status < 400 AND model IS NOT NULL AND cost_usd IS NULL THEN 1 ELSE 0 END), 0)
                FROM requests WHERE occurred_at >= ?
                """,
                (since,),
            ).fetchone()
            active_keys = self._connection.execute("SELECT COUNT(*) FROM api_keys WHERE disabled_at IS NULL").fetchone()[0]
        return {
            "requests_24h": int(row[0]),
            "errors_24h": int(row[1]),
            "average_latency_ms": round(float(row[2])),
            "input_tokens_24h": int(row[3]),
            "output_tokens_24h": int(row[4]),
            "cost_usd_24h": float(row[5]),
            "unpriced_requests_24h": int(row[6]),
            "active_keys": int(active_keys),
        }

    def list_keys(self) -> list[dict[str, Any]]:
        with self._lock:
            rows = self._connection.execute(
                """
                SELECT k.id, k.name, k.token_prefix, k.created_at, k.disabled_at, k.last_used_at,
                       COUNT(r.id), COALESCE(SUM(r.input_tokens), 0), COALESCE(SUM(r.output_tokens), 0),
                       COALESCE(SUM(r.cost_usd), 0),
                       COALESCE(SUM(CASE WHEN r.status < 400 AND r.model IS NOT NULL AND r.cost_usd IS NULL THEN 1 ELSE 0 END), 0)
                FROM api_keys k
                LEFT JOIN requests r ON r.api_key_id = k.id
                GROUP BY k.id
                ORDER BY k.created_at DESC
                """
            ).fetchall()
        def display_timestamp(value: float | None) -> str:
            if value is None:
                return "Never"
            return time.strftime("%Y-%m-%d %H:%M", time.localtime(float(value)))

        return [
            {
                "id": int(row[0]), "name": str(row[1]), "prefix": str(row[2]), "created_at": float(row[3]),
                "created_at_display": display_timestamp(float(row[3])), "disabled": row[4] is not None,
                "last_used_at": row[5], "last_used_at_display": display_timestamp(row[5]), "request_count": int(row[6]),
                "input_tokens": int(row[7]), "output_tokens": int(row[8]), "cost_usd": float(row[9]),
                "unpriced_requests": int(row[10]),
            }
            for row in rows
        ]


class GatewayMetrics:
    def __init__(self, store: UsageStore) -> None:
        self.started_at = time.time()
        self.store = store
        self._lock = threading.Lock()
        self._active = 0

    def started(self) -> None:
        with self._lock:
            self._active += 1

    def finished(
        self,
        key_id: int,
        path: str,
        method: str,
        status: int,
        duration_ms: int,
        model: str | None,
        usage: tuple[int | None, int | None, int | None],
    ) -> None:
        with self._lock:
            self._active = max(0, self._active - 1)
        input_tokens, cached_tokens, output_tokens = usage
        self.store.record(key_id, path, method, status, duration_ms, model, input_tokens, cached_tokens, output_tokens)

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            active = self._active
        return {**self.store.summary(), "active_requests": active, "uptime_seconds": int(time.time() - self.started_at)}


LOGIN_HTML = """<!doctype html>
<html lang=\"zh-CN\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">
<title>网关登录</title><style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f3f4f6;color:#172033;font:15px system-ui,sans-serif}
form{width:min(360px,calc(100vw - 40px));padding:28px;background:#fff;border:1px solid #d9dee8;border-radius:8px;box-shadow:0 12px 36px #17203316}
h1{margin:0 0 20px;font-size:20px}label,input,button{display:block;width:100%;box-sizing:border-box}input{margin:8px 0 16px;padding:10px;border:1px solid #aeb7c6;border-radius:5px}button{padding:10px;border:0;border-radius:5px;background:#146c94;color:#fff;font-weight:600}
</style><form method=\"post\" action=\"/admin/login\"><h1>ChatMock 网关</h1><label>管理员令牌<input type=\"password\" name=\"token\" autofocus required></label><button type=\"submit\">登录</button></form></html>"""

DASHBOARD_HTML = """<!doctype html>
<html lang=\"zh-CN\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">
<title>ChatMock 网关</title><style>
:root{color:#172033;background:#f3f4f6;font:15px system-ui,sans-serif}body{margin:0}.wrap{max-width:1160px;margin:0 auto;padding:30px 20px 48px}.top{display:flex;justify-content:space-between;gap:20px;align-items:center;margin-bottom:22px}h1{font-size:24px;margin:0}h2{font-size:18px;margin:0 0 14px}h3{font-size:15px;margin:0 0 10px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(168px,1fr));gap:12px}.item,.section{background:#fff;border:1px solid #d9dee8;border-radius:7px}.item{padding:16px}.section{margin-top:18px;padding:20px}.label{display:block;color:#637083;font-size:12px;margin-bottom:7px}.value{font-size:20px;font-weight:650}.ok{color:#087f5b}.warn{color:#b35a00}a{color:#146c94}.muted{color:#637083;font-size:13px}.notice{margin-top:18px;padding:16px;border:1px solid #48a779;background:#effaf4;border-radius:7px}.notice code{display:block;overflow:auto;margin-top:10px;padding:10px;background:#fff;border:1px solid #b8ddc7;border-radius:5px;font-size:13px}.key-form{display:grid;grid-template-columns:minmax(200px,1fr) auto;gap:10px;align-items:end}.key-form label{display:grid;gap:6px;color:#526074;font-size:13px}input,button{box-sizing:border-box;font:inherit}input{width:100%;padding:9px;border:1px solid #aeb7c6;border-radius:5px}button{padding:9px 12px;border:0;border-radius:5px;background:#146c94;color:#fff;font-weight:600;cursor:pointer}button.danger{background:#a33a32}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;min-width:780px}th,td{padding:11px 8px;border-bottom:1px solid #e4e8ef;text-align:left;vertical-align:middle}th{color:#637083;font-size:12px;font-weight:600}td.num,th.num{text-align:right}td form{margin:0}.small{font-size:12px;color:#637083}.pool-head,.pool-actions{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}.pool-actions{justify-content:flex-start}.pool-actions form{margin:0}.pool-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:18px;padding:0 0 16px;border-bottom:1px solid #e4e8ef}.pool-summary strong{display:block;font-size:19px;margin-top:5px}.login-flow{margin:18px 0;padding:14px 0;border-bottom:1px solid #e4e8ef}.login-flow form{display:grid;grid-template-columns:1fr auto;gap:10px;margin-top:12px}.account-actions{display:flex;gap:6px;flex-wrap:wrap}.account-actions form{margin:0}.account-actions button{font-size:12px;padding:7px 9px}.meta{margin-top:22px;padding-top:18px;border-top:1px solid #d9dee8;color:#637083;font-size:13px}@media(max-width:620px){.wrap{padding:22px 14px}.top{align-items:flex-start}.key-form,.login-flow form{grid-template-columns:1fr}.key-form button,.login-flow button{width:100%}}</style>
<body><main class=\"wrap\"><div class=\"top\"><div><h1>ChatMock 网关</h1></div><a href=\"/admin/logout\">退出登录</a></div>
<section class=\"grid\"><div class=\"item\"><span class=\"label\">服务状态</span><span class=\"value ok\">运行中</span></div><div class=\"item\"><span class=\"label\">ChatMock 版本</span><span class=\"value\">{{ status.chatmock_version }}</span></div><div class=\"item\"><span class=\"label\">有效密钥</span><span class=\"value\">{{ status.active_keys }}</span></div><div class=\"item\"><span class=\"label\">近 24 小时请求</span><span class=\"value\">{{ status.requests_24h }}</span></div><div class=\"item\"><span class=\"label\">近 24 小时输入 token</span><span class=\"value\">{{ status.input_tokens_24h }}</span></div><div class=\"item\"><span class=\"label\">近 24 小时输出 token</span><span class=\"value\">{{ status.output_tokens_24h }}</span></div><div class=\"item\"><span class=\"label\">近 24 小时预计成本</span><span class=\"value\">${{ '%.6f'|format(status.cost_usd_24h) }}</span></div><div class=\"item\"><span class=\"label\">近 24 小时未计价请求</span><span class=\"value {{ 'warn' if status.unpriced_requests_24h else 'ok' }}\">{{ status.unpriced_requests_24h }}</span></div><div class=\"item\"><span class=\"label\">近 24 小时服务端错误</span><span class=\"value {{ 'warn' if status.errors_24h else 'ok' }}\">{{ status.errors_24h }}</span></div><div class=\"item\"><span class=\"label\">平均响应时间</span><span class=\"value\">{{ status.average_latency_ms }} ms</span></div><div class=\"item\"><span class=\"label\">进行中的请求</span><span class=\"value\">{{ status.active_requests }}</span></div><div class=\"item\"><span class=\"label\">授权配置</span><span class=\"value {{ 'ok' if status.auth_present else 'warn' }}\">{{ '已配置' if status.auth_present else '未配置' }}</span></div></section>
<section class=\"section\"><div class=\"pool-head\"><h2>普通账号池</h2><div class=\"pool-actions\"><form method=\"post\" action=\"/admin/pool/login\"><input type=\"hidden\" name=\"csrf_token\" value=\"{{ csrf_token }}\"><button type=\"submit\">添加账号</button></form><form method=\"post\" action=\"/admin/pool/limits/refresh\"><input type=\"hidden\" name=\"csrf_token\" value=\"{{ csrf_token }}\"><button type=\"submit\">获取额度</button></form></div></div><div class=\"pool-summary\"><div><span class=\"label\">账号总数</span><strong>{{ pool.account_count }}</strong></div><div><span class=\"label\">可用账号</span><strong>{{ pool.active_count }}</strong></div><div><span class=\"label\">额度采集</span><strong>{{ '采集中' if pool.quota_refresh.status == 'running' else ('完成' if pool.quota_refresh.status == 'completed' else '未开始') }}</strong><span class=\"small\">成功 {{ pool.quota_refresh.completed }}，失败 {{ pool.quota_refresh.failed }}</span></div></div>{% if pool.login %}<div class=\"login-flow\"><h3>{{ pool.login.mode }}</h3><a href=\"{{ pool.login.authorize_url }}\" target=\"_blank\" rel=\"noopener\">打开 ChatGPT 登录页面</a><form method=\"post\" action=\"/admin/pool/login/complete\"><input type=\"hidden\" name=\"csrf_token\" value=\"{{ csrf_token }}\"><input type=\"hidden\" name=\"session_id\" value=\"{{ pool.login.id }}\"><input name=\"callback\" required autocomplete=\"off\" placeholder=\"粘贴浏览器回调地址\"><button type=\"submit\">完成登录</button></form><div class=\"small\">有效至 {{ pool.login.expires_at }}</div></div>{% endif %}<div class=\"table-wrap\"><table><thead><tr><th>槽位</th><th>账号</th><th>套餐</th><th>状态</th><th>主额度</th><th>次额度</th><th>额度更新时间</th><th>操作</th></tr></thead><tbody>{% for account in pool.accounts %}<tr><td><code>{{ account.slot }}</code></td><td>{{ account.email }}<div class=\"small\">{{ account.account_id }}</div></td><td>{{ account.plan }}<div class=\"small\">到期 {{ account.subscription_until }}</div></td><td class=\"{{ 'warn' if not account.enabled or account.frozen else 'ok' }}\">{{ '已禁用' if not account.enabled else ('冻结中' if account.frozen else '可用') }}<div class=\"small\">{{ account.frozen_until if account.frozen else '' }}</div></td><td>剩余 {{ account.primary.remaining_text }}<div class=\"small\">已用 {{ account.primary.used_text }}，重置 {{ account.primary.reset_text }}</div></td><td>剩余 {{ account.secondary.remaining_text }}<div class=\"small\">已用 {{ account.secondary.used_text }}，重置 {{ account.secondary.reset_text }}</div></td><td class=\"small\">{{ account.quota_captured }}</td><td><div class=\"account-actions\"><form method=\"post\" action=\"/admin/pool/login\"><input type=\"hidden\" name=\"csrf_token\" value=\"{{ csrf_token }}\"><input type=\"hidden\" name=\"slot\" value=\"{{ account.slot }}\"><button type=\"submit\">重新登录</button></form><form method=\"post\" action=\"/admin/pool/slots/{{ account.slot }}/enabled\"><input type=\"hidden\" name=\"csrf_token\" value=\"{{ csrf_token }}\"><input type=\"hidden\" name=\"enabled\" value=\"{{ '0' if account.enabled else '1' }}\"><button class=\"{{ 'danger' if account.enabled else '' }}\" type=\"submit\">{{ '禁用' if account.enabled else '启用' }}</button></form><form method=\"post\" action=\"/admin/pool/slots/{{ account.slot }}/freeze\"><input type=\"hidden\" name=\"csrf_token\" value=\"{{ csrf_token }}\"><input type=\"hidden\" name=\"seconds\" value=\"{{ '0' if account.frozen else '300' }}\"><button type=\"submit\">{{ '解冻' if account.frozen else '冻结 5 分钟' }}</button></form></div></td></tr>{% else %}<tr><td colspan=\"8\" class=\"muted\">尚未添加 ChatGPT 账号。</td></tr>{% endfor %}</tbody></table></div></section>
{% if created_key %}<section class=\"notice\"><h2>已签发密钥：{{ created_key.name }}</h2><span class=\"muted\">原始密钥仅在本次响应中显示，请立即保存。</span><code>{{ created_key.key }}</code></section>{% endif %}
{% if error %}<section class=\"notice\" style=\"border-color:#d98680;background:#fff4f2\"><strong>{{ error }}</strong></section>{% endif %}
<section class=\"section\"><h2>签发密钥</h2><form class=\"key-form\" method=\"post\" action=\"/admin/keys\"><input type=\"hidden\" name=\"csrf_token\" value=\"{{ csrf_token }}\"><label>密钥名称<input name=\"name\" maxlength=\"80\" required autocomplete=\"off\" placeholder=\"例如：张三的电脑\"></label><button type=\"submit\">签发密钥</button></form></section>
<section class=\"section\"><h2>密钥列表</h2><div class=\"table-wrap\"><table><thead><tr><th>名称</th><th>前缀</th><th>状态</th><th class=\"num\">请求次数</th><th class=\"num\">输入 token</th><th class=\"num\">输出 token</th><th class=\"num\">预计成本</th><th class=\"num\">未计价</th><th>最近使用</th><th></th></tr></thead><tbody>{% for key in keys %}<tr><td>{{ key.name }}<div class=\"small\">创建于 {{ key.created_at_display }}</div></td><td><code>{{ key.prefix }}</code></td><td class=\"{{ 'warn' if key.disabled else 'ok' }}\">{{ '已禁用' if key.disabled else '已启用' }}</td><td class=\"num\">{{ key.request_count }}</td><td class=\"num\">{{ key.input_tokens }}</td><td class=\"num\">{{ key.output_tokens }}</td><td class=\"num\">${{ '%.6f'|format(key.cost_usd) }}</td><td class=\"num {{ 'warn' if key.unpriced_requests else '' }}\">{{ key.unpriced_requests }}</td><td class=\"small\">{{ key.last_used_at_display }}</td><td><form method=\"post\" action=\"/admin/keys/{{ key.id }}/enabled\"><input type=\"hidden\" name=\"csrf_token\" value=\"{{ csrf_token }}\"><input type=\"hidden\" name=\"enabled\" value=\"{{ '0' if not key.disabled else '1' }}\"><button class=\"{{ 'danger' if not key.disabled else '' }}\" type=\"submit\">{{ '禁用' if not key.disabled else '启用' }}</button></form></td></tr>{% else %}<tr><td colspan=\"10\" class=\"muted\">尚未签发密钥。</td></tr>{% endfor %}</tbody></table></div></section>
<section class=\"section\"><h2>标准 API 价格</h2><div class=\"table-wrap\"><table><thead><tr><th>模型</th><th class=\"num\">输入</th><th class=\"num\">缓存输入</th><th class=\"num\">输出</th></tr></thead><tbody>{% for row in pricing.models %}<tr><td>{{ row.model }}</td><td class=\"num\">${{ '%.3f'|format(row.input) }}</td><td class=\"num\">{% if row.cached_input is not none %}${{ '%.3f'|format(row.cached_input) }}{% else %}-{% endif %}</td><td class=\"num\">${{ '%.3f'|format(row.output) }}</td></tr>{% endfor %}</tbody></table></div><div class=\"meta\">单位：USD / 100 万 token。<a href=\"{{ pricing.source_url }}\">OpenAI 官方定价</a>，核验日期 {{ pricing.checked_at }}。</div></section>
<div class=\"meta\">源码提交 {{ status.source_commit }}</div></main></body></html>"""


DASHBOARD_HTML = DASHBOARD_HTML.replace(
    "{% if created_key %}",
    r"""<section class="section"><h2>池子低额度保护</h2><div class="small">主额度总剩余 {{ pool.protection.remaining_text }}，已纳入 {{ pool.protection.eligible_accounts }} 个可用账号。<span class="{{ 'warn' if pool.protection.active else ('ok' if pool.protection.enabled else 'muted') }}">{{ '保护已触发' if pool.protection.active else ('保护待命' if pool.protection.enabled else '保护关闭') }}</span></div><form class="key-form" method="post" action="/admin/pool/protection"><input type="hidden" name="csrf_token" value="{{ csrf_token }}"><label><span>启用</span><input style="width:auto" type="checkbox" name="enabled" value="1" {% if pool.protection.enabled %}checked{% endif %}></label><label>阈值 (%)<input name="threshold_percent" type="number" min="0" max="100" step="0.1" value="{{ pool.protection.threshold_percent }}" required></label><label>目标模型<input name="model" maxlength="120" value="{{ pool.protection.model }}" required></label><label>思考强度<select name="reasoning_effort">{% for effort in ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'] %}<option value="{{ effort }}" {% if pool.protection.reasoning_effort == effort %}selected{% endif %}>{{ effort }}</option>{% endfor %}</select></label><button type="submit">保存保护规则</button></form><div class="small">触发目标：{{ pool.protection.target_model }}</div></section>{% if created_key %}""",
)


def _configured_token(name: str) -> str:
    return os.getenv(name, "").strip()


def _bearer_token() -> str | None:
    value = request.headers.get("Authorization", "")
    prefix = "Bearer "
    return value[len(prefix) :] if value.startswith(prefix) else None


def _matches_bearer(expected: str) -> bool:
    supplied = _bearer_token()
    return bool(expected and supplied) and hmac.compare_digest(supplied, expected)


def create_gateway_app(verbose: bool = False) -> Flask:
    install_embedded_chatmock()
    from chatmock.app import create_app
    from chatmock import limits as chatmock_limits
    from chatmock import model_catalog as chatmock_model_catalog
    from chatmock import upstream as chatmock_upstream
    from chatmock import utils as chatmock_utils
    from chatmock import websocket_routes as chatmock_websocket_routes
    from chatmock.config import CLIENT_ID_DEFAULT, OAUTH_ISSUER_DEFAULT, OAUTH_TOKEN_URL
    from chatmock.model_registry import list_public_models
    from chatmock.version import __version__

    state_dir = Path(os.getenv("GATEWAY_STATE_DIR", "~/.chatmock-gateway")).expanduser()
    legacy_home = Path(chatmock_utils.get_home_dir())
    account_pool = AccountPool(state_dir, legacy_home)

    # ChatMock reads its auth and quota paths through module globals. Bind those
    # globals to the request's selected pool slot instead of mutating process env.
    chatmock_utils.get_home_dir = account_pool.active_home
    chatmock_utils.read_auth_file = account_pool.read_active_auth
    chatmock_utils.write_auth_file = account_pool.write_active_auth
    chatmock_limits.get_home_dir = account_pool.active_home
    chatmock_model_catalog.get_home_dir = account_pool.active_home
    chatmock_model_catalog.read_auth_file = account_pool.read_active_auth
    active_auth = chatmock_utils.get_effective_chatgpt_auth
    chatmock_upstream.get_effective_chatgpt_auth = active_auth
    chatmock_websocket_routes.get_effective_chatgpt_auth = active_auth

    # Catalog refresh runs in a background thread in upstream ChatMock. The
    # dashboard refreshes limits per slot instead, so a thread never loses the
    # request-scoped slot context.
    app = create_app(verbose=verbose, model_sync=False)
    app.secret_key = _configured_token("GATEWAY_SESSION_SECRET") or secrets.token_urlsafe(32)
    app.config["SESSION_COOKIE_HTTPONLY"] = True
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
    app.config["SESSION_COOKIE_SECURE"] = os.getenv("GATEWAY_SESSION_COOKIE_SECURE", "").strip().lower() in {"1", "true", "yes"}
    app.extensions["gateway_account_pool"] = account_pool
    store = UsageStore(state_dir)
    app.extensions["gateway_usage_store"] = store
    affinity_store = PoolAffinityStore(state_dir)
    protection = PoolProtection(state_dir, account_pool)
    metrics = GatewayMetrics(store)
    admin_token = _configured_token("GATEWAY_ADMIN_TOKEN")
    login_sessions = PoolLoginSessions(state_dir, account_pool, CLIENT_ID_DEFAULT, OAUTH_ISSUER_DEFAULT, OAUTH_TOKEN_URL)
    app.extensions["gateway_pool_affinity"] = affinity_store
    app.extensions["gateway_pool_protection"] = protection

    def refresh_pool_slot(slot: str) -> bool:
        context_token = account_pool.activate(slot)
        response = None
        try:
            access_token, account_id = active_auth()
            if not access_token or not account_id:
                return False
            catalog = app.extensions.get("chatmock_model_catalog")
            if catalog is None:
                return False
            response = catalog._request_models(access_token, account_id)
            if response.status_code == 401:
                response.close()
                response = None
                access_token, account_id = active_auth(force_refresh=True)
                if not access_token or not account_id:
                    return False
                response = catalog._request_models(access_token, account_id)
            chatmock_limits.record_rate_limits_from_response(response)
            return response.status_code < 400
        except Exception:
            return False
        finally:
            if response is not None:
                try:
                    response.close()
                except Exception:
                    pass
            account_pool.reset(context_token)

    quota_refresher = PoolQuotaRefresher(account_pool, refresh_pool_slot)
    app.extensions["gateway_quota_refresher"] = quota_refresher

    def is_admin() -> bool:
        return bool(session.get("gateway_admin")) or _matches_bearer(admin_token)

    def has_admin_bearer() -> bool:
        return _matches_bearer(admin_token)

    def admin_configuration_error():
        return jsonify({"error": "GATEWAY_ADMIN_TOKEN is required for the management panel"}), 503

    def csrf_token() -> str:
        token = session.get("gateway_csrf")
        if not isinstance(token, str) or not token:
            token = secrets.token_urlsafe(24)
            session["gateway_csrf"] = token
        return token

    def request_data() -> dict[str, Any]:
        if request.is_json:
            body = request.get_json(silent=True)
            return body if isinstance(body, dict) else {}
        return request.form.to_dict()

    def csrf_is_valid() -> bool:
        if has_admin_bearer():
            return True
        supplied = request.headers.get("X-CSRF-Token") or request_data().get("csrf_token")
        expected = session.get("gateway_csrf")
        return isinstance(supplied, str) and isinstance(expected, str) and hmac.compare_digest(supplied, expected)

    def json_requested() -> bool:
        return request.is_json or "application/json" in request.headers.get("Accept", "")

    def requested_model() -> str | None:
        value = request_data().get("model") if request.method in {"POST", "PUT", "PATCH"} else request.args.get("model")
        return value.strip() if isinstance(value, str) and value.strip() else None

    def apply_protection_model(payload: dict[str, Any], target_model: str) -> bool:
        if not request.is_json:
            return False
        payload["model"] = target_model
        # ChatMock uses both get_json() and get_data() across its compatibility
        # routes. Keep Flask's cached body aligned with the mutated JSON object.
        request._cached_data = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        return True

    def pricing_payload() -> dict[str, Any]:
        return {
            "source_url": PRICE_SOURCE_URL,
            "checked_at": PRICE_SOURCE_CHECKED_AT,
            "unit": "USD per 1M tokens",
            "models": [
                {"model": model, **rates}
                for model, rates in sorted(PRICES_USD_PER_MILLION.items())
            ],
        }

    def pool_payload() -> dict[str, Any]:
        accounts = account_pool.slots()
        return {
            "accounts": accounts,
            "account_count": len(accounts),
            "active_count": sum(1 for account in accounts if account["enabled"] and not account["frozen"]),
            "sticky_binding_count": affinity_store.count(),
            "protection": protection.status(),
            "login": login_sessions.current(),
            "quota_refresh": quota_refresher.snapshot(),
        }

    def status_payload() -> dict[str, Any]:
        try:
            model_count = len(list_public_models(expose_reasoning_models=False))
        except Exception:
            model_count = 0
        pool = pool_payload()
        return {
            **metrics.snapshot(),
            "chatmock_version": __version__,
            "source_commit": CHATMOCK_SOURCE_COMMIT[:12],
            "auth_present": pool["account_count"] > 0,
            "pool_account_count": pool["account_count"],
            "pool_active_count": pool["active_count"],
            "model_count": model_count,
        }

    def render_dashboard(*, created_key: dict[str, Any] | None = None, error: str | None = None, status: int = 200):
        return render_template_string(
            DASHBOARD_HTML,
            status=status_payload(),
            keys=store.list_keys(),
            pricing=pricing_payload(),
            pool=pool_payload(),
            csrf_token=csrf_token(),
            created_key=created_key,
            error=error,
        ), status

    app.extensions["gateway_status_payload"] = status_payload

    @app.before_request
    def gateway_access_control():
        path = request.path
        if path.startswith("/v1/"):
            gateway_key = store.resolve_key(_bearer_token())
            if gateway_key is None:
                return jsonify({"error": {"message": "Invalid or disabled gateway API key", "type": "authentication_error"}}), 401
            g.gateway_key_id = gateway_key["id"]
            payload = request_data()
            requested = requested_model()
            g.gateway_model = requested
            if path != "/v1/models":
                affinity_key = affinity_store.derive_key(gateway_key["id"], requested, payload, request.headers)
                protection_state = protection.status()
                if protection_state["active"] and apply_protection_model(payload, protection_state["target_model"]):
                    g.gateway_model = protection_state["target_model"]
                    g.gateway_protection_active = True
                g.gateway_affinity_key = affinity_key
                slot = account_pool.select(affinity_store.preferred_slot(affinity_key))
                if slot is None:
                    return jsonify({"error": {"message": "No enabled ChatGPT account is available in the pool", "type": "server_error"}}), 503
                g.gateway_pool_slot = slot
                g.gateway_pool_context = account_pool.activate(slot)
            g.gateway_request_started = time.perf_counter()
            metrics.started()
        elif path.startswith("/admin/"):
            if not admin_token:
                return admin_configuration_error()
            if path not in {"/admin/login", "/admin/logout"} and not is_admin():
                return jsonify({"error": "Admin authentication required"}), 401

    @app.after_request
    def gateway_metrics(response: Response):
        started = getattr(g, "gateway_request_started", None)
        if started is not None:
            key_id = int(g.gateway_key_id)
            model = getattr(g, "gateway_model", None)
            path = request.path
            method = request.method
            response_status = response.status_code

            def finish(usage: tuple[int | None, int | None, int | None]) -> None:
                duration_ms = int((time.perf_counter() - started) * 1000)
                metrics.finished(key_id, path, method, response_status, duration_ms, model, usage)

            if response.is_streamed:
                original_stream = response.response
                parser = SSEUsageParser()

                def tracked_stream():
                    try:
                        for chunk in original_stream:
                            parser.feed(chunk)
                            yield chunk
                    finally:
                        finish(parser.usage)

                response.response = tracked_stream()
            else:
                finish(_usage_from_response(response))
        affinity_key = getattr(g, "gateway_affinity_key", None)
        pool_slot = getattr(g, "gateway_pool_slot", None)
        if affinity_key and pool_slot:
            if response.status_code < 400:
                affinity_store.remember(affinity_key, pool_slot)
            elif response.status_code in {401, 429, 502, 503, 504}:
                affinity_store.forget(affinity_key, pool_slot)
        pool_context = getattr(g, "gateway_pool_context", None)
        if pool_context is not None:
            account_pool.reset(pool_context)
        return response

    def dashboard():
        if not admin_token:
            return admin_configuration_error()
        if not is_admin():
            return render_template_string(LOGIN_HTML), 401
        return render_dashboard()

    # ChatMock registers / and /health with endpoint name "health". Replace that
    # view so the default port opens the panel while /healthz remains machine-readable.
    app.view_functions["health"] = dashboard

    @app.get("/healthz")
    def gateway_health():
        return jsonify({"status": "ok", "chatmock_version": __version__})

    @app.post("/admin/login")
    def gateway_login():
        if not admin_token:
            return admin_configuration_error()
        supplied = request.form.get("token", "")
        if hmac.compare_digest(supplied, admin_token):
            session["gateway_admin"] = True
            csrf_token()
            return redirect("/")
        return render_template_string(LOGIN_HTML), 401

    @app.get("/admin/logout")
    def gateway_logout():
        if not admin_token:
            return admin_configuration_error()
        session.pop("gateway_admin", None)
        session.pop("gateway_csrf", None)
        return redirect("/")

    @app.get("/admin/status")
    def gateway_status():
        if not admin_token:
            return admin_configuration_error()
        if not is_admin():
            return jsonify({"error": "Admin authentication required"}), 401
        return jsonify(status_payload())

    @app.get("/admin/keys")
    def gateway_keys():
        return jsonify({"keys": store.list_keys()})

    @app.post("/admin/keys")
    def gateway_create_key():
        if not csrf_is_valid():
            return jsonify({"error": "CSRF validation failed"}), 403
        name = request_data().get("name")
        try:
            created_key = store.create_key(name if isinstance(name, str) else "")
        except ValueError as error:
            if json_requested():
                return jsonify({"error": str(error)}), 400
            return render_dashboard(error=str(error), status=400)
        if json_requested():
            return jsonify({"key": created_key}), 201
        return render_dashboard(created_key=created_key, status=201)

    @app.post("/admin/keys/<int:key_id>/enabled")
    def gateway_key_enabled(key_id: int):
        if not csrf_is_valid():
            return jsonify({"error": "CSRF validation failed"}), 403
        value = request_data().get("enabled")
        if isinstance(value, bool):
            enabled = value
        elif isinstance(value, str) and value.strip().lower() in {"1", "true", "yes", "on", "enabled"}:
            enabled = True
        elif isinstance(value, str) and value.strip().lower() in {"0", "false", "no", "off", "disabled"}:
            enabled = False
        else:
            return jsonify({"error": "enabled must be a boolean"}), 400
        if not store.set_enabled(key_id, enabled):
            return jsonify({"error": "Key not found"}), 404
        if json_requested():
            return jsonify({"id": key_id, "enabled": enabled})
        return redirect("/")

    @app.get("/admin/pricing")
    def gateway_pricing():
        return jsonify(pricing_payload())

    @app.get("/admin/pool")
    def gateway_pool():
        return jsonify(pool_payload())

    @app.get("/admin/pool/protection")
    def gateway_pool_protection():
        return jsonify(protection.status())

    @app.post("/admin/pool/protection")
    def gateway_pool_protection_update():
        if not csrf_is_valid():
            return jsonify({"error": "CSRF validation failed"}), 403
        data = request_data()
        current = protection.config()
        next_config = dict(current)
        raw_enabled = data.get("enabled")
        if isinstance(raw_enabled, bool):
            next_config["enabled"] = raw_enabled
        elif isinstance(raw_enabled, str):
            next_config["enabled"] = raw_enabled.strip().lower() in {"1", "true", "yes", "on", "enabled"}
        elif not request.is_json:
            next_config["enabled"] = False
        for name in ("threshold_percent", "model", "reasoning_effort"):
            if name in data:
                next_config[name] = data[name]
        try:
            protection.update(next_config)
        except ValueError as error:
            if json_requested():
                return jsonify({"error": str(error)}), 400
            return render_dashboard(error=str(error), status=400)
        if json_requested():
            return jsonify({"protection": protection.status()})
        return redirect("/")

    @app.post("/admin/pool/login")
    def gateway_pool_login():
        if not csrf_is_valid():
            return jsonify({"error": "CSRF validation failed"}), 403
        target_slot = request_data().get("slot")
        try:
            login = login_sessions.start(target_slot if isinstance(target_slot, str) else None)
        except ValueError as error:
            if json_requested():
                return jsonify({"error": str(error)}), 400
            return render_dashboard(error=str(error), status=400)
        if json_requested():
            return jsonify({"login": login}), 201
        return redirect("/")

    @app.post("/admin/pool/login/complete")
    def gateway_pool_login_complete():
        if not csrf_is_valid():
            return jsonify({"error": "CSRF validation failed"}), 403
        data = request_data()
        session_id = data.get("session_id")
        callback = data.get("callback")
        try:
            completed = login_sessions.complete(
                session_id if isinstance(session_id, str) else "",
                callback if isinstance(callback, str) else "",
            )
        except ValueError as error:
            if json_requested():
                return jsonify({"error": str(error)}), 400
            return render_dashboard(error=str(error), status=400)
        if json_requested():
            return jsonify({"account": completed})
        return redirect("/")

    @app.post("/admin/pool/slots/<slot>/enabled")
    def gateway_pool_slot_enabled(slot: str):
        if not csrf_is_valid():
            return jsonify({"error": "CSRF validation failed"}), 403
        value = request_data().get("enabled")
        enabled = value is True or (isinstance(value, str) and value.strip().lower() in {"1", "true", "yes", "on", "enabled"})
        if not isinstance(value, (bool, str)):
            return jsonify({"error": "enabled must be a boolean"}), 400
        if not account_pool.set_enabled(slot, enabled):
            return jsonify({"error": "Account slot not found"}), 404
        if json_requested():
            return jsonify({"slot": slot, "enabled": enabled})
        return redirect("/")

    @app.post("/admin/pool/slots/<slot>/freeze")
    def gateway_pool_slot_freeze(slot: str):
        if not csrf_is_valid():
            return jsonify({"error": "CSRF validation failed"}), 403
        value = request_data().get("seconds", 0)
        try:
            seconds = int(value)
        except (TypeError, ValueError):
            return jsonify({"error": "seconds must be an integer"}), 400
        if seconds < 0 or seconds > 24 * 3600:
            return jsonify({"error": "seconds must be between 0 and 86400"}), 400
        if not account_pool.freeze(slot, seconds):
            return jsonify({"error": "Account slot not found"}), 404
        if json_requested():
            return jsonify({"slot": slot, "frozen_seconds": seconds})
        return redirect("/")

    @app.post("/admin/pool/limits/refresh")
    def gateway_pool_limits_refresh():
        if not csrf_is_valid():
            return jsonify({"error": "CSRF validation failed"}), 403
        job = quota_refresher.start()
        if json_requested():
            return jsonify({"job": job}), 202
        return redirect("/")

    return app


def run_login(headless: bool, no_browser: bool, verbose: bool) -> int:
    install_embedded_chatmock()
    from chatmock.cli import cmd_login

    return cmd_login(headless=headless, no_browser=no_browser, verbose=verbose)


def main() -> int:
    parser = argparse.ArgumentParser(description="Standalone ChatMock gateway")
    sub = parser.add_subparsers(dest="command")

    serve = sub.add_parser("serve", help="Run the proxy and dashboard")
    serve.add_argument("--host", default=os.getenv("GATEWAY_HOST", "127.0.0.1"))
    serve.add_argument("--port", type=int, default=int(os.getenv("GATEWAY_PORT", "18011")))
    serve.add_argument("--verbose", action="store_true")

    login = sub.add_parser("login", help="Authorize the ChatGPT profile")
    login.add_argument("--headless", action="store_true")
    login.add_argument("--no-browser", action="store_true")
    login.add_argument("--verbose", action="store_true")

    sub.add_parser("status", help="Print local non-sensitive gateway status")

    args = parser.parse_args(["serve"] if len(sys.argv) == 1 else None)
    if args.command == "login":
        return run_login(args.headless, args.no_browser, args.verbose)
    if args.command == "status":
        app = create_gateway_app()
        print(json.dumps(app.extensions["gateway_status_payload"](), indent=2))
        return 0

    if not _configured_token("GATEWAY_ADMIN_TOKEN"):
        print("ERROR: GATEWAY_ADMIN_TOKEN must be set before starting the gateway.", file=sys.stderr)
        return 2
    app = create_gateway_app(verbose=args.verbose)
    if args.host not in {"127.0.0.1", "::1", "localhost"} and not _configured_token("GATEWAY_SESSION_COOKIE_SECURE"):
        print("WARNING: set GATEWAY_SESSION_COOKIE_SECURE=1 when serving the dashboard over HTTPS.", file=sys.stderr)
    app.run(host=args.host, port=args.port, threaded=True, use_reloader=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
