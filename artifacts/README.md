# ChatMock 单文件网关

`chatmock_gateway.py` 是基于 ChatMock 1.40 源码构建的单文件 Python 网关。它不使用 Docker，也不会在运行时下载或执行外部源码；运行依赖由本目录的 `requirements.txt` 在 Python venv 中安装。

它提供：

- ChatMock 的 `/v1/*` 兼容代理，以及无 Docker 的多账号普通池。
- 每个 ChatGPT 账号一个 `auth-pool/slot-N` 槽位；代理请求会在已启用、未冻结的槽位之间轮询。
- 面板可添加账号、重新登录、启用/禁用、冻结账号和异步获取每个账号的双窗口额度。
- 受管理员令牌保护的管理面板，默认端口为 `18011`。
- 为成员签发可自定义名称的 `cmg_...` API key。原始 key 只在签发响应中显示一次，SQLite 中仅保存由独立随机密钥计算的 HMAC-SHA-256 哈希。
- 每个 key 的请求次数、输入/输出 token、预计成本、未计价请求、最后使用时间，以及立即禁用/重新启用。
- OpenAI Standard API 价格快照，用于 token 成本估算。

## 文件

| 文件 | 用途 |
| --- | --- |
| `chatmock_gateway.py` | 可部署的单文件程序，内嵌 ChatMock 源码。 |
| `requirements.txt` | Python 运行时依赖。 |
| `README.md` | 部署和运维说明。 |

不要直接修改 `chatmock_gateway.py`。若要更新内嵌的 ChatMock 源码或网关逻辑，请在源码仓库中修改 `scripts/build_chatmock_gateway.py`，再重新生成本文件。

## Ubuntu 部署

以下示例假定部署目录为 `/opt/chatmock-gateway`，使用 Python 3.11 或更高版本。将本目录的三个文件上传到该目录。

```bash
sudo install -d -o "$USER" -g "$USER" -m 750 /opt/chatmock-gateway
cd /opt/chatmock-gateway
python3 -m venv .venv
. .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

创建仅本机管理员可读的环境文件。`GATEWAY_ADMIN_TOKEN` 用于登录面板及调用管理 API；它不是给成员使用的 API key。两个随机值可用 `python3 -c 'import secrets; print(secrets.token_urlsafe(32))'` 生成。

```bash
sudo install -m 600 /dev/null /etc/chatmock-gateway.env
sudoedit /etc/chatmock-gateway.env
```

填入以下内容，其中值必须替换为新生成的随机值：

```dotenv
GATEWAY_ADMIN_TOKEN=replace-with-a-long-random-admin-token
GATEWAY_SESSION_SECRET=replace-with-a-different-long-random-session-secret
GATEWAY_STATE_DIR=/var/lib/chatmock-gateway
GATEWAY_HOST=127.0.0.1
GATEWAY_PORT=18011
GATEWAY_SESSION_COOKIE_SECURE=1
```

创建状态目录。账号授权、额度快照、数据库和 key 哈希密钥都在运行目录外，不会进入 Python 文件。启动网关后，通过面板的“普通账号池”逐个添加多个 ChatGPT 账号。

```bash
sudo install -d -o "$USER" -g "$USER" -m 700 /var/lib/chatmock-gateway
set -a
. /etc/chatmock-gateway.env
set +a
/opt/chatmock-gateway/.venv/bin/python /opt/chatmock-gateway/chatmock_gateway.py serve
```

不需要执行旧的 `chatmock_gateway.py login` 命令；它只为已有单账号 ChatMock 配置保留。程序发现旧的 `auth.json` 时，首次启动会将其迁移为 `auth-pool/slot-1`。

健康检查地址为 `http://127.0.0.1:18011/healthz`。程序在 `serve` 模式下若缺少 `GATEWAY_ADMIN_TOKEN` 会拒绝启动。

## systemd

创建 `/etc/systemd/system/chatmock-gateway.service`：

```ini
[Unit]
Description=ChatMock single-file gateway
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/chatmock-gateway
EnvironmentFile=/etc/chatmock-gateway.env
ExecStart=/opt/chatmock-gateway/.venv/bin/python /opt/chatmock-gateway/chatmock_gateway.py serve --host 127.0.0.1 --port 18011
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

将 `User=ubuntu` 换成实际运行账户，并确保该账户对 `/var/lib/chatmock-gateway` 有读写权限。启动服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now chatmock-gateway
sudo systemctl status chatmock-gateway
```

日志通过 `journalctl -u chatmock-gateway -f` 查看。升级程序时替换 `chatmock_gateway.py`，执行 `pip install -r requirements.txt`，然后 `sudo systemctl restart chatmock-gateway`。

## HTTPS 反向代理

不要直接把 Flask 开发服务器暴露到公网。保持网关监听 `127.0.0.1`，由 Nginx 或 Caddy 终止 HTTPS，并只放行需要的入口。使用 HTTPS 时保持 `GATEWAY_SESSION_COOKIE_SECURE=1`。

Nginx location 的最小示例：

```nginx
location / {
    proxy_pass http://127.0.0.1:18011;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_buffering off;
    proxy_read_timeout 600s;
}
```

管理员面板和 `/admin/*` 应额外限制为管理员 IP、VPN 或访问控制层；成员只需要访问 `/v1/*`。不要在客户端或仓库中放入 `GATEWAY_ADMIN_TOKEN`。

## 使用面板和管理 API

访问根路径后输入管理员令牌。普通账号池中可添加账号、重新登录、启用/禁用、冻结 5 分钟，并后台获取主/次额度。添加账号会打开 ChatGPT 授权页；登录结束后把浏览器跳转得到的回调地址粘贴回面板完成写入。每个账号独立保存在 `auth-pool/slot-N`。

代理请求支持会话粘性：同一已签发 key 下，优先使用请求头或请求体中的会话/对话标识；没有该标识时使用模型和首条用户消息派生稳定键。映射在 `pool-affinity.json` 中最多保留 30 天，只存 HMAC 摘要和槽位名，不保存原始 key、会话 ID 或提示词。账号被禁用、冻结或不可用时会自动选择其他槽位并在成功响应后更新映射。

面板的“池子低额度保护”默认关闭。启用后，当所有可用账号都已有主额度快照，且主额度平均剩余低于配置阈值时，所有 JSON 代理请求会改用指定模型和思考强度。默认值为 `15%`、`gpt-5.6-luna`、`max`，实际目标模型为 `gpt-5.6-luna-max`。额度快照缺失时不会触发保护。

面板中填写 key 名称即可签发，例如 `Alice laptop`。请在签发页面立即保存原始 `cmg_...` 值；数据库和以后页面只能看到其前缀。

成员将得到的值作为 OpenAI 兼容 API key 使用：

```bash
curl http://gateway.example.com/v1/models \
  -H 'Authorization: Bearer cmg_replace_with_issued_key'
```

管理 API 支持管理员 Bearer token，也支持已登录的浏览器会话。浏览器表单带 CSRF 校验；使用管理员 Bearer token 调用 API 时不需要额外的 CSRF header。

```bash
curl https://gateway.example.com/admin/keys \
  -H 'Authorization: Bearer replace-with-admin-token' \
  -H 'Content-Type: application/json' \
  -d '{"name":"Alice laptop"}'

curl https://gateway.example.com/admin/keys \
  -H 'Authorization: Bearer replace-with-admin-token'

curl https://gateway.example.com/admin/keys/1/enabled \
  -X POST \
  -H 'Authorization: Bearer replace-with-admin-token' \
  -H 'Content-Type: application/json' \
  -d '{"enabled":false}'

curl https://gateway.example.com/admin/pricing \
  -H 'Authorization: Bearer replace-with-admin-token'
```

可用接口为：

| 接口 | 方法 | 说明 |
| --- | --- | --- |
| `/admin/status` | `GET` | 网关和近 24 小时汇总。 |
| `/admin/keys` | `GET` | 所有 key 的累计统计，不含原始 key。 |
| `/admin/keys` | `POST` | 使用 `{ "name": "..." }` 签发 key，原始 key 仅在此响应返回。 |
| `/admin/keys/<id>/enabled` | `POST` | 使用 `{ "enabled": true | false }` 启用或禁用 key。 |
| `/admin/pricing` | `GET` | 当前程序内置的价格快照。 |
| `/admin/pool` | `GET` | 普通账号池、每个槽位的额度与采集任务状态。 |
| `/admin/pool/protection` | `GET` | 低额度保护状态和当前池子主额度。 |
| `/admin/pool/protection` | `POST` | 使用 `{ "enabled": true, "threshold_percent": 15, "model": "gpt-5.6-luna", "reasoning_effort": "max" }` 配置低额度保护。 |
| `/admin/pool/login` | `POST` | 新增账号，或传入 `{ "slot": "slot-1" }` 重新登录。 |
| `/admin/pool/login/complete` | `POST` | 使用登录会话 ID 与浏览器回调地址完成账号授权。 |
| `/admin/pool/slots/<slot>/enabled` | `POST` | 使用 `{ "enabled": true | false }` 启用或禁用账号。 |
| `/admin/pool/slots/<slot>/freeze` | `POST` | 使用 `{ "seconds": 0..86400 }` 冻结或解冻账号。 |
| `/admin/pool/limits/refresh` | `POST` | 后台获取所有已启用账号的额度响应头，不生成模型内容。 |
| `/healthz` | `GET` | 无鉴权健康检查。 |

旧的 `GATEWAY_API_TOKEN` 不再用于调用 `/v1/*`，也不应再配置。每次代理请求都必须携带一个已签发且未禁用的 `cmg_...` key。

## 统计和价格

请求记录只保存路径、方法、状态、耗时、key ID、模型、token 数和成本，不保存请求正文、响应正文或原始 key。数据库保留最近 30 天的请求明细；每个 key 的列表统计会随此窗口滚动。ChatGPT 账号的额度是独立的 `usage_limits.json` 快照，来自上游响应头，并不等同于 key 的 API 标准价估算。

成本按以下公式估算：

```text
((input_tokens - cached_input_tokens) * input_price
 + cached_input_tokens * cached_input_price
 + output_tokens * output_price) / 1,000,000
```

本构建的价格来源是 [OpenAI 官方定价页](https://developers.openai.com/api/docs/pricing)，使用 Standard API 的 USD / 1M tokens 价格快照，核验日期为 `2026-08-17`：

| 模型 | 输入 | 缓存输入 | 输出 |
| --- | ---: | ---: | ---: |
| gpt-5.6-sol | $5.00 | $0.50 | $30.00 |
| gpt-5.6-terra | $2.00 | $0.20 | $12.00 |
| gpt-5.6-luna | $0.20 | $0.02 | $1.20 |
| gpt-5.5 | $5.00 | $0.50 | $30.00 |
| gpt-5.5-pro | $30.00 | - | $180.00 |
| gpt-5.4 | $2.50 | $0.25 | $15.00 |
| gpt-5.4-mini | $0.75 | $0.075 | $4.50 |
| gpt-5.4-nano | $0.20 | $0.02 | $1.25 |
| gpt-5.4-pro | $30.00 | - | $180.00 |
| gpt-5.2 | $1.75 | $0.175 | $14.00 |
| gpt-5.2-pro | $21.00 | - | $168.00 |
| gpt-5.1 | $1.25 | $0.125 | $10.00 |
| gpt-5 | $1.25 | $0.125 | $10.00 |
| gpt-5-mini | $0.25 | $0.025 | $2.00 |
| gpt-5-nano | $0.05 | $0.005 | $0.40 |
| gpt-5-pro | $15.00 | - | $120.00 |
| gpt-5.3-codex | $1.75 | $0.175 | $14.00 |

未列在表中的模型，以及没有可读 token usage 的响应，会计入请求次数但显示为“未计价”，不会使用猜测价格。对于流式兼容接口，客户端请求 `stream_options.include_usage=true` 时，或使用原生 Responses SSE 且该流包含 usage 时，网关会在流结束后记录 token 和成本。

这些数值是按 OpenAI API 标准价计算的参考成本，**不是** ChatGPT 订阅或 ChatMock 上游账户的实际账单。官方价格变化后，应重新核验官方页面、更新构建器内的价格表并重新生成 `chatmock_gateway.py`。

## 备份与轮换

定期备份 `GATEWAY_STATE_DIR` 中的 `usage.sqlite3`、`key-secret.bin`、`auth-pool/` 和 `pool-login-sessions.json`，并以受限权限保存。`usage.sqlite3` 与 `key-secret.bin` 必须一起恢复：缺少或替换 `key-secret.bin` 后，现有已签发 key 将无法匹配数据库中的哈希。

管理员令牌泄露时，立即更换 `/etc/chatmock-gateway.env` 中的 `GATEWAY_ADMIN_TOKEN` 和 `GATEWAY_SESSION_SECRET`，再重启服务。成员 key 泄露时，直接在面板禁用对应 key，然后为该成员重新签发新 key。
