// DVA-C02 Domain 4: Troubleshooting and Optimization (18% of the exam).
import type { Deck } from '../../../game/types';
import { checkpoint, lesson, q } from '../kit';

export const dvaTroubleshoot: Deck = {
  id: 'dva-troubleshoot',
  name: 'Troubleshooting and Optimization',
  subtitle: 'Domain 4 · 18% of the exam',
  outcome: 'Instrument code with logs, metrics and traces, find root causes fast, and tune applications for speed and cost.',
  hue: 275,
  domain: 'dva-d4',
  levels: [
    lesson({
      id: 'dva-observability',
      title: 'Logs, Metrics and Traces',
      system: 'Sensor Web',
      skills: ['aws-operations'],
      brief: `**ARIA:** When something breaks at 3 a.m., you can only see what your code chose to record. Instrument it properly: logs, metrics and traces.`,
      lesson: `## Three pillars

- **Logging:** records of events (what happened). **Monitoring:** watching known metrics against thresholds (is it healthy?). **Observability:** being able to ask *new* questions about behaviour from logs, metrics and traces together (why is it slow for these users?).

## Logs: Amazon CloudWatch Logs

- Lambda writes stdout/stderr to a **log group** automatically (the role needs \`logs:CreateLogStream\`/\`PutLogEvents\`).
- **Structured logging:** write JSON with consistent fields (request ID, user, action, latency) so logs can be queried. Lambda can emit logs in JSON format natively; **Powertools for AWS Lambda** helps.
- **CloudWatch Logs Insights:** query logs with a query language (\`fields\`, \`filter\`, \`stats\`, \`sort\`).
- **Metric filters** turn log patterns into metrics; **subscription filters** stream logs to Lambda, Kinesis or OpenSearch.
- Set **retention** so logs don't grow forever.

## Metrics: Amazon CloudWatch

- Built-in metrics (Lambda \`Invocations\`, \`Errors\`, \`Duration\`, \`Throttles\`, \`ConcurrentExecutions\`).
- **Custom metrics** with \`PutMetricData\`, or the **Embedded Metric Format (EMF)**: structured JSON log lines that CloudWatch turns into metrics asynchronously, with no API calls in the hot path. **High-resolution** metrics go down to 1 second.
- **Alarms** → **SNS** notifications or actions (for example, alert when a quota is nearly reached or a deployment completes, via EventBridge).
- **Dashboards**, **Lambda Insights** and **Application Signals** for application health.

## Traces: AWS X-Ray (and OpenTelemetry)

- Follows a request across services: **segments** (per service) and **subsegments** (downstream calls), shown on a **service map**.
- **Annotations:** key-value pairs that are **indexed** and searchable (filter traces by \`customerId\`). **Metadata:** extra data, **not indexed**.
- **Sampling rules** control how many requests are traced. Enable **active tracing** in Lambda and API Gateway; instrument SDK calls. The **AWS Distro for OpenTelemetry (ADOT)** is the OpenTelemetry option.

## Health checks

Load balancer and container health checks (and readiness probes) should test that the app can really serve, not just that the process is alive.`,
      questions: [
        q('Developers want to filter X-Ray traces by customer ID. How should the ID be recorded?', ['As an annotation', 'As metadata', 'In a log group name', 'As an environment variable'], 0, 'Annotations are indexed and searchable; metadata isn\'t.'),
        q('A Lambda function must publish a custom business metric without adding latency from API calls. What should it use?', ['CloudWatch Embedded Metric Format (structured log lines)', 'A synchronous PutMetricData call per request', 'An S3 object per metric', 'X-Ray metadata'], 0, 'EMF turns logs into metrics asynchronously.'),
        q('Which tool queries Lambda logs to find the slowest requests in the last hour?', ['CloudWatch Logs Insights', 'AWS Config', 'Amazon Inspector', 'AWS Artifact'], 0, 'Logs Insights queries and aggregates log data.'),
        q('What is the difference between monitoring and observability?', ['They are identical', 'Monitoring watches known metrics; observability lets you investigate new questions using logs, metrics and traces together', 'Observability is only for databases', 'Monitoring requires X-Ray'], 1, 'Observability supports open-ended investigation.'),
        q('A team wants an email when a Lambda function\'s error count exceeds 5 in 5 minutes. What should it configure?', ['A CloudWatch alarm on the Errors metric that notifies an SNS topic', 'An X-Ray sampling rule', 'A Logs retention policy', 'A Lambda layer'], 0, 'Alarms trigger SNS notifications.'),
        q('Why use structured (JSON) logging?', ['It makes logs larger for no reason', 'Fields can be queried, filtered and aggregated consistently', 'It is required by Lambda', 'It disables CloudWatch'], 1, 'Structured logs are machine-queryable.'),
      ],
    }),
    lesson({
      id: 'dva-root-cause',
      title: 'Finding the Root Cause',
      system: 'Fault Finder',
      skills: ['aws-operations'],
      brief: `**ARIA:** Error codes are clues. Learn to read them: which side broke, what the service is telling you, and where to look next.`,
      lesson: `## Reading errors

| Error | Usually means |
|---|---|
| **4xx** | The **request** is wrong: 400 bad input, 403 **AccessDenied** (permissions), 404 not found, **429 throttled** |
| **5xx** | The **server or integration** failed: 500 internal error, **502** bad gateway (Lambda proxy returned a malformed response, or the function errored), **503** unavailable, **504** gateway timeout (integration exceeded API Gateway's timeout) |
| \`ProvisionedThroughputExceededException\` / \`ThrottlingException\` | Too many requests: retry with **exponential backoff**, raise capacity, fix hot keys |
| \`Task timed out after X seconds\` (Lambda) | Raise the timeout, speed up code, or check for a call hanging (often a VPC function with no NAT trying to reach the internet) |
| \`AccessDeniedException\` | Missing permission: check the role, resource policy, KMS key policy, SCPs |

## Where to look

- **CloudWatch Logs** for the function or service (search the request ID).
- **X-Ray traces** for which downstream call was slow or failed.
- **CloudTrail** for API calls and denials (\`errorCode\`).
- **Deployment failures:** CloudFormation **stack events** show the first resource that failed (look above the rollback messages); CodeDeploy **deployment logs** and lifecycle event logs on the instance; CodeBuild **build logs**.
- **Service integration issues:** check event source mapping state and errors, DLQs, SQS metrics (\`ApproximateAgeOfOldestMessage\`), Kinesis \`IteratorAge\`.

## Debugging habits

Reproduce with a saved test event; add logging around the failure; compare with the last good version; use **Amazon Q Developer** to explain errors and suggest fixes.`,
      questions: [
        q('An API Gateway endpoint returns 504 after about 29 seconds. What is the likely cause?', ['The backend integration took longer than the API Gateway timeout', 'The user lacks permission', 'The request body is invalid', 'The API key is missing'], 0, '504 = integration timeout.'),
        q('A CloudFormation stack update fails and rolls back. Where is the original cause found?', ['The stack events: the first resource that failed, before the rollback events', 'The last event in the list only', 'AWS Budgets', 'The S3 console'], 0, 'The first failure event explains the rollback.'),
        q('A Lambda function in a VPC times out calling an external HTTPS API, but works outside the VPC. What is the likely cause?', ['No route to the internet (no NAT gateway) from its subnets', 'Too much memory', 'A missing layer', 'Too many environment variables'], 0, 'VPC functions need a NAT gateway for internet access.'),
        q('Which metric shows that a Lambda consumer is falling behind a Kinesis stream?', ['IteratorAge', 'Invocations', 'Duration only', 'ConcurrentExecutions only'], 0, 'Rising IteratorAge means records wait longer before processing.'),
        q('An application receives HTTP 429 from an AWS API. What does it mean and what should the code do?', ['Throttling: retry with exponential backoff', 'Not found: create the resource', 'Server crash: page the on-call', 'Success: ignore'], 0, '429 is throttling; back off and retry.'),
        q('Which service shows which IAM principal was denied an API call and the error code?', ['AWS CloudTrail', 'Amazon CloudFront', 'AWS AppConfig', 'Amazon ECR'], 0, 'CloudTrail records API calls with errorCode.'),
      ],
    }),
    lesson({
      id: 'dva-optimize',
      title: 'Making It Faster and Cheaper',
      system: 'Tuning Bay',
      skills: ['aws-compute', 'aws-operations'],
      brief: `**ARIA:** It works; now make it fast and cheap. Memory, concurrency, caching and filtering are the developer's levers.`,
      lesson: `## Right-size Lambda

- **Memory sets CPU**: more memory often makes CPU-bound functions faster **and cheaper** (shorter duration). Find the sweet spot with **AWS Lambda Power Tuning** or **Compute Optimizer** recommendations.
- Use **Graviton (arm64)** for better price-performance.
- Reuse connections and SDK clients across invocations; keep packages small to cut cold starts.

## Concurrency

**Concurrency = requests per second × average duration (seconds).** A function handling 200 requests/s taking 0.5 s needs about 100 concurrent executions. Throttles mean you've hit reserved concurrency or the account limit. **Provisioned concurrency** removes cold starts for steady, latency-sensitive traffic.

## Caching

| Layer | How |
|---|---|
| **CloudFront** | Cache at the edge; the **cache key** (which headers, cookies and query strings vary the cached copy) decides the hit ratio; cache **based on request headers** only when the response really varies by them |
| **API Gateway** (REST) | Stage cache with TTL; clients can bypass with \`Cache-Control: max-age=0\` if allowed |
| **Application** | ElastiCache (lazy loading + TTL), DAX for DynamoDB, in-memory caches across warm invocations |

## Messaging and data efficiency

- **SNS subscription filter policies** so consumers don't receive and discard irrelevant messages.
- SQS **long polling** and **batching**; Lambda **batch size** and **batching window**.
- DynamoDB **Query** instead of Scan; ProjectionExpression; right capacity mode.
- S3 **multipart upload**, byte-range fetches, Transfer Acceleration for far-away clients.

## Find the bottleneck first

Profile with **X-Ray** (slow subsegments), CloudWatch metrics (Duration, throttles), **Lambda Insights** (memory and CPU), and logs (time spent per step). Optimise what the data says, not what you guess.`,
      questions: [
        q('A function handles 50 requests per second and each takes 2 seconds. Roughly how much concurrency does it need?', ['25', '50', '100', '2'], 2, '50 × 2 = 100 concurrent executions.'),
        q('A CPU-bound Lambda function runs for 10 seconds at 512 MB. What may make it faster and possibly cheaper?', ['Increase memory to get more CPU', 'Decrease memory', 'Add environment variables', 'Increase the timeout only'], 0, 'More memory = more CPU; shorter duration can lower cost.'),
        q('CloudFront\'s cache hit ratio is low because the User-Agent header is part of the cache key, but responses don\'t vary by it. What should be done?', ['Remove User-Agent from the cache key', 'Add more headers to the cache key', 'Set TTL to 0', 'Disable compression'], 0, 'Only include headers that change the response.'),
        q('Consumers of an SNS topic discard 90% of the messages they receive. What reduces wasted processing?', ['SNS subscription filter policies', 'A larger SQS visibility timeout', 'More consumers', 'X-Ray annotations'], 0, 'Filter policies deliver only relevant messages.'),
        q('Which tool helps find the best Lambda memory setting by testing several and comparing cost and speed?', ['AWS Lambda Power Tuning', 'AWS Artifact', 'Amazon Macie', 'AWS Private CA'], 0, 'Power Tuning runs the function at different memory sizes.'),
        q('An API backed by Lambda returns the same product data thousands of times a minute. What is a simple optimisation?', ['Enable API Gateway caching (or CloudFront) with a suitable TTL', 'Increase the Lambda timeout', 'Use a FIFO queue', 'Turn off logging'], 0, 'Caching avoids invoking the backend for repeated reads.'),
      ],
    }),
    checkpoint({
      id: 'dva-troubleshoot-checkpoint',
      title: 'Checkpoint: Troubleshooting and Optimization',
      system: 'Diagnostics Certification Gate',
      skills: ['aws-operations', 'aws-compute'],
      brief: `**ARIA:** Developer-level scenarios on instrumentation, debugging and optimisation.`,
      lesson: `## Before you start

- Structured logs + Logs Insights; metric and subscription filters; EMF custom metrics; alarms → SNS.
- X-Ray: segments, subsegments, annotations (indexed) vs metadata; sampling; active tracing.
- 4xx = request (403 AccessDenied, 429 throttled), 5xx = server (502 bad proxy response, 504 timeout). Stack events, deployment logs, IteratorAge.
- Memory = CPU; concurrency = rps × duration; cache keys; filter policies; batching.`,
      questions: [
        q('Users report one API is slow, and the team needs to see which downstream call causes the delay. What should it use?', ['AWS X-Ray traces with subsegments for downstream calls', 'AWS Config', 'S3 access logs', 'CloudFormation drift detection'], 0, 'X-Ray shows time spent per downstream call.'),
        q('A team needs a count of failed logins in its logs as a metric with an alarm. What should it create?', ['A CloudWatch Logs metric filter and an alarm', 'An X-Ray annotation', 'A Lambda layer', 'A DynamoDB stream'], 0, 'Metric filters turn log patterns into metrics.'),
        q('Lambda Throttles rise during peaks, while other functions in the account are idle. What is a likely cause?', ['Reserved concurrency on this function is set too low', 'Too much memory', 'X-Ray is enabled', 'Logs retention is too short'], 0, 'Reserved concurrency caps the function.'),
        q('An API Gateway Lambda proxy endpoint returns 502 Bad Gateway. What should be checked first?', ['That the function returns a valid response object (statusCode, headers, body) and isn\'t erroring', 'The usage plan quota', 'The CloudFront TTL', 'The DynamoDB capacity mode'], 0, '502 usually means a malformed proxy response or a function error.'),
        q('All logs from many functions must be streamed to OpenSearch for search and dashboards. What should be configured?', ['CloudWatch Logs subscription filters', 'X-Ray sampling rules', 'CodeBuild caching', 'S3 lifecycle rules'], 0, 'Subscription filters stream log events to destinations.'),
        q('Which statement about X-Ray metadata is correct?', ['It is indexed for searching traces', 'It stores extra data that isn\'t indexed', 'It replaces annotations', 'It controls sampling'], 1, 'Metadata isn\'t indexed; use annotations for filtering.'),
        q('A DynamoDB-backed endpoint is slow because it scans the table to find a user\'s orders. What is the best fix?', ['Query using a key or index on the user ID', 'Increase Lambda memory only', 'Add more FilterExpressions', 'Use eventually consistent scans'], 0, 'Queries read only matching items.'),
        q('A team wants a notification when a CodeDeploy deployment completes or fails. What fits?', ['An EventBridge rule (or deployment trigger) that notifies an SNS topic', 'An X-Ray annotation', 'A larger instance', 'A CloudFront function'], 0, 'Deployment events can trigger notifications.'),
      ],
    }),
  ],
};
