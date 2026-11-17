# 从零部署到自己的服务器

本教程安装的是一套**全新的、与其他站点隔离的博客**。不是把 GitHub 仓库拉到正在运行的数据库上重新初始化。已有实例的更新、备份和恢复请看 [OPERATIONS.md](OPERATIONS.md)。

## 1. 准备条件

- 一台能运行 Docker 的 Linux 服务器，本项目已在 Ubuntu 24.04 的环境中运行过。
- 可以访问 Docker Hub、npm registry 和 GitHub；固定后端镜像对应 amd64，其他架构请先确认镜像可用性。
- 一个未被占用的外部端口，默认 18080；如果这台服务器已经有其他博客，选另一个端口，例如 18081。
- Docker Engine、Docker Compose 插件和 Git。前端在 Docker 内构建，服务器不必另外安装 Node/pnpm。
- 已有 2GB 内存、1GB Swap 环境能够运行当前实例；构建时内存开销更高。若构建被系统杀死，可在别的机器构建镜像后导入，不要通过停止原有站点腾内存。

下文用 `http://YOUR_SERVER_IP:18080` 作示例，执行前替换成自己的地址。占位符不是可访问的部署地址。

## 2. 检查 Docker，已有就跳过安装

```sh
docker version
docker compose version
```

两条命令正常输出版本就直接进入第 3 步。**如果服务器上已经运行其他 Docker 站点，不要按“清理旧 Docker”教程卸载或升级它。**

空白 Ubuntu 24.04 服务器可按照 [Docker 官方 Ubuntu 安装说明](https://docs.docker.com/engine/install/ubuntu/) 配置 APT 仓库并安装 `docker-ce`、`docker-ce-cli`、`containerd.io`、`docker-buildx-plugin` 和 `docker-compose-plugin`。Git 可独立安装：

```sh
sudo apt-get update
sudo apt-get install -y git ca-certificates curl
```

本文使用有 Docker 权限的用户执行；使用 `sudo docker` 时后续命令保持同一种方式。不要为了方便把 Docker socket 开放给网络。

## 3. 获取公开源码仓库

```sh
sudo mkdir -p /opt/letterspace-selfhost
sudo chown "$(id -u):$(id -g)" /opt/letterspace-selfhost
git clone https://github.com/ZXEB/letterspace-blog.git /opt/letterspace-selfhost
cd /opt/letterspace-selfhost
```

当前仓库公开，克隆不需要登录或 token。只有以后自己把仓库改为私有时，才需要配置对应 GitHub 认证。**不要把 token 写进 clone URL、脚本、README 或提交到仓库。**

也可以在 GitHub 仓库页面选择 Code → Download ZIP，上传到服务器后解压。ZIP 方式没有 Git 历史，后续更新需重新下载并保留 `.env`。

## 4. 选择端口、项目名和访问地址

先检查已有端口和容器：

```sh
ss -ltnp
docker ps --format 'table {{.Names}}\t{{.Ports}}'
docker volume ls --filter label=com.docker.compose.project=letterspace-selfhost
```

如果 `letterspace-selfhost` 已有卷，不能把它当成空白项目重新生成密码。要么找到原实例配置进行恢复，要么为另一个独立博客使用新项目名。

| 场景 | `SITE_ORIGIN` | `WEB_PORT` | `WEB_BIND_ADDRESS` |
| --- | --- | --- | --- |
| 新服务器，IP 直连 | `http://你的IP:18080` | `18080` | `0.0.0.0` |
| 同机另开一套博客 | `http://你的IP:18081` | `18081` | `0.0.0.0` |
| 域名 HTTPS + 宿主机反代 | `https://blog.example.com` | `18080` | `127.0.0.1` |

`SITE_ORIGIN` 是读者在浏览器里看到的完整 origin，包含 http/https 和必要的端口，**不含 `/api`、`/proxy`、其他路径或末尾参数**。

## 5. 只生成一次配置和随机密钥

### 方式 A：不安装 Node，使用一次性 Docker 容器

```sh
docker run --rm --user "$(id -u):$(id -g)" \
  -v "$PWD:/workspace" -w /workspace node:22-alpine \
  node scripts/setup-selfhost.mjs \
  --origin http://YOUR_SERVER_IP:18080 \
  --port 18080 \
  --project letterspace-selfhost
```

这会在当前目录创建 `.env`，生成独立的数据库密码、JWT 密钥和上传加密密钥，不打印它们。文件已经存在时命令会拒绝继续，**不会覆盖旧值**。

同机并行部署的例子：

```sh
docker run --rm --user "$(id -u):$(id -g)" \
  -v "$PWD:/workspace" -w /workspace node:22-alpine \
  node scripts/setup-selfhost.mjs \
  --origin http://YOUR_SERVER_IP:18081 \
  --port 18081 \
  --project my-second-blog
```

必须在另一个新目录执行；不要对原目录重跑命令。上面的项目名会生成 `my-second-blog_postgres-data` 等卷，与其他项目隔离。

### 方式 B：本机已经有 Node 22.13+

```sh
node scripts/setup-selfhost.mjs --origin http://YOUR_SERVER_IP:18080
```

结果和方式 A 一样，二选一即可。`.env.selfhost.example` 用来查阅变量格式，不包含可直接使用的密钥。

## 6. 构建和启动

后续一律使用自部署 Compose 文件：

```sh
docker compose --env-file .env -f compose.selfhost.yml config --quiet
docker compose --env-file .env -f compose.selfhost.yml up -d --build
docker compose --env-file .env -f compose.selfhost.yml ps
```

不要误用根目录保留的 `docker-compose.yml`，它属于早期手工部署实例。

首次执行会下载镜像、安装前端依赖并构建。PostgreSQL 和 Redis 健康后，`migrate` 执行一次数据库迁移，成功退出；随后 API、sitemap/API 网关和前端启动。**`migrate` 显示 Exited (0) 是正常完成，不需要反复重启它。**

检查：

```sh
curl -fsS http://127.0.0.1:18080/health
curl -fsS -A Mozilla/5.0 http://127.0.0.1:18080/api/v3/ping
```

应分别返回 `ok` 和包含 `pong` 的 JSON。改了端口就替换这两条命令中的 18080。API 首次启动可能需要一点时间。

## 7. 配置新数据库的站点地址

服务启动后，执行以下命令。它只接受**尚未创建管理员的全新站点**；检测到已初始化时立即停止，不会重置账号或改写现有设置。

```sh
docker run --rm --network host --user "$(id -u):$(id -g)" \
  -v "$PWD:/workspace" -w /workspace node:22-alpine \
  node scripts/configure-fresh.mjs
```

这里的 `--network host` 适用于本教程的 Linux 服务器；脚本从 `.env` 读取端口，通过本机 HTTP 连接新站，设置 web/server/admin/WebSocket 地址。不会读取或操作其他项目的数据库。

如果你有本机 Node，可直接运行 `node scripts/configure-fresh.mjs`。如果提示 already initialized，说明该数据库已经有账号；不要继续尝试初始化，改用已有密码登录。

## 8. 创建自己的管理员

浏览器打开：

```text
http://你的IP:18080/proxy/qaqdmin#/setup
```

按照官方 Mix Space 设置向导填写自己的用户名、邮箱、显示名称和密码。保存在自己的密码管理器中；本仓库没有默认管理员密码。初始化完成后后台入口为：

```text
http://你的IP:18080/proxy/qaqdmin#/dashboard
```

密码登录页面输入密码后可按 Enter。固定后端版本的 HTTP Secure cookie 兼容由该实例的网关处理；HTTP/IP 和 HTTPS 不能混用为不同登录入口。

如果浏览器打开不了，但本机 curl 正常，检查云厂商入站规则、端口是否正确以及本机代理是否把该 IP 错误送往代理出口。不要把“修改原站 80/443 配置”作为修复新站端口的第一步。

## 9. 发布第一篇文章和 About

1. 在后台新建分类，例如名称“生活随笔”、slug `journal`。
2. 在“写博文”填写标题、正文、分类和 slug，确认发布。
3. 打开前台 `/posts`，点击文章。标准地址为 `/posts/分类slug/文章slug`。
4. 在“独立页面/页面”中新建 About，slug 设置为 `about`，填写介绍并保存。
5. 在“手记”发布公开手记；友链、项目也分别在后台添加。

新站刚初始化时没有文章、手记和 About，是正常的空数据库状态，不会自动复制已有服务器内容。`scripts/bootstrap.mjs` 用于隔离测试环境填充演示内容，日常部署不需要运行。

## 10. 部署验收清单

| 地址/操作 | 应看到什么 |
| --- | --- |
| `/health` | `ok` |
| `/api/v3/ping` | `pong` JSON |
| `/`、`/posts`、`/notes` | 内容加载；空数据库显示空状态 |
| 文章分类/slug 地址 | 正文、标题、列表/代码等格式正确 |
| `/about` | 刚创建的后台 About 正文 |
| `/search` | 提交关键字后显示实际后台结果 |
| `/feed` | RSS XML |
| `/sitemap.xml` | XML，链接属于你的域名/IP |
| 后台登录后刷新 | 会话保留，不跳回登录 |
| 手机菜单、主题按钮 | 正常交互，无横向溢出 |

`/atom.xml` 是该后端的 RSS 兼容别名，返回 RSS 格式，并非单独的 Atom 文档。

## 11. 首次部署失败时怎么查

```sh
docker compose --env-file .env -f compose.selfhost.yml logs --tail=100 migrate
docker compose --env-file .env -f compose.selfhost.yml logs --tail=100 mx-core
docker compose --env-file .env -f compose.selfhost.yml logs --tail=100 web sitemap
```

- **address already in use**：该端口已有服务。保留它，为新站换端口，并同步 `SITE_ORIGIN`。
- **password authentication failed**：配置密码与已有卷不一致。找回对应旧 `.env`；不要删卷，也不要再生成密钥。
- **镜像拉取失败**：检查镜像摘要和网络；不换成不明来源镜像，不升级原站镜像。
- **构建被 Killed / 137**：通常需要查宿主机内存/OOM 日志。可以换构建机器，不要停原站。
- **后台 cookie 不保存**：确认始终使用同一 `SITE_ORIGIN`，新站请求经过自己的网关，并检查是否 HTTP/HTTPS 混用。
- **Feed/sitemap 是旧域名**：检查 `.env` 的 `SITE_ORIGIN` 和后台 URL 设置，按运维文档改址。
- **手记或文章不出现**：先确认后台发布状态、公开时间、是否密码保护，再看 API/前端错误。

已部署成功后，马上按 [运维说明](OPERATIONS.md) 做一份数据库、上传卷和 `.env` 的配套备份。
