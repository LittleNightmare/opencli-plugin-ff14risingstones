# opencli-plugin-ff14risingstones

FF14 国服石之家社区的 [OpenCLI](https://github.com/jackwener/opencli) 插件，用命令行读取石之家帖子、攻略、当前登录角色档案和未读消息数量。

> 本插件只面向简体中文用户；接口来自国服官方石之家网页端。

## 适合谁用

- 想在命令行里快速搜索石之家帖子或攻略的 FF14 国服玩家。
- 想把石之家角色档案、未读消息接入自己脚本或工作流的用户。
- 已经安装并会基本使用 OpenCLI 的用户。

## 功能

| 命令 | 是否需要登录 | 说明 |
| --- | --- | --- |
| `opencli ff14risingstones posts` | 否 | 查看石之家社区帖子/攻略列表，也可以按关键词搜索。 |
| `opencli ff14risingstones me` | 是 | 查看当前登录账号绑定的角色档案。 |
| `opencli ff14risingstones notifications` | 是 | 查看系统消息、@、评论、赞/收藏、招募、新粉丝等未读数量。 |

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

公开命令 `posts` 不需要登录。

`me` 和 `notifications` 需要浏览器登录态：

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

查看当前登录角色：

```bash
opencli ff14risingstones me -f yaml
```

查看未读消息数量：

```bash
opencli ff14risingstones notifications -f yaml
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

## 常见问题

### 提示需要登录怎么办？

先用 Chrome 登录石之家网页端，并确认网页里能正常打开「我的」页面。登录后重新运行 `me` 或 `notifications`。

### 为什么 `posts` 能用，但 `me` / `notifications` 不行？

`posts` 使用公开接口；`me` 和 `notifications` 读取账号相关信息，需要本机浏览器里已有登录态。

### 会上传我的账号信息吗？

不会。插件只在本机通过 OpenCLI/Chrome 读取石之家网页接口，不会把账号密码、cookie 或私有数据写入仓库。

### 搜索不到内容怎么办？

先尝试减少关键词，或确认石之家网页端本身能搜到对应内容。`posts` 使用石之家公开接口，接口结果会受到官方搜索逻辑影响。

### 返回字段和网页显示不完全一致怎么办？

石之家网页接口可能会调整字段或单位。如果发现明显错位，建议先运行 `opencli ff14risingstones posts --limit 3 -f json` 看输出结构，再提交 issue 或自行修复 adapter。

## 仓库结构

```text
.
├── posts.js                         # 公开帖子/攻略列表与搜索命令
├── me.js                            # 当前登录角色档案命令
├── notifications.js                 # 未读消息计数命令
├── opencli-plugin.json              # OpenCLI 插件元数据
├── package.json                     # npm/开发脚本元数据
├── sites/ff14risingstones/
│   ├── endpoints.json               # 已确认的石之家接口记录
│   ├── notes.md                     # 站点调研和维护记录
│   └── verify/                      # OpenCLI verify 期望文件
└── README.md
```

目前仓库只有 3 个命令，放在根目录最直观；如果后续命令明显变多，可以考虑迁移为 `commands/*.js` 或 `clis/ff14risingstones/*.js` 这类分层结构。

## 开发与验证

```bash
opencli plugin install file:///path/to/opencli-plugin-ff14risingstones
opencli list
opencli ff14risingstones posts --limit 5 -f yaml
opencli ff14risingstones me -f yaml
opencli ff14risingstones notifications -f yaml
```

如果修改了 adapter，建议至少跑一遍对应命令，并使用 OpenCLI verify 检查输出列和 `sites/ff14risingstones/verify/*.json` 中的期望是否一致：

```bash
opencli browser verify ff14risingstones/posts
opencli browser verify ff14risingstones/me
opencli browser verify ff14risingstones/notifications
```

本仓库还提供两个简单的发布前检查脚本：

```bash
npm run check
npm run pack:dry-run
```

## OpenCLI 插件限制与注意事项

这一节会在后续补充 OpenCLI 插件协议、命令注册、浏览器登录态和发布限制等更完整说明。

当前已知的使用层面限制：

- `me` 和 `notifications` 依赖本机 Chrome 登录态，无法在未登录环境中读取账号数据。
- 石之家网页接口如果改版，字段映射可能需要更新。
- 本插件是只读工具，不提供发帖、回复、点赞等写操作。

## 许可证

本项目使用 Apache License 2.0。

简要说明：你可以自由使用、复制、修改、再分发，也可以商用或出售副本；但再分发时需要保留许可证、版权声明和适用的 `NOTICE` 内容。修改过的文件需要显著标明已被修改。如果完整或基本完整地再分发/出售本仓库代码，请明确说明原始软件是免费开源软件，并保留原项目名称、作者/贡献者声明和原仓库地址。

这段说明只是便于阅读的摘要，具体权利和义务以 `LICENSE` 和 `NOTICE` 文件为准。

## 声明

本项目是非官方社区工具，与 SQUARE ENIX、盛趣游戏或石之家官方无隶属关系。请遵守石之家服务条款并合理使用。
