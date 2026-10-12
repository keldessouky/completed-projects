// DVA-C02 Domain 1, part 2: AWS Lambda and data stores.
import type { Deck } from '../../../game/types';
import { checkpoint, lesson, q } from '../kit';

export const dvaLambda: Deck = {
  id: 'dva-lambda',
  name: 'Lambda and Data Stores',
  subtitle: 'Domain 1 · 32% of the exam (part 2 of 2)',
  outcome: 'Configure and debug Lambda functions, and design DynamoDB tables, queries and caches that scale.',
  hue: 35,
  domain: 'dva-d1',
  levels: [
    lesson({
      id: 'dva-lambda-config',
      title: 'Lambda, Configured',
      system: 'Function Bay',
      skills: ['aws-compute'],
      brief: `**ARIA:** Lambda looks simple until something times out, throttles or can't reach the database. Learn every setting the exam asks about.`,
      lesson: `## Settings

| Setting | Notes |
|---|---|
| **Handler** | The function Lambda calls (\`index.handler\`) |
| **Runtime** | Node.js, Python, Java, .NET, Ruby, or custom/container image |
| **Memory** | 128 MB to 10,240 MB; **CPU scales with memory** |
| **Timeout** | Up to **900 seconds (15 minutes)** |
| **Environment variables** | Configuration per function; encrypt secrets with KMS (or better, use Secrets Manager) |
| **Ephemeral storage** | \`/tmp\` from 512 MB up to 10 GB |
| **Layers** | Shared libraries or dependencies packaged separately (up to 5 per function) |
| **Extensions** | Companion processes for monitoring, security and config |

Put expensive set-up (SDK clients, DB connections) **outside the handler** so warm invocations reuse it.

## How functions are invoked

| Type | Who | Errors |
|---|---|---|
| **Synchronous** | API Gateway, SDK \`Invoke\`, ALB | The caller gets the error and decides whether to retry |
| **Asynchronous** | S3, SNS, EventBridge | Lambda **retries twice**, then sends to an **on-failure destination** or **dead-letter queue** |
| **Event source mapping** (polling) | SQS, Kinesis, DynamoDB Streams | Lambda polls and batches; failures retry per the source; **partial batch responses** report only the failed items |

**Destinations** (on success and on failure, for async invocations) carry more detail than DLQs and are the recommended choice.

## Concurrency

- **Concurrency** = invocations running at the same moment. Accounts have a Regional limit (1,000 by default, can be raised); over it, requests are **throttled** (429).
- **Reserved concurrency:** guarantees, and caps, capacity for one function.
- **Provisioned concurrency:** keeps environments **initialised** to remove **cold starts** (SnapStart helps Java, Python and .NET).

## Versions and aliases

**Versions** are immutable snapshots; **aliases** (\`prod\`, \`beta\`) point to versions and can **split traffic** between two (weighted alias) for canary releases.

## Lambda in a VPC

Attach to private subnets to reach **private resources** (RDS, ElastiCache). The function then has **no internet access** unless the subnets route through a **NAT gateway**; reach AWS services via **VPC endpoints**. Use **RDS Proxy** to pool database connections.`,
      questions: [
        q('A Lambda function times out after 3 seconds while calling a slow API that takes 10 seconds. What should be changed?', ['Increase the function timeout', 'Decrease memory', 'Add a layer', 'Enable reserved concurrency of 0'], 0, 'The default timeout is 3 seconds; raise it (up to 900).'),
        q('A function in a VPC can read from RDS but can no longer call a public third-party API. Why?', ['VPC-attached functions have no internet access unless their subnets route through a NAT gateway', 'Lambda can never call external APIs', 'The memory is too low', 'RDS blocks outbound calls'], 0, 'Private subnets need a NAT gateway for internet access.'),
        q('S3 triggers a Lambda function asynchronously, and some events fail repeatedly. How can the failed events be captured with full context?', ['Configure an on-failure destination (or a DLQ)', 'Increase the timeout to 15 minutes', 'Switch to synchronous invocation', 'Use a layer'], 0, 'Async invocations retry twice, then go to the on-failure destination.'),
        q('A latency-sensitive API suffers from cold starts after idle periods. What fixes this most directly?', ['Provisioned concurrency', 'Reserved concurrency', 'A larger /tmp', 'More environment variables'], 0, 'Provisioned concurrency keeps environments warm.'),
        q('Where should a database connection be created so warm invocations can reuse it?', ['Outside the handler function (in the initialisation code)', 'Inside the handler on every call', 'In an environment variable', 'In a layer\'s README'], 0, 'Initialisation code runs once per execution environment.'),
        q('A team wants to send 10% of traffic to a new function version before a full release. What should it use?', ['A weighted alias pointing to both versions', 'A new Region', 'Reserved concurrency', 'A larger timeout'], 0, 'Weighted aliases split traffic between versions.'),
      ],
    }),
    lesson({
      id: 'dva-dynamodb',
      title: 'DynamoDB for Developers',
      system: 'Key Vault',
      skills: ['aws-databases'],
      brief: `**ARIA:** DynamoDB is fast at any scale, if you design keys and access patterns properly. Get them wrong and you pay for scans and throttles. This is a favourite exam topic.`,
      lesson: `## Keys and indexes

- **Partition key** (hash key): decides which partition stores an item. Choose **high-cardinality** values (user ID, order ID) so traffic spreads evenly; low-cardinality keys (status, date) create **hot partitions**.
- **Sort key** (range key): orders items within a partition; enables range queries (\`begins_with\`, \`between\`).
- **Local secondary index (LSI):** same partition key, different sort key; must be created **with the table**; shares the table's capacity; supports strongly consistent reads.
- **Global secondary index (GSI):** **different partition key** (and sort key); can be added any time; **eventually consistent reads only**; has its own capacity (if it throttles, so do table writes).

## Query vs scan

- **Query:** finds items by partition key (and optionally sort key conditions). Efficient.
- **Scan:** reads the **whole table**, then filters. Slow and expensive; avoid in hot paths. (Parallel scan speeds up big offline scans.)
- **FilterExpression** filters *after* reading: you still pay for what was read. **ProjectionExpression** returns only chosen attributes.
- Results are paginated (1 MB per call): follow \`LastEvaluatedKey\`.

## Consistency and capacity

- **Eventually consistent** reads (default, half the cost) vs **strongly consistent** (\`ConsistentRead: true\`, latest data).
- **1 RCU** = one strongly consistent read per second of up to **4 KB** (or two eventually consistent). **1 WCU** = one write per second of up to **1 KB**.
- **On-demand** or **provisioned** (with auto scaling) capacity. Throttling → \`ProvisionedThroughputExceededException\` → backoff.

## Writing safely

- **Conditional writes** (\`attribute_not_exists(pk)\`) prevent overwriting; **optimistic locking** with a version attribute.
- **Transactions** (\`TransactWriteItems\`) for all-or-nothing changes; **batch** operations for throughput.
- **TTL** deletes expired items free; **DynamoDB Streams** capture changes for Lambda triggers.

## Other data stores

- **ElastiCache** (lazy loading vs write-through) and **DAX** (microsecond reads for DynamoDB) for caching.
- **OpenSearch Service** for full-text search; **S3** for objects, with **lifecycle rules** for data that ages.
- Serialise objects (JSON) consistently so what you write is what you read back.`,
      questions: [
        q('Which partition key spreads writes most evenly for a table of user activity?', ['userId', 'status ("active" or "inactive")', 'country', 'the current date'], 0, 'High-cardinality keys distribute load.'),
        q('An app must look up orders by customer email, which isn\'t the table\'s key, on an existing table. What should be added?', ['A global secondary index on email', 'A local secondary index on email', 'A full table scan on every request', 'A new table for every customer'], 0, 'GSIs can be added any time and use a different partition key.'),
        q('A query must always return the very latest data just written. What should be set?', ['ConsistentRead: true (strongly consistent read) on the table or an LSI', 'Read from a GSI', 'Use a Scan', 'Use TTL'], 0, 'Strongly consistent reads return the latest write; GSIs are eventually consistent.'),
        q('How many RCUs does one strongly consistent read per second of a 9 KB item need?', ['1', '2', '3', '9'], 2, '9 KB rounds up to 12 KB = 3 × 4 KB units.'),
        q('Two users edit the same item at once, and one overwrites the other. What prevents this?', ['Optimistic locking with a version attribute and a conditional write', 'A Scan before every write', 'Eventually consistent reads', 'A larger WCU setting'], 0, 'Conditional writes on a version number detect concurrent changes.'),
        q('A report uses a Scan with a FilterExpression and is slow and expensive. Why?', ['FilterExpression is applied after reading every item, so the whole table is still read', 'Scans never use capacity', 'FilterExpression is applied before reading', 'Scans only read one item'], 0, 'Filters reduce results, not the data read. Redesign for a Query.'),
      ],
    }),
    lesson({
      id: 'dva-lambda-data',
      title: 'Lambda Meets Data',
      system: 'Data Pump',
      skills: ['aws-compute', 'aws-databases'],
      brief: `**ARIA:** Most Lambda functions exist to move or transform data as it arrives. Learn the event source details that decide whether your pipeline loses data or blocks forever.`,
      lesson: `## Processing streams and queues with Lambda

| Source | Notes |
|---|---|
| **SQS** | Batches up to 10,000 (with a batching window); a failed batch returns to the queue unless you report **partial batch failures** (\`ReportBatchItemFailures\`); set the queue's visibility timeout to at least 6× the function timeout; use a DLQ on the queue |
| **Kinesis / DynamoDB Streams** | Processes **in order per shard**; a failing record **blocks the shard** until it succeeds or expires. Use **bisect batch on error**, **maximum retry attempts**, **maximum record age** and an **on-failure destination**; **parallelization factor** for more throughput |
| **S3 events** | Asynchronous; trigger on object created/removed, filter by prefix/suffix. Don't write output to the same prefix that triggers the function (infinite loop) |

## Near-real-time transformation

- **Amazon Data Firehose** can call a Lambda function to **transform records** before delivery to S3 or Redshift.
- **DynamoDB Streams + Lambda**: react to changes (send notifications, update aggregates, replicate).
- **EventBridge Pipes**: source → filter → enrich → target without glue code.

## Testing Lambda code

- Unit-test the handler with **sample event JSON** (\`sam local generate-event\` creates realistic events).
- \`sam local invoke\` / \`sam local start-api\` run functions locally; test in the console with saved test events.
- Use the SDK's ability to **mock clients** (or local emulators) for dependencies.`,
      questions: [
        q('A Lambda function processes SQS batches of 10, and one bad message causes the whole batch to be retried. What fixes this?', ['Return partial batch failures (ReportBatchItemFailures)', 'Increase the batch size to 10,000', 'Use synchronous invocation', 'Remove the DLQ'], 0, 'Partial batch responses retry only the failed messages.'),
        q('A Kinesis-triggered function keeps failing on one bad record, and no newer records in that shard are processed. Which settings help? (Pick the best answer.)', ['Bisect batch on error, maximum retry attempts and an on-failure destination', 'A bigger API Gateway timeout', 'A FIFO queue', 'Reserved concurrency of 0'], 0, 'These settings stop a poison record from blocking the shard forever.'),
        q('A function triggered by new objects in an S3 prefix writes its output to the same prefix and runs endlessly. What is the fix?', ['Write output to a different prefix or bucket, or filter the trigger', 'Increase memory', 'Use provisioned concurrency', 'Enable versioning'], 0, 'Writing to the trigger prefix causes a recursive loop.'),
        q('Records delivered by Amazon Data Firehose must be reformatted before landing in S3. What should be used?', ['A Firehose data transformation Lambda function', 'An SNS filter policy', 'A Route 53 health check', 'A CloudFront function'], 0, 'Firehose can invoke Lambda to transform records.'),
        q('How can developers get realistic sample events to test a Lambda handler locally?', ['sam local generate-event', 'aws s3 ls', 'CloudTrail Insights', 'AWS Artifact'], 0, 'SAM generates sample events for many services.'),
        q('A function must react whenever an item in a DynamoDB table changes. Which feature provides the change events?', ['DynamoDB Streams', 'DynamoDB TTL only', 'DAX', 'A GSI'], 0, 'Streams record item-level changes for triggers.'),
      ],
    }),
    checkpoint({
      id: 'dva-lambda-checkpoint',
      title: 'Checkpoint: Lambda and Data Stores',
      system: 'Function Certification Gate',
      skills: ['aws-compute', 'aws-databases'],
      brief: `**ARIA:** Developer-level scenarios on Lambda configuration, invocation, concurrency and DynamoDB.`,
      lesson: `## Before you start

- Timeout up to 900 s; memory sets CPU; init code outside the handler; layers; /tmp up to 10 GB.
- Sync vs async (2 retries, destinations/DLQ) vs event source mappings (partial batch failures, bisect).
- Reserved vs provisioned concurrency; versions and weighted aliases; VPC needs NAT for internet.
- High-cardinality partition keys; LSI (with table, strong reads) vs GSI (any time, eventual); Query not Scan; RCU 4 KB, WCU 1 KB; conditional writes.`,
      questions: [
        q('A critical function must always have capacity available even when other functions spike, and must never exceed 100 concurrent executions. What should be configured?', ['Reserved concurrency of 100', 'Provisioned concurrency only', 'A larger memory size', 'A weighted alias'], 0, 'Reserved concurrency both guarantees and caps capacity.'),
        q('How many WCUs are needed to write 10 items per second, each 2.5 KB?', ['10', '20', '30', '25'], 2, '2.5 KB rounds up to 3 KB = 3 WCUs per item × 10 = 30.'),
        q('A function\'s CPU-heavy image processing is slow. Which change also gives it more CPU?', ['Increase the memory setting', 'Increase the timeout', 'Add an environment variable', 'Add a layer'], 0, 'Lambda allocates CPU proportionally to memory.'),
        q('A team needs to query orders by customerId and sort them by orderDate, on a new table. Which key design fits?', ['Partition key customerId, sort key orderDate', 'Partition key orderDate only', 'Partition key status', 'No keys; use Scan'], 0, 'Partition by customer; sort by date for range queries.'),
        q('A function in a VPC must call DynamoDB without internet access. What should be added?', ['A DynamoDB gateway VPC endpoint', 'An internet gateway on the function', 'A public IP for the function', 'An SNS topic'], 0, 'VPC endpoints reach AWS services privately.'),
        q('Which statement about GSIs is correct?', ['They support strongly consistent reads', 'They can be added after the table is created and are eventually consistent', 'They must share the table\'s partition key', 'They don\'t use capacity'], 1, 'GSIs are flexible but eventually consistent.'),
        q('An item must only be created if it doesn\'t already exist. What should the PutItem call include?', ['A ConditionExpression of attribute_not_exists(pk)', 'A FilterExpression', 'ConsistentRead: true', 'A ProjectionExpression'], 0, 'Conditional writes enforce create-only.'),
        q('Many Lambda functions exhaust an RDS database\'s connections during spikes. What helps?', ['Amazon RDS Proxy', 'A bigger Lambda timeout', 'DynamoDB Streams', 'A larger /tmp'], 0, 'RDS Proxy pools and reuses connections.'),
      ],
    }),
  ],
};
