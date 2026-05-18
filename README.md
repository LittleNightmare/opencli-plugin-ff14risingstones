# opencli-plugin-ff14risingstones

FF14 国服石之家社区的 [OpenCLI](https://github.com/jackwener/opencli) 插件，用命令行读取石之家帖子、攻略、真实招募列表/详情、当前角色统计总览、幻化数据、当前登录角色档案、未读消息数量和签到记录。

> 本插件只面向简体中文用户；接口来自国服官方石之家网页端。

## 适合谁用

- 想在命令行里快速搜索石之家帖子/攻略，或查看副本、萌新、RP、其他招募信息的 FF14 国服玩家。
- 想把石之家角色档案、未读消息或签到记录接入自己脚本或工作流的用户。
- 已经安装并会基本使用 OpenCLI 的用户。

## 功能

| 命令 | 是否需要登录 | 说明 |
| --- | --- | --- |
| `opencli ff14risingstones posts` | 否 | 查看石之家社区帖子/攻略列表，也可以按关键词搜索。 |
| `opencli ff14risingstones recruit` | 否 | 查看公开真实招募列表/详情，也可查看筛选配置字典；不包含部队招待登录态读取。 |
| `opencli ff14risingstones recruit-guild` | 是 | 查看部队招待列表/详情，需要本机 Chrome 已登录石之家。 |
| `opencli ff14risingstones statistics` | 是 | 查看当前登录角色的石之家统计总览，包含战场、绝境、钓鱼、零式、幻化、蜃景幻界和深层迷宫；也可查看统计页入口。 |
| `opencli ff14risingstones glamour` | 是 | 查看石之家幻化投稿列表/详情，支持筛选、标题搜索和装备搜索。 |
| `opencli ff14risingstones me` | 是 | 查看当前登录账号绑定的角色档案。 |
| `opencli ff14risingstones notifications` | 是 | 查看系统消息、@、评论、赞/收藏、招募、新粉丝等未读数量。 |
| `opencli ff14risingstones checkin` | 是 | 查看签到日志/奖励，或显式执行每日签到。 |

## 安装

### 从 GitHub 安装

```bash
opencli plugin install github:LittleNightmare/opencli-plugin-ff14risingstones
```

### 本地开发安装

如果你是 clone 源码后本地安装，可以使用 `file:///` 路径。下面是示例路径，请按自己的实际目录替换：

```bash
opencli plugin install file:///path/to/opencli-plugin-ff14risingstones
```

Windows 路径示例：

```powershell
opencli plugin install file:///C:/Projects/opencli-plugin-ff14risingstones
```

## 使用前准备

公开命令 `posts` 不需要登录。`recruit` 的副本、萌新、RP、其他招募和配置字典不需要登录；部队招待接口由石之家要求登录，因此单独放在 `recruit-guild` 命令里。

OpenCLI 的 `strategy`/`browser` 是按命令注册的，不是按参数子模式注册。为了避免把公开 `recruit` 整条命令变成登录态命令，本插件保留 `recruit` 为公开命令，另用 `recruit-guild` 读取部队招待。

`recruit-guild`、`statistics`、`glamour`、`me`、`notifications` 和 `checkin` 需要浏览器登录态：

1. 先在 Chrome 中打开 <https://ff14risingstones.web.sdo.com/pc/index.html>。
2. 登录你的盛趣/石之家账号，并确认网页上能看到自己的角色信息。
3. 再运行下面的 OpenCLI 命令。

插件不会保存账号密码、cookie 或完整私有响应；登录态由你本机 Chrome 管理。

## 使用示例

查看社区帖子：

```bash
opencli ff14risingstones posts --kind post --limit 5 -f yaml
```

查看攻略列表：

```bash
opencli ff14risingstones posts --kind strat --limit 5 -f yaml
```

搜索关键词：

```bash
opencli ff14risingstones posts --query 零式 --limit 10 -f yaml
```

查看副本招募列表：

```bash
opencli ff14risingstones recruit --view list --type party --partyType 绝境战 --limit 5 -f yaml
```

按具体副本、队伍构成和团队阵营位置筛选招募：

```bash
opencli ff14risingstones recruit --type party --partyName 巴哈姆特绝境战 --team 满编小队 --sonTeamKey A --sonTeamPosition 7 --limit 5 -f yaml
```

这个例子对应网页端副本招募的高级筛选：`partyName` 限定副本，`team` 限定队伍构成，`sonTeamKey`/`sonTeamPosition` 对应团队阵营里的具体位置。输出里的 `jobs` 会同时展示职业名、`job:<id>` 和 MT/ST/H/D 等队内位置，方便判断招募缺口。

聚合多页后做本地高级筛选：

```bash
opencli ff14risingstones recruit --type party --partyName 巴哈姆特绝境战 --allPages true --job 30 --noDuplicateJobs true --progressText 开荒 --excludeText 代打,老板 --timeStart 20 --timeEnd 24 --timeDays 周一,周三,周五 --limit 10 -f yaml
```

这个例子会先按官方 `count` 自动翻页抓取副本招募，再在本地过滤：保留进度含“开荒”、排除“代打/老板”、活动时间在 20:00-24:00 且匹配指定星期、并且队内位置尚未占用职业 ID `30` 的招募。适合官方接口单页结果太少、但你想按时间和职业缺口继续筛的时候使用。

查看某条招募详情：

```bash
opencli ff14risingstones recruit --view detail --type party --id 50192 -f yaml
```

查看部队招待列表（需要登录）：

```bash
opencli ff14risingstones recruit-guild --view list --query 部队 --limit 5 -f yaml
```

查看部队招待详情（需要登录）：

```bash
opencli ff14risingstones recruit-guild --view detail --id 12345 -f yaml
```

查看招募筛选配置字典：

```bash
opencli ff14risingstones recruit --view config --kind job --query 骑士 -f yaml
```

查看当前角色幻化统计总览：

```bash
opencli ff14risingstones statistics -f yaml
```

查看幻化投稿列表：

```bash
opencli ff14risingstones glamour --view list --limit 20 -f yaml
```

按网页端筛选条件查看幻化投稿：

```bash
opencli ff14risingstones glamour --raceId 6 --gender female --createTime lastWeek --order hottest -f yaml
```

按标题或装备搜索幻化投稿：

```bash
opencli ff14risingstones glamour --query 松石蓝 -f yaml
opencli ff14risingstones glamour --equipment "启示者之杖" -f yaml
```

查看某条幻化投稿详情：

```bash
opencli ff14risingstones glamour --view detail --id 265250 -f yaml
```

当前登录角色的投影外观统计归在 `statistics` 命令：

```bash
opencli ff14risingstones statistics --kind glamour -f yaml
opencli ff14risingstones statistics --view detail --kind glamour -f yaml
```

汇总当前角色所有已有数据的统计总览：

```bash
opencli ff14risingstones statistics --kind all -f yaml
```

查看统计页面入口：

```bash
opencli ff14risingstones statistics --view routes --kind all -f yaml
```

查看更接近网页细项的战场统计：

```bash
opencli ff14risingstones statistics --view detail --kind frontline -f yaml
```

查看当前登录角色：

```bash
opencli ff14risingstones me -f yaml
```

查看未读消息数量：

```bash
opencli ff14risingstones notifications -f yaml
```

查看签到日志：

```bash
opencli ff14risingstones checkin --view log --month 2026-05 -f yaml
```

查看签到奖励列表（只读）：

```bash
opencli ff14risingstones checkin --view rewards -f yaml
```

执行每日签到（会改变账号签到状态）：

```bash
opencli ff14risingstones checkin --action sign -f yaml
```

如果要给脚本处理，也可以输出 JSON：

```bash
opencli ff14risingstones posts --query 零式 --limit 5 -f json
```

## 参数说明

### `posts`

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `--kind` | `post` | 内容类型：`post` 表示社区帖子，`strat` 表示攻略。 |
| `--query` | 空 | 搜索关键词；留空时返回列表页。 |
| `--page` | `1` | 页码，从 1 开始。 |
| `--limit` | `10` | 返回条数，范围为 1 到 50。 |

### `recruit`

默认输出真实招募列表；也可以按 ID 查看单条详情，或查看网页筛选项使用的配置字典。

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `--view` | `list` | 查看内容：`list` 表示真实招募列表，`detail` 表示单条详情，`config` 表示筛选配置字典。 |
| `--type` | `party` | 招募类型：`party` 副本，`beginner` 萌新，`rp` RP，`other` 其他。`guild` 部队接口需要登录态，请使用 `recruit-guild`。 |
| `--id` | `0` | 招募 ID；`--view detail` 时必填。 |
| `--page` | `1` | 页码，从 1 开始；`--view list` 使用。 |
| `--limit` | `10` | 返回条数，范围为 1 到 50；`--view list` 使用。 |
| `--query` | 空 | 关键词；副本匹配副本名，RP 匹配 RP 名称，配置字典做本地过滤。 |
| `--kind` | `all` | `--view config` 使用：`all/job/style/party/label/guildLabel/category/area`。 |
| `--areaId` / `--groupId` | 空 | 目标大区/服务器 ID；可用 `--view config --kind area` 查看大区和服务器行，服务器行的 `summary` 会标出 `areaId` / `groupId`。 |
| `--job` / `--position` | 空 | `--job` 按职业 ID 或职业名在返回的副本招募中本地过滤；可用 `--view config --kind job` 查看。`--position` 是网页副本位置参数，多个用逗号分隔。 |
| `--sonTeamKey` / `--alliance` / `--sonTeamPosition` | 空 | 团队阵营筛选；`sonTeamKey`/`alliance` 通常为 `A/B/C`，`sonTeamPosition` 是该阵营内的位置编号，对应网页端 `team_position` 矩阵。 |
| `--allPages` / `--fetchPageSize` / `--maxPages` | `false` / `100` / `80` | 仅 `party` 使用；`--allPages true` 会从当前 `page` 开始按官方 `count` 自动翻页聚合，再执行本地过滤和 `limit` 截断。 |
| `--labelMode` | `all` | 仅 `party` 本地过滤使用；配合 `--label` 控制标签是全部命中（`all`）还是任一命中（`any`）。数字标签会精确匹配官方 ID；中文标签名属于本地过滤，建议配合 `--allPages true` 使用。 |
| `--progressText` / `--strategyText` / `--excludeText` | 空 | 仅 `party` 本地过滤使用；进度、攻略/要求包含过滤和全局排除关键词，多个关键词用逗号分隔。 |
| `--timeText` / `--timeStart` / `--timeEnd` / `--timeDays` / `--dailyMaxHours` / `--showUnparsedTime` | 空 / 空 / 空 / 空 / 空 / `false` | 仅 `party` 本地时间过滤使用；支持按活动时间文本、小时范围、星期、每日时长筛选。存在时间条件但无法解析时，默认排除，可用 `--showUnparsedTime true` 保留。 |
| `--noDuplicateJobs` | `false` | 仅 `party` 本地过滤使用；配合 `--job` 的职业 ID，排除队内位置已占用相同职业 ID 的招募。 |
| `--partyType` / `--partyName` / `--team` | 空 | 副本类型、副本名、队伍构成筛选。 |
| `--label` / `--style` / `--category` | 空 | 标签、玩法风格、其他招募分类 ID，多个用逗号分隔。 |
| `--identity` / `--rpType` / `--rpStatus` / `--order` | 空 | 萌新和 RP 页面对应的高级筛选项。 |

每行包含：

- `view` / `type` / `rank` / `recruitId`：结果来源、招募类型、列表序号和招募 ID
- `title` / `category` / `author`：标题、分类和发布角色
- `server` / `targetServer`：发布者区服和目标区服
- `summary` / `detail` / `requirements` / `schedule`：摘要、详情正文、招募要求和活动时间
- `tags` / `jobs` / `responseCount` / `updatedTime` / `url`：标签、需求职业/职业 ID/队内位置、响应/收藏数量、更新时间和网页链接

### `recruit-guild`

需要已登录 Chrome。输出石之家部队招待列表或单条详情。

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `--view` | `list` | 查看内容：`list` 表示部队招待列表，`detail` 表示单条详情。 |
| `--id` | `0` | 部队招待 ID；`--view detail` 时必填。 |
| `--page` | `1` | 页码，从 1 开始；`--view list` 使用。 |
| `--limit` | `10` | 返回条数，范围为 1 到 50；`--view list` 使用。 |
| `--query` | 空 | 按部队名称过滤。 |
| `--areaId` / `--groupId` | 空 | 目标大区/服务器 ID；可用 `recruit --view config --kind area` 查看。 |
| `--label` | 空 | 部队标签 ID，多个用逗号分隔；可用 `recruit --view config --kind guildLabel` 查看。 |
| `--activeMemberNum` | 空 | 活跃人数区间，多个用逗号分隔，例如 `1-5,6-20`。 |

输出字段与 `recruit` 的真实招募结果保持一致：`view`、`type`、`recruitId`、`title`、`server`、`targetServer`、`summary`、`detail`、`schedule`、`tags`、`responseCount`、`url` 等。

### `statistics`

需要已登录 Chrome。默认读取当前登录角色的石之家统计总览；如果当前角色在某个统计类型没有数据，单独查询该类型会返回空结果错误，`--kind all` 会跳过无数据类型。

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `--view` | `summary` | 查看内容：`summary` 表示真实统计总览，`detail` 表示网页细项数据，`routes` 表示统计页入口索引。 |
| `--kind` | `glamour` | 统计类型：`all` 全部已有数据，或 `frontline` 战场、`ultimate` 绝境战、`fishing` 钓鱼、`savage` 零式、`glamour` 幻化/武具投影、`occult` 蜃景幻界、`deepdungeon` 深层迷宫。 |
| `--ddType` | `dd4` | 深层迷宫统计使用的类型参数：`dd1/dd2/dd3/dd4`；仅 `--kind deepdungeon` 使用。 |

每行包含：

- `view` / `kind` / `rank`：结果视图、统计类型和序号
- `metric` / `label`：机器可读指标名和中文指标名；`detail` 视图中 `metric` 会带上细项分组和原始字段名，便于追踪网页接口，并会跳过内部角色/用户 ID 字段
- `value` / `unit`：指标值和单位
- `detail` / `updatedTime` / `url`：补充说明、更新时间和石之家统计页面地址

### `glamour`

需要已登录 Chrome。默认读取石之家幻化投稿列表；`--view detail` 可按投稿 ID 查看公开幻化详情和装备清单。当前登录角色的个人投影外观统计请使用 `statistics --kind glamour`。

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `--view` | `list` | 查看内容：`list` 投稿列表、`detail` 投稿详情、`routes` 接口入口索引。 |
| `--id` | `265250` | 幻化投稿 ID；仅 `--view detail` 使用。 |
| `--page` | `1` | 页码，从 1 开始；仅 `--view list` 使用。 |
| `--limit` | `20` | 返回条数，范围为 1 到 100；仅 `--view list` 使用。 |
| `--query` | 空 | 按标题关键词搜索投稿；仅 `--view list` 使用。 |
| `--equipment` | 空 | 按装备名称搜索相关投稿，会尝试网页端装备搜索的前 10 个候选装备 ID；仅 `--view list` 使用。 |
| `--equipmentId` | `0` | 直接按装备 ID 搜索相关投稿；优先级高于 `--equipment`。 |
| `--raceId` | `0` | 按种族 ID 筛选，`0` 表示全部；仅普通列表模式使用。 |
| `--gender` | `all` | 按性别筛选：`all/male/female/1/2`；仅普通列表模式使用。 |
| `--createTime` | `all` | 按发布时间筛选：`all/last24H/lastWeek/lastMonth`；仅普通列表模式使用。 |
| `--order` | `default` | 排序：`default/latest/hottest`；搜索模式下由站点搜索接口决定。 |

每行包含：

- `view` / `rank` / `glamourId`：结果来源、序号和幻化投稿 ID
- `title` / `author` / `characterName` / `server`：投稿标题、作者、角色名和区服
- `races` / `jobs`：适用种族/性别和职业
- `itemId` / `name` / `category`：详情装备行中的物品 ID、装备名和部位；列表行中 `name` 与标题保持一致
- `value` / `unit`：指标值和单位
- `detail` / `imageUrl` / `likeCount` / `favoriteCount` / `createdTime` / `url`：简介、主图、点赞/收藏数、发布时间和网页地址

### `me`

无额外参数。需要已登录 Chrome。常见输出字段包括：

- `characterName`：角色名
- `areaName`：大区
- `groupName`：服务器
- `experience`：经验值
- `followCount` / `fanCount` / `likedCount`：关注、粉丝和获赞数量
- `url`：石之家个人页地址

### `notifications`

无额外参数。需要已登录 Chrome。输出为多行未读计数，每行包含：

- `key`：消息类型的机器可读标识
- `name`：中文消息类型名称
- `count`：未读数量
- `url`：对应页面地址

### `checkin`

需要已登录 Chrome。默认 `--action status` 只查看签到奖励/日志；只有显式传入 `--action sign` 时才会提交每日签到。

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `--action` | `status` | 操作类型：`status` 表示查看状态，`sign` 表示执行每日签到。 |
| `--view` | `rewards` | 查看内容：`rewards` 表示签到奖励，`log` 表示签到日志。 |
| `--month` | 当前月份 | 签到日志月份，格式 `YYYY-MM`；仅 `--view log` 使用。 |

## 常见问题

### 提示需要登录怎么办？

先用 Chrome 登录石之家网页端，并确认网页里能正常打开「我的」页面。登录后重新运行 `recruit-guild`、`statistics`、`me`、`notifications` 或其他需要登录态的命令。

### 为什么 `posts` 能用，但 `me` / `notifications` 不行？

`posts` 和 `recruit` 使用公开接口；`recruit-guild`、`statistics`、`glamour`、`me`、`notifications` 和 `checkin` 读取账号相关信息，需要本机浏览器里已有登录态。

### 会上传我的账号信息吗？

不会。插件只在本机通过 OpenCLI/Chrome 读取石之家网页接口，不会把账号密码、cookie 或私有数据写入仓库。

### 搜索不到内容怎么办？

先尝试减少关键词，或确认石之家网页端本身能搜到对应内容。`posts` 使用石之家公开接口，接口结果会受到官方搜索逻辑影响。

### 返回字段和网页显示不完全一致怎么办？

石之家网页接口可能会调整字段或单位。如果发现明显错位，建议先运行 `opencli ff14risingstones posts --limit 3 -f json` 看输出结构，再提交 issue 或自行修复 adapter。

## 仓库结构

```text
.
├── index.js                         # 插件入口：导入并注册所有命令
├── commands/
│   ├── posts.js                     # 公开帖子/攻略列表与搜索命令
│   ├── recruit.js                   # 真实招募列表/详情与筛选配置命令
│   ├── recruit-guild.js             # 登录态部队招待列表/详情命令
│   ├── statistics.js                 # 登录态当前角色统计总览与统计页入口命令
│   ├── glamour.js                    # 登录态幻化投稿列表/详情、筛选和装备搜索命令
│   ├── me.js                        # 当前登录角色档案命令
│   ├── notifications.js             # 未读消息计数命令
│   └── checkin.js                   # 签到奖励/日志与显式每日签到命令
├── opencli-plugin.json              # OpenCLI 插件元数据
├── package.json                     # npm/开发脚本元数据
├── sites/ff14risingstones/
│   ├── endpoints.json               # 已确认的石之家接口记录
│   ├── notes.md                     # 站点调研和维护记录
│   └── verify/                      # OpenCLI verify 期望文件
└── README.md
```

OpenCLI 插件安装时会在插件根目录扫描 `.js` / `.ts` 命令文件，所以根目录保留 `index.js` 作为发现入口；具体命令实现放在 `commands/` 目录，便于后续继续增加命令或拆分共享工具函数。

## 开发与验证

```bash
opencli plugin install file:///path/to/opencli-plugin-ff14risingstones
opencli list
opencli ff14risingstones posts --limit 5 -f yaml
opencli ff14risingstones recruit --view list --type party --limit 5 -f yaml
opencli ff14risingstones recruit-guild --view list --limit 5 -f yaml
opencli ff14risingstones statistics --kind glamour -f yaml
opencli ff14risingstones glamour --view list --limit 20 -f yaml
opencli ff14risingstones me -f yaml
opencli ff14risingstones notifications -f yaml
opencli ff14risingstones checkin --view log -f yaml
```

如果修改了 adapter，建议至少跑一遍对应命令检查真实输出：

```bash
opencli ff14risingstones posts --limit 3 -f json
opencli ff14risingstones recruit --view detail --type party --id 50192 -f json
opencli ff14risingstones recruit-guild --view detail --id 12345 -f json
opencli ff14risingstones statistics -f json
opencli ff14risingstones statistics --view detail --kind frontline -f json
opencli ff14risingstones glamour --view detail --id 265250 -f json
opencli ff14risingstones statistics --view detail --kind glamour -f json
opencli ff14risingstones checkin --view rewards -f json
```

`sites/ff14risingstones/verify/*.json` 保留为结构化期望文件，方便维护输出列和类型；当前 `opencli browser verify <site>/<command>` 主要面向 `~/.opencli/clis/` 下的本地 adapter，如果要用它验证本仓库命令，需要先按 OpenCLI 的本地 adapter 目录布局同步对应文件。

本仓库还提供两个简单的发布前检查脚本：

```bash
npm run check
npm run pack:dry-run
```

## OpenCLI 插件限制与注意事项

这一节会在后续补充 OpenCLI 插件协议、命令注册、浏览器登录态和发布限制等更完整说明。

当前已知的使用层面限制：

- `statistics`、`glamour`、`me`、`notifications` 和 `checkin` 依赖本机 Chrome 登录态，无法在未登录环境中读取账号数据。
- `recruit` 只读真实招募列表/详情和筛选配置；不发布、修改、删除或响应招募。部队招待列表/详情接口需要登录态，未登录会返回登录提示。
- `recruit-guild` 只读部队招待列表/详情；不响应招募，也不保存账号密码、cookie 或原始私有响应。
- `statistics` 只读当前登录角色统计总览、网页细项统计和统计页入口；不保存账号密码、cookie 或完整私有响应。
- `glamour` 只读幻化投稿列表/详情；不保存账号密码、cookie 或完整私有响应，也不发布、点赞、收藏、举报或修改幻化投稿。
- 石之家网页接口如果改版，字段映射可能需要更新。
- 除 `checkin --action sign` 这个明确签到动作外，本插件不提供发帖、回复、点赞、领取签到累计奖励等写操作。

### 与网页端相比的已知差距

这些差距是当前命令的能力边界说明，不代表所有项目都计划实现：

- `posts`：CLI 覆盖公开帖子/攻略列表与搜索；网页端的发布、回复、点赞、收藏、关注、图片富交互、帖子编辑和个人动态流不在本插件范围内。
- `recruit`：CLI 覆盖公开真实招募列表、详情和筛选配置；网页端的发布招募、响应招募、编辑/删除/刷新招募、富文本展示、图片交互和登录态“我的招募/响应”管理不在 `recruit` 里。
- `recruit-guild`：CLI 覆盖部队招待列表和详情读取；网页端的发布/响应部队招待、成员管理、详情页交互操作和消息跳转不在本插件范围内。
- `statistics`：CLI 当前覆盖当前登录角色的统计总览指标、统计页入口，以及 `detail` 视图中的战场职业/地图、零式开放状态/副本明细/总览细项、钓鱼鱼饵/大鱼/成就、绝境队伍/职业/死亡点/阶段、幻化染剂/单品/套装、新月岛道具/历史/成就/光、深层迷宫道具/历史/死亡点/首次队伍等网页细项接口；网页端的图表渲染、分页交互、下拉筛选、分享卡片/二维码和部分接口字段的中文化展示仍未完整复刻。
- `glamour`：CLI 覆盖幻化投稿列表、网页端种族/性别/发布时间筛选、最新/最热排序、标题搜索、装备搜索和投稿详情装备清单；当前登录角色投影外观统计由 `statistics --kind glamour` 覆盖。网页端的图片预览/导出、收藏夹、点赞、关注、举报、发布/编辑投稿和部分物品/染剂展示仍未完整复刻。
- `me`：CLI 覆盖当前登录角色基础档案；网页端的头像/装扮展示、角色切换弹窗、关注/粉丝列表、个人主页动态、隐私设置和账号绑定管理不在当前输出里。
- `notifications`：CLI 只读未读计数，并刻意不进入消息详情页；网页端的消息详情、已读状态变更、回复跳转、系统消息正文和我的招募/响应详情没有读取，以避免误触发状态变化。
- `checkin`：CLI 覆盖签到状态、奖励/日志读取，以及显式 `--action sign` 每日签到；网页端的累计奖励领取、活动页富展示和其他活动交互不在当前命令里。

## 许可证

本项目使用 Apache License 2.0。

简要说明：你可以自由使用、复制、修改、再分发，也可以商用或出售副本；但再分发时需要保留许可证、版权声明和适用的 `NOTICE` 内容。修改过的文件需要显著标明已被修改。如果完整或基本完整地再分发/出售本仓库代码，请明确说明原始软件是免费开源软件，并保留原项目名称、作者/贡献者声明和原仓库地址。

这段说明只是便于阅读的摘要，具体权利和义务以 `LICENSE` 和 `NOTICE` 文件为准。

## 声明

本项目是非官方社区工具，与 SQUARE ENIX、盛趣游戏或石之家官方无隶属关系。请遵守石之家服务条款并合理使用。
