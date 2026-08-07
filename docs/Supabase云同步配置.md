# Supabase 云同步配置

本项目保持为纯静态网页，页面可继续部署在 GitHub Pages。Supabase 负责邮箱账号、云数据库和跨设备同步。

## 1. 创建 Supabase 项目

1. 登录 Supabase 并创建一个新项目。
2. 打开项目的 SQL Editor。
3. 运行项目内的 `supabase/schema.sql`。

该脚本会创建 `user_workbench` 表、启用数据库服务器时间戳、开启 Row Level Security，并确保每个账号只能读取和修改自己的数据。已有项目也需要重新运行最新版脚本，以安装更新时间触发器。

## 2. 填写网页配置

在 Supabase 项目设置的 API 页面找到：

- Project URL
- anon public key

打开项目根目录的 `supabase-config.js`：

```js
window.SUPABASE_CONFIG = {
  url: "https://你的项目编号.supabase.co",
  anonKey: "你的 anon public key"
};
```

不要在网页中填写 `service_role` key。浏览器端只能使用 anon public key。

## 3. 配置登录地址

在 Supabase Authentication 的 URL Configuration 中设置：

- Site URL：`https://vapourcoconut-lgtm.github.io/Galaxy/`
- Redirect URLs：加入 `https://vapourcoconut-lgtm.github.io/Galaxy/`

本地测试时可以额外加入本地网页地址。

## 4. 发布到手机可访问的网址

将以下文件同步到 GitHub Pages 仓库的 `main` 分支根目录：

- `index.html`
- `styles.css`
- `app.js`
- `supabase-config.js`
- `service-worker.js`
- `manifest.webmanifest`
- `assets/`

发布后手机打开：

`https://vapourcoconut-lgtm.github.io/Galaxy/`

登录同一邮箱账号后，系统会自动比较本机与云端修改时间，并同步较新的数据。

## 5. 同步规则

- 未登录：数据继续保存在当前设备浏览器。
- 首次登录且云端为空：自动上传当前设备数据。
- 云端已有数据：比较修改时间，使用较新的版本。
- 在线编辑：约 1.2 秒后自动上传。
- 从后台回到页面或恢复网络：再次检查云端。
- 账号中心提供“云端覆盖本机”和“本机覆盖云端”两个手动恢复入口。

由于当前版本采用整份工作台状态同步，多台设备同时编辑时以最后完成同步的版本为准。重要操作前可在设置页导出 JSON 备份。
