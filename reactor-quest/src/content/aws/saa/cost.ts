// SAA-C03 Domain 4: Design Cost-Optimized Architectures (20% of the exam).
import type { Deck } from '../../../game/types';
import { checkpoint, lesson, q } from '../kit';

export const saaCost: Deck = {
  id: 'saa-cost',
  name: 'Cost-Optimized Architectures',
  subtitle: 'Domain 4 · 20% of the exam',
  outcome: 'Pay the least for compute, storage, networking and databases without giving up what the workload needs.',
  hue: 110,
  domain: 'saa-d4',
  levels: [
    lesson({
      id: 'saa-compute-cost',
      title: 'Paying Less for Compute',
      system: 'Fuel Efficiency',
      skills: ['aws-billing', 'aws-compute'],
      brief: `**ARIA:** Ground control's compute bill could be half what it is. The trick is matching each workload to the right way of paying.`,
      lesson: `## Matching workload to purchase option

| Workload shape | Best option |
|---|---|
| Steady 24/7 baseline | **Savings Plans** (Compute SP: any family/Region/OS, plus Fargate and Lambda; EC2 Instance SP: one family in one Region, bigger discount) or **Reserved Instances** |
| Steady, may change instance type | **Compute Savings Plans** or **Convertible RIs** |
| Fault-tolerant, flexible, interruptible | **Spot Instances** (up to 90% off) |
| Short, unpredictable, can't be interrupted | **On-Demand** |
| Needs guaranteed capacity in an AZ | **On-Demand Capacity Reservations** (combine with Savings Plans for a discount) |

## Spot, done well

- Stateless web tiers, batch, CI, big data, containers: design to be **interrupted** (2-minute notice).
- Use **many instance types and AZs** with an **Auto Scaling group with mixed instances** or **EC2 Fleet**, using the **price-capacity-optimized** allocation strategy.
- Mix: On-Demand (or Savings Plans) for the base, Spot for the rest.

## Right-size and modernise

- **AWS Compute Optimizer** recommends sizes for EC2, Auto Scaling groups, EBS, Lambda and ECS on Fargate.
- **Graviton** instances often cut cost for the same work.
- **Scale in** when idle; **stop** dev/test environments outside working hours (Instance Scheduler).
- **Serverless** (Lambda, Fargate) costs nothing when idle: ideal for spiky or low traffic.`,
      questions: [
        q('A company runs a steady baseline of EC2, Fargate and Lambda and may change instance families and Regions next year. Which option maximises savings with that flexibility?', ['EC2 Instance Savings Plans', 'Compute Savings Plans', 'Standard Reserved Instances', 'Spot Instances only'], 1, 'Compute Savings Plans cover EC2 in any family and Region, plus Fargate and Lambda.'),
        q('A nightly batch job can restart if interrupted and has flexible timing. What is the cheapest way to run it?', ['On-Demand Instances', 'Spot Instances', 'Dedicated Hosts', 'Reserved Instances for 3 years'], 1, 'Interruptible, flexible work fits Spot.'),
        q('How should a Spot-based Auto Scaling group be configured to reduce interruptions?', ['One instance type in one AZ', 'Multiple instance types and AZs with the price-capacity-optimized strategy', 'Only the newest instance type', 'A maximum price of $0.001'], 1, 'Diversifying across pools reduces interruption risk.'),
        q('A web app needs a guaranteed base of 4 instances 24/7 and handles peaks with up to 20 more. What is the most cost-effective mix?', ['20 Reserved Instances', 'Savings Plan for the base 4, Spot (or On-Demand) for peaks via Auto Scaling', 'All On-Demand', 'All Spot including the base'], 1, 'Commit to the steady base; pay flexibly for peaks.'),
        q('Development instances run 24/7 but are used only during office hours. What reduces cost most simply?', ['Buy Reserved Instances', 'Stop them outside office hours on a schedule', 'Move them to Dedicated Hosts', 'Use larger instances'], 1, 'Stopped instances don\'t incur compute charges.'),
        q('Which service recommends smaller instance types based on actual utilisation?', ['AWS Compute Optimizer', 'AWS Pricing Calculator', 'AWS Artifact', 'Amazon Inspector'], 0, 'Compute Optimizer analyses utilisation and recommends right-sizing.'),
      ],
    }),
    lesson({
      id: 'saa-storage-cost',
      title: 'Paying Less for Storage',
      system: 'Cold Storage',
      skills: ['aws-billing', 'aws-storage'],
      brief: `**ARIA:** Data piles up forever unless someone designs where it goes as it ages. That someone is you.`,
      lesson: `## S3 storage classes, with the catches

| Class | Catch |
|---|---|
| Standard-IA / One Zone-IA | **Minimum 30 days** storage charge, **128 KB minimum** billable size, **retrieval fee** |
| Glacier Instant Retrieval | Minimum 90 days; millisecond retrieval, higher retrieval cost |
| Glacier Flexible Retrieval | Minimum 90 days; minutes (expedited) to hours (standard) to 5–12 hours (bulk, free) |
| Glacier Deep Archive | Minimum **180 days**; within 12 hours (standard) or 48 hours (bulk) |
| Intelligent-Tiering | Small monitoring fee per object; **no retrieval fees**; tiers automatically. Best for **unknown or changing** access |

**Lifecycle rules:** transition by age (Standard → IA after 30 days → Glacier after 90…), **expire** old objects, delete **old non-current versions**, and **abort incomplete multipart uploads** (they cost money silently).

**S3 Storage Lens** shows usage and cost-saving opportunities across accounts.

## Block and file

- **gp2 → gp3:** about 20% cheaper per GB, with performance set separately.
- **Delete unattached EBS volumes** and **old snapshots**; use **Amazon Data Lifecycle Manager** to automate snapshot retention; **EBS Snapshots Archive** for long-term snapshots.
- **EFS lifecycle management** moves cold files to Infrequent Access / Archive classes.
- **FSx** data deduplication and compression (Windows, ONTAP).

## Pick the right service

Don't use expensive block storage where object storage fits: logs, backups and media belong in S3.`,
      questions: [
        q('Objects are read frequently for 30 days, rarely afterwards, and must be kept for 7 years with retrieval in hours acceptable. What is the most cost-effective plan?', ['Keep everything in S3 Standard', 'Lifecycle: Standard → Standard-IA after 30 days → Glacier Deep Archive later', 'S3 One Zone-IA from day one', 'EBS snapshots'], 1, 'Lifecycle transitions match cost to the aging access pattern.'),
        q('A data set has unpredictable access patterns: some objects become hot again at random. Which class minimises cost without retrieval fees?', ['S3 Standard-IA', 'S3 Intelligent-Tiering', 'S3 Glacier Flexible Retrieval', 'S3 One Zone-IA'], 1, 'Intelligent-Tiering moves objects automatically and charges no retrieval fees.'),
        q('A bucket\'s cost keeps growing even though few new objects appear. Which might be the hidden cause?', ['Incomplete multipart uploads and non-current object versions', 'Bucket policies', 'Block Public Access', 'Object Ownership settings'], 0, 'Lifecycle rules should abort incomplete uploads and expire old versions.'),
        q('Why might moving many 10 KB objects to S3 Standard-IA increase cost?', ['IA has a 128 KB minimum billable object size', 'IA doesn\'t support small objects', 'IA charges per bucket', 'IA has no durability'], 0, 'Small objects are billed as 128 KB in IA classes.'),
        q('A company uses gp2 EBS volumes everywhere. What is a quick saving with no loss of performance?', ['Migrate to gp3 and set the needed IOPS', 'Move to io2', 'Switch to instance store', 'Turn off encryption'], 0, 'gp3 is cheaper per GB with configurable performance.'),
        q('Which tool gives an organisation-wide view of S3 usage with recommendations for saving money?', ['S3 Storage Lens', 'S3 Inventory only', 'AWS Artifact', 'Amazon Macie'], 0, 'Storage Lens provides usage and activity metrics and recommendations.'),
      ],
    }),
    lesson({
      id: 'saa-network-cost',
      title: 'Paying Less for Networking',
      system: 'Traffic Tolls',
      skills: ['aws-billing', 'aws-networking'],
      brief: `**ARIA:** Data transfer is the line on the bill nobody understands. Learn where the tolls are, and how architects route around them.`,
      lesson: `## Where data transfer costs money

| Traffic | Cost |
|---|---|
| Into AWS from the internet | **Free** |
| Out to the internet | Charged per GB (the biggest one) |
| Between Regions | Charged |
| **Between AZs** in the same Region | Charged (each direction) |
| Within the same AZ, using private IPs | Free |
| **NAT gateway** | Hourly **plus per GB processed** |
| Interface endpoints | Hourly per AZ plus per GB (usually less than NAT) |
| Gateway endpoints (S3, DynamoDB) | **Free** |

## Design moves that save

- **Gateway endpoints** for S3 and DynamoDB instead of sending that traffic through a NAT gateway.
- **CloudFront** in front of S3/ALB: data out through CloudFront is cheaper than from the origin, and caching cuts origin traffic. Data from AWS origins to CloudFront is free.
- Keep **chatty components in the same AZ** where availability allows; avoid unnecessary cross-AZ replication.
- **One NAT gateway per AZ** (so traffic doesn't cross AZs to reach it), or fewer for non-critical environments.
- **Direct Connect** has lower data-transfer-out rates than the internet for large, steady volumes.
- Compress data; use **S3 Transfer Acceleration** only when it helps.

## Finding the costs

**Cost Explorer** by usage type (\`DataTransfer-Out-Bytes\`, \`NatGateway-Bytes\`), **VPC Flow Logs** to see who talks to whom, and the **Cost and Usage Report** for detail.`,
      questions: [
        q('A data processing fleet in private subnets moves 50 TB/month to and from S3 through a NAT gateway. What saves the most?', ['A second NAT gateway', 'An S3 gateway VPC endpoint', 'Larger instances', 'A public subnet for the fleet'], 1, 'Gateway endpoints are free and bypass NAT processing charges.'),
        q('Which data transfer is free?', ['Data out from EC2 to the internet', 'Data between Regions', 'Data into AWS from the internet', 'Data between AZs'], 2, 'Inbound data transfer is free.'),
        q('A website serves large downloads directly from S3 to users worldwide. How can data transfer cost be reduced?', ['Serve the downloads through CloudFront', 'Use S3 One Zone-IA', 'Enable versioning', 'Use a NAT gateway'], 0, 'CloudFront data out is cheaper, and caching reduces origin fetches.'),
        q('Instances in three AZs all use a single NAT gateway in one AZ. Besides the availability risk, what cost issue does this create?', ['Cross-AZ data transfer charges', 'No cost issue', 'Free data transfer', 'Higher EBS charges'], 0, 'Traffic from other AZs crosses AZ boundaries to reach the NAT gateway.'),
        q('A company sends hundreds of TB per month from AWS to its data centre. Which reduces data transfer cost?', ['AWS Direct Connect', 'More internet gateways', 'A Site-to-Site VPN', 'S3 Transfer Acceleration'], 0, 'Direct Connect offers lower data-transfer-out rates.'),
        q('Which tool helps identify which service is driving data transfer charges?', ['Cost Explorer grouped by usage type', 'AWS Artifact', 'AWS Shield', 'Amazon Inspector'], 0, 'Usage types such as NatGateway-Bytes reveal transfer costs.'),
      ],
    }),
    lesson({
      id: 'saa-database-cost',
      title: 'Paying Less for Databases',
      system: 'Archive Budget',
      skills: ['aws-billing', 'aws-databases'],
      brief: `**ARIA:** The database is often the most expensive thing in the account. Architects pick the cheapest engine and capacity model that still does the job.`,
      lesson: `## Capacity models

| Situation | Cost-effective choice |
|---|---|
| Steady relational workload | RDS/Aurora with **Reserved Instances** (1 or 3 years) |
| Spiky or intermittent relational | **Aurora Serverless v2** (scales down when quiet) |
| Dev/test database used in working hours | **Stop** it when idle (RDS stops for up to 7 days at a time) |
| Unpredictable DynamoDB traffic | **On-demand** capacity |
| Steady, predictable DynamoDB traffic | **Provisioned** capacity with auto scaling (and **reserved capacity**) |
| Rarely accessed DynamoDB data | **Standard-Infrequent Access** table class |

## Design moves that save

- **Cache** hot reads in ElastiCache or DAX instead of buying a bigger database.
- **Read replicas** only when reads need them; a cache may be cheaper.
- **Aurora I/O-Optimized** for I/O-heavy workloads (no per-I/O charges); **Standard** when I/O is low.
- **DynamoDB TTL** deletes expired items for free; **S3 + Athena** for cold historical data instead of keeping it in the database.
- **Storage auto scaling** for RDS avoids over-provisioning storage.
- **Graviton**-based database instances often cost less.

## Self-managed vs managed

Running a database on EC2 can look cheaper, but you pay in time: patching, backups, failover. Exam questions that ask for **least operational overhead** want the managed service.`,
      questions: [
        q('A reporting database is used only 2 hours a day at unpredictable times. Which option minimises cost with the least management?', ['A large RDS instance running 24/7', 'Aurora Serverless v2', 'RDS Multi-AZ with Reserved Instances', 'A database on EC2'], 1, 'Serverless v2 scales down when idle.'),
        q('A DynamoDB table has steady, predictable traffic around the clock. Which capacity mode is usually cheaper?', ['On-demand', 'Provisioned with auto scaling', 'Either costs the same', 'Global tables'], 1, 'Provisioned capacity is cheaper for steady, predictable loads.'),
        q('A new app\'s DynamoDB traffic is unknown and spiky. Which capacity mode fits?', ['Provisioned with a fixed capacity', 'On-demand', 'Reserved capacity', 'DAX only'], 1, 'On-demand needs no capacity planning and scales instantly.'),
        q('A production RDS MySQL database will run steadily for 3 years. How can its cost be cut most?', ['Reserved DB instances for 3 years', 'Stopping it nightly', 'Spot Instances', 'Switching to Memcached'], 0, 'Reserved instances give the biggest discount for steady usage.'),
        q('Old session records in DynamoDB should be removed after 7 days without paying for delete operations. What should be used?', ['DynamoDB TTL', 'A nightly scan-and-delete Lambda', 'DynamoDB Streams', 'A GSI'], 0, 'TTL deletes expired items at no extra cost.'),
        q('A read-heavy app keeps adding RDS read replicas. Which alternative is often cheaper for repeated identical queries?', ['Caching results in ElastiCache', 'Multi-AZ', 'Larger storage', 'Cross-Region replicas'], 0, 'A cache can serve repeated reads more cheaply than more replicas.'),
      ],
    }),
    lesson({
      id: 'saa-cost-governance',
      title: 'Cost-Aware Architecture',
      system: 'Budget Office',
      skills: ['aws-billing', 'aws-architecture'],
      brief: `**ARIA:** Saving once is easy; staying cheap needs visibility, guardrails and designs that scale down. The final lesson ties it together.`,
      lesson: `## Visibility

- **Cost allocation tags** (activate them in Billing) + a **tagging strategy** enforced by **tag policies** and SCPs.
- **Cost Explorer** for trends and Savings Plans/RI **recommendations and utilisation**.
- **AWS Budgets** with alerts and **budget actions** (apply an IAM policy or SCP, stop instances).
- **Cost Anomaly Detection** for surprises.
- **Cost and Usage Report / Data Exports** + Athena + QuickSight for detailed analysis.

## Organisation-level savings

- **Consolidated billing** pools usage for volume tiers and shares RI and Savings Plans discounts across accounts.
- Central purchase of Savings Plans in the management or a payer account.

## Architectures that are cheap by design

- **Scale with demand:** Auto Scaling, serverless, queues that let workers scale in.
- **Managed and serverless** services remove idle capacity and admin time.
- **Decouple** so each part scales on its own.
- **Choose the cheapest storage tier** the access pattern allows, with lifecycle rules.
- **Avoid unnecessary data movement** (endpoints, same-AZ chatty traffic, CloudFront).
- **Turn off** what isn't used; delete what isn't needed.

## Trade-offs

Cost optimisation never means breaking requirements: if a question says "must survive an AZ failure", the cheapest *valid* answer is still Multi-AZ. Read the requirements first, then pick the cheapest design that meets all of them.`,
      questions: [
        q('Finance must see costs per application across 20 accounts. What is the best approach?', ['Activate cost allocation tags, enforce a tagging policy, and report in Cost Explorer', 'Create one account per employee', 'Use AWS Artifact', 'Ask each team for a spreadsheet'], 0, 'Enforced tags plus Cost Explorer give per-application costs across accounts.'),
        q('A company wants development accounts to stop launching instances automatically once their monthly budget is exceeded. What should be used?', ['AWS Budgets with a budget action that applies a restrictive policy', 'Cost Explorer forecasts', 'Trusted Advisor', 'AWS Config'], 0, 'Budget actions can apply IAM policies or SCPs, or stop instances, when thresholds are crossed.'),
        q('A requirement says the app must tolerate an AZ failure. Which is the cheapest VALID option?', ['One large instance in one AZ', 'A small Auto Scaling group spread across two AZs', 'A single Spot Instance', 'An instance with instance store'], 1, 'The cheapest answer must still meet the availability requirement.'),
        q('How does consolidated billing reduce costs?', ['It gives free instances', 'It pools usage for volume pricing and shares RI/Savings Plans discounts across accounts', 'It converts all instances to Spot', 'It removes data transfer charges'], 1, 'Pooled usage and shared discounts lower the total bill.'),
        q('Which service alerts on unexpected spending spikes using machine learning?', ['AWS Cost Anomaly Detection', 'AWS Budgets fixed alerts only', 'Amazon GuardDuty', 'AWS Health'], 0, 'Cost Anomaly Detection finds unusual spend patterns.'),
        q('An API receives traffic only a few times an hour. Which design is most cost-effective?', ['Two always-on EC2 instances behind an ALB', 'API Gateway with Lambda', 'An EKS cluster', 'Dedicated Hosts'], 1, 'Serverless costs nothing when idle.'),
      ],
    }),
    checkpoint({
      id: 'saa-cost-checkpoint',
      title: 'Checkpoint: Cost-Optimized Architectures',
      system: 'Budget Certification Gate',
      skills: ['aws-billing', 'aws-architecture'],
      brief: `**ARIA:** Associate-level cost scenarios. Meet every requirement first, then choose the cheapest design.`,
      lesson: `## Before you start

- Savings Plans/RIs for steady, Spot for interruptible, On-Demand for unpredictable, serverless for idle-heavy.
- S3 lifecycle and Intelligent-Tiering; minimum durations and sizes; gp2 → gp3; delete what's unused.
- Gateway endpoints instead of NAT for S3/DynamoDB; CloudFront for egress; mind cross-AZ traffic.
- Aurora Serverless v2, DynamoDB on-demand vs provisioned, caching, TTL. Tags, Budgets, Cost Explorer.`,
      questions: [
        q('A CI system runs hundreds of short build jobs a day; jobs can be retried. Which compute is most cost-effective?', ['On-Demand Instances', 'Spot Instances (or Fargate Spot) for the build agents', 'Dedicated Hosts', '3-year Reserved Instances'], 1, 'Retriable, short jobs suit Spot.'),
        q('Logs must be kept 1 year for audits and are almost never read after the first week. Retrieval within 12 hours is acceptable. Which is cheapest?', ['S3 Standard for a year', 'A lifecycle rule moving logs to S3 Glacier Deep Archive after the first week', 'EBS volumes', 'S3 One Zone-IA forever'], 1, 'Deep Archive is the cheapest storage, and a 1-year retention easily covers its 180-day minimum storage charge.'),
        q('A private application pulls large datasets from DynamoDB through a NAT gateway. How can costs be reduced?', ['A DynamoDB gateway endpoint', 'An interface endpoint for EC2', 'A bigger NAT gateway', 'VPC peering'], 0, 'DynamoDB gateway endpoints are free and bypass NAT charges.'),
        q('A startup\'s relational database sits idle most nights and weekends but must handle bursts during the day. What is the most cost-effective managed choice?', ['Aurora Serverless v2', 'RDS with 3-year reserved instances sized for the peak', 'A database on Dedicated Hosts', 'DynamoDB global tables'], 0, 'Serverless v2 scales down when idle and up for bursts.'),
        q('Compute Optimizer shows most instances use under 10% CPU. What should the architect do?', ['Right-size to smaller instance types', 'Buy Reserved Instances for the current sizes', 'Add more instances', 'Move to Dedicated Hosts'], 0, 'Right-size first, then commit with Savings Plans.'),
        q('A company stores 500 TB in S3 Standard; analysis shows 80% hasn\'t been read in 6 months but any of it might be needed instantly. Which change saves the most while keeping millisecond access?', ['Move the cold data to S3 Glacier Instant Retrieval (or use Intelligent-Tiering)', 'Move it to Glacier Deep Archive', 'Delete it', 'Move it to EBS'], 0, 'Glacier Instant Retrieval keeps millisecond access at much lower storage cost.'),
        q('An organisation buys Savings Plans in one account. How do other accounts benefit?', ['They can\'t', 'With consolidated billing in AWS Organizations, discounts are shared across accounts', 'Only accounts in the same Region', 'Only if they use Spot'], 1, 'Savings Plans discounts apply across the consolidated billing family (sharing can be configured).'),
        q('Which is the most cost-effective way to serve a static website?', ['S3 with CloudFront', 'Two EC2 instances with an ALB', 'An EKS cluster', 'RDS with a web front end'], 0, 'S3 plus CloudFront needs no servers and caches globally.'),
      ],
    }),
  ],
};
