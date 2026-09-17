# Spark Foundry

A framework for building Apache Spark ETL pipelines out of **metadata as code**:
the schemas, the transformations, the quality rules and the outputs are declared
in version-controlled YAML, and the framework checks all of it — statically,
without a cluster and without data — before Spark is ever started.

```
foundry validate --metadata examples/retail/metadata
examples/retail/metadata/pipelines/orders_daily.yaml:57:37: error[unknown-column]: step
  'priced_lines' (derive): column 'line_total' refers to column 'unit_pric', which is
  not available here
        hint: did you mean 'unit_price'?
```

That message took 1.2 seconds and no Spark session. The same mistake in a
hand-written Spark job surfaces forty minutes into a nightly load.

---

## The idea

Declarative ETL tools usually stop at "the YAML parsed". The column names inside
it, the SQL fragments, the types, whether the last step can actually fill the
table it writes to — all of that stays opaque until something runs.

Spark Foundry treats the metadata the way a compiler treats source code.

- **Every SQL expression is parsed** with Spark's own `CatalystSqlParser` and
  the columns it reads are checked against the schema that will reach that step.
  No session, no cluster, no data — just a parser.
- **Every step's output schema is computed** before anything runs, so a sink
  that cannot satisfy its table's contract is a build failure, not an outage.
- **Every column is traced back to its sources**, through joins, aggregations
  and renames, and published in a generated catalogue.
- **Every transform is then held to its plan at run time.** After each step, the
  schema the planner predicted is compared against the schema Spark actually
  produced. If a transform's `plan()` and `execute()` ever disagree, the run
  stops and names the step — because a static guarantee nobody re-checks is a
  static guarantee that will quietly stop being true.

That last point is the load-bearing one, and it is why `plan` and `execute` live
side by side in a single class per transform rather than in a separate model of
what the engine does.

## What a pipeline looks like

```yaml
kind: pipeline
name: orders_daily
quarantine: rejected_rows

params:
  - name: run_date
    type: date
    required: true

sources:
  - alias: orders
    dataset: landing_orders

steps:
  - id: typed_orders
    type: select
    from: orders
    columns:
      - { name: order_id, expr: "nullif(trim(order_id), '')" }
      - { name: quantity, expr: "quantity", type: int }
      - { name: unit_price, expr: "unit_price", type: "decimal(12,2)" }

  - id: in_scope
    type: filter
    from: typed_orders
    condition: "to_date(ordered_at) <= ${run_date}"

  - id: latest_lines
    type: deduplicate
    from: in_scope
    keys: [order_id, sku]
    orderBy: [received_at desc]

expectations:
  - name: customer_is_known
    on: priced_lines
    rule: referential
    columns: [customer_id]
    references: customers
    action: quarantine

sinks:
  - from: curated_lines
    dataset: curated_order_lines
```

A schema is declared once and referenced by name; a dataset binds a schema to a
location and a format; a pipeline reads datasets, transforms them and writes them
back. Nothing describes a column type inline, so there is exactly one place to
change when an upstream system changes.

## Try it

Requires Java 21 and Maven. Everything else is fetched by the build.

```bash
cd spark-foundry
mvn -q -DskipTests package

./foundry validate --metadata examples/retail/metadata
./foundry plan     --metadata examples/retail/metadata --pipeline orders_daily
./examples/retail/run-demo.sh          # runs both example pipelines into a temp warehouse
```

`run-demo.sh` loads the committed seed data and prints:

```
succeeded in 16119 ms
  wrote 9 rows to curated_order_lines (…/curated/order_lines)
  wrote 8 rows to daily_revenue (…/marts/daily_revenue)
  quarantined 3 rows into rejected_rows
  diverted order_identifiers_present on priced_lines (not_null): 1 of 12 rows failed, quarantined
  diverted lines_are_worth_something on priced_lines (expression): 1 of 11 rows failed, quarantined
  diverted customer_is_known on priced_lines (referential): 1 of 10 rows failed, quarantined
  WARN     status_is_recognised on priced_lines (accepted_values): 1 of 9 rows failed
  ok       one_row_per_line on curated_lines (unique): 9 rows checked
  ok       something_was_loaded on curated_lines (row_count): row count 9 is within bounds
```

Fourteen rows land, one is held back by the run date, one is a re-delivery that
loses to a newer version, three break a rule and are set aside with the evidence,
and nine make it into the warehouse. Every one of those numbers is asserted in
[`RetailExampleIT`](foundry-core/src/test/java/dev/foundry/core/run/RetailExampleIT.java),
worked out by hand from the CSVs before the pipeline was written.

## The commands

| Command | What it does | Starts Spark? |
| --- | --- | --- |
| `foundry validate` | Parses and checks every schema, dataset and pipeline | no |
| `foundry plan` | Prints the graph, every step's columns and where each came from | no |
| `foundry docs` | Generates the data catalogue, diagrams and lineage included | no |
| `foundry run` | Executes a pipeline and writes a run manifest | yes |

Three of the four never start Spark, which is the point: `foundry validate` is
meant to live in a pre-commit hook.

## What it gives you

**Schemas as contracts.** A dataset declares its schema and how hard to enforce
it — `strict`, `additive` or `none`. Reading supplies the declared types instead
of inferring them, and matches CSV columns *by header rather than by position*,
because Spark's default is to match positionally and silently rename, which turns
a producer reordering two string columns into swapped data.

**Thirteen transforms**, each of which plans and executes in one class:
`select`, `derive`, `filter`, `rename`, `drop`, `cast`, `join`, `union`,
`aggregate`, `distinct`, `deduplicate`, `window`, `sql`. Adding one is a single
class and a single registry line — the loader never knew what a transform was.

**Eight quality rules** — `not_null`, `unique`, `accepted_values`, `range`,
`regex`, `expression`, `row_count`, `referential` — each of which can `warn`,
`fail`, or `quarantine`. Quarantine diverts the offending rows to a single
warehouse-wide table, as JSON alongside the pipeline, step and rule that turned
them away, and lets the rest of the load continue.

**A run manifest** written next to the data on every run: the SHA-256 fingerprint
of the metadata that drove it, the arguments, per-step row counts and schemas,
what every rule found, and column lineage for everything written. A table can
always be traced back to an exact metadata revision — and two runs that disagree
are explained by a `git diff` between their fingerprints.

**A generated catalogue** ([`docs/catalog.md`](docs/catalog.md)) with Mermaid
graphs, every schema, and a lineage table for every written column. It is derived,
not maintained, so it cannot describe a pipeline that no longer exists.

## Diagnostics

Every rejection carries a file, a line, a column and — wherever there is a
sensible one — a suggestion. A sample of what is caught before Spark starts:

| | |
| --- | --- |
| `unknown-column` | an expression, rule or join key naming a column that will not be there |
| `unknown-key` | a mistyped configuration key, rather than silently ignoring it |
| `contract-type-mismatch` | a step producing `decimal(8,4)` for a `decimal(14,2)` column |
| `contract-extra-column` | a strict sink fed a column its schema never declared |
| `ambiguous-column` | a name on both sides of a join, caught at the join |
| `cycle` | steps depending on each other, with the loop printed in order |
| `unknown-relation` | a `sql` step reading a table nobody wired up |
| `cannot-quarantine` | a whole-dataset rule asked to set rows aside |
| `invalid-parameter` | `--param run_date=2026-02-31`, rejected at the command line |

A failed step suppresses the complaints from everything downstream of it, so the
report has one entry per mistake rather than one per consequence.

## Layout

```
foundry-metadata/   the model, the YAML loader and the diagnostics. No Spark
                    dependency at all: metadata parses and cross-checks with no
                    engine on the classpath
foundry-core/       schema compilation, static expression analysis, the transform
                    and rule libraries, the planner, the runner, the catalogue
foundry-cli/        the foundry command
examples/retail/    a two-pipeline warehouse with committed, deliberately
                    imperfect seed data
docs/               the metadata reference, and the generated catalogue
```

## Built and proven

Java 21, Apache Spark 4.0 (Scala 2.13), Maven. SnakeYAML is the only third-party
dependency outside Spark and JUnit.

159 tests, run by `mvn test` in about 40 seconds:

- the loader, the diagnostics and the suggestion engine
- one test per class of authoring mistake, asserting the code *and* the hint
- every transform's planned output shape, worked out without Spark
- [`AllTransformsIT`](foundry-core/src/test/java/dev/foundry/core/run/AllTransformsIT.java) —
  all thirteen transforms and all eight rules in one pipeline, run for real, with
  the planned schema checked against the produced schema for every step. It fails
  if a transform or a rule is ever added without being covered here.
- [`PlanViolationIT`](foundry-core/src/test/java/dev/foundry/core/run/PlanViolationIT.java) —
  transforms whose `plan()` deliberately lies about what `execute()` does, proving
  the runner catches each kind of disagreement and writes nothing. Without it the
  verification code would itself be untested, since the shipped transforms all
  agree with their plans.
- [`ContractEnforcementIT`](foundry-core/src/test/java/dev/foundry/core/run/ContractEnforcementIT.java) —
  including the reordered-CSV case that plain Spark reads wrong.
- the two example pipelines end to end, asserted row by row and figure by figure.

## Further reading

- [Metadata reference](docs/metadata-reference.md) — every document kind, every
  transform, every rule, every diagnostic code.
- [Generated catalogue](docs/catalog.md) — what `foundry docs` produces for the
  retail example.
- [Seed data](examples/retail/seed/README.md) — what is wrong with each row, and
  which rule catches it.
