# 团队开发约定

完整新手步骤和给其他 AI 的指令见 [docs/GIT-WORKFLOW.md](docs/GIT-WORKFLOW.md)。AI 开工前必须阅读根目录 [AGENTS.md](AGENTS.md)。默认不得直接推送 main；由指定集成人员审核并逐个合并 PR。

`main` 是大家共同使用的稳定版本。每次做一个小任务，使用短期分支，完成后通过 Pull Request 合并。不要每个人长期维护一套完整网站，也不要直接把旧项目整个覆盖进来。

## 第一次启动

使用 Node 22（安装了 nvm 可运行 `nvm use`），然后：

```sh
npm ci
npm run dev
```

运行 npm run dev 会自动将团队的公开只读配置补入本机 .env.local；队友不需要自行创建 Supabase 项目、申请 API 或获取管理员密钥。公告从共享数据库只读获取。只有管理员运行手动源同步，详见 docs/DATA-API.md。不要让每个队友各自抓取和改数据库。

## 每个任务

先确保自己的改动已经提交或保存，再执行：

```sh
git switch main
git pull --ff-only origin main
git switch -c feat/short-task-name
```

先在任务或 PR 中说明负责哪个模块，避免两个人同时改同一份文件。修改后：

```sh
npm run format
npm run check
git add <本次修改的文件>
git commit -m "Describe the change"
git push -u origin feat/short-task-name
```

在 GitHub 发 PR，指定一位队友检查。由一个集成人员逐个合并；推荐 Squash merge，合并后删除已经完成的任务分支。下一项任务从最新 main 开始。

## 模块分工

| 范围 | 目录 | 约定 |
| --- | --- | --- |
| 决策列表、筛选 | `features/decisions/` | 不修改详情或数据接口 |
| 分块详情、住房阶段 | `features/records/` | 截图里的页面在这里；保留来源和不确定性 |
| 公告列表 | `features/notices/` | 与 API 负责人协调数据字段 |
| 地图 | `features/map/` | 仅使用有坐标的记录 |
| 参与入口 | `features/participation/` | 独立开发 |
| 导航和页面外框 | `components/navigation/` | 改动前通知其他 UI 开发者 |
| 页面组合、状态 | `components/CityCouncilApp.tsx` | 集成人员负责，避免同时修改 |
| URL 与接口 | `app/`、`lib/` | 路由保持轻量；不要把页面 UI 堆进 API |
| 示例记录 | `data/decisions.ts` | 当前 ID 与数组位置对应，只追加；重排需同步迁移 ID 和收藏 |

新增样式放在自己的模块里；全局主题 `app/globals.css`、依赖清单、锁文件和共享类型由集成人员协调。不要把 `.env.local`、`node_modules`、`.next` 上传。不要手改 `next-env.d.ts`。

依赖必须通过 npm 安装，并将 `package.json` 与 `package-lock.json` 一起提交。其他人拉取后用 `npm ci`，不要删除锁文件来解决冲突。运行数据 `data/generated-notices.json` 不作为功能改动提交；当前初始内容是空数组。

## 合并与冲突

发现冲突时先理解双方改动；不要对整个文件盲选 “Accept ours / theirs”。必要时联系该模块负责人。合并最新 main 后，重新运行 `npm run check`，并检查自己改动的页面。

CI 会自动执行类型检查、生产构建、页面/API 冒烟检查。绿色检查不能代替人工检查交互。

## 仓库管理员建议设置

在 GitHub 的 Settings → Rules → Rulesets 为 `main` 配置：要求 Pull Request、至少一人审核、要求 `Typecheck, build and smoke tests` 成功、禁止强制推送和删除 main。首次 CI 运行后选择对应检查名称。

这些是需要管理员启用的 GitHub 设置；仓库里的工作流和文档本身不会阻止直接推送。

统一格式：改动后运行 `npm run format`。CI 会检查这些模块的格式，避免同一文件出现大量无意义的排版冲突。
