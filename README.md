# 净值收益看板

这是一个可直接部署到 GitHub Pages 的纯静态网页。页面支持每日净值数据的查看、新增、编辑、删除，并通过浏览器直接调用 GitHub REST API，把数据提交到仓库里的 `data/records.json`。

## 文件

- `index.html`：页面结构
- `styles.css`：响应式样式
- `app.js`：视图、增删改查、GitHub 同步逻辑
- `data/records.json`：净值数据

## 部署到 GitHub Pages

1. 创建一个 GitHub 仓库，例如 `net-worth-pages`。
2. 把本目录下的所有文件放到仓库根目录。
3. 在仓库 `Settings -> Pages` 中选择从 `main` 分支根目录发布。
4. 访问 GitHub Pages URL，例如 `https://你的用户名.github.io/net-worth-pages/`。

## 写入 GitHub 数据

1. 在 GitHub 生成 Fine-grained personal access token。
2. Token 只选择这个仓库。
3. Repository permissions 里把 `Contents` 设置为 `Read and write`。
4. 打开页面，点击 `管理模式`。
5. 填写 Owner、Repository、Branch 和数据路径，数据路径默认是 `data/records.json`。
6. 输入 Token，点击 `从 GitHub 读取`。
7. 新增、编辑或删除每日记录。
8. 点击 `提交到 GitHub`。

Token 不会写入代码，也不会保存到本地存储。页面刷新后需要重新输入。

## 数据隐私

如果 GitHub Pages 仓库是公开仓库，`data/records.json` 也是公开可访问的。没有 Token 的访问者不能提交修改，但可以看到公开数据。
