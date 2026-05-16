## 2026-05-16 签到命令维护记录

追加签到 adapter：
- `checkin` 默认调用 `/api/home/sign/signRewardList` 和 `/api/home/sign/mySignLog?month=YYYY-MM` 查看签到奖励/日志；`--action sign` 显式调用 `POST /api/home/sign/signIn` 执行每日签到；需要登录态 cookie，未登录接口返回 `code=10403`。
- 未实现累计奖励领取 `POST /api/home/sign/getSignReward`，因为这不是每日签到，而是领取 10/20/28 天等奖励；如后续增加，应单独显式 action。
- 公开参考：GitHub 上 FF14CN/Sarean-arsenal 与 StarHeartHunt/ff14risingstone_sign_task 提供签到奖励/日志/每日签到接口线索。

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
