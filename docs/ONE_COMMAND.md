# 一条命令部署（GitHub 直链）

在 **Ubuntu/Debian amd64 服务器的 root 终端**执行：

```sh
curl -fsSL https://raw.githubusercontent.com/ZXEB/letterspace-blog/main/install.sh | bash
```

脚本和校验过的预编译安装包均从 GitHub 仓库下载。仓库公开，不需要账号、token 或 git clone；使用已经编译好的前端，不运行 npm/pnpm。已有 Docker 时不升级或重启 Docker；没有 Docker 且未检测到其他容器运行时时，使用 Docker 官方 APT 软件源安装。

默认自动检测公网 IPv4，使用空闲端口 18080；如果端口被占用，尝试下一个空闲端口。默认目录 `/opt/letterspace-oneclick`，Compose 项目 `letterspace-oneclick`，与原有 `letterspace` 项目独立。

服务启动后，自动创建随机密码管理员、5 篇可编辑演示文章、2 篇手记和 About，最后显示前台、后台、用户名和密码。你可以直接登录写作，不再手动执行首次配置向导。

## 自己指定地址/端口

如果公网 IP 自动检测不正确，或你想固定端口：

```sh
curl -fsSL https://raw.githubusercontent.com/ZXEB/letterspace-blog/main/install.sh | bash -s -- \
  --origin http://你的IP:18081 --port 18081
```

另装第二套时，同时换目录、项目名和端口：

```sh
curl -fsSL https://raw.githubusercontent.com/ZXEB/letterspace-blog/main/install.sh | bash -s -- \
  --origin http://你的IP:18082 --port 18082 \
  --dir /opt/my-other-blog --project my-other-blog
```

如果使用 HTTPS 域名，先准备好该域名到指定端口的反向代理，再传入 `--origin https://blog.example.com`。安装器不会改动原有 80/443 站点、证书或云厂商安全组。

## 已安装、失败重试与密码

- 已安装完成时，再执行同一命令只显示原有地址/凭据，不升级容器，不更换密钥，也不创建第二个管理员。
- 安装中断后，保留当前目录，重新执行同一命令继续；不要删除 `.env` 或数据卷。
- 默认目录已有其他部署的 `.env`，或项目名已被其他容器/数据卷使用时，会停止，不覆盖原项目。
- 密钥在安装目录 `.env`；管理员凭据在 `.cache/owner-credentials.txt`，都不属于公开下载包。

检查自己的服务：

```sh
cd /opt/letterspace-oneclick
docker compose --env-file .env -f compose.quickstart.yml ps
docker compose --env-file .env -f compose.quickstart.yml logs --tail=80 mx-core
```

首次安装需要访问 GitHub Raw 和 Docker Hub，不需要访问 npm。服务器的云防火墙仍须允许最终显示的端口。GitHub 无法访问时应先解决服务器网络，不自动切换到不明镜像站。

## 下载和数据边界

安装包只有编译后的前端、部署模板和必要初始化脚本，不包含已有站点的数据库、上传文件、真实 `.env`、SSH/GitHub 令牌或管理员密码。安装包会校验内嵌的 SHA-256。

脚本和安装包均通过 GitHub 的 HTTPS 地址分发，安装器内嵌该版本安装包的 SHA-256，不依赖演示服务器的下载入口。也可以先下载并阅读 `install.sh` 后再执行。

后续备份可参考 [运维说明](OPERATIONS.md)，将命令中的 `compose.selfhost.yml` 改为本安装方式的 `compose.quickstart.yml`；这是预编译分发，日常运行不需要前端构建。
