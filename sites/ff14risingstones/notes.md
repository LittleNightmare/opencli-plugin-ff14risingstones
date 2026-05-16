## 2026-05-16 真实招募命令维护记录

将 `recruit` 从配置字典扩展为真实招募列表/详情 adapter：
- `--view list/detail/config` 分别读取真实招募列表、单条详情和筛选配置字典；默认 `list`。
- 公开验证可用的真实列表/详情：副本 `recruitFbList/getRecruitFbDetail`、萌新 `recruitNeList/getNeDetail`、其他 `recruitOtherList/getOtherDetail`、RP `recruitRpList/getRpDetail`。
- 部队招待 `recruitGuildList/getRecruitGuildDetail` 与网页表现一致需要登录态；当前 `recruit` 是 `Strategy.PUBLIC`/`browser:false`，不会读取 Chrome 登录态，未登录返回 `code=10403/msg=请先登录` 时会转成 `AuthRequiredError`，不伪造空结果。如需部队招待列表，应另做 COOKIE/browser-backed 命令。
- 筛选配置来自 `getJobConfigList`、`styleConfigList`、`getFbConfigList`、`fbLabelList`、`guildLabelList`、`categoryConfigList` 和 `groupAndRole/getAreaAndGroupList`；`--kind area` 会同时输出大区行和服务器行，服务器行 `summary` 中包含 `areaId`/`groupId`。
- 副本招募 API 的 `position` 不是职业 ID；`--job` 不再透传给 API，而是请求最多 50 条后按 `need_job`/`jobInfo` 本地过滤，避免接口返回“位置信息不合法”。
- 外部交叉验证：DIYgod/RSSHub 使用 `getNeDetail`、`getRecruitFbDetail`、`getRecruitGuildDetail` 作为石之家招募详情源，并记录详情路由映射。
- 仍然只读：不发布、更新、删除、打磨或响应招募。

追加 `recruit-guild` 登录态命令：
- OpenCLI 的 `strategy`/`browser` 是按 command 注册，不能只让 `recruit --type guild` 这个参数分支变成 COOKIE；因此保留 `recruit` 为 PUBLIC，新增 `recruit-guild` 使用 `Strategy.COOKIE`/`browser:true`。
- `recruit-guild` 在 `#/recruit/guild` 页面上下文中用 `credentials: include` 调用 `recruitGuildList` 与 `getRecruitGuildDetail`，只读部队招待列表/详情。
- 不保存账号密码、cookie 或原始私有响应；不响应招募、不修改/打磨/下架招募。

## 2026-05-16 招募配置命令维护记录

补齐 `recruit` adapter 暴露与记录：
- `recruit` 调用 `/api/home/recruit/getJobConfigList` 和 `/api/home/recruit/styleConfigList`，读取公开的职业配置与玩法风格配置；无需登录态。
- 输出只包含配置入口与招募页面 URL，不读取具体招募申请，也不提交申请/应募等写操作。
- 本次同步补齐 `index.js` 注册、`npm run check` 覆盖、README 用法和 endpoint inventory。

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
