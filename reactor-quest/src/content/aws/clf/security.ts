// CLF-C02 Domain 2: Security and Compliance (30% of the exam).
import type { Deck } from '../../../game/types';
import { checkpoint, lesson, q } from '../kit';

export const clfSecurity: Deck = {
  id: 'clf-security',
  name: 'Security and Compliance',
  subtitle: 'Domain 2 · 30% of the exam',
  outcome: 'Say who secures what, control access with IAM, and name the service for every security job.',
  hue: 0,
  domain: 'clf-d2',
  levels: [
    lesson({
      id: 'clf-shared-responsibility',
      title: 'The Shared Responsibility Model',
      system: 'Airlock Protocol',
      skills: ['aws-security'],
      brief: `**ARIA:** The single most tested idea on the exam: AWS secures some things, you secure others. Get the line exactly right.`,
      lesson: `## Security OF the cloud vs IN the cloud

| AWS is responsible for security **OF** the cloud | The customer is responsible for security **IN** the cloud |
|---|---|
| Physical security of data centres | **Customer data** |
| Hardware, networking and facilities | **Identity and access management** (users, permissions) |
| The global infrastructure: Regions, AZs, edge locations | **Guest operating system** patches on EC2 |
| The virtualisation layer (hypervisor) | Application software and its security |
| The software of **managed services** (for example the RDS database engine) | **Firewall configuration** (security groups, NACLs) |
| Decommissioning old storage devices | **Encryption** choices (client-side, server-side), network traffic protection |

## It depends on the service

The more managed the service, the more AWS takes on:

- **Amazon EC2** (IaaS): you patch the OS, install software, configure security groups.
- **Amazon RDS:** AWS patches the database engine and OS; you manage database users, data and network access.
- **AWS Lambda, Amazon S3, DynamoDB:** AWS runs everything underneath; you manage data, access policies and encryption settings.

## Shared controls

Some controls apply to both, each in their own domain:

- **Patch management:** AWS patches the infrastructure; you patch your guest OS and applications.
- **Configuration management:** AWS configures its devices; you configure your OS, databases and apps.
- **Awareness and training:** AWS trains its staff; you train yours.`,
      questions: [
        q('Under the shared responsibility model, who patches the guest operating system on an EC2 instance?', ['AWS', 'The customer', 'Both equally', 'The AMI vendor'], 1, 'The guest OS on EC2 is the customer\'s responsibility.'),
        q('Which is AWS\'s responsibility?', ['Encrypting customer data', 'Configuring security groups', 'Physical security of data centres', 'Creating IAM users'], 2, 'Physical security is security **of** the cloud: AWS\'s job.'),
        q('With Amazon RDS, who patches the database engine software?', ['The customer', 'AWS', 'The database vendor directly', 'Nobody'], 1, 'RDS is managed: AWS patches the engine and underlying OS.'),
        q('Which is ALWAYS the customer\'s responsibility, whatever the service?', ['Hypervisor security', 'Managing their data and who can access it', 'Hardware maintenance', 'Availability Zone power'], 1, 'Your data and access to it are always yours to protect.'),
        q('Which is a **shared** control between AWS and the customer?', ['Physical and environmental controls', 'Patch management', 'Data centre staffing', 'Hardware disposal'], 1, 'Patch management is shared: AWS patches infrastructure, customers patch their OS and apps.'),
        q('Who is responsible for configuring a security group on an EC2 instance?', ['AWS', 'The customer', 'AWS Support', 'The Region operator'], 1, 'Firewall configuration (security groups, NACLs) is the customer\'s job.'),
      ],
    }),
    lesson({
      id: 'clf-iam',
      title: 'IAM: Who Can Do What',
      system: 'Access Control',
      skills: ['aws-security'],
      brief: `**ARIA:** Every request to AWS asks two questions: who are you, and are you allowed? AWS Identity and Access Management answers both.`,
      lesson: `## The root user

The **root user** is the email address that created the account. It can do **everything**, including things nothing else can, like **closing the account, changing the support plan, and changing account settings**.

Best practice: **enable MFA on it, don't create access keys for it, and don't use it for everyday tasks.** Create other identities for daily work.

## IAM identities

| Identity | What it is |
|---|---|
| **IAM user** | A person or application with **long-term** credentials (password and/or access keys) |
| **IAM group** | A collection of users; attach permissions to the group, and every member gets them |
| **IAM role** | An identity with **temporary credentials** that is **assumed** by whoever needs it: an AWS service (an EC2 instance calling S3), a user from another account, or a federated user |

## Policies

A **policy** is a JSON document that **allows or denies** actions on resources. Attach policies to users, groups or roles.

- Follow **least privilege**: grant only the permissions needed.
- **AWS managed policies** are ready-made; **customer managed policies** are your own.
- An explicit **deny** always wins over an allow.

## Best practices

- **MFA** (multi-factor authentication) for every human, especially the root user.
- A strong **password policy**.
- Use **roles** for applications on AWS instead of storing access keys.
- **Rotate** credentials, and remove unused ones (the **IAM credential report** lists them).

## For people at scale

- **AWS IAM Identity Center:** single sign-on for your workforce across multiple AWS accounts and business apps, using your existing identity provider.
- **Amazon Cognito:** sign-up and sign-in for **your app's customers**.`,
      questions: [
        q('Which is a best practice for the AWS account root user?', ['Use it for daily administration', 'Enable MFA and avoid using it for everyday tasks', 'Share its password with the team', 'Create access keys for it to use in scripts'], 1, 'Lock the root user away with MFA and use other identities day to day.'),
        q('An application on EC2 needs to read objects from S3. What is the most secure way to grant access?', ['Store an IAM user\'s access keys on the instance', 'Attach an IAM role to the instance', 'Use the root user\'s credentials', 'Make the bucket public'], 1, 'A role gives the instance temporary credentials that rotate automatically.'),
        q('Which task can only the root user perform?', ['Launching an EC2 instance', 'Creating an S3 bucket', 'Changing the AWS Support plan', 'Creating an IAM group'], 2, 'Changing the support plan (and closing the account) needs the root user.'),
        q('What is the principle of least privilege?', ['Give everyone administrator access to save time', 'Grant only the permissions required to do a task', 'Deny all access to all users', 'Use only one IAM user per account'], 1, 'Least privilege: only what is needed, nothing more.'),
        q('Twenty developers need the same permissions. What is the easiest way to manage them?', ['Attach the policy to each user separately', 'Put the users in an IAM group and attach the policy to the group', 'Share one IAM user between all of them', 'Give them the root user'], 1, 'Groups apply the same permissions to every member.'),
        q('A company wants employees to sign in once and access multiple AWS accounts with their existing corporate credentials. Which service fits?', ['Amazon Cognito', 'AWS IAM Identity Center', 'AWS Secrets Manager', 'AWS Directory Service only'], 1, '**IAM Identity Center** provides workforce single sign-on across accounts. (Cognito is for your app\'s customers.)'),
      ],
    }),
    lesson({
      id: 'clf-security-services',
      title: 'Threat Protection Services',
      system: 'Defence Grid',
      skills: ['aws-security'],
      brief: `**ARIA:** Attackers knock on ground control's door every few seconds. AWS has a guard for every kind of threat. Learn which guard does what.`,
      lesson: `## Protecting the front door

| Service | Protects against |
|---|---|
| **AWS Shield** | **DDoS attacks** (floods of traffic). **Shield Standard** is **free and automatic** for every customer. **Shield Advanced** is paid: more protection, cost protection for attack-driven scaling, and the Shield Response Team. |
| **AWS WAF** (Web Application Firewall) | Common **web exploits** at layer 7: **SQL injection, cross-site scripting**, bad bots; rules by IP, country, rate. Works with CloudFront, ALB and API Gateway. |
| **AWS Network Firewall** | Managed network firewall for your VPCs |
| **AWS Firewall Manager** | Centrally manages WAF, Shield and firewall rules **across accounts** in AWS Organizations |

## Finding threats and weaknesses

| Service | What it does |
|---|---|
| **Amazon GuardDuty** | **Intelligent threat detection**: analyses CloudTrail, VPC Flow Logs and DNS logs with machine learning to spot malicious activity (crypto-mining, compromised credentials) |
| **Amazon Inspector** | **Automated vulnerability scanning** of EC2 instances, container images and Lambda functions for software vulnerabilities and network exposure |
| **Amazon Macie** | Uses machine learning to **discover sensitive data (PII)** in **S3** |
| **Amazon Detective** | **Investigates** security findings to find the root cause |
| **AWS Security Hub** | A **single view** of security alerts from many services, plus automated checks against standards |
| **IAM Access Analyzer** | Finds resources shared with outside entities, and unused access |

Memory hooks: GuardDuty *guards* (detects threats); Inspector *inspects* for vulnerabilities; Macie finds *personal data*; Detective *investigates*; Security Hub *gathers* it all.`,
      questions: [
        q('Which service provides free, automatic DDoS protection to all AWS customers?', ['AWS WAF', 'AWS Shield Standard', 'Amazon GuardDuty', 'AWS Shield Advanced'], 1, '**Shield Standard** is included at no extra cost.'),
        q('Which service protects a web application from SQL injection and cross-site scripting attacks?', ['AWS WAF', 'AWS Shield', 'Amazon Macie', 'Amazon Inspector'], 0, '**WAF** filters web requests with rules against common exploits.'),
        q('Which service uses machine learning to detect malicious activity by analysing CloudTrail, VPC Flow Logs and DNS logs?', ['Amazon Inspector', 'Amazon GuardDuty', 'AWS Config', 'Amazon Detective'], 1, '**GuardDuty** is intelligent threat detection.'),
        q('Which service discovers and protects sensitive data like credit card numbers stored in Amazon S3?', ['Amazon Macie', 'Amazon Inspector', 'AWS Shield', 'AWS Artifact'], 0, '**Macie** finds sensitive data in S3.'),
        q('Which service automatically scans EC2 instances and container images for software vulnerabilities?', ['Amazon Inspector', 'Amazon GuardDuty', 'AWS Trusted Advisor', 'Amazon Macie'], 0, '**Inspector** is the vulnerability scanner.'),
        q('Which service collects security findings from multiple AWS services into one place?', ['AWS Security Hub', 'Amazon Detective', 'AWS CloudTrail', 'AWS Firewall Manager'], 0, '**Security Hub** aggregates findings and checks against standards.'),
      ],
    }),
    lesson({
      id: 'clf-data-protection',
      title: 'Encryption and Secrets',
      system: 'Cipher Vault',
      skills: ['aws-security'],
      brief: `**ARIA:** Even if someone gets in, encrypted data is useless to them. Learn where AWS encrypts, who holds the keys, and where to keep passwords.`,
      lesson: `## Two kinds of encryption

- **Encryption at rest:** data stored on disk (S3, EBS, RDS, DynamoDB) is encrypted. Many services can encrypt by default.
- **Encryption in transit:** data moving across a network is encrypted with **TLS** (HTTPS).

## Keys and certificates

| Service | What it does |
|---|---|
| **AWS KMS** (Key Management Service) | Creates and manages **encryption keys**, integrated with most AWS services. Keys never leave KMS unencrypted; every use is logged in CloudTrail. |
| **AWS CloudHSM** | **Dedicated hardware security modules** that only you control. For strict compliance needs. |
| **AWS Certificate Manager (ACM)** | Provisions and **renews SSL/TLS certificates** for your websites, for free on integrated services like ELB and CloudFront |

## Secrets

- **AWS Secrets Manager:** stores secrets like **database passwords and API keys**, and **rotates them automatically**.
- **AWS Systems Manager Parameter Store:** stores configuration values and secrets; simpler, without built-in rotation.

Never hard-code passwords or access keys in application code.

## Protecting S3 data

- **S3 Block Public Access:** account- or bucket-level switches that stop data being made public by mistake.
- **Bucket policies** grant or deny access to a bucket.
- Server-side encryption is applied to new objects by default.`,
      questions: [
        q('Which service creates and manages the encryption keys used by many AWS services?', ['AWS KMS', 'AWS Certificate Manager', 'AWS Secrets Manager', 'Amazon Macie'], 0, '**KMS** manages encryption keys.'),
        q('A company needs to store database credentials and rotate them automatically. Which service fits?', ['AWS Secrets Manager', 'Amazon S3', 'AWS KMS', 'IAM access keys'], 0, '**Secrets Manager** stores and automatically rotates secrets.'),
        q('Which service provisions and renews SSL/TLS certificates for a website on a load balancer?', ['AWS Certificate Manager', 'AWS CloudHSM', 'AWS KMS', 'Amazon Route 53'], 0, '**ACM** provides and renews certificates.'),
        q('A company\'s compliance rules require encryption keys in dedicated, single-tenant hardware it controls. Which service fits?', ['AWS KMS with AWS managed keys', 'AWS CloudHSM', 'AWS Secrets Manager', 'Amazon EBS encryption'], 1, '**CloudHSM** gives you dedicated hardware security modules.'),
        q('What protects data as it travels between a user\'s browser and a website?', ['Encryption at rest', 'Encryption in transit with TLS (HTTPS)', 'S3 Versioning', 'AWS Shield'], 1, 'TLS encrypts data in transit.'),
        q('Which feature prevents S3 buckets from being made public by accident across an entire account?', ['S3 Lifecycle', 'S3 Block Public Access', 'S3 Transfer Acceleration', 'S3 Intelligent-Tiering'], 1, '**Block Public Access** overrides any setting that would make data public.'),
      ],
    }),
    lesson({
      id: 'clf-compliance',
      title: 'Compliance and Audit',
      system: 'Inspection Office',
      skills: ['aws-security'],
      brief: `**ARIA:** An auditor is coming to ground control and wants proof. Proof that AWS is certified, and proof that you are following the rules too.`,
      lesson: `## Compliance on AWS

AWS's infrastructure is certified against many **compliance programs**: ISO 27001, SOC 1/2/3, PCI DSS (card payments), HIPAA (US health data), GDPR support and more. But **your application** must still meet the rules: that part is your responsibility.

## Where to find proof

| Service | What it gives you |
|---|---|
| **AWS Artifact** | **On-demand access to AWS's compliance reports** (SOC reports, PCI attestations, ISO certificates) and **agreements** you can accept (like a HIPAA Business Associate Addendum) |
| **AWS Audit Manager** | **Continuously audits your own AWS usage** against frameworks and collects evidence for your audits |
| **AWS Config** (conformance packs) | Checks that your resources follow your rules, over time |
| **AWS CloudTrail** | The record of who did what, for auditors |

## Where data lives

- You **choose the Region**, and data stays there unless you move it: the key to **data residency** rules.
- **AWS Customer Compliance Center** and the **AWS Compliance Programs** pages explain how to meet specific regulations.

## Logging for audits

Turn on **CloudTrail** in every account and Region, keep logs in a protected S3 bucket, and use **CloudWatch Logs** for application logs.`,
      questions: [
        q('Where can a customer download AWS\'s SOC 2 report?', ['AWS Artifact', 'AWS Config', 'AWS Audit Manager', 'AWS Trusted Advisor'], 0, '**Artifact** provides AWS compliance reports on demand.'),
        q('Which service continuously collects evidence about a customer\'s AWS usage to prepare for audits against frameworks like PCI DSS?', ['AWS Audit Manager', 'AWS Artifact', 'Amazon Inspector', 'AWS Shield'], 0, '**Audit Manager** audits your own usage and gathers evidence.'),
        q('AWS is PCI DSS compliant. Does that make a customer\'s payment application compliant automatically?', ['Yes, compliance is inherited completely', 'No: the customer must still make their own application and configuration compliant', 'Only if it runs in us-east-1', 'Only with Enterprise Support'], 1, 'AWS\'s certification covers its infrastructure; the customer is responsible for compliance of what they build on it.'),
        q('How can a company make sure its data stays in a particular country?', ['Choose a Region in that country; AWS doesn\'t move data out of a Region on its own', 'Use AWS Shield Advanced', 'Enable S3 Versioning', 'Use Amazon CloudFront'], 0, 'Region choice controls data residency.'),
        q('Where would a healthcare company accept a Business Associate Addendum (BAA) with AWS?', ['AWS Artifact', 'AWS Organizations', 'AWS Marketplace', 'AWS Support Center'], 0, 'Agreements such as the BAA are reviewed and accepted in **Artifact**.'),
        q('An auditor wants a record of every API call made in the account over the last year. What provides it?', ['AWS CloudTrail logs', 'Amazon CloudWatch metrics', 'VPC Flow Logs', 'AWS Health Dashboard'], 0, '**CloudTrail** is the API audit log.'),
      ],
    }),
    lesson({
      id: 'clf-governance',
      title: 'Many Accounts, One Organisation',
      system: 'Command Hierarchy',
      skills: ['aws-security', 'aws-billing'],
      brief: `**ARIA:** Ground control has eleven AWS accounts and no rules across them. Big companies use many accounts on purpose. Learn how they govern them.`,
      lesson: `## Why many accounts?

Separate accounts **isolate** workloads (production vs development), limit the blast radius of mistakes, and separate billing. Managing them needs central tools.

## AWS Organizations

- Manages many accounts centrally, grouped into **organizational units (OUs)**.
- **Consolidated billing:** one bill for all accounts, with combined usage for **volume discounts**.
- **Service control policies (SCPs):** set the **maximum permissions** for accounts in an OU. An SCP never grants permissions; it limits what IAM can grant. Example: "no one in the Development OU can leave the eu-west-1 Region."

## AWS Control Tower

Sets up a well-architected, **multi-account environment** (a **landing zone**) automatically, applying **controls** (guardrails) and best practices. Built on Organizations.

## More governance tools

- **AWS Service Catalog:** a catalogue of **approved** products (like CloudFormation templates) that users can launch, so teams use only what is allowed.
- **AWS Resource Access Manager (RAM):** share resources (like subnets) between accounts.
- **Tags:** labels on resources (\`project=apollo\`) for organising, cost reports and access control.
- **AWS License Manager:** tracks software licence use.`,
      questions: [
        q('Which service manages multiple AWS accounts centrally with consolidated billing?', ['AWS Organizations', 'AWS IAM', 'AWS Config', 'AWS Control Tower only'], 0, '**Organizations** groups accounts and consolidates billing.'),
        q('What does a service control policy (SCP) do?', ['Grants permissions to users', 'Sets the maximum permissions available to accounts in an organisation', 'Encrypts data', 'Monitors API calls'], 1, 'SCPs limit what can be allowed; they never grant permissions themselves.'),
        q('Which service sets up a secure, multi-account landing zone with guardrails automatically?', ['AWS Control Tower', 'AWS Service Catalog', 'AWS Artifact', 'Amazon GuardDuty'], 0, '**Control Tower** builds and governs a landing zone.'),
        q('A company wants teams to launch only pre-approved, compliant architectures. Which service fits?', ['AWS Service Catalog', 'AWS Marketplace', 'Amazon WorkSpaces', 'AWS Elastic Beanstalk'], 0, '**Service Catalog** offers a curated set of approved products.'),
        q('How does consolidated billing help save money?', ['It removes all charges for development accounts', 'Usage across accounts is combined, reaching volume pricing tiers sooner', 'It gives every account a free tier', 'It converts On-Demand to Spot pricing'], 1, 'Combined usage qualifies for volume discounts, and Reserved Instance and Savings Plans discounts can be shared.'),
        q('Which helps a company allocate costs to projects and teams?', ['Applying tags to resources', 'Enabling MFA', 'Using Shield Advanced', 'Using larger instances'], 0, 'Tags (activated as cost allocation tags) break down costs by project, team or environment.'),
      ],
    }),
    checkpoint({
      id: 'clf-security-checkpoint',
      title: 'Checkpoint: Security and Compliance',
      system: 'Defence Certification Gate',
      skills: ['aws-security'],
      brief: `**ARIA:** The biggest domain on the exam. Scenarios across shared responsibility, IAM, protection services, encryption and compliance.`,
      lesson: `## Before you start

- AWS: security **of** the cloud. You: security **in** the cloud (data, IAM, guest OS, firewall rules, encryption).
- Root user: MFA, no access keys, not for daily use. Roles for services. Least privilege.
- Shield = DDoS. WAF = web exploits. GuardDuty = threats. Inspector = vulnerabilities. Macie = sensitive data in S3.
- KMS = keys. Secrets Manager = rotating secrets. ACM = certificates. Artifact = AWS's compliance reports.`,
      questions: [
        q('Which is the customer\'s responsibility when using AWS Lambda?', ['Patching the operating system the functions run on', 'The function code and the IAM permissions it uses', 'Scaling the underlying servers', 'The physical security of the hosts'], 1, 'With Lambda, AWS runs the infrastructure; your code and its permissions are yours.'),
        q('A company is being hit by a large DDoS attack on its public website and wants expert help and cost protection. Which service fits?', ['AWS Shield Advanced', 'AWS Shield Standard', 'Amazon Inspector', 'AWS Config'], 0, '**Shield Advanced** adds the Shield Response Team and cost protection.'),
        q('An IAM policy allows `s3:*` but another policy attached to the same user explicitly denies `s3:DeleteObject`. Can the user delete objects?', ['Yes, the allow wins', 'No, an explicit deny always wins', 'Only in the us-east-1 Region', 'Only with MFA'], 1, 'An explicit deny overrides any allow.'),
        q('GuardDuty finds suspicious activity. Which service helps investigate its root cause by analysing relationships between events?', ['Amazon Detective', 'Amazon Macie', 'AWS Artifact', 'AWS Shield'], 0, '**Detective** investigates findings to find the root cause.'),
        q('Which is a best practice for securing an AWS account?', ['Use the root user for daily administration', 'Enable MFA for users, and grant least privilege', 'Embed access keys in application code', 'Give all developers administrator access'], 1, 'MFA plus least privilege is the foundation.'),
        q('A company wants every developer account in an OU to be unable to disable AWS CloudTrail, regardless of their IAM permissions. What should it use?', ['A service control policy', 'An IAM group', 'A security group', 'AWS Shield'], 0, 'An **SCP** limits what any identity in those accounts can do.'),
        q('Which service would show whether an S3 bucket or IAM role is shared with an external account?', ['IAM Access Analyzer', 'Amazon Inspector', 'AWS Trusted Advisor', 'Amazon CloudWatch'], 0, '**IAM Access Analyzer** finds resources shared outside your account or organisation.'),
        q('Who is responsible for encrypting data stored in an S3 bucket?', ['AWS alone', 'The customer chooses and configures the encryption (S3 encrypts new objects by default)', 'Nobody: S3 data can\'t be encrypted', 'The internet service provider'], 1, 'Encryption choices are the customer\'s, even though S3 applies server-side encryption to new objects by default.'),
      ],
    }),
  ],
};
