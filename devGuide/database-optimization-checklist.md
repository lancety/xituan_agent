# Database Optimization Checklist (分表分区与基本优化)

Quick index for table sizing, partitioning, and system-table handling. Details are in the linked docs.

---

## 1. Doc index

| Doc | Content |
|-----|--------|
| **docs/multi-tenant/database-optimization-guide.md** | Partitioning concepts, 500万行 threshold, monitoring, **Part 4: 系统级表处理** (SystemRepository) |
| **devGuide/multi-tenant-table-partitioning-and-archiving.md** | Partition strategy (hash by merchant_id), archive table (range by time), Phase 1 Schema / Phase 2 Partition / Phase 3 Archive |
| **devGuide/partitioning-prep-500-merchants.md** | Prep for 500 merchants: table list, growth scale, 50 partitions; 数据很少时直接切到新分区表，无大批量迁移 |

---

## 2. “单表拆多表” vs 分区

- **分区（当前文档说的）**：一个**逻辑表**拆成多个**物理分区**（同一张表名，底层多张分区表）。例如 `orders` 按 `merchant_id` 哈希拆成 50 个分区，应用仍查 `orders`。
- **单表拆成多张业务表**（垂直/水平拆表）：例如 `orders` 拆成 `order_headers` + `order_items`，是另一种设计；现有 devGuide/docs 主要讲的是**分区**，没有专门讲这种业务拆表。若要做后者，需单独设计。

---

## 3. 建议的基本优化顺序

1. **表大小监控**（先做）  
   - 用 `database-optimization-guide.md` 第一部分的 SQL 或视图，按 schema（如 `merchant` / `platform`）统计行数、大小。  
   - 阈值：&lt; 100万 正常；100万–500万 监控+优化索引；&gt; 500万 考虑分区。

2. **索引优化**  
   - 业务查询带 `merchant_id` 的，保证有 `(merchant_id, ...)` 复合索引；按文档“分区查询性能优化”检查慢查询。

3. **分区（按需）**  
   - 当某表行数 &gt; 500万（或你定的阈值）再做。  
   - 按 `multi-tenant-table-partitioning-and-archiving.md` Phase 2：主表按 `merchant_id` 哈希分区（如 50 个分区），主键含 `merchant_id`；需要时再做归档表（按时间范围分区）。

4. **系统级表**  
   - 见下节。

---

## 4. 系统级表与 SystemRepository（“platform 专用表独立 repo”）

- **含义**：在 **xituan_backend** 的 **Repository 层**（访问 DB 的封装），对 **platform schema 下没有 merchant_id 的表**（如 `platform.merchants`、`platform.platform_settings`、`platform.user_merchants`）不要用“带 merchantId 过滤”的 Repository，而是用**不注入 merchantId、不按 merchant_id 过滤**的访问方式，避免误用 request context 的 merchantId 去查这些表导致报错或错数据。
- **文档位置**：`database-optimization-guide.md` **第四部分：系统级表处理方案**。里面建议的 **SystemRepository** 是一个示例类：对系统级表用 `SystemRepository<T>`（或等价写法），不自动加 `merchant_id` 条件。
- **“哪儿的 repo”**：就是 **xituan_backend** 里、访问 `platform`（以及无 merchant_id）表的那些 **Repository/Service**（TypeORM repository 或自定义 repo 类）。当前项目可能仍是直接用 TypeORM Repository；若要在代码里落地，就为这些表引入“系统级”Repository 封装（不带 merchantId），与带 merchant 过滤的 Repository 区分开。

### Platform 表要不要放进 merchant schema？

- **不需要。** `platform` 表里的数据一般**不是为某个特定 merchant 创建的**，和 `merchant` schema 下"必须关联某个 merchant"的业务表不同；通常**不应该有 merchant_id**（除了 `user_merchants` 里的关联字段）。
- **merchants、user_merchants 留在 platform**：它们是平台级元数据（商户列表、**用户–商户内部成员**关联）。user_merchants 仅表示商户成员（admin/manager/producer/delivery）与 user 的关联，不包含商户的顾客；商户–顾客关系若需要则单独建表。访问时**不做**"按 request 的 merchantId 过滤整表"，而是：查 merchants 按 id/code；查 user_merchants 按 (userId, merchantId) 做**权限校验**（该用户是否为该商户成员）。"merchantId 检查"通过 `requireMerchantAccessMiddleware` + `user_merchants` 在系统级做。

---

## 5. 业务约定（与本优化相关）

- **每用户只关联一个商户**：已在 `platform.user_merchants` 上增加 **UNIQUE(user_id)** 约束（迁移 1710000000225），应用层 assign 逻辑按“一用户一行”做 upsert。
- **商户下的角色**：在 `user_merchants` 表增加 **role** 字段；一个商户可关联多个用户，每个用户在该商户下有一个 role，CMS 和 API 根据该 role 决定哪些功能展示、哪些操作允许。见 devGuide **merchant-scoped-role.md**。

---

## 6. 分区（拆表）复杂度和耗时

- **复杂度**：中等。需要新建分区表结构、主键含分区键、迁移数据、应用层若有按主键查需带 merchant_id、最后切表。文档里步骤清晰，按 `multi-tenant-table-partitioning-and-archiving.md` Phase 2 做即可。
- **几百万数据大概多久**：取决于行数、索引数量、磁盘和 DB 负载。粗估：**百万级** 约十几分钟到几十分钟（单表、索引不多时）；**几百万（如 3–5 百万）** 约 **30 分钟～2 小时**。可用"新建分区表 → 批量 INSERT → 业务低峰期切表"的方式，减少对线上写入的影响；切表本身是元数据切换，很快。
