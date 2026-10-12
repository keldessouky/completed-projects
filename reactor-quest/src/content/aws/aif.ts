// AWS Certified AI Practitioner (AIF-C01): the foundational AI exam, and the
// first AWS journey. Five floors follow the exam guide's five domains, and a
// bank of exam-style questions (including "Choose TWO") feeds the practice exams.
import type { Path } from '../../game/types';
import { aifApps } from './aif/apps';
import { aifGenai } from './aif/genai';
import { aifGovernance } from './aif/governance';
import { aifMl } from './aif/ml';
import { aifResponsible } from './aif/responsible';
import { bankFor } from './kit';

const d1 = bankFor('aif', 'aif-d1');
const d2 = bankFor('aif', 'aif-d2');
const d3 = bankFor('aif', 'aif-d3');
const d4 = bankFor('aif', 'aif-d4');
const d5 = bankFor('aif', 'aif-d5');

export const AIF: Path = {
  id: 'aws-aif',
  name: 'AWS Certified AI Practitioner',
  short: 'AI Practitioner',
  tagline: 'The foundational AI exam: machine learning, generative AI, agents, foundation models on AWS, and using AI responsibly.',
  icon: '🤖',
  exam: {
    code: 'AIF-C01',
    name: 'AWS Certified AI Practitioner',
    level: 'Foundational',
    questions: 65,
    minutes: 90,
    pass: 700,
    domains: [
      { id: 'aif-d1', name: 'Fundamentals of AI and ML', weight: 20 },
      { id: 'aif-d2', name: 'Fundamentals of Generative AI', weight: 24 },
      { id: 'aif-d3', name: 'Applications of Foundation Models', weight: 28 },
      { id: 'aif-d4', name: 'Guidelines for Responsible AI', weight: 14 },
      { id: 'aif-d5', name: 'Security, Compliance, and Governance for AI Solutions', weight: 14 },
    ],
    guide: 'https://docs.aws.amazon.com/aws-certification/latest/ai-practitioner-01/ai-practitioner-01.html',
    note: 'The real exam also has ordering and matching questions; here those ideas are practised as multiple choice.',
  },
  decks: [aifMl, aifGenai, aifApps, aifResponsible, aifGovernance],
  bank: [
    // ------------------------------------------------------------ Domain 1
    d1(1, 'Which are examples of supervised learning tasks? (Choose TWO.)', ['Predicting house prices from labelled sales', 'Classifying emails as spam using labelled examples', 'Grouping customers with no labels', 'A robot learning by trial and reward', 'Finding topics in unlabelled text'], [0, 1], 'Both learn from labelled examples.'),
    d1(2, 'Which AWS services are pre-trained AI services that need no ML expertise? (Choose TWO.)', ['Amazon Rekognition', 'Amazon Comprehend', 'Amazon EC2', 'Amazon EBS', 'Amazon VPC'], [0, 1], 'Rekognition and Comprehend are ready-made AI services.'),
    d1(3, 'A company needs to process thousands of recorded calls, translate them, and read the summaries aloud. Which services, in order?', ['Transcribe → Translate → Polly', 'Polly → Translate → Transcribe', 'Lex → Comprehend → Textract', 'Translate → Polly → Transcribe'], 0, 'Speech to text, translate, then text to speech.'),
    d1(4, 'Which metrics should be checked for a fraud model where fraud is rare? (Choose TWO.)', ['Precision', 'Recall', 'Accuracy alone', 'Number of GPUs', 'Token count'], [0, 1], 'With imbalanced classes, precision and recall (or F1) matter.'),
    d1(5, 'Which is an MLOps practice?', ['Retraining models automatically when drift is detected', 'Deploying models without monitoring', 'Training only on a laptop', 'Never versioning models'], 0, 'Monitoring and automated retraining are MLOps.'),
    d1(6, 'A model must give predictions on large documents that take 10 minutes each, with requests queued. Which SageMaker option fits?', ['Asynchronous inference', 'Real-time inference', 'Serverless inference', 'Canvas'], 0, 'Async inference handles long processing and large payloads.'),
    d1(7, 'When is a traditional ML model a better choice than a foundation model? (Choose TWO.)', ['When strict explainability is required by regulators', 'When predicting from structured tabular data at low cost per prediction', 'When generating creative marketing copy', 'When summarising long free-form documents', 'When building a general chat assistant'], [0, 1], 'Traditional ML suits explainable, low-cost tabular predictions.'),
    // ------------------------------------------------------------ Domain 2
    d2(1, 'Which are disadvantages of generative AI? (Choose TWO.)', ['Hallucinations', 'Nondeterministic outputs', 'Ability to generate content', 'Conversational interfaces', 'Adaptability to many tasks'], [0, 1], 'Hallucination and nondeterminism are limitations; the rest are advantages.'),
    d2(2, 'Which reduce the cost of a GenAI application? (Choose TWO.)', ['Choosing a smaller model that meets quality needs', 'Using batch inference for non-urgent work', 'Sending entire manuals in every prompt', 'Always using the largest model', 'Requesting maximum-length answers'], [0, 1], 'Smaller models and batch inference cut cost.'),
    d2(3, 'Which concept represents the meaning of text as a list of numbers?', ['Embedding', 'Token', 'Temperature', 'Stop sequence'], 0, 'Embeddings are vectors of meaning.'),
    d2(4, 'Which are components of an AI agent? (Choose TWO.)', ['Tools it can call', 'Memory', 'A confusion matrix', 'An S3 storage class', 'A NAT gateway'], [0, 1], 'Agents use tools and memory, orchestrated by a model.'),
    d2(5, 'A team wants to connect its agents to a database and a ticketing system using an open standard, so the same tools work with any compatible agent. What should it use?', ['Model Context Protocol (MCP)', 'BLEU', 'Batch transform', 'Prompt caching'], 0, 'MCP standardises tool and data connections.'),
    d2(6, 'Which describes how Amazon Bedrock handles customer prompts and data?', ['They train the base models for all customers', 'They aren\'t used to train the base models, and stay in the chosen Region', 'They are made public', 'They are deleted before inference'], 1, 'Bedrock keeps customer data private and out of base model training.'),
    d2(7, 'Which AWS offerings help build and run AI agents? (Choose TWO.)', ['Amazon Bedrock AgentCore', 'Strands Agents', 'AWS Snowball Edge', 'Amazon Glacier', 'AWS Direct Connect'], [0, 1], 'AgentCore runs agents in production; Strands is the agent SDK.'),
    d2(8, 'Which metric best shows the business value of a GenAI sales assistant?', ['Conversion rate', 'Embedding dimensions', 'Model parameter count', 'Token vocabulary size'], 0, 'Business metrics like conversion rate show value.'),
    // ------------------------------------------------------------ Domain 3
    d3(1, 'Which are benefits of RAG compared with fine-tuning to add company knowledge? (Choose TWO.)', ['Knowledge can be updated without retraining', 'Answers can cite their sources', 'It changes the model\'s weights', 'It requires pre-training', 'It removes the need for a vector store'], [0, 1], 'RAG keeps data current and supports citations.'),
    d3(2, 'Which inference parameter changes would make outputs more deterministic? (Choose TWO.)', ['Lower temperature', 'Lower Top P', 'Higher temperature', 'Higher Top P', 'More output tokens'], [0, 1], 'Lower temperature and Top P narrow the choices.'),
    d3(3, 'Which prompt engineering techniques use examples in the prompt? (Choose TWO.)', ['One-shot prompting', 'Few-shot prompting', 'Zero-shot prompting', 'Negative prompting', 'Prompt caching'], [0, 1], 'One-shot and few-shot include examples.'),
    d3(4, 'Which are prompt-based attacks? (Choose TWO.)', ['Prompt injection', 'Jailbreaking', 'Model distillation', 'Chunking', 'Batch inference'], [0, 1], 'Injection and jailbreaking attack via prompts.'),
    d3(5, 'A company wants to compare three foundation models on its own summarisation tasks with minimal setup. Which fits?', ['Amazon Bedrock Model Evaluation', 'Amazon Macie', 'AWS CloudFormation', 'Amazon Lex'], 0, 'Bedrock Model Evaluation compares models on your data.'),
    d3(6, 'Which metric fits evaluating a model that summarises reports?', ['ROUGE', 'BLEU', 'RMSE', 'AUC'], 0, 'ROUGE is the summarisation metric.'),
    d3(7, 'A company wants a model specialised in insurance language using 10 GB of unlabelled insurance documents. Which approach fits?', ['Continued pre-training', 'Few-shot prompting only', 'Prompt caching', 'Lower temperature'], 0, 'Continued pre-training uses unlabelled domain data.'),
    d3(8, 'Which can store embeddings for Bedrock Knowledge Bases? (Choose TWO.)', ['Amazon OpenSearch Serverless', 'Amazon Aurora PostgreSQL with pgvector', 'Amazon SQS', 'Amazon Route 53', 'AWS Budgets'], [0, 1], 'Both are supported vector stores.'),
    // ------------------------------------------------------------ Domain 4
    d4(1, 'Which are dimensions of responsible AI? (Choose TWO.)', ['Fairness', 'Veracity', 'Elasticity', 'Durability', 'Latency'], [0, 1], 'Fairness and veracity (truthfulness) are responsible AI dimensions.'),
    d4(2, 'Which Guardrails features help protect users of a public chatbot? (Choose TWO.)', ['Content filters for harmful content', 'Sensitive information (PII) filters', 'Provisioned Throughput', 'Model distillation', 'Batch inference'], [0, 1], 'Content and PII filters protect users.'),
    d4(3, 'Which tools help explain or document models? (Choose TWO.)', ['SageMaker Clarify', 'SageMaker Model Cards', 'Amazon CloudFront', 'AWS Direct Connect', 'Amazon SQS'], [0, 1], 'Clarify explains predictions; Model Cards document models.'),
    d4(4, 'A dataset contains 95% examples from one region and 5% from others. What is the main risk?', ['Biased, less accurate results for under-represented regions', 'Lower token cost', 'Faster training', 'Better fairness'], 0, 'Imbalanced data leads to biased performance.'),
    d4(5, 'Which is a responsible practice when selecting a model?', ['Considering its environmental impact and choosing an efficient model that meets the need', 'Always training a new model from scratch', 'Ignoring its licence', 'Choosing the largest model by default'], 0, 'Sustainability is a responsible selection criterion.'),
    // ------------------------------------------------------------ Domain 5
    d5(1, 'Which AWS services help secure data used by an AI application? (Choose TWO.)', ['AWS KMS for encryption', 'Amazon Macie to find sensitive data in S3', 'Amazon Polly', 'Amazon Translate', 'Amazon Lex'], [0, 1], 'KMS encrypts; Macie finds sensitive data.'),
    d5(2, 'Which services help with governance and compliance of AI workloads? (Choose TWO.)', ['AWS CloudTrail', 'AWS Config', 'Amazon Polly', 'Amazon Rekognition', 'Amazon Transcribe'], [0, 1], 'CloudTrail audits API calls; Config checks configurations.'),
    d5(3, 'A company uses a public GenAI chat app for employees, with no development of its own. Which Scoping Matrix scope is this?', ['Scope 1: consumer app', 'Scope 3: pre-trained models', 'Scope 4: fine-tuned models', 'Scope 5: self-trained models'], 0, 'Using a public consumer service is scope 1.'),
    d5(4, 'Which reduce hallucinations in a GenAI app? (Choose TWO.)', ['RAG grounding with citations', 'Guardrails contextual grounding checks', 'Higher temperature', 'Removing the system prompt', 'Longer maximum output'], [0, 1], 'Grounding and grounding checks reduce unsupported answers.'),
    d5(5, 'Which keeps calls from a VPC to Amazon Bedrock on the AWS network?', ['An interface VPC endpoint (AWS PrivateLink)', 'An internet gateway', 'A public IP address', 'Amazon CloudFront'], 0, 'PrivateLink provides private connectivity.'),
    d5(6, 'Which describes data lineage?', ['A record of where data came from and how it was transformed', 'The number of tokens in a prompt', 'A type of embedding', 'A load balancer'], 0, 'Lineage tracks origins and transformations.'),
  ],
};
