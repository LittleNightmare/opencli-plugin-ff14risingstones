## 2026-05-16 登录态命令维护记录

追加登录态 adapter：
- `me` 调用 `/api/home/userInfo/getUserInfo`，读取当前登录角色档案；需要已登录 Chrome，会先打开 `#/me/info`，再在页面上下文用 `fetch(..., credentials: 'include')`。
- `notifications` 调用 `/api/home/sysMsg/getTip`，读取系统消息、@、评论、赞/收藏、招募、新粉丝等未读计数；为避免把消息标为已读，只打开 SPA 根页，不进入 `#/message/*`。
- 未保存账号密码、cookie 或完整私有响应样本；verify 只记录结构/类型/pattern。

## 2026-05-16 公开帖子命令维护记录

为 FF14 国服官方石之家社区创建 `posts` adapter：
- 官方 SPA：`https://ff14risingstones.web.sdo.com/pc/index.html`。
- 公开 API 域名：`https://apiff14risingstones.web.sdo.com/api`，帖子/攻略列表和搜索接口无需登录。
- 未登录会跳转的登录区主要是 `/dynamic`、`/recruit`、`/glamour`、`/message`、`/me`、`/statistics`，本次 adapter 未覆盖这些登录态页面。
