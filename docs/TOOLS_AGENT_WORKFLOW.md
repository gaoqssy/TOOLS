# TOOLS Agent Workflow

这个文档定义 `TOOLS` 工作区里 agent、网页和数据服务的分工。

## 角色分工

- 网页：展示数据、支持手动维护。
- 数据服务：统一读写本地 JSON 数据，并提供 API。
- Agent：把自然语言转成数据操作，并生成每日看板。

## 新增固定支出

当用户说“我新增了一项固定支出”“我充值了一个会员”“我开了一个订阅”时，agent 应先提取已知信息，再只追问缺失字段。

必填字段：

- 名称
- 金额
- 周期：周付、月付、季付、半年付、年付
- 下次扣费日
- 分类
- 支付账户

默认值：

- 币种：`CNY`
- 状态：`active`
- 类型：`recurring_expense`

写入路径：

```text
Finance/subscription-manager/data/recurring-expenses.json
```

优先通过本地服务写入：

```text
GET /api/subscription-records
PUT /api/subscription-records
```

## 每日看板触发

当用户当天第一次说“早上好”“有什么注意事项”“今日看板”“帮我看看今天”等语义时，agent 应读取 `TOOLS` 数据并生成完整看板。

看板至少包含：

- 今日是否有扣费
- 未来 7 天扣费
- 未来 30 天扣费
- 今日日历清单
- 未来 7 天日程 / 清单
- 纪念日：开始日期、到今天已经多少天、下一次日期
- 月均固定支出
- 年化固定支出
- 数据质量提醒

每日状态记录在：

```text
.agent-state/daily-dashboard.json
```

如果当天已经生成过完整看板，再次触发时默认给简版更新；用户明确要求“重新生成”时再输出完整看板。

## 下次扣费日策略

不要静默修改已经过期的 `nextChargeDate`。

正确策略：

- 展示时根据周期自动推算有效下一次扣费日。
- 如果存储的 `nextChargeDate` 早于今天，加入数据质量提醒。
- 只有在用户确认“已经扣费”“已经续费”“帮我更新到下一期”时，才把存储值推进到下一次扣费日。

这样可以避免把“漏记扣费”和“正常续费”混在一起。

## 整体看板

整体看板由根服务提供：

```bash
cd /Users/gao/Desktop/TOOLS
python3 tools_server.py
```

打开：

```text
http://127.0.0.1:8790/dashboard/
```

当前看板读取：

- 固定支出数据：`Finance/subscription-manager/data/recurring-expenses.json`
- 日历清单数据：`/Users/gao/Library/Containers/com.xdiarys.www/Data/desktopcal.sqlite`

## 日历清单写入

当用户说“帮我加一个日程”“明天加一个事项”“某天记一下某事”时，agent 应提取日期和内容。

必填字段：

- 日期：`YYYY-MM-DD`
- 内容

写入接口：

```text
POST /api/calendar-task/items
```

请求示例：

```json
{
  "date": "2026-05-14",
  "content": "北医三院复诊"
}
```

写入策略：

- 写入前自动备份 `desktopcal.sqlite` 到 `.agent-state/calendar-task-backups/`。
- 如果当天已有清单，则把内容追加为新的一行。
- 如果当天没有清单，则新建 `item_table` 行。
- 不直接写纪念日；纪念日先只读展示，后续确认字段语义后再开放写入。
