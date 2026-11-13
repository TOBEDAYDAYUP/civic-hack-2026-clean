# 多人协作与 AI 开发流程

推荐使用分支。一个小任务一个短期分支；任务完成后通过 PR 合入 main。main 是团队共同运行的稳定版本。分支用于隔离尚未完成的修改，PR 用于检查修改如何整合。

不要给每个人建一个长期分支并各自维护整套网站。先分配任务和模块，例如“一人改地图，一人改公告卡片”；如果两人都需要改公共文件，先协调修改顺序。由一名指定的集成人员逐个合并 PR。

## 第一次下载

安装 Git、Node.js 22，在 VS Code 的终端运行：

```sh
git clone https://github.com/TOBEDAYDAYUP/civic-hack-2026-clean.git
cd civic-hack-2026-clean
cp .env.local.example .env.local
# 先填写团队提供的公开 URL 和 publishable key
npm ci
npm run dev
```

打开终端显示的 localhost 地址。普通浏览无需管理员数据库密钥。

## 开始一个任务

先检查当前目录、分支和未提交修改：

```sh
git status --short --branch
```

如果有未提交修改，先确认属于谁、如何保留；不要删除或覆盖。工作区干净后：

```sh
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c fix/notice-address
```

最后一行是示例，换成你的任务名。新功能用 `feat/`，修复用 `fix/`，文档用 `docs/`。每个任务使用一个独立且简短的名字。

## 修改与提交

只改本次负责的模块，目录分工见 CONTRIBUTING.md。代码改动完成后：

```sh
npm run format
npm run check
git diff
```

确认没有无关修改、凭据、生成数据，再逐个添加自己的文件。例如：

```sh
git add features/notices/NoticeFeed.tsx features/notices/notices.css
git diff --cached
git commit -m "Improve notice card layout"
git push -u origin fix/notice-address
```

上面的文件和分支名都是例子，需要与你的任务一致。纯文档改动检查命令、链接以及 `git diff --check` 即可。

## 提交 Pull Request

到 GitHub 仓库，点击任务分支对应的 **Compare & pull request**：base 选择 `main`，compare 选择自己的任务分支。填写问题、修改后的行为、验证结果；UI 改动附截图，并请一位队友审核。

集成人员确认 CI 通过、页面行为正确、冲突已解决后，逐个使用 **Squash and merge**。任务作者默认不自行合并。不要把失败的 CI 当作“别人的问题”绕过。

合并完成后，可在 GitHub 删除已合并的任务分支。开始下一项任务时重新从最新 main 创建分支。

## main 在你开发时更新了

先提交或妥善保留自己的修改，然后在自己的任务分支执行：

```sh
git fetch origin
git merge origin/main
```

有冲突时逐段理解双方意图，不要对整份文件盲选 Accept ours / theirs。无法判断时联系该模块负责人。如果要退出尚未完成的这次合并，可以运行 `git merge --abort`。

解决冲突后，把明确解决的文件加入暂存并完成合并提交，再运行 `npm run check`，然后正常推送自己的任务分支。无需 force push。

推送被拒绝时先核对远程改动；不要运行 `git push --force`、`git reset --hard` 或删除文件来“修好”。

## 可以直接发给其他 AI 的任务说明

> 请先阅读仓库根目录 AGENTS.md、CONTRIBUTING.md 和 docs/GIT-WORKFLOW.md。先检查当前分支与未提交修改。从最新 origin/main 创建本任务的短期分支，仅修改我指定的模块。保留已有改动，不要直接推 main，不要强制推送。完成代码修改后运行 npm run format 和 npm run check，检查暂存内容，只推任务分支并创建 PR。报告实际验证结果和未解决问题，等待指定集成人员审核合并。

AGENTS.md 是给支持该约定的 AI 工具读取的仓库指令。不同工具可能不会自动读取，所以首次发任务时也应附上这段说明。文档不能保证每个 AI 都会遵守；GitHub 的 main 保护规则才是强制约束。

## main 保护设置（管理员）

在 GitHub **Settings → Rules → Rulesets** 中针对 main 设置：要求 PR、至少一位审核者、要求 `Typecheck, build and smoke tests` 成功、禁止强制推送与删除 main。此文档不代表这些设置已经启用。管理员明确要求的紧急例外仅对该次任务有效。
