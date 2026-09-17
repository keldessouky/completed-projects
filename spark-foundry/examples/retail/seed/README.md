# Seed data

Small, hand-written and deliberately imperfect. Each defect exists to make one
rule in `orders_daily` do something visible:

| Row | What is wrong with it | What catches it |
| --- | --- | --- |
| `O-1002` appears twice | The storefront re-delivered a corrected line, with a lower-cased SKU and a different status | `latest_lines` keeps the delivery with the later `received_at` |
| The row with no `order_id` | A line nobody can attribute to an order | `order_identifiers_present` → quarantined |
| `O-1008` | Discount equals the line value, so the line is worth nothing | `lines_are_worth_something` → quarantined |
| `O-1009` | Customer `C999` is not in the customer master | `customer_is_known` → quarantined |
| `O-1010` | Status `pending` is not one the warehouse knows | `status_is_recognised` → warning only, the row still loads |
| `O-1006` | Ordered `SKU-900`, which is not in the catalogue | The left join leaves `category` null rather than dropping the sale |
| `O-1011` | Ordered on 9 March | `in_scope` holds it back when `run_date` is 5 March |
| `gift_wrap` column | The storefront added a column nobody asked for | `landing_orders` is `enforcement: additive`, so it is allowed through and ignored |

Running `orders_daily` with `--param run_date=2026-03-05` therefore loads nine
order lines, quarantines three rows and raises one warning.
