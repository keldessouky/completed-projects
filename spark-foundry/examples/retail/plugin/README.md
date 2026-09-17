# Example plugin

What a team's own transform project looks like.

It is deliberately not part of the framework: a different group id, its own
tests, and exactly two dependencies — [`foundry-api`](../../../foundry-api) for
the interface and Spark for the `Dataset`. Nothing here can reach the planner,
the loader or the runner, which is the point of keeping the API in a module of
its own.

```
src/main/java/com/example/retail/OrderRiskScore.java   the transform
src/test/java/com/example/retail/OrderRiskScoreTest.java   its tests
```

## The transform

[`OrderRiskScore`](src/main/java/com/example/retail/OrderRiskScore.java) scores
each order line for how much it wants a second look. It could be written as one
enormous `CASE` expression; it should not be. The rules change often, each has a
reason someone will ask about, and the weights get tuned by argument. As Java
they are a list of named records: adding a rule is one line, the reasons a row
scored what it did come out as data rather than being reverse-engineered from the
total, and the whole thing has tests that run in milliseconds without a
warehouse.

That is the line to look for when deciding where a piece of logic belongs.
Shaping data — projecting, joining, aggregating, deduplicating — is better
declared, because the shape is what everything downstream depends on. Business
rules with names and histories are better in code.

## Its tests

Note what is not in them: no metadata, no planner, no warehouse, no pipeline.

```java
Dataset<Row> result = new OrderRiskScore().apply(
        TransformInput.of(orders).withOption("highValueThreshold", "100.00"));
```

A custom transform is a class with one method taking one argument, so its tests
build that argument and call it. Each of the five scoring rules is exercised on
its own, because being able to do that was the reason for moving them out of SQL.

## How it is wired up

Nothing about its output shape is decided here. The step in
[`order_risk.yaml`](../metadata/pipelines/order_risk.yaml) names the class, sets
its options, and declares what it produces:

```yaml
- id: scored
  type: java
  class: com.example.retail.OrderRiskScore
  from: lines
  options:
    highValueThreshold: "${high_value_threshold}"
  schema: retail.orders.risk
  lineage:
    risk_score: [line_total, discount, quantity, unit_price, category, channel, status]
```

Then:

```bash
mvn -DskipTests package                  # from the project root

./foundry run --metadata examples/retail/metadata --pipeline order_risk \
  --data ./warehouse \
  --plugins examples/retail/plugin/target/retail-transforms-0.1.0.jar
```

See [the metadata reference](../../../docs/metadata-reference.md#writing-a-transform-in-java)
for the interface in full, and why the contract lives in the metadata rather than
in the class.
