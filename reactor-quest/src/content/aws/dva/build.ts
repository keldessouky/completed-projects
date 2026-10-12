// DVA-C02 Domain 1, part 1: application patterns, APIs, messaging and streams.
import type { Deck } from '../../../game/types';
import { checkpoint, lesson, q } from '../kit';

export const dvaBuild: Deck = {
  id: 'dva-build',
  name: 'Building Applications on AWS',
  subtitle: 'Domain 1 · 32% of the exam (part 1 of 2)',
  outcome: 'Write resilient code against AWS APIs, build APIs with API Gateway, and connect services with queues, topics, events and streams.',
  hue: 210,
  domain: 'dva-d1',
  levels: [
    lesson({
      id: 'dva-patterns',
      title: 'Patterns and Resilient Code',
      system: 'Circuit Board',
      skills: ['aws-architecture', 'aws-compute'],
      brief: `**ARIA:** Ground control's app calls six services, and when one hiccups, everything falls over. Learn the patterns, and the defensive code, that keep a distributed app standing.`,
      lesson: `## Architecture patterns

| Pattern | Meaning |
|---|---|
| **Monolith** | One deployable app; simple to start, hard to scale parts independently |
| **Microservices** | Small independent services, each owning its data, talking over APIs or events |
| **Event-driven** | Components react to **events** (an order was placed) instead of calling each other directly |
| **Fan-out** | One event delivered to many consumers (SNS → several SQS queues, EventBridge rules) |
| **Orchestration** | A central coordinator tells each step what to do (**AWS Step Functions**) |
| **Choreography** | No coordinator: each service reacts to events and emits new ones (**Amazon EventBridge**) |

## Opposites the exam contrasts

- **Stateless** (no session data kept on the server; any instance can serve any request; store state in DynamoDB or ElastiCache) vs **stateful**.
- **Loosely coupled** (talk through queues/events; one can fail without the other) vs **tightly coupled** (direct calls; failures spread).
- **Synchronous** (caller waits for the answer: API call) vs **asynchronous** (caller hands off and moves on: queue, event).

## Resilient code

- **Retries with exponential backoff and jitter** for throttling (HTTP 429, \`ThrottlingException\`) and 5xx errors. The **AWS SDKs retry automatically** with backoff; tune them rather than writing your own loop.
- **Idempotency:** make repeating an operation safe (idempotency keys, conditional writes), because retries and at-least-once delivery mean duplicates happen.
- **Circuit breaker:** stop calling a failing dependency for a while, return a fallback, then try again.
- **Timeouts** on every external call; **dead-letter queues** for messages that keep failing.

## Calling AWS from code

Use the **AWS SDK** for your language: it signs requests (**SigV4**), finds credentials, retries and paginates. **Amazon Q Developer** helps write, explain, test and refactor this code in the IDE.`,
      questions: [
        q('A service gets intermittent `ThrottlingException` errors from DynamoDB. What is the recommended approach?', ['Retry immediately in a tight loop', 'Retry with exponential backoff and jitter (the SDK does this by default)', 'Switch to a different Region', 'Ignore the error'], 1, 'Backoff with jitter spreads retries out and lets throttling clear.'),
        q('Order, payment and shipping services each react to events and emit new ones, with no central coordinator. Which pattern is this?', ['Orchestration', 'Choreography', 'Monolith', 'Synchronous request/response'], 1, 'Event-driven services without a coordinator = choreography.'),
        q('A multi-step checkout must run steps in order with retries and a compensating step if payment fails. Which service fits best?', ['AWS Step Functions (orchestration)', 'Amazon SNS', 'Amazon S3', 'Amazon CloudFront'], 0, 'Step Functions orchestrates workflows with retries and error handling.'),
        q('A payment API might receive the same request twice because of client retries. What protects against double charging?', ['Making the operation idempotent with an idempotency key', 'Turning off retries in every client', 'Using a larger instance', 'Removing timeouts'], 0, 'Idempotency makes repeats harmless.'),
        q('Which describes a stateless web tier?', ['Sessions are stored in each server\'s memory', 'Session data is kept outside the servers (for example, in DynamoDB or ElastiCache), so any server can handle any request', 'Every user is pinned to one server forever', 'It can\'t scale'], 1, 'Externalised state makes servers interchangeable.'),
        q('A third-party API is down, and calls to it are piling up and slowing everything. Which pattern helps?', ['A circuit breaker that stops calling it for a while and returns a fallback', 'More retries with no delay', 'A bigger timeout', 'Tighter coupling'], 0, 'Circuit breakers fail fast while a dependency recovers.'),
      ],
    }),
    lesson({
      id: 'dva-api-gateway',
      title: 'APIs with API Gateway',
      system: 'Docking Ports',
      skills: ['aws-networking', 'aws-compute'],
      brief: `**ARIA:** Every outside system talks to ground control through one front door. Amazon API Gateway is that door. Learn its knobs: types, integrations, mapping, validation and throttling.`,
      lesson: `## API types

| Type | Use |
|---|---|
| **REST API** | Full features: request validation, mapping templates, API keys and **usage plans**, caching, private APIs |
| **HTTP API** | Simpler, **cheaper and faster**; JWT authorizers, Lambda and HTTP proxies |
| **WebSocket API** | Two-way, persistent connections (chat, live dashboards) |

## Integrations

- **Lambda proxy integration:** the whole request goes to Lambda; the function must return \`{ statusCode, headers, body }\`. A malformed response gives a **502 Bad Gateway**.
- **Non-proxy (custom) integration:** API Gateway transforms requests and responses with **mapping templates** (Velocity/VTL), can **override status codes**, and can map backend errors to clean responses.
- **HTTP**, **AWS service** (call SQS, DynamoDB directly) and **mock** integrations (return a fixed response, great for testing front ends).

## Protecting and shaping traffic

- **Request validation:** check required parameters and the body against a JSON schema model before invoking the backend (returns 400).
- **Throttling:** steady-state rate and burst limits per stage, method or client; excess gets **429 Too Many Requests**.
- **Usage plans and API keys:** quotas and throttling per customer (keys identify; they're not authentication).
- **Caching** (REST): cache responses per stage with a TTL to cut backend calls.
- **CORS** must be enabled for browsers calling from another domain.
- The integration **timeout** defaults to **29 seconds**; longer work should become asynchronous.

## Testing locally

**AWS SAM** (\`sam local invoke\`, \`sam local start-api\`) runs Lambda functions and APIs on your machine for unit and integration tests.`,
      questions: [
        q('A Lambda proxy integration returns a plain string instead of an object with statusCode and body. What do clients receive?', ['200 OK', '502 Bad Gateway', '404 Not Found', '401 Unauthorized'], 1, 'Proxy integrations need a properly formatted response, or API Gateway returns 502.'),
        q('An API must reject requests with a missing required body field before invoking the backend. What should be configured?', ['Request validation with a JSON schema model', 'A larger Lambda memory size', 'A CloudFront distribution', 'A NAT gateway'], 0, 'API Gateway request validators check parameters and bodies.'),
        q('A company sells API access in tiers with different monthly request quotas per customer. Which features fit?', ['Usage plans with API keys', 'Lambda layers', 'Stage variables only', 'Mock integrations'], 0, 'Usage plans attach quotas and throttling to API keys.'),
        q('A front-end team needs a working API endpoint returning fixed sample data before the backend exists. What should be used?', ['A mock integration', 'A Lambda authorizer', 'DynamoDB Streams', 'A usage plan'], 0, 'Mock integrations return static responses.'),
        q('Which API type is cheapest and simplest for a Lambda-backed API that needs JWT authorization but no request mapping or caching?', ['REST API', 'HTTP API', 'WebSocket API', 'Private REST API with caching'], 1, 'HTTP APIs are lower cost with built-in JWT authorizers.'),
        q('A backend job takes 2 minutes, and API callers get 504 errors. What is the best fix?', ['Increase the API Gateway timeout to 5 minutes', 'Make the work asynchronous: accept the request, queue it, and let clients poll or get notified', 'Use a bigger API key', 'Enable CORS'], 1, 'The integration timeout defaults to 29 seconds; long work should be asynchronous.'),
      ],
    }),
    lesson({
      id: 'dva-messaging',
      title: 'Queues, Topics, Events and Streams',
      system: 'Message Tubes',
      skills: ['aws-operations', 'aws-architecture'],
      brief: `**ARIA:** Developers get asked "which messaging service?" more than anything else. Four services, four jobs. Plus the code-level details: visibility timeouts, filter policies, shards.`,
      lesson: `## Choosing

| Service | Model | Pick it when… |
|---|---|---|
| **Amazon SQS** | Queue, consumers **pull** | Buffering work; one consumer group processes each message |
| **Amazon SNS** | Pub/sub, **push** to many | Fan-out to many subscribers (SQS, Lambda, HTTP, email) |
| **Amazon EventBridge** | Event bus with **rules** | Routing events by content, SaaS and AWS events, schedules |
| **Kinesis Data Streams** | Ordered, **replayable stream** of records | Real-time streaming with multiple consumers and replay |

## SQS for developers

- **Visibility timeout:** set longer than processing time; extend it with \`ChangeMessageVisibility\` for slow jobs. **Delete** the message when done, or it comes back.
- **Long polling** (\`WaitTimeSeconds\` up to 20) cuts empty responses and cost.
- **Batch** send/receive/delete up to 10 messages.
- **FIFO** queues: \`MessageGroupId\` for ordering, \`MessageDeduplicationId\` (or content-based deduplication) for exactly-once.
- **Dead-letter queue** after \`maxReceiveCount\` failures. Messages up to 256 KB (larger: store in S3, send a pointer).

## SNS for developers

**Subscription filter policies** let each subscriber receive only messages whose attributes (or body) match, instead of filtering in code. FIFO topics pair with FIFO queues.

## EventBridge for developers

Events are JSON; **rules** match event patterns and send to **targets** (Lambda, SQS, Step Functions…). **Scheduler** runs one-off or recurring jobs. **Pipes** connect a source to a target with filtering and enrichment. Archive and replay events.

## Kinesis Data Streams for developers

- Capacity in **shards**; the **partition key** decides the shard, and **order is guaranteed within a shard**. A hot partition key throttles one shard (\`ProvisionedThroughputExceededException\`).
- Consumers: Lambda **event source mapping**, the KCL, or **enhanced fan-out** (dedicated throughput per consumer).
- **Amazon Data Firehose** loads streams into S3, Redshift or OpenSearch with no code.`,
      questions: [
        q('A worker sometimes processes the same SQS message twice because processing takes longer than expected. What should it do?', ['Extend the visibility timeout (ChangeMessageVisibility) or set it longer than processing time', 'Use short polling', 'Increase the message retention period', 'Use SNS instead'], 0, 'The message reappeared because its visibility timeout expired.'),
        q('Consumers poll an empty SQS queue constantly, making many empty responses. What reduces cost?', ['Long polling with WaitTimeSeconds up to 20', 'A FIFO queue', 'A larger message size', 'More consumers'], 0, 'Long polling waits for messages before returning.'),
        q('Several SQS queues subscribe to one SNS topic, but each should only receive orders for its own region. What is the most efficient approach?', ['SNS subscription filter policies', 'Filter in each consumer\'s code', 'Create one topic per message', 'Use a FIFO queue'], 0, 'Filter policies deliver only matching messages.'),
        q('Records for the same customer must be processed in order in Kinesis Data Streams. What ensures this?', ['Using the customer ID as the partition key', 'Using a random partition key', 'Using more shards only', 'Using SNS'], 0, 'Records with the same partition key go to the same shard, in order.'),
        q('An application must run a cleanup task every night at 2 a.m. without servers. Which service fits?', ['Amazon EventBridge Scheduler (or a scheduled rule) invoking Lambda', 'An SQS delay queue', 'Kinesis Data Streams', 'An SNS topic'], 0, 'EventBridge schedules trigger targets on a cron.'),
        q('A message payload is 2 MB, larger than SQS allows. What is the standard approach?', ['Store the payload in S3 and send a reference in the message', 'Split it across 10 queues', 'Use Kinesis with a 2 MB record', 'Increase the SQS message size limit'], 0, 'SQS messages are limited to 256 KB; use S3 for large payloads.'),
      ],
    }),
    checkpoint({
      id: 'dva-build-checkpoint',
      title: 'Checkpoint: Building Applications',
      system: 'Builder Certification Gate',
      skills: ['aws-architecture', 'aws-operations'],
      brief: `**ARIA:** Developer-level scenarios on patterns, resilient code, API Gateway and messaging.`,
      lesson: `## Before you start

- Orchestration (Step Functions) vs choreography (EventBridge); stateless; loose coupling; async.
- Backoff with jitter, idempotency, circuit breakers, timeouts, DLQs.
- REST vs HTTP vs WebSocket APIs; proxy (502 on bad response) vs mapping templates; validation; usage plans; 29 s timeout.
- SQS visibility timeout, long polling, FIFO groups and dedup; SNS filter policies; EventBridge rules; Kinesis partition keys.`,
      questions: [
        q('A Lambda function behind API Gateway must return a 404 status when an item isn\'t found, using proxy integration. How?', ['Return an object with statusCode 404 and a body', 'Throw an exception', 'Return null', 'Configure a usage plan'], 0, 'With proxy integration, the function sets statusCode itself.'),
        q('Messages in an SQS FIFO queue for different customers should be processed in parallel, but each customer\'s in order. What should be set?', ['A MessageGroupId per customer', 'One MessageGroupId for all messages', 'A delay of 15 minutes', 'Long polling only'], 0, 'Ordering is per message group; different groups process in parallel.'),
        q('One "user signed up" event must trigger a welcome email, a CRM update and analytics, each independently. Which design fits?', ['SNS topic (or EventBridge rule) fanning out to separate targets', 'One Lambda doing all three in sequence', 'A synchronous chain of API calls', 'A single SQS queue with three consumers competing'], 0, 'Fan-out gives each consumer its own copy.'),
        q('A Kinesis consumer falls behind because one shard is hot. What is the likely cause?', ['A low-cardinality partition key sending most records to one shard', 'Too many shards', 'Using enhanced fan-out', 'Using Firehose'], 0, 'Poor key distribution creates hot shards.'),
        q('A team wants to call DynamoDB directly from API Gateway without writing a Lambda function. What should it use?', ['An AWS service integration with mapping templates', 'A mock integration', 'An HTTP API JWT authorizer', 'A WebSocket API'], 0, 'Service integrations call AWS APIs directly.'),
        q('Which statement about the AWS SDKs is correct?', ['They never retry', 'They sign requests, find credentials and retry throttled calls with backoff automatically', 'They require hard-coded access keys', 'They only work in Lambda'], 1, 'SDKs handle signing, credentials, retries and pagination.'),
        q('A real-time dashboard needs the server to push updates to browsers over a persistent connection. Which API Gateway type fits?', ['WebSocket API', 'REST API with caching', 'HTTP API', 'A private REST API'], 0, 'WebSocket APIs support two-way persistent connections.'),
        q('Messages that fail processing repeatedly block a queue. What should be configured?', ['A dead-letter queue with maxReceiveCount', 'A shorter retention period', 'Short polling', 'A larger visibility timeout of 12 hours on every message'], 0, 'A DLQ sets aside poison messages for investigation.'),
      ],
    }),
  ],
};
