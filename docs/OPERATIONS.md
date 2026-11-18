# 日常运维：写作、备份、更新与恢复

本文件针对 `compose.selfhost.yml`。先进入自己部署的目录，以下函数只在当前 shell 中简化命令：

```sh
cd /opt/letterspace-selfhost
dc() { docker compose --env-file .env -f compose.selfhost.yml "$@"; }
```

`.env` 的 `COMPOSE_PROJECT_NAME` 决定本项目的容器、网络和卷。不要在别人的部署目录执行这些命令，也不要换一个项目名来“找回”原卷。

## 1. 常用检查

```sh
dc ps
dc logs --tail=80 mx-core
dc logs --tail=80 web sitemap
dc exec -T postgres pg_isready -U mx_blog -d mx_blog
dc exec -T redis redis-cli ping
```

网页入口：`SITE_ORIGIN/`；后台：`SITE_ORIGIN/proxy/qaqdmin#/dashboard`。用户名/密码由首次初始化时自己设置，不在 GitHub 仓库中。

## 2. 后台怎么用

- **文章**：先建分类，再写标题、slug、正文并发布。修改后前台重新读取公开 API；登录后台也不会把草稿混进前台。
- **手记**：用于短内容，可设置心情、天气等；确认公开状态和发布时间。
- **About**：在“页面/独立页面”编辑 slug 为 `about` 的页面。
- **其他独立页面**：slug 为 `reading` 时，地址为 `/reading`。不要占用 posts、notes、search、timeline、friends、projects、about-site 等系统路径。
- **友链和项目**：在对应后台栏目维护；空列表时前台显示空状态。
- **RSS**：`/feed`；`/atom.xml` 为 RSS 兼容地址；`/sitemap.xml` 从公开内容动态生成。

## 3. 备份哪些东西

缺一不可：PostgreSQL 数据库、`mx-assets` 上传卷，以及匹配这份数据库的 `.env`。同时保留源码版本/镜像版本。GitHub 只有源码，**不能代替内容备份**。

```sh
umask 077
BACKUP_DIR="$PWD/backups/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"
PROJECT=$(sed -n 's/^COMPOSE_PROJECT_NAME=//p' .env)
test -n "$PROJECT"

dc exec -T postgres pg_dump -U mx_blog mx_blog > "$BACKUP_DIR/database.sql"
test -s "$BACKUP_DIR/database.sql"
cp .env "$BACKUP_DIR/.env"
git rev-parse HEAD > "$BACKUP_DIR/code-commit.txt"
dc images > "$BACKUP_DIR/images.txt"
docker run --rm --network none \
  -v "${PROJECT}_mx-assets:/data:ro" \
  -v "$BACKUP_DIR:/backup" \
  nginx:1.27-alpine tar -czf /backup/mx-assets.tar.gz -C /data .
```

运行中的数据库由 pg_dump 获取一致性快照。如果备份期间还有上传/删除文件，要么安排无写入时段，要么先只暂停**该项目**的写入服务：`dc stop web mx-core sitemap`，完成备份后 `dc start mx-core sitemap web`。不要停止其他 Compose 项目。

把备份加密复制到另一台设备或可靠存储，并定期做恢复演练。备份中含密钥和内容，不能上传到代码仓库。仅存在同一服务器的备份无法应对该磁盘损坏。

## 4. 只更新前端

先备份并保留回滚镜像：

```sh
PROJECT=$(sed -n 's/^COMPOSE_PROJECT_NAME=//p' .env)
docker image tag "${PROJECT}-web:local" "${PROJECT}-web:rollback"
git status --short
git pull --ff-only
dc build web
dc up -d --no-deps web
dc ps
```

这只替换本项目的 web 容器，不重建 PostgreSQL 或 Redis，不生成新密钥。新前端通过 hash 资源名更新缓存；需要时浏览器强制刷新。

如果这次源码更新包含 `scripts/sitemap-server.mjs`，还需重建其 bind mount 对应的网关容器：

```sh
dc up -d --no-deps --force-recreate sitemap
```

不要因为前端修改运行 `down -v`，也不要自动拉取/升级所有后端镜像。

前端回滚：

```sh
docker image tag "${PROJECT}-web:rollback" "${PROJECT}-web:local"
dc up -d --no-deps --force-recreate web
```

如果还修改了网关脚本，先恢复对应旧源码，再重建 sitemap。前端回滚不恢复数据库、不更换 `.env`。

## 5. 后端版本与迁移

当前固定 v13.20.0 的镜像摘要，不使用 `latest`。正常前端更新不需要升级后端。以后确实要升级时，先阅读该版本迁移说明，在隔离实例恢复备份验证，准备对应数据库回滚方案，再变更自己项目的镜像引用。

不要修改同一台机器上其他站点的 mx-server、postgres、redis 或 yohaku 容器。

## 6. 换域名、端口或 HTTPS

需要同步四处：

1. `.env` 的 `SITE_ORIGIN`，以及必要的 `WEB_PORT` / `WEB_BIND_ADDRESS`。
2. Mix Space 后台设置中的 web URL、server URL、admin URL、WebSocket URL。
3. 前端构建参数（重建 web），使初始 canonical 也是新地址。
4. 网关的 `SITE_ORIGIN` 与核心的 `ALLOWED_ORIGINS`（重建对应服务以应用环境变量）。

**保留 `.env` 中 POSTGRES_PASSWORD、JWT_SECRET、MX_ENCRYPT_KEY 原值。不要重新运行首次配置生成器。**

后台 URL 建议统一：

| 项 | 值 |
| --- | --- |
| web URL | `https://blog.example.com` |
| server URL | `https://blog.example.com` |
| admin URL | `https://blog.example.com/proxy/qaqdmin` |
| WebSocket URL | `https://blog.example.com` |

后台保存后编辑 `.env`，再应用本项目配置：

```sh
dc build web
dc up -d --no-deps mx-core sitemap web
```

重新登录新地址，检查 Feed、sitemap、后台刷新、正文图片。新 origin 为 HTTPS 时，HTTP cookie 名称转换自动停用，浏览器收到正常 Secure cookie。

### 已有宿主机 Nginx 时增加一个新域名

给新站单独建配置文件，不替换 default、不改原站 server 块。让新站只绑定本机：

```dotenv
SITE_ORIGIN=https://blog.example.com
WEB_BIND_ADDRESS=127.0.0.1
WEB_PORT=18080
```

以下是**证书已经签发之后**的新域名 server 块示例；域名和证书路径必须换成自己的：

```nginx
server {
    listen 80;
    server_name blog.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name blog.example.com;
    ssl_certificate /etc/letsencrypt/live/blog.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/blog.example.com/privkey.pem;
    client_max_body_size 50m;

    location / {
        proxy_pass http://127.0.0.1:18080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 90s;
    }
}
```

先把 DNS 指到服务器，按自己使用的 ACME 客户端/面板获取新域名证书，再测试新增配置；`sudo nginx -t` 成功后才 `sudo systemctl reload nginx`。没有证书文件时，上面的 HTTPS 配置不能通过测试。不要复制、覆盖或删除原站证书。

HTTP/IP 适合先验证功能；长期使用后台时应配置自己的 HTTPS 域名。

## 7. 恢复备份：先在隔离的新项目验证

恢复不是“重新初始化”。先复制备份对应源码版本到新目录，把备份 `.env` 还原过去；仅把 `COMPOSE_PROJECT_NAME` 改为一个未使用的新名字、外部端口换成空闲值。三个密码/密钥仍保留备份原值。

Mix Space 后台的 ZIP 导入与下面的 PostgreSQL/上传卷恢复是两种方式。Letterspace 固定的 v13.20.0 镜像使用较新的 `pg_dump`，导出的 SQL 可能包含 PostgreSQL 16 不认识的 `transaction_timeout`；原版恢复还可能与被备份排除的运行时表发生外键冲突。随本项目部署的恢复适配脚本在事务内处理这些问题，并重建该版本缺失的运行时表；只支持此版本导出的常规备份，包含运行时表的备份会拒绝自动恢复。后台上传上限为 128 MiB。

恢复 ZIP 后，登录账号以备份内容为准；搜索使用公开文章、手记和页面，不依赖备份不包含的搜索索引。加密配置仍需要与备份匹配的原始加密密钥，单独复制 ZIP 不保证外部服务密钥等加密数据可用。先在隔离实例测试登录、媒体和第三方配置，再切换正式流量。

以下命令均在**隔离恢复目录**中执行，并使用该目录 `.env`；不要在原部署目录照抄：

```sh
dc() { docker compose --env-file .env -f compose.selfhost.yml "$@"; }
dc up -d postgres redis
dc exec -T postgres pg_isready -U mx_blog -d mx_blog

# 确认这是新建的空恢复数据库后导入，不覆盖原数据库。
dc exec -T postgres psql -v ON_ERROR_STOP=1 -U mx_blog -d mx_blog < /你的备份/database.sql

# 仅创建恢复项目的 core 容器/上传卷，不启动应用。
dc create --no-deps mx-core
RESTORE_PROJECT=$(sed -n 's/^COMPOSE_PROJECT_NAME=//p' .env)
BACKUP_DIR=/你的备份绝对目录
docker run --rm --network none \
  -v "${RESTORE_PROJECT}_mx-assets:/data" \
  -v "$BACKUP_DIR:/backup:ro" \
  nginx:1.27-alpine tar -xzf /backup/mx-assets.tar.gz -C /data

dc up -d --build
```

检查文章数、图片、后台登录、Feed 和独立页面。恢复库已经有管理员，`configure-fresh.mjs` 会拒绝修改；用原账号登录后台改为恢复测试地址。验证通过再规划切换域名/端口，不直接覆盖原卷。

## 8. 不能做的修复方式

- 不重新生成 `.env` 来解决数据库登录失败。
- 不删除 Docker 卷来“重新跑迁移”。
- 不把已有实例当作新实例执行初始化脚本。
- 不执行全局 `docker system prune --volumes`。
- 不把管理员密码、数据库备份或访问令牌推到 GitHub。
