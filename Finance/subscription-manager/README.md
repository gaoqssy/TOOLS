# 固定支出管理器

这是 `TOOLS` 里的第一个 Finance 小工具，用来管理订阅、会员、房租、话费、云服务等周期性支出。

## 使用方式

推荐启动本地数据服务：

```bash
cd /Users/gao/Desktop/TOOLS/Finance/subscription-manager
python3 server.py
```

然后打开：

```text
http://127.0.0.1:8787/
```

也可以直接在浏览器打开 `index.html`，此时会退回到浏览器本地模式。

启动数据服务后，保存、删除和导入会自动同步到后台 JSON 文件：

```text
data/recurring-expenses.json
```

这个数据文件被 `.gitignore` 忽略，不会提交到 GitHub。需要迁移时可以展开“数据备份”导出 JSON。

## 功能

- 新增、编辑、删除固定支出。
- 记录名称、金额、币种、周期、下次扣费日、分类、支付账户、状态和备注，支持周付、月付、季付、半年付和年付。
- 自动计算月均固定支出、年化固定支出、未来 30 天扣费金额和活跃项目数量。
- 多币种金额会按币种分别汇总，不做汇率换算。
- 展示未来 7 天和 30 天内的即将扣费项目。
- 按分类、状态筛选，按扣费日、金额、名称、分类排序。
- 支持勾选项目后批量删除。
- 支持折叠的 JSON 导入和导出。

## 数据服务 API

本地数据服务提供以下接口：

```text
GET /api/health
GET /api/records
PUT /api/records
```

`PUT /api/records` 接收完整数据：

```json
{
  "schemaVersion": 1,
  "updatedAt": "2026-05-11T00:00:00.000Z",
  "source": "TOOLS/Finance/subscription-manager",
  "records": []
}
```

agent 可以通过这些接口读取、更新和删除固定支出。网页只是展示层，后台 JSON 是数据源。

## 后续交互方向

当前网页负责展示和表单维护。下一步可以让 agent 接收自然语言输入，再转换成对数据服务的操作：

- “帮我新增一个半年付会员”
- “把某个订阅改成暂停”
- “删掉我选中的这些服务”
- “帮我总结下未来 30 天扣费”

## 数据兼容性

本工具使用以下本地存储 key：

```text
tools.finance.recurring_expenses.v1
```

JSON 导出结构：

```json
{
  "schemaVersion": 1,
  "exportedAt": "2026-05-11T00:00:00.000Z",
  "source": "TOOLS/Finance/subscription-manager",
  "storageKey": "tools.finance.recurring_expenses.v1",
  "records": []
}
```

每条记录的 `type` 固定为 `recurring_expense`，后续可以并入资产管理工具的固定支出、现金流预测或预算模块。
