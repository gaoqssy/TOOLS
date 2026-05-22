# 旅行规划工具

这是 `TOOLS` 里的 Life 小工具，用来管理多人旅行的计划空间。每次旅行是一个独立 Trip，包含预算、行程、地图点位、清单和协作包。

## 使用方式

推荐启动本地数据服务：

```bash
cd /Users/gao/Desktop/TOOLS/Life/travel-planner
python3 server.py
```

然后打开：

```text
http://127.0.0.1:8788/
```

也可以直接在浏览器打开 `index.html`，此时会退回到浏览器本地模式。

启动数据服务后，保存和导入会自动同步到后台 JSON 文件：

```text
data/trips.json
```

这个数据文件被 `.gitignore` 忽略，不会提交到 GitHub。需要和同行人共享时，可以导出“协作包”JSON。

## 功能

- 新建、编辑、删除旅行。
- 维护旅行名称、目的地、日期、状态、成员和备注。
- 按交通、住宿、餐饮、门票、购物、其他记录计划预算，计算总预算和人均预算。
- 按日期维护行程，记录时间、地点、类型、负责人、费用预估和备注。
- 手动维护地点库，记录名称、地址、经纬度、分类、优先级和备注。
- 在无第三方地图 API 的情况下展示手动点位的相对位置。
- 维护行前待办、打包清单、证件 / 预订清单。
- 支持 JSON 协作包导入和导出。

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
  "updatedAt": "2026-05-22T00:00:00.000Z",
  "source": "TOOLS/Life/travel-planner",
  "storageKey": "tools.life.travel_planner.v1",
  "trips": []
}
```

agent 可以通过这些接口读取、更新和删除旅行规划数据。网页只是展示和维护层，后台 JSON 是数据源。

## Agent 交互方向

可以逐步支持这些自然语言操作：

- “帮我新建一次北京三日游。”
- “把故宫加到第二天上午。”
- “预算里住宿加 1200。”
- “给这次旅行加一个证件清单：检查身份证和护照。”
- “帮我导出这次旅行的协作包。”

## 数据兼容性

本工具使用以下本地存储 key：

```text
tools.life.travel_planner.v1
```

JSON 导出结构：

```json
{
  "schemaVersion": 1,
  "exportedAt": "2026-05-22T00:00:00.000Z",
  "source": "TOOLS/Life/travel-planner",
  "storageKey": "tools.life.travel_planner.v1",
  "trips": []
}
```

每条旅行记录的 `type` 固定为 `trip`。后续可以把预算预估接入 Finance，把临近行程和待办接入 TOOLS 总看板。
