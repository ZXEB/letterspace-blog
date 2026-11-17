#!/usr/bin/env bash
set -euo pipefail
umask 077
root=/opt/letterspace
archive=${1:-$root/letterspace-release.tar.gz}
test "$(realpath -e "$root")" = /opt/letterspace
cd "$root"
test -s .env
stamp=$(date -u +%Y%m%dT%H%M%SZ)
stage="$root/.frontend-$stamp"
backup="$root/backups/frontend-$stamp"
mkdir -p "$stage" "$backup/site"
if tar -tzf "$archive" | grep -Eq '(^/|(^|/)\.\.(/|$)|(^|/)\.env$|(^|/)\.cache(/|$)|(^|/)node_modules(/|$))'; then
  echo 'Rejected unsafe frontend archive' >&2; exit 1
fi
tar -xzf "$archive" -C "$stage"
(cd "$stage" && sha256sum -c release.sha256 > /dev/null)
before_secret=$(sha256sum .env | cut -d ' ' -f 1)
snapshot() { docker ps -aq | xargs -r docker inspect --format '{{.Name}} {{.Id}} {{.Image}} {{.State.StartedAt}} {{.RestartCount}}' | sort; }
snapshot > "$backup/containers.before"
for name in dist src scripts index.html README.md ACCEPTANCE.md release.sha256; do
  test ! -e "$name" || cp -a "$name" "$backup/site/"
done
# Assets land before an atomic HTML swap. Preserve the directory mounted by
# Nginx and retain previous hashed assets for visitors with an open page.
rsync -a --exclude=index.html "$stage/dist/" dist/
rsync -a "$stage/src/" src/
for name in deploy-frontend.sh motion-smoke.mjs; do cp "$stage/scripts/$name" "scripts/$name"; done
for name in index.html README.md ACCEPTANCE.md release.sha256; do cp "$stage/$name" "$name"; done
find dist src -type d -exec chmod 755 {} +
find dist src -type f -exec chmod 644 {} +
install -m 644 "$stage/dist/index.html" dist/.index-next.html
mv -f dist/.index-next.html dist/index.html
test "$before_secret" = "$(sha256sum .env | cut -d ' ' -f 1)"
sha256sum -c release.sha256 > "$backup/files-check.txt"
curl --fail --silent http://127.0.0.1:18080/health
curl --fail --silent -A Mozilla/5.0 http://127.0.0.1:18080/api/v3/ping
snapshot > "$backup/containers.after"
diff -u "$backup/containers.before" "$backup/containers.after"
printf '\nFrontend updated. No containers restarted. Backup: %s\n' "$backup"
