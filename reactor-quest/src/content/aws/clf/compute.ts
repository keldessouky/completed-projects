// CLF-C02 Domain 3, part 1: global infrastructure and compute.
import type { Deck } from '../../../game/types';
import { checkpoint, lesson, q } from '../kit';

export const clfCompute: Deck = {
  id: 'clf-compute',
  name: 'Infrastructure and Compute',
  subtitle: 'Domain 3 · 34% of the exam (part 1 of 3)',
  outcome: 'Place workloads around the world and pick the right way to run code: servers, containers or serverless.',
  hue: 30,
  domain: 'clf-d3',
  levels: [
    lesson({
      id: 'clf-global-infra',
      title: 'Regions and Zones',
      system: 'Orbital Relay Map',
      skills: ['aws-networking', 'cloud-concepts'],
      brief: `**ARIA:** AWS isn't one big computer. It's dozens of locations around the planet, nested inside each other. Learn the map.`,
      lesson: `## The AWS Global Infrastructure

| Piece | What it is |
|---|---|
| **Region** | A physical location in the world with **multiple Availability Zones**, isolated from other Regions. Example: \`eu-west-1\` (Ireland). |
| **Availability Zone (AZ)** | **One or more discrete data centres** with redundant power, networking and connectivity, in a Region. AZs are far enough apart to survive local disasters, and close enough for low-latency links. |
| **Edge location** | A site in a major city that caches content close to users, for **Amazon CloudFront** and **Route 53**. There are many more edge locations than Regions. |
| **Local Zone** | An extension of a Region placed near a large city, for single-digit millisecond latency to users there. |
| **Wavelength Zone** | AWS compute inside **5G telecom networks**, for ultra-low latency to mobile devices. |
| **AWS Outposts** | AWS hardware in **your own** data centre. |

## High availability

Run your application in **at least two Availability Zones**. If one AZ fails, the other keeps serving. For disaster recovery across a wider area, you can use more than one Region.

## How to choose a Region

1. **Compliance and data residency:** some laws require data to stay in a country. This comes first.
2. **Proximity / latency:** close to your users is faster.
3. **Service availability:** not every service or feature is in every Region.
4. **Pricing:** prices differ between Regions.

Data **doesn't leave a Region** unless you move it there yourself.`,
      questions: [
        q('What is an AWS Availability Zone?', ['A single server rack', 'One or more discrete data centres with redundant power and networking within a Region', 'A city where AWS caches content', 'A geographic area containing several Regions'], 1, 'An AZ is one or more data centres, isolated from failures in other AZs of the same Region.'),
        q('What do edge locations primarily do?', ['Run Amazon RDS databases', 'Cache content close to users for Amazon CloudFront', 'Store EBS snapshots', 'Host AWS Outposts racks'], 1, 'Edge locations serve CloudFront (and Route 53) from close to your users.'),
        q('A company must keep its customers\' data inside Germany by law. What should drive its choice of Region first?', ['The lowest price', 'Compliance and data residency requirements', 'The number of Availability Zones', 'Which Region has the newest services'], 1, 'Legal requirements come first: pick a Region in the country the law requires.'),
        q('How should an application be deployed for high availability within one Region?', ['On a single, larger instance', 'Across multiple Availability Zones', 'In one Availability Zone with backups', 'On an edge location'], 1, 'Spreading across at least two AZs means one AZ failing doesn\'t take the app down.'),
        q('Which AWS infrastructure brings compute inside 5G networks for ultra-low latency to mobile devices?', ['Local Zones', 'Wavelength Zones', 'Outposts', 'Edge locations'], 1, '**Wavelength Zones** embed AWS compute in telecom providers\' 5G networks.'),
        q('Which statement about AWS Regions is true?', ['Data is automatically copied to every Region', 'Every service is available in every Region', 'Each Region is isolated, and data stays in it unless you move it', 'A Region contains a single data centre'], 2, 'Regions are isolated from each other, and AWS doesn\'t move your data between them.'),
      ],
    }),
    lesson({
      id: 'clf-ec2',
      title: 'Amazon EC2',
      system: 'Engine Room',
      skills: ['aws-compute'],
      brief: `**ARIA:** The workhorse of AWS: virtual servers you rent by the second. If an exam question says "server", start here.`,
      lesson: `## Amazon EC2 (Elastic Compute Cloud)

**EC2** gives you resizable **virtual servers**, called **instances**. You choose the CPU, memory, storage and networking, and you have full control of the operating system: you install, patch and manage it.

- **AMI (Amazon Machine Image):** the template an instance starts from: the OS and pre-installed software.
- **Instance type:** the hardware size, like \`t3.micro\` or \`m7g.large\`.
- **Key pair:** how you log in securely to Linux instances over SSH.
- **User data:** a script that runs when the instance first starts.
- **Security group:** the instance's virtual firewall (more on the security floor).

## Instance families

| Family | Good for | Examples |
|---|---|---|
| **General purpose** | A balance of CPU, memory and network: web servers, code repositories | T, M |
| **Compute optimized** | CPU-heavy work: batch processing, gaming servers, scientific modelling | C |
| **Memory optimized** | Big data sets in memory: in-memory databases, real-time analytics | R, X |
| **Storage optimized** | High, sequential read/write to local storage: data warehousing | I, D |
| **Accelerated computing** | GPUs and other accelerators: machine learning, graphics | P, G, Inf, Trn |

## Storage for instances

- **Amazon EBS** volumes are network drives that **persist** when the instance stops.
- **Instance store** is disk physically attached to the host: very fast, but data is **lost when the instance stops** or fails.

## Other ways to run servers

- **Amazon Lightsail:** simple virtual private servers with a fixed monthly price. Great for simple websites and beginners.
- **AWS Batch:** runs batch computing jobs at any scale, managing the instances for you.`,
      questions: [
        q('Which instance family suits an in-memory database that processes large data sets?', ['Compute optimized', 'Memory optimized', 'Storage optimized', 'General purpose'], 1, 'Memory optimized instances (R, X) are built for large in-memory data sets.'),
        q('What is an AMI?', ['A firewall for an instance', 'A template containing the operating system and software an instance starts from', 'A type of EBS volume', 'A billing plan for EC2'], 1, 'An Amazon Machine Image is the template an EC2 instance launches from.'),
        q('Who is responsible for patching the operating system on an EC2 instance?', ['AWS', 'The customer', 'The AMI publisher', 'Nobody: EC2 patches itself'], 1, 'EC2 is IaaS: the guest operating system is yours to patch.'),
        q('A user stops an EC2 instance and starts it again. Which storage has lost its data?', ['The EBS root volume', 'An Amazon S3 bucket', 'The instance store volume', 'An EBS snapshot'], 2, 'Instance store is temporary: its data doesn\'t survive a stop. EBS volumes persist.'),
        q('Which service gives a beginner a simple virtual server with a predictable monthly price?', ['Amazon EC2 Dedicated Hosts', 'Amazon Lightsail', 'AWS Batch', 'AWS Outposts'], 1, '**Lightsail** bundles a server, storage and data transfer at a fixed monthly price.'),
        q('A company needs GPUs to train machine learning models. Which instance family should it use?', ['Storage optimized', 'General purpose', 'Accelerated computing', 'Memory optimized'], 2, 'Accelerated computing instances (P, G, Trn, Inf) provide GPUs and ML chips.'),
      ],
    }),
    lesson({
      id: 'clf-scaling',
      title: 'Scaling and Load Balancing',
      system: 'Thruster Array',
      skills: ['aws-compute', 'aws-architecture'],
      brief: `**ARIA:** One server can't take a rush of users, and when it fails, everything fails. The fix: many servers, a traffic director in front, and automatic scaling.`,
      lesson: `## Two ways to scale

- **Vertical scaling (scale up):** a bigger instance. Simple, but there's a ceiling, and it's still one point of failure.
- **Horizontal scaling (scale out):** more instances. No ceiling, and one failing doesn't take you down. The cloud way.

## Amazon EC2 Auto Scaling

An **Auto Scaling group** keeps the right number of instances running:

- You set a **minimum**, a **desired** and a **maximum** capacity.
- It **replaces unhealthy instances** automatically.
- It **scales out** when demand rises (for example, average CPU above 60%) and **scales in** when demand falls.
- It can spread instances across **multiple Availability Zones**.

This is elasticity in practice: capacity follows demand, and you pay only for what runs.

## Elastic Load Balancing (ELB)

A **load balancer** spreads incoming traffic across healthy instances, in one or many AZs, and stops sending traffic to instances that fail health checks.

| Type | Works at | Best for |
|---|---|---|
| **Application Load Balancer** | Layer 7 (HTTP/HTTPS) | Web apps; routing by URL path or hostname |
| **Network Load Balancer** | Layer 4 (TCP/UDP) | Extreme performance, millions of requests per second, static IPs |
| **Gateway Load Balancer** | Layer 3 | Third-party virtual appliances like firewalls |

Load balancing plus Auto Scaling across AZs is the classic **highly available, elastic** architecture.`,
      questions: [
        q('Which service automatically adds EC2 instances when demand increases and removes them when it falls?', ['Elastic Load Balancing', 'Amazon EC2 Auto Scaling', 'AWS Lambda', 'Amazon CloudFront'], 1, '**EC2 Auto Scaling** adjusts the number of instances to match demand.'),
        q('What does Elastic Load Balancing do?', ['Stores data across Availability Zones', 'Distributes incoming traffic across multiple targets, such as EC2 instances', 'Encrypts data in transit', 'Backs up EC2 instances'], 1, 'A load balancer spreads requests across healthy targets.'),
        q('Which load balancer routes HTTP requests based on the URL path, like `/api` vs `/images`?', ['Network Load Balancer', 'Gateway Load Balancer', 'Application Load Balancer', 'Classic DNS round robin'], 2, 'The **Application Load Balancer** works at layer 7 and can route by path or host.'),
        q('Replacing an instance with a larger instance type is called what?', ['Horizontal scaling', 'Vertical scaling', 'Elastic scaling', 'Load balancing'], 1, 'Making one instance bigger is **vertical scaling** (scaling up).'),
        q('An Auto Scaling group notices an instance failing its health checks. What happens?', ['Nothing until an administrator acts', 'It terminates the instance and launches a replacement', 'It moves the instance to another Region', 'It makes the instance larger'], 1, 'Auto Scaling replaces unhealthy instances to keep the desired capacity.'),
        q('Which design is both highly available and elastic?', ['One large EC2 instance in one AZ', 'An Auto Scaling group across multiple AZs behind a load balancer', 'Two instances in the same AZ with no load balancer', 'An instance with an instance store volume'], 1, 'Multiple AZs give availability; Auto Scaling gives elasticity; the load balancer spreads traffic.'),
      ],
    }),
    lesson({
      id: 'clf-serverless',
      title: 'Containers and Serverless',
      system: 'Drone Bay',
      skills: ['aws-compute'],
      brief: `**ARIA:** Not everything needs a whole server. Some code runs for a few hundred milliseconds when something happens, and then disappears. Meet containers and serverless.`,
      lesson: `## Serverless

**Serverless** means you don't provision or manage servers. AWS runs, scales and patches the infrastructure, and you pay only while your code runs.

### AWS Lambda

- Runs your code **in response to events**: an HTTP request, a file landing in S3, a message in a queue, a schedule.
- Scales automatically, from zero to thousands of simultaneous runs.
- You pay per request and for the **compute time** used, in milliseconds. Nothing when idle.
- A single run can last up to **15 minutes**: Lambda is for short tasks, not long-running servers.

## Containers

A **container** packages an application with everything it needs, so it runs the same everywhere.

| Service | What it does |
|---|---|
| **Amazon ECS** (Elastic Container Service) | AWS's own container orchestrator: runs and scales containers |
| **Amazon EKS** (Elastic Kubernetes Service) | Managed **Kubernetes**, the open-source orchestrator |
| **AWS Fargate** | A **serverless compute engine for containers**: works with ECS and EKS, so you run containers without managing servers |
| **Amazon ECR** (Elastic Container Registry) | Stores your container images |
| **AWS App Runner** | Runs a containerised web app or API from code or an image, with no infrastructure to configure |

## Choosing

- Full OS control, long-running? **EC2.**
- Containers, using Kubernetes? **EKS.** Containers, AWS-native? **ECS.** Either, without servers? **add Fargate.**
- Short, event-driven code? **Lambda.**`,
      questions: [
        q('Which service runs code in response to events without provisioning servers, charging only for the compute time used?', ['Amazon EC2', 'AWS Lambda', 'Amazon ECS on EC2', 'Amazon Lightsail'], 1, '**Lambda** is event-driven, serverless and billed per request and duration.'),
        q('A company already uses Kubernetes on-premises and wants a managed Kubernetes service on AWS. Which should it use?', ['Amazon ECS', 'Amazon EKS', 'AWS Lambda', 'AWS Batch'], 1, '**EKS** is managed Kubernetes.'),
        q('Which service lets you run containers on ECS or EKS without managing the underlying servers?', ['Amazon EC2', 'AWS Fargate', 'Amazon ECR', 'AWS Outposts'], 1, '**Fargate** is the serverless compute engine for containers.'),
        q('What is the maximum time a single AWS Lambda invocation can run?', ['1 minute', '15 minutes', '1 hour', 'Unlimited'], 1, 'Lambda functions can run for up to 15 minutes per invocation.'),
        q('Where should a team store its Docker container images on AWS?', ['Amazon ECR', 'Amazon EBS', 'AWS Fargate', 'Amazon ECS'], 0, '**Elastic Container Registry** stores and manages container images.'),
        q('Which is a benefit of serverless computing?', ['Full control of the operating system', 'No servers to provision or manage, and no charge when idle', 'Guaranteed dedicated hardware', 'Unlimited run time per request'], 1, 'With serverless, AWS manages the infrastructure, and you don\'t pay for idle time.'),
      ],
    }),
    lesson({
      id: 'clf-access',
      title: 'Talking to AWS',
      system: 'Comms Console',
      skills: ['aws-operations'],
      brief: `**ARIA:** Every AWS action, from a click in the console to a line of code, is an API call underneath. There are several doors in.`,
      lesson: `## Ways to access AWS

| Tool | What it is |
|---|---|
| **AWS Management Console** | The web interface: point and click |
| **AWS CLI** (Command Line Interface) | Commands in a terminal, great for scripts: \`aws s3 ls\` |
| **AWS SDKs** | Libraries for programming languages (Python, JavaScript, Java…) to call AWS from your code |
| **AWS CloudShell** | A browser-based terminal in the console, already signed in, with the CLI installed |
| **Infrastructure as code** | Templates that describe resources: **AWS CloudFormation**, **AWS CDK** |

All of them call the same **AWS APIs**.

## Credentials

- The console uses a **user name and password** (plus MFA).
- The CLI and SDKs use **access keys** (an access key ID and a secret access key), or better, **temporary credentials** from an IAM role or IAM Identity Center.
- Never put access keys in code or share them.

## Infrastructure as code (IaC)

**AWS CloudFormation** creates resources from a template (JSON or YAML) as a **stack**: the same template gives the same environment every time, can be version-controlled, and can be torn down in one go. The **AWS CDK** lets you write those templates in a programming language.

## Where you'll see it

- One-off exploration: the **console**.
- Automating a repeated task: the **CLI** or an **SDK**.
- Repeatable environments: **CloudFormation / CDK**.`,
      questions: [
        q('A developer wants to call AWS services from a Python application. What should they use?', ['The AWS Management Console', 'An AWS SDK', 'AWS Artifact', 'AWS Marketplace'], 1, 'The **SDKs** let application code call AWS APIs in its own language.'),
        q('Which provides a browser-based shell, already authenticated, for running AWS CLI commands?', ['AWS CloudShell', 'AWS Cloud9', 'Amazon WorkSpaces', 'AWS Systems Manager Session Manager'], 0, '**CloudShell** is a pre-authenticated terminal in the console with the CLI installed.'),
        q('A company wants to create identical environments for development, testing and production from one template. Which service fits?', ['AWS CloudFormation', 'Amazon CloudWatch', 'AWS Config', 'AWS Trusted Advisor'], 0, '**CloudFormation** provisions repeatable stacks from templates: infrastructure as code.'),
        q('Which credentials does the AWS CLI use for programmatic access?', ['The root user\'s password', 'Access keys or temporary credentials', 'An SSH key pair', 'An MFA device only'], 1, 'Programmatic access uses access keys, or (better) temporary credentials from a role.'),
        q('What do the console, CLI and SDKs have in common?', ['They are only for the root user', 'They all call the same AWS APIs', 'They only work in one Region', 'They require Direct Connect'], 1, 'Every tool is a different front end to the same AWS APIs.'),
        q('Which lets developers define cloud infrastructure in familiar programming languages like TypeScript or Python?', ['AWS CDK', 'AWS CLI', 'Amazon Lightsail', 'AWS Elastic Beanstalk'], 0, 'The **AWS Cloud Development Kit** turns code into CloudFormation templates.'),
      ],
    }),
    checkpoint({
      id: 'clf-compute-checkpoint',
      title: 'Checkpoint: Infrastructure and Compute',
      system: 'Engine Certification Gate',
      skills: ['aws-compute', 'aws-networking'],
      brief: `**ARIA:** Exam-style scenarios: global infrastructure, EC2, scaling, containers and serverless.`,
      lesson: `## Before you start

- Region → Availability Zones (one or more data centres each) → plus edge locations, Local Zones, Wavelength, Outposts.
- EC2 families: general purpose, compute, memory, storage optimized, accelerated.
- Auto Scaling (elasticity) + ELB (spread traffic) across AZs (availability).
- Lambda: event-driven, up to 15 minutes. ECS/EKS run containers; Fargate makes them serverless.`,
      questions: [
        q('A video-processing job runs every night for 3 hours. Why is AWS Lambda a poor fit?', ['Lambda can\'t process video', 'A single Lambda invocation can run for at most 15 minutes', 'Lambda only runs on weekends', 'Lambda requires a Dedicated Host'], 1, 'Long-running jobs exceed Lambda\'s 15-minute limit. EC2, AWS Batch or containers suit them.'),
        q('Which helps an application survive the failure of an entire data centre?', ['Larger instance types', 'Deploying across multiple Availability Zones', 'Using instance store volumes', 'Running in a single edge location'], 1, 'Each AZ is separate infrastructure, so multi-AZ deployments survive one failing.'),
        q('A gaming company needs instances with high-performance processors for its game servers. Which family fits?', ['Memory optimized', 'Compute optimized', 'Storage optimized', 'Burstable general purpose'], 1, 'Compute optimized instances suit CPU-bound work like game servers and batch processing.'),
        q('Which AWS infrastructure option is designed for single-digit millisecond latency to end users in a specific large city?', ['Local Zones', 'Availability Zones', 'Regions', 'AWS Outposts'], 0, '**Local Zones** extend a Region into large metropolitan areas.'),
        q('A web application needs a load balancer that routes `/checkout` to one group of servers and `/search` to another. Which should be used?', ['Network Load Balancer', 'Application Load Balancer', 'Gateway Load Balancer', 'Amazon Route 53'], 1, 'Path-based routing is an Application Load Balancer feature.'),
        q('A company wants to run containers without managing EC2 instances. Which combination works?', ['Amazon ECS with AWS Fargate', 'Amazon ECR with Amazon EBS', 'AWS Lambda with Amazon EC2', 'Amazon Lightsail with AWS Batch'], 0, 'Fargate runs ECS (or EKS) tasks without servers to manage.'),
        q('What does an Auto Scaling group\'s **maximum** capacity setting do?', ['Sets how many instances always run', 'Caps how many instances it can launch', 'Sets the instance size', 'Limits network bandwidth'], 1, 'The maximum is the ceiling for scale-out; the minimum is the floor; desired is the current target.'),
        q('Which is NOT a factor when choosing an AWS Region?', ['Compliance with data residency laws', 'Latency to customers', 'Which services are available there', 'The number of IAM users in the account'], 3, 'IAM is global: users aren\'t tied to a Region. Compliance, latency, service availability and price are the factors.'),
      ],
    }),
  ],
};
