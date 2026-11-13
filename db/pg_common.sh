# shellcheck shell=bash
# Shared by db/backup.sh and db/restore.sh (CCD-272). Sourced, not run on its own.
# Works with bash 3.2 (macOS) and later.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"

die() {
    echo "ERROR: $*" >&2
    exit 1
}

# Read the DB_* settings from .env without executing the file.
# A variable already set in the shell wins over .env (the same rule Django uses).
load_env() {
    local file="$REPO_ROOT/.env" line key value
    if [[ -f $file ]]; then
        while IFS= read -r line || [[ -n $line ]]; do
            line="${line%$'\r'}"
            [[ $line =~ ^(DB_HOST|DB_PORT|DB_NAME|DB_USER|DB_PASSWORD)=(.*)$ ]] || continue
            key="${BASH_REMATCH[1]}"
            value="${BASH_REMATCH[2]}"
            value="${value#\"}" && value="${value%\"}"
            value="${value#\'}" && value="${value%\'}"
            [[ -n ${!key:-} ]] || export "$key=$value"
        done <"$file"
    fi
    export DB_HOST="${DB_HOST:-localhost}" DB_PORT="${DB_PORT:-5432}"
    [[ -n ${DB_NAME:-} ]] || die "DB_NAME is not set (in .env or the shell)"
    [[ -n ${DB_USER:-} ]] || die "DB_USER is not set (in .env or the shell)"
}

# MODE=docker: run the client tools inside the compose `db` container. Their version always matches the
#              server and nothing has to be installed. This is the default whenever the container is running.
# MODE=local:  run the tools installed on this machine, over TCP to DB_HOST:DB_PORT with DB_PASSWORD.
#              Used when Docker isn't reachable. The local pg_dump must be the server's version or newer.
# Force one with PG_MODE=docker or PG_MODE=local.
pick_mode() {
    local wanted="${PG_MODE:-auto}"
    if [[ $wanted != local ]] &&
        docker compose --project-directory "$REPO_ROOT" ps --status running -q db 2>/dev/null | grep -q .; then
        MODE=docker
    elif [[ $wanted == docker ]]; then
        die "PG_MODE=docker, but the compose db container isn't running or Docker isn't reachable"
    elif command -v pg_dump >/dev/null && command -v pg_restore >/dev/null && command -v psql >/dev/null; then
        MODE=local
    else
        die "Docker isn't reachable and the PostgreSQL client tools aren't installed. Start the db container (docs/setup.md)"
    fi
}

# pg <tool> [args...]: run a PostgreSQL client tool as DB_USER. stdin and stdout pass straight through.
pg() {
    local tool=$1
    shift
    if [[ $MODE == docker ]]; then
        docker compose --project-directory "$REPO_ROOT" exec -T db "$tool" -U "$DB_USER" "$@"
    else
        PGPASSWORD="${DB_PASSWORD:-}" "$tool" -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$@"
    fi
}

# check_local_version <database>: in local mode, the client tools must have the server's MAJOR version.
# pg_restore 17 can't restore into a 16 server, and pg_restore 16 can't read a dump written by pg_dump 17,
# so a mismatched local backup would only restore with newer tools. Docker mode always matches.
check_local_version() {
    [[ $MODE == local ]] || return 0
    local db=$1 client server
    client=$(pg_dump --version | grep -oE '[0-9]+' | head -1)
    server=$(pg psql --no-psqlrc --quiet --tuples-only --no-align --dbname="$db" \
        --command="SELECT current_setting('server_version_num')::int / 10000") ||
        die "can't connect to database $db on $DB_HOST:$DB_PORT. Does it exist? (db/README.md)"
    [[ $client == "$server" ]] ||
        die "the local PostgreSQL client tools are version $client but the server is $server. Start the db container so the scripts use its tools (PG_MODE=docker), or install version-$server client tools"
}
