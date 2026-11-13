# 共享 API 与实时更新

## 给队友

运行 `npm ci` 和 `npm run dev`。启动前会自动将模板中的团队公开只读配置补到本机 `.env.local`；已有的有效自定义配置和管理员设置会保留。队友无需自建数据库或申请管理员密钥。源码仍通过环境变量连接。修改自己的环境配置后需要重启服务。

数据库的公告或 AI 摘要发生变化时，页面通过 Supabase Realtime 收到通知并重新查询 API；断线或页面重新可见时，30 秒轮询作为补充。不要把“数据库变化实时显示”理解成“官方源一直在自动抓取”。

默认由管理员手动同步。没有启用云端定时抓取，也没有将管理员密钥保存到 Vault。需要短时间自动同步或分析时，可在管理员电脑上显式启动下方进程。数据库写入成功后，队友页面会自动看到变化。

## 管理员手动同步

在新仓库的 `.env.local` 中设置以下私密服务端配置（不要提交，不要发到群里）：

```dotenv
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-existing-secret-key
```

然后运行：

```sh
npm run data:sync
```

本机旧项目已有配置时，也可以不复制凭据，从新仓库运行：

```sh
node --env-file=../.env.local scripts/sync-notices.mjs
```

脚本从 Toronto 官方源获取数据，验证结构，去重，计算稳定内容哈希，再通过受保护的数据库事务增量写入。未变化的数据不重复写入。租约阻止并发同步，超时后自动过期；无有效记录或请求失败时不清空旧数据。源中暂时不再出现的记录仍保留为历史公告。

状态 API 会报告最近的尝试、成功、错误和数量。Toronto 服务器可能超时；这意味着本次未拿到最新源数据，不能将已有数据库记录当成本次同步成功。2026-11-13 验证时，Toronto API 在本机和 Edge Function 均超时；共享数据库读写和 Realtime 通知验证成功。

## API

| 路径 | 用途 |
| --- | --- |
| `GET /api/notices?page=1&limit=12&q=meeting` | 共享公告分页、标题搜索；limit 1–48 |
| `GET /api/processed-notices` | 只返回与当前原始记录哈希匹配的 AI 摘要 |
| `GET /api/sync/status` | 最近同步状态；不返回管理员密钥或租约令牌 |
| `POST /api/sync` | 管理员手动同步；要求服务器配置 `SYNC_ADMIN_TOKEN` 和 `SUPABASE_SECRET_KEY` |
| `POST /api/ai/simplify` | 本地可选 AI 服务；同样要求管理员身份 |
| `/notices/[id]` | 公告详情；尚无 AI 摘要时展示官方原文，不伪造解释 |

管理员 HTTP 调用使用 `Authorization: Bearer <SYNC_ADMIN_TOKEN>`。访客按钮只重新读取数据库，不能启动抓取或调用 Ollama。不要把任何管理密钥放在 `NEXT_PUBLIC_*` 变量中。

## 文件与数据库

- `lib/public-notices.ts`：只读存储接口。
- `lib/supabase/`：公开连接配置和服务器管理鉴权。
- `lib/sync/source-sync.mjs`：管理员同步业务逻辑。
- `supabase/functions/civic-sync/source.mjs`：跨 Node/Edge 共用的解析、规范化、哈希。
- `features/notices/`：共享列表、状态展示、实时订阅和详情刷新。
- `supabase/schema.sql`：原有两张公告表与只读视图的基础结构。
- `supabase/migrations/`：本次已应用到现有项目的增量迁移；不要由每个队友重复应用。

AI 数据仅在哈希与原始公告相同时合入 `civic_notice_feed`，避免把旧摘要展示成新事实。后台 AI 进程默认不启动。

### 居民影响分析

公告详情页读取已有的 `payload.simple.impacts`，展示相关类别、解释和可展开的原文摘录。如果没有可用的 AI 分析，页面只用公告原文给出谨慎说明，或注明资料不足。访问页面不会调用 Ollama。

如需预览某条公告的新分析，先启动本地 Ollama 并下载默认模型 `qwen3.5:4b`，然后运行：

```sh
npm run data:analyze -- --id=8006 --dry-run
```

预览不写数据库，可使用团队公开配置。管理员确认结果后，移除 `--dry-run` 发布到现有 `civic_notices` 表。默认分析最近三条；可用 `--all --max=10` 分批处理，并跳过同一原文版本下已经分析的公告。用 `--force` 可重新分析指定公告。不会改写官方原文，也不需要迁移。

### 评审期间在 Mac 上自动分析

管理员在已经配置 `SUPABASE_SECRET_KEY` 的电脑上启动 Ollama。默认使用本机的 `qwen3.5:4b`，没有安装时先运行 `ollama pull qwen3.5:4b`。

```sh
caffeinate -i npm run data:watch -- --sync-source --since-minutes=120
```

- 每约 30 秒查询一次写入 Supabase 的原文版本，串行生成并发布未处理的新版影响分析。这里回看过去 120 分钟内同步过的记录，不跑整个历史库。相同原文和分析版本不会重复调用模型。失败会重试；重启后可用 `--since-minutes` 补上停机窗口。
- `--sync-source` 让同一个进程启动时和随后每约 15 分钟尝试同步 Toronto API。不加该选项只处理已经入库的原文，不抓取 Toronto。Toronto API 超时不会阻止处理已入库公告。
- `--once --dry-run` 可只预览一轮，不写数据库。不能和 `--sync-source` 一起用。程序不需要启动 Next.js，也不会开放 Ollama 到公网。
- Mac 接电、保持开盖，Ollama 和该终端保持运行。评审结束后在这个终端按 Ctrl+C 即可停止。已经发布的分析仍可从共享数据库读取。

Edge Function `civic-sync` 已部署，使用 `apikey` 中的管理员 secret key 显式鉴权，拒绝公开请求；它当前不被定时任务调用。由于 Toronto 云端访问超时，日常使用本地管理员脚本。

## 验证

`npm run check` 包含同步单元测试、类型检查、生产构建、离线页面/API 检查。离线测试显式使用 `NOTICE_DATA_MODE=local`，不依赖外部数据库或官方站点。

管理员可执行 `node --env-file=.env.local scripts/verify-realtime.mjs` 实测共享库：它只将已有公告的更新时间原值写回，验证访客不能写入及 Realtime 确实收到事件，不改变公告内容。

参考：[Supabase Realtime](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes)、[公开与服务端密钥](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys)。
