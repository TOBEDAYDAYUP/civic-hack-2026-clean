# 共享 API 与实时更新

## 给队友

运行 `npm ci` 和 `npm run dev`。启动前会自动将模板中的团队公开只读配置补到本机 `.env.local`；已有的有效自定义配置和管理员设置会保留。队友无需自建数据库或申请管理员密钥。源码仍通过环境变量连接。修改自己的环境配置后需要重启服务。

数据库的公告或 AI 摘要发生变化时，页面通过 Supabase Realtime 收到通知并重新查询 API；断线或页面重新可见时，30 秒轮询作为补充。不要把“数据库变化实时显示”理解成“官方源一直在自动抓取”。

每小时同步工作流见 `.github/workflows/toronto-source-sync.yml`。合入 `main` 并配置下述 GitHub Actions secrets 后，在 GitHub 服务器上按每小时第 17 分钟（UTC）抓取官方源并同步共享数据库，不依赖任何人的电脑或 Next.js 进程。GitHub 的计划任务可能延迟，不保证准点。数据库写入成功后，队友页面和 agent 可读取新公告。

## 每小时官方源入库与队友 agent 的接口

1. 在 `TOBEDAYDAYUP/civic-hack-2026-clean` 仓库的 Settings → Secrets and variables → Actions 配置 `SUPABASE_URL` 和 `SUPABASE_SECRET_KEY`。只使用仓库 secrets，不要提交到源码或写入公开日志。
2. 将工作流合入默认分支 `main`；分支里的 cron 不会自动开始运行，fork 也不会写入共享库。
3. 在 Actions → **Hourly Toronto notice sync** 手动运行一次，确认成功后检查 `GET /api/sync/status` 的 `last_success_at`。失败会显示红叉；Toronto 超时会保留已有公告，不会伪装为成功。
4. 队友 agent 继续读取 `civic_source_notices`（字段 `id,source_hash,notice_date,payload,updated_at`）。`updated_at` 用于增量读取，`source_hash` 标识内容版本；应按 `(updated_at,id)` 排序分页并在处理成功后持久化游标。

本任务只抓取 `https://secure.toronto.ca/nm/notices.json`，调用已有的 `civic_acquire_sync_lease` / `civic_commit_source_sync`，更新原始公告和同步状态。不收集投票、不运行队友的 agent、不调用 Ollama、不覆盖 agent 的派生表，也不重复应用数据库迁移。已同步且内容未变的公告不会更新 `updated_at`；没有新增时，agent 可能没有新记录可处理。租约和 Actions concurrency 阻止同一源的重叠抓取。

队友应在上游成功入库后处理；不能假定自己在整点运行时公告已更新。GitHub cron 可能延迟，可读取同步状态后重试。如果保留本机 `data:watch` 做 AI 处理，请去掉 `--sync-source`，避免启动第二个抓取循环。手动入库仍可使用下面的命令。

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
| `GET /api/notices?page=1&limit=12&q=meeting` | 共享公告分页、全文字段搜索；可同时提供 `sort=newest|oldest` 与 `category=all|transportation|housing|budget|infrastructure|other`；limit 1–48 |
| `GET /api/notices?savedOnly=1&ids=8006,8123` | 只读取所选公共公告 ID；支持上述搜索、分类与排序参数，收藏仅在用户浏览器保存 |
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

搜索/分类会先对符合条件的公告做筛选，再进行每页 12 条的分页。由于现有数据库没有标准分类列，非默认筛选会在服务器端读取公告集合，使用 15 秒短期缓存；当前限制 20,000 条，未来数据变大时应迁移到有索引的数据库筛选。分类依据官方 topic 和标题的关键词，Other 为未匹配记录，属于导航辅助标签，不是市政府官方的最终决策性质判断。

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
caffeinate -i npm run data:watch -- --since-minutes=120
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
