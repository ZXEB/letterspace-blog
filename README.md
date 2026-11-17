# Letterspace · 纸间

一个使用 React、Vite 和真实 Mix Space 后台的独立个人博客。界面采用留白、悬浮导航、文章/手记双栏和月份时间线，并提供首屏入场、导航滑动高亮、滚动显现和明暗主题过渡。

这是独立实现，不包含 Yohaku 闭源 Web 源码，也不承诺逐像素一致。Mix Space、官方管理面板和其他依赖分别遵循各自上游许可。

## 文档入口

- **第一次自己部署：[详细部署教程](docs/DEPLOYMENT.md)**
- **备份、恢复、更新、域名切换：[运维说明](docs/OPERATIONS.md)**
- **环境变量、目录和部署方式区别：[配置说明](docs/CONFIGURATION.md)**
- 历史前台/后台验收：[ACCEPTANCE.md](ACCEPTANCE.md)

## 功能

首页、分类文章列表与正文、手记、时间线、后端搜索、友链、项目、About 与其他独立页面、明暗/系统主题、手机导航、RSS、动态 sitemap 和基础 SEO。

文章、手记、页面和其他内容由自己的 Mix Space 管理，不使用原参考站的数据。支持 Markdown 和官方富文本编辑器的 Markdown 导出正文；常规 Lexical 节点有回退渲染。特殊图表、交互嵌入没有逐项实现。前端为 SPA，不是完整 SSR。

## 新服务器快速部署

先按详细教程安装 Docker Engine 与 Compose 插件，并克隆本仓库。以下命令针对**全新目录和全新独立数据卷**；不要在已经运行的博客目录重新生成配置。

```sh
git clone https://github.com/ZXEB/letterspace-blog.git
cd letterspace-blog

# 把地址换成你自己的 IP/端口；该命令只会创建一次 .env。
docker run --rm --user "$(id -u):$(id -g)" \
  -v "$PWD:/workspace" -w /workspace node:22-alpine \
  node scripts/setup-selfhost.mjs --origin http://YOUR_SERVER_IP:18080

docker compose --env-file .env -f compose.selfhost.yml up -d --build

# 等 /api/v3/ping 返回 pong 后，仅给尚未初始化的新数据库配置 URL。
docker run --rm --network host --user "$(id -u):$(id -g)" \
  -v "$PWD:/workspace" -w /workspace node:22-alpine \
  node scripts/configure-fresh.mjs
```

然后访问 `http://你的IP:18080/proxy/qaqdmin#/setup`，在官方面板中创建**你自己的**管理员和密码。仓库没有预置管理员密码；已有服务器的账号、文章、数据库、上传文件和密钥不在仓库中。

仓库为私有时，克隆需要你的 GitHub 账号权限。首次启动、私有仓库认证、同机并行部署、域名/HTTPS、检查命令和常见错误均见 [完整教程](docs/DEPLOYMENT.md)。

## 部署文件怎么选

| 文件 | 用途 |
| --- | --- |
| `compose.selfhost.yml` + `deploy/Dockerfile` | 新部署推荐；容器内构建前端，URL/端口/项目名从 `.env` 读取 |
| `docker-compose.yml` + `nginx.conf` | 最初已运行实例的保留配置，含该实例的固定地址；不是新服务器模板 |
| `scripts/deploy-frontend.sh`、`scripts/deploy.sh` | 原实例的打包更新脚本；不要拿它们给新实例做首次安装 |

新部署统一使用 `docker compose --env-file .env -f compose.selfhost.yml ...`，避免误调用保留的旧配置。

后端固定为 Mix Space v13.20.0：

```text
innei/mx-server@sha256:b1c726bee1b55a6649df632ff7e37f5595d533193365e3aef48ff792d327a3ad
```

## 本地开发

需要 Node.js 22.13+、pnpm 11.25.0。服务端由 Docker 单独运行；设置 `BLOG_ORIGIN` 指向你自己的后端公开地址，Vite 会代理 `/api`。

```sh
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm install --frozen-lockfile --store-dir .cache/pnpm-store
BLOG_ORIGIN=http://localhost:18080 pnpm dev
pnpm build
```

Windows 下将项目与缓存均放 D 盘：

```powershell
$env:TEMP="$PWD\.cache\tmp"
$env:TMP=$env:TEMP
$env:XDG_CACHE_HOME="$PWD\.cache\xdg"
$env:npm_config_cache="$PWD\.cache\npm"
$env:BLOG_ORIGIN='http://你的服务器:18080'
pnpm install --frozen-lockfile --store-dir .cache/pnpm-store
pnpm dev
```

若没有普通 `pnpm`，可使用自己已经安装的 Node/Corepack/pnpm 路径。缓存与浏览器配置均可显式放在项目 `.cache` 内；本项目不要求向 C 盘写入项目文件。

## 检查与测试

```sh
node --test scripts/selfhost.test.mjs
```

该测试验证首次配置创建、随机密钥格式、非法参数拒绝和**已有 `.env` 绝不覆盖**。GitHub Actions 会另外构建镜像、启动隔离 Docker 栈，在临时空数据库中初始化演示内容，并检查 API、后台会话、Feed、sitemap 与地址配置；它不连接任何现有部署。

`scripts/smoke.mjs`、`admin-smoke.mjs` 和 `motion-smoke.mjs` 为浏览器验收脚本。需要 Playwright 与浏览器，并通过 `PLAYWRIGHT_MODULE` / `EDGE_PATH` 指定本机安装；管理相关测试还需在被 Git 忽略的 `.cache/owner-credentials.txt` 中提供自己的测试账号。它们会临时写入/删除测试内容，只应对测试实例或明确授权的站点运行。

## 重要约定

- `.env` 只生成一次；数据库已经初始化后，不能用新密码覆盖旧配置。
- 项目名决定数据卷名。同机多个博客必须使用不同 `COMPOSE_PROJECT_NAME`、目录与外部端口。
- 不执行全局 Docker prune，不删除其他项目的数据卷，不使用 `down -v` 作为修复手段。
- HTTP/IP 的后台 cookie 兼容逻辑只作用于该实例；改为 HTTPS 后自动关闭转换。正式域名配置见运维文档。
- `.env`、令牌、管理员密码、备份、依赖缓存、截图和本机测试配置均不提交 Git。
