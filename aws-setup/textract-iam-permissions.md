# AWS Textract IAM 权限配置指南

## 问题描述

当使用 `xituan_content_manager` IAM 用户调用 Textract API 时，可能会遇到以下错误：

```
AccessDeniedException: User: arn:aws:iam::594332420383:user/xituan_content_manager 
is not authorized to perform: textract:AnalyzeExpense because no identity-based 
policy allows the textract:AnalyzeExpense action
```

## 解决方案

需要为 IAM 用户 `xituan_content_manager` 添加 Textract 权限。

### 方法 1: 通过 AWS 控制台添加权限

1. **登录 AWS 控制台**
   - 访问：https://console.aws.amazon.com/iam/
   - 使用管理员账户登录

2. **找到 IAM 用户**
   - 导航到：IAM → Users → `xituan_content_manager`

3. **添加权限策略**
   - 点击 "Add permissions" 按钮
   - 选择 "Attach policies directly"
   - 搜索并选择 `AmazonTextractFullAccess`（完整权限）
   - 或者创建自定义策略（推荐，更安全）

### 方法 2: 创建自定义 IAM 策略（推荐）

创建最小权限策略，只允许必要的 Textract 操作：

1. **创建策略**
   - 导航到：IAM → Policies → Create policy
   - 选择 "JSON" 标签页
   - 粘贴以下策略：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "textract:AnalyzeExpense",
        "textract:AnalyzeDocument",
        "textract:DetectDocumentText"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::your-bucket-name/raw-material-receipts/*"
    }
  ]
}
```

**注意**：将 `your-bucket-name` 替换为实际的 S3 存储桶名称。

2. **命名策略**
   - 策略名称：`TextractAnalyzeExpenseAccess`
   - 描述：`Allow Textract AnalyzeExpense API access for raw material receipt OCR`

3. **附加策略到用户**
   - 导航到：IAM → Users → `xituan_content_manager`
   - 点击 "Add permissions" → "Attach policies directly"
   - 搜索并选择刚创建的策略

### 方法 3: 使用 AWS CLI 添加权限

```bash
# 1. 创建策略文件
cat > textract-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "textract:AnalyzeExpense"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::your-bucket-name/raw-material-receipts/*"
    }
  ]
}
EOF

# 2. 创建 IAM 策略
aws iam create-policy \
    --policy-name TextractAnalyzeExpenseAccess \
    --policy-document file://textract-policy.json \
    --description "Allow Textract AnalyzeExpense API access for raw material receipt OCR"

# 3. 附加策略到用户
aws iam attach-user-policy \
    --user-name xituan_content_manager \
    --policy-arn arn:aws:iam::594332420383:policy/TextractAnalyzeExpenseAccess
```

**注意**：
- 将 `your-bucket-name` 替换为实际的 S3 存储桶名称
- 将策略 ARN 中的账户 ID `594332420383` 替换为你的 AWS 账户 ID（如果需要）

### 方法 4: 使用现有策略（快速方案）

如果只需要快速测试，可以直接附加 AWS 托管策略：

```bash
aws iam attach-user-policy \
    --user-name xituan_content_manager \
    --policy-arn arn:aws:iam::aws:policy/AmazonTextractFullAccess
```

**注意**：`AmazonTextractFullAccess` 提供完整权限，适合开发测试。生产环境建议使用自定义策略。

## 验证权限

添加权限后，可以通过以下方式验证：

1. **使用 AWS CLI 测试**
```bash
# 检查用户策略
aws iam list-attached-user-policies --user-name xituan_content_manager

# 检查用户内联策略
aws iam list-user-policies --user-name xituan_content_manager
```

2. **在应用中测试**
   - 重新运行后端服务
   - 尝试上传收据图片
   - 检查是否仍然出现权限错误

## 权限说明

### 必需的权限

- **`textract:AnalyzeExpense`**: 用于识别收据/发票内容
- **`s3:GetObject`**: 用于从 S3 读取图片文件（Textract 需要访问 S3 中的文件）

### 可选权限

- **`textract:AnalyzeDocument`**: 通用文档分析（如果将来需要）
- **`textract:DetectDocumentText`**: 文本检测（如果将来需要）

## 安全建议

1. **最小权限原则**：只授予必要的权限
2. **资源限制**：如果可能，限制 S3 资源路径（如 `raw-material-receipts/*`）
3. **定期审查**：定期检查 IAM 权限，移除不必要的权限
4. **使用 IAM 角色**：对于生产环境，考虑使用 IAM 角色而不是直接附加到用户

## 相关资源

- [AWS Textract 权限参考](https://docs.aws.amazon.com/textract/latest/dg/security-iam.html)
- [IAM 策略语法](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_grammar.html)
- [IAM 最佳实践](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)





