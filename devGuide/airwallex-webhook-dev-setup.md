# Airwallex Webhook 开发环境配置指南（已归档）

> **P4 / 2026 状态**：后端已 **下线 Airwallex PSP**（无 `createPaymentIntent`、无 `/api/webhooks/airwallex*`）。下列内容为 **历史联调记录**，保留作隧道、HTTPS、公网可达性等**通用开发**参考。  
> **当前 Webhook**：Stripe → `POST /api/webhooks/stripe`；OmiPay → `POST /api/webhooks/omipay/:webhookKey`。  
> **运维**：见同目录 `airwallex-p4-ops-checklist.md`。隧道示例（非 Airwallex 专用）见 `cloudflared-tunnel-setup.md`。

本文档（历史）介绍曾如何配置本地环境以接收 Airwallex 沙盒 Webhook。

## 📋 目录

1. [本地 Backend 运行环境配置](#1-本地-backend-运行环境配置)
2. [本地防火墙 + 路由映射](#2-本地防火墙--路由映射)
3. [域名绑定](#3-域名绑定)
4. [DDNS 任务持续运行](#4-ddns-任务持续运行)
5. [Airwallex 沙盒环境 Webhook 设置（历史）](#5-airwallex-沙盒环境-webhook-设置)

**重要（历史背景）**：第三方沙盒在 Dashboard 中配置 Webhook URL 时通常要求 **`https://`**，且地址须从公网可达。纯 `http://localhost` 或仅内网 HTTP 不适合作为公网 Webhook 端点；本地后端监听 HTTP 时，通过 **HTTPS 隧道**（推荐）或在边界用 **正式证书**（Let's Encrypt 等）终结 TLS。该原则仍适用于 Stripe、OmiPay 等。

---

## 1. 本地 Backend 运行环境配置

### 1.1 环境变量配置

在 `xituan_backend` 项目的本地 `.env` 中配置端口、数据库等常规项（示例见下）。**仓库模板与 GitHub Actions 已不再列出或注入旧版 Airwallex 的全局密钥变量**；若你仍需在本地对照本文调试遗留 Airwallex 沙盒，请仅在私有 `.env` 中按 Airwallex Dashboard 文档自行填写凭据与 Webhook 验签密钥，**勿提交密钥**。

```env
# 后端服务配置
PORT=3050
NODE_ENV=development

# 数据库配置（根据实际情况）
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=your_username
DB_PASSWORD=your_password
DB_DATABASE=your_database
```

### 1.2 关键配置说明

- **Airwallex API 根域名**：沙盒与生产 host 以 Airwallex 官方文档为准（常见为 `api-demo` / `api` 子域），仅在本地 `.env` 配置。
- **Webhook 验签密钥**：在 Airwallex Dashboard 创建 Webhook 时生成，仅用于本地或自建环境验签，勿写入仓库。

### 1.3 启动后端服务

```bash
cd xituan_backend
npm install
npm run dev
```

后端服务将在 `http://localhost:3050` 启动（进程本身仍可使用 HTTP；对外告知 Airwallex 的地址必须是 HTTPS）。

### 1.4 公网 HTTPS 地址（沙盒 Webhook 必填）

在 **当前后端** 中，公网 HTTPS 下应使用的路径示例（**勿再使用**已删除的 `/api/webhooks/airwallex*`）：

- **Stripe（平台 webhook）**：`https://<公网域名或隧道域名>/api/webhooks/stripe`
- **OmiPay（每商户 webhookKey）**：`https://<公网域名或隧道域名>/api/webhooks/omipay/<webhookKey>`

以下为 **历史** Airwallex 路径说明（仅作对照，路由已不存在）：

- ~~`/api/webhooks/airwallex`~~、~~`/api/webhooks/airwallex-single/<webhookKey>`~~

任选其一即可满足「HTTPS + 公网」：

#### 方案 A：HTTPS 隧道（本地开发最省事）

隧道在边缘提供受公网信任的 HTTPS 证书，反向代理到你本机 `http://localhost:PORT`。

**ngrok**（示例，`PORT` 与 `.env` 一致，如 `3050`）：

```bash
ngrok http 3050
```

复制控制台里的 `https://....ngrok-free.app`（或付费固定域名），在 Airwallex 中填写：

`https://<ngrok-host>/api/webhooks/stripe` 或 `https://<ngrok-host>/api/webhooks/omipay/<webhookKey>`（按当前 PSP 选择）。

**Cloudflare Tunnel（cloudflared）**：

```bash
cloudflared tunnel --url http://localhost:3050
```

使用命令输出中的 `https://....trycloudflare.com` 同理拼接路径。

更完整的 Windows 安装、临时隧道与 **Named Tunnel + CF 托管 DNS（固定 URL）** 分步说明见：[cloudflared-tunnel-setup.md](./cloudflared-tunnel-setup.md)。

> 给本机 Express 单独配自签名证书 **一般无法**通过 Airwallex 侧校验（需公网信任的证书链）。隧道或带 Let's Encrypt 的域名才是可行做法。

#### 方案 B：Route53 域名 + 端口转发 + **本机** HTTPS（与你当前架构一致）

你已用 Route 53 把子域名指到家庭公网 IP，并在路由器做端口转发时，**不必**让 Node 自己监听 HTTPS（也可选，见下文）。推荐在同一台跑后端的 Windows 机器上装 **Caddy**：监听 **443**（及 **80**），自动申请/续期 **Let's Encrypt** 证书，再把请求反代到后端 `http://127.0.0.1:3050`。

**要点**：

1. **后端照旧**：`npm run dev` 只监听 `PORT`（如 `3050`）的 HTTP，无需改代码。
2. **路由器端口转发**（在原有规则上**增加或调整**）  
   - **WAN 443 → 本机 443**（HTTPS，给 Airwallex 访问）  
   - **WAN 80 → 本机 80**（HTTP，Let's Encrypt **HTTP-01** 校验证书时必须能从公网访问；仅转 443 不够）  
   - 若你曾把 **3050** 直接暴露到公网，可保留给调试，但 **Airwallex Dashboard 应填 `https://你的子域名/...`**，不要填 `:3050` 的 HTTP URL。
3. **Windows 防火墙**：为 **TCP 80、443** 添加入站允许（与下文 3050 规则类似）。
4. **安装并运行 Caddy（Windows）**  
   - **一种方式 — Scoop**（已装 [Scoop](https://scoop.sh/) 时）：

```powershell
scoop install caddy
```

   - **一种方式 — 手动**：打开 [Caddy 安装说明 — Windows](https://caddyserver.com/docs/install#windows)，下载对应架构的 `.zip`，解压后将 **`caddy.exe` 所在目录** 加入系统 **PATH**，或把 `caddy.exe` 放到固定目录（例如 `D:\tools\caddy\`）并在该目录工作。  
   - **`Caddyfile`**：在与 `caddy.exe` 同目录或任意工作目录新建纯文本文件 **`Caddyfile`**（无后缀名），内容把主机名换成你的 Route 53 记录，例如：

```text
backend-dev.xituan.com.au {
  reverse_proxy 127.0.0.1:3050
}
```

   - **启动**：先启动后端（`npm run dev`，保证 `127.0.0.1:3050` 可访问）。在 **`Caddyfile` 所在目录** 打开 **「以管理员身份运行」的 PowerShell 或 CMD**（绑定 **80/443** 在 Windows 上通常需要管理员权限），执行：

```powershell
cd D:\tools\caddy
caddy validate --config Caddyfile
caddy run --config Caddyfile
```

   若 `caddy.exe` 已在 PATH 且当前目录就是 `Caddyfile` 所在目录，可简写为 `caddy run`。  
   - **首次启动**：Caddy 会自动向 Let's Encrypt 申请证书；失败时检查：域名 A 记录是否指向当前公网 IP、路由器 **80/443** 是否转到本机、本机防火墙是否放行 80/443、本机 **无其它程序占用 80/443**（含 IIS、其它 Web 服务器）。  
   - **可选 — 安装为 Windows 服务**：见 [Caddy 文档 Keep Caddy running](https://caddyserver.com/docs/running#windows-service)；开发阶段前台 `caddy run` 即可。

5. **（历史）Airwallex Webhook URL** 曾形如 `https://backend-dev.xituan.com.au/api/webhooks/airwallex`；**当前**请改为 Stripe `/api/webhooks/stripe` 或 OmiPay `/api/webhooks/omipay/<webhookKey>`（见文首说明）。

**若不能用 80 端口**（运营商封 80 等）：需改用 **DNS-01**（例如 `acme.sh` + Route53 API、或 Caddy 的 DNS 插件）签发证书，步骤比 HTTP-01 多，此处不展开。

**备选：Node 直接 HTTPS**（不推荐优先）：用 Certbot / acme.sh 把证书落到文件后，可用 `https.createServer` 挂同一 Express 应用；仍须公网能访问用于校验的端口，且要自己处理续期与 reload。多数情况下 **Caddy/Nginx 终结 TLS + 反代 HTTP** 更简单。

### 1.5 本地验证 Webhook 路由（可选）

**当前**端点示例：

- Stripe：`/api/webhooks/stripe`（须带合法 `Stripe-Signature` 与 body，参见 Stripe 文档）
- OmiPay：`/api/webhooks/omipay/:webhookKey`

本机仅测连通性时可用 `curl` 打上述路径；**公网 Dashboard** 仍须使用 `https://` 隧道或正式域名。

**（历史）** Airwallex 路径 ~~`/api/webhooks/airwallex`~~ 已删除，勿再配置。

---

## 2. 本地防火墙 + 路由映射

### 2.1 Windows 防火墙配置

#### 2.1.1 添加入站规则

1. 打开 **Windows Defender 防火墙**
2. 点击 **高级设置**
3. 选择 **入站规则** → **新建规则**
4. 选择 **端口** → 下一步
5. 选择 **TCP**，输入端口 `3050`
6. 选择 **允许连接**
7. 应用到所有配置文件（域、专用、公用）
8. 命名为 "Xituan Backend Dev Port 3050"

若使用方案 B（Caddy HTTPS），请再为 **TCP 80、443** 各建一条入站规则（显示名例如 `Xituan Dev HTTP-ACME 80`、`Xituan Dev HTTPS 443`）。

#### 2.1.2 PowerShell 命令（快速配置）

```powershell
# 以管理员身份运行 PowerShell

# 添加防火墙规则
New-NetFirewallRule -DisplayName "Xituan Backend Dev Port 3050" `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort 3050 `
    -Action Allow `
    -Profile Any

# HTTPS 与证书校验（方案 B）
New-NetFirewallRule -DisplayName "Xituan Dev HTTPS 443" `
    -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow -Profile Any
New-NetFirewallRule -DisplayName "Xituan Dev HTTP-ACME 80" `
    -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow -Profile Any
```

### 2.2 路由器端口映射（Port Forwarding）

#### 2.2.1 获取本地 IP 地址

```bash
# Windows
ipconfig

# 查找 IPv4 地址，例如: 192.168.1.138
```

#### 2.2.2 路由器配置

1. 登录路由器管理界面（通常是 `192.168.1.1` 或 `192.168.0.1`）
2. 找到 **端口转发** 或 **虚拟服务器** 设置
3. 添加端口转发规则（按需要多条）：
   - **仅 HTTP 后端调试**：外部 `3050` → 内网 `192.168.1.138:3050`，TCP。  
   - **本机 HTTPS（方案 B，Airwallex 推荐）**：外部 **`443`** → 内网 **`192.168.1.138:443`**；外部 **`80`** → 内网 **`192.168.1.138:80`**（Let's Encrypt HTTP-01 用）。内网目标端口应对应运行 **Caddy**（或 Nginx）的机器，由反代再转到 `127.0.0.1:3050`。

#### 2.2.3 获取公网 IP

```bash
# 使用 curl 获取公网 IP
curl https://api.ipify.org

# 或使用 PowerShell
Invoke-RestMethod -Uri https://api.ipify.org
```

---

## 3. 域名绑定

### 3.1 使用动态 DNS (DDNS)

由于家庭网络通常使用动态 IP，需要配置 DDNS 来将域名动态绑定到变化的公网 IP。

### 3.2 AWS Route 53 配置

#### 3.2.1 创建配置文件

在 `xituan_agent/scripts/` 目录下创建 `ddns-config.sh`：

```bash
# 复制示例文件
cd xituan_agent/scripts
cp ddns-config.sh.example ddns-config.sh
```

#### 3.2.2 编辑配置文件

编辑 `ddns-config.sh`，填入你的实际配置：

```bash
#!/bin/bash
# DDNS Configuration

# AWS Route 53 Configuration
export DOMAIN="xituan.com.au"              # 你的域名
export SUBDOMAIN="backend-dev"             # 子域名，例如 backend-dev.xituan.com.au
export HOSTED_ZONE_ID="Z1234567890ABC"     # Route 53 Hosted Zone ID
export TTL=300                             # TTL 5 分钟
export CHECK_INTERVAL=300                   # 检查间隔 5 分钟

# AWS Credentials (可选，如果已使用 aws configure 则不需要)
# export AWS_ACCESS_KEY_ID="your_access_key_id"
# export AWS_SECRET_ACCESS_KEY="your_secret_access_key"
# export AWS_DEFAULT_REGION="ap-southeast-2"
```

#### 3.2.3 配置 AWS CLI

```bash
# 安装 AWS CLI (如果未安装)
# Windows: https://aws.amazon.com/cli/

# 配置 AWS 凭证
aws configure

# 输入以下信息：
# AWS Access Key ID: your_access_key_id
# AWS Secret Access Key: your_secret_access_key
# Default region name: ap-southeast-2
# Default output format: json
```

#### 3.2.4 获取 Route 53 Hosted Zone ID

1. 登录 AWS Console
2. 进入 **Route 53** → **Hosted zones**
3. 选择你的域名
4. 复制 **Hosted zone ID**

---

## 4. DDNS 任务持续运行

### 4.1 使用 npm script（推荐）

在 `xituan_agent` 项目中，已经配置了 DDNS 启动脚本。

#### 4.1.1 启动 DDNS 任务

```bash
cd xituan_agent
npm run ddns:start
```

这个脚本会：
- 每 5 分钟检查一次公网 IP
- 如果 IP 发生变化，自动更新 Route 53 DNS 记录
- 持续运行，直到手动停止（Ctrl+C）

#### 4.1.2 后台运行（Linux/Mac）

```bash
# 使用 nohup 后台运行
nohup npm run ddns:start > ddns.log 2>&1 &

# 查看日志
tail -f ddns.log
```

#### 4.1.3 Windows 后台运行

**方法 1: 使用 PowerShell 后台任务**

```powershell
# 启动后台任务
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd D:\projects\xituan_module\xituan_agent; npm run ddns:start"
```

**方法 2: 使用 Windows 任务计划程序**

1. 打开 **任务计划程序**
2. 创建基本任务
3. 触发器: 系统启动时
4. 操作: 启动程序
   - 程序: `npm`
   - 参数: `run ddns:start`
   - 起始于: `D:\projects\xituan_module\xituan_agent`
5. 设置: 选中 **即使登录用户未登录也要运行**

### 4.2 验证 DDNS 是否正常工作

```bash
# 检查 DNS 解析
nslookup backend-dev.xituan.com.au

# 或使用 dig (Linux/Mac)
dig backend-dev.xituan.com.au

# 应该返回你的公网 IP
```

### 4.3 测试域名访问

```bash
# 测试 HTTPS 可达（示例：Stripe 路径；无合法签名时后端会按 Stripe 规则拒绝，此处仅验证 TLS/路由）
curl -i -X POST https://backend-dev.xituan.com.au/api/webhooks/stripe \
  -H "Content-Type: application/json" \
  -d '{}'
```

若尚未在边界配置 HTTPS，可改用隧道给出的 `https://...` 主机名测试同一路径。

---

## 5. Airwallex 沙盒环境 Webhook 设置（历史参考）

### 5.1 登录 Airwallex Dashboard

1. 访问: https://dashboard.airwallex.com
2. 使用沙盒环境账户登录
3. 切换到 **Sandbox** 环境（右上角）

### 5.2 创建 Webhook

1. 导航到 **Settings** → **Webhooks**
2. 点击 **Create Webhook** 或 **Add Webhook**
3. 填写以下信息：

   **Webhook URL**（历史示例；后端已不再提供该路径）:
   ```
   https://backend-dev.xituan.com.au/api/webhooks/airwallex   # 已废弃
   ```
   **当前**：在 Stripe / OmiPay 各自 Dashboard 配置 `.../api/webhooks/stripe` 或 `.../api/webhooks/omipay/<webhookKey>`。本地开发用 ngrok / Cloudflare Tunnel 的 `https://...` 主机名 + 上述路径。
   
   **Events to Subscribe**:
   - ✅ `payment_intent.succeeded`
   - ✅ `payment_intent.failed`
   - ✅ `payment_intent.cancelled`
   - ✅ `payment_intent.pending`
   - ✅ `deposit.settled`
   - ✅ `deposit.pending`
   - ✅ `deposit.rejected`
   - ✅ `deposit.reversed`
   - ✅ `refund.accepted`
   - ✅ `refund.failed`
   - ✅ `refund.received`
   - ✅ `refund.settled`
   - ✅ `payout.transfer.sent`
   - ✅ `payout.transfer.paid`
   - ✅ `payout.transfer.failed`

4. 点击 **Create** 或 **Save**

### 5.3 获取 Webhook Secret

1. 创建 Webhook 后，Airwallex 会生成一个 **Webhook Secret**
2. **重要**: 立即复制并保存这个 Secret
3. 将 Secret 写入**本地** `.env`（变量名以后端当前验签实现为准），勿提交仓库。
4. 重启后端服务使配置生效

### 5.4 Webhook 签名验证

后端会自动验证 webhook 签名：

- 使用 `x-signature` 和 `x-timestamp` 头部
- 使用 HMAC SHA256 算法
- 如果验证失败，会返回 401 错误

### 5.5 测试 Webhook

#### 5.5.1 使用 Airwallex 测试工具

1. 在 Airwallex Dashboard 中，找到你创建的 Webhook
2. 点击 **Send Test Event** 或 **Test**
3. 选择要测试的事件类型
4. 检查后端日志，确认事件已接收和处理

#### 5.5.2 查看 Webhook 日志

在后端控制台查看日志：

```bash
# 成功接收 webhook
🔍 Webhook 调试信息: { ... }
✅ Webhook 事件已保存: { ... }
📦 收到webhook事件: payment_intent.succeeded

# 签名验证失败
❌ Webhook 签名验证失败: { ... }
```

#### 5.5.3 使用监控页面查看 Webhook 事件

- **CMS（商户）**：访问 `http://localhost:3010/monitoring/webhooks` 查看本商户的 webhook 事件
- **Platform（平台）**：访问 `http://localhost:3020/monitoring/webhooks` 查看全部商户，支持 `?merchantId=` 过滤

详见 [System Monitoring — Overview](./System-Monitoring-Overview.md)、[System Monitoring — CMS](./System-Monitoring-CMS.md)、[System Monitoring — Platform](./System-Monitoring-Platform.md)。

### 5.6 Webhook 事件处理流程（历史 + 当前表名）

**历史（Airwallex）**：后端曾验签并入队处理；该路径已移除。

**当前（Stripe / OmiPay）**：验签后写入 **`merchant.webhooks_events_psp`**（按 `payment_provider` 区分），再异步更新订单与支付记录；成功路径应尽快返回 **200**，避免 PSP 端超时重试。

### 5.7 常见问题排查

#### 5.7.1 Webhook 未收到

- ✅ 检查防火墙规则是否允许端口 3050
- ✅ 检查路由器端口映射是否正确
- ✅ 检查 DDNS 是否正常运行，域名是否解析到正确的 IP
- ✅ 检查后端服务是否正在运行
- ✅ 在 Airwallex Dashboard 查看 Webhook 发送日志

#### 5.7.2 签名验证失败

- ✅ 确认本地已配置与 Dashboard 一致的 Webhook 验签密钥（勿依赖仓库模板中的旧变量名）
- ✅ 确认 Webhook Secret 与 Airwallex Dashboard 中的一致
- ✅ 检查后端日志中的签名验证详情

#### 5.7.3 事件处理失败

- ✅ 查看后端日志中的错误信息
- ✅ 在 CMS 或 Platform 的 Webhook 监控页面查看失败的事件（[System Monitoring — CMS](./System-Monitoring-CMS.md)、[System Monitoring — Platform](./System-Monitoring-Platform.md)）
- ✅ 可以点击 **重试** 按钮重新处理失败的事件

---

## 6. 完整配置检查清单

### 6.1 环境配置
- [ ] 后端服务运行在 `localhost:3050`
- [ ] 本地 `.env` 已按需配置数据库等；若调试遗留 Airwallex，沙盒 API host 与 Webhook 验签密钥已与 Dashboard 一致且未提交仓库

### 6.2 网络配置
- [ ] Windows 防火墙已允许端口 3050
- [ ] 路由器端口映射已配置（3050 → 本地 IP:3050）
- [ ] 已获取公网 IP 地址

### 6.3 域名配置
- [ ] DDNS 配置文件已创建并填写正确
- [ ] AWS CLI 已配置
- [ ] Route 53 Hosted Zone ID 已获取
- [ ] DDNS 任务正在持续运行
- [ ] 域名可以正确解析到公网 IP

### 6.4 PSP Webhook 配置（当前：Stripe / OmiPay）
- [ ] 已在对应 PSP Dashboard 创建 Webhook，URL 为 **https** 且可公网访问
- [ ] Stripe：`/api/webhooks/stripe`，且后端已配置 `STRIPE_WEBHOOK_SECRET`
- [ ] OmiPay：`/api/webhooks/omipay/<webhookKey>`，验签使用商户 OmiPay 配置中的密钥
- [ ] （历史）若仍看到 Airwallex Dashboard 中指向本系统的 URL，应删除或停用，避免误投事件

### 6.5 测试验证
- [ ] 可以通过域名访问 webhook 端点（HTTPS）
- [ ] 使用当前 PSP 的测试事件或 Dashboard「Send test」验证签名校验与入库
- [ ] 后端日志显示事件已接收和处理
- [ ] CMS 或 Platform Webhook 监控页面可以查看 webhook 事件（见 [System Monitoring — Overview](./System-Monitoring-Overview.md)）

---

## 7. 相关资源

- **Airwallex API 文档**: https://www.airwallex.com/docs/api
- **Airwallex Webhook 文档**: https://www.airwallex.com/docs/api#/Webhooks
- **AWS Route 53 文档**: https://docs.aws.amazon.com/route53/
- **后端 Webhook 端点（当前）**: `/api/webhooks/stripe`，`/api/webhooks/omipay/:webhookKey`
- **Webhook 监控**: [System Monitoring — Overview](./System-Monitoring-Overview.md) — CMS `/monitoring/webhooks`、Platform `/monitoring/webhooks`

---

## 8. 注意事项

1. **开发环境与生产环境分离**: 
   - 确保使用沙盒环境的 API Key 和 Webhook Secret
   - 不要在生产环境使用开发配置

2. **Webhook Secret 安全**:
   - 不要将 Webhook Secret 提交到代码仓库
   - 使用 `.env` 文件管理敏感信息
   - 定期轮换 Webhook Secret

3. **DDNS 更新延迟**:
   - DNS 更新可能需要几分钟才能生效
   - 使用较短的 TTL（如 300 秒）以便更快更新

4. **网络稳定性**:
   - 确保开发机器持续运行
   - 如果 IP 变化，DDNS 会自动更新，但可能需要等待几分钟

5. **测试环境限制**:
   - 沙盒环境的 webhook 可能不支持所有事件类型
   - 某些事件可能需要手动触发或使用特定的测试数据

---

**最后更新**: 2026-04-08（沙盒 HTTPS、隧道、Route53+Caddy；Windows 下 Caddy 安装与运行）
**维护者**: 开发团队

