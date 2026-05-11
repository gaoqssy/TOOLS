# 固定支出管理器

这是 `TOOLS` 里的第一个 Finance 小工具，用来管理订阅、会员、房租、话费、云服务等周期性支出。

## 使用方式

直接在浏览器打开 `index.html`。

数据默认保存在当前浏览器的 `localStorage` 中，不会上传到网络。建议定期使用“导出 JSON”备份。

## 功能

- 新增、编辑、删除固定支出。
- 记录名称、金额、币种、周期、下次扣费日、分类、支付账户、状态和备注。
- 自动计算月均固定支出、年化固定支出、未来 30 天扣费金额和活跃项目数量。
- 多币种金额会按币种分别汇总，不做汇率换算。
- 展示未来 7 天和 30 天内的即将扣费项目。
- 按分类、状态筛选，按扣费日、金额、名称、分类排序。
- 支持 JSON 导入和导出。

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
