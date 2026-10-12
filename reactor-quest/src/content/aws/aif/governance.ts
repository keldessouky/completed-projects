// AIF-C01 Domain 5: Security, Compliance, and Governance for AI Solutions (14% of the exam).
import type { Deck } from '../../../game/types';
import { checkpoint, lesson, q } from '../kit';

export const aifGovernance: Deck = {
  id: 'aif-governance',
  name: 'Securing and Governing AI',
  subtitle: 'Domain 5 · 14% of the exam',
  outcome: 'Secure AI systems and their data, keep answers grounded, and prove compliance to an auditor.',
  hue: 20,
  domain: 'aif-d5',
  levels: [
    lesson({
      id: 'aif-securing-ai',
      title: 'Securing AI Systems',
      system: 'AI Containment',
      skills: ['aws-security', 'responsible-ai'],
      brief: `**ARIA:** An AI system is still a system: it has users, data, permissions and attackers. Most of security is the AWS basics you know, applied to models, prompts and agents.`,
      lesson: `## The shared responsibility model, for AI

AWS secures the infrastructure and its managed AI services. **You** secure your data, who can call which models, your prompts and outputs, your application, and what your agents may do. The split depends on the service: using a **managed API** (Bedrock) leaves less to you than **self-hosting** a model on EC2.

## AWS tools for securing AI

| Need | Tool |
|---|---|
| Who can invoke which model, read which data | **IAM** roles, policies and permissions (least privilege) |
| Protect data at rest and in transit | **Encryption** with **AWS KMS**; TLS |
| Keep traffic off the internet | **AWS PrivateLink** (VPC endpoints for Bedrock and SageMaker) |
| Find sensitive data (PII) in S3 before using it | **Amazon Macie** |
| Filter harmful input/output, block prompt attacks, mask PII | **Amazon Bedrock Guardrails** |
| Give agents their own identities and credentials to call tools | **Amazon Bedrock AgentCore Identity** |
| Control exactly what agents may do with tools | **Policy in AgentCore** |
| Log who called what | **AWS CloudTrail**; Bedrock **model invocation logging** (prompts and responses to CloudWatch Logs or S3) |

## Security and privacy considerations

**Prompt injection**, **data leakage** (sensitive data in prompts, outputs or logs), **output filtering and validation**, **toxicity**, threat detection, vulnerability management, infrastructure protection, and **audit trails** for AI interactions.

## Secure data engineering

Assess **data quality**; **access control** to datasets; **data integrity** (detect tampering); **privacy-enhancing technologies** (masking, anonymisation, tokenisation, differential privacy) so models don't see or leak personal data.`,
      questions: [
        q('Which service keeps traffic between a VPC and Amazon Bedrock off the public internet?', ['AWS PrivateLink (interface VPC endpoints)', 'Amazon CloudFront', 'AWS Direct Connect only', 'An internet gateway'], 0, 'PrivateLink gives private connectivity to AWS services.'),
        q('Before using thousands of S3 documents to fine-tune a model, a company wants to find any that contain personal data. Which service fits?', ['Amazon Macie', 'Amazon Polly', 'AWS Budgets', 'Amazon Translate'], 0, 'Macie discovers sensitive data in S3.'),
        q('Which is the customer\'s responsibility when using Amazon Bedrock?', ['Securing the data centres that host the models', 'Controlling who in their account may invoke which models, and protecting their data', 'Patching Bedrock\'s servers', 'Physical security of GPUs'], 1, 'Access control and data protection stay with the customer.'),
        q('A company must keep a record of every prompt and response sent to Bedrock for audits. What should it enable?', ['Bedrock model invocation logging', 'S3 Transfer Acceleration', 'Prompt caching', 'Batch inference'], 0, 'Invocation logging records requests and responses.'),
        q('An AI agent must call a CRM API using its own credentials, scoped to what it needs. Which feature fits?', ['Amazon Bedrock AgentCore Identity', 'Amazon Translate', 'S3 Lifecycle rules', 'AWS Artifact'], 0, 'AgentCore Identity manages agent identities and credentials.'),
        q('Which technique protects personal data used to train a model?', ['Privacy-enhancing technologies such as masking or anonymisation', 'Raising the temperature', 'Using more tokens', 'Public S3 buckets'], 0, 'Masking and anonymisation reduce privacy risk.'),
      ],
    }),
    lesson({
      id: 'aif-grounding',
      title: 'Grounding and Hallucination Control',
      system: 'Truth Anchor',
      skills: ['responsible-ai', 'genai'],
      brief: `**ARIA:** You can't stop a model from ever making things up, but you can anchor it to sources and check what it says. Here's how.`,
      lesson: `## Reducing hallucinations

| Method | How it helps |
|---|---|
| **RAG grounding** | Answers come from retrieved, trusted sources, with **citations** |
| **Contextual grounding checks** (Bedrock Guardrails) | Block answers not supported by the source, or not relevant |
| **Automated Reasoning checks** (Guardrails) | Verify answers against formal rules with logic |
| **Output validation** | Check structure and facts (schemas, lookups, business rules) before using an answer |
| **Confidence scoring** | Route low-confidence answers to a human or a fallback |
| **Prompting** | Tell the model to say "I don't know" when the context doesn't contain the answer; lower temperature |
| **Human review** | Amazon A2I for high-stakes outputs |

## Source citation and data lineage

- **Source citation:** show which documents an answer came from (Knowledge Bases return citations).
- **Data lineage:** record where data came from and how it was transformed, all the way to the model.
- **Data cataloguing:** an inventory of datasets with owners and meaning (for example, the AWS Glue Data Catalog, Amazon SageMaker Catalog).
- **SageMaker Model Cards:** document which data a model was trained on.

These let you answer an auditor's question: "where did this answer, and this model, come from?"`,
      questions: [
        q('Which technique grounds a model\'s answers in trusted company documents and lets users check the sources?', ['RAG with citations', 'Higher temperature', 'Prompt caching', 'Continued pre-training'], 0, 'RAG with citations grounds and attributes answers.'),
        q('A team wants to know where its training data came from and how it was transformed before reaching the model. What is this called?', ['Data lineage', 'Data drift', 'Tokenisation', 'Inference'], 0, 'Lineage tracks data origins and transformations.'),
        q('An application uses a model\'s output only when the model is confident, sending the rest to a human. Which technique is this?', ['Confidence scoring with human fallback', 'Batch inference', 'Prompt leaking', 'Distillation'], 0, 'Confidence thresholds route uncertain outputs to people.'),
        q('Which prompt instruction helps reduce hallucinations in a RAG app?', ['"Answer only from the provided context; if it isn\'t there, say you don\'t know."', '"Be as creative as possible."', '"Ignore the documents."', '"Use maximum temperature."'], 0, 'Constraining answers to the context reduces fabrication.'),
        q('An app must reject answers that its source documents don\'t support. Which Bedrock feature fits?', ['Guardrails contextual grounding check', 'Provisioned Throughput', 'Prompt Management', 'Model distillation'], 0, 'Grounding checks verify support in the source.'),
        q('Which service can catalogue datasets so teams know what data exists and who owns it?', ['AWS Glue Data Catalog', 'Amazon Polly', 'AWS Shield', 'Amazon Lex'], 0, 'Data catalogues inventory datasets and metadata.'),
      ],
    }),
    lesson({
      id: 'aif-compliance',
      title: 'Compliance and Governance',
      system: 'Oversight Council',
      skills: ['aws-security', 'responsible-ai'],
      brief: `**ARIA:** Ground control's lawyers want to know: is our AI compliant, who checks it, and how often? Learn the services, the strategies, and AWS's own framework for scoping AI security.`,
      lesson: `## AWS services for governance and compliance

| Service | Helps by |
|---|---|
| **AWS Artifact** | Downloading AWS **compliance reports** and agreements (ISO, SOC; also the AI-specific ISO/IEC 42001 certification for AI services) |
| **AWS CloudTrail** | Logging every API call: who used which model, when |
| **AWS Config** | Recording resource **configurations** and checking them against **rules** |
| **Amazon Inspector** | Scanning workloads for **vulnerabilities** |
| **AWS Trusted Advisor** | Best-practice checks (security, cost, limits) |
| **AWS Audit Manager** | Continuously collecting **evidence** for audits, including generative AI best-practice frameworks |

## Data governance strategies

Define the **data lifecycle** (collect, use, archive, delete), **logging**, **residency** (keep data in required Regions), **monitoring and observation**, and **retention** periods.

## Governance processes

- Written **policies** for acceptable AI use.
- A regular **review cadence** and **review strategies** (technical, legal, ethical reviews).
- **Transparency standards** (model cards, disclosure to users).
- **Team training** requirements.
- Governance **frameworks**, such as AWS's **Generative AI Security Scoping Matrix**.

## The Generative AI Security Scoping Matrix

Classifies GenAI use by **how much you own**, which decides your security responsibilities:

| Scope | You are… | Example |
|---|---|---|
| **1. Consumer app** | Using a public GenAI service | A public chatbot |
| **2. Enterprise app** | Using a business app with GenAI features | A SaaS tool with built-in AI |
| **3. Pre-trained models** | Building your app on an existing model via API | An app on Amazon Bedrock |
| **4. Fine-tuned models** | Customising a model with your data | Fine-tuning a Bedrock model |
| **5. Self-trained models** | Training your own model from scratch | Your own FM on SageMaker |

The higher the scope, the more you own: data, training, model security and more.`,
      questions: [
        q('Where can a company download AWS\'s ISO and SOC compliance reports for an audit of its AI system?', ['AWS Artifact', 'Amazon Bedrock', 'Amazon Macie', 'AWS Glue'], 0, 'Artifact provides compliance reports and agreements.'),
        q('Which service records which IAM user invoked which Bedrock model and when?', ['AWS CloudTrail', 'Amazon Inspector', 'AWS Budgets', 'Amazon Polly'], 0, 'CloudTrail logs API calls.'),
        q('A company builds a chatbot on Amazon Bedrock using a base model through the API, without fine-tuning. Which Generative AI Security Scoping Matrix scope is this?', ['Scope 1: consumer app', 'Scope 3: pre-trained models', 'Scope 4: fine-tuned models', 'Scope 5: self-trained models'], 1, 'Building on an existing model via API is scope 3.'),
        q('A company must keep AI training data only in the EU and delete it after 2 years. Which governance strategies are these?', ['Data residency and retention', 'Temperature and Top P', 'Chunking and embedding', 'Batch and on-demand'], 0, 'Residency and retention are data governance strategies.'),
        q('Which service continuously collects evidence to help prepare for audits?', ['AWS Audit Manager', 'Amazon Translate', 'Amazon Lex', 'AWS CodeBuild'], 0, 'Audit Manager gathers audit evidence continuously.'),
        q('Which service checks that resources such as S3 buckets holding training data stay configured according to company rules?', ['AWS Config', 'Amazon Polly', 'Amazon Comprehend', 'AWS Batch'], 0, 'Config evaluates resource configurations against rules.'),
      ],
    }),
    checkpoint({
      id: 'aif-governance-checkpoint',
      title: 'Checkpoint: Securing and Governing AI',
      system: 'Oversight Certification Gate',
      skills: ['aws-security', 'responsible-ai'],
      brief: `**ARIA:** Exam-style scenarios on AI security, grounding, compliance services and governance.`,
      lesson: `## Before you start

- IAM least privilege, KMS encryption, PrivateLink, Macie, Guardrails, AgentCore Identity and Policy, CloudTrail, invocation logging.
- Grounding: RAG with citations, contextual grounding checks, Automated Reasoning, output validation, confidence scoring.
- Lineage, cataloguing, Model Cards.
- Artifact, CloudTrail, Config, Inspector, Trusted Advisor, Audit Manager.
- Scoping Matrix: 1 consumer, 2 enterprise, 3 pre-trained, 4 fine-tuned, 5 self-trained.`,
      questions: [
        q('A company fine-tunes a model on Bedrock with its own customer data. Which Scoping Matrix scope applies?', ['Scope 2', 'Scope 3', 'Scope 4', 'Scope 1'], 2, 'Fine-tuned models are scope 4.'),
        q('Which concerns are addressed by encrypting training data with AWS KMS and restricting access with IAM?', ['Data confidentiality and access control', 'Model latency and token cost', 'Temperature and Top K', 'Hallucination and drift'], 0, 'Encryption and IAM protect confidentiality and control access.'),
        q('Employees paste customer data into prompts. How can a company stop personal data appearing in model responses?', ['Bedrock Guardrails sensitive information filters (mask or block PII)', 'Higher temperature', 'Batch inference', 'Larger context window'], 0, 'PII filters mask or block sensitive data.'),
        q('An auditor asks which data a deployed model was trained on and its known limitations. What should the team show?', ['The SageMaker Model Card', 'A CloudFront distribution', 'An S3 Lifecycle rule', 'A Lambda function URL'], 0, 'Model Cards document training data, evaluation and limitations.'),
        q('Which service scans the EC2 instances and container images running a self-hosted model for vulnerabilities?', ['Amazon Inspector', 'Amazon Macie', 'AWS Artifact', 'Amazon Polly'], 0, 'Inspector scans for software vulnerabilities.'),
        q('A team wants to stop an AI agent from issuing refunds above $500, no matter what the model decides. Which control fits?', ['Policy in Amazon Bedrock AgentCore (rules on tool use)', 'Raising temperature', 'Prompt caching', 'S3 Versioning'], 0, 'AgentCore Policy enforces rules on what agents may do with tools.'),
        q('Which is part of a good AI governance process?', ['A defined review cadence, written policies and team training', 'Letting each developer decide alone', 'Never logging AI interactions', 'Skipping documentation'], 0, 'Policies, reviews and training are governance basics.'),
        q('A chatbot must refuse to answer when its retrieved documents don\'t contain the answer. Which approach fits best?', ['Grounding: instruct it to answer only from context, and add a contextual grounding check', 'Increase max tokens', 'Use a diffusion model', 'Disable logging'], 0, 'Instructions plus grounding checks reduce unsupported answers.'),
      ],
    }),
  ],
};
