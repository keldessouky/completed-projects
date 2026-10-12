// AIP-C01 Domain 4: Operational Efficiency and Optimization for GenAI Applications (12%).
import type { Deck } from '../../../game/types';
import { checkpoint, lesson, q } from '../kit';

export const aipOperations: Deck = {
  id: 'aip-operations',
  name: 'Cost, Performance and Monitoring',
  subtitle: 'Domain 4 · 12% of the exam',
  outcome: 'Cut token costs, make FM apps fast, and monitor them for quality, cost and failure modes unique to GenAI.',
  hue: 95,
  domain: 'aip-d4',
  levels: [
    lesson({
      id: 'aip-cost',
      title: 'Spending Fewer Tokens',
      system: 'Token Economy',
      skills: ['genai', 'aws-billing'],
      brief: `**ARIA:** At scale, every unnecessary token is money. Learn to measure tokens, trim them, cache them and route around expensive models.`,
      lesson: `## Token efficiency

- **Estimate and track** tokens per request (input, output) per feature and team.
- **Context window optimisation:** send only what's needed; **context pruning** (drop old turns, summarise history); **prompt compression** (shorter instructions, fewer examples).
- **Response size controls:** \`maxTokens\`, concise output formats, stop sequences.

## Model selection for cost

- Measure **cost vs capability**: price-to-performance per task.
- **Tiered usage:** a small model for simple queries, a large one for complex ones (cascading, Intelligent Prompt Routing).
- Balance inference cost against required quality.

## Throughput and utilisation

- **Batch inference** for offline jobs; batching strategies for many small requests.
- **Provisioned Throughput** sized from measured tokens per minute; monitor utilisation so you don't pay for idle units.
- **Auto scaling** for self-hosted endpoints.

## Caching

| Technique | Saves |
|---|---|
| **Prompt caching** (Bedrock) | Re-processing a long, repeated prompt prefix (system prompt, documents) |
| **Semantic caching** | Whole model calls: store answers keyed by the **embedding** of the question; return a cached answer when a new question is similar enough (for example with vector search in ElastiCache/MemoryDB or OpenSearch) |
| **Deterministic request hashing / result fingerprinting** | Identical requests (same prompt and parameters) return the stored result |
| **Edge caching** (CloudFront) | Common, non-personal responses near users |`,
      questions: [
        q('Many users ask the same question in different words, and each call costs a full model invocation. Which technique avoids most of these calls?', ['Semantic caching keyed on question embeddings', 'Higher temperature', 'Longer prompts', 'Provisioned Throughput'], 0, 'Semantic caching reuses answers for similar questions.'),
        q('Every request includes the same 20,000-token policy document. Which Bedrock feature reduces cost and latency?', ['Prompt caching', 'Batch inference', 'Cross-Region inference', 'Model distillation'], 0, 'Prompt caching reuses the repeated prefix.'),
        q('A chat app\'s cost grows with conversation length. What reduces tokens without losing important context?', ['Prune or summarise older conversation turns', 'Send the full history every time', 'Raise max tokens', 'Use a larger model'], 0, 'Context pruning and summarisation shrink input tokens.'),
        q('Provisioned Throughput is reserved for peak load but sits at 15% utilisation most of the day. What should the team do?', ['Re-size using measured token demand, and use on-demand for spikes', 'Buy more model units', 'Disable monitoring', 'Switch everything to batch'], 0, 'Size reserved capacity to real demand.'),
        q('Identical report requests with the same parameters are generated many times a day. What avoids recomputing them?', ['Deterministic request hashing with a result cache', 'Higher temperature', 'A new model each time', 'Streaming'], 0, 'Hash identical requests and reuse results.'),
        q('Which is a cost-effective model selection practice?', ['Measure price-to-performance per task and use the cheapest model that meets the quality bar', 'Always use the newest largest model', 'Choose by model name popularity', 'Use one model for everything without testing'], 0, 'Match model cost to task needs.'),
      ],
    }),
    lesson({
      id: 'aip-performance',
      title: 'Making GenAI Fast',
      system: 'Overdrive',
      skills: ['genai', 'aws-architecture'],
      brief: `**ARIA:** Users judge an AI by how fast it feels. Stream, parallelise, precompute, tune retrieval and parameters, and measure every change.`,
      lesson: `## Latency

- **Response streaming** for perceived speed.
- **Latency-optimised** model options in Bedrock for time-sensitive apps.
- **Parallel requests** for independent sub-tasks (Step Functions Map/Parallel, async calls).
- **Pre-computation** of predictable queries (nightly summaries, popular answers).
- Benchmark p50/p95 latency and time to first token.

## Retrieval performance

**Index optimisation** (HNSW parameters, shards), **query preprocessing** (normalise, rewrite), **hybrid search** with custom scoring, fewer but better chunks (top-k tuning, reranking), metadata filters to shrink the search space.

## Throughput

Manage **concurrent invocations** within quotas (requests and tokens per minute), batch where possible, cross-Region inference for more capacity, token processing optimisation (shorter prompts and outputs).

## Quality tuning

- **Inference parameters** per use case: temperature, top-p, top-k, max tokens, stop sequences.
- **A/B testing** prompt and parameter variants with real traffic and measured outcomes.

## Efficient systems

Profile API calls (prompt and completion sizes), optimise vector queries, keep service communication efficient (reuse connections, keep components in the same Region), auto scaling tuned for GenAI's bursty traffic.`,
      questions: [
        q('A workflow makes five independent model calls one after another and takes 25 seconds. What reduces latency most?', ['Run the independent calls in parallel (for example with Step Functions Parallel/Map)', 'Increase max tokens', 'Use one bigger prompt with no structure', 'Add retries'], 0, 'Parallel execution of independent calls.'),
        q('Every morning, thousands of users request the same daily briefing. What improves speed and cost?', ['Pre-compute the briefing once and serve the cached result', 'Generate it per user on request', 'Increase temperature', 'Use streaming only'], 0, 'Precompute predictable outputs.'),
        q('Which metric best captures how responsive a streaming chat feels?', ['Time to first token', 'Total tokens per month', 'Number of Regions', 'Embedding dimensions'], 0, 'Time to first token drives perceived latency.'),
        q('Vector search latency rose as the index grew to 50 million vectors. Which actions help? (Pick the best answer.)', ['Tune the index (HNSW parameters, shards) and use metadata filters to narrow the search', 'Remove all metadata', 'Increase chunk overlap to 100%', 'Raise temperature'], 0, 'Index tuning and filtering speed up search.'),
        q('A team isn\'t sure whether a new prompt variant improves user satisfaction. How should it decide?', ['A/B test the variants on live traffic and compare measured outcomes', 'Pick the longer prompt', 'Ask one colleague', 'Deploy both to everyone'], 0, 'A/B testing gives evidence.'),
        q('A time-sensitive voice assistant needs the lowest possible latency from Bedrock. What should be considered?', ['Latency-optimised model options and streaming', 'Batch inference', 'Larger context windows', 'Higher top-k'], 0, 'Latency-optimised inference and streaming reduce delay.'),
      ],
    }),
    lesson({
      id: 'aip-monitoring',
      title: 'Monitoring GenAI Applications',
      system: 'Watchtower',
      skills: ['aws-operations', 'genai'],
      brief: `**ARIA:** A GenAI app can be up, fast and cheap, and still be wrong. Monitor the things classic dashboards miss: tokens, hallucinations, drift, tool calls.`,
      lesson: `## What to watch

| Area | Signals |
|---|---|
| Operations | Bedrock CloudWatch metrics: \`Invocations\`, \`InvocationLatency\`, \`InputTokenCount\`, \`OutputTokenCount\`, \`InvocationThrottles\`, client and server errors |
| Cost | Token usage per feature/team; **anomaly detection** on token bursts; **Cost Anomaly Detection** |
| Quality | Hallucination rate (grounding check failures), response quality scores, prompt effectiveness, user feedback, **response drift** |
| Agents and tools | Tool call counts, latency, error rates, multi-agent coordination traces (**AgentCore Observability**, X-Ray/OpenTelemetry) |
| Retrieval | Vector store latency, index health, empty/low-relevance retrievals, freshness of data |
| Business | Task completion, deflection rate, conversion, satisfaction on **custom dashboards** |

## Tools

- **Bedrock model invocation logs** (to CloudWatch Logs or S3) for detailed request/response analysis; **CloudWatch Logs Insights** queries.
- **CloudWatch dashboards and alarms**; anomaly detection on metrics.
- **X-Ray** traces across services; forensic **audit logging**.

## GenAI-specific failure modes

- **Golden datasets**: a fixed set of questions with known answers, run regularly to detect **hallucination** and quality regressions.
- **Output diffing** between runs and versions to spot inconsistency.
- **Reasoning path tracing** to find where an agent's logic went wrong.
- Baselines of normal usage to detect anomalies.`,
      questions: [
        q('Which Bedrock metrics would reveal a sudden spike in token usage? (Pick the best answer.)', ['InputTokenCount and OutputTokenCount in CloudWatch, with anomaly detection', 'S3 BucketSizeBytes', 'EC2 CPUUtilization of an unrelated server', 'Route 53 health checks'], 0, 'Token count metrics plus anomaly detection catch bursts.'),
        q('A team needs to analyse the exact prompts and responses behind complaints. What must be enabled?', ['Bedrock model invocation logging', 'S3 Transfer Acceleration', 'Provisioned Throughput', 'Prompt caching'], 0, 'Invocation logs capture requests and responses.'),
        q('How can a team detect that its assistant has started hallucinating more after a model update?', ['Run a golden dataset of known-answer questions regularly and compare scores over time', 'Wait for social media complaints', 'Check CPU usage', 'Count Regions'], 0, 'Golden datasets detect quality regressions.'),
        q('A multi-agent system is slow, and the team must find which tool call is the bottleneck. What helps most?', ['Tracing of agent and tool calls (AgentCore Observability or X-Ray/OpenTelemetry)', 'S3 lifecycle rules', 'A bigger model', 'Disabling logs'], 0, 'Traces show where time is spent.'),
        q('Answers to the same question vary wildly between days. Which technique detects this?', ['Output diffing / consistency analysis across runs', 'Raising max tokens', 'Prompt caching', 'Smaller embeddings'], 0, 'Comparing outputs over time reveals inconsistency.'),
        q('Retrieval sometimes returns nothing relevant, causing vague answers. What should be monitored?', ['Retrieval relevance scores and the rate of empty or low-score retrievals', 'Only model latency', 'Only token cost', 'Nothing'], 0, 'Retrieval quality needs its own metrics.'),
      ],
    }),
    checkpoint({
      id: 'aip-operations-checkpoint',
      title: 'Checkpoint: Cost, Performance and Monitoring',
      system: 'Operations Certification Gate',
      skills: ['genai', 'aws-operations'],
      brief: `**ARIA:** Professional-level scenarios on cost, performance and monitoring of GenAI applications.`,
      lesson: `## Before you start

- Token tracking, context pruning, prompt compression, maxTokens; tiered models; batch; right-sized Provisioned Throughput.
- Prompt caching, semantic caching, request hashing, edge caching.
- Streaming, parallel calls, precomputation, latency-optimised models, index tuning, A/B tests.
- Bedrock metrics and invocation logs, anomaly detection, golden datasets, output diffing, tool and agent tracing.`,
      questions: [
        q('Costs doubled after a feature launch. Which first step finds the cause fastest?', ['Break down token usage by feature from CloudWatch metrics and invocation logs', 'Switch all models immediately', 'Delete the feature', 'Disable logging'], 0, 'Measure where tokens go before changing anything.'),
        q('Which caching approach helps when questions are worded differently but mean the same thing?', ['Semantic caching', 'Exact-match HTTP caching', 'Browser caching', 'DNS caching'], 0, 'Semantic caching matches by meaning.'),
        q('A support bot uses a large model for every message, but 80% are simple FAQs. What cuts cost most?', ['Route simple messages to a small model (or a semantic cache) and escalate complex ones', 'Increase the large model\'s quota', 'Add more examples to every prompt', 'Use batch inference for chat'], 0, 'Tiered routing matches cost to complexity.'),
        q('A team must alert when the share of responses failing the contextual grounding check exceeds 5%. What should it build?', ['A CloudWatch metric for grounding-check failures with an alarm', 'An S3 lifecycle rule', 'A WAF rule', 'A Route 53 record'], 0, 'Custom quality metrics need alarms like operational ones.'),
        q('A summarisation job over 500,000 documents runs overnight. Which is the most cost-effective way to invoke the model?', ['Bedrock batch inference', 'On-demand calls one by one', 'Provisioned Throughput for the whole month', 'Streaming responses'], 0, 'Batch inference is cheaper for offline jobs.'),
        q('Users complain the assistant feels slow even though total generation time is fine. What should be improved first?', ['Stream tokens to reduce time to first token', 'Increase max tokens', 'Use a larger model', 'Add retries'], 0, 'Streaming improves perceived latency.'),
        q('Which practice best detects quality regressions before a new model version reaches all users?', ['Run golden dataset evaluations and a canary rollout with quality metrics', 'Deploy to everyone and wait', 'Check only latency', 'Increase the temperature'], 0, 'Evaluate and canary before full rollout.'),
        q('A self-hosted LLM endpoint is under-utilised at night and saturated at midday. What helps?', ['Auto scaling configured for GenAI traffic patterns (with warm capacity ahead of peaks)', 'A fixed large fleet 24/7', 'Removing monitoring', 'Smaller context windows only'], 0, 'Scale with demand, ahead of predictable peaks.'),
      ],
    }),
  ],
};
