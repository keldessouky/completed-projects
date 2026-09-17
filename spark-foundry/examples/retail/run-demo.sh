#!/usr/bin/env bash
#
# Runs the retail example end to end into a throwaway warehouse.
#
#   ./examples/retail/run-demo.sh [target-directory]
#
# The seed CSVs are copied into the target's landing zone first, so the example
# never writes into the repository and can be run again and again.
#
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/../.." && pwd)"
warehouse="${1:-$(mktemp -d)}"

# The third pipeline scores order lines with a transform written in Java, so the
# example's own plugin has to be on the path. Its jar after 'mvn package', its
# compiled classes after a bare 'mvn test' - both are legal plugin paths.
plugin="$(ls "$here"/plugin/target/retail-transforms-*.jar 2>/dev/null | head -1 || true)"
if [[ -z "$plugin" ]]; then
  plugin="$here/plugin/target/classes"
fi
if [[ ! -e "$plugin" ]]; then
  echo "the example plugin has not been built; run 'mvn package' in $root" >&2
  exit 1
fi
echo "warehouse: $warehouse"
echo "plugin:    $plugin"

mkdir -p "$warehouse/landing/orders" "$warehouse/landing/customers" "$warehouse/landing/products"
cp "$here/seed/orders.csv"    "$warehouse/landing/orders/"
cp "$here/seed/customers.csv" "$warehouse/landing/customers/"
cp "$here/seed/products.csv"  "$warehouse/landing/products/"

cd "$root"

echo
echo "== validate (no Spark) =="
./foundry validate --metadata "$here/metadata" --plugins "$plugin"

echo
echo "== plan: orders_daily (no Spark) =="
./foundry plan --metadata "$here/metadata" --pipeline orders_daily --plugins "$plugin"

echo
echo "== run: orders_daily =="
./foundry run --metadata "$here/metadata" --pipeline orders_daily \
  --data "$warehouse" --param run_date=2026-03-05 --quiet

echo
echo "== run: customer_profile =="
./foundry run --metadata "$here/metadata" --pipeline customer_profile \
  --data "$warehouse" --quiet

echo
echo "== run: order_risk (scored by a transform written in Java) =="
./foundry run --metadata "$here/metadata" --pipeline order_risk \
  --data "$warehouse" --plugins "$plugin" --quiet

echo
echo "warehouse contents:"
find "$warehouse" -name '*.parquet' -o -name '*.json' | sed "s|$warehouse|.|" | sort
