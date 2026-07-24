<!--
  destination: docs/context/domain-glossary.md
  Layer: PROJECT context — on demand.

  Why this file punches above its weight: agents name things constantly, and
  without a glossary they improvise. A shared vocabulary keeps generated code,
  APIs, and docs consistent with how the business actually talks — and stops
  the classic drift where the same concept is `cart`, `basket`, and `order`
  in three different modules.
-->

# Domain Glossary — {Product Name}

Rule for agents and humans alike: use the **Code name** column verbatim in identifiers, API fields, events, and docs. If a concept isn't here and you need it, add it in the same PR.

| Term | Means | Code name | Not to be confused with |
|---|---|---|---|
| Order | A confirmed purchase with payment intent created | `Order` | Cart (pre-checkout) |
| Cart | Items a customer intends to buy; no payment yet | `Cart` | Order |
| Fulfilment | The process of picking, packing, shipping an order | `Fulfilment` (British spelling, everywhere) | Delivery (the carrier leg only) |
| SKU | Sellable variant of a product (size/color) | `Sku` | Product (the parent) |
| Refund | Money returned for a paid order; partial allowed | `Refund` | Cancellation (pre-payment void) |

<!-- Add rows as the domain grows. Aim for the 20–40 terms that actually cause
confusion — not a dictionary. The "Not to be confused with" column is the
highest-value part; it encodes the distinctions newcomers (and agents) miss. -->

## Status vocabularies

<!-- Enumerations agents must not invent. Example: -->

Order status: `draft → pending_payment → paid → fulfilling → shipped → delivered` (+ `cancelled`, `refunded`). These are the only values; adding one is a schema change with an ADR.
