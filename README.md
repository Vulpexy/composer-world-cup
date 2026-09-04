# 大师对位 · MusiCup

“大师对位 · MusiCup”是一款古典作曲家世界杯互动选择游戏。项目提供 61 位候选作曲家，玩家既可以直接使用系统默认的 48 人名单，也可以自行组成 48 人参赛阵容；通过小组赛、复活赛和淘汰赛，最终产生自己心目中的冠军。

## 在线体验

[开始“大师对位 · MusiCup”](https://vulpexy.github.io/composer-world-cup/)

[Play in English](https://vulpexy.github.io/composer-world-cup/?lang=en)

[International sharing and operations guide](./INTERNATIONAL-LAUNCH.md)

页面右上角可以随时切换中文与 English，语言选择会保存在浏览器中；两种语言共用同一比赛和匿名统计池。

## 比赛流程

1. **选择参赛名单**：从 61 位候选作曲家中选出 48 位。玩家可以直接使用默认名单，也可以取消默认选手、加入扩展候选，组成自己的 48 人阵容。
2. **十二音级抽签**：48 位参赛者随机进入 12 个以十二平均律音级命名的小组，每组 4 人。玩家可以重新抽签，确认后进入小组赛。
3. **小组赛**：每组同时展示 4 位作曲家，玩家直接选择其中 2 位晋级。点击卡片可以选择或取消；卡片可翻到背面查看三部代表作并试听 30 秒片段。
4. **复活赛**：12 个小组共产生 24 位直接晋级者。玩家再从被淘汰的 24 位作曲家中选择 8 位复活，组成完整的 32 强。
5. **32 强抽签**：24 位小组晋级者与 8 位复活者随机落入固定淘汰赛签表。签表生成后，胜者沿既定路线继续晋级，不会在每轮重新抽签。
6. **淘汰赛**：依次进行 32 强赛、16 强赛、四分之一决赛、半决赛和决赛。每场比较两位作曲家，点击卡片选择晋级者，也可以翻面试听代表作。
7. **修改选择**：淘汰赛阶段提供“回到上一步”，可以撤销最近一场选择，减少误触对结果的影响。
8. **最终结果**：决赛结束后展示冠军、亚军、四强和完整晋级签表。玩家可以下载包含对阵框线与晋级路线的高清结果图片。
9. **结果统计**：完成比赛后，冠军、亚军和四强以匿名方式进入全站汇总，并显示冠军、亚军、四强排行榜以及本届冠军与其他玩家选择的重合度。
10. **自愿记名**：玩家可以选择填写昵称并明确勾选同意，保存昵称与本届完整签表；也可以随时撤回具名记录。

## 主要功能

- 61 位候选作曲家与自选 48 人参赛功能
- 作曲家的中英文姓名、肖像、生卒年份、国家、时期和简介
- 中英文代表作及 30 秒在线试听
- 简介／代表作翻面卡片与直接点击选择
- 十二音级随机分组、小组赛、复活赛和完整淘汰赛
- 淘汰赛撤销上一步
- 浏览器自动保存比赛进度
- 桌面端与移动端自适应布局
- 带完整晋级连线的赛果图片下载
- 全站匿名结果统计与冠军、亚军、四强排行
- 可撤回的自愿记名结果

## 本地运行

```bash
npm install
npm run dev
```

## 数据与音频

作曲家资料主要依据公开百科资料重新概述。肖像来自 Wikipedia / Wikimedia Commons；每张肖像旁的来源按钮可前往对应页面核验作者、版权状态和许可条件。

网站优先匹配 Wikimedia Commons 中明确标记为公有领域、CC0、CC BY、CC BY-SA 或 EFF Open Audio License 的录音，并在曲目旁显示表演者与许可。部分尚无合适开放录音的曲目使用 Apple Music / iTunes 商店试听：只进行在线流式播放，不把音频文件存入仓库或提供下载；曲目旁保留对应商店链接，并标注“Provided courtesy of iTunes”。第三方内容可能因地区、目录或授权变化而不可用。

古典作品的乐谱进入公有领域，不代表现代演奏录音也自动进入公有领域。素材权利仍归原作者、表演者、录音制作者或相应权利人所有。发现曲目匹配、署名或授权问题时，请通过 [GitHub Issues](https://github.com/Vulpexy/composer-world-cup/issues) 联系维护者，以便核验、更正或移除。

## 隐私

比赛进度保存在玩家自己的浏览器中，不建立用户账户。完成一届比赛后，系统会上传一个随机结果编号以及冠军、亚军和四强，用于匿名汇总统计；不上传浏览器中途选择、联系方式或真实身份。

昵称与完整淘汰赛签表只会在玩家主动填写昵称并勾选同意后保存。昵称不会出现在公开排行榜中，具名资料最多保留一年；玩家可以在结果页撤回昵称和完整签表，匿名名次仍保留在汇总中以维持统计准确性。留言仅供管理员阅读。请勿在昵称或留言中填写真实姓名、电话、邮箱等个人信息。托管服务可能为安全和运行需要生成常规访问日志。

## 独立项目声明

MusiCup 是免费、非商业的音乐鉴赏互动项目，与 FIFA、Apple、Wikimedia、作曲家遗产管理机构、表演者或唱片公司不存在隶属、授权、赞助或背书关系。“世界杯”仅用于描述淘汰赛结构。Apple Music / iTunes 商店试听的使用仍受 Apple 相关条款约束；Wikimedia Commons 素材的使用以各文件页面列明的许可为准。

## English summary

MusiCup is a free, non-commercial Classical Composer World Cup. Choose 48 from 61 composers, compare four at a time in twelve pitch-named groups, revive eight eliminated favourites, then play through a fixed Round-of-32 bracket. The interface, composer cards, audio errors, results, privacy notice, and downloadable bracket are available in English through `?lang=en`.

The project prioritises public-domain and openly licensed Wikimedia Commons recordings with visible attribution. Some works currently use streamed Apple Music / iTunes store previews, marked “Provided courtesy of iTunes” and linked to their store pages. No preview audio files are distributed from this repository. MusiCup is independent and is not affiliated with or endorsed by FIFA, Apple, Wikimedia, performers, labels, or composer estates.

## 管理员数据页

项目维护者可访问 `/admin/`，使用托管环境中配置的管理密码进入后台。管理页支持：

- 查看完整结果总数、自愿记名数和当前筛选条数
- 查看匿名冠军、亚军和四强结果
- 只显示自愿记名记录或按昵称搜索
- 查看具名玩家主动提交的完整淘汰赛签表
- 将当前筛选结果导出为 UTF-8 CSV

管理员数据页受独立密码保护，管理凭据不会包含在公开仓库或网页代码中。

## 致谢

本项目的比赛结构、选择方式与互动构思参考了以下两个项目，并在此基础上改编为古典音乐主题：

- [诗经世界杯（shijing-world-cup）](https://github.com/lufeng2985/shijing-world-cup)
- [中国古代诗人世界杯（poet-world-cup）](https://github.com/lufeng2985/poet-world-cup)

感谢原项目作者公开项目文件与设计思路，为本项目的分组、对战、晋级和结果展示提供了重要参考。


