// AIF-C01 Domain 2: Fundamentals of Generative AI (24% of the exam).
import type { Deck } from '../../../game/types';
import { checkpoint, lesson, q } from '../kit';

export const aifGenai: Deck = {
  id: 'aif-genai',
  name: 'Generative AI Fundamentals',
  subtitle: 'Domain 2 · 24% of the exam',
  outcome: 'Explain how generative models work, what they cost, what they get wrong, and what AWS offers to build with them.',
  hue: 300,
  domain: 'aif-d2',
  levels: [
    lesson({
      id: 'aif-genai-concepts',
      title: 'Tokens, Embeddings and Transformers',
      system: 'Language Core',
      skills: ['genai'],
      brief: `**ARIA:** This is how I read and write. Text goes in as tokens, meaning lives in vectors, and a transformer guesses what comes next, very, very well.`,
      lesson: `## The building blocks

| Concept | Meaning |
|---|---|
| **Token** | The unit a model reads and writes: a word, part of a word or punctuation. Roughly ¾ of an English word on average. Models have a **context window**: a maximum number of tokens per request. |
| **Chunking** | Splitting long documents into smaller pieces, so each fits a model or a search index (important for RAG). |
| **Embedding** | A list of numbers (a **vector**) that represents the **meaning** of text, an image or audio. Similar meanings → nearby vectors. |
| **Vector** | The numeric array itself; stored in a **vector database** and searched by similarity. |
| **Transformer** | The neural network architecture behind modern LLMs. Its **attention** mechanism weighs how every token relates to every other. |
| **Large language model (LLM)** | A transformer trained on huge amounts of text that predicts the next token. |
| **Foundation model (FM)** | A large model **pre-trained on broad data** that can be adapted to many tasks (LLMs are one kind). |
| **Multimodal model** | Takes or produces more than one kind of data: text, images, audio, video. |
| **Diffusion model** | Generates images (or video) by starting from noise and removing it step by step. |
| **Prompt engineering** | Writing the input carefully to get the output you want. |

## What GenAI is used for

Text generation and **summarisation**, chat **assistants** and **customer service agents**, **translation**, **code generation**, **image, video and audio** generation, semantic **search** and **recommendations**.`,
      questions: [
        q('What is an embedding?', ['A compressed image file', 'A numeric vector that represents the meaning of data, so similar items are close together', 'A type of GPU', 'A prompt template'], 1, 'Embeddings capture meaning as vectors.'),
        q('Which architecture underlies most modern large language models?', ['Decision trees', 'Transformers', 'K-means clustering', 'Linear regression'], 1, 'Transformers with attention power LLMs.'),
        q('Which kind of model generates images by gradually removing noise?', ['Diffusion model', 'Recurrent classifier', 'Linear model', 'Clustering model'], 0, 'Diffusion models denoise step by step.'),
        q('Why are long documents split into chunks for a GenAI application?', ['To make them harder to read', 'So each piece fits the model\'s context window or search index and can be retrieved precisely', 'Because tokens can\'t contain letters', 'To encrypt them'], 1, 'Chunking makes text retrievable and fits context limits.'),
        q('What does a multimodal model do?', ['Works only with text', 'Handles more than one type of data, such as text and images', 'Runs on multiple Regions', 'Uses multiple databases'], 1, 'Multimodal = several data types.'),
        q('What is a foundation model?', ['A model trained for exactly one narrow task', 'A large model pre-trained on broad data that can be adapted to many tasks', 'The first version of any model', 'A database schema'], 1, 'FMs are general-purpose and adaptable.'),
      ],
    }),
    lesson({
      id: 'aif-fm-lifecycle',
      title: 'The Life of a Foundation Model, and Its Price',
      system: 'Token Meter',
      skills: ['genai', 'aws-billing'],
      brief: `**ARIA:** Every word I read and write costs money. Learn how foundation models are made, how you pay for them, and what makes a request cheap or expensive.`,
      lesson: `## The FM lifecycle

1. **Data selection:** huge, diverse, curated datasets.
2. **Model selection:** architecture and size.
3. **Pre-training:** self-supervised learning on the data (very expensive, done by model providers).
4. **Fine-tuning:** adapting to tasks or domains with smaller, labelled data.
5. **Evaluation:** benchmarks, human review, task metrics.
6. **Deployment:** serving the model for inference.
7. **Feedback:** monitoring and user feedback drive improvements.

## Token-based pricing

Most FMs charge per **input token** and per **output token** (output usually costs more). Cost and speed grow with:

- Longer prompts (big context, long documents, many examples).
- Longer answers (raise or cap **max tokens**).
- Bigger models (more capable, slower, pricier per token).

Ways to cut cost: a smaller model that's good enough, shorter prompts, **prompt caching** (reuse a repeated prompt prefix at lower cost and latency), **batch inference** for work that isn't urgent (in Bedrock, much cheaper than on-demand), and RAG instead of pasting whole documents.

## Amazon Bedrock pricing modes

| Mode | For |
|---|---|
| **On-demand** | Pay per token, no commitment |
| **Batch** | Large, non-urgent jobs at a lower price per token |
| **Provisioned Throughput** | Reserved, dedicated capacity for steady high volume; the usual way to serve customised models |

## Context engineering

Deciding **what goes into the model's context** for each request: instructions, retrieved documents, conversation history, tool results, memory. Good context engineering gives better answers with fewer tokens; overloading the context wastes money and can confuse the model.`,
      questions: [
        q('How do most foundation models on Amazon Bedrock charge for on-demand use?', ['A flat monthly fee per user', 'Per input and output token', 'Per GPU hour only', 'They are free'], 1, 'On-demand pricing is per token, in and out.'),
        q('A team sends the same 5,000-token system prompt with every request. Which feature lowers cost and latency?', ['Prompt caching', 'A larger model', 'Higher temperature', 'More output tokens'], 0, 'Prompt caching reuses a repeated prefix cheaply.'),
        q('A company must summarise 2 million documents overnight; no one waits for results. Which Bedrock option is most cost-effective?', ['On-demand real-time calls', 'Batch inference', 'Provisioned Throughput for one hour', 'A larger model'], 1, 'Batch inference costs less for non-urgent bulk work.'),
        q('Which stage of the FM lifecycle is usually done only by model providers because it is so expensive?', ['Pre-training', 'Prompt engineering', 'Evaluation with a few examples', 'Choosing a temperature'], 0, 'Pre-training on massive data is very costly.'),
        q('What is context engineering?', ['Designing data centre cooling', 'Choosing what instructions, documents, history and tool results go into the model\'s context for each request', 'Training a model from scratch', 'Encrypting prompts'], 1, 'Context engineering curates the model\'s inputs.'),
        q('Which change usually REDUCES the cost of a GenAI request?', ['Using a larger model', 'Asking for longer answers', 'Using a smaller model that meets quality needs', 'Pasting whole manuals into every prompt'], 2, 'Smaller models and shorter prompts cost less.'),
      ],
    }),
    lesson({
      id: 'aif-genai-limits',
      title: 'Strengths, Weaknesses and Value',
      system: 'Reality Check',
      skills: ['genai'],
      brief: `**ARIA:** I'm adaptable, fast and always happy to chat. I also occasionally state complete nonsense with total confidence. Both facts are on the exam.`,
      lesson: `## Advantages of GenAI

- **Adaptability:** one model handles many tasks.
- **Responsiveness:** answers in seconds.
- **Conversational** interfaces anyone can use.
- **Content generation** at scale: drafts, code, images.

## Disadvantages

| Problem | Meaning |
|---|---|
| **Hallucination** | Confident, fluent output that is **false or made up** |
| **Nondeterminism** | The same prompt can give **different answers** each time |
| **Interpretability** | Hard to explain **why** the model produced an output |
| **Inaccuracy** | Out-of-date or wrong knowledge (a model knows nothing after its training cut-off unless you give it context) |
| Bias, toxicity, IP concerns | Covered on the responsible AI floor |

## Choosing a model

Consider: **model type and modality** (text, image, multimodal), **capabilities**, **performance** and **latency**, **cost**, **constraints** (context window, languages), **compliance** (data handling, Region), **customisation** options and **model size/complexity**. Bigger isn't always better: the smallest model that meets quality needs is usually the best value.

## Measuring business value

**ROI**, **efficiency** (time saved), **conversion rate**, **average revenue per user**, **customer lifetime value**, **accuracy** of outputs, **cross-domain performance** (works across tasks), user satisfaction.`,
      questions: [
        q('A chatbot confidently cites a policy that doesn\'t exist. What is this called?', ['Overfitting', 'Hallucination', 'Underfitting', 'Drift'], 1, 'Fabricated but fluent content is a hallucination.'),
        q('The same prompt gives slightly different answers each time. Which characteristic is this?', ['Determinism', 'Nondeterminism', 'Interpretability', 'Latency'], 1, 'GenAI outputs are nondeterministic by default.'),
        q('Which is an advantage of generative AI?', ['Always perfectly accurate', 'Adaptable to many tasks through natural-language instructions', 'Fully explainable decisions', 'Never needs data'], 1, 'One model can do many tasks.'),
        q('A support team wants to show GenAI is worth its cost. Which metric is most relevant?', ['Number of GPUs', 'Reduction in average handling time and cost per ticket', 'Model parameter count', 'Embedding dimensions'], 1, 'Business value metrics: efficiency, cost, satisfaction, ROI.'),
        q('Which factor matters MOST when a company must keep data in the EU?', ['Model colour scheme', 'Compliance: where the model runs and how data is handled', 'Number of output tokens', 'Image resolution'], 1, 'Compliance and data residency drive model and Region choice.'),
        q('A model trained in 2024 doesn\'t know about a product launched yesterday. Why?', ['It is overfitted', 'Its knowledge stops at its training data unless you provide current context', 'Its temperature is too low', 'It uses too few tokens'], 1, 'Models know nothing past their training cut-off without added context.'),
      ],
    }),
    lesson({
      id: 'aif-agents',
      title: 'Agentic AI',
      system: 'Drone Swarm',
      skills: ['genai'],
      brief: `**ARIA:** Answering questions is one thing. Booking the repair crew, ordering the parts and updating the log is another. That's what agents do, and the exam now expects you to know how.`,
      lesson: `## What an agent is

An **AI agent** uses a foundation model to **reason about a goal, plan steps, and take actions** by calling **tools** (APIs, databases, code, other agents), looking at the results and deciding what to do next, until the goal is done.

## Building blocks

| Piece | Role |
|---|---|
| **Tools** | Functions the agent can call: search, a booking API, a calculator, a database query |
| **Memory** | **Short-term** (this conversation) and **long-term** (facts and preferences remembered across sessions) |
| **Orchestration** | The loop and workflow that sequences reasoning, tool calls and results |
| **Guardrails and permissions** | What the agent is allowed to do, and checks on what it says |

## Model Context Protocol (MCP)

An **open standard** for connecting AI agents and applications to **external tools and data sources**. A tool or data source exposed as an **MCP server** can be used by any MCP-capable agent, instead of writing a custom integration for every pair.

## Multi-agent systems

Several specialised agents working together:

- **Supervisor / orchestrator:** one agent plans and delegates to specialist agents, then combines their results.
- **Sequential (pipeline):** each agent passes its output to the next.
- **Parallel:** agents work at the same time on parts of a task.
- **Peer collaboration / swarm:** agents communicate and hand off to each other.

Agents communicate through messages, shared memory or protocols (such as agent-to-agent protocols).

## Business uses

Customer service that can actually resolve issues, IT and operations automation, research assistants, coding agents, back-office workflows (claims, invoices).`,
      questions: [
        q('What distinguishes an AI agent from a simple chatbot?', ['It only answers questions from its training data', 'It plans and takes actions by calling tools to complete a goal', 'It uses no foundation model', 'It can\'t remember anything'], 1, 'Agents reason, plan and act through tools.'),
        q('What is the Model Context Protocol (MCP)?', ['A pricing model for tokens', 'An open standard for connecting AI agents to external tools and data sources', 'A model evaluation metric', 'An AWS Region'], 1, 'MCP standardises tool and data connections for agents.'),
        q('In a multi-agent system, one agent breaks a task into parts, delegates to specialist agents and combines their results. Which pattern is this?', ['Supervisor (orchestrator) pattern', 'Single-shot prompting', 'Batch inference', 'Clustering'], 0, 'A supervisor coordinates specialist agents.'),
        q('An agent should remember a customer\'s preferred language across sessions. Which capability is this?', ['Long-term memory', 'Higher temperature', 'Chunking', 'Prompt caching'], 0, 'Long-term memory persists across sessions.'),
        q('Which is an example of a tool an agent might call?', ['An order-lookup API', 'The model\'s own weights', 'A tokenizer setting', 'The confusion matrix'], 0, 'Tools are functions or APIs the agent invokes.'),
        q('Why is MCP useful?', ['It removes the need for any security', 'A tool exposed once as an MCP server can be used by many different agents', 'It makes models smaller', 'It replaces embeddings'], 1, 'One standard integration works across MCP-capable agents.'),
      ],
    }),
    lesson({
      id: 'aif-aws-genai',
      title: 'Building GenAI on AWS',
      system: 'Fabrication Bay',
      skills: ['genai'],
      brief: `**ARIA:** AWS has a service for every level of GenAI: from "just use it" to "build an agent fleet" to "train your own". Learn which is which.`,
      lesson: `## The AWS GenAI stack

| Service | What it is |
|---|---|
| **Amazon Bedrock** | Fully managed access to **foundation models** from Amazon (**Amazon Nova**, Titan) and other providers (Anthropic, Meta, Mistral, Cohere…) through **one API**, serverless. Plus Knowledge Bases (RAG), Guardrails, Agents, model evaluation, fine-tuning, Prompt Management. |
| **Amazon Bedrock AgentCore** | Services to **run agents in production** securely at scale, with any framework or model: **Runtime**, **Memory**, **Gateway** (turns APIs and Lambda functions into MCP tools), **Identity**, **Policy**, Code Interpreter, Browser, **Observability**. |
| **Strands Agents** | AWS's **open-source SDK** for building agents in a few lines of code: a model, a prompt and tools. |
| **Amazon SageMaker AI** | Build, train, fine-tune and deploy your **own** models with full control. |
| **SageMaker JumpStart** | A hub of **pre-trained and open models** to deploy or fine-tune on SageMaker in a few clicks. |
| **Amazon Q** | Generative AI **assistants**: Amazon Q Developer helps developers write, review and transform code. |
| **Amazon Quick** | An agentic **AI workspace for business users**: chat with company data, research, dashboards (QuickSight is part of it) and automated workflows. |
| **Kiro** | An agentic **IDE** for developers, with **spec-driven development**: turns requirements into specs, designs and tasks, then code. |

## Why build GenAI on AWS

**Accessibility** and a **lower barrier to entry** (no infrastructure, no ML team needed to start), **efficiency** and **cost-effectiveness** (pay per use), **speed to market**, and AWS's **security, compliance, privacy and responsible AI** features: in Bedrock, your prompts and data **aren't used to train the base models** and can stay in your chosen Region.

## Cost trade-offs

- **On-demand** vs **Provisioned Throughput** (steady volume, guaranteed capacity).
- **Model size**: capability vs price and latency.
- **Regional coverage and availability**: not every model is in every Region; cross-Region inference can add capacity.
- **Custom models** cost more to train and host than using a base model with good prompts or RAG.`,
      questions: [
        q('A company wants API access to foundation models from several providers without managing infrastructure. Which service fits?', ['Amazon Bedrock', 'Amazon EC2', 'Amazon SageMaker Ground Truth', 'AWS Glue'], 0, 'Bedrock offers many FMs through one serverless API.'),
        q('A data science team wants full control to fine-tune and host an open-source model on its own endpoints. Which service fits?', ['Amazon SageMaker AI (with JumpStart)', 'Amazon Polly', 'Amazon Quick', 'AWS Artifact'], 0, 'SageMaker AI gives full control over training and hosting.'),
        q('Which service helps run AI agents in production with managed memory, identity and a gateway that exposes APIs as MCP tools?', ['Amazon Bedrock AgentCore', 'Amazon Translate', 'Amazon S3 Glacier', 'Amazon Inspector'], 0, 'AgentCore provides Runtime, Memory, Gateway, Identity, Policy and Observability for agents.'),
        q('A developer wants an open-source SDK to build an agent from a model, a prompt and a few tools. Which fits?', ['Strands Agents', 'Amazon Lex V1', 'AWS CloudFormation', 'Amazon Comprehend'], 0, 'Strands Agents is AWS\'s open-source agent SDK.'),
        q('Which statement about Amazon Bedrock and customer data is correct?', ['Prompts are used to train the base models for everyone', 'Customer prompts and data aren\'t used to train the base models', 'Data must leave the chosen Region', 'Bedrock requires managing GPUs'], 1, 'Bedrock doesn\'t use your data to improve base models.'),
        q('Which is Amazon\'s own family of foundation models available in Bedrock?', ['Amazon Nova', 'Amazon Polly', 'Amazon Kendra', 'Amazon Macie'], 0, 'Amazon Nova (and Titan) are Amazon\'s FMs.'),
      ],
    }),
    checkpoint({
      id: 'aif-genai-checkpoint',
      title: 'Checkpoint: Generative AI Fundamentals',
      system: 'GenAI Certification Gate',
      skills: ['genai'],
      brief: `**ARIA:** Exam-style scenarios on GenAI concepts, costs, limits, agents and the AWS services to build with.`,
      lesson: `## Before you start

- Tokens, chunking, embeddings/vectors, transformers, FMs, multimodal, diffusion.
- Pay per token; prompt caching, batch inference, smaller models cut cost; Provisioned Throughput for steady volume.
- Hallucination, nondeterminism, interpretability.
- Agents: tools, memory, orchestration; MCP connects them to tools and data.
- Bedrock (FMs via API), AgentCore (agents in production), Strands (agent SDK), SageMaker AI (your own models), Quick, Kiro.`,
      questions: [
        q('A company wants semantic search that finds documents with similar meaning even when words differ. Which concept makes this possible?', ['Embeddings stored in a vector database', 'Higher temperature', 'Diffusion', 'Batch transform'], 0, 'Embeddings capture meaning, enabling similarity search.'),
        q('Which pair of factors directly increases the cost of a single on-demand LLM request?', ['A longer prompt and a longer response', 'A lower temperature', 'Using an IAM role', 'Enabling CloudTrail'], 0, 'Cost scales with input and output tokens.'),
        q('A customer service agent must look up orders, issue refunds and email customers. What does it need besides the model?', ['Tools for each action, with permissions', 'A diffusion model', 'A bigger context window only', 'A clustering algorithm'], 0, 'Agents act through tools, which need appropriate permissions.'),
        q('Developers want to turn an existing internal REST API into a tool that any MCP-capable agent can use. Which service fits?', ['Amazon Bedrock AgentCore Gateway', 'Amazon Polly', 'AWS Budgets', 'Amazon Rekognition'], 0, 'AgentCore Gateway exposes APIs and Lambda functions as MCP tools.'),
        q('A business user wants to ask questions about company data, build dashboards and automate tasks with AI, without coding. Which service fits?', ['Amazon Quick', 'Amazon SageMaker Pipelines', 'Amazon EC2', 'AWS CodeBuild'], 0, 'Amazon Quick is the agentic workspace for business users.'),
        q('A high-volume app needs guaranteed, steady capacity for a customised model on Bedrock. Which option fits?', ['Provisioned Throughput', 'On-demand only', 'Batch inference', 'A free tier'], 0, 'Provisioned Throughput reserves dedicated capacity.'),
        q('Which is a known limitation of generative AI?', ['It can\'t process language', 'It can hallucinate plausible but false information', 'It never varies its answers', 'It is always explainable'], 1, 'Hallucination is a core limitation.'),
        q('Which AWS tool helps developers go from requirements to specs, designs, tasks and code with agents?', ['Kiro', 'Amazon Translate', 'AWS Artifact', 'Amazon Macie'], 0, 'Kiro is the agentic IDE with spec-driven development.'),
      ],
    }),
  ],
};
