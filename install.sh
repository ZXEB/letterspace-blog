#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
RELEASE_URL=${LETTERSPACE_RELEASE_URL:-https://raw.githubusercontent.com/ZXEB/letterspace-blog/main/releases/letterspace-611f016e19c7e14f.tar.gz}
RELEASE_SHA256='611f016e19c7e14f0649e0ce5e71f815f4842652999bf38cc15b31c53756fe78'
CORE_IMAGE='innei/mx-server@sha256:b1c726bee1b55a6649df632ff7e37f5595d533193365e3aef48ff792d327a3ad'
INSTALL_DIR=/opt/letterspace-oneclick
PROJECT=letterspace-oneclick
PORT=18080
ORIGIN=''
PORT_EXPLICIT=0
QUIET_CREDENTIALS=0
STAGE=''
say() { printf '\n[纸间] %s\n' "$*"; }
die() { printf '\n[纸间] %s\n' "$*" >&2; exit 1; }
value() { sed -n "s/^$1=//p" "$INSTALL_DIR/.env" | head -n 1; }
finish() {
  local url
  url=$(value SITE_ORIGIN)
  printf '\n部署完成\n前台：%s\n后台：%s/proxy/qaqdmin#/dashboard\n目录：%s\n' "$url" "$url" "$INSTALL_DIR"
  if [[ -f "$INSTALL_DIR/.cache/owner-credentials.txt" ]]; then
    printf '管理员凭据：%s/.cache/owner-credentials.txt\n' "$INSTALL_DIR"
    if [[ "$QUIET_CREDENTIALS" == 0 ]]; then
      sed -n -e 's/^username: /用户名：/p' -e 's/^password: /密码：/p' "$INSTALL_DIR/.cache/owner-credentials.txt"
    fi
  else printf '请使用原有管理员账号登录；安装器不会重置密码。\n'; fi
}
cleanup() {
  if [[ -n "$STAGE" ]]; then
    case "$STAGE" in "$INSTALL_DIR"/.install-*) rm -rf -- "$STAGE";; esac
  fi
}
trap cleanup EXIT
trap 'printf "\n安装未完成。已生成的配置和数据已保留，可重跑同一命令继续。\n" >&2' ERR
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir) INSTALL_DIR=${2:?Missing directory}; shift 2;;
    --project) PROJECT=${2:?Missing project}; shift 2;;
    --port) PORT=${2:?Missing port}; PORT_EXPLICIT=1; shift 2;;
    --origin) ORIGIN=${2:?Missing origin}; shift 2;;
    --quiet-credentials) QUIET_CREDENTIALS=1; shift;;
    --help) printf '用法：bash install.sh [--origin http://IP:端口] [--port 18080] [--dir /opt/letterspace-oneclick] [--project letterspace-oneclick]\n'; exit 0;;
    *) die "未知参数：$1";;
  esac
done
[[ $(uname -s) == Linux ]] || die '请在 Linux 服务器中执行，不是在 Windows PowerShell 中执行。'
[[ $(uname -m) == x86_64 ]] || die '此安装包目前仅验证 Linux amd64。'
[[ $EUID == 0 ]] || die '请使用 root 登录服务器后执行。'
[[ "$PROJECT" =~ ^[a-z0-9][a-z0-9_-]{1,50}$ ]] || die '项目名只能包含小写字母、数字、下划线和短横线。'
[[ "$PORT" =~ ^[0-9]{1,5}$ ]] || die '端口必须是 1..65535。'
PORT=$((10#$PORT))
((PORT>=1 && PORT<=65535)) || die '端口必须是 1..65535。'
[[ "$INSTALL_DIR" == /* ]] || die '安装目录必须是绝对路径。'
INSTALL_DIR=$(realpath -m -- "$INSTALL_DIR")
case "$INSTALL_DIR" in /|/opt|/etc|/usr|/var|/root|/home) die '拒绝使用系统根目录作为安装目录。';; esac
if [[ -e "$INSTALL_DIR/.env" ]]; then
  [[ -f "$INSTALL_DIR/.oneclick-managed" ]] || die '目录中已有其他部署的 .env；已停止，不覆盖密钥或原有站点。'
  if [[ -f "$INSTALL_DIR/.install-ready" ]]; then say '已安装，保持现有配置、账号和容器不变。'; finish; exit 0; fi
elif [[ -d "$INSTALL_DIR" && -n $(find "$INSTALL_DIR" -mindepth 1 -maxdepth 1 -print -quit) && ! -f "$INSTALL_DIR/.oneclick-managed" ]]; then
  die '安装目录已有其他文件；请选择新的空目录。'
fi
if ! command -v docker >/dev/null; then
  # Only a host without Docker can enter this branch. Never remove or upgrade
  # an existing Docker installation or restart someone else's daemon.
  [[ -r /etc/os-release ]] || die '无法识别系统，请先安装 Docker。'
  . /etc/os-release
  case "$ID" in ubuntu|debian) ;; *) die '自动安装 Docker 仅支持 Ubuntu/Debian，请先安装 Docker 和 Compose。';; esac
  if command -v containerd >/dev/null || { dpkg-query -W -f='${Status}' docker.io docker-ce containerd containerd.io 2>/dev/null || true; } | grep -q 'install ok installed'; then
    die '检测到已有容器运行时，未修改。请先确认 Docker 命令可用。'
  fi
  say '安装 Docker Engine 和 Compose（官方软件源）'
  apt-get update
  apt-get install -y ca-certificates curl
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/$ID/gpg" -o /etc/apt/keyrings/letterspace-docker.asc
  chmod a+r /etc/apt/keyrings/letterspace-docker.asc
  cat > /etc/apt/sources.list.d/letterspace-docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/$ID
Suites: ${UBUNTU_CODENAME:-$VERSION_CODENAME}
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/letterspace-docker.asc
EOF
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
docker info >/dev/null 2>&1 || die 'Docker 已安装但不可用；未重启或修改现有 Docker 服务。'
docker compose version >/dev/null 2>&1 || die '缺少 Docker Compose 插件，请先安装 docker-compose-plugin。'
for tool in curl tar sha256sum ss; do command -v "$tool" >/dev/null || die "缺少工具：$tool"; done
if [[ -f "$INSTALL_DIR/.env" ]]; then
  say '继续未完成的本项目安装，保留已有密钥'
  PROJECT=$(value COMPOSE_PROJECT_NAME); PORT=$(value WEB_PORT); ORIGIN=$(value SITE_ORIGIN)
else
  [[ -z $(docker ps -aq --filter "label=com.docker.compose.project=$PROJECT") ]] || die '同名 Compose 项目已经存在，请使用 --project 指定新名字。'
  [[ -z $(docker volume ls -q --filter "label=com.docker.compose.project=$PROJECT") ]] || die '同名项目已有数据卷，请勿为旧数据库生成新密码。'
  if [[ "$PORT_EXPLICIT" == 1 && -n $(ss -H -ltn "sport = :$PORT") ]]; then die '指定端口已占用，原服务未改动。'; fi
  while [[ -n $(ss -H -ltn "sport = :$PORT") ]]; do
    ((PORT+=1)); ((PORT<=65535)) || die '没有可用端口。'
  done
  if [[ -z "$ORIGIN" ]]; then
    ip=$(curl -4fsS --connect-timeout 4 --max-time 8 https://api.ipify.org || curl -4fsS --connect-timeout 4 --max-time 8 https://icanhazip.com || true)
    [[ "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || die '未能检测公网 IP，请通过 --origin http://你的IP:端口 指定。'
    ORIGIN="http://$ip:$PORT"
  fi
  mkdir -p "$INSTALL_DIR"
  touch "$INSTALL_DIR/.oneclick-managed"
fi
[[ "$ORIGIN" =~ ^https?://[A-Za-z0-9.:-]+/?$ ]] || die '站点地址必须是 http(s)://域名或IP:端口，不包含路径。'
say "安装到 $INSTALL_DIR；项目 $PROJECT；地址 $ORIGIN"
if [[ ! -f "$INSTALL_DIR/compose.quickstart.yml" ]]; then
  STAGE=$(mktemp -d "$INSTALL_DIR/.install-XXXXXX")
  say '下载并校验 GitHub Release 安装包（无需 git clone/npm）'
  curl -fSL --retry 3 --connect-timeout 10 "$RELEASE_URL" -o "$STAGE/package.tar.gz"
  printf '%s  %s\n' "$RELEASE_SHA256" "$STAGE/package.tar.gz" | sha256sum -c -
  tar -tzf "$STAGE/package.tar.gz" > "$STAGE/files.txt"
  if grep -Eq '(^/|(^|/)\.\.(/|$)|(^|/)\.env$|owner-credentials)' "$STAGE/files.txt"; then die '安装包包含不允许的路径。'; fi
  mkdir "$STAGE/package"
  tar --no-same-owner --no-same-permissions -xzf "$STAGE/package.tar.gz" -C "$STAGE/package"
  test -f "$STAGE/package/compose.quickstart.yml"
  cp -a "$STAGE/package/." "$INSTALL_DIR/"
  find "$INSTALL_DIR/dist" "$INSTALL_DIR/deploy" "$INSTALL_DIR/scripts" -type d -exec chmod 755 {} +
  find "$INSTALL_DIR/dist" "$INSTALL_DIR/deploy" "$INSTALL_DIR/scripts" -type f -exec chmod 644 {} +
  chmod 755 "$INSTALL_DIR/scripts/pg-restore-compat.sh"
fi
cd "$INSTALL_DIR"
say '下载运行镜像'
docker pull "$CORE_IMAGE"
if [[ ! -f .env ]]; then
  docker run --rm --network none --entrypoint node -v "$INSTALL_DIR:/workspace" -w /workspace "$CORE_IMAGE" \
    scripts/setup-selfhost.mjs --origin "$ORIGIN" --port "$PORT" --project "$PROJECT"
fi
dc() { docker compose --env-file .env -f compose.quickstart.yml "$@"; }
dc config --quiet
dc pull
say '启动独立服务，等待数据库迁移和 API 就绪'
dc up -d
ready=0
for ((i=0;i<120;i++)); do
  if curl -fsS --max-time 3 -A Mozilla/5.0 "http://127.0.0.1:$PORT/api/v3/ping" 2>/dev/null | grep -q pong; then ready=1; break; fi
  sleep 2
done
[[ "$ready" == 1 ]] || { dc logs --tail=40 migrate mx-core; die '服务未就绪。配置和数据已保留。'; }
say '首次创建独立管理员与可编辑演示内容'
docker run --rm --network host --entrypoint node -v "$INSTALL_DIR:/workspace" -w /workspace "$CORE_IMAGE" scripts/initialize-oneclick.mjs
curl -fsS -A Mozilla/5.0 "http://127.0.0.1:$PORT/sitemap.xml" >/dev/null
touch .install-ready
finish
