# 队友下载与运行

先安装 Node.js 22 和 Git。第一次下载：

```sh
git clone https://github.com/TOBEDAYDAYUP/civic-hack-2026-clean.git
cd civic-hack-2026-clean
npm ci
npm run dev
```

浏览器打开终端中的 localhost 地址，通常是 http://localhost:3000。下载 ZIP 的同学解压后，在包含 package.json 的目录运行后两条命令即可。

**不需要自己创建数据库或申请 API。** 网站已经提供公告和 Map 接口，大家读取同一个共享 Supabase 项目。启动前的脚本会把 `.env.local.example` 中的公开 URL 和 publishable key 补入本机 `.env.local`。这个文件不提交 GitHub。有效的自定义配置、管理员 Secret Key 和定位服务密钥都不会被覆盖。

后续更新代码时先保存自己的修改，拉取最新 main，再执行 `npm ci` 和 `npm run dev`。旧终端先按 Ctrl+C 停止，不能只刷新浏览器。

如果公告仍为空：

1. 执行 `npm run setup`，然后重新运行 `npm run dev`。
2. 确认没有设置 `NOTICE_DATA_MODE=local`；这是离线测试用的模式。
3. 打开 http://localhost:3000/api/notices?limit=1，查看是否有 `ok:true`。网络或自定义密钥错误仍可能导致接口不可用。
4. 把错误返回发给项目维护者，不要发送 .env.local 的完整内容。

地图底图与公告数据是不同请求；底图可见不代表数据库已经连通。额外的街道定位需要服务器单独配置 Geoapify；普通浏览不需要管理员 Secret Key，也不需要运行 Ollama。
