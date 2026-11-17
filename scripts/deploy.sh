#!/usr/bin/env bash
set -euo pipefail
umask 077
root=/opt/letterspace
archive=${1:-$root/letterspace-release.tar.gz}
test "$(realpath -e "$root")" = /opt/letterspace
cd "$root"
test -s .env
test -f "$archive"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
stage="$root/.incoming-$stamp"
backup="$root/backups/$stamp"
mkdir -p "$stage" "$backup/site"
if tar -tzf "$archive" | grep -Eq '(^/|(^|/)\.\.(/|$)|(^|/)\.env$|(^|/)\.cache(/|$)|(^|/)node_modules(/|$))'; then
  echo 'Rejected unsafe deployment archive' >&2; exit 1
fi
tar -xzf "$archive" -C "$stage"
test -f "$stage/dist/index.html"
test -f "$stage/scripts/sitemap-server.mjs"
before_secret=$(sha256sum .env | cut -d ' ' -f 1)
docker ps -aq | xargs -r docker inspect --format '{{.Name}} {{.Id}} {{.Image}} {{.State.StartedAt}} {{.RestartCount}}' | grep -v '^/letterspace-' | sort > "$backup/original-containers.before"
cp .env "$backup/.env"
for name in dist src public scripts package.json pnpm-lock.yaml pnpm-workspace.yaml vite.config.js index.html Dockerfile docker-compose.yml nginx.conf README.md ACCEPTANCE.md .gitignore .dockerignore .env.example; do
  test ! -e "$name" || cp -a "$name" "$backup/site/"
done
docker compose -p letterspace exec -T postgres pg_dump -U mx_blog mx_blog > "$backup/database.sql"
test -s "$backup/database.sql"
docker run --rm --network none -v letterspace_mx-assets:/data:ro -v "$backup":/backup nginx:1.27-alpine tar -czf /backup/mx-assets.tar.gz -C /data .
# Preserve the existing bind mount and old hashed assets for open browser tabs.
rsync -a "$stage/dist/" dist/
for name in src public scripts; do mkdir -p "$name"; rsync -a "$stage/$name/" "$name/"; done
for name in package.json pnpm-lock.yaml pnpm-workspace.yaml vite.config.js index.html Dockerfile docker-compose.yml nginx.conf README.md .gitignore .dockerignore .env.example; do cp "$stage/$name" "$name"; done
for name in ACCEPTANCE.md release.sha256; do test ! -f "$stage/$name" || cp "$stage/$name" "$name"; done
find dist src public scripts -type d -exec chmod 755 {} +
find dist src public scripts -type f -exec chmod 644 {} +
test "$before_secret" = "$(sha256sum .env | cut -d ' ' -f 1)"
docker compose -p letterspace config --quiet
docker compose -p letterspace up -d --no-deps sitemap
docker compose -p letterspace restart sitemap
for ((i=0; i<30; i++)); do
  status=$(docker inspect --format '{{.State.Health.Status}}' letterspace-sitemap-1)
  test "$status" != healthy || break
  sleep 2
done
test "$status" = healthy
docker compose -p letterspace exec -T web nginx -t
docker compose -p letterspace exec -T web nginx -s reload
curl --fail --silent http://127.0.0.1:18080/health
curl --fail --silent --show-error --retry 5 --retry-all-errors --retry-delay 1 -A Mozilla/5.0 http://127.0.0.1:18080/sitemap.xml > "$backup/sitemap-after.xml"
grep -q '<urlset' "$backup/sitemap-after.xml"
docker ps -aq | xargs -r docker inspect --format '{{.Name}} {{.Id}} {{.Image}} {{.State.StartedAt}} {{.RestartCount}}' | grep -v '^/letterspace-' | sort > "$backup/original-containers.after"
diff -u "$backup/original-containers.before" "$backup/original-containers.after"
printf '\nDeployment verified. Backup: %s\nSecrets preserved; original containers unchanged.\n' "$backup"
