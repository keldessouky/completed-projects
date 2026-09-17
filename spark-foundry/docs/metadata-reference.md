# Metadata reference

Everything Spark Foundry reads is YAML. A metadata root is a directory tree; the
framework walks it, reads every `.yaml` and `.yml` file, and indexes what it
finds by name. Layout inside the tree is yours to choose — the example uses
`schemas/`, `datasets/` and `pipelines/`, but nothing depends on it.

Every document begins with a `kind:`. A file may hold several documents,
separated by `---`.

```yaml
kind: schema     # a data contract
kind: dataset    # a contract bound to a place and a format
kind: pipeline   # what to read, what to do, what to check, what to write
```

Unrecognised keys are **errors**, not ignored. A mistyped `colums:` is reported
with `columns` suggested, which is the whole reason the loader keeps YAML's node
tree rather than binding straight onto Java objects: every value keeps the line
and column it was written on.

---

## Contents

- [`kind: schema`](#kind-schema)
- [`kind: dataset`](#kind-dataset)
- [`kind: pipeline`](#kind-pipeline)
  - [Parameters](#parameters)
  - [Sources](#sources)
  - [Steps](#steps)
  - [Expectations](#expectations)
  - [Sinks and quarantine](#sinks-and-quarantine)
- [Transform reference](#transform-reference)
- [Quality rule reference](#quality-rule-reference)
- [Expressions and types](#expressions-and-types)
- [Diagnostic codes](#diagnostic-codes)

---

## `kind: schema`

A named contract. Declared once, referenced by name, never restated inline.

```yaml
kind: schema
name: retail.orders.curated      # dot-separated identifiers
version: 1                       # optional, default 1
description: One row per order line.
fields:
  - name: order_id
    type: string
    nullable: false              # optional, default true
    description: Storefront order identifier.
    tags: [key, "pii:none"]      # optional, free-form
```

| Key | Required | Notes |
| --- | --- | --- |
| `name` | yes | dot-separated identifiers, e.g. `retail.orders.curated` |
| `version` | no | recorded and published; does not change behaviour |
| `description` | no | carried into the generated catalogue |
| `fields` | yes | at least one |

Each field takes `name`, `type`, and optionally `nullable`, `description` and
`tags`. Descriptions and tags are written into Spark's per-column metadata, so
they survive into the Parquet files themselves.

---

## `kind: dataset`

A contract bound to somewhere data actually lives.

```yaml
kind: dataset
name: landing_orders
schema: retail.orders.landing
format: csv
location: "${data}/landing/orders"
enforcement: additive            # strict | additive | none, default strict
writeMode: overwrite             # overwrite | append | error_if_exists | ignore
partitionBy: [order_date]        # optional
options:                         # passed straight to Spark's reader and writer
  header: "true"
description: The storefront's nightly export.
```

### `location`

May contain `${placeholders}`. `${data}` is the warehouse root given to
`foundry run --data`; anything else must be a parameter the running pipeline
declares. The same definition therefore serves a developer's temporary directory
and a production bucket without changing.

### `enforcement`

The knob that decides whether a contract is a promise or a suggestion. It is
per-dataset because a landing zone fed by someone else's export and a table this
warehouse owns deserve different answers.

| Value | On read | On write |
| --- | --- | --- |
| `strict` | every declared column must be present, of the declared type, with no extras; a value that will not parse fails the run rather than becoming null | an undeclared column is an error |
| `additive` | every declared column must be present and right; extra columns are read and carried along | extra columns are dropped to the contract |
| `none` | nothing is checked | nothing is checked |

Two habits of ordinary Spark code are deliberately not repeated. Schemas are
**supplied, never inferred**, so a column of digits that arrives with one letter
in it does not silently become a string and null out every calculation
downstream. And CSVs are read **by header, not by position** (`enforceSchema=false`),
because Spark's default is to match a supplied schema positionally and rename the
columns — so a producer reordering two string columns silently swaps their
contents.

---

## `kind: pipeline`

```yaml
kind: pipeline
name: orders_daily
description: ...
quarantine: rejected_rows        # required only if some rule quarantines
params: [...]
sources: [...]
steps: [...]
expectations: [...]
sinks: [...]
```

### Parameters

```yaml
params:
  - name: run_date
    type: date                   # string | int | decimal | boolean | date | timestamp
    required: true               # default: true when no default is given
    default: "0.01"
    description: ...
```

A parameter is written `${name}` in an expression, a query or a location. Before
the surrounding expression is parsed it is replaced by a **SQL literal of the
declared type** — not by the caller's raw text — so a parameter cannot change the
shape of an expression, and a date that is not a date (`--param run_date=2026-02-31`)
is rejected at the command line rather than becoming a puzzling SQL error later.

When planning without arguments, each parameter is filled with a stand-in of the
right type, so `foundry plan` can parse and check every expression whether or not
anything was supplied.

### Sources

```yaml
sources:
  - alias: orders                # the name steps use
    dataset: landing_orders
```

The alias is what steps refer to, so renaming the underlying dataset is one line
here rather than an edit to every step that reads it. Expectations may be
attached to a source alias, which is where a broken delivery is cheapest to catch.

### Steps

```yaml
steps:
  - id: typed_orders             # unique within the pipeline
    type: select                 # see the transform reference
    description: ...             # optional
    # ... the rest of the keys belong to the transform
```

`id`, `type` and `description` are the only keys the framework owns. Everything
else is handed to the transform, which validates it — so a transform is a single
class carrying its own configuration, its own checks and its own diagnostics.

Steps may be declared in any order; the planner works out the dependency graph
and runs them in topological order. A loop is an error with the cycle printed.

### Expectations

```yaml
expectations:
  - name: customer_is_known      # optional; defaults to <rule>_on_<target>
    on: priced_lines             # a step id or a source alias
    rule: referential
    action: quarantine           # warn | fail | quarantine, default fail
    description: ...
    # ... the rest of the keys belong to the rule
```

Expectations on the same target run in the order they are declared, and each sees
what the one before it left behind. That matters for quarantine: once the rows
with no customer have been set aside, the revenue-by-customer check that follows
is asking its question of data that can answer it.

| Action | Effect |
| --- | --- |
| `warn` | recorded in the manifest; the data is untouched |
| `fail` | the run stops **before anything is written**, so a bad load never half-lands |
| `quarantine` | the offending rows are diverted; the rest continues |

Rules that only warn or fail never touch the data — a measurement that changed
what it measured would be a poor one.

### Sinks and quarantine

```yaml
sinks:
  - from: curated_lines
    dataset: curated_order_lines
    mode: append                 # optional, overrides the dataset's writeMode
```

Before Spark starts, the planner checks that the named step can actually satisfy
the dataset's schema: every declared column present, and the right type wherever
the planner committed to one.

A pipeline using `action: quarantine` must declare `quarantine: <dataset>`. That
dataset's schema must be exactly:

| Column | Type |
| --- | --- |
| `pipeline` | `string not null` |
| `step` | `string not null` |
| `expectation` | `string not null` |
| `rule` | `string not null` |
| `detected_at` | `timestamp not null` |
| `row` | `string not null` |

One table serves every pipeline and every step, so the offending row is stored as
JSON. That is the trade that makes a single quarantine table possible: rows from a
five-column landing file and a forty-column joined fact sit side by side, each
labelled with what turned it away.

---

## Transform reference

Every transform takes its input by name and produces a named result. Unless
stated otherwise, output column order is exactly what is written below — column
order is part of what the runner verifies, so it is stable by construction.

### `select`

Produces exactly the listed columns, in the listed order.

```yaml
type: select
from: orders
columns:
  - order_id                                              # carried through as is
  - { name: sku, expr: "upper(trim(sku))" }               # computed
  - { name: net, expr: "quantity * price", type: "decimal(14,2)" }
```

A bare string carries a column through untouched, keeping its type. A block with
`expr:` computes one. Declaring `type:` is not a hint: the transform casts to it,
so the planner then *knows* the type and the runner verifies it. Without one, the
column is reported as `inferred` and Spark settles it at run time.

### `derive`

Adds or replaces columns, carrying the rest of the input through. A column whose
name already exists is replaced in place, keeping its position.

```yaml
type: derive
from: latest_lines
columns:
  - { name: line_total, expr: "quantity * unit_price - discount", type: "decimal(14,2)" }
```

### `filter`

```yaml
type: filter
from: typed_orders
condition: "to_date(ordered_at) <= ${run_date}"
```

### `rename`

```yaml
type: rename
from: orders
columns:
  kind: event_kind       # oldName: newName
```

Unlike Spark's `withColumnRenamed`, renaming a column that is not there is an
error — that silence is how a typo stays invisible until something much later
cannot find a column that was never created.

### `drop`

```yaml
type: drop
from: renamed
columns: [version, internal_flag]
```

Dropping a column that is not there is an error too: it almost always means the
pipeline above changed shape.

### `cast`

```yaml
type: cast
from: derived
columns:
  amount: "decimal(14,4)"
  at: timestamp
```

The point at which the planner stops guessing: after a cast, a column's type is
known, declared, and verified against the result on every run.

### `join`

```yaml
type: join
left: priced_lines
right: customer_facts
on: [customer_id]                # shared key columns...
# condition: "left_step.sku = right_step.line_sku"   # ...or an explicit condition
how: inner                       # inner | left | right | full | left_semi | left_anti | cross
```

Output is **the join keys, then the left's remaining columns, then the right's**.
With `condition:` instead of `on:`, it is all of the left's columns then all of
the right's, and each side is addressable by the name of the step it came from.

A column name appearing on both sides that is not a join key is an error at the
join, rather than an ambiguous reference discovered later — the fix, renaming one
of them, is stated where the clash is. Outer joins mark the null-padded side's
columns nullable; a `full` join coalesces the keys.

### `union`

```yaml
type: union
inputs: [clicks, buys]
byName: true                     # default
allowMissingColumns: false       # default
```

Matching is by name by default, because matching by position is how two pipelines
that both look right end up with the city in the postcode column. A type is kept
only where every input agrees on it.

### `aggregate`

```yaml
type: aggregate
from: curated_lines
groupBy: [order_date, region]
measures:
  - { name: revenue, expr: "sum(line_total)", type: "decimal(18,2)" }
  - { name: orders, expr: "count(distinct order_id)", type: bigint }
```

Output is the grouping columns followed by the measures, in the order declared —
so a new measure appended to the metadata appends a column to the table rather
than reshuffling it.

### `distinct`

```yaml
type: distinct
from: deduped
columns: [actor]                 # optional; projects first when given
```

### `deduplicate`

```yaml
type: deduplicate
from: in_scope
keys: [order_id, sku]
orderBy: [received_at desc]
```

Keeps one row per key, chosen by an explicit ordering. Distinct from `distinct`,
and the one people actually need: change feeds and re-delivered extracts arrive
with several versions of the same record, and "the latest one" is a business
decision that belongs next to the key it applies to.

### `window`

```yaml
type: window
from: recast
partitionBy: [customer_id]
orderBy: [ordered_at desc, order_id desc]
frame:                           # optional
  type: rows                     # rows | range
  start: unbounded preceding     # a row offset, or unbounded preceding / current row / unbounded following
  end: current row
columns:
  - { name: recency_rank, expr: "row_number()", type: int }
  - { name: running, expr: "sum(amount)", type: "decimal(20,4)" }
```

One window per step, applying to every column it produces. A step whose columns
each need a different frame is really several steps, and writing it that way keeps
each frame next to what it produces.

### `sql`

```yaml
type: sql
inputs: [totals, typed_customers]
query: >-
  select t.customer_id, c.full_name, t.lifetime_spend
  from totals t join typed_customers c on c.customer_id = t.customer_id
outputs:
  - { name: customer_id, type: string }
  - { name: full_name, type: string }
  - { name: lifetime_spend, type: "decimal(20,2)" }
```

The escape hatch, and it still has to declare itself. The inputs are registered as
temporary views under exactly the names given, and the declared `outputs` are
selected from the result — so a `sql` step is under the same contract as any other
and cannot quietly change the shape of everything downstream.

The query text is checked without a session too: it is parsed with Spark's own
parser, and every table it reads must be a declared input or a CTE the query
itself defines.

**One limitation, stated plainly.** This is the only transform that cannot report
exact column lineage. Working out that `sum(l.line_total) as spend` reads
`lines.line_total` means resolving the query against a catalog — that is,
re-implementing Spark's analyser, which would be a second model of the engine's
behaviour and would drift from it. So a `sql` step attributes each output column
to the same-named column of every input that has one, and reports nothing rather
than guessing when a name matches none. A column with no lineage in the catalogue
is therefore a signal: it came out of a `sql` step under a new name.

---

## Quality rule reference

| `rule:` | Keys | Can quarantine | Checks |
| --- | --- | --- | --- |
| `not_null` | `columns` | yes | every listed column has a value on every row |
| `unique` | `columns` | yes | no two rows share the same combination |
| `accepted_values` | `column`, `values`, `allowNull` | yes | the column only holds one of a fixed set |
| `range` | `column`, `min`, `max`, `minInclusive`, `maxInclusive`, `allowNull` | yes | the column stays within bounds |
| `regex` | `column`, `pattern`, `allowNull` | yes | the column matches a regular expression |
| `expression` | `expr` | yes | an arbitrary boolean expression holds for every row |
| `row_count` | `min`, `max` | no | the step produced a plausible number of rows |
| `referential` | `columns`, `references`, `referencedColumns` | yes | every key exists in another step's result |

`allowNull` defaults to `true`, because "missing" and "not one of these" are
different complaints — use `not_null` for the first. A rule that returns a null
verdict counts the row as failing: a rule that cannot tell has not been satisfied.

`row_count` is the only whole-dataset rule, and the only one that cannot
quarantine — "there should be between 1 and 10,000 orders today" is not a
statement any single row can break, so there is nothing to set aside. It is also
the rule that catches what no row-level check ever will: an empty delivery, or a
join that fanned out and multiplied the data tenfold. Both produce rows that are
individually perfect.

`referential` is implemented as a left join against the distinct keys of the
referenced result, which is what makes orphans quarantinable: an order whose
customer is missing should not block the other ten thousand, but must not be
counted in a customer-level total either.

---

## Expressions and types

**Types** use Spark's own DDL syntax — `string`, `int`, `bigint`, `boolean`,
`date`, `timestamp`, `decimal(p,s)`, `array<t>`, `map<k,v>`,
`struct<name:type,...>`. The metadata does not invent a type language; the
declared text is handed to Spark's parser, so anything Spark can express can be
declared, and the two cannot drift apart.

**Expressions** are Spark SQL. Every one of them is parsed at validation time and
the columns it reads are checked against the schema that will reach that step:

- a misspelled column is an error with the nearest real one suggested;
- a struct is walked into, so `address.postcde` is caught against
  `struct<city:string,postcode:string>`;
- reading into something that is not a struct is caught;
- lambda parameters (`transform(tags, t -> upper(t))`) are recognised as bound by
  the expression rather than supplied by the input;
- a column the planner deliberately left untyped is not walked into, and not
  complained about — it never claimed a type, so it cannot claim a mistake.

None of this needs a `SparkSession`. The parser is a pure function from text to a
syntax tree.

---

## Diagnostic codes

Every diagnostic carries a stable code, so rules can be looked up here and
asserted on in tests.

### Structure and syntax

| Code | Meaning |
| --- | --- |
| `malformed-yaml` | the file is not valid YAML |
| `empty-document` | the file has no document in it |
| `unreadable-file` | the file could not be read |
| `missing-kind` / `unknown-kind` | `kind:` absent, or not one of schema/dataset/pipeline |
| `duplicate-key` | a key written twice; the later one would silently win |
| `unknown-key` | a key the document or transform does not understand |
| `missing-key` | a required key is absent |
| `non-scalar-key` | a key that is not a plain string |
| `expected-mapping` / `expected-list` / `expected-scalar` | the wrong shape for what was expected |
| `expected-integer` / `expected-number` / `expected-boolean` | a value that will not convert |
| `invalid-enum` | not one of the legal values |
| `invalid-identifier` / `invalid-name` | not a legal identifier or dotted name |
| `skipped-element` | an element was dropped because it could not be read |

### Definitions and references

| Code | Meaning |
| --- | --- |
| `duplicate-definition` | two documents claim the same name |
| `duplicate-field` / `duplicate-column` / `duplicate-step` / `duplicate-source` / `duplicate-param` / `duplicate-expectation` | declared twice |
| `unknown-schema` / `unknown-dataset` / `unknown-pipeline` | a name nothing defines |
| `unknown-transform` / `unknown-rule` | no such transform or rule |
| `unknown-input` / `unknown-target` | a step, sink or expectation naming something that is not a source or step |
| `unknown-column` | a column that will not be available at that point |
| `unknown-partition-column` | partitioning by a column the schema does not declare |
| `unknown-parameter` / `missing-parameter` / `invalid-parameter` | a parameter undeclared, unsupplied, or of the wrong type |
| `unknown-relation` | a `sql` step reading a table that is not one of its inputs |
| `unknown-reference` | a `referential` rule pointing at nothing |
| `name-collision` | a step id that is also a source alias |
| `self-reference` / `self-join` | a step reading itself |
| `cycle` | steps depending on each other in a loop |

### Types, expressions and contracts

| Code | Meaning |
| --- | --- |
| `invalid-type` / `missing-type` | a type Spark cannot parse, or none given |
| `invalid-expression` / `empty-expression` / `invalid-query` | SQL that will not parse |
| `not-a-struct` | reading a field out of something that is not a struct |
| `contract-missing-column` | a sink cannot supply a column its schema requires |
| `contract-type-mismatch` | a sink's type disagrees with the contract |
| `contract-extra-column` | a strict sink fed an undeclared column |
| `quarantine-schema` | the quarantine dataset's schema cannot hold rejected rows |

### Transform and rule configuration

| Code | Meaning |
| --- | --- |
| `ambiguous-column` | a non-key column on both sides of a join |
| `missing-join-condition` / `conflicting-join-condition` | a join with no condition, or with both `on` and `condition` |
| `union-mismatch` | inputs to a union that do not line up |
| `missing-order` / `invalid-order` | an ordering that is required, or unreadable |
| `invalid-frame` | a window frame that cannot be read |
| `reserved-column` | the input already has a column the step or rule needs for its own use |
| `no-columns` | a step that would produce nothing |
| `cannot-quarantine` | a whole-dataset rule asked to quarantine |
| `missing-quarantine` | a quarantine action with no quarantine dataset declared |
| `impossible-range` | a `row_count` whose min exceeds its max |
| `invalid-pattern` | a `regex` rule whose pattern will not compile |
| `mismatched-key` | a `referential` rule whose key lists differ in length |
| `conflicting-options` | options that contradict each other |

### Warnings

These do not stop a build.

| Code | Meaning |
| --- | --- |
| `unused-step` / `unused-source` | nothing reads it and nothing writes it |
| `no-sinks` | a pipeline that writes nothing |
| `empty-pipeline` / `empty-schema` | no steps, or no fields |
| `global-aggregate` | an aggregate with no grouping columns |
| `single-input-union` | a union of one input |
| `whole-row-unique` | a `unique` rule over every column |
| `redundant-default` | a default on a required parameter |
