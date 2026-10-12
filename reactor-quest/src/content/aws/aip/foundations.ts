// AIP-C01 Domain 1: Foundation Model Integration, Data Management, and Compliance (31%).
import type { Deck } from '../../../game/types';
import { checkpoint, lesson, q } from '../kit';

export const aipFoundations: Deck = {
  id: 'aip-foundations',
  name: 'Models, Data and Retrieval',
  subtitle: 'Domain 1 · 31% of the exam',
  outcome: 'Design GenAI solutions, choose and customise models resiliently, prepare data, build retrieval, and govern prompts.',
  hue: 265,
  domain: 'aip-d1',
  levels: [
    lesson({
      id: 'aip-solution-design',
      title: 'Designing GenAI Solutions',
      system: 'Architecture Table',
      skills: ['genai', 'aws-architecture'],
      brief: `**ARIA:** At professional level nobody asks "what is RAG?". They ask how to design a system that survives a model outage, swaps providers without a code change, and proves its value before it ships.`,
      lesson: `## From requirements to architecture

1. Pin down the business goal, quality bar, latency and cost budget, data sensitivity and compliance constraints.
2. Build a **proof of concept** on **Amazon Bedrock** to test feasibility, quality and cost per request before scaling.
3. Standardise components with the **AWS Well-Architected Framework** and its **Generative AI Lens** (reviewable in the Well-Architected Tool).

## Choosing models

Use **benchmarks** and your **own evaluation set**, capability analysis (reasoning, tool use, multimodality, context length, languages) and known **limitations**. Re-evaluate as new models appear.

## Never hard-code a model

Put an **abstraction layer** between the app and the model:

- Model IDs and parameters in **AWS AppConfig** (or Parameter Store), read at runtime: switch models or providers **without a code change**, roll out gradually, roll back on alarms.
- A **Lambda** or **API Gateway** facade exposing one internal API for every model (a GenAI gateway).
- The Bedrock **Converse API** gives one request/response format across most models.

## Resilience

- **Cross-Region inference** (inference profiles): Bedrock routes requests to other Regions in a geography for more throughput and availability, including for models with limited Regional availability.
- **Circuit breaker** (for example in **Step Functions**): stop calling a failing model, use a fallback.
- **Graceful degradation**: fall back to a smaller or alternative model, cached answers, or a non-AI path, rather than failing.
- Cross-Region deployment of self-hosted models (SageMaker endpoints) for disaster recovery.`,
      questions: [
        q('A team wants to switch its application from one Bedrock model to another without redeploying code, and roll back automatically if errors rise. What should it do?', ['Store the model ID in AWS AppConfig and deploy changes with a deployment strategy tied to CloudWatch alarms', 'Hard-code the model ID and redeploy', 'Fine-tune both models', 'Use S3 Object Lock'], 0, 'AppConfig externalises configuration with gradual, alarm-guarded rollout.'),
        q('A model the company relies on is only offered in one Region, and throttling during peaks causes failures. Which feature helps most?', ['Amazon Bedrock cross-Region inference (inference profiles)', 'S3 Cross-Region Replication', 'A larger Lambda timeout', 'Prompt Management versions'], 0, 'Cross-Region inference spreads requests across Regions for throughput and availability.'),
        q('When the primary model is unavailable, a support assistant must still answer simple questions. Which pattern fits?', ['Graceful degradation: a circuit breaker routes to a smaller fallback model or cached answers', 'Retry forever', 'Return HTTP 500 to every user', 'Raise the temperature'], 0, 'Degrade gracefully instead of failing completely.'),
        q('Before committing budget, leadership wants evidence that a GenAI idea works and what each request costs. What is the right first step?', ['A proof of concept on Amazon Bedrock with an evaluation set and cost tracking', 'Pre-training a custom model', 'Buying Provisioned Throughput for a year', 'A full production rollout'], 0, 'A PoC validates feasibility, quality and cost quickly.'),
        q('Which AWS resource provides best practices specific to generative AI workloads for architecture reviews?', ['The Well-Architected Framework Generative AI Lens', 'AWS Artifact', 'AWS Budgets', 'The CloudFormation registry'], 0, 'The GenAI Lens extends Well-Architected for GenAI.'),
        q('Which Bedrock API lets the same code send conversations to most models with one message format?', ['The Converse API', 'InvokeModel with each provider\'s native body', 'The S3 API', 'The STS API'], 0, 'Converse standardises requests and responses across models.'),
      ],
    }),
    lesson({
      id: 'aip-model-lifecycle',
      title: 'Customised Models in Production',
      system: 'Model Foundry',
      skills: ['genai', 'ai-ml'],
      brief: `**ARIA:** Fine-tuning is the easy part. Versioning, deploying, rolling back and retiring a customised model is where professionals earn their keep.`,
      lesson: `## Customisation options

| Where | Options |
|---|---|
| **Amazon Bedrock** | Fine-tuning, continued pre-training, **model distillation**; **Custom Model Import** for supported open-weight models; serve with on-demand (where supported) or **Provisioned Throughput** |
| **Amazon SageMaker AI** | Full control: fine-tune open models (JumpStart), deploy to endpoints, **inference components** to host several models on one endpoint |

## Parameter-efficient fine-tuning (PEFT)

Instead of updating all weights, train small extra pieces:

- **LoRA (low-rank adaptation):** small trainable matrices added to layers; far less compute and storage; adapters can be swapped on one base model.
- **Adapters** in general: one base model, many task-specific adapters.

## Lifecycle management

- **SageMaker Model Registry:** version models, record metrics and approval status (\`PendingManualApproval\` → \`Approved\`), deploy approved versions.
- **Automated pipelines** (SageMaker Pipelines, CodePipeline) to retrain, evaluate, register and deploy.
- **Safe rollout:** canary or blue/green endpoint updates with alarms; **rollback** to the last approved version.
- **Retirement:** track model versions in use; deprecate and replace old ones (base models are also retired by providers on published schedules).`,
      questions: [
        q('A company must adapt a 70B-parameter open model to legal language with limited GPU budget. Which technique fits?', ['Parameter-efficient fine-tuning such as LoRA', 'Pre-training from scratch', 'Full fine-tuning of all weights on a large cluster', 'Prompt caching'], 0, 'LoRA trains small adapters instead of all weights.'),
        q('Only models approved by the ML lead may be deployed, and deployments must use the approved version. Which feature supports this?', ['SageMaker Model Registry approval status', 'S3 Versioning', 'CloudFront caching', 'Bedrock Guardrails'], 0, 'Model Registry tracks versions and approval status for deployment.'),
        q('A new fine-tuned model version degrades answers after deployment. What should the deployment design allow?', ['Automated rollback to the previous approved version, triggered by alarms', 'Manual retraining before any rollback', 'Deleting all previous versions', 'Raising temperature'], 0, 'Keep previous versions and roll back automatically.'),
        q('A team wants to host several fine-tuned variants on shared GPU infrastructure to cut cost. Which SageMaker feature fits?', ['Inference components on one endpoint (multiple models/adapters)', 'Batch transform only', 'SageMaker Canvas', 'Ground Truth'], 0, 'Inference components share endpoint capacity across models.'),
        q('A company has its own fine-tuned open-weight model and wants to serve it through Bedrock\'s serverless APIs. Which feature fits?', ['Bedrock Custom Model Import', 'Bedrock Prompt Management', 'Amazon Kendra', 'AWS Glue'], 0, 'Custom Model Import brings supported open-weight models into Bedrock.'),
        q('A large model is too slow and expensive for a narrow classification task. Which Bedrock feature creates a smaller model trained on the large model\'s outputs?', ['Model distillation', 'Continued pre-training', 'Cross-Region inference', 'Guardrails'], 0, 'Distillation transfers capability to a smaller student model.'),
      ],
    }),
    lesson({
      id: 'aip-data-prep',
      title: 'Data Pipelines for Foundation Models',
      system: 'Refinery',
      skills: ['genai', 'aws-storage'],
      brief: `**ARIA:** Garbage in, confident garbage out. Validate, convert and clean data before any model sees it, whether it's text, scans, audio or tables.`,
      lesson: `## Validate data quality

- **AWS Glue Data Quality:** rules (completeness, uniqueness, ranges) on datasets, with scores and alerts.
- **SageMaker Data Wrangler:** profile and transform data visually.
- Custom **Lambda** checks (schema, language, size, PII) publishing **CloudWatch metrics**, and failing the pipeline when quality drops.

## Many kinds of data

| Data | Processing |
|---|---|
| Audio | **Amazon Transcribe** → text |
| Scanned documents, forms | **Amazon Textract**, or **Bedrock Data Automation** (documents, images, audio, video → structured output) |
| Images | Bedrock **multimodal** models (describe, extract) |
| Large batch transforms | **SageMaker Processing** jobs, AWS Glue |
| Tabular | Serialise rows into text or JSON the model can read |

## Formatting model input

- Bedrock requests are **JSON**: with the **Converse API**, a \`messages\` list of \`{ role: "user" | "assistant", content: [...] }\`, plus a \`system\` prompt and \`inferenceConfig\` (maxTokens, temperature, topP).
- **Dialog formatting:** keep turns alternating user/assistant; include relevant history only.
- SageMaker endpoints expect the format of their container (for example a JSON \`inputs\` field).

## Improving input quality

Normalise text (encoding, whitespace, units) with Lambda; extract **entities** with **Amazon Comprehend** to add structure; use a model to **reformat** messy input into a clean schema before the main call.`,
      questions: [
        q('A pipeline must stop when incoming documents for a knowledge base fail completeness and duplication checks. Which service fits?', ['AWS Glue Data Quality rules with alerts', 'Amazon CloudFront', 'AWS Budgets', 'Amazon Polly'], 0, 'Glue Data Quality evaluates rules and scores datasets.'),
        q('Call recordings must become searchable context for a GenAI assistant. What is the first processing step?', ['Transcribe the audio to text with Amazon Transcribe', 'Embed the raw audio files as text', 'Store them in Glacier Deep Archive', 'Fine-tune on the audio waveforms'], 0, 'Speech must become text first.'),
        q('Insurance claim packets mix forms, images and scanned letters, and the team wants structured output with minimal custom code. Which service fits?', ['Amazon Bedrock Data Automation', 'Amazon SQS', 'AWS Config', 'Amazon Route 53'], 0, 'Bedrock Data Automation extracts structured data from multimodal content.'),
        q('With the Bedrock Converse API, how is conversation history passed to the model?', ['As a messages array of alternating user and assistant turns', 'As a single concatenated string in a URL', 'As S3 object tags', 'As HTTP headers'], 0, 'Converse takes structured messages with roles.'),
        q('Free-text support tickets lack structure, hurting response quality. Which pre-processing step helps?', ['Extract entities (product, order ID) with Amazon Comprehend and add them as structured fields', 'Raise the model temperature', 'Remove all punctuation and numbers', 'Send tickets as images'], 0, 'Structured entities make inputs clearer.'),
        q('Which service runs large-scale batch data transformation jobs for model consumption on managed infrastructure?', ['SageMaker Processing', 'Amazon Lex', 'AWS Artifact', 'Amazon Cognito'], 0, 'SageMaker Processing runs batch processing jobs.'),
      ],
    }),
    lesson({
      id: 'aip-retrieval',
      title: 'Vector Stores and Retrieval',
      system: 'Deep Archive Index',
      skills: ['genai', 'aws-databases'],
      brief: `**ARIA:** Basic RAG retrieves something. Professional RAG retrieves the right thing, fast, from current data, with filters, reranking and smart queries. This domain is the biggest on the exam.`,
      lesson: `## Vector store options

| Store | Strengths |
|---|---|
| **Bedrock Knowledge Bases** | Managed ingestion, chunking, embedding, sync and retrieval; supports several vector stores |
| **Amazon OpenSearch Service / Serverless** | Scalable k-NN (HNSW) search, **hybrid** keyword + vector search, Neural plugin integration with Bedrock models, sharding and multiple indexes |
| **Aurora PostgreSQL / RDS PostgreSQL + pgvector** | Vectors next to relational data and SQL filters |
| **Amazon S3 Vectors** | Low-cost, large-scale vector storage |
| **Neptune Analytics** | GraphRAG: vectors plus relationships |
| **DynamoDB** | Metadata and document records alongside a vector index |

## Chunking

**Fixed-size** (with overlap), **hierarchical** (small child chunks for precise matching, returning larger parent chunks for context), **semantic** (split where meaning changes), or **none** (pre-split docs). Custom chunking with a Lambda function in Knowledge Bases.

## Embeddings

Pick the model for the **domain and language**; trade **dimensions** (Titan Text Embeddings V2: 256, 512 or 1,024) against storage, speed and accuracy. Embed queries and documents with **the same model**. Batch-generate embeddings for large corpora.

## Better retrieval

- **Metadata** (dates, authors, department, document type) and **metadata filtering** narrow results before or during search.
- **Hybrid search** combines keyword (BM25) and vector similarity.
- **Rerankers** (Bedrock reranker models) re-score the top results for relevance.
- **Query expansion** (rewrite or add synonyms) and **query decomposition** (split complex questions into sub-queries, with Lambda or Step Functions).
- Expose retrieval to models through **function calling** or an **MCP** server.

## Keeping it current

**Incremental** ingestion and **sync jobs** (Knowledge Bases data source sync), change detection (S3 events → re-ingest), scheduled refreshes, and deleting vectors for removed documents.`,
      questions: [
        q('Users search with exact product codes and also natural-language questions, and pure vector search misses exact codes. What improves retrieval?', ['Hybrid search combining keyword and vector scoring (for example in OpenSearch)', 'A higher temperature', 'Larger chunks only', 'Removing metadata'], 0, 'Keyword matching catches exact terms; vectors catch meaning.'),
        q('Answers need precise matching on small passages but enough surrounding context for the model. Which chunking strategy fits?', ['Hierarchical chunking (match child chunks, return parent chunks)', 'No chunking', 'One chunk per character', 'Random chunk sizes'], 0, 'Hierarchical chunking balances precision and context.'),
        q('Retrieval returns relevant but poorly ordered results, and the best passage is often fifth. What should be added?', ['A reranker model to re-score the top results', 'More documents', 'A smaller embedding dimension', 'Prompt caching'], 0, 'Rerankers reorder candidates by relevance.'),
        q('Users must only retrieve documents from their own department. What should the retrieval design use?', ['Metadata attributes on documents and metadata filtering at query time', 'A separate model per user', 'Higher top-k', 'Disabling citations'], 0, 'Metadata filters restrict results.'),
        q('After switching the embedding model for queries only, retrieval quality collapses. Why?', ['Queries and documents must be embedded with the same model; the index must be re-embedded', 'The temperature changed', 'The chunks are too small', 'Rerankers stopped working'], 0, 'Different embedding models produce incompatible vector spaces.'),
        q('Documents in S3 change daily, and answers keep citing outdated versions. What fixes this?', ['Automated incremental sync of the knowledge base when objects change (or on a schedule)', 'Fine-tuning weekly', 'Raising max tokens', 'Using a bigger model'], 0, 'Keep the vector store in sync with sources.'),
      ],
    }),
    lesson({
      id: 'aip-prompt-systems',
      title: 'Prompt Systems and Governance',
      system: 'Command Protocols',
      skills: ['genai', 'aws-operations'],
      brief: `**ARIA:** In production, prompts are code: versioned, reviewed, tested, governed and logged. And complex tasks need chains of prompts, not one heroic prompt.`,
      lesson: `## Instruction frameworks

- **Bedrock Prompt Management:** prompt templates with **variables**, versions, model and parameter settings; enforce **role definitions** and **output formats**; compare variants; reference a version ID from code.
- **Bedrock Guardrails** enforce responsible AI rules around any prompt.
- Store template repositories in **S3** or Git; **CloudTrail** tracks who changed and used prompts; **CloudWatch Logs** records access.
- An **approval workflow** promotes a tested version to production.

## Multi-step prompt systems

- **Amazon Bedrock Flows** (formerly Prompt Flows): visual workflows chaining prompts, knowledge bases, Lambda functions and **conditions** (branching on model output), with reusable components and pre/post-processing.
- **Step Functions** for clarification workflows (ask the user a follow-up when intent is unclear) and complex orchestration.

## Conversational context

Store **conversation history** in **DynamoDB** (session ID key, TTL to expire), summarise long histories, detect **intent** (Amazon Comprehend custom classification, or the model itself) to route requests.

## Prompt quality assurance

- **Regression tests**: a golden set of inputs with expected properties, run on every prompt change (Lambda checks, Step Functions for edge cases, CloudWatch metrics to spot regressions).
- **Output format specifications** (JSON schemas) and **structured input** sections.
- **Chain-of-thought** instructions for reasoning tasks; **feedback loops** from user ratings to refine prompts.`,
      questions: [
        q('A team must version prompts, test variants and let applications reference an approved version without code changes. Which feature fits?', ['Amazon Bedrock Prompt Management', 'Amazon S3 Glacier', 'AWS Shield', 'Amazon Kinesis'], 0, 'Prompt Management versions and manages templates.'),
        q('A document workflow must classify a request, then send it to one of three different prompts depending on the class, and post-process the result. Which service fits with the least custom code?', ['Amazon Bedrock Flows with condition nodes', 'A single giant prompt', 'Amazon SQS', 'AWS Batch'], 0, 'Flows chain prompts with branching.'),
        q('Where should a chat app store per-session conversation history that expires after 24 hours?', ['Amazon DynamoDB with a TTL attribute', 'An EC2 instance store', 'CloudFront', 'IAM'], 0, 'DynamoDB with TTL stores and expires sessions.'),
        q('A prompt change silently broke JSON output for an edge case in production. What process prevents this?', ['Automated regression tests with a golden dataset and schema checks before promoting prompt versions', 'Editing prompts directly in production', 'Raising temperature', 'Disabling logging'], 0, 'Prompt changes need tests like code changes.'),
        q('Auditors need to know who changed a production prompt template and when. Which service records this?', ['AWS CloudTrail', 'Amazon Polly', 'Amazon Translate', 'AWS Snowball'], 0, 'CloudTrail logs API activity, including prompt changes.'),
        q('User requests are often ambiguous. Which design improves answers?', ['A clarification workflow that asks a follow-up question when intent confidence is low', 'Always guessing', 'Longer max tokens', 'Removing the system prompt'], 0, 'Clarifying intent before answering improves quality.'),
      ],
    }),
    checkpoint({
      id: 'aip-foundations-checkpoint',
      title: 'Checkpoint: Models, Data and Retrieval',
      system: 'Foundations Certification Gate',
      skills: ['genai', 'aws-architecture'],
      brief: `**ARIA:** Professional-level scenarios. Several answers will work; pick the most robust with the least operational overhead.`,
      lesson: `## Before you start

- Abstraction layer + AppConfig for model choice; Converse API; cross-Region inference; circuit breakers; graceful degradation; Generative AI Lens.
- LoRA/adapters; Model Registry approvals; rollback; Custom Model Import; distillation; inference components.
- Glue Data Quality; Transcribe/Textract/Bedrock Data Automation; Converse messages.
- Hybrid search, hierarchical chunking, rerankers, metadata filters, same embedding model, incremental sync.
- Prompt Management versions, Bedrock Flows, DynamoDB history, prompt regression tests.`,
      questions: [
        q('A bank must swap between two model providers within minutes if one has an outage, with no redeploy. Which design is most robust?', ['A GenAI gateway (Lambda/API Gateway) reading model routing from AppConfig, with a circuit breaker and fallback model', 'Hard-coded calls to one provider', 'Manual DNS changes', 'A single SageMaker endpoint'], 0, 'Externalised routing plus circuit breaking enables fast switching.'),
        q('A RAG system answers questions about 2 million technical manuals with many part numbers. Which retrieval design gives the best relevance?', ['Hybrid search with metadata filtering and a reranker', 'Pure keyword search', 'Pure vector search with no metadata', 'Fine-tuning instead of retrieval'], 0, 'Hybrid + filters + reranking maximise relevance.'),
        q('An embeddings index uses 1,024 dimensions and storage cost is too high, with acceptable accuracy loss. What should be evaluated?', ['A lower embedding dimension (for example 512 or 256) and re-indexing', 'Raising temperature', 'Removing chunk overlap entirely', 'Doubling the dimensions'], 0, 'Fewer dimensions reduce storage and speed up search.'),
        q('A company must deploy a LoRA-tuned model, keep the previous version ready, and deploy only after evaluation passes. Which combination fits?', ['SageMaker Pipelines for evaluation, Model Registry approval, and endpoint deployment with rollback', 'Manual uploads to EC2', 'Bedrock Guardrails only', 'CloudFront caching'], 0, 'Pipelines + Registry + safe deployment manage the lifecycle.'),
        q('Complex multi-part questions get incomplete answers because retrieval only matches the first part. What helps?', ['Query decomposition into sub-queries, retrieving for each, then synthesising', 'A smaller context window', 'Removing citations', 'A higher temperature'], 0, 'Decomposition retrieves context for every part.'),
        q('Scanned PDFs produce garbled text in the knowledge base. What should be added to the pipeline?', ['Text extraction with Amazon Textract or Bedrock Data Automation before chunking', 'A higher top-k', 'Prompt caching', 'Batch inference'], 0, 'Proper extraction fixes scanned content.'),
        q('Different teams keep editing a shared system prompt and breaking each other\'s use cases. Which governance approach fits?', ['Versioned prompts in Prompt Management with approval, tests, and per-team variants', 'One unversioned text file', 'No system prompt', 'Random selection of prompts'], 0, 'Versioning, approvals and tests govern shared prompts.'),
        q('Which statement about cross-Region inference in Bedrock is correct?', ['It routes requests to other Regions in a geography to increase throughput and availability', 'It copies your data to every Region permanently', 'It requires a custom model', 'It disables Guardrails'], 0, 'Inference profiles distribute requests across Regions.'),
      ],
    }),
  ],
};
