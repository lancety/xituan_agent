# S3 桶访问模型与私有前缀

Last updated: 2026-10-25

Skill checklist：`.cursor/skills/s3-bucket-access/SKILL.md`。直传 PUT 主机与三步协议仍以 [S3 直传约定](../../.cursor/skills/s3-direct-upload/reference.md) 为准。本文管 **对象谁能 GET**、桶策略怎么改、以及私有前缀登记，避免以后 S3/CDN 改动漏掉「禁止匿名 GET」。

账号 `594332420383`，区域 `ap-southeast-2`。下面「现网快照」来自 2026-10-25 CLI 实读，改策略前先再 GET 一遍，不要假设与本文逐字相同。

## 结论

| 项 | 约定 |
|----|------|
| 每环境一个媒体桶 | `xituan-dev` / `xituan-staging` / `xituan-demo` / `xituan`（prod） |
| 对公网 | 四桶均开 **Block Public Access**（四开关全 true），`PolicyStatus.IsPublic = false`。匿名不能凭 `s3.amazonaws.com` 桶 URL 读对象 |
| 对 CDN | 每桶 1 个仍存在的 S3 直读 CloudFront（OAC）被 **Allow** `s3:GetObject` + `bucket/*`。知道 key 即可匿名 GET——这是目录图/公开文件的设计，不是漏洞 |
| 对私有前缀 | 同一桶上再加 **Deny** CloudFront `s3:GetObject`（见登记表）。应用侧：登录 API 换短时 S3 SigV4 GET。Backend **不**中转文件字节 |
| 改策略 | `put-bucket-policy` **整份覆盖**。必须 GET 现有 policy → 按 Sid 合并 → PUT。dev/staging/prod 还有无 Sid 的 IAM user Allow，合并时不得丢掉 |

Block Public Access **挡不住** OAC。要禁止「同一 key 走 CDN 匿名 GET」，必须对 CloudFront principal 显式 Deny。

不要对 `Principal: *` Deny `s3:GetObject`：会打断 ECS/IAM 预签名 GET。

## 私有前缀登记表（改 S3 必看）

新增「只有登录商户能读」的对象时：**先加本表 + Deny，再写业务代码**。没有登记的前缀默认按公开 CDN 可读处理。

| Sid | Resource suffix | 业务 | 应用读法 | 落地 |
|-----|-----------------|------|----------|------|
| `DenyCloudFrontGetLedgerIntake` | `merchant/*/ledger-intake/*` | 流水 processed CSV | CMS 登录后 `GET .../blocks/:id/processed` → 短时 `getUrl`（不回 key、不拼 content/media） | 四桶 CLI 已合并；demo CFN 已写入 |

已知仍走公开 CDN、**尚未**收口（不要在流水任务里顺手改）：

- 合作商结算单 PDF：CMS 仍用 `contentDomain + pdfPath`。要私有化时按「新增私有前缀」流程加行，不要只改应用。

SIH Lambda 用 IAM `GetObject`，**不受**本 Deny 约束。私有 key 禁止交给 `getContentUrlImageForKind` / SIH 展示 URL。

## 现网快照（2026-10-25）

### 共用设定

| 项 | 四桶 |
|----|------|
| Location | `ap-southeast-2` |
| Block Public Access | ACL / policy / ignore ACL / restrict 全 true |
| 默认加密 | SSE-S3 `AES256`（demo 的 `BucketKeyEnabled=false`，其余 true） |
| Object Ownership | `BucketOwnerEnforced`（ACL 无效） |
| ACL | 仅账户 canonical user `FULL_CONTROL` |
| Logging / 事件通知 | 无 |
| Website hosting | **遗留**：dev / staging / prod 有 `IndexDocument: index.html`；demo 无。当前 CF origin 已是 REST 端点 `*.s3.ap-southeast-2.amazonaws.com`，不要再用 website 端点 |
| Versioning | **仅 prod `Enabled`**；其余未开 |

### 各环境桶策略 Statement

合并时以 **Sid**（有则替换）+ **整段保留无 Sid 的 IAM Allow**。不要把策略写成「只剩 Deny」。

| 桶 | Sid / 位置 | Effect | Principal | Action | Resource | Condition |
|----|------------|--------|-----------|--------|----------|-----------|
| `xituan-dev` | （无 Sid） | Allow | IAM user `xituan_content_manager_dev` | Put/Get/DeleteObject | `…/xituan-dev/*` | — |
| `xituan-dev` | （无 Sid） | Allow | 同上 | ListBucket | `…/xituan-dev` | — |
| `xituan-dev` | `AllowCloudFrontServicePrincipal` | Allow | `cloudfront.amazonaws.com` | GetObject | `…/xituan-dev/*` | SourceArn = `ET7TTQFWQNAX8`（**SIH**，origin 已是 APIGW，对 S3 OAC 无实际作用） |
| `xituan-dev` | `AllowCloudFrontServiceS3FilePrincipal` | Allow | CloudFront | GetObject | `…/*` | SourceArn = **`EJ2S2QK41CGJG`**（现网 S3 直读） |
| `xituan-dev` | `DenyCloudFrontGetLedgerIntake` | Deny | CloudFront | GetObject | `…/merchant/*/ledger-intake/*` | — |
| `xituan-staging` | （无 Sid）×2 | Allow | IAM user `xituan_content_manager` | Put/Get/Delete + List | 该桶 | — |
| `xituan-staging` | `AllowCloudFrontServicePrincipal_xituan` | Allow | CloudFront | GetObject | `…/*` | SourceArn `E2E6EX5VJL3DYQ`（**分布已删**） |
| `xituan-staging` | `AllowCloudFrontServicePrincipal_lancety` | Allow | CloudFront | GetObject | `…/*` | SourceArn `E1YI8M65GLW3GH`（**分布已删**） |
| `xituan-staging` | `AllowCloudFrontServiceS3FilePrincipal_lancety` | Allow | CloudFront | GetObject | `…/*` | SourceArn = **`E29PHKO50LICXE`**（现网 S3 直读） |
| `xituan-staging` | `DenyCloudFrontGetLedgerIntake` | Deny | CloudFront | GetObject | `…/merchant/*/ledger-intake/*` | — |
| `xituan-demo` | `AllowCloudFrontContentOAC` | Allow | CloudFront | GetObject | `…/*` | SourceArn = **`E2G1H6SLDI3HN9`**（CFN `demo-media-stack`） |
| `xituan-demo` | `DenyCloudFrontGetLedgerIntake` | Deny | CloudFront | GetObject | `…/merchant/*/ledger-intake/*` | — |
| `xituan` | （无 Sid）×2 | Allow | IAM user `xituan_content_manager` | Put/Get/Delete + List | 该桶 | — |
| `xituan` | `AllowCloudFrontServicePrincipal_lancety` | Allow | CloudFront | GetObject | `…/*` | SourceArn `E10384UOEQW9X`（**分布已删**） |
| `xituan` | `AllowCloudFrontServicePrincipal_xituan` | Allow | CloudFront | GetObject | `…/*` | SourceArn `E2LFM8S4ZOB7G7`（**分布已删**） |
| `xituan` | `AllowCloudFrontServiceS3FilePrincipal` | Allow | CloudFront | GetObject | `…/*` | SourceArn = **`E1TDIMNIK71W7J`**（现网 S3 直读） |
| `xituan` | `DenyCloudFrontGetLedgerIntake` | Deny | CloudFront | GetObject | `…/merchant/*/ledger-intake/*` | — |

demo **没有** bucket policy 里的 IAM user Allow。应用读写靠身份策略（见下节），不靠这段资源策略。下次 deploy `demo-media-stack` 会整份替换 demo 策略，YAML 必须继续带 Allow OAC + 全部私有 Deny。

已删除分布上的 Allow **目前无害**（条件永远匹配不到）。清理时只删那几条，保留加粗的现网 S3 CF Allow 与全部 Deny。不要为了「好看」重写整份策略。

### CloudFront（S3 直读 vs SIH）

| 环境 | 现网 S3 直读 CF | 别名（实测） | SIH CF（APIGW origin，一般不进桶策略） |
|------|-----------------|--------------|----------------------------------------|
| dev | `EJ2S2QK41CGJG` | content-dev / media-dev / images-dev（xituan；CF 上还有 lancety 别名，**非必须**） | `ET7TTQFWQNAX8`（`imagesih-dev.*`；仍留在桶 Allow 里） |
| staging | `E29PHKO50LICXE` | content-staging / media-staging / images-staging（同上，lancety **非必须**） | `EN2KQMA21T6LA`（不在桶策略） |
| demo | `E2G1H6SLDI3HN9` | content-demo / media-demo / images-demo（仅 xituan.com.au） | `EKWTJEFE7FJEJ`（`imagesih-demo.xituan.com.au`） |
| prod | `E1TDIMNIK71W7J` | content / media（xituan **+ lancety**，服务小程序） | `E1AFO6UT1YFGVQ`（`imagesih.*`；**`images.*` 仍挂这里**，老数据 URL 兼容，尚未改成 media 别名） |

**lancety**：只给微信小程序用。现网只有 **prod** 跑小程序，所以 **只有 prod 必须配** `*.lancety.com` CF 别名。demo 没有 lancety 是对的，不要补。dev/staging CF 上即使还有 lancety 别名，也不是业务需要，缺了不必加。`site-domain.ts` 里各环境都有 `wechat*` 常量，不等于非 prod 要配 DNS。

**prod `images.*`**：目标仍是变成 media 静态 CF 的别名（见 [media-cdn-sih-domain-split.md](../media-cdn-sih-domain-split.md)）。现在挂 SIH 是为了旧对象 URL 还能打开，**未完成迁移**。不要当成配错去改 DNS，也不要在未迁完前把 `images.*` 从 SIH 摘掉。

### IAM 两层（预签名仍走这里）

| 层 | 现网 |
|----|------|
| 身份 | IAM 用户 `xituan_content_manager`、`xituan_content_manager_dev` 同属组 **`s3_xituan`** → 托管策略 `AmazonS3FullAccess`。backend 用这对用户的 access key（`S3_KEY` / `S3_SECRET_KEY`），不是 ECS task role 上的 `s3:*` |
| 资源（桶策略） | 仅 dev/staging/prod 再 Allow 对应用户在**本桶**的 Get/Put/Delete/List。与组策略重复，但收窄「写进桶策略的是哪只用户」。demo 无此段 |
| CloudFront Deny | 只挡 CF 服务主体；**不挡**上述用户的 SigV4 GET/PUT |

组上 `AmazonS3FullAccess` 是账户级现网事实，收紧身份范围是另一次 IAM 工作，不要和私有前缀 Deny 捆在一起改。

Lambda：`08_async_image_jobs` / `09_expense_receipt_ocr_jobs` 的角色是身份策略读本桶；SIH 函数角色同样。它们都能 GetObject 私有前缀，所以业务上不要把流水 key 送进 SIH/OCR。

### CORS（现网与仓库 JSON 一致）

权威副本：`xituan_agent/aws-setup/scripts/s3-cors-presigned-put/cors-{dev,staging,demo,prod}.json`。改 CORS 用 `put-bucket-cors`，**不要**动 bucket policy。

| 桶 | Methods | Origins（现网） |
|----|---------|-----------------|
| `xituan-dev` | GET PUT POST HEAD | localhost / 127.0.0.1 的 3005 / 3010 / 3020 |
| `xituan-staging` | 同上 | cms-staging / staging / platform-staging + 上述 localhost；127.0.0.1 仅 3010 |
| `xituan-demo` | 另加 **DELETE** | demo / cms-demo / platform-demo + localhost 3005/3010/3020 + 127.0.0.1:3010 |
| `xituan` | GET PUT POST HEAD | cms / platform / www / apex `xituan.com.au`（无 localhost） |

共同：`AllowedHeaders: *`，`ExposeHeaders: ETag, x-amz-request-id, x-amz-version-id`，`MaxAgeSeconds: 3600`。

`demo-media-stack.yaml` 的 CORS 默认 origins 已含 `http://127.0.0.1:3010`，与现网一致。

## 桶与展示主机

| 环境 | 桶 | content / media（xituan） | lancety（仅小程序；只需 prod） |
|------|----|---------------------------|--------------------------------|
| dev | `xituan-dev` | `content-dev` / `media-dev` `.xituan.com.au` | 不要求 |
| staging | `xituan-staging` | `content-staging` / `media-staging` | 不要求 |
| demo | `xituan-demo` | `content-demo` / `media-demo` | 不要求（未配是对的） |
| prod | `xituan` | `content` / `media` `.xituan.com.au` | `content.lancety.com` / `media.lancety.com` |

## Deny 语句（按桶替换 BUCKET）

```json
{
  "Sid": "DenyCloudFrontGetLedgerIntake",
  "Effect": "Deny",
  "Principal": { "Service": "cloudfront.amazonaws.com" },
  "Action": "s3:GetObject",
  "Resource": "arn:aws:s3:::BUCKET/merchant/*/ledger-intake/*"
}
```

对挂在该桶上的 **S3 直读** CloudFront（content 与 media 同分布）生效。IAM 用户与 SigV4 不受影响。

## CLI（所有环境）

配置与脚本：`xituan_agent/aws-setup/scripts/s3-private-prefix-cdn-deny/`。

```bash
cd xituan_agent/aws-setup/scripts/s3-private-prefix-cdn-deny
python apply-cdn-deny.py --dry-run
python apply-cdn-deny.py
```

脚本按 `prefixes.json` 对四桶 GET→按 Sid 替换/追加 Deny→PUT。**不要**手工 `put-bucket-policy` 一份只有 Deny 的 JSON。

读现网（完善文档或改策略前）：

```bash
aws s3api get-bucket-policy --bucket xituan-dev --query Policy --output text
aws s3api get-public-access-block --bucket xituan-dev
aws s3api get-bucket-cors --bucket xituan-dev
aws cloudfront get-distribution --id EJ2S2QK41CGJG --query Distribution.DistributionConfig.Aliases
```

demo 的 `ContentBucketPolicy` 由 CloudFormation 管：只改 CLI 会在下次 `demo-media-stack` deploy 时被冲掉。YAML 必须带同一 Sid。dev / staging / prod 策略不在该 stack 里，以 CLI 合并结果为准；以后若用 CFN 接管，必须写入：现网 S3 CF Allow、登记表全部 Deny、以及是否保留 IAM user Allow。

## 探测（加前缀或改 Deny 后）

1. `aws s3 cp` 一个探测对象到目标 suffix（例如 `merchant/cdn-deny-probe/ledger-intake/probe.txt`）。
2. `aws s3api head-object` 期望 200（IAM）。
3. 匿名 `curl -sI https://content-<env>/.../probe.txt` 与对应 media 主机期望 **403**。
4. 对照：同一商户前缀下、**不在** suffix 内的对象，content GET 仍应为 200。
5. **立刻删除**探测对象。

2026-10-25 已在四桶对 `ledger-intake` 跑过：IAM 200，content/media 403；dev 对照路径 200。若对象在 Deny 生效前已被 CloudFront 缓存，可能需对该 path 做 invalidation（流水文件此前不应走 CDN）。

## 应用侧（私有对象）

| 做 | 不要 |
|----|------|
| 登录校验商户后再 `getSignedUrl` GET | 把 key 或 content/media 直链回给前端 |
| 列表用 `hasCloudFiles` 等布尔 | 用 CDN URL 当「已上传」标记 |
| 客户端只打开短时 `getUrl` | Backend `GetObject` 再 pipe 给浏览器 |
| 新功能先查本登记表 | 假定「桶已经 private」所以 CDN 也不可读 |

流水实现见 [ledger-intake/README.md](../ledger-intake/README.md)。

## 新增私有前缀清单

1. 在本表加一行（Sid + suffix + 读法）。
2. `prefixes.json` 追加同一 Sid。
3. `python apply-cdn-deny.py`（先 `--dry-run`）。
4. `demo-media-stack.yaml` 同步 Statement。
5. 按上文探测四环境（至少 content + IAM）。
6. 业务 API：鉴权、短时签名、响应不带 key。
7. 回写本页现网快照日期与 Statement 表（若 Sid 有变）。

## 相关文档

- [`.cursor/skills/s3-bucket-access/SKILL.md`](../../.cursor/skills/s3-bucket-access/SKILL.md) — agent checklist
- [S3 直传约定](../../.cursor/skills/s3-direct-upload/reference.md) — PUT / content 写入 behavior
- [media / content / SIH](../media-cdn-sih-domain-split.md)
- [流水入账](../ledger-intake/README.md) — 数据块与签名读；GET 策略仍以本文为准
- [`demo-media-stack.yaml`](../../aws-setup/demo/demo-media-stack.yaml)
- [`aws-deployment-guide.md`](../../aws-setup/aws-deployment-guide.md) — `S3_BUCKET` 环境变量
- [`textract-iam-permissions.md`](../../aws-setup/textract-iam-permissions.md) — `xituan_content_manager` 另需 Textract，与桶策略无关
