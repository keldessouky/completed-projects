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

echo "warehouse: $warehouse"
mkdir -p "$warehouse/landing/orders" "$warehouse/landing/customers" "$warehouse/landing/products"
cp "$here/seed/orders.csv"    "$warehouse/landing/orders/"
cp "$here/seed/customers.csv" "$warehouse/landing/customers/"
cp "$here/seed/products.csv"  "$warehouse/landing/products/"

cd "$root"
echo
echo "== validate =="
./foundry validate --metadata "$here/metadata"

echo
echo "== plan: orders_daily =="
./foundry plan --metadata "$here/metadata" --pipeline orders_daily

echo
echo "== run: orders_daily =="
./foundry run --metadata "$here/metadata" --pipeline orders_daily \
  --data "$warehouse" --param run_date=2026-03-05 --quiet

echo
echo "== run: customer_profile =="
./foundry run --metadata "$here/metadata" --pipeline customer_profile \
  --data "$warehouse" --quiet

echo
echo "warehouse contents:"
find "$warehouse" -name '*.parquet' -o -name '*.json' | sed "s|$warehouse|.|" | sort
