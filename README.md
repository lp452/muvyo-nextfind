# muvyo-addon-nextfind

给 [Muvyo](https://github.com/thsrite/muvyo-addon-guide) 写的第三方插件：**NextFind 影巢**。
把 Muvyo 的资源搜索 / 订阅 / 机器人搜索接到你自己部署的 NextFind 上，顺带做影巢（HDHive）每日签到。

## 安装

Muvyo → 设置中心 → 插件 → 第三方插件 → 插件仓库，填：

```
https://github.com/lp452/muvyo-nextfind
```

## 目录

```
muvyo-nextfind/
  src/lp452.nextfind/         插件源码（发布时不要提交）
    manifest.json
    main.js
    README.md
  test/                     本地调试（Node + 模拟 mv 层，直连真实 NextFind）
    mv-shim.js
    run.js
```

## 改 ID

`manifest.json` 里的 `id` 必须以你领取作者证书用的 **GitHub 用户名（小写）** 开头。
现在写的是 `lp452.nextfind`，把 `luo` 换成你的用户名，同时把 `src/` 下的目录名一起改掉。

## 本地调试

`test/mv-shim.js` 用 curl 实现了沙箱里的同步 `mv.fetch`，所以可以直接在 Node 里跑真代码、连真服务器：

```bash
NF_SERVICE=http://192.168.1.21:8092 NF_USER=你的账号 NF_PASS=你的密码 node test/run.js all
```

可选子命令：`search` / `account` / `checkin` / `resolveauto`（默认 `all`）。
`resolveauto` 会拿一条已在 NextFind 里解锁过的资源去换链接，不会额外扣积分。

## 签名字段

插件目录里只能有 `manifest.json`、`main.js`（文件名由 `entry` 决定）、`README.md`，
放多了签名脚本会拦下来。图标要加的话再放一个 `icon.png`（≤256 KiB，≤1024px）并在 manifest 里声明 `"icon": "icon.png"`。

## 签名与发布

需要你自己的 `muvyo-signing.json`（在 Muvyo「插件 → 第三方插件 → 开发者 → 用 GitHub 账号领取证书」下载）和同页的 `mv_addon.py`：

```bash
pip install cryptography
python3 mv_addon.py sign ./src/lp452.nextfind -o .
python3 mv_addon.py verify ./plugins/lp452.nextfind
```

生成 `index.json` 和 `plugins/lp452.nextfind/`（加密后的入口 + manifest + 签名）。
按官方 `docs/publishing.md` 生成 `index.json.sig` 后，只提交 `index.json`、`index.json.sig`、`plugins/`，**不要提交 `src/`**。

## 插件用到的 NextFind 接口

| 用途 | 接口 |
|---|---|
| 登录 | `POST /api/admin/login` → `nextmedia_session` |
| 关键词找 TMDB | `GET /api/search?query=&type=&year=&page=&page_size=`（SSE，首帧 `type=initial`） |
| 资源列表 | `GET /api/resources?type=&tmdb_id=&title=`（SSE） |
| 解锁 / 换链接 | `POST /api/hdhive/unlock` |
| 影巢状态与积分 | `POST /api/system/hdhive/check` |
| 影巢签到 | `POST /api/hdhive/checkin` |

`tmdb_id`、`year` 在解锁接口里必须是**字符串**，传数字会 422。
