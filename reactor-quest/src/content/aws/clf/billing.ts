// CLF-C02 Domain 4: Billing, Pricing, and Support (12% of the exam).
import type { Deck } from '../../../game/types';
import { checkpoint, lesson, q } from '../kit';

export const clfBilling: Deck = {
  id: 'clf-billing',
  name: 'Billing, Pricing and Support',
  subtitle: 'Domain 4 · 12% of the exam',
  outcome: 'Pick the cheapest way to pay, track and forecast spending, and know who to call for help.',
  hue: 95,
  domain: 'clf-d4',
  levels: [
    lesson({
      id: 'clf-pricing-models',
      title: 'Ways to Pay for Compute',
      system: 'Fuel Contracts',
      skills: ['aws-billing'],
      brief: `**ARIA:** Ground control pays full price for servers that run all year. There are cheaper ways to buy the exact same compute, if you know when to commit.`,
      lesson: `## How AWS charges

You pay for **compute** (by the second or hour), **storage** (per GB-month) and **data transfer out**. **Data transfer into AWS is free**; data going out to the internet, and between Regions, is charged.

## EC2 purchase options

| Option | Discount | Commitment | Best for |
|---|---|---|---|
| **On-Demand** | None | None: pay by the second | Short-term, spiky or unpredictable workloads; trying things out |
| **Savings Plans** | Up to ~72% | A **$/hour spend** for 1 or 3 years | Steady usage, with flexibility. **Compute Savings Plans** cover EC2 (any family, size, Region), Fargate and Lambda |
| **Reserved Instances** | Up to ~72% | A specific instance configuration for 1 or 3 years | Steady, predictable usage. **Convertible** RIs can change type for a smaller discount |
| **Spot Instances** | Up to ~90% | None, but AWS can **reclaim them with a 2-minute warning** | Flexible, fault-tolerant work: batch jobs, data analysis, CI, stateless workers |
| **Dedicated Hosts** | None | Optional reservation | A **whole physical server** for you: for **licences tied to physical cores or sockets (BYOL)** and compliance |
| **Dedicated Instances** | None | None | Instances on hardware dedicated to your account |
| **Capacity Reservations** | None | Reserve capacity in an AZ | Guaranteeing capacity is there when you need it |

Paying **all up front** gives the biggest Reserved Instance or Savings Plan discount; partial and no up-front options pay less discount.

## The Free Tier

AWS offers **always-free** usage of some services (for example Lambda's monthly free requests), **free trials** of others, and free-plan credits for new accounts. Free usage is limited: watch for charges as you grow.`,
      questions: [
        q('Which EC2 pricing option is best for a batch job that can be interrupted and restarted at any time, at the lowest cost?', ['On-Demand Instances', 'Reserved Instances', 'Spot Instances', 'Dedicated Hosts'], 2, 'Interruptible, flexible work fits **Spot**, at up to 90% off.'),
        q('A company runs the same workload 24/7 for the next 3 years and wants the biggest discount. Which options fit?', ['On-Demand Instances', 'A 3-year Reserved Instance or Savings Plan, paid all up front', 'Spot Instances', 'Dedicated Instances without a reservation'], 1, 'Long, steady commitments with all-up-front payment give the largest discounts.'),
        q('A company has software licences tied to physical CPU cores. Which option lets it bring those licences to AWS?', ['Spot Instances', 'Dedicated Hosts', 'Savings Plans', 'On-Demand Instances'], 1, '**Dedicated Hosts** give visibility of physical cores and sockets for BYOL.'),
        q('Which is generally free on AWS?', ['Data transfer out to the internet', 'Data transfer into AWS from the internet', 'Data transfer between Regions', 'NAT gateway processing'], 1, 'Inbound data transfer is free; outbound and inter-Region transfer cost money.'),
        q('A team is testing a new app for two weeks and doesn\'t know what it needs. Which pricing option fits?', ['Reserved Instances', 'On-Demand Instances', 'A 3-year Savings Plan', 'Dedicated Hosts'], 1, 'No commitment, pay as you go: **On-Demand**.'),
        q('Which commitment-based option applies discounts across EC2, AWS Fargate and AWS Lambda usage?', ['Compute Savings Plans', 'Standard Reserved Instances', 'Spot Instances', 'Capacity Reservations'], 0, '**Compute Savings Plans** are the most flexible commitment.'),
      ],
    }),
    lesson({
      id: 'clf-cost-tools',
      title: 'Watching the Money',
      system: 'Treasury Console',
      skills: ['aws-billing'],
      brief: `**ARIA:** Last month's bill surprised everyone. AWS has tools to estimate costs before you build, understand them after, and get warned before they run away.`,
      lesson: `## Before you build

- **AWS Pricing Calculator:** **estimate** the cost of an architecture before you create it.

## After you build

| Tool | What it does |
|---|---|
| **AWS Cost Explorer** | **Visualise and analyse** past costs and usage with graphs and filters, and **forecast** future spending |
| **AWS Budgets** | Set custom **cost, usage or reservation budgets**, and get **alerts** when you exceed (or are forecast to exceed) them; budget actions can respond automatically |
| **AWS Cost and Usage Report** (via **AWS Data Exports**) | The **most detailed** billing data, line by line, delivered to S3 for analysis |
| **AWS Cost Anomaly Detection** | Uses machine learning to spot **unusual spending** and alert you |
| **Cost allocation tags** | Tags activated for billing, so costs can be **broken down by project, team or environment** |
| **AWS Billing Conductor** | Custom billing views and rates, for showback and chargeback |

## Organisations

**AWS Organizations consolidated billing** gives one bill for many accounts, combines usage for volume discounts, and shares Reserved Instance and Savings Plans discounts across accounts.

## Saving money, continuously

- **AWS Trusted Advisor** flags idle resources and underused instances.
- **AWS Compute Optimizer** recommends better sizes.
- Turn off what you don't use: dev environments at night, unattached EBS volumes, old snapshots.`,
      questions: [
        q('Which tool estimates the cost of an architecture before it is built?', ['AWS Cost Explorer', 'AWS Pricing Calculator', 'AWS Budgets', 'AWS Cost and Usage Report'], 1, 'The **Pricing Calculator** estimates costs ahead of time.'),
        q('A finance team wants an email alert when monthly spending is forecast to exceed $5,000. Which service fits?', ['AWS Budgets', 'AWS Cost Explorer', 'AWS Pricing Calculator', 'AWS Artifact'], 0, '**Budgets** sends alerts on actual or forecast spend.'),
        q('Which tool visualises past costs and forecasts future spending?', ['AWS Cost Explorer', 'AWS Pricing Calculator', 'AWS Organizations', 'Amazon QuickSight only'], 0, '**Cost Explorer** analyses and forecasts costs.'),
        q('Which provides the most detailed, line-item billing data for analysis?', ['AWS Cost and Usage Report', 'AWS Budgets', 'The AWS Billing dashboard summary', 'AWS Health Dashboard'], 0, 'The **Cost and Usage Report** is the most granular billing data.'),
        q('How can a company see how much each project spends on AWS?', ['Activate cost allocation tags and tag resources by project', 'Use AWS Shield', 'Create a separate root user per project', 'Use Amazon Inspector'], 0, 'Cost allocation tags break the bill down by your own labels.'),
        q('Which service uses machine learning to alert on unusual spikes in spending?', ['AWS Cost Anomaly Detection', 'Amazon GuardDuty', 'AWS Config', 'Amazon Macie'], 0, '**Cost Anomaly Detection** spots spending anomalies.'),
      ],
    }),
    lesson({
      id: 'clf-support-plans',
      title: 'Support Plans',
      system: 'Distress Beacon',
      skills: ['aws-billing'],
      brief: `**ARIA:** When production goes down at 3 a.m., how fast does AWS answer, and who answers? It depends on the support plan. A favourite exam topic.`,
      lesson: `## The AWS Support plans

| Plan | Who it's for | Highlights |
|---|---|---|
| **Basic** (free) | Everyone | Customer service for **account and billing** questions, documentation, whitepapers, **AWS re:Post**, the **AWS Health Dashboard**, and core **Trusted Advisor** checks. No technical support cases. |
| **Developer** | Experimenting and testing | **Business-hours email** access to Cloud Support Associates; general guidance in < 24 hours, system impaired in < 12 hours |
| **Business** | Production workloads | **24/7 phone, email and chat** with Cloud Support Engineers; production system **down: < 1 hour**; **all Trusted Advisor checks**; the AWS Support API |
| **Enterprise On-Ramp** | Production and business-critical workloads | Business-critical system **down: < 30 minutes**; a **pool of Technical Account Managers (TAMs)**; Concierge Support Team for billing |
| **Enterprise** | Mission-critical workloads | Business-critical system **down: < 15 minutes**; a **designated TAM**; Concierge Support Team; well-architected and operations reviews; Infrastructure Event Management |

**Technical Account Manager (TAM):** your proactive guide and advocate inside AWS. **Concierge Support Team:** billing and account experts for Enterprise customers.

Remember the ladder of response times: **Business < 1 hour, Enterprise On-Ramp < 30 minutes, Enterprise < 15 minutes.** (AWS revises its plans from time to time; check the current support page before you book your exam.)`,
      questions: [
        q('What is the lowest-cost support plan that offers 24/7 phone access to Cloud Support Engineers?', ['Basic', 'Developer', 'Business', 'Enterprise'], 2, '**Business** is the first plan with 24/7 phone, email and chat.'),
        q('Which support plan includes a designated Technical Account Manager?', ['Business', 'Enterprise On-Ramp', 'Enterprise', 'Developer'], 2, '**Enterprise** gives a designated TAM; Enterprise On-Ramp gives access to a pool of TAMs.'),
        q('What do all AWS customers get with the free Basic Support plan?', ['Technical support cases by phone', 'Account and billing customer service, documentation, re:Post and core Trusted Advisor checks', 'A Technical Account Manager', 'A 15-minute response for critical systems'], 1, 'Basic covers account and billing help and self-service resources.'),
        q('A company needs the full set of AWS Trusted Advisor checks. What is the minimum support plan?', ['Basic', 'Developer', 'Business', 'Enterprise'], 2, 'All Trusted Advisor checks start at **Business** support.'),
        q('Which plan has a response time of under 15 minutes for a business-critical system that is down?', ['Business', 'Enterprise On-Ramp', 'Enterprise', 'Developer'], 2, '**Enterprise** offers < 15 minutes; Enterprise On-Ramp < 30 minutes; Business < 1 hour for production down.'),
        q('A developer experimenting with AWS wants email access to technical support during business hours at low cost. Which plan fits?', ['Basic', 'Developer', 'Business', 'Enterprise On-Ramp'], 1, '**Developer** offers business-hours email support.'),
      ],
    }),
    lesson({
      id: 'clf-resources',
      title: 'Help, Partners and Marketplace',
      system: 'Allied Fleet',
      skills: ['aws-billing'],
      brief: `**ARIA:** You don't have to do everything alone. AWS has communities, partners, ready-made software and documentation. And a team for when someone abuses AWS.`,
      lesson: `## Help yourself

| Resource | What it is |
|---|---|
| **AWS re:Post** | A community **question-and-answer** site, with answers from the community and AWS experts |
| **AWS Knowledge Center** | Answers to the **most frequently asked** questions and requests |
| **AWS Documentation** and **whitepapers** | Official guides, references and best-practice papers |
| **AWS Prescriptive Guidance** | Strategies, guides and patterns for migrations and architectures |
| **AWS Skill Builder** / **AWS Training and Certification** | Courses and labs, like the ones this game prepares you for |
| **AWS Solutions Library** | Vetted, ready-to-deploy solutions for common problems |

## Get help from people

- **AWS Partner Network (APN):** companies that build on AWS: **consulting partners** help you design and migrate; **technology partners** sell software that runs on AWS.
- **AWS Professional Services:** AWS's own experts, for large projects.
- **AWS Solutions Architects** and **account managers** advise customers on architecture and spending.

## Buy software

**AWS Marketplace:** a digital catalogue of **third-party software, data and services** (AMIs, SaaS, containers) you can buy and deploy, **billed through your AWS bill**, often pay-as-you-go.

## Report abuse

The **AWS Trust & Safety team** handles reports of AWS resources used for **abuse**: spam, port scanning, DDoS attacks, phishing or malware hosted on AWS.`,
      questions: [
        q('Where can a company buy and deploy third-party software, billed through its AWS bill?', ['AWS Marketplace', 'AWS Partner Network', 'AWS Artifact', 'AWS re:Post'], 0, '**AWS Marketplace** sells third-party software, billed via AWS.'),
        q('A company wants a certified consulting firm to help it migrate to AWS. Where should it look?', ['AWS Partner Network', 'AWS Marketplace', 'AWS Trust & Safety', 'AWS Knowledge Center'], 0, 'Consulting partners are part of the **AWS Partner Network**.'),
        q('Which AWS team should be contacted if AWS resources are being used to send spam or attack other systems?', ['AWS Trust & Safety', 'AWS Concierge Support', 'AWS Professional Services', 'The Technical Account Manager'], 0, 'The **Trust & Safety** team handles abuse reports.'),
        q('Where can users ask technical questions and get answers from the community and AWS experts?', ['AWS re:Post', 'AWS Artifact', 'AWS Budgets', 'AWS Organizations'], 0, '**re:Post** is the community Q&A site.'),
        q('Which resource answers the most frequent questions customers ask AWS Support?', ['AWS Knowledge Center', 'AWS Marketplace', 'AWS Cost Explorer', 'AWS Pricing Calculator'], 0, 'The **Knowledge Center** collects answers to common questions.'),
        q('Which provides guides, strategies and patterns for migration and modernisation projects?', ['AWS Prescriptive Guidance', 'AWS Health Dashboard', 'AWS Billing Conductor', 'Amazon Inspector'], 0, '**Prescriptive Guidance** offers vetted strategies and patterns.'),
      ],
    }),
    checkpoint({
      id: 'clf-billing-checkpoint',
      title: 'Checkpoint: Billing, Pricing and Support',
      system: 'Treasury Certification Gate',
      skills: ['aws-billing'],
      brief: `**ARIA:** Exam-style scenarios on paying, tracking and getting help.`,
      lesson: `## Before you start

- On-Demand: no commitment. Savings Plans / RIs: 1–3 years, up to ~72%. Spot: up to ~90%, can be interrupted. Dedicated Hosts: BYOL.
- Pricing Calculator = estimate. Cost Explorer = analyse and forecast. Budgets = alerts. CUR = most detail.
- Business: 24/7, < 1 hour, all Trusted Advisor. Enterprise On-Ramp: < 30 min, pool of TAMs. Enterprise: < 15 min, designated TAM.`,
      questions: [
        q('A company\'s web servers run steadily all year, but it may change instance families and Regions. Which option saves money with that flexibility?', ['Standard Reserved Instances', 'Compute Savings Plans', 'Spot Instances', 'Dedicated Hosts'], 1, 'Compute Savings Plans apply across families, sizes and Regions.'),
        q('Which is a valid reason the AWS bill could increase even if no new EC2 instances were launched?', ['Inbound data transfer increased', 'Outbound data transfer to the internet increased', 'More IAM users were created', 'CloudFormation templates were edited'], 1, 'Data transfer out is charged. (IAM itself is free.)'),
        q('A company wants its Enterprise-level billing and account questions handled by dedicated specialists. Which feature provides this?', ['Concierge Support Team', 'AWS Trust & Safety', 'AWS re:Post', 'AWS Marketplace'], 0, 'The **Concierge Support Team** handles billing and account questions for Enterprise customers.'),
        q('Which AWS service or tool should be used to understand which service caused last month\'s cost increase?', ['AWS Cost Explorer', 'AWS Pricing Calculator', 'AWS Artifact', 'AWS Shield'], 0, '**Cost Explorer** breaks down past costs by service, account, tag and more.'),
        q('Which statement about Spot Instances is correct?', ['They are never interrupted', 'AWS can reclaim them with a two-minute warning', 'They require a 3-year commitment', 'They cost more than On-Demand'], 1, 'Spot capacity can be reclaimed with a two-minute notice.'),
        q('Which support plan is the minimum to get a < 1 hour response when a production system is down?', ['Developer', 'Business', 'Enterprise On-Ramp', 'Basic'], 1, '**Business** support offers < 1 hour for production system down.'),
        q('Which benefit does AWS Organizations consolidated billing provide?', ['Free EC2 instances', 'Combined usage across accounts for volume pricing discounts', 'Automatic Spot Instance conversion', 'A designated Technical Account Manager'], 1, 'Usage is aggregated across all accounts for volume tiers.'),
        q('A company wants to be automatically notified when its Reserved Instance utilisation drops below 80%. Which service fits?', ['AWS Budgets', 'AWS Pricing Calculator', 'AWS Config', 'Amazon Inspector'], 0, '**Budgets** supports reservation utilisation and coverage budgets with alerts.'),
      ],
    }),
  ],
};
