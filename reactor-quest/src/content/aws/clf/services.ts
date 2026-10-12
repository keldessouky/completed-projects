// CLF-C02 Domain 3, part 3: management, integration, analytics, AI/ML and developer tools.
import type { Deck } from '../../../game/types';
import { checkpoint, lesson, q } from '../kit';

export const clfServices: Deck = {
  id: 'clf-services',
  name: 'Operations, Data and AI',
  subtitle: 'Domain 3 · 34% of the exam (part 3 of 3)',
  outcome: 'Monitor and audit an account, connect services together, and pick the right analytics and AI tools.',
  hue: 275,
  domain: 'clf-d3',
  levels: [
    lesson({
      id: 'clf-monitoring',
      title: 'Watching and Auditing',
      system: 'Telemetry Deck',
      skills: ['aws-operations'],
      brief: `**ARIA:** Something changed in ground control's account last night and nobody knows who did it. Learn which service answers which question: "how is it running?", "who did that?", "what did it look like before?"`,
      lesson: `## The big three (don't mix them up)

| Service | Answers | Examples |
|---|---|---|
| **Amazon CloudWatch** | **How are my resources performing?** | Metrics (CPU, latency), **alarms**, logs, dashboards |
| **AWS CloudTrail** | **Who did what, and when?** | A log of **API calls** in your account: who deleted that bucket, from which IP |
| **AWS Config** | **What does my resource configuration look like, and is it compliant?** | Configuration history, rules like "every EBS volume must be encrypted" |

## More operational tools

- **AWS Trusted Advisor:** automated **best-practice checks** on your account in five categories: **cost optimization, performance, security, fault tolerance and service limits (quotas)**, plus operational excellence. Basic and Developer support get a core set of checks; Business support and above get them all.
- **AWS Health Dashboard:** AWS service health, and **events that affect your own resources** (like scheduled maintenance).
- **AWS Systems Manager:** operations hub for fleets of instances: patching (**Patch Manager**), running commands, secure shell access without SSH keys (**Session Manager**), and configuration values (**Parameter Store**).
- **AWS Compute Optimizer:** recommends better-sized EC2 instances, EBS volumes and Lambda functions from usage data.
- **Service Quotas:** view and request increases to your account's limits.
- **AWS X-Ray:** traces requests through distributed applications to find slow parts.`,
      questions: [
        q('Which service records API calls made in an AWS account, including who made them?', ['Amazon CloudWatch', 'AWS CloudTrail', 'AWS Config', 'AWS X-Ray'], 1, '**CloudTrail** logs API activity: who, what, when, from where.'),
        q('A team wants to be alerted when an EC2 instance\'s CPU stays above 80%. Which service should it use?', ['AWS CloudTrail', 'Amazon CloudWatch', 'AWS Artifact', 'AWS Trusted Advisor'], 1, 'A **CloudWatch alarm** on the CPU metric does exactly this.'),
        q('Which service tracks how resource configurations change over time and evaluates them against rules?', ['AWS Config', 'Amazon CloudWatch', 'AWS CloudTrail', 'Amazon Inspector'], 0, '**AWS Config** records configuration history and checks compliance rules.'),
        q('Which service checks an account against best practices for cost, performance, security, fault tolerance and service limits?', ['AWS Trusted Advisor', 'AWS Well-Architected Tool', 'AWS Config', 'Amazon GuardDuty'], 0, '**Trusted Advisor** runs automated checks in those categories.'),
        q('An administrator needs to patch hundreds of EC2 instances on a schedule. Which service helps?', ['AWS Systems Manager', 'AWS CloudFormation', 'Amazon CloudFront', 'AWS Health Dashboard'], 0, 'Systems Manager **Patch Manager** automates patching.'),
        q('Where can a customer see scheduled AWS maintenance that will affect their own EC2 instances?', ['AWS Health Dashboard', 'AWS Artifact', 'AWS Pricing Calculator', 'Amazon Inspector'], 0, 'The **AWS Health Dashboard** shows events affecting your resources.'),
      ],
    }),
    lesson({
      id: 'clf-integration',
      title: 'Connecting Services',
      system: 'Message Tubes',
      skills: ['aws-operations', 'aws-architecture'],
      brief: `**ARIA:** When one part of ground control calls another directly, a slowdown in one breaks both. The cure is "decoupling": let them talk through queues, topics and events.`,
      lesson: `## Why decouple

In a **tightly coupled** system, components call each other directly: if one fails or slows down, the failure spreads. In a **loosely coupled** system, they communicate through a buffer, so each can fail, scale and change independently.

## Messaging and events

| Service | Model | Think of it as |
|---|---|---|
| **Amazon SQS** (Simple Queue Service) | **Queue**: producers send messages, consumers pull and process them | A to-do list that holds work until someone takes it |
| **Amazon SNS** (Simple Notification Service) | **Publish/subscribe**: one message pushed to many subscribers (email, SMS, Lambda, SQS) | A loudspeaker announcement |
| **Amazon EventBridge** | **Event bus**: routes events from AWS services, SaaS apps and your code to targets by rules; also runs schedules | A smart switchboard |
| **AWS Step Functions** | **Workflow**: coordinates steps (Lambda functions, services) with retries and branching | A flowchart that runs |
| **Amazon MQ** | Managed message brokers (ActiveMQ, RabbitMQ) for existing apps using those protocols | Lift-and-shift messaging |

## APIs and more

- **Amazon API Gateway:** create, publish and secure **APIs** at any scale; often in front of Lambda.
- **Amazon SES** (Simple Email Service): send email at scale (marketing, notifications).
- **AWS AppSync:** managed GraphQL APIs.`,
      questions: [
        q('Which service lets one component send messages to a queue that another component processes later, decoupling them?', ['Amazon SNS', 'Amazon SQS', 'Amazon SES', 'AWS Step Functions'], 1, '**SQS** is the queue that buffers work between components.'),
        q('A company wants one message to be delivered to many subscribers at once: email, SMS and a Lambda function. Which service fits?', ['Amazon SQS', 'Amazon SNS', 'Amazon MQ', 'Amazon API Gateway'], 1, '**SNS** is publish/subscribe: one message, many subscribers.'),
        q('Which service coordinates multiple Lambda functions into a workflow with retries and branching?', ['AWS Step Functions', 'Amazon EventBridge', 'Amazon SQS', 'AWS Batch'], 0, '**Step Functions** runs visual workflows.'),
        q('Which service creates and manages APIs that front Lambda functions and other backends?', ['Amazon API Gateway', 'Amazon Route 53', 'Elastic Load Balancing', 'AWS AppConfig'], 0, '**API Gateway** creates, publishes and secures APIs.'),
        q('What is a benefit of a loosely coupled architecture?', ['Components fail together, which is easier to debug', 'A failure in one component is less likely to cascade to others', 'It requires fewer AWS accounts', 'It removes the need for monitoring'], 1, 'Loose coupling contains failures and lets parts scale independently.'),
        q('Which service routes events from AWS services and SaaS applications to targets based on rules, and can run tasks on a schedule?', ['Amazon EventBridge', 'Amazon SNS', 'AWS CloudTrail', 'Amazon Kinesis'], 0, '**EventBridge** is the event bus with rules and schedules.'),
      ],
    }),
    lesson({
      id: 'clf-analytics',
      title: 'Analytics',
      system: 'Sensor Analysis Lab',
      skills: ['aws-databases', 'aws-storage'],
      brief: `**ARIA:** Ground control collects terabytes of sensor data and understands none of it. AWS has a service for every step: collect, transform, query, visualise.`,
      lesson: `## The analytics services

| Step | Service | What it does |
|---|---|---|
| **Collect streams** | **Amazon Kinesis** | **Real-time** streaming data: clickstreams, IoT telemetry, logs. (Kinesis Data Streams; **Amazon Data Firehose** loads streams into S3, Redshift and more) |
| | **Amazon MSK** | Managed Apache Kafka |
| **Prepare** | **AWS Glue** | **Serverless ETL** (extract, transform, load) and the **Glue Data Catalog** of your data's structure |
| **Query** | **Amazon Athena** | **Run SQL directly on data in S3**, serverless, pay per query |
| | **Amazon Redshift** | Data warehouse for complex analytics on large structured data |
| | **Amazon EMR** | Big data frameworks: **Apache Spark, Hadoop**, Hive |
| | **Amazon OpenSearch Service** | Search and log analytics |
| **Visualise** | **Amazon QuickSight** | **Business intelligence dashboards** and reports |
| **Govern** | **AWS Lake Formation** | Build and secure a **data lake** on S3 |

## Patterns to recognise

- "Query data in S3 with SQL, no servers" → **Athena**
- "Real-time streaming" → **Kinesis**
- "ETL" / "data catalog" → **Glue**
- "Dashboards" / "BI" → **QuickSight**
- "Hadoop" / "Spark" → **EMR**`,
      questions: [
        q('Which service runs SQL queries directly against data in Amazon S3 without servers?', ['Amazon Athena', 'Amazon RDS', 'Amazon EMR', 'Amazon QuickSight'], 0, '**Athena** is serverless SQL on S3.'),
        q('Which service collects and processes streaming data, such as website clickstreams, in real time?', ['AWS Glue', 'Amazon Kinesis', 'Amazon Redshift', 'AWS Batch'], 1, '**Kinesis** is for real-time streaming data.'),
        q('A business analyst wants interactive dashboards built from company data. Which service fits?', ['Amazon QuickSight', 'Amazon Athena', 'AWS Glue', 'Amazon CloudWatch'], 0, '**QuickSight** is the BI and dashboard service.'),
        q('Which serverless service performs extract, transform and load (ETL) jobs and maintains a data catalog?', ['AWS Glue', 'Amazon EMR', 'Amazon Kinesis', 'AWS DataSync'], 0, '**Glue** is serverless ETL plus the Data Catalog.'),
        q('A data team runs Apache Spark and Hadoop jobs. Which managed service is designed for these frameworks?', ['Amazon EMR', 'Amazon Redshift', 'Amazon Athena', 'Amazon QuickSight'], 0, '**EMR** runs big data frameworks like Spark and Hadoop.'),
        q('Which service helps build, manage and secure a data lake on Amazon S3?', ['AWS Lake Formation', 'AWS Storage Gateway', 'Amazon Neptune', 'AWS Backup'], 0, '**Lake Formation** builds and governs data lakes.'),
      ],
    }),
    lesson({
      id: 'clf-ai-ml',
      title: 'AI and Machine Learning',
      system: 'ARIA\'s Cousins',
      skills: ['aws-operations'],
      brief: `**ARIA:** Meet my relatives. AWS has ready-made AI services you call with one API request, and platforms for building your own. The exam asks you to match each one to a task.`,
      lesson: `## Build your own models

- **Amazon SageMaker AI:** build, train and deploy **machine learning models** at scale, with managed notebooks and infrastructure.
- **Amazon Bedrock:** use **foundation models** (generative AI: text, images, chat) from Amazon and other providers through one API, without managing infrastructure.
- **Amazon Q:** a **generative AI assistant** for work: Q Business answers questions from company data, Q Developer helps write and understand code.

## Ready-made AI services (no ML expertise needed)

| Task | Service |
|---|---|
| Analyse **images and video**: faces, objects, text, unsafe content | **Amazon Rekognition** |
| Understand **text**: sentiment, entities, key phrases, language | **Amazon Comprehend** |
| **Extract text and data from documents**: forms, tables, scans | **Amazon Textract** |
| **Translate** between languages | **Amazon Translate** |
| **Speech to text** | **Amazon Transcribe** |
| **Text to speech** (lifelike voices) | **Amazon Polly** |
| Build **chatbots** with voice and text | **Amazon Lex** |
| **Intelligent search** across company documents | **Amazon Kendra** |
| **Personalised recommendations** | **Amazon Personalize** |
| Detect **online fraud** | **Amazon Fraud Detector** |

Memory hooks: Polly *talks* (like a parrot); Transcribe *writes down* what it hears; Lex *chats*; Rekognition *sees*; Comprehend *understands* text; Textract *extracts* from documents.`,
      questions: [
        q('Which service converts text into lifelike speech?', ['Amazon Transcribe', 'Amazon Polly', 'Amazon Lex', 'Amazon Comprehend'], 1, '**Polly** turns text into speech.'),
        q('A company wants to identify objects and faces in images uploaded by users. Which service fits?', ['Amazon Rekognition', 'Amazon Textract', 'Amazon Comprehend', 'Amazon Kendra'], 0, '**Rekognition** analyses images and video.'),
        q('Which service determines whether customer reviews are positive or negative?', ['Amazon Comprehend', 'Amazon Polly', 'Amazon Translate', 'Amazon Rekognition'], 0, 'Sentiment analysis of text is **Comprehend**.'),
        q('Which service lets developers build generative AI applications using foundation models through an API?', ['Amazon Bedrock', 'Amazon Lex', 'AWS Glue', 'Amazon Personalize'], 0, '**Bedrock** provides foundation models through one API.'),
        q('A data science team wants to build, train and deploy its own machine learning models. Which service fits?', ['Amazon SageMaker AI', 'Amazon Comprehend', 'Amazon Polly', 'AWS Lambda'], 0, '**SageMaker AI** is the platform for building your own models.'),
        q('Which service extracts text, tables and form data from scanned documents?', ['Amazon Textract', 'Amazon Transcribe', 'Amazon Kendra', 'Amazon Translate'], 0, '**Textract** pulls text and structured data from documents. (Transcribe is for audio.)'),
      ],
    }),
    lesson({
      id: 'clf-devtools',
      title: 'Building and Shipping',
      system: 'Fabrication Shop',
      skills: ['aws-operations', 'aws-compute'],
      brief: `**ARIA:** Ground control's developers deploy by copying files by hand. AWS has a whole toolbox for building, deploying and running applications, plus a few services that don't fit anywhere else.`,
      lesson: `## Deploy without managing infrastructure

- **AWS Elastic Beanstalk:** upload your web application's code; Beanstalk **provisions and manages** the EC2 instances, load balancing, scaling and monitoring for you (you can still see and control them). The classic PaaS answer.
- **AWS Amplify:** build and host **web and mobile front ends**, with backends like authentication and APIs.

## Infrastructure as code

- **AWS CloudFormation:** templates → stacks (from the "Talking to AWS" lesson).
- **AWS CDK:** CloudFormation in a programming language.

## CI/CD: continuous integration and delivery

| Service | Job |
|---|---|
| **AWS CodePipeline** | Orchestrates the release pipeline: source → build → test → deploy |
| **AWS CodeBuild** | Compiles code and runs tests |
| **AWS CodeDeploy** | Deploys to EC2, on-premises servers, Lambda or ECS |
| **AWS CodeArtifact** | Stores software packages (npm, Maven, pip) |

## A few more you should recognise

- **Amazon WorkSpaces:** virtual **desktops** in the cloud. **Amazon AppStream 2.0** streams single applications to a browser.
- **Amazon Connect:** a cloud **contact centre** (customer service phone and chat).
- **AWS IoT Core:** connects **Internet of Things** devices to the cloud.
- **AWS Device Farm:** tests mobile and web apps on real devices.`,
      questions: [
        q('A developer wants to deploy a web application by uploading code, and have AWS handle capacity, load balancing and scaling. Which service fits?', ['AWS Elastic Beanstalk', 'Amazon EC2', 'AWS CloudTrail', 'Amazon WorkSpaces'], 0, '**Elastic Beanstalk** provisions and manages the infrastructure for your code.'),
        q('Which service orchestrates a release pipeline from source code to deployment?', ['AWS CodePipeline', 'AWS CodeArtifact', 'Amazon Connect', 'AWS Config'], 0, '**CodePipeline** automates the stages of a release.'),
        q('Which service compiles source code and runs tests?', ['AWS CodeBuild', 'AWS CodeDeploy', 'AWS CloudFormation', 'Amazon Inspector'], 0, '**CodeBuild** is the managed build service.'),
        q('A company wants employees to use virtual Windows desktops from any device. Which service fits?', ['Amazon WorkSpaces', 'Amazon Lightsail', 'Amazon AppStream 2.0', 'AWS Outposts'], 0, '**WorkSpaces** provides full virtual desktops. (AppStream 2.0 streams individual applications.)'),
        q('Which service provides a cloud-based contact centre for customer service?', ['Amazon Connect', 'Amazon SNS', 'Amazon Lex', 'Amazon SES'], 0, '**Amazon Connect** is the cloud contact centre.'),
        q('Which service securely connects billions of IoT devices to the AWS Cloud?', ['AWS IoT Core', 'Amazon Kinesis', 'AWS Direct Connect', 'AWS Device Farm'], 0, '**IoT Core** connects and manages IoT devices.'),
      ],
    }),
    checkpoint({
      id: 'clf-services-checkpoint',
      title: 'Checkpoint: Operations, Data and AI',
      system: 'Telemetry Certification Gate',
      skills: ['aws-operations', 'aws-databases'],
      brief: `**ARIA:** Exam-style scenarios. The trick on this floor is matching a task to exactly one service.`,
      lesson: `## Before you start

- CloudWatch = performance and alarms. CloudTrail = who called which API. Config = configuration history and compliance.
- SQS = queue. SNS = pub/sub. EventBridge = event bus. Step Functions = workflows.
- Athena = SQL on S3. Kinesis = streaming. Glue = ETL. QuickSight = dashboards. EMR = Spark/Hadoop.
- Polly talks, Transcribe writes, Lex chats, Rekognition sees, Comprehend understands, Textract extracts.`,
      questions: [
        q('A security team needs to find out which IAM user terminated an EC2 instance yesterday. Which service has the answer?', ['Amazon CloudWatch', 'AWS CloudTrail', 'AWS Trusted Advisor', 'AWS Config'], 1, 'Terminating an instance is an API call, recorded with the caller by **CloudTrail**.'),
        q('A call centre wants to convert recorded customer calls to text, then analyse the sentiment of the text. Which two services, in order?', ['Amazon Polly, then Amazon Comprehend', 'Amazon Transcribe, then Amazon Comprehend', 'Amazon Lex, then Amazon Translate', 'Amazon Textract, then Amazon Rekognition'], 1, '**Transcribe** turns speech into text; **Comprehend** analyses its sentiment.'),
        q('An order service sends orders to a processing service that sometimes can\'t keep up. Which service lets orders wait safely until they can be processed?', ['Amazon SNS', 'Amazon SQS', 'Amazon CloudFront', 'AWS Step Functions'], 1, 'An **SQS** queue buffers messages until consumers are ready.'),
        q('A company wants to be sure all its S3 buckets stay encrypted, and to be notified when one isn\'t. Which service evaluates this?', ['AWS Config', 'AWS CloudTrail', 'Amazon Athena', 'Amazon QuickSight'], 0, 'An **AWS Config** rule continuously checks resource configurations for compliance.'),
        q('Which service would a company use to see which EC2 instances are over-provisioned, based on their usage?', ['AWS Compute Optimizer', 'AWS CodeDeploy', 'Amazon Rekognition', 'AWS Artifact'], 0, '**Compute Optimizer** recommends right-sized resources from utilisation data.'),
        q('A website needs a chatbot that understands natural language in voice and text. Which service fits?', ['Amazon Lex', 'Amazon Polly', 'Amazon Kendra', 'Amazon Personalize'], 0, '**Lex** builds conversational interfaces.'),
        q('Analysts want to run ad-hoc SQL queries on log files stored in S3 and pay only for the queries they run. Which service fits?', ['Amazon Athena', 'Amazon Redshift', 'Amazon RDS', 'Amazon DynamoDB'], 0, 'Serverless, pay-per-query SQL on S3 is **Athena**.'),
        q('Which service would deploy new application versions to a fleet of EC2 instances automatically?', ['AWS CodeDeploy', 'AWS CodeArtifact', 'Amazon Inspector', 'AWS Glue'], 0, '**CodeDeploy** automates deployments to EC2, on-premises, Lambda and ECS.'),
      ],
    }),
  ],
};
