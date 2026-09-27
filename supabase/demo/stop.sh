#!/usr/bin/env bash
# Stops the local demo backend started by start.sh. The database is kept in .demo/pgdata.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DEMO="$ROOT/.demo"
PG_BIN="${PG_BIN:-/Library/PostgreSQL/18/bin}"

for name in gateway postgrest; do
  if [[ -f "$DEMO/$name.pid" ]]; then
    kill "$(cat "$DEMO/$name.pid")" 2>/dev/null
    rm -f "$DEMO/$name.pid"
  fi
done
if [[ -d "$DEMO/pgdata" ]]; then
  DYLD_LIBRARY_PATH="$(dirname "$PG_BIN")/lib" "$PG_BIN/pg_ctl" -D "$DEMO/pgdata" -m fast stop >/dev/null 2>&1
fi
echo "Demo backend stopped."
