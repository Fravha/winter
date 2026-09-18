#!/usr/bin/env bash
set -euo pipefail

: "${P5_SAFETY_DATABASE_URL:?P5_SAFETY_DATABASE_URL must point to a temporary 127.0.0.1 PostgreSQL}"
node -e '
  const url = new URL(process.env.P5_SAFETY_DATABASE_URL);
  const databaseName = decodeURIComponent(url.pathname.slice(1));
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1" || !/_(?:test|temp)$/i.test(databaseName) || url.search !== "") {
    throw new Error("P5_SAFETY_DATABASE_URL must point directly to a temporary PostgreSQL database on 127.0.0.1 whose name ends in _test or _temp, without query parameters");
  }
  if (process.env.WINTER_DATABASE_URL) {
    const development = new URL(process.env.WINTER_DATABASE_URL);
    const port = candidate => candidate.port || "5432";
    if (url.hostname === development.hostname && port(url) === port(development) && decodeURIComponent(url.pathname) === decodeURIComponent(development.pathname)) {
      throw new Error("P5_SAFETY_DATABASE_URL must not identify the same database as WINTER_DATABASE_URL");
    }
  }
'
root="$(cd "$(dirname "$0")/.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/migrations"
for migration in "$root"/prisma/migrations/*; do
  name="$(basename "$migration")"
  [[ "$name" < 20260918030000_production_p5_work_tracking ]] || continue
  cp -R "$migration" "$tmp/migrations/$name"
done
for migration in "$tmp"/migrations/*; do
  PGPASSWORD="${PGPASSWORD:-}" psql "$P5_SAFETY_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration/migration.sql" >/dev/null
done

new_uuid() { node -e "console.log(require('node:crypto').randomUUID())"; }
order_id="$(new_uuid)"
article_id="$(new_uuid)"
work_id="$(new_uuid)"
input_id="$(new_uuid)"
psql "$P5_SAFETY_DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL >/dev/null
INSERT INTO production_orders (id, code, status, start_date, created_at, updated_at)
VALUES ('$order_id', 'P5-LEGACY-$order_id', 'OPEN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO articulos (id, codigo, nombre, clasificacion, unidad_medida, activo, created_at, updated_at)
VALUES ('$article_id', 'P5-LEGACY-$article_id', 'Legacy article', 'MATERIA_PRIMA', 'KG', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO production_works (id, production_order_id, created_at)
VALUES ('$work_id', '$order_id', CURRENT_TIMESTAMP);
INSERT INTO production_work_inputs (id, production_work_id, articulo_id, quantity, unit, created_at)
VALUES ('$input_id', '$work_id', '$article_id', 1, 'KG', CURRENT_TIMESTAMP);
SQL

before_work="$(psql "$P5_SAFETY_DATABASE_URL" -Atc "SELECT row_to_json(x) FROM (SELECT id, production_order_id, created_at FROM production_works WHERE id='$work_id') x")"
before_input="$(psql "$P5_SAFETY_DATABASE_URL" -Atc "SELECT row_to_json(x) FROM (SELECT id, production_work_id, articulo_id, quantity, unit FROM production_work_inputs WHERE id='$input_id') x")"
if psql "$P5_SAFETY_DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f "$root/prisma/migrations/20260918030000_production_p5_work_tracking/migration.sql" >/dev/null 2>&1; then
  echo "03000 unexpectedly succeeded" >&2
  exit 1
fi
after_work="$(psql "$P5_SAFETY_DATABASE_URL" -Atc "SELECT row_to_json(x) FROM (SELECT id, production_order_id, created_at FROM production_works WHERE id='$work_id') x")"
after_input="$(psql "$P5_SAFETY_DATABASE_URL" -Atc "SELECT row_to_json(x) FROM (SELECT id, production_work_id, articulo_id, quantity, unit FROM production_work_inputs WHERE id='$input_id') x")"
[[ "$before_work" == "$after_work" ]]
[[ "$before_input" == "$after_input" ]]
[[ "$(psql "$P5_SAFETY_DATABASE_URL" -Atc "SELECT count(*) FROM information_schema.columns WHERE table_name='production_works' AND column_name='work_type_id'")" == "0" ]]
[[ "$(psql "$P5_SAFETY_DATABASE_URL" -Atc "SELECT count(*) FROM information_schema.tables WHERE table_name='production_work_corrections'")" == "0" ]]
echo "P5 legacy migration safety: PASS"