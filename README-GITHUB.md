# 古典音乐作曲家世界杯

这是“古典音乐作曲家世界杯”的项目源码备份，可上传到 GitHub 保存、协作和继续开发。

## 上传到 GitHub

1. 登录 GitHub，点击右上角 `+`，选择 **New repository**。
2. 仓库名称可填写 `composer-world-cup`，选择 Public 或 Private，然后点击 **Create repository**。
3. 解压 `composer-world-cup-github.zip`。
4. 在新仓库页面点击 **uploading an existing file**，将解压后的项目文件拖入上传区域。
5. 在页面底部填写说明（例如 `Initial project upload`），点击 **Commit changes**。

注意：请上传解压后的文件和文件夹，不要直接上传 ZIP；否则 GitHub 只会保存压缩包，无法浏览源码。

## 本地开发

项目使用 React、TypeScript 和 Vinext。安装 Node.js 后，在项目目录运行：

```bash
npm install
npm run dev
```

随后按终端提示打开本地网址。

## 关于 HTML 文件

`composer-world-cup.html` 是当前已部署版本的浏览入口，双击即可打开，但需要联网访问当前站点。试听音频和维基百科肖像本身也依赖第三方在线资源。

## 发布网页

当前源码包含服务端构建配置，不能仅通过 GitHub Pages 的“Deploy from a branch”直接运行。可将 GitHub 仓库连接到支持 Node.js 构建的平台，或继续使用当前的 Sites 部署流程。若以后生成纯静态版本，再把静态 `index.html` 和资源目录发布到 GitHub Pages。
