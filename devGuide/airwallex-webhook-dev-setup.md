# Airwallex Webhook 开发环境配置指南

本文档介绍如何配置本地开发环境以接收和处理 Airwallex 沙盒环境的 webhook 事件。

## 📋 目录

1. [本地 Backend 运行环境配置](#1-本地-backend-运行环境配置)
2. [本地防火墙 + 路由映射](#2-本地防火墙--路由映射)
3. [域名绑定](#3-域名绑定)
4. [DDNS 任务持续运行](#4-ddns-任务持续运行)
5. [Airwallex 沙盒环境 Webhook 设置](#5-airwallex-沙盒环境-webhook-设置)

---

## 1. 本地 Backend 运行环境配置

### 1.1 环境变量配置

在 `xituan_backend` 项目的 `.env` 文件中配置以下环境变量：

```env
# Airwallex 配置
AIRWALLEX_BASE_URL=https://api-demo.airwallex.com
AIRWALLEX_API_KEY=your_api_key_here
AIRWALLEX_CLIENT_ID=your_client_id_here
AIRWALLEX_WEBHOOK_SECRET=your_webhook_secret_here

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

- **AIRWALLEX_BASE_URL**: 
  - 沙盒环境: `https://api-demo.airwallex.com`
  - 生产环境: `https://api.airwallex.com`

- **AIRWALLEX_WEBHOOK_SECRET**: 
  - 在 Airwallex Dashboard 中创建 Webhook 时生成
  - 用于验证 webhook 请求的签名

### 1.3 启动后端服务

```bash
cd xituan_backend
npm install
npm run dev
```

后端服务将在 `http://localhost:3050` 启动。

### 1.4 验证 Webhook 端点

Webhook 端点路径: `/api/payments/webhooks/airwallex`

完整 URL: `http://localhost:3050/api/payments/webhooks/airwallex`

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
3. 添加端口转发规则：
   - **外部端口**: `3050`
   - **内部 IP**: `192.168.1.138`（你的本地 IP）
   - **内部端口**: `3050`
   - **协议**: TCP
   - **状态**: 启用

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
# 测试 webhook 端点是否可访问
curl -X POST https://backend-dev.xituan.com.au/api/payments/webhooks/airwallex \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

---

## 5. Airwallex 沙盒环境 Webhook 设置

### 5.1 登录 Airwallex Dashboard

1. 访问: https://dashboard.airwallex.com
2. 使用沙盒环境账户登录
3. 切换到 **Sandbox** 环境（右上角）

### 5.2 创建 Webhook

1. 导航到 **Settings** → **Webhooks**
2. 点击 **Create Webhook** 或 **Add Webhook**
3. 填写以下信息：

   **Webhook URL**:
   ```
   https://backend-dev.xituan.com.au/api/payments/webhooks/airwallex
   ```
   
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
3. 将 Secret 添加到 `.env` 文件：
   ```env
   AIRWALLEX_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
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

#### 5.5.3 使用 CMS 监控页面

1. 访问 CMS 监控页面: `http://localhost:3000/monitoring`
2. 切换到 **系统监控** 标签
3. 查看 **Webhook 监控** 页面
4. 可以看到所有接收到的 webhook 事件及其状态

### 5.6 Webhook 事件处理流程

1. **接收**: 后端接收 Airwallex 发送的 webhook 请求
2. **验证**: 验证签名和幂等性
3. **保存**: 将事件保存到 `webhooks_events_airwallex` 表
4. **处理**: 异步处理事件，更新订单状态和支付记录
5. **响应**: 立即返回 200 状态码（避免超时）

### 5.7 常见问题排查

#### 5.7.1 Webhook 未收到

- ✅ 检查防火墙规则是否允许端口 3050
- ✅ 检查路由器端口映射是否正确
- ✅ 检查 DDNS 是否正常运行，域名是否解析到正确的 IP
- ✅ 检查后端服务是否正在运行
- ✅ 在 Airwallex Dashboard 查看 Webhook 发送日志

#### 5.7.2 签名验证失败

- ✅ 确认 `AIRWALLEX_WEBHOOK_SECRET` 环境变量已正确配置
- ✅ 确认 Webhook Secret 与 Airwallex Dashboard 中的一致
- ✅ 检查后端日志中的签名验证详情

#### 5.7.3 事件处理失败

- ✅ 查看后端日志中的错误信息
- ✅ 在 CMS Webhook 监控页面查看失败的事件
- ✅ 可以点击 **重试** 按钮重新处理失败的事件

---

## 6. 完整配置检查清单

### 6.1 环境配置
- [ ] 后端服务运行在 `localhost:3050`
- [ ] `.env` 文件中配置了所有 Airwallex 相关环境变量
- [ ] `AIRWALLEX_BASE_URL` 指向沙盒环境
- [ ] `AIRWALLEX_WEBHOOK_SECRET` 已配置

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

### 6.4 Airwallex 配置
- [ ] 已登录 Airwallex 沙盒环境
- [ ] 已创建 Webhook，URL 指向正确的域名
- [ ] 已订阅所有需要的事件类型
- [ ] Webhook Secret 已保存并配置到后端

### 6.5 测试验证
- [ ] 可以通过域名访问 webhook 端点
- [ ] Airwallex 测试事件可以成功发送
- [ ] 后端日志显示事件已接收和处理
- [ ] CMS 监控页面可以查看 webhook 事件

---

## 7. 相关资源

- **Airwallex API 文档**: https://www.airwallex.com/docs/api
- **Airwallex Webhook 文档**: https://www.airwallex.com/docs/api#/Webhooks
- **AWS Route 53 文档**: https://docs.aws.amazon.com/route53/
- **后端 Webhook 端点**: `/api/payments/webhooks/airwallex`
- **CMS Webhook 监控**: `/monitoring` → 系统监控标签

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

**最后更新**: 2024-10-XX
**维护者**: 开发团队

