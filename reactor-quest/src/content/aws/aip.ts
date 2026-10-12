// AWS Certified Generative AI Developer – Professional (AIP-C01): building
// production GenAI on AWS. The developer step after AI Practitioner. Five
// floors follow the exam guide's five domains.
import type { Path } from '../../game/types';
import { aipFoundations } from './aip/foundations';
import { aipIntegration } from './aip/integration';
import { aipOperations } from './aip/operations';
import { aipSafety } from './aip/safety';
import { aipTesting } from './aip/testing';
import { bankFor } from './kit';

const d1 = bankFor('aip', 'aip-d1');
const d2 = bankFor('aip', 'aip-d2');
const d3 = bankFor('aip', 'aip-d3');
const d4 = bankFor('aip', 'aip-d4');
const d5 = bankFor('aip', 'aip-d5');

export const AIP: Path = {
  id: 'aws-aip',
  name: 'AWS Certified Generative AI Developer – Professional',
  short: 'Generative AI Developer',
  tagline: 'Build production GenAI on AWS: RAG, agents and MCP, Bedrock and SageMaker, safety, cost, monitoring and evaluation. Take it after AI Practitioner.',
  icon: '🧠',
  exam: {
    code: 'AIP-C01',
    name: 'AWS Certified Generative AI Developer – Professional',
    level: 'Professional',
    questions: 75,
    minutes: 180,
    pass: 750,
    domains: [
      { id: 'aip-d1', name: 'Foundation Model Integration, Data Management, and Compliance', weight: 31 },
      { id: 'aip-d2', name: 'Implementation and Integration', weight: 26 },
      { id: 'aip-d3', name: 'AI Safety, Security, and Governance', weight: 20 },
      { id: 'aip-d4', name: 'Operational Efficiency and Optimization for GenAI Applications', weight: 12 },
      { id: 'aip-d5', name: 'Testing, Validation, and Troubleshooting', weight: 11 },
    ],
    guide: 'https://docs.aws.amazon.com/aws-certification/latest/ai-professional-01/ai-professional-01.html',
    note: 'The real exam has 75 questions (65 scored) and a 750 pass mark; check the official page for the current time limit.',
  },
  decks: [aipFoundations, aipIntegration, aipSafety, aipOperations, aipTesting],
  bank: [
    // ------------------------------------------------------------ Domain 1
    d1(1, 'Which design choices let an application change foundation models without code changes? (Choose TWO.)', ['Store model IDs and parameters in AWS AppConfig', 'Call models through an internal abstraction layer (Lambda or API Gateway) using the Converse API', 'Hard-code the model ID in every service', 'Fine-tune every model in advance', 'Use S3 Object Lock'], [0, 1], 'Externalised config plus an abstraction layer decouple apps from models.'),
    d1(2, 'Which improve RAG retrieval relevance? (Choose TWO.)', ['Hybrid keyword + vector search', 'Reranking the top results', 'Using different embedding models for queries and documents', 'Removing all metadata', 'Raising temperature'], [0, 1], 'Hybrid search and reranking improve relevance.'),
    d1(3, 'Which make a GenAI application resilient to a model or Regional disruption? (Choose TWO.)', ['Bedrock cross-Region inference', 'A circuit breaker with a fallback model', 'A single hard-coded model in one Region', 'Disabling retries', 'Longer prompts'], [0, 1], 'Spread capacity and degrade gracefully.'),
    d1(4, 'A company must keep a knowledge base current as SharePoint documents change hourly. What should it implement?', ['Automated incremental sync of the data source into the knowledge base', 'Monthly full fine-tuning', 'Manual uploads once a year', 'A higher top-k'], 0, 'Incremental sync keeps vectors current.'),
    d1(5, 'Which techniques reduce the cost of customising a large model for a domain? (Choose TWO.)', ['LoRA adapters', 'Model distillation into a smaller model', 'Pre-training from scratch', 'Full fine-tuning of every weight on a large cluster', 'Doubling the model size'], [0, 1], 'PEFT and distillation reduce training and serving cost.'),
    d1(6, 'Which service validates data quality rules on datasets before they are used to build a knowledge base?', ['AWS Glue Data Quality', 'Amazon Polly', 'AWS Shield', 'Amazon Route 53'], 0, 'Glue Data Quality evaluates rule sets.'),
    d1(7, 'Which Bedrock feature chains prompts, knowledge bases and Lambda functions with conditional branches?', ['Amazon Bedrock Flows', 'Bedrock batch inference', 'Bedrock Provisioned Throughput', 'Bedrock model distillation'], 0, 'Flows build multi-step prompt workflows.'),
    d1(8, 'Which belong in a governed prompt management process? (Choose TWO.)', ['Versioned prompt templates with approval before production', 'Automated regression tests on prompt changes', 'Editing production prompts directly', 'No record of who changed prompts', 'One shared unversioned file'], [0, 1], 'Version, approve and test prompts.'),
    // ------------------------------------------------------------ Domain 2
    d2(1, 'Which safeguards keep an autonomous agent under control? (Choose TWO.)', ['Stopping conditions and timeouts on the agent loop', 'Least-privilege IAM for each tool', 'Unlimited tool permissions', 'No logging of tool calls', 'A higher temperature'], [0, 1], 'Bound the loop and the permissions.'),
    d2(2, 'Which deliver model output to users incrementally? (Choose TWO.)', ['ConverseStream / InvokeModelWithResponseStream', 'WebSockets or server-sent events to the client', 'Batch inference', 'S3 presigned URLs', 'CloudFormation outputs'], [0, 1], 'Streaming APIs plus a streaming transport.'),
    d2(3, 'An MCP tool is a simple stateless lookup. Which hosting choice is simplest?', ['AWS Lambda', 'A self-managed EC2 cluster', 'An on-premises server', 'An S3 static website'], 0, 'Stateless MCP servers fit Lambda.'),
    d2(4, 'Which option guarantees capacity for a steady, high-volume workload on a customised Bedrock model?', ['Provisioned Throughput', 'On-demand only', 'Batch inference', 'Prompt caching'], 0, 'Provisioned Throughput reserves capacity.'),
    d2(5, 'Which keep many teams\' GenAI usage consistent, secure and observable? (Choose TWO.)', ['A central GenAI gateway with auth, quotas, routing and logging', 'IAM policies limiting which roles may invoke which models', 'Each developer using personal API keys to external providers', 'Disabling CloudTrail', 'Sharing one IAM user'], [0, 1], 'Centralise access and enforce least privilege.'),
    d2(6, 'A high-impact agent action must be approved by a person. Which service implements the wait for approval?', ['AWS Step Functions (task token / callback)', 'Amazon CloudFront', 'Amazon S3', 'AWS Glue'], 0, 'Step Functions can pause for human approval.'),
    d2(7, 'Which reduce errors when calling Bedrock at high request rates? (Choose TWO.)', ['Exponential backoff with jitter', 'Cross-Region inference for extra capacity', 'Retrying immediately without delay', 'Removing timeouts', 'Sending larger prompts'], [0, 1], 'Back off and spread load.'),
    // ------------------------------------------------------------ Domain 3
    d3(1, 'Which are layers of defence in depth for an FM application? (Choose TWO.)', ['Bedrock Guardrails on inputs and outputs', 'Lambda validation of outputs before use', 'A system prompt as the only control', 'Trusting retrieved web content as instructions', 'Unrestricted tool permissions'], [0, 1], 'Independent controls around the model.'),
    d3(2, 'Which services detect personal data before it reaches a model? (Choose TWO.)', ['Amazon Macie (in S3)', 'Amazon Comprehend PII detection (in text)', 'AWS Budgets', 'Amazon Route 53', 'AWS CodeBuild'], [0, 1], 'Macie and Comprehend find PII.'),
    d3(3, 'Which provide traceability of generated answers for auditors? (Choose TWO.)', ['Source metadata and citations returned with answers', 'Logged model, prompt and source versions per request', 'Deleting logs after each request', 'Removing citations', 'Using random models'], [0, 1], 'Attribution plus versioned logs.'),
    d3(4, 'Which feature lets a company apply Bedrock Guardrails to text from a model hosted elsewhere?', ['The ApplyGuardrail API', 'Bedrock batch inference', 'S3 Object Lambda', 'AWS AppConfig'], 0, 'ApplyGuardrail evaluates any text.'),
    d3(5, 'Which approach makes numeric answers about business data deterministic?', ['Text-to-SQL: generate a query, run it on the database, report the results', 'Ask the model to memorise the numbers', 'Higher temperature', 'Longer prompts'], 0, 'Numbers come from the database.'),
    d3(6, 'Which give users transparency into an agent\'s decisions? (Choose TWO.)', ['Showing the sources used (evidence presentation)', 'Agent reasoning traces', 'Hiding tool calls', 'Removing explanations', 'Random answers'], [0, 1], 'Evidence and traces explain decisions.'),
    // ------------------------------------------------------------ Domain 4
    d4(1, 'Which reduce token costs without changing models? (Choose TWO.)', ['Prompt caching for repeated prefixes', 'Pruning or summarising conversation history', 'Sending every document in every prompt', 'Raising maxTokens', 'Adding more examples than needed'], [0, 1], 'Cache and trim context.'),
    d4(2, 'Which Bedrock CloudWatch metrics track token consumption? (Choose TWO.)', ['InputTokenCount', 'OutputTokenCount', 'BucketSizeBytes', 'CPUUtilization', 'HealthyHostCount'], [0, 1], 'Bedrock publishes input and output token counts.'),
    d4(3, 'Which technique serves answers for questions similar in meaning to previous ones without calling the model?', ['Semantic caching', 'Batch inference', 'Cross-Region inference', 'Model distillation'], 0, 'Semantic caching matches by embedding similarity.'),
    d4(4, 'Which improve perceived and real latency? (Choose TWO.)', ['Response streaming', 'Running independent model calls in parallel', 'Sequential chains of every call', 'Larger outputs', 'More retries'], [0, 1], 'Stream and parallelise.'),
    // ------------------------------------------------------------ Domain 5
    d5(1, 'Which evaluation approaches does Amazon Bedrock Model Evaluations support? (Choose TWO.)', ['LLM-as-a-judge', 'Human evaluation workflows', 'Load testing EC2 instances', 'DNS failover testing', 'Cost Explorer reports'], [0, 1], 'Automatic/LLM-as-a-judge and human evaluation.'),
    d5(2, 'A request fails because the prompt plus retrieved context exceeds the model\'s limit. Which fixes apply? (Choose TWO.)', ['Retrieve fewer or smaller chunks', 'Summarise or prune conversation history', 'Raise the temperature', 'Increase output maxTokens', 'Switch IAM roles'], [0, 1], 'Shrink the input to fit the context window.'),
    d5(3, 'After re-embedding documents with a new model, queries still use the old one. What happens?', ['Retrieval quality collapses because the vector spaces don\'t match', 'Nothing changes', 'Costs disappear', 'Guardrails stop working'], 0, 'Queries and documents must share an embedding model.'),
    d5(4, 'Which belong in a GenAI deployment pipeline\'s quality gate? (Choose TWO.)', ['Golden-set regression scores above a threshold', 'Hallucination/grounding rate within limits', 'The number of developers', 'The colour of the UI', 'The S3 bucket name'], [0, 1], 'Gate on measured quality.'),
  ],
};
