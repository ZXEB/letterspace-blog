#!/bin/sh
# Mix Space invokes pg_restore for full database backups. Restore into a clean
# schema in one transaction, including when newer pg_dump emits PG17 settings.
set -eu
host= port= user= database= archive=
while [ "$#" -gt 0 ]; do
  case "$1" in
    --clean|--if-exists|--no-owner) shift ;;
    -h) host=$2; shift 2 ;;
    -p) port=$2; shift 2 ;;
    -U) user=$2; shift 2 ;;
    -d) database=$2; shift 2 ;;
    -*) echo 'Unsupported pg_restore argument' >&2; exit 2 ;;
    *) [ -z "$archive" ] || exit 2; archive=$1; shift ;;
  esac
done
[ "$host" = "${PG_HOST:-}" ] && [ "$port" = "${PG_PORT:-}" ] &&
  [ "$user" = "${PG_USER:-}" ] && [ "$database" = "${PG_DATABASE:-}" ] &&
  [ -f "$archive" ] || { echo 'Unexpected restore target or archive' >&2; exit 2; }
schema=${LETTERSPACE_RUNTIME_SCHEMA:-/site/mixspace-runtime-schema.sql}
[ -r "$schema" ] || { echo 'Runtime schema is unavailable' >&2; exit 2; }
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT HUP INT TERM
/usr/bin/pg_restore -l "$archive" > "$tmp/list"
if grep -Eq ' TABLE public (activities|analyzes|search_documents|serverless_logs|sessions|verifications|webhook_events) ' "$tmp/list"; then
  echo 'Backup includes runtime tables; automatic restore is not supported for this archive' >&2
  exit 2
fi
/usr/bin/pg_restore --no-owner --no-acl -f "$tmp/restore.sql" "$archive"
{
  printf '%s\n' 'DROP SCHEMA public CASCADE;' 'DROP SCHEMA IF EXISTS drizzle CASCADE;' 'CREATE SCHEMA public AUTHORIZATION pg_database_owner;'
  sed '/^SET transaction_timeout = 0;$/d' "$tmp/restore.sql"
  cat "$schema"
} > "$tmp/transaction.sql"
psql -X -q -v ON_ERROR_STOP=1 -1 -h "$host" -p "$port" -U "$user" -d "$database" -f "$tmp/transaction.sql"
