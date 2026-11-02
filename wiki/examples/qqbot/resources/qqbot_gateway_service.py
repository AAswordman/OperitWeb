#!/usr/bin/env python3

import argparse
import base64
import hashlib
import json
import os
import signal
import socket
import ssl
import struct
import threading
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


MAX_QUEUE_ITEMS = 200
MAX_QUERY_LIMIT = 100
WS_DISPATCH = 0
WS_HEARTBEAT = 1
WS_IDENTITY = 2
WS_RESUME = 6
WS_RECONNECT = 7
WS_INVALID_SESSION = 9
WS_HELLO = 10
WS_HEARTBEAT_ACK = 11


def now_ms() -> int:
    return int(time.time() * 1000)


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def as_text(value) -> str:
    return "" if value is None else str(value)


def first_non_blank(*values) -> str:
    for value in values:
        text = as_text(value).strip()
        if text:
            return text
    return ""


def is_object(value) -> bool:
    return isinstance(value, dict)


class WebSocketClosed(Exception):
    def __init__(self, code=1006, reason="closed"):
        super().__init__(f"websocket closed: {code} {reason}")
        self.code = code
        self.reason = reason


class SimpleWebSocketClient:
    GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

    def __init__(self, url: str, timeout: float = 1.0):
        self.url = url
        self.timeout = timeout
        self.sock = None
        self.buffer = b""

    def connect(self) -> None:
        parsed = urllib.parse.urlsplit(self.url)
        scheme = parsed.scheme.lower()
        if scheme not in ("ws", "wss"):
            raise RuntimeError(f"unsupported websocket scheme: {scheme}")

        host = parsed.hostname or ""
        if not host:
            raise RuntimeError("missing websocket host")
        port = parsed.port or (443 if scheme == "wss" else 80)
        path = parsed.path or "/"
        if parsed.query:
            path = f"{path}?{parsed.query}"

        raw_sock = socket.create_connection((host, port), timeout=10)
        if scheme == "wss":
            context = ssl.create_default_context()
            sock = context.wrap_socket(raw_sock, server_hostname=host)
        else:
            sock = raw_sock
        sock.settimeout(self.timeout)
        self.sock = sock

        key = base64.b64encode(os.urandom(16)).decode("ascii")
        host_header = host if parsed.port is None else f"{host}:{port}"
        request_lines = [
            f"GET {path} HTTP/1.1",
            f"Host: {host_header}",
            "Upgrade: websocket",
            "Connection: Upgrade",
            f"Sec-WebSocket-Key: {key}",
            "Sec-WebSocket-Version: 13",
            "User-Agent: OperitQQBotGateway/0.3.0",
            "",
            "",
        ]
        self.sock.sendall("\r\n".join(request_lines).encode("utf-8"))

        response = self._recv_until(b"\r\n\r\n")
        header_text = response.decode("utf-8", errors="replace")
        lines = header_text.split("\r\n")
        status_line = lines[0] if lines else ""
        if "101" not in status_line:
            raise RuntimeError(f"websocket handshake failed: {status_line}")

        headers = {}
        for line in lines[1:]:
            if ":" not in line:
                continue
            name, value = line.split(":", 1)
            headers[name.strip().lower()] = value.strip()

        expected_accept = base64.b64encode(hashlib.sha1((key + self.GUID).encode("utf-8")).digest()).decode("ascii")
        if headers.get("sec-websocket-accept") != expected_accept:
            raise RuntimeError("invalid websocket accept header")

    def _recv_until(self, marker: bytes) -> bytes:
        while marker not in self.buffer:
            if self.sock is None:
                raise RuntimeError("websocket is not connected")
            chunk = self.sock.recv(4096)
            if not chunk:
                raise WebSocketClosed()
            self.buffer += chunk
        head, self.buffer = self.buffer.split(marker, 1)
        return head + marker

    def _recv_exact(self, size: int) -> bytes:
        while len(self.buffer) < size:
            if self.sock is None:
                raise RuntimeError("websocket is not connected")
            try:
                chunk = self.sock.recv(4096)
            except socket.timeout:
                raise
            if not chunk:
                raise WebSocketClosed()
            self.buffer += chunk
        data = self.buffer[:size]
        self.buffer = self.buffer[size:]
        return data

    def _send_frame(self, opcode: int, payload: bytes) -> None:
        if self.sock is None:
            raise RuntimeError("websocket is not connected")
        first = 0x80 | (opcode & 0x0F)
        length = len(payload)
        if length < 126:
            header = bytes([first, 0x80 | length])
        elif length < 65536:
            header = bytes([first, 0x80 | 126]) + struct.pack("!H", length)
        else:
            header = bytes([first, 0x80 | 127]) + struct.pack("!Q", length)
        mask = os.urandom(4)
        masked = bytes(payload[index] ^ mask[index % 4] for index in range(length))
        self.sock.sendall(header + mask + masked)

    def send_text(self, text: str) -> None:
        self._send_frame(0x1, text.encode("utf-8"))

    def send_pong(self, payload: bytes) -> None:
        self._send_frame(0xA, payload)

    def close(self, code: int = 1000, reason: str = "") -> None:
        try:
            payload = struct.pack("!H", code) + reason.encode("utf-8")
            self._send_frame(0x8, payload)
        except Exception:
            pass
        try:
            if self.sock is not None:
                self.sock.close()
        finally:
            self.sock = None

    def _recv_raw_frame(self):
        try:
            first_two = self._recv_exact(2)
        except socket.timeout:
            return None

        first = first_two[0]
        second = first_two[1]
        fin = (first & 0x80) != 0
        opcode = first & 0x0F
        masked = (second & 0x80) != 0
        length = second & 0x7F

        if length == 126:
            length = struct.unpack("!H", self._recv_exact(2))[0]
        elif length == 127:
            length = struct.unpack("!Q", self._recv_exact(8))[0]

        mask = self._recv_exact(4) if masked else b""
        payload = self._recv_exact(length) if length else b""
        if masked and mask:
            payload = bytes(payload[index] ^ mask[index % 4] for index in range(length))

        if opcode == 0x8:
            code = 1000
            reason = ""
            if len(payload) >= 2:
                code = struct.unpack("!H", payload[:2])[0]
                reason = payload[2:].decode("utf-8", errors="replace")
            raise WebSocketClosed(code, reason)

        if opcode == 0x9:
            self.send_pong(payload)
            return None

        if opcode == 0xA:
            return {"fin": fin, "opcode": opcode, "payload": payload}

        return {"fin": fin, "opcode": opcode, "payload": payload}

    def recv_frame(self):
        first_frame = self._recv_raw_frame()
        if first_frame is None:
            return None

        opcode = int(first_frame.get("opcode") or 0)
        payload = first_frame.get("payload") or b""
        fin = bool(first_frame.get("fin"))

        if opcode not in (0x1, 0x2, 0x0):
            return {"opcode": opcode, "payload": payload}

        if opcode == 0x0:
            return {"opcode": opcode, "payload": payload}

        if fin:
            return {"opcode": opcode, "payload": payload}

        chunks = [payload]
        while not fin:
            next_frame = self._recv_raw_frame()
            if next_frame is None:
                continue
            next_opcode = int(next_frame.get("opcode") or 0)
            next_payload = next_frame.get("payload") or b""
            fin = bool(next_frame.get("fin"))
            if next_opcode == 0xA:
                continue
            if next_opcode in (0x0, opcode):
                chunks.append(next_payload)
                continue
            chunks.append(next_payload)
            break
        return {"opcode": opcode, "payload": b"".join(chunks)}


class QQBotGatewayService:
    def __init__(self, args):
        self.package_version = args.package_version
        self.state_dir = args.state_dir
        self.app_id = args.app_id
        self.app_secret = args.app_secret
        self.use_sandbox = str(args.use_sandbox).lower() == "true"
        self.source = args.source or "manual"
        self.intents = int(args.intents or 0)
        self.control_token = args.control_token
        self.control_port = int(args.control_port or 32145)
        self.log_file = os.path.join(self.state_dir, "gateway_service.log")
        self.api_base_url = "https://sandbox.api.sgroup.qq.com" if self.use_sandbox else "https://api.sgroup.qq.com"
        self.status = "starting"
        self.running = False
        self.connected = False
        self.started_at = 0
        self.stopped_at = 0
        self.stop_reason = ""
        self.last_error = ""
        self.last_close_code = 0
        self.last_close_reason = ""
        self.last_packet_at = 0
        self.last_event_at = 0
        self.last_heartbeat_sent_at = 0
        self.last_heartbeat_ack_at = 0
        self.packet_count = 0
        self.event_count = 0
        self.reconnect_count = 0
        self.seq = 0
        self.session_id = ""
        self.gateway_url = ""
        self.bot_user_id = ""
        self.bot_username = ""
        self.token = ""
        self.token_expires_at = 0
        self.ws = None
        self.stop_requested = False
        self.lock = threading.RLock()
        self.queue = []
        self.contacts = {
            "users": {},
            "groups": {},
        }
        self.http_server = None
        self.http_thread = None
        os.makedirs(self.state_dir, exist_ok=True)

    def log(self, message: str):
        line = f"[{iso_now()}] {message}\n"
        try:
            with open(self.log_file, "a", encoding="utf-8") as handle:
                handle.write(line)
        except Exception:
            pass

    def persist_state(self):
        return None

    def build_recent_contact_items(self, map_value):
        if not is_object(map_value):
            return []
        items = []
        for key, value in map_value.items():
            entry = value if is_object(value) else {}
            items.append({
                "id": key,
                "lastSeenAt": first_non_blank(entry.get("lastSeenAt")),
                "lastEventType": first_non_blank(entry.get("lastEventType")),
                "lastMessageId": first_non_blank(entry.get("lastMessageId")),
                "preview": first_non_blank(entry.get("preview")),
            })
        items.sort(key=lambda item: as_text(item.get("lastSeenAt")), reverse=True)
        return items[:5]

    def build_contacts_summary(self):
        with self.lock:
            users = self.contacts.get("users") if is_object(self.contacts.get("users")) else {}
            groups = self.contacts.get("groups") if is_object(self.contacts.get("groups")) else {}
            return {
                "userCount": len(users),
                "groupCount": len(groups),
                "recentUsers": self.build_recent_contact_items(users),
                "recentGroups": self.build_recent_contact_items(groups),
            }

    def build_queue_summary(self):
        with self.lock:
            pending_count = len(self.queue)
            oldest = self.queue[0] if pending_count > 0 else {}
            newest = self.queue[-1] if pending_count > 0 else {}
            return {
                "pendingCount": pending_count,
                "oldestEventAt": first_non_blank(oldest.get("receivedAt"), oldest.get("timestamp")),
                "newestEventAt": first_non_blank(newest.get("receivedAt"), newest.get("timestamp")),
            }

    def status_payload(self):
        with self.lock:
            return {
                "success": True,
                "packageVersion": self.package_version,
                "mode": "websocket_gateway",
                "running": self.running,
                "connected": self.connected,
                "status": self.status,
                "source": self.source,
                "appId": self.app_id,
                "useSandbox": self.use_sandbox,
                "openApiBaseUrl": self.api_base_url,
                "intents": self.intents,
                "startedAt": self.started_at,
                "stoppedAt": self.stopped_at,
                "stopReason": self.stop_reason,
                "lastError": self.last_error,
                "lastCloseCode": self.last_close_code,
                "lastCloseReason": self.last_close_reason,
                "lastPacketAt": self.last_packet_at,
                "lastEventAt": self.last_event_at,
                "lastHeartbeatSentAt": self.last_heartbeat_sent_at,
                "lastHeartbeatAckAt": self.last_heartbeat_ack_at,
                "packetCount": self.packet_count,
                "eventCount": self.event_count,
                "reconnectCount": self.reconnect_count,
                "seq": self.seq,
                "sessionId": self.session_id,
                "gatewayUrl": self.gateway_url,
                "botUserId": self.bot_user_id,
                "botUsername": self.bot_username,
                "pid": os.getpid(),
                "controlPort": self.control_port,
                "queue": self.build_queue_summary(),
                "contacts": self.build_contacts_summary(),
            }

    def request_stop(self, reason: str):
        with self.lock:
            self.stop_reason = first_non_blank(reason, self.stop_reason, "stopped")
            self.stop_requested = True
            self.status = "stopping"
        try:
            if self.ws is not None:
                self.ws.close()
        except Exception:
            pass

    def fetch_json(self, url: str, method: str = "GET", headers=None, body=None):
        request = urllib.request.Request(url=url, method=method)
        for key, value in (headers or {}).items():
            request.add_header(key, value)
        payload = None
        if body is not None:
            payload = json.dumps(body).encode("utf-8")
        with urllib.request.urlopen(request, data=payload, timeout=20) as response:
            content = response.read().decode("utf-8", errors="replace")
            parsed = json.loads(content) if content.strip() else {}
            if not is_object(parsed):
                parsed = {}
            return response.status, parsed

    def get_access_token(self) -> str:
        if self.token and time.time() < max(0, self.token_expires_at - 60):
            return self.token
        status, data = self.fetch_json(
            "https://bots.qq.com/app/getAppAccessToken",
            method="POST",
            headers={"Accept": "application/json", "Content-Type": "application/json; charset=utf-8"},
            body={"appId": self.app_id, "clientSecret": self.app_secret},
        )
        token = first_non_blank(data.get("access_token"))
        expires_in = int(first_non_blank(data.get("expires_in"), "0") or "0")
        if status < 200 or status >= 300 or not token:
            raise RuntimeError(first_non_blank(data.get("message"), "failed to fetch access token"))
        self.token = token
        self.token_expires_at = time.time() + max(1, expires_in)
        self.log(f"access_token ok expires_in={expires_in}")
        return self.token

    def get_gateway_url(self) -> str:
        token = self.get_access_token()
        status, data = self.fetch_json(
            f"{self.api_base_url}/gateway",
            headers={
                "Accept": "application/json",
                "Authorization": f"QQBot {token}",
                "X-Union-Appid": self.app_id,
            },
        )
        url = first_non_blank(data.get("url"))
        if status < 200 or status >= 300 or not url:
            raise RuntimeError(first_non_blank(data.get("message"), "failed to fetch gateway url"))
        self.gateway_url = url
        self.log(f"gateway url={url}")
        return url

    def send_payload(self, payload) -> None:
        if self.ws is None:
            raise RuntimeError("websocket not connected")
        self.ws.send_text(json.dumps(payload, ensure_ascii=False))

    def send_heartbeat(self) -> None:
        with self.lock:
            self.last_heartbeat_sent_at = now_ms()
        self.log(f"send heartbeat seq={self.seq}")
        self.send_payload({"op": WS_HEARTBEAT, "d": self.seq})

    def send_identify(self) -> None:
        self.log(f"send identify intents={self.intents}")
        self.send_payload({
            "op": WS_IDENTITY,
            "d": {
                "token": f"QQBot {self.get_access_token()}",
                "intents": self.intents,
                "shard": [0, 1],
            }
        })

    def send_resume(self) -> None:
        self.log(f"send resume session_id={self.session_id} seq={self.seq}")
        self.send_payload({
            "op": WS_RESUME,
            "d": {
                "token": f"QQBot {self.get_access_token()}",
                "session_id": self.session_id,
                "seq": self.seq,
            }
        })

    def infer_scene(self, event_type: str) -> str:
        if event_type.startswith("C2C_") or event_type.startswith("FRIEND_"):
            return "c2c"
        if event_type.startswith("GROUP_"):
            return "group"
        return "unknown"

    def should_queue_event(self, event_type: str) -> bool:
        return event_type.startswith("C2C_") or event_type.startswith("GROUP_") or event_type.startswith("FRIEND_")

    def build_event_key(self, event) -> str:
        direct = first_non_blank(event.get("eventId"), event.get("messageId"))
        if direct:
            return direct
        return "|".join([
            first_non_blank(event.get("scene")),
            first_non_blank(event.get("timestamp")),
            first_non_blank(event.get("userOpenId")),
            first_non_blank(event.get("groupOpenId")),
            first_non_blank(event.get("content")),
        ])

    def build_event(self, payload):
        data = payload.get("d") if is_object(payload.get("d")) else {}
        author = data.get("author") if is_object(data.get("author")) else {}
        event_type = first_non_blank(payload.get("t"))
        message_id = first_non_blank(data.get("id"), payload.get("id"))
        user_openid = first_non_blank(
            author.get("member_openid"),
            author.get("user_openid"),
            author.get("id"),
            data.get("user_openid"),
            data.get("openid"),
        )
        group_openid = first_non_blank(data.get("group_openid"), data.get("group_id"))
        event = {
            "scene": self.infer_scene(event_type),
            "eventType": event_type,
            "eventId": first_non_blank(payload.get("id")),
            "seq": int(payload.get("s") or 0),
            "messageId": message_id,
            "content": as_text(data.get("content")),
            "timestamp": as_text(data.get("timestamp")),
            "receivedAt": iso_now(),
            "userOpenId": user_openid,
            "groupOpenId": group_openid,
            "authorId": as_text(author.get("id")),
            "rawPayload": payload,
            "rawBody": json.dumps(payload, ensure_ascii=False),
            "replyHint": {
                "scene": self.infer_scene(event_type),
                "msg_id": message_id,
                "event_id": first_non_blank(payload.get("id")),
                "openid": user_openid,
                "group_openid": group_openid,
            },
        }
        event["eventKey"] = self.build_event_key(event)
        return event

    def append_event(self, event):
        with self.lock:
            self.queue.append(event)
            if len(self.queue) > MAX_QUEUE_ITEMS:
                self.queue = self.queue[-MAX_QUEUE_ITEMS:]

    def update_contact_cache(self, event):
        with self.lock:
            users = self.contacts.get("users")
            groups = self.contacts.get("groups")
            if not is_object(users):
                users = {}
                self.contacts["users"] = users
            if not is_object(groups):
                groups = {}
                self.contacts["groups"] = groups

            user_openid = first_non_blank(event.get("userOpenId"))
            group_openid = first_non_blank(event.get("groupOpenId"))
            preview = first_non_blank(event.get("content"))[:120]
            common = {
                "lastSeenAt": first_non_blank(event.get("receivedAt")),
                "lastEventType": first_non_blank(event.get("eventType")),
                "lastMessageId": first_non_blank(event.get("messageId")),
                "preview": preview,
            }

            if user_openid:
                users[user_openid] = common
            if group_openid:
                groups[group_openid] = common

    def filter_events(self, scene: str, event_type: str):
        with self.lock:
            items = list(self.queue)
        result = []
        for event in items:
            if scene and first_non_blank(event.get("scene")).lower() != scene:
                continue
            if event_type and first_non_blank(event.get("eventType")) != event_type:
                continue
            result.append(event)
        return result

    def sanitize_event(self, event, include_raw: bool):
        if include_raw:
            return event
        clone = dict(event)
        clone.pop("rawBody", None)
        clone.pop("rawPayload", None)
        return clone

    def query_events(self, limit: int, consume: bool, scene: str, event_type: str, include_raw: bool):
        limit = max(1, min(MAX_QUERY_LIMIT, int(limit or 20)))
        scene = first_non_blank(scene).lower()
        event_type = first_non_blank(event_type)

        selected = []
        remaining = []
        with self.lock:
            for item in self.queue:
                matches = True
                if scene and first_non_blank(item.get("scene")).lower() != scene:
                    matches = False
                if event_type and first_non_blank(item.get("eventType")) != event_type:
                    matches = False

                if matches and len(selected) < limit:
                    selected.append(self.sanitize_event(item, include_raw))
                    if not consume:
                        remaining.append(item)
                    continue
                remaining.append(item)

            if consume:
                self.queue = remaining
            remaining_count = len(self.queue) if consume else len(self.queue)

        return {
            "success": True,
            "consume": consume,
            "filter": {
                "scene": scene,
                "eventType": event_type,
            },
            "returnedCount": len(selected),
            "remainingCount": remaining_count,
            "events": selected,
        }

    def remove_events(self, event_keys):
        keys = set()
        for value in event_keys or []:
            text = first_non_blank(value)
            if text:
                keys.add(text)
        if not keys:
            return {
                "success": True,
                "removedCount": 0,
                "remainingCount": len(self.queue),
            }
        removed_count = 0
        with self.lock:
            next_queue = []
            for item in self.queue:
                if first_non_blank(item.get("eventKey")) in keys:
                    removed_count += 1
                    continue
                next_queue.append(item)
            self.queue = next_queue
            remaining_count = len(self.queue)
        return {
            "success": True,
            "removedCount": removed_count,
            "remainingCount": remaining_count,
        }

    def clear_events(self):
        with self.lock:
            cleared = len(self.queue)
            self.queue = []
        return {
            "success": True,
            "clearedCount": cleared,
            "remainingCount": 0,
        }

    def handle_dispatch(self, payload):
        if payload.get("s") is not None:
            try:
                self.seq = int(payload.get("s") or 0)
            except Exception:
                self.seq = self.seq

        event_type = first_non_blank(payload.get("t"))
        if event_type == "READY":
            data = payload.get("d") if is_object(payload.get("d")) else {}
            user = data.get("user") if is_object(data.get("user")) else {}
            with self.lock:
                self.session_id = first_non_blank(data.get("session_id"))
                self.bot_user_id = first_non_blank(user.get("id"))
                self.bot_username = first_non_blank(user.get("username"))
                self.connected = True
                self.status = "connected"
                self.last_error = ""
            self.log(f"dispatch READY session_id={self.session_id} bot={self.bot_username}")
            return

        if event_type == "RESUMED":
            with self.lock:
                self.connected = True
                self.status = "connected"
                self.last_error = ""
            self.log("dispatch RESUMED")
            return

        if self.should_queue_event(event_type):
            event = self.build_event(payload)
            with self.lock:
                self.last_event_at = now_ms()
                self.event_count += 1
            self.append_event(event)
            self.update_contact_cache(event)

    def connection_loop(self):
        heartbeat_interval = 30.0
        next_heartbeat_at = 0.0
        hello_received = False

        while not self.stop_requested:
            now_seconds = time.time()
            if hello_received and now_seconds >= next_heartbeat_at:
                self.send_heartbeat()
                next_heartbeat_at = now_seconds + heartbeat_interval

            frame = self.ws.recv_frame() if self.ws is not None else None
            if frame is None:
                continue
            if frame.get("opcode") not in (0x1, 0x2, 0xA):
                continue
            if frame.get("opcode") == 0xA:
                with self.lock:
                    self.last_heartbeat_ack_at = now_ms()
                continue

            payload_text = frame.get("payload", b"").decode("utf-8", errors="replace")
            payload = json.loads(payload_text) if payload_text.strip() else {}
            if not is_object(payload):
                continue

            with self.lock:
                self.last_packet_at = now_ms()
                self.packet_count += 1

            op_raw = payload.get("op")
            op = -1 if op_raw is None else int(op_raw)
            if op == WS_HELLO:
                hello = payload.get("d") if is_object(payload.get("d")) else {}
                heartbeat_interval = max(1.0, float(hello.get("heartbeat_interval") or 30000) / 1000.0)
                hello_received = True
                next_heartbeat_at = time.time() + heartbeat_interval
                self.log(f"recv HELLO heartbeat_interval={heartbeat_interval}")
                if self.session_id:
                    self.send_resume()
                else:
                    self.send_identify()
                with self.lock:
                    self.status = "connecting"
                continue

            if op == WS_HEARTBEAT_ACK:
                with self.lock:
                    self.last_heartbeat_ack_at = now_ms()
                self.log("recv HEARTBEAT_ACK")
                continue

            if op == WS_RECONNECT:
                self.log("recv RECONNECT")
                raise RuntimeError("gateway requested reconnect")

            if op == WS_INVALID_SESSION:
                with self.lock:
                    self.session_id = ""
                    self.seq = 0
                    self.connected = False
                    self.status = "reconnecting"
                self.log(f"recv INVALID_SESSION payload={payload_text[:500]}")
                raise RuntimeError("gateway rejected session")

            if op == WS_HEARTBEAT:
                self.send_heartbeat()
                next_heartbeat_at = time.time() + heartbeat_interval
                continue

            if op == WS_DISPATCH:
                self.log(f"recv DISPATCH type={first_non_blank(payload.get('t'))}")
                self.handle_dispatch(payload)

    def write_json(self, handler, status_code: int, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        handler.send_response(status_code)
        handler.send_header("Content-Type", "application/json; charset=utf-8")
        handler.send_header("Content-Length", str(len(body)))
        handler.end_headers()
        handler.wfile.write(body)

    def read_request_json(self, handler):
        length = int(first_non_blank(handler.headers.get("Content-Length"), "0") or "0")
        if length <= 0:
            return {}
        raw = handler.rfile.read(length).decode("utf-8", errors="replace").strip()
        if not raw:
            return {}
        parsed = json.loads(raw)
        return parsed if is_object(parsed) else {}

    def handle_http_get(self, handler):
        path = urllib.parse.urlsplit(handler.path).path
        if path == "/status":
            return self.write_json(handler, 200, self.status_payload())
        return self.write_json(handler, 404, {"success": False, "error": "not_found"})

    def handle_http_post(self, handler):
        path = urllib.parse.urlsplit(handler.path).path
        body = self.read_request_json(handler)

        if path == "/events/query":
            return self.write_json(
                handler,
                200,
                self.query_events(
                    body.get("limit") or 20,
                    bool(body.get("consume", True)),
                    body.get("scene"),
                    body.get("eventType"),
                    bool(body.get("includeRaw", False)),
                ),
            )

        if path == "/events/remove":
            return self.write_json(handler, 200, self.remove_events(body.get("eventKeys") or []))

        if path == "/events/clear":
            return self.write_json(handler, 200, self.clear_events())

        if path == "/control":
            action = first_non_blank(body.get("action"))
            if action == "stop":
                self.request_stop("control_stop")
                return self.write_json(handler, 200, {"success": True, "accepted": True})
            return self.write_json(handler, 400, {"success": False, "error": "unsupported_action"})

        return self.write_json(handler, 404, {"success": False, "error": "not_found"})

    def make_http_handler(self):
        service = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                try:
                    service.handle_http_get(self)
                except Exception as error:
                    service.log(f"http GET error: {error.__class__.__name__}: {error}")
                    service.write_json(self, 500, {"success": False, "error": f"{error.__class__.__name__}: {error}"})

            def do_POST(self):
                try:
                    service.handle_http_post(self)
                except Exception as error:
                    service.log(f"http POST error: {error.__class__.__name__}: {error}")
                    service.write_json(self, 500, {"success": False, "error": f"{error.__class__.__name__}: {error}"})

            def log_message(self, _format, *_args):
                return

        return Handler

    def start_control_server(self):
        handler = self.make_http_handler()
        self.http_server = ThreadingHTTPServer(("127.0.0.1", self.control_port), handler)
        self.http_thread = threading.Thread(
            target=self.http_server.serve_forever,
            name="qqbot_control_http",
            daemon=True,
        )
        self.http_thread.start()
        self.log(f"control http listening on 127.0.0.1:{self.control_port}")

    def stop_control_server(self):
        if self.http_server is not None:
            try:
                self.http_server.shutdown()
            except Exception:
                pass
            try:
                self.http_server.server_close()
            except Exception:
                pass
        self.http_server = None
        self.http_thread = None

    def run(self):
        self.started_at = now_ms()
        self.running = True
        self.connected = False
        self.status = "starting"
        self.start_control_server()

        while not self.stop_requested:
            try:
                with self.lock:
                    self.status = "connecting"
                    self.connected = False
                    self.last_close_code = 0
                    self.last_close_reason = ""
                gateway_url = self.get_gateway_url()
                self.ws = SimpleWebSocketClient(gateway_url, timeout=1.0)
                self.ws.connect()
                self.connection_loop()
            except WebSocketClosed as closed:
                with self.lock:
                    self.last_close_code = closed.code
                    self.last_close_reason = closed.reason
                    if not self.stop_requested:
                        self.last_error = f"WebSocketClosed: {closed.code} {closed.reason}"
            except Exception as error:
                with self.lock:
                    if not self.stop_requested:
                        self.last_error = f"{error.__class__.__name__}: {error}"
                self.log(f"run error: {error.__class__.__name__}: {error}")
            finally:
                try:
                    if self.ws is not None:
                        self.ws.close()
                except Exception:
                    pass
                self.ws = None

            if self.stop_requested:
                break

            with self.lock:
                self.connected = False
                self.status = "reconnecting"
                self.reconnect_count += 1
            time.sleep(min(5, 1 + self.reconnect_count))

        with self.lock:
            self.running = False
            self.connected = False
            self.stopped_at = now_ms()
            self.status = "stopped" if self.stop_reason else "error"
        self.stop_control_server()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--state-dir", required=True)
    parser.add_argument("--app-id", required=True)
    parser.add_argument("--app-secret", required=True)
    parser.add_argument("--use-sandbox", default="false")
    parser.add_argument("--source", default="manual")
    parser.add_argument("--package-version", required=True)
    parser.add_argument("--intents", required=True)
    parser.add_argument("--control-token", required=True)
    parser.add_argument("--control-port", required=True)
    args = parser.parse_args()

    service = QQBotGatewayService(args)

    def _handle_signal(signum, _frame):
        service.request_stop(f"signal_{signum}")

    signal.signal(signal.SIGTERM, _handle_signal)
    signal.signal(signal.SIGINT, _handle_signal)

    try:
        service.run()
    except KeyboardInterrupt:
        service.request_stop("keyboard_interrupt")
    finally:
        service.running = False
        service.connected = False
        service.stopped_at = now_ms()
        service.status = "stopped" if service.stop_reason else "error"
        service.stop_control_server()


if __name__ == "__main__":
    main()
