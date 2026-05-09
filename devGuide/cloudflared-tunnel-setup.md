# cloudflared（Cloudflare Tunnel）本地开发指南

用于把本机 HTTP 服务（如 `xituan_backend` 的 `PORT`）暴露为公网 **HTTPS**，满足 PSP Webhook（Stripe、OmiPay 等）对 **`https://`** 的要求。本文分两种模式：**临时 Quick Tunnel** 与 **Named Tunnel + Cloudflare 托管 DNS（固定域名）**。

---

## Windows 安装 cloudflared

### 稳定下载入口（勿使用带 `jwt` / `sig` 的临时直链）

GitHub 的 `release-assets.githubusercontent.com/...?jwt=...` 一类链接**会过期**，不适合写进文档或收藏。请始终从下列**固定页面**下载：

| 来源 | 链接 |
|------|------|
| Cloudflare 官方下载说明 | https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/ |
| GitHub Releases（选最新版） | https://github.com/cloudflare/cloudflared/releases |
| Windows 安装包文件名 | `cloudflared-windows-amd64.msi`（在 Releases 的 Assets 中下载） |

安装完成后在 **管理员 PowerShell** 中确认：

```powershell
cloudflared --version
```

若未加入 PATH，可使用完整路径，例如：

```powershell
& "C:\Program Files\cloudflared\cloudflared.exe" --version
```

---

## 模式 A：临时管道（Quick Tunnel，`trycloudflare.com`）

**特点**：无需 Cloudflare 账号即可试验；**URL 通常在每次新建隧道时变化**，不适合作为长期固定的 Webhook 地址。

### 前置

- 本机后端已启动，例如 `http://127.0.0.1:3050`（与 `xituan_backend` 的 `PORT` 一致）。

### 命令

```powershell
cloudflared tunnel --url http://127.0.0.1:3050
```

日志中会出现一行 **Visit it at** 的地址，例如：

`https://<random>.trycloudflare.com`

### Webhook URL 示例（当前后端）

将 **Stripe / OmiPay** Dashboard 中的 URL 设为（路径以本仓库 `app.ts` 注册为准）：

- Stripe：`https://<random>.trycloudflare.com/api/webhooks/stripe`
- OmiPay：`https://<random>.trycloudflare.com/api/webhooks/omipay/<webhookKey>`

（历史）Airwallex 路径 `/api/webhooks/airwallex*` 已删除，勿再配置。

### 注意

- **保持该终端窗口运行**，关闭即断开隧道。
- 日志里若提示找不到 `config.yml`，Quick 模式**正常**，可忽略。
- 与下文 **Named Tunnel 的 Windows 服务**可同时安装；开发时若端口或进程冲突，只跑一种即可。

---

## 模式 B：Named Tunnel + Cloudflare 接管 DNS（固定 `https://子域名.你的域`）

**特点**：公网 URL **固定**；适合长期开发或稳定沙盒 Webhook。代价是：**域名 DNS 需由 Cloudflare 托管**（在域名注册商处把 **Nameserver** 指到 Cloudflare），这样 Zero Trust 里 **Published application** 才能选择 **Domain（Zone）**。

### 1. 将域名接入 Cloudflare（只能是根域，不能填子域）

Cloudflare 标准 **Add a site** 只接受 **apex 根域**，例如 `example.com`、`xituan.com.au`。若输入 `tunnel.example.com` 会报错（提示必须使用根域而非子域）。

1. Cloudflare Dashboard（**主站 Domains**，不是 Zero Trust 入门页）→ **Add a site** → 填 **`xituan.com.au`** 这类根域。
2. 从 Route 53 **导出/对照**现有记录，在 CF 向导里 **Import** 或 **手动录入**，避免迁 NS 后邮件、主站等解析中断。
3. 在**域名注册商**处把该域的 **Nameserver** 改为 Cloudflare 给出的两条（若注册商是 Route 53，在 **Registered domains** → 该域 → 编辑 NS）。完成后 **权威 DNS 由 Cloudflare 担任**，Route 53 里原 Hosted Zone 对该域不再对外生效（除非你保留双栈架构，一般应统一到 CF 维护）。
4. 等待 NS 生效（常见数分钟至 48 小时），再在 Zero Trust → Published application 里 **Domain** 下拉里选该根域，`Subdomain` 填 `backend-dev` 即得到 `backend-dev.xituan.com.au`。

### 2. 创建 Named Tunnel（Zero Trust UI）

1. **Zero Trust** → **Networks** → **Tunnels** → **Create a tunnel**。
2. 选择 **Cloudflared**，命名如 `backend-dev`。
3. 按页面选择 **Windows**，复制 **`cloudflared service install <TOKEN>`**。

### 3. 安装并运行 Windows 服务（需管理员）

```powershell
# Run PowerShell as Administrator
cloudflared.exe service install <PASTE_TOKEN_FROM_DASHBOARD>
```

检查服务：

```powershell
Get-Service Cloudflared
Start-Service Cloudflared   # if not Running
```

### 4. 添加 Published application（公网主机名 → 本机 origin）

1. 打开该 Tunnel 详情 → **Routes** → **Add route** → **Published application**。
2. **Subdomain**：如 `backend-dev`。
3. **Domain**：下拉选择已接入 CF 的 zone（若为空，说明 NS 未切到 CF 或站点未添加成功）。
4. **Service URL**：`http://127.0.0.1:3050`（与后端端口一致；不要用 `https://localhost` 除非本机 origin 真是 HTTPS）。

### 5. Webhook 示例（固定域名）

- Stripe：`https://backend-dev.example.com/api/webhooks/stripe`
- OmiPay：`https://backend-dev.example.com/api/webhooks/omipay/<webhookKey>`

---

## 只想用 Route 53、不把根域迁到 Cloudflare？

- **Published application** 里的 **Domain** 下拉只列出 **已在 Cloudflare 添加的根域 zone**；根域 NS 仍在 Route 53 时，该列表会**为空**，无法用同一 UI 配出固定 `https://子域.你的根域`。
- **不能**在标准 **Add a site** 里只添加 `tunnel.example.com` 这类子域作为独立 zone（产品限制：必须根域）。
- **可选方向（择一）**：
  - **整域迁到 Cloudflare**：`Add a site` 填根域 → 同步 DNS → 注册商改 NS → 再走模式 B（固定 URL，Tunnel + CF DNS）。
  - **继续模式 A**：Quick Tunnel，`trycloudflare.com`（URL 常变）。
  - **不用 Tunnel，DNS 仍在 Route 53**：公网 IP + **Caddy / Nginx + Let’s Encrypt**（参见 `airwallex-webhook-dev-setup.md` 中 Caddy 方案；该文档已归档但 TLS 步骤仍适用）。
  - 高级场景（如 **Bring your own DNS**、仅手工 CNAME 到 `*.cfargotunnel.com`）需对照 [Cloudflare Tunnel 文档](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) 当前说明，且不一定再走 Published application 同一套 UI。

---

## 安全提示

- **Tunnel token** 等同于入站凭证，勿提交到仓库、勿发到公开聊天；泄露后在 Cloudflare 控制台轮换/重建隧道。
- Webhook 签名密钥由各 PSP（如 Stripe、OmiPay）在商户设置或环境变量中配置，与隧道无关。

---

## 相关文档

- Airwallex Webhook 与本机 HTTPS 总览：`airwallex-webhook-dev-setup.md`
- Cloudflare Tunnel 官方文档：https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/

**最后更新**: 2026-04-09（补充 Add a site 仅支持根域；修正“仅子域 zone”表述）
