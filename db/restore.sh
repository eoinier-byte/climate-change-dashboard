#!/usr/bin/env bash
# Restore a db/backup.sh dump into an EMPTY database (CCD-272). Policy: docs/setup.md, "Backups".
#
#   db/restore.sh <dump-file> <target-database>
#
# The target database must already exist and contain no tables. The script refuses anything else,
# so a restore can never overwrite or mix with existing data. Create the target first (db/README.md).
# The restored objects are owned by DB_USER (--no-owner). The restore runs as one transaction:
# if any statement fails, nothing is restored.

# shellcheck source=db/pg_common.sh
source "$(dirname "${BASH_SOURCE[0]}")/pg_common.sh"

[[ $# -eq 2 ]] || die "usage: db/restore.sh <dump-file> <target-database>"
dump=$1
target=$2
[[ -f $dump ]] || die "dump file not found: $dump"

load_env
pick_mode
check_local_version "$target"

# Count the tables, views and sequences outside the system schemas.
objects=$(pg psql --no-psqlrc --quiet --tuples-only --no-align --dbname="$target" --command="
    SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
      AND n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg_toast%'") ||
    die "can't connect to database $target. Does it exist? Create it first (db/README.md)"
[[ $objects == 0 ]] || die "database $target is not empty ($objects tables, views or sequences). Restore only into an empty database"

echo "Restoring $dump into $target (client: $MODE) ..."
pg pg_restore --dbname="$target" --no-owner --no-privileges --single-transaction --exit-on-error <"$dump"

tables=$(pg psql --no-psqlrc --quiet --tuples-only --no-align --dbname="$target" \
    --command="SELECT count(*) FROM pg_tables WHERE schemaname = 'public'")
echo "Restored $tables tables into $target"
