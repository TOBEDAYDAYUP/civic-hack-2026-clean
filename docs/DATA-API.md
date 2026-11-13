# 共享 API 与实时更新

## 给队友

运行 `npm ci`、`npm run dev` 即可读取同一份 Supabase 公告，不需要管理员密钥或本地 Ollama。项目的公开只读 URL 和 publishable key 位于 `lib/supabase/config.ts`；RLS 和权限禁止访客写入。

数据库的公告或 AI 摘要发生变化时，页面通过 Supabase Realtime 收到通知并重新查询 API；断线或页面重新可见时，30 秒轮询作为补充。不要把“数据库变化实时显示”理解成“官方源一直在自动抓取”。

用户选择只保留管理员手动同步。没有启用云端定时抓取，也没有将管理员密钥保存到 Vault。手动同步成功后，队友页面会自动看到变化。

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

AI 数据仅在哈希与原始公告相同时合入 `civic_notice_feed`，避免把旧摘要展示成新事实。没有启动后台 AI 生成任务。

Edge Function `civic-sync` 已部署，使用 `apikey` 中的管理员 secret key 显式鉴权，拒绝公开请求；它当前不被定时任务调用。由于 Toronto 云端访问超时，日常使用本地管理员脚本。

## 验证

`npm run check` 包含同步单元测试、类型检查、生产构建、离线页面/API 检查。离线测试显式使用 `NOTICE_DATA_MODE=local`，不依赖外部数据库或官方站点。

管理员可执行 `node --env-file=.env.local scripts/verify-realtime.mjs` 实测共享库：它只将已有公告的更新时间原值写回，验证访客不能写入及 Realtime 确实收到事件，不改变公告内容。

参考：[Supabase Realtime](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes)、[公开与服务端密钥](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys)。
