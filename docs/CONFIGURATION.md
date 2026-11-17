# 配置与目录说明

## 自部署环境变量

这些值由 `setup-selfhost.mjs` 写进未跟踪的 `.env`，供 `compose.selfhost.yml` 使用。

| 变量 | 含义 | 修改规则 |
| --- | --- | --- |
| `COMPOSE_PROJECT_NAME` | Compose 项目及卷名前缀 | 首次确定后保持不变；另开实例/隔离恢复才使用新名字 |
| `SITE_ORIGIN` | 对外访问的 http(s) origin | 不带 `/api` 等路径；改址须同步后台 URL 和前端构建 |
| `WEB_BIND_ADDRESS` | 宿主机监听地址 | IP 直连用 `0.0.0.0`；宿主机 TLS 反代用 `127.0.0.1` |
| `WEB_PORT` | 宿主机外部 HTTP 端口 | 默认 18080；与现有站点冲突就换新站端口 |
| `POSTGRES_PASSWORD` | 本项目 mx_blog 用户的数据库密码 | 初始化后不要重生成；必须与已有库匹配 |
| `JWT_SECRET` | 后台认证签名密钥 | 备份并保留；不能随前端更新更换 |
| `MX_ENCRYPT_KEY` | Mix Space 加密密钥 | 必须与数据库和上传数据配套保留 |

`.env.selfhost.example` 是格式参考；根目录 `.env.example` 是早期手工部署的最小格式。不要把两个格式混用为现有数据库生成另一套密钥。

## 容器与数据卷

| 服务 | 职责 | 数据/端口 |
| --- | --- | --- |
| `web` | Nginx 静态前端与路由反代 | 唯一对外端口，默认 18080 |
| `sitemap` | 动态 XML sitemap、HTTP 后台 cookie 兼容网关 | 内网 8080，无持久内容数据 |
| `mx-core` | Mix Space v13.20.0 API 与官方后台 | 内网 2333，`mx-assets` 卷 |
| `migrate` | 一次性数据库迁移 | 成功退出 0，不对外服务 |
| `postgres` | 博客内容/账号数据库 | 内网 5432，`postgres-data` 卷 |
| `redis` | 缓存、会话等 | 内网 6379，`redis-data` 卷 |

项目名为 `letterspace-selfhost` 时，数据卷为 `letterspace-selfhost_postgres-data`、`letterspace-selfhost_redis-data`、`letterspace-selfhost_mx-assets`。配置没有使用原站的容器名或外部数据卷。

## 路由与后台内容映射

| 前台路由 | 内容来源 |
| --- | --- |
| `/`、`/posts` | 公开文章与分类 |
| `/posts/:category/:slug` | 标准文章详情；兼容 `/posts/:slug` |
| `/notes`、`/notes/:nid` | 公开手记；兼容日期/slug 路径 |
| `/timeline` | 分页完整获取的公开文章/手记 |
| `/search?q=...` | Mix Space 后端搜索 |
| `/friends`、`/projects` | 后台友链/项目 |
| `/about` | slug 为 about 的独立页面 |
| `/:slug` | 其他独立页面 |
| `/feed`、`/atom.xml` | 后端 RSS；后者也是 RSS 格式 |
| `/sitemap.xml` | 网关从公开分页 API 生成 XML |
| `/proxy/qaqdmin` | 固定后端镜像附带的官方管理面板 |

前台公共 API 使用 `credentials: omit`，登录后台不会提升前台列表访问权限。网关只在 `SITE_ORIGIN` 为 HTTP 时转换固定版本 Better Auth 的 Secure cookie 名称，保留 HttpOnly、SameSite、签名和 Origin 校验；HTTPS 下不转换。

## 源码目录

```text
src/main.jsx              页面、路由、公共 API 使用
src/Content.jsx           正文渲染与净化
src/Motion.jsx            滚动显现、数字动画、导航高亮、阅读进度
src/styles.css            布局与明暗主题
src/motion.css            动效时长、缓动、减少动态效果规则
deploy/Dockerfile         新部署使用的前端多阶段构建
deploy/nginx.conf.template 通过 SITE_ORIGIN 生成新实例 Nginx 配置
compose.selfhost.yml      新部署的独立完整 Compose 栈
scripts/setup-selfhost.mjs 只创建一次 .env
scripts/configure-fresh.mjs 仅给未初始化数据库配置站点 URL
docs/                    部署与运维文档
.cache/                  只在本机使用，Git 和 Docker 构建均忽略
```

## 开发/验收变量

| 变量 | 用途 |
| --- | --- |
| `BLOG_ORIGIN` | 本地 Vite API 代理目标，或验收脚本的站点地址 |
| `BLOG_LOCAL_ADDRESS` | 可选的请求源网卡 IPv4，用于排查本机代理问题；不修改系统代理 |
| `BLOG_CREDENTIALS_FILE` | 测试账号文件路径；不设置时用 `.cache/owner-credentials.txt` |
| `PLAYWRIGHT_MODULE` | 已安装 Playwright 模块的绝对路径 |
| `EDGE_PATH` | 浏览器可执行文件路径 |

测试账号文件格式：

```text
username: YOUR_TEST_USERNAME
email: YOUR_TEST_EMAIL
password: YOUR_TEST_PASSWORD
```

不要把实际值写进本文档；把文件放在 `.cache` 中。浏览器验收会创建临时内容，应只对自己的测试实例运行。

## 关于保留的旧部署文件

根目录 `docker-compose.yml`、`nginx.conf`、`Dockerfile` 和两个 `deploy*.sh` 保留了首次实例的部署方式，用来维护该实例。新部署不要修改它们后猜测哪些地址需要替换，直接使用 `compose.selfhost.yml` 和 `deploy/` 下的模板。

仓库没有真实 `.env`、管理员密码、数据库、上传文件、SSH 私钥、GitHub token、浏览器 profile、截图或缓存。克隆源码不会创建管理员；首次账号在你自己的后台向导中设置。
