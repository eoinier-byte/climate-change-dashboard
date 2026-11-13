#!/usr/bin/env bash
# Dump a database to a dated file OUTSIDE the repository (CCD-272). Policy: docs/setup.md, "Backups".
#
#   db/backup.sh                    # the database in DB_NAME (.env), normally climate_dev
#   db/backup.sh climate_staging    # another database on the same server
#
# Writes $BACKUP_DIR/<database>_<YYYY-MM-DD_HHMMSS>.dump (default BACKUP_DIR: ~/ccd-backups).
# Custom format (pg_dump --format=custom): compressed, checked with pg_restore --list before it is kept.
# The file is readable only by you (mode 600), because the dump includes the users table.
# Restore it with db/restore.sh.

# shellcheck source=db/pg_common.sh
source "$(dirname "${BASH_SOURCE[0]}")/pg_common.sh"

[[ $# -le 1 ]] || die "usage: db/backup.sh [database]"
load_env
db="${1:-$DB_NAME}"

refuse_if_in_repo() {
    case "$1/" in
    "$REPO_ROOT"/*) die "BACKUP_DIR ($1) is inside the repository. Dumps contain user data: keep them outside it" ;;
    esac
}
backup_dir="${BACKUP_DIR:-$HOME/ccd-backups}"
[[ $backup_dir == /* ]] || backup_dir="$(pwd -P)/$backup_dir"
refuse_if_in_repo "$backup_dir" # before mkdir, so nothing is created in the repo
mkdir -p "$backup_dir"
backup_dir="$(cd "$backup_dir" && pwd -P)"
refuse_if_in_repo "$backup_dir" # again with symlinks resolved

pick_mode
check_local_version "$db"
umask 077
file="$backup_dir/${db}_$(date +%Y-%m-%d_%H%M%S).dump"
tmp="$file.partial"
trap 'rm -f "$tmp"' EXIT

echo "Dumping $db (client: $MODE) ..."
pg pg_dump --dbname="$db" --format=custom >"$tmp"

# Only keep the file if pg_restore can read it to the end.
tables=$(pg pg_restore --list <"$tmp" | grep -c ' TABLE DATA ') || die "the dump can't be read back: $tmp was deleted"
mv "$tmp" "$file"

echo "Saved $file ($(du -h "$file" | cut -f1), data for $tables tables)"
