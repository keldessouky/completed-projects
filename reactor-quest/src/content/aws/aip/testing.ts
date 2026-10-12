// AIP-C01 Domain 5: Testing, Validation, and Troubleshooting (11%).
import type { Deck } from '../../../game/types';
import { checkpoint, lesson, q } from '../kit';

export const aipTesting: Deck = {
  id: 'aip-testing',
  name: 'Testing and Troubleshooting',
  subtitle: 'Domain 5 · 11% of the exam',
  outcome: 'Evaluate FM outputs, RAG and agents systematically, gate deployments on quality, and fix GenAI failures fast.',
  hue: 320,
  domain: 'aip-d5',
  levels: [
    lesson({
      id: 'aip-evaluation',
      title: 'Evaluating GenAI Systems',
      system: 'Proving Ground',
      skills: ['genai', 'ai-ml'],
      brief: `**ARIA:** Classic accuracy doesn't fit free-text answers. Evaluate relevance, facts, consistency and fluency; evaluate retrieval and agents separately; and never ship without a gate.`,
      lesson: `## What to measure in outputs

**Relevance**, **factual accuracy**, **faithfulness/groundedness** (supported by the sources), **consistency** (stable across runs), **fluency**, safety, plus **cost** (tokens), **latency-to-quality** ratio and business outcomes.

## How to evaluate

- **Amazon Bedrock Model Evaluations:** automatic metrics, **human** evaluation (your team or AWS-managed), and **LLM-as-a-judge**; also **RAG evaluation** for Knowledge Bases (retrieval relevance, correctness, faithfulness, citation quality) and agent evaluations.
- **Multi-model comparison** and cost-performance analysis on your own dataset.
- **A/B tests** and **canary** releases with real users.
- **User feedback**: ratings in the UI, annotation workflows for reviewers.

## Retrieval quality testing

Relevance scoring of retrieved chunks, **context matching** (does the retrieved text contain the answer?), retrieval latency.

## Agent evaluation

**Task completion rate**, **tool usage effectiveness** (right tool, right parameters, fewest steps), reasoning quality across multi-step workflows.

## Quality assurance in the pipeline

- **Continuous evaluation** workflows; **regression testing** of outputs on a golden set.
- **Automated quality gates**: block deployment when scores drop.
- **Deployment validation**: synthetic user journeys, checks for hallucination rate and **semantic drift** after updates.
- **Reporting** to stakeholders with comparison visualisations.`,
      questions: [
        q('A team must compare three models on its own RAG dataset for correctness and faithfulness, with minimal tooling. What should it use?', ['Amazon Bedrock Model Evaluations (including RAG evaluation with LLM-as-a-judge)', 'CloudFront logs', 'AWS Budgets', 'S3 Inventory'], 0, 'Bedrock evaluations cover models and RAG with built-in metrics.'),
        q('Which metric checks whether an answer is supported by the retrieved documents?', ['Faithfulness (groundedness)', 'Fluency', 'Throughput', 'Embedding size'], 0, 'Faithfulness measures support by the sources.'),
        q('An agent completes tasks but takes 12 tool calls where 3 would do. What should its evaluation include?', ['Tool usage effectiveness and step efficiency, not just task completion', 'Only task completion', 'Only latency of the first call', 'Only token price'], 0, 'Agent evaluation covers how tasks are done.'),
        q('A new prompt version must not reach production if quality drops on the golden set. What implements this?', ['An automated quality gate in the deployment pipeline', 'A manual check once a year', 'A higher temperature', 'Disabling the golden set'], 0, 'Quality gates block regressions automatically.'),
        q('After a model update, answers to the same questions have subtly changed meaning. What should deployment validation check?', ['Semantic drift against previous outputs on a fixed test set', 'Only HTTP status codes', 'Only CPU usage', 'Only cost'], 0, 'Semantic drift checks catch meaning changes.'),
        q('Which evaluation method scales human-like judgement of answer quality to thousands of responses?', ['LLM-as-a-judge', 'Manual review of every response', 'BLEU only', 'Counting tokens'], 0, 'A strong model grades responses at scale.'),
      ],
    }),
    lesson({
      id: 'aip-quality-pipeline',
      title: 'Quality Gates and Feedback Loops',
      system: 'Quality Control Line',
      skills: ['genai', 'aws-operations'],
      brief: `**ARIA:** Evaluating once is a snapshot. Professionals wire evaluation into every change, watch quality after release, and feed users' verdicts back in.`,
      lesson: `## Before release

- **Golden datasets**: curated questions with reference answers or expected properties, covering edge cases and known past failures. Version them with the code.
- **Regression testing** on every prompt, model, retrieval or code change; **automated quality gates** in CodePipeline block a release when scores fall below thresholds (accuracy, faithfulness, safety, format validity, latency, cost per request).
- **Synthetic user workflows** exercise whole journeys (multi-turn chats, agent tasks).

## During release

- **Canary** or **A/B** rollout: a small share of traffic goes to the new version; compare quality and business metrics; **roll back automatically** on alarms.
- **Deployment validation**: hallucination rate, **semantic drift** of answers versus the previous version, response consistency.

## After release

- **Continuous evaluation**: sample live traffic and score it (LLM-as-a-judge, grounding checks) on a schedule.
- **User feedback**: thumbs up/down and comments in the UI (collected via API Gateway into a store), **annotation workflows** where reviewers grade responses; low-rated responses become new golden-set cases.
- **Reporting**: dashboards and automated reports comparing versions and models for stakeholders.`,
      questions: [
        q('A team keeps reintroducing a bug where the assistant reveals internal ticket IDs. How should it stop the regression for good?', ['Add the failing cases to the golden dataset so the quality gate blocks any release that repeats it', 'Fix it once and move on', 'Raise temperature', 'Disable logging'], 0, 'Past failures become permanent regression tests.'),
        q('Which belongs in an automated quality gate for a GenAI release?', ['Thresholds on golden-set scores, faithfulness, safety and format validity', 'The number of commits that week', 'The developer\'s seniority', 'The time of day'], 0, 'Gate on measured quality signals.'),
        q('How should a new model version reach production with the least risk?', ['A canary release comparing quality metrics with the current version, with automatic rollback', 'Replace the old version for everyone at once', 'Release without metrics', 'Ask users to test it manually'], 0, 'Canaries limit exposure and compare evidence.'),
        q('Which turns user feedback into lasting improvement?', ['Collect ratings, review low-rated responses, and add them to the evaluation set and prompt fixes', 'Store feedback without reading it', 'Show feedback buttons with no backend', 'Delete negative ratings'], 0, 'Feedback should flow back into evaluation and fixes.'),
        q('After launch, how can quality be watched continuously without a human reading every response?', ['Score a sample of live traffic on a schedule with LLM-as-a-judge and grounding checks', 'Check CPU usage only', 'Wait for complaints', 'Re-run unit tests on the UI'], 0, 'Continuous automated evaluation of sampled traffic.'),
        q('Which test exercises an agent end to end the way real users would?', ['Synthetic user workflows that run complete multi-step tasks', 'A single-token completion test', 'A DNS lookup', 'A billing alarm'], 0, 'Synthetic journeys test whole workflows.'),
      ],
    }),
    lesson({
      id: 'aip-troubleshooting',
      title: 'Troubleshooting GenAI Applications',
      system: 'Repair Diagnostics',
      skills: ['genai', 'aws-operations'],
      brief: `**ARIA:** GenAI fails in its own special ways: too many tokens, mismatched embeddings, prompts that confuse, formats that drift. Learn the symptoms and the fixes.`,
      lesson: `## Content handling

| Symptom | Likely cause | Fix |
|---|---|---|
| \`ValidationException\` mentioning input length | **Context window overflow** | Chunk, summarise, prune history, retrieve fewer/smaller chunks |
| Answers cut off | Output **maxTokens** too low | Raise it or ask for shorter formats |
| Facts from long documents missing | Truncation, or the right chunk never retrieved | Dynamic chunking, better retrieval, structure the prompt |

## Integration errors

- **ThrottlingException**: backoff with jitter, quota increases, cross-Region inference, Provisioned Throughput.
- **AccessDeniedException**: model access not granted in the account/Region, or IAM missing \`bedrock:InvokeModel\` on that model (or inference profile) ARN.
- **ModelTimeoutException / timeouts**: shorter outputs, streaming, async processing.
- Malformed request bodies: validate the request format per model (or use the Converse API).
Use **error logging**, **request validation** and **response analysis**, with **X-Ray** traces and **CloudWatch Logs Insights**.

## Prompt problems

Inconsistent answers or ignored instructions: compare prompt **versions** side by side, test systematically, refine one change at a time, check that the template rendered as intended (CloudWatch logs), and validate output formats with a **schema**.

## Retrieval problems

- Irrelevant results: check **embedding quality** and that queries and documents use the **same embedding model**; tune **chunk size and overlap**; add metadata filters and reranking.
- Stale answers: **sync** the knowledge base; check ingestion job errors.
- **Drift**: monitor relevance over time as content changes.
- Slow search: optimise the vector index.`,
      questions: [
        q('Requests fail with a ValidationException saying the input is too long. What is the best fix?', ['Reduce input tokens: retrieve fewer or smaller chunks and prune or summarise history', 'Raise temperature', 'Increase maxTokens for the output', 'Retry the same request'], 0, 'The context window was exceeded; shrink the input.'),
        q('A newly deployed app gets AccessDeniedException calling a Bedrock model that works in another account. What should be checked?', ['That model access is enabled in this account and Region, and IAM allows bedrock:InvokeModel on that model', 'The S3 storage class', 'The CloudFront TTL', 'The DynamoDB capacity mode'], 0, 'Model access and IAM permissions are account- and Region-specific.'),
        q('After re-chunking documents into very small pieces, answers lack context. What should be tuned?', ['Chunk size and overlap (or use hierarchical chunking)', 'Temperature', 'The Region', 'The output format only'], 0, 'Chunks too small lose context.'),
        q('A prompt template change caused the model to ignore formatting rules for some users. Which step helps diagnose it?', ['Compare prompt versions side by side and inspect the rendered prompts in the logs', 'Switch Regions', 'Raise the quota', 'Delete all logs'], 0, 'Version comparison and rendered-prompt logs reveal the issue.'),
        q('Retrieval relevance has slowly declined over months as new documents were added. What is this an example of?', ['Retrieval drift, which needs monitoring and re-tuning (and possibly re-embedding)', 'A temperature problem', 'An IAM problem', 'A billing problem'], 0, 'Content changes cause retrieval drift.'),
        q('Downstream parsers fail occasionally because the model returns slightly different JSON shapes. What fixes this reliably?', ['Schema validation of outputs with retry or repair, plus structured output instructions', 'Higher temperature', 'Longer prompts with no schema', 'Ignoring errors'], 0, 'Schema validation catches and corrects format drift.'),
      ],
    }),
    checkpoint({
      id: 'aip-testing-checkpoint',
      title: 'Checkpoint: Testing and Troubleshooting',
      system: 'Diagnostics Certification Gate',
      skills: ['genai', 'aws-operations'],
      brief: `**ARIA:** Professional-level scenarios on evaluation, quality gates and GenAI troubleshooting.`,
      lesson: `## Before you start

- Relevance, factual accuracy, faithfulness, consistency, fluency, cost, latency.
- Bedrock Model Evaluations (automatic, human, LLM-as-a-judge, RAG, agents); A/B and canary; user feedback.
- Golden sets, regression tests, quality gates, semantic drift checks.
- Context overflow, throttling, AccessDenied (model access + IAM), timeouts; prompt version comparison; embedding mismatch, chunking, sync.`,
      questions: [
        q('A RAG assistant gives fluent but wrong answers. Evaluation shows retrieved chunks rarely contain the answer. Where is the problem?', ['Retrieval: improve chunking, embeddings, filters or reranking', 'Generation temperature only', 'The billing setup', 'The UI colour scheme'], 0, 'If the context lacks the answer, fix retrieval first.'),
        q('Which release approach limits the impact of a worse model version on users?', ['A canary release with quality metrics and automatic rollback', 'A full rollout to all users at once', 'No monitoring after release', 'Releasing only on Fridays'], 0, 'Canaries expose a small share of users first.'),
        q('How should user feedback be used to improve an assistant continuously?', ['Collect ratings and comments in the UI, review low-rated responses, and add them to the evaluation set', 'Ignore feedback', 'Only count clicks', 'Delete negative feedback'], 0, 'Feedback feeds evaluation and refinement.'),
        q('After switching to a new embedding model, the knowledge base returns nonsense. What was most likely missed?', ['Re-embedding all documents with the new model', 'Raising max tokens', 'Changing temperature', 'Enabling streaming'], 0, 'Documents and queries must share an embedding model.'),
        q('Throttling errors appear only at peak hours in one Region. Which fixes are appropriate? (Pick the best answer.)', ['Exponential backoff, a quota increase, and cross-Region inference', 'Disabling retries', 'Switching to a bigger prompt', 'Removing Guardrails'], 0, 'Back off and add capacity.'),
        q('Stakeholders want a monthly view of model quality, cost and adoption. What should the team provide?', ['Automated reports and dashboards comparing quality, cost and usage over time', 'Raw invocation logs only', 'Nothing until asked', 'A single number with no context'], 0, 'Reporting communicates performance and trends.'),
        q('Which test catches a broken prompt template before deployment?', ['A regression test suite on a golden dataset with schema and content checks', 'A load test of CPU only', 'A DNS check', 'A billing alarm'], 0, 'Regression tests validate behaviour.'),
        q('Responses are being truncated mid-sentence for long reports. What should be checked first?', ['The maxTokens (output length) setting', 'The embedding dimension', 'The IAM policy', 'The S3 lifecycle'], 0, 'Output token limits cut responses short.'),
      ],
    }),
  ],
};
