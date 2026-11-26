# 脆皮捏捏 直播计算器

<img src="icons/logo.png" alt="logo" width="240">

抖音直播间结账用的 H5 + PWA 计算器，纯静态文件，数据保存在浏览器本地存储（localStorage）。

## 本地运行

```bash
cd PATH
python3 -m http.server 8000
```

浏览器打开 http://localhost:8000。

- 看手机效果：开发者工具（F12）里按 Cmd+Shift+M 切换到手机模式。
- 真机预览：同一 Wi-Fi 下访问 `http://电脑局域网IP:8000`。Service Worker 和「添加到主屏幕」只在 HTTPS 或 localhost 下生效，这两项需部署后测试。
- 改了代码后页面没更新：强制刷新（Cmd+Shift+R），或在开发者工具 Application 面板勾选 "Update on reload"。每次改动静态资源时，同步提高 `sw.js` 里的 `CACHE` 版本号。

## 部署到 Cloudflare Pages

1. 把仓库推送到 GitHub。
2. Cloudflare Pages 新建项目并连接该仓库。
3. 框架预设选「None」，构建命令留空，输出目录填 `/`。
4. 部署后用手机打开，选择「添加到主屏幕」即可作为 App 使用。

## 使用说明

- 设置页：按序号区间批量设置价格和库存，价格只能是整数，库存留空表示不限。
- 结账页：点商品加一份，点左上角 `−` 减一份；金额满 100 自动点亮「每满100 -5」；拍了麦序 -20、灯牌 -1 手动点选。
- 「完成，下一单」会把本单计入已售；超过库存的商品按钮变灰，但仍可选择。
- 「新场次（清空）」清空所有商品、库存和已售记录。
