// AIP-C01 Domain 3: AI Safety, Security, and Governance (20%).
import type { Deck } from '../../../game/types';
import { checkpoint, lesson, q } from '../kit';

export const aipSafety: Deck = {
  id: 'aip-safety',
  name: 'Safety, Security and Governance',
  subtitle: 'Domain 3 · 20% of the exam',
  outcome: 'Defend FM applications in depth, protect private data, and govern AI so it is traceable, fair and compliant.',
  hue: 0,
  domain: 'aip-d3',
  levels: [
    lesson({
      id: 'aip-io-safety',
      title: 'Input and Output Safety in Depth',
      system: 'Shield Layers',
      skills: ['responsible-ai', 'aws-security'],
      brief: `**ARIA:** One filter is a speed bump. Professionals stack defences: before the model, around the model, after the model, and at the API edge.`,
      lesson: `## Defence in depth

1. **Pre-processing:** sanitise input; detect PII, toxicity or intent with **Amazon Comprehend**; reject obvious attacks; enforce size limits.
2. **Model-level guardrails:** **Amazon Bedrock Guardrails** on input and output (content filters, **prompt attack** filters, denied topics, PII filters, contextual grounding, Automated Reasoning). The **ApplyGuardrail API** applies a guardrail to any text, even for models outside Bedrock.
3. **Post-processing:** **Lambda** validation of outputs (schema, allowed values, links, no secrets).
4. **API edge:** **API Gateway** response filtering, auth and throttling; WAF for abusive traffic.

Custom moderation workflows (Step Functions + Lambda) handle cases that need human review or several checks.

## Adversarial threats

**Prompt injection** (direct and indirect, via retrieved content), **jailbreaks**: detect with guardrails and safety classifiers, separate instructions from data, restrict tool permissions, and run **automated adversarial testing** (red-team prompt suites) in CI.

## Reducing hallucinations

- **Ground** answers with Bedrock **Knowledge Bases** and require citations; **contextual grounding checks**.
- **Confidence scoring** and **semantic similarity** between the answer and the sources to verify claims.
- **Structured outputs** enforced with a **JSON Schema** (and validation) so downstream code gets exactly the fields it needs.
- For data questions, **text-to-SQL** gives **deterministic** results from a database instead of the model guessing numbers.`,
      questions: [
        q('A company uses a third-party model hosted outside Bedrock but wants Bedrock Guardrails\' content filters on its inputs and outputs. What should it use?', ['The ApplyGuardrail API', 'Bedrock Provisioned Throughput', 'S3 Object Lambda', 'Amazon Kendra'], 0, 'ApplyGuardrail evaluates any text against a guardrail.'),
        q('A finance assistant must report exact account totals, and the model sometimes invents numbers. Which approach gives deterministic results?', ['Generate SQL from the question (text-to-SQL), run it on the database, and present the query results', 'Raise temperature', 'Fine-tune on old totals', 'Ask the model to be careful'], 0, 'Numbers come from the database, not the model\'s guess.'),
        q('Downstream code crashes when the model\'s output misses required fields. What fixes this?', ['Enforce a JSON Schema for the output and validate it (retrying or repairing on failure)', 'Increase max tokens', 'Use a diffusion model', 'Disable logging'], 0, 'Structured output plus validation guarantees the format.'),
        q('Which layering best reflects defence in depth for an FM application?', ['Input sanitisation and classification, Bedrock Guardrails, output validation in Lambda, and API Gateway filtering', 'One system prompt telling the model to be safe', 'Only WAF', 'Only IAM'], 0, 'Several independent layers before, around and after the model.'),
        q('A RAG app pulls web pages that may contain hidden instructions. What is the most important mitigation?', ['Treat retrieved content as data (not instructions), use prompt attack filters, and limit what tools the model can trigger', 'Increase the context window', 'Use more web pages', 'Disable citations'], 0, 'Indirect prompt injection is mitigated by separation, filtering and least privilege.'),
        q('How can a team catch new jailbreak techniques before releases?', ['Automated adversarial (red-team) test suites run in the CI pipeline', 'Waiting for user complaints', 'Higher temperature', 'Removing guardrails in testing'], 0, 'Adversarial tests in CI find weaknesses early.'),
      ],
    }),
    lesson({
      id: 'aip-privacy',
      title: 'Data Security and Privacy',
      system: 'Privacy Vault',
      skills: ['aws-security'],
      brief: `**ARIA:** Customer data flows through prompts, embeddings, logs and model outputs. Every one of those is a place it can leak. Lock each down.`,
      lesson: `## Protected environments

- **VPC endpoints (PrivateLink)** for Bedrock, SageMaker and data stores; no public internet paths.
- **IAM** policies scoping which roles can invoke which models and read which data.
- **AWS Lake Formation** for fine-grained (table, column, row) access to data lakes feeding GenAI.
- **CloudWatch** and CloudTrail to monitor data access.

## Detecting and protecting personal data

- **Amazon Macie** finds PII in S3 before it enters training or knowledge bases.
- **Amazon Comprehend** detects (and can redact) PII in text in real time.
- **Bedrock Guardrails** sensitive information filters **mask or block** PII in prompts and responses.
- **Data masking** and **anonymisation/pseudonymisation** keep utility while protecting identities.

## Bedrock's privacy features

Your prompts and completions **aren't used to train base models** or shared with model providers; data is encrypted in transit and at rest (with your **KMS** keys where supported); **model invocation logging** is opt-in, and you choose where logs go (encrypt them, restrict access, redact sensitive content).

## Retention

**S3 Lifecycle** rules expire logs and data per policy; DynamoDB **TTL** for conversation history; delete vectors when source documents are deleted.`,
      questions: [
        q('Training documents in S3 may contain customer PII that must be found before fine-tuning. Which service fits?', ['Amazon Macie', 'AWS Budgets', 'Amazon Polly', 'AWS CodeBuild'], 0, 'Macie discovers sensitive data in S3.'),
        q('Analysts may query only non-sensitive columns of a data lake used for GenAI. Which service provides column-level permissions?', ['AWS Lake Formation', 'Amazon CloudFront', 'Amazon SQS', 'AWS Amplify'], 0, 'Lake Formation offers fine-grained table, column and row access.'),
        q('A chatbot must mask customer phone numbers in both prompts and responses. Which feature fits best?', ['Bedrock Guardrails sensitive information filters', 'A higher temperature', 'Provisioned Throughput', 'Prompt caching'], 0, 'Guardrails can mask or block PII.'),
        q('Which statement about Amazon Bedrock data privacy is correct?', ['Customer prompts and completions aren\'t used to train the base models', 'All prompts are shared with model providers', 'Invocation logging is always on and public', 'Data can\'t be encrypted'], 0, 'Bedrock keeps customer data private.'),
        q('Invocation logs must be deleted after 90 days. What implements this?', ['An S3 Lifecycle expiration rule on the log bucket (or CloudWatch Logs retention)', 'Manual deletion each quarter', 'A Guardrails word filter', 'A larger bucket'], 0, 'Lifecycle and retention settings enforce retention policies.'),
        q('An application running in private subnets must call Bedrock without traversing the internet. What is needed?', ['An interface VPC endpoint for Bedrock (PrivateLink)', 'A public IP on each instance', 'An internet gateway route', 'A CloudFront distribution'], 0, 'PrivateLink keeps traffic private.'),
      ],
    }),
    lesson({
      id: 'aip-governance',
      title: 'Governance and Responsible AI in Practice',
      system: 'Accountability Engine',
      skills: ['responsible-ai'],
      brief: `**ARIA:** "Where did this answer come from, who approved this model, and is it treating everyone fairly?" Build systems that can answer all three, automatically.`,
      lesson: `## Compliance and traceability

- **Programmatic model cards** (SageMaker Model Cards created via API in pipelines) documenting purpose, data, evaluation and limitations.
- **Data lineage** with **AWS Glue** (Data Catalog registers sources; lineage tracking), **metadata tagging** on documents for **source attribution** in generated answers.
- **CloudTrail** audit logs; **CloudWatch Logs** decision logs (inputs, retrieved sources, outputs, guardrail actions).

## Continuous governance

- Automated detection of **misuse**, **drift** and **policy violations**; **bias drift** monitoring.
- **Alerting and remediation** workflows (EventBridge → Lambda/Step Functions).
- **Token-level redaction** in logs, **response logging**, AI **output policy filters**.
- Organisational frameworks aligned to policy, regulation and responsible AI principles, with regular reviews.

## Responsible AI features to build in

- **Transparency:** show sources (evidence presentation), **reasoning traces** (Bedrock agent tracing), user-facing explanations, and **confidence** indicators (uncertainty metrics in CloudWatch).
- **Fairness evaluation:** pre-defined fairness metrics; **A/B testing** of prompts with Prompt Management and Bedrock Flows; **LLM-as-a-judge** evaluations across demographic variants.
- **Policy compliance:** Guardrails configured from written policy; model cards documenting limitations; Lambda compliance checks.`,
      questions: [
        q('Regulators require that every generated answer can be traced to its source documents. Which design supports this?', ['Metadata tagging of sources, retrieval citations returned with answers, and logs of the retrieved context', 'Higher temperature', 'Removing the knowledge base', 'Deleting logs daily'], 0, 'Source attribution needs metadata, citations and logs.'),
        q('A team wants model documentation generated automatically each time its pipeline trains a model. What should the pipeline create?', ['SageMaker Model Cards via the API (programmatic model cards)', 'A README by hand', 'A CloudFront distribution', 'An SQS queue'], 0, 'Programmatic model cards keep documentation current.'),
        q('Which service can register data sources and track lineage for datasets feeding a GenAI application?', ['AWS Glue (Data Catalog and lineage)', 'Amazon Polly', 'AWS Shield', 'Amazon Lex'], 0, 'Glue catalogues data and tracks lineage.'),
        q('A team wants to check whether an assistant answers equally well for names associated with different demographics. Which approach fits?', ['Fairness evaluation: run paired prompts varying only demographic attributes and score them (for example with LLM-as-a-judge)', 'Only test with one name', 'Increase temperature', 'Disable Guardrails'], 0, 'Controlled paired tests reveal unfair differences.'),
        q('Users must see why an agent took an action. Which Bedrock capability provides this?', ['Agent tracing (reasoning traces)', 'Batch inference', 'Prompt caching', 'Cross-Region inference'], 0, 'Traces show the agent\'s reasoning steps and tool calls.'),
        q('Logs must keep interaction records for audits without storing customers\' card numbers. What should be applied?', ['Token-level redaction (masking) before logs are written', 'No logging at all', 'Public log buckets', 'Larger log retention'], 0, 'Redaction keeps audit logs without sensitive values.'),
      ],
    }),
    checkpoint({
      id: 'aip-safety-checkpoint',
      title: 'Checkpoint: Safety, Security and Governance',
      system: 'Safety Certification Gate',
      skills: ['responsible-ai', 'aws-security'],
      brief: `**ARIA:** Professional-level scenarios on layered safety, privacy and governance.`,
      lesson: `## Before you start

- Comprehend pre-filters → Guardrails (or ApplyGuardrail) → Lambda output validation → API Gateway filtering; adversarial testing.
- Grounding, citations, confidence, JSON Schema outputs, text-to-SQL.
- PrivateLink, IAM, Lake Formation, Macie, Comprehend PII, Guardrails PII masking, KMS, retention.
- Programmatic model cards, Glue lineage, source metadata, decision logs, agent tracing, fairness A/B tests.`,
      questions: [
        q('An HR assistant must never discuss salaries of named employees, must mask PII, and must block prompt attacks. Which single feature covers all three?', ['Amazon Bedrock Guardrails (denied topics, PII filters, prompt attack filter)', 'AWS WAF', 'Amazon Inspector', 'S3 Object Lock'], 0, 'Guardrails combine these policies.'),
        q('Which is the strongest protection against an agent leaking data from systems it shouldn\'t access?', ['Least-privilege IAM permissions for the agent\'s tools and data', 'A longer system prompt', 'A different model', 'Higher top-p'], 0, 'Permissions limit what can leak, regardless of the model.'),
        q('Generated product descriptions sometimes include claims not in the product data. Which controls help? (Pick the best answer.)', ['Ground on the product data with a contextual grounding check, and validate outputs against the source', 'Raise temperature', 'Remove the product data', 'Use batch inference'], 0, 'Grounding plus validation reduces unsupported claims.'),
        q('A healthcare app must keep a log of every AI decision for 7 years while protecting patient identities. Which approach fits?', ['Decision logs with PHI redacted, encrypted with KMS, retained with lifecycle policies', 'No logs', 'Plain-text logs in a public bucket', 'Logs only in browser memory'], 0, 'Retain redacted, encrypted logs for the required period.'),
        q('Bias in an assistant\'s outputs slowly increases after a prompt update. What would catch this?', ['Continuous monitoring with bias/drift metrics and automated alerts', 'One test before the first launch only', 'A bigger model', 'Prompt caching'], 0, 'Continuous monitoring detects drift.'),
        q('Which is part of defence in depth for GenAI inputs?', ['Detecting PII and malicious patterns with Amazon Comprehend before the model call', 'Sending raw user input straight to tools', 'Removing all guardrails', 'Using only client-side checks'], 0, 'Pre-processing is the first layer.'),
        q('A data lake feeding a knowledge base contains columns some teams must not see. Which service enforces this at the data layer?', ['AWS Lake Formation', 'Amazon Translate', 'AWS Budgets', 'AWS CodePipeline'], 0, 'Lake Formation provides fine-grained access control.'),
        q('Auditors ask which model version, prompt version and sources produced a specific answer. What must be logged?', ['Model ID/version, prompt version, retrieved source IDs and the output for each request', 'Only the final answer', 'Nothing', 'Only the user\'s IP'], 0, 'Traceability needs every input that shaped the answer.'),
      ],
    }),
  ],
};
