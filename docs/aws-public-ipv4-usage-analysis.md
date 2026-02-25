# AWS Public IPv4 Usage Analysis (Backend Sydney)

## Billing snapshot

- **Elastic Load Balancing - Application**: USD 18.76 (744 ALB hours + LCU)
- **VPC Public IPv4**:
  - In-use: 2,977.005 hours → USD 14.89
  - Idle: 0.1 hours → negligible

## Why ~2,977 hours (≈ 4 × 744)?

One month ≈ 744 hours. **2,977 hours ≈ 4 × 744** → equivalent to **4 public IPv4 addresses** in use for the whole month.

## Where the 4 public IPs come from (from repo config)

Config is under `xituan_agent/aws-setup/` (CloudFormation).

### 1. Application Load Balancer — **2 public IPs**

- **File**: `02_alb.yaml`
- **Resource**: `ApplicationLoadBalancer` (internet-facing, `IpAddressType: ipv4`)
- **Subnets**: `PublicSubnetId` and `PublicSubnet2Id` (2 AZs)
- ALB creates **one ENI per AZ**, each with **one public IPv4**.
- **Total: 2 public IPs × 744 hrs ≈ 1,488 hours**

### 2. ECS Fargate (backend) — **1 (or 2) public IP(s)**

- **File**: `06_ecs-services.yaml`
- **Resource**: `BackendService` with `AssignPublicIp: ENABLED`
- **NetworkConfiguration**: only `PublicSubnetId` (single subnet)
- Each Fargate task gets one ENI with one public IP when `AssignPublicIp: ENABLED`.
- `DesiredCount: 1`, but with `MaximumPercent: 200` and `MinimumHealthyPercent: 50`, during deployments you can briefly have **2 tasks** → 2 IPs.
- **Typical: 1 IP × 744 hrs; sometimes 2 IPs** → ~744–1,488 hours

### 3. RDS — **0 or 1 public IP**

- **File**: `04_rds.yaml`
- **Resource**: `RDSInstance` in public subnets
- **PubliclyAccessible**: `!Equals [!Ref EnablePublicAccess, 'true']` (default `'false'` in template)
- If production parameters set `EnablePublicAccess: true` (e.g. for data import and not reverted), RDS gets **1 public IPv4**.
- **Total: 0 or 1 public IP × 744 hrs**

### 4. Other

- **VPC** (`01_vpc.yaml`): two public subnets, no NAT Gateway; no extra Elastic IPs in template.
- No other resources in the reviewed templates allocate public IPs.

## Summary table

| Source        | Config location              | Public IPs (typical) | Hours (≈) |
|---------------|------------------------------|------------------------|-----------|
| ALB           | `02_alb.yaml` (2 subnets)     | 2                      | 1,488     |
| ECS Backend   | `06_ecs-services.yaml`       | 1–2                    | 744–1,488 |
| RDS           | `04_rds.yaml` (if public on) | 0–1                    | 0–744     |
| **Total**     |                              | **≈ 4**                | **≈ 2,977** |

So the **~2,977 in-use public IPv4 address-hours** are consistent with: **ALB (2) + ECS (1–2) + possibly RDS (1)**.

## Recommendations to reduce IPv4 cost

1. **RDS**  
   - Confirm in AWS Console / parameter store that `EnablePublicAccess` is `false` in production.  
   - If it was `true` for import, set back to `false` and redeploy the RDS stack so the instance loses its public IP.

2. **ECS (largest lever)**  
   - Backend is only reached via ALB and does not need to be internet-facing.  
   - Move ECS tasks to a **private subnet** and set `AssignPublicIp: DISABLED`.  
   - Outbound internet (e.g. APIs, S3) would then go through a **NAT Gateway** (or NAT instance), which uses **one** public IP for all tasks.  
   - Trade-off: NAT Gateway has an hourly + data processing cost; compare with current ~USD 15/month for 2–3 extra IPs.

3. **ALB**  
   - The 2 ALB IPs are required for high availability across 2 AZs. Removing one AZ would reduce to 1 IP but lose AZ redundancy; usually not recommended.

4. **Verify in AWS**  
   - **EC2 → Network Interfaces**: filter by VPC and “Public IPv4” to see which ENIs have public IPs.  
   - **RDS**: check “Publicly accessible” for `xituan-postgres-production` (or your instance name).  
   - **Cost Explorer**: filter by “Amazon Virtual Private Cloud Public IPv4 Addresses” and (if available) by resource tag to confirm which resource is contributing.

## ALB access to ECS in private subnet

ALB can reach ECS in a private subnet without any change to ALB. The target group uses `TargetType: ip` and forwards to task **private IPs** over the VPC network. Traffic flow: Internet → ALB (public) → ECS tasks (private IPs). So moving ECS to private subnet and setting `AssignPublicIp: DISABLED` does **not** affect ALB access.

## Cost comparison: ECS public IP vs private subnet + NAT

Backend needs **outbound** internet (S3, Airwallex, Sentry, etc.). In a private subnet with no public IP, that traffic must go through a **NAT Gateway** (or NAT instance).

| Option | Monthly cost (Sydney region, ~744 hrs) |
|--------|----------------------------------------|
| **Current**: ECS in public subnet, 1 public IP | 1 × $0.005/hr × 744 ≈ **USD 3.72** |
| **Private subnet**: ECS + 1 NAT Gateway | NAT: $0.045/hr × 744 ≈ **USD 33.50** + $0.045/GB data |

Conclusion: **Keeping ECS in public subnet with one public IP is much cheaper** than adding a NAT Gateway. Only add private subnet + NAT if you need it for compliance or other reasons; for cost alone, current setup wins.

(RDS public access already turned off → that one IP saved is the best win.)

## References

- `xituan_agent/aws-setup/01_vpc.yaml` — VPC, public subnets
- `xituan_agent/aws-setup/02_alb.yaml` — ALB, subnets, security group
- `xituan_agent/aws-setup/04_rds.yaml` — RDS, DB subnet group, PubliclyAccessible
- `xituan_agent/aws-setup/06_ecs-services.yaml` — ECS service, AssignPublicIp, subnets
