# 规则转发开发说明（2026-04）

本文记录本次“规则匹配 + debug_log 推送接入同步流程”的实现要点，重点覆盖后续扩展时容易踩坑的地方。

## 1. 本次抽象出的预留接口

后端新增模块：`backend/src/guet_notifier/forwarding.py`

核心入口：

- `forward_notifications_for_user(db, user_id, collector_key, items)`

设计目标：

- **采集器无关**：只要求采集器把数据落到 `NotificationItem` 后调用该入口。
- **低耦合**：`main.py` 不再承载规则匹配/推送细节，仅做调用。
- **可观测**：统一在 forwarding 模块输出执行日志，便于后期定位不同采集器的推送行为。

当前接入点：

- `sync_smart_campus_messages` 在保存 `NotificationItem` 后，统一调用该接口执行规则转发。

## 2. 开发注意事项（重要）

### 2.1 规则转发不要绑定某个采集器

- 不要在规则执行逻辑中硬编码 `smart_campus`。
- 采集器差异通过 `NotificationItem.source` + 规则配置的 `sources` 过滤处理。
- 新采集器上线时，应复用 `forward_notifications_for_user`，而不是复制一份转发逻辑。

### 2.2 旧库兼容必须保留

历史数据库中 `subscription_rules` 可能存在字段差异（如 `rule_config` / `config_json` / `rule_config_json`）。

- 启动时通过 `_ensure_schema_columns()` 自动补齐与回填。
- 新增字段写入时，保持兼容字段同步，避免旧数据/旧环境报错。

### 2.3 幂等性要求

`PushAttempt` 的去重逻辑依赖“同一用户 + 同一通知 + 同一规则 + 同一渠道 + success”检查。

- 重复同步消息时不应重复成功推送。
- 失败记录仍会保留，便于后续重试策略扩展。

### 2.4 规则配置校验策略

- `match.mode` 兼容旧值 `keyword`（内部归一化为 `any`）。
- `use_regex=true` 时必须在接口层先做 regex 编译校验，非法直接返回 `422`。
- `sources` 中的 key 必须出现在 `registry.COLLECTORS`（前端用 `GET /api/v1/meta/collectors` 渲染多选，避免用户手填 ID）。
- `channel_keys` 至少一项，且每项必须出现在 `registry.PUSHERS`（前端用 `GET /api/v1/meta/pushers` 多选）。
- 转发层在 `channel_keys` 为空时的兜底仍保留，但 API 保存规则时不允许空列表。

### 2.5 采集器 / 推送器目录与测试推送器

- 静态目录：`backend/src/guet_notifier/registry.py` 的 `COLLECTORS`、`PUSHERS`。新增采集器或推送器时同步改此处并保证 `NotificationItem.source` / `pushers.send` 分支一致。
- **test_collector**：`registry.TEST_COLLECTOR_SOURCE`，`POST /api/v1/collectors/test/messages/sync` 写入合成 `NotificationItem` 并调用 `forward_notifications_for_user`；用于无 CAS 环境下的规则/推送联调。
- **test_db**：将渲染后的主题/正文等写入表 `test_pusher_deliveries`，供联调；查询 `GET /api/v1/pushers/test-deliveries`（需登录）。前端规则页展示「测试推送记录」。
- **pushers.send** 签名为 `(db, *, user_id, rule_id, notification_item_id, channel_key, payload)`，需要写库的通道必须传 `db`。

## 3. 推荐开发方法（后续扩展）

### 3.1 新增采集器时的最小接入步骤

1. 采集器抓取后写入/更新 `NotificationItem`。
2. 收集本次同步涉及的 `NotificationItem` 列表。
3. 调用 `forward_notifications_for_user(..., collector_key="<your_collector_key>", items=...)`。
4. 提交事务并记录采集与转发结果日志。

可参考 `sync_test_collector_messages` 的最小实现（合成数据 + 同事务转发）。

### 3.2 新增推送渠道时的步骤

1. 在 `registry.PUSHERS` 增加 `key` 与中英文标签。
2. 在 `pushers.py` 的 `send(...)` 内增加对应 `channel_key` 分支（需要落库则使用传入的 `db`）。
3. 保持返回约定：`(ok: bool, error_message: str)`。
4. 不改动规则匹配主流程；前端会从 `/api/v1/meta/pushers` 自动出现新选项。

### 3.3 测试策略建议

- **规则匹配单测**：覆盖 `all/any/keyword`、include/exclude、regex。
- **API 测试**：覆盖规则 CRUD、用户隔离、非法正则返回码。
- **集成测试**：至少验证一次“采集 -> NotificationItem -> forwarding -> PushAttempt”链路。

## 4. 已知限制与后续建议

- 当前推送执行与采集流程处于同一事务和请求路径，长耗时渠道会拖慢同步接口。
- 后续建议引入任务队列（异步 worker）：
  - 同步接口只负责入库与入队；
  - 转发在后台异步执行；
  - `PushAttempt` 增加重试次数、下一次重试时间、最终状态字段。
