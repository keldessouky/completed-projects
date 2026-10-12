// AIP-C01 Domain 2: Implementation and Integration (26%).
import type { Deck } from '../../../game/types';
import { checkpoint, lesson, q } from '../kit';

export const aipIntegration: Deck = {
  id: 'aip-integration',
  name: 'Agents and Integration',
  subtitle: 'Domain 2 · 26% of the exam',
  outcome: 'Build safe agents with tools and MCP, deploy models sensibly, and integrate FMs into APIs and enterprise systems.',
  hue: 195,
  domain: 'aip-d2',
  levels: [
    lesson({
      id: 'aip-agents',
      title: 'Building Agents',
      system: 'Autonomy Core',
      skills: ['genai', 'aws-architecture'],
      brief: `**ARIA:** An agent with tools can do real damage if nobody set limits. Build agents that reason well, use tools reliably, stop when they should, and ask a human when it matters.`,
      lesson: `## Frameworks and services

| Option | Use |
|---|---|
| **Strands Agents** | Open-source SDK: model + system prompt + tools; custom behaviours through its API; multi-agent patterns |
| **Agent Squad** (AWS Labs, open source) | Orchestrates **multiple agents**: classifies each request and routes it to the best agent, keeping context |
| **Amazon Bedrock Agents** | Managed agents with **action groups** (Lambda or OpenAPI), knowledge bases, return of control to your app |
| **Amazon Bedrock AgentCore** | Run any framework's agents in production: Runtime, Memory, Gateway, Identity, Policy, Observability |

## Reasoning patterns

- **ReAct** (reason + act): the model alternates thinking, calling a tool, and observing results until done. Can be implemented as a loop in **Step Functions**.
- **Chain-of-thought** for step-by-step reasoning; **plan-and-execute** for long tasks.

## Tools done right

- **Standardised function definitions** (name, description, JSON schema for parameters) so the model calls tools correctly.
- **Validate parameters** and **handle errors** in the tool (Lambda), returning clear messages the model can act on.
- **MCP servers**: lightweight, **stateless** tools on **Lambda**; complex or long-running tools on **ECS**; MCP client libraries for consistent access.

## Safeguards

- **Stopping conditions** and maximum steps (Step Functions), **timeouts** (Lambda), **circuit breakers**.
- **IAM policies** that bound what each tool can touch (least privilege; scoped credentials via AgentCore Identity).
- **Human-in-the-loop**: Step Functions waits for approval (task tokens) before high-impact actions; API Gateway collects feedback.

## Multi-model coordination

Use **specialised models** for sub-tasks (a small fast model for classification, a strong model for reasoning), ensembles with aggregation logic, and a model selection framework.`,
      questions: [
        q('An agent sometimes loops forever calling the same tool. Which safeguard fixes this?', ['A maximum step count / stopping condition and timeouts on the agent loop', 'A higher temperature', 'More tools', 'A larger context window'], 0, 'Bound the loop with stopping conditions and timeouts.'),
        q('An agent may issue refunds, but refunds over $1,000 must be approved by a person first. Which design fits?', ['A Step Functions workflow that pauses for human approval (task token) before the refund tool runs', 'Let the model decide freely', 'Disable refunds entirely', 'Log refunds after they happen'], 0, 'Human-in-the-loop for high-impact actions.'),
        q('A simple, stateless lookup tool should be exposed to agents through MCP with minimal operations. Where should it run?', ['As an MCP server on AWS Lambda', 'On a fleet of EC2 instances', 'In an S3 bucket', 'In CloudFront'], 0, 'Lightweight stateless MCP servers fit Lambda.'),
        q('Requests to a customer assistant need routing to a billing agent, a technical agent or an orders agent. Which open-source AWS framework is designed for this?', ['Agent Squad', 'AWS CDK', 'Amazon Kinesis', 'AWS Glue'], 0, 'Agent Squad classifies and routes requests across agents.'),
        q('The model often calls a tool with missing or wrong parameters. What improves reliability?', ['Clear function descriptions with JSON schemas, plus parameter validation and helpful error messages in the tool', 'Removing tool descriptions', 'Higher temperature', 'Fewer examples'], 0, 'Good definitions and validation help the model call tools correctly.'),
        q('Which describes the ReAct pattern?', ['The model alternates reasoning steps with tool actions and observations until the task is complete', 'A database replication mode', 'A caching strategy', 'An encryption method'], 0, 'Reason + act loops.'),
      ],
    }),
    lesson({
      id: 'aip-deploy-models',
      title: 'Deploying Foundation Models',
      system: 'Engine Mounts',
      skills: ['genai', 'aws-compute'],
      brief: `**ARIA:** Serving an LLM isn't like serving a classic ML model: memory, GPUs and tokens dominate. Choose the deployment that fits the traffic and the budget.`,
      lesson: `## Options

| Option | Fits |
|---|---|
| **Bedrock on-demand** (called from Lambda, containers…) | Variable traffic, no infrastructure, pay per token |
| **Bedrock Provisioned Throughput** | Steady, high volume; guaranteed capacity (model units); customised models |
| **Bedrock batch inference** | Large offline jobs at lower cost |
| **SageMaker AI endpoints** | Self-hosted open or custom models with full control: instance types, **Large Model Inference (LMI) containers**, autoscaling, inference components |
| **Hybrid** | Bedrock for most traffic, SageMaker for a specialised model |

## LLM-specific deployment challenges

- **Memory**: model weights must fit in **GPU memory**; large models need multi-GPU instances, **quantisation**, or tensor parallelism.
- **Model loading** takes minutes: pre-load, keep warm, scale ahead of demand.
- Capacity is about **tokens per second**, not requests per second.
- Container images optimised for the model server (vLLM, TensorRT-LLM in LMI containers).

## Right-sizing

- Choose the **smallest model** that meets quality; smaller specialised models for specific tasks.
- **Model cascading**: try a cheap model first; escalate to a stronger one only when needed (low confidence, complex query).
- **Latency-optimised** model variants where speed matters.`,
      questions: [
        q('Traffic is unpredictable and the team wants no infrastructure to manage. Which deployment fits?', ['Amazon Bedrock on-demand invocation', 'A dedicated multi-GPU SageMaker endpoint running 24/7', 'Provisioned Throughput for a year', 'EC2 Spot instances'], 0, 'On-demand Bedrock scales with use and needs no infrastructure.'),
        q('A self-hosted 70B model doesn\'t fit in one GPU\'s memory. Which approaches help? (Pick the best answer.)', ['Multi-GPU instances with tensor parallelism, or quantisation', 'Increasing Lambda memory', 'Raising the temperature', 'Using a larger S3 bucket'], 0, 'Split or shrink the model to fit GPU memory.'),
        q('Most user queries are simple, but some need deep reasoning. How can cost be cut without hurting hard queries?', ['Model cascading: a small model first, escalating complex or low-confidence queries to a larger model', 'Always use the largest model', 'Always use the smallest model', 'Use batch inference for chat'], 0, 'Cascading uses expensive models only when needed.'),
        q('A company runs a steady 2,000 requests per minute against a custom fine-tuned model in Bedrock and needs guaranteed capacity. Which option fits?', ['Provisioned Throughput', 'On-demand with no limits', 'Batch inference', 'Cross-Region replication of S3'], 0, 'Provisioned Throughput reserves capacity.'),
        q('Which SageMaker container type is designed for serving large language models efficiently?', ['Large Model Inference (LMI) containers', 'The Scikit-learn container', 'An AWS Batch job definition', 'A Lambda layer'], 0, 'LMI containers bundle LLM serving engines.'),
        q('Why can a newly launched LLM endpoint take minutes before it serves traffic?', ['Large model weights must be downloaded and loaded into GPU memory', 'DNS propagation only', 'IAM is slow', 'Guardrails must be retrained'], 0, 'Model loading time is a key LLM deployment concern.'),
      ],
    }),
    lesson({
      id: 'aip-api-integration',
      title: 'FM APIs, Streaming and Routing',
      system: 'Signal Router',
      skills: ['genai', 'aws-networking'],
      brief: `**ARIA:** Users hate staring at a spinner for twenty seconds. Stream tokens, handle throttling gracefully, and route each request to the right model.`,
      lesson: `## Calling models

- **Synchronous:** \`Converse\` / \`InvokeModel\` from Lambda, containers or EC2 via the SDK.
- **Streaming:** \`ConverseStream\` / \`InvokeModelWithResponseStream\` return tokens as they're generated. Deliver them to clients with **WebSockets** (API Gateway WebSocket APIs), **server-sent events**, or Lambda response streaming / chunked transfer encoding.
- **Asynchronous:** put requests on **Amazon SQS** and process with workers for long or bulk jobs.
- **API Gateway** in front: request validation, auth, **rate limiting**, custom clients.

## Resilience

- **ThrottlingException** / quota limits (tokens per minute, requests per minute): **exponential backoff with jitter** (the SDK retries), request **quotas increases**, cross-Region inference.
- **Model timeouts**: set client timeouts and retries; reduce output length; stream.
- **Fallbacks** for graceful degradation; **AWS X-Ray** to trace calls across services.

## Routing requests to models

- **Static routing** in configuration (task type → model).
- **Content-based routing** with **Step Functions** (classify, then call a specialised model).
- **Amazon Bedrock Intelligent Prompt Routing**: routes each prompt between models in a family, predicting which gives the needed quality at the lowest cost.
- Metric-driven routing (latency, cost, quality scores).

## GenAI-specific API concerns

Token limit management (count and cap input), retries on model timeouts, streaming through API Gateway, and **idempotency** for retried requests.`,
      questions: [
        q('A chat UI should show the answer as it is generated instead of waiting for the full response. What should be used?', ['ConverseStream (or InvokeModelWithResponseStream) delivered over WebSockets or server-sent events', 'Batch inference', 'A larger max tokens', 'S3 presigned URLs'], 0, 'Streaming APIs return tokens incrementally.'),
        q('During peaks, Bedrock calls fail with ThrottlingException. Which measures help most? (Pick the best answer.)', ['Exponential backoff with jitter, and cross-Region inference or higher quotas', 'Immediate tight retries and a bigger Lambda', 'Disabling Guardrails and raising temperature', 'Switching to batch for chat'], 0, 'Back off and add capacity.'),
        q('A company wants each prompt sent to the cheapest model in a family that can still answer it well, automatically. Which feature fits?', ['Amazon Bedrock Intelligent Prompt Routing', 'Bedrock Guardrails', 'S3 Intelligent-Tiering', 'Prompt caching'], 0, 'Intelligent Prompt Routing predicts the best model per prompt.'),
        q('Thousands of document summaries are requested at once from a web form; users can wait for an email. Which design fits?', ['Queue requests in SQS and process them with workers asynchronously', 'Call the model synchronously from the browser', 'Use a WebSocket per request', 'Increase API Gateway timeout to 1 hour'], 0, 'Async processing decouples bulk work.'),
        q('Which service helps trace a slow request across API Gateway, Lambda and Bedrock calls?', ['AWS X-Ray', 'AWS Artifact', 'Amazon Macie', 'AWS Budgets'], 0, 'X-Ray traces calls across services.'),
        q('Legal questions should go to a specialised model and everything else to a general model, based on content. Which approach fits?', ['Content-based routing: classify the request, then invoke the specialised model (for example with Step Functions)', 'Random routing', 'Always the legal model', 'Always the general model'], 0, 'Classify then route by content.'),
      ],
    }),
    lesson({
      id: 'aip-enterprise',
      title: 'Enterprise Integration',
      system: 'Fleet Uplink',
      skills: ['genai', 'aws-architecture'],
      brief: `**ARIA:** Real companies have legacy systems, identity providers, data that can't leave a country, and change control. GenAI has to fit into all of it.`,
      lesson: `## Connecting to existing systems

- **API-based integration** with legacy systems (API Gateway, Lambda adapters).
- **Event-driven** integration with **Amazon EventBridge** for loose coupling (a new ticket event triggers summarisation).
- **Webhooks** handled by Lambda; data synchronisation patterns to keep context current.

## Secure access

- **Identity federation** between enterprise identity providers and AWS (IAM Identity Center, Cognito).
- **Role-based access control** for which teams can use which models and data.
- **Least-privilege** API access to FMs (IAM conditions on model IDs).

## Data residency and the edge

- **AWS Outposts** to process data **on-premises** when it can't leave the site.
- **AWS Wavelength** for low-latency inference at the 5G edge.
- Secure routing between cloud and on-premises (Direct Connect, VPN, PrivateLink).

## A GenAI gateway

A **centralised abstraction layer** every team calls instead of calling models directly: authentication, **quotas and cost allocation per team**, model routing, guardrails, logging and observability in one place.

## Delivery

- **CI/CD** for GenAI components (**CodePipeline**, **CodeBuild**): automated tests (including prompt and evaluation tests), **security scans**, staged rollout and **rollback**.
- **AWS Amplify** UI components and **OpenAPI** specifications for API-first development; **Bedrock Flows** for no-code workflows.
- **Amazon Q Developer** to generate and refactor code, write tests and explain GenAI errors.`,
      questions: [
        q('Fifty internal teams call foundation models directly, with no shared logging, quotas or guardrails. What should the platform team build?', ['A central GenAI gateway that handles auth, quotas, routing, guardrails and logging', 'A separate AWS account per prompt', 'A shared IAM user for everyone', 'Nothing; let teams continue'], 0, 'A gateway centralises control and observability.'),
        q('Patient data must stay inside a hospital\'s own data centre while still using AWS services for AI processing. Which service fits?', ['AWS Outposts', 'Amazon CloudFront', 'AWS Wavelength', 'Amazon S3 Glacier'], 0, 'Outposts runs AWS infrastructure on-premises.'),
        q('When a support ticket is created in a legacy system, a summary should be generated automatically without coupling the systems. Which design fits?', ['Emit an event to Amazon EventBridge that triggers a summarisation Lambda function', 'Poll the legacy database every second from the browser', 'Modify the legacy code to call the model synchronously', 'Use S3 Glacier'], 0, 'Event-driven integration keeps systems loosely coupled.'),
        q('Only the data science team may invoke a costly model. How should this be enforced?', ['IAM policies allowing bedrock:InvokeModel only on that model ARN for that team\'s role', 'A comment in the code', 'A higher temperature', 'Guardrails word filters'], 0, 'IAM conditions on model resources enforce least privilege.'),
        q('A GenAI service\'s deployment pipeline must block releases when prompt evaluation scores fall or security scans fail. Which approach fits?', ['CodePipeline with CodeBuild stages running evaluation tests and security scans as quality gates', 'Manual copy to production', 'Disabling tests to deploy faster', 'Deploying on weekends only'], 0, 'Automated gates protect releases.'),
        q('Which AWS tool helps developers generate and refactor code and explain errors in a GenAI application?', ['Amazon Q Developer', 'AWS Artifact', 'Amazon Macie', 'AWS Backup'], 0, 'Q Developer assists with code, tests and troubleshooting.'),
      ],
    }),
    checkpoint({
      id: 'aip-integration-checkpoint',
      title: 'Checkpoint: Agents and Integration',
      system: 'Integration Certification Gate',
      skills: ['genai', 'aws-architecture'],
      brief: `**ARIA:** Professional-level scenarios on agents, deployment, model APIs and enterprise integration.`,
      lesson: `## Before you start

- Strands Agents, Agent Squad, Bedrock Agents, AgentCore; ReAct; tool schemas and validation; MCP on Lambda (simple) or ECS (complex); stopping conditions, timeouts, IAM bounds, human approval.
- On-demand vs Provisioned Throughput vs batch vs SageMaker (LMI); GPU memory; cascading.
- Streaming APIs; SQS async; backoff; Intelligent Prompt Routing; X-Ray.
- EventBridge integration; federation and RBAC; Outposts/Wavelength; GenAI gateway; CI/CD gates.`,
      questions: [
        q('A long-running research agent needs a complex tool that keeps state and runs for minutes per call, exposed through MCP. Where should the MCP server run?', ['On Amazon ECS (containers)', 'In a single Lambda invocation limited to seconds', 'In an S3 bucket', 'In CloudFront Functions'], 0, 'Complex, stateful, long-running MCP servers fit ECS.'),
        q('An agent\'s database tool must never delete data, even if the model asks it to. What is the most reliable control?', ['IAM permissions for the tool that don\'t allow delete actions', 'A prompt saying "never delete"', 'A lower temperature', 'More examples'], 0, 'Enforce limits outside the model, with IAM.'),
        q('A team self-hosts an open model on SageMaker and wants high throughput with an optimised LLM serving engine. Which choice fits?', ['A Large Model Inference (LMI) container with an engine such as vLLM', 'A generic Python Flask container on CPU', 'AWS Lambda with 10 GB memory', 'Batch transform for chat'], 0, 'LMI containers provide optimised LLM serving.'),
        q('Long answers make users wait 15 seconds for anything to appear. What is the simplest improvement to perceived latency?', ['Stream the response tokens to the client', 'Increase max tokens', 'Use a larger model', 'Add another retry'], 0, 'Streaming shows output immediately.'),
        q('A multi-agent system handles billing, shipping and returns. Which component decides which agent gets each request?', ['A supervisor/classifier (for example Agent Squad\'s routing)', 'An S3 lifecycle rule', 'A NAT gateway', 'An SNS topic with no filter'], 0, 'A supervisor or classifier routes requests.'),
        q('Which factors matter most when sizing a self-hosted LLM endpoint? (Pick the best answer.)', ['GPU memory for the weights and token throughput', 'S3 storage class and CloudFront TTL', 'IAM password policy and MFA', 'Number of Regions and AZ names'], 0, 'GPU memory and tokens/second drive LLM sizing.'),
        q('A company wants to reduce costs by using a cheaper model for most requests and a more capable one only for hard requests, with minimal custom logic. Which option fits?', ['Bedrock Intelligent Prompt Routing (or a cascading pattern)', 'Always using the most capable model', 'Batch inference for everything', 'Removing the system prompt'], 0, 'Routing sends each prompt to a cost-appropriate model.'),
        q('Which pattern keeps a GenAI summarisation service loosely coupled to an existing order system?', ['Event-driven integration through EventBridge', 'Direct database writes from the model', 'Sharing one IAM user', 'Synchronous calls inside the order transaction'], 0, 'Events decouple the systems.'),
      ],
    }),
  ],
};
