// SAA-C03 Domain 2: Design Resilient Architectures (26% of the exam).
import type { Deck } from '../../../game/types';
import { checkpoint, lesson, q } from '../kit';

export const saaResilient: Deck = {
  id: 'saa-resilient',
  name: 'Resilient Architectures',
  subtitle: 'Domain 2 · 26% of the exam',
  outcome: 'Design systems that survive failures, absorb spikes and recover from disasters on schedule.',
  hue: 140,
  domain: 'saa-d2',
  levels: [
    lesson({
      id: 'saa-ha-scaling',
      title: 'Highly Available Compute',
      system: 'Redundant Reactors',
      skills: ['aws-architecture', 'aws-compute'],
      brief: `**ARIA:** Any one server, any one data centre, can fail at any moment. Design so that when it happens, nobody outside notices.`,
      lesson: `## The building blocks

- **Multiple AZs** for every tier. An Auto Scaling group across at least two AZs; a load balancer in front.
- **ELB health checks** on the Auto Scaling group: instances failing the app's health check are replaced, not just ones whose hardware fails.
- **Stateless servers:** keep session state out of the instance (in **ElastiCache** or **DynamoDB**), so any instance can serve any user and instances can be replaced freely. ALB **sticky sessions** work, but tie users to one instance.

## Auto Scaling policies

| Policy | Behaviour |
|---|---|
| **Target tracking** | Keep a metric at a target (average CPU 50%, requests per target 1000). The default choice. |
| **Step scaling** | Add or remove amounts based on how far an alarm is breached |
| **Scheduled** | Scale at known times (every weekday at 8 a.m.) |
| **Predictive** | Uses machine learning on history to scale **ahead of** recurring daily or weekly patterns |

**Warm pools** keep pre-initialised instances ready for apps that start slowly. A **lifecycle hook** runs actions while instances launch or terminate (for example, draining logs).

## Load balancer choices

- **ALB:** HTTP/HTTPS, path and host routing, Lambda targets, authentication, WebSockets.
- **NLB:** TCP/UDP/TLS, ultra-low latency, **static IP per AZ** (Elastic IPs possible), preserves the client IP, for PrivateLink.
- **GWLB:** inserts third-party appliances (firewalls, IDS) transparently.
- **Cross-zone load balancing** spreads traffic evenly across all instances in all AZs.`,
      questions: [
        q('Users are logged out whenever Auto Scaling terminates an instance. How should this be fixed?', ['Disable scale-in', 'Store session state in ElastiCache or DynamoDB so the web tier is stateless', 'Use bigger instances', 'Use instance store for sessions'], 1, 'External session state makes instances replaceable.'),
        q('Traffic grows every weekday at 9 a.m. and new instances take 10 minutes to start. Which scaling feature helps most?', ['Target tracking only', 'Predictive or scheduled scaling to add capacity ahead of the peak', 'Manual scaling', 'Reducing the maximum capacity'], 1, 'Scaling ahead of a known pattern avoids the start-up lag.'),
        q('An application must keep average CPU at 50% across its fleet. Which policy is simplest?', ['Step scaling', 'Target tracking scaling', 'Scheduled scaling', 'Simple scaling with cooldowns'], 1, 'Target tracking maintains a metric at a target value.'),
        q('A TCP application needs a load balancer with static IP addresses that partners can allow-list. Which should be used?', ['Application Load Balancer', 'Network Load Balancer', 'Classic Load Balancer', 'Gateway Load Balancer'], 1, 'NLBs offer a static IP (or Elastic IP) per AZ.'),
        q('Instances stay in service even though the application on them returns HTTP 500 errors. What should be changed?', ['Use ELB health checks for the Auto Scaling group', 'Increase the instance size', 'Add a NAT gateway', 'Turn on detailed monitoring only'], 0, 'With ELB health checks, Auto Scaling replaces instances that fail the application check.'),
        q('A company must route all incoming traffic through a fleet of third-party firewall appliances. Which load balancer fits?', ['Gateway Load Balancer', 'Application Load Balancer', 'Network Load Balancer', 'Route 53'], 0, 'GWLB inserts virtual appliances into the traffic path.'),
      ],
    }),
    lesson({
      id: 'saa-decoupling',
      title: 'Decoupled by Design',
      system: 'Pressure Valves',
      skills: ['aws-architecture', 'aws-operations'],
      brief: `**ARIA:** When a downstream system slows down, does your front end fall over too? Not if a queue sits between them. The exam loves this pattern.`,
      lesson: `## Amazon SQS in depth

| | Standard queue | FIFO queue |
|---|---|---|
| Throughput | Nearly unlimited | High (up to thousands per second, more with high-throughput mode) |
| Ordering | Best effort | **Strict order** (per message group) |
| Delivery | **At least once** (duplicates possible) | **Exactly-once processing** (deduplication) |

- **Visibility timeout:** after a consumer receives a message, it's hidden for this long; if not deleted in time, it reappears for another consumer. Set it longer than processing takes.
- **Dead-letter queue (DLQ):** messages that fail too many times (\`maxReceiveCount\`) move here for inspection.
- **Long polling** (up to 20 s) cuts empty responses and cost.
- **Delay queues** postpone delivery; messages are kept up to 14 days.
- Scale consumers with Auto Scaling on **queue depth** (ApproximateNumberOfMessagesVisible, per instance).

## Fan-out

**SNS → several SQS queues**: one event, many independent consumers, each with its own queue and pace. SNS also has **FIFO topics** and **message filtering**.

## Events and workflows

- **EventBridge:** rules route events by content to targets; schemas, archive and replay; scheduled rules; SaaS integrations.
- **Step Functions:** orchestrate multi-step processes with retries, error handling, waits, parallel branches and human approval steps. **Standard** workflows run up to a year; **Express** for high-volume, short ones.
- **Lambda asynchronous invocation** retries and can send failures to a DLQ or **on-failure destination**.

## Why it's resilient

A queue **absorbs spikes**, survives consumer failures (messages wait), and lets each side scale independently.`,
      questions: [
        q('Orders must be processed exactly once and in the order they were placed. Which SQS queue type fits?', ['Standard queue', 'FIFO queue', 'A delay queue only', 'A dead-letter queue'], 1, 'FIFO queues guarantee ordering and deduplication.'),
        q('Messages are processed twice because processing takes 2 minutes but the visibility timeout is 30 seconds. What should be changed?', ['Increase the visibility timeout above the processing time', 'Switch to long polling', 'Decrease the retention period', 'Use SNS instead'], 0, 'If the timeout expires before deletion, the message becomes visible again.'),
        q('One "order placed" event must trigger billing, shipping and analytics independently. Which pattern fits?', ['One SQS queue shared by all three consumers', 'SNS topic fanning out to three SQS queues', 'Three separate API calls from the web tier', 'A single Lambda doing all three'], 1, 'SNS-to-SQS fan-out gives each consumer its own queue.'),
        q('Some messages always fail processing and block retries forever. What should be configured?', ['A dead-letter queue with a maxReceiveCount', 'A longer retention period', 'A FIFO queue', 'Short polling'], 0, 'After too many receives, failing messages move to the DLQ.'),
        q('A loan application process has several steps, retries, and a manual approval stage that can take days. Which service fits?', ['Amazon SQS alone', 'AWS Step Functions (Standard workflow)', 'Amazon SNS', 'AWS Lambda alone'], 1, 'Step Functions orchestrates long-running workflows with waits and approvals.'),
        q('How should a fleet of EC2 workers scale to keep up with an SQS queue?', ['On CPU only', 'On queue depth (messages visible per instance)', 'On the number of SNS topics', 'Manually'], 1, 'Queue backlog per instance reflects the actual workload.'),
      ],
    }),
    lesson({
      id: 'saa-db-resilience',
      title: 'Databases That Survive',
      system: 'Memory Banks',
      skills: ['aws-databases', 'aws-architecture'],
      brief: `**ARIA:** The database is the hardest thing to make resilient, and the exam knows it. Multi-AZ or read replica? Aurora Global or DynamoDB global tables? Learn the difference precisely.`,
      lesson: `## Amazon RDS

| | **Multi-AZ** (instance deployment) | **Read replicas** |
|---|---|---|
| Purpose | **High availability** | **Read scaling** (and DR if cross-Region) |
| Replication | **Synchronous** to a standby in another AZ | **Asynchronous** |
| Standby readable? | No (failover only) | Yes |
| Failover | **Automatic**, same endpoint, ~1–2 minutes | **Manual promotion** |
| Cross-Region | No | Yes |

A **Multi-AZ DB cluster** (MySQL/PostgreSQL) has **two readable standbys** and faster failover.

**Backups:** automated backups with **point-in-time recovery** (retention up to 35 days), plus manual snapshots kept until deleted. **RDS Proxy** pools connections and makes failovers faster for applications.

## Amazon Aurora

- Storage keeps **six copies across three AZs**, self-healing.
- Up to **15 Aurora Replicas**, sharing the storage, with failover usually under 30 seconds.
- **Aurora Global Database:** one primary Region, up to several secondary Regions with typically **under 1 second** replication; promote a secondary in about a minute for disaster recovery.
- **Aurora Serverless v2** scales capacity automatically.
- **Backtrack** (MySQL) rewinds the database without restoring from a backup.

## Amazon DynamoDB

- Data is replicated across **three AZs** automatically.
- **Global tables:** **multi-Region, multi-active** (read and write in every Region).
- **Point-in-time recovery** (to any second in the last 35 days) and on-demand backups.

## ElastiCache

Use Redis OSS/Valkey with **Multi-AZ and automatic failover** (replicas in another AZ) when the cache must survive an AZ failure.`,
      questions: [
        q('A production RDS database must fail over automatically if its AZ fails. What should be enabled?', ['A read replica in the same AZ', 'Multi-AZ deployment', 'Automated backups only', 'A larger instance class'], 1, 'Multi-AZ keeps a synchronous standby and fails over automatically.'),
        q('Reporting queries are slowing down an RDS primary. What is the best fix?', ['Enable Multi-AZ and query the standby', 'Create read replicas and send reporting queries to them', 'Increase backup retention', 'Use a NAT gateway'], 1, 'Read replicas serve read traffic; a Multi-AZ instance standby isn\'t readable.'),
        q('A global application needs its relational database readable in three Regions with under 1 second replication, and fast Regional failover. Which fits?', ['RDS Multi-AZ', 'Aurora Global Database', 'A single Aurora cluster', 'DynamoDB on-demand'], 1, 'Aurora Global Database replicates across Regions with typically sub-second lag.'),
        q('Users in Europe and the US must both write to the same table with low latency. Which service supports multi-Region, multi-active writes?', ['RDS read replicas', 'DynamoDB global tables', 'Aurora Replicas', 'ElastiCache Memcached'], 1, 'Global tables replicate writes between Regions in both directions.'),
        q('A developer deleted rows from an RDS database 20 minutes ago. What restores the data with the least loss?', ['Point-in-time recovery to just before the deletion', 'Restoring last week\'s snapshot', 'Promoting a read replica', 'Rebooting with failover'], 0, 'Automated backups allow restore to any second within the retention period.'),
        q('Hundreds of Lambda functions open too many connections to an RDS database during spikes. What helps?', ['Amazon RDS Proxy', 'A larger NAT gateway', 'Multi-AZ', 'S3 Transfer Acceleration'], 0, 'RDS Proxy pools and shares connections.'),
      ],
    }),
    lesson({
      id: 'saa-disaster-recovery',
      title: 'Disaster Recovery',
      system: 'Lifeboats',
      skills: ['aws-architecture'],
      brief: `**ARIA:** A whole Region goes dark. How long until ground control is back (RTO), and how much data is lost (RPO)? You choose, and you pay for, the answer.`,
      lesson: `## Two numbers

- **RPO (Recovery Point Objective):** how much **data** you can afford to lose, measured in time. RPO 1 hour = lose at most the last hour.
- **RTO (Recovery Time Objective):** how long until you're **back up**.

Smaller numbers cost more.

## The four DR strategies (cheapest → fastest)

| Strategy | What runs in the DR Region | RPO / RTO |
|---|---|---|
| **Backup and restore** | Nothing; backups are copied there | Hours / hours (24h+ possible) |
| **Pilot light** | **Core data live** (replicated databases); servers off or tiny, provisioned from IaC when needed | Minutes / tens of minutes |
| **Warm standby** | A **scaled-down but fully working** copy, scaled up on failover | Seconds–minutes / minutes |
| **Multi-site active/active** | Full production in both Regions, serving traffic | Near zero / near zero |

## Tools

- **AWS Backup:** central backup plans, **cross-Region and cross-account copies**, **Vault Lock** (backups nobody can delete).
- **AWS Elastic Disaster Recovery (DRS):** continuous block-level replication of servers into a low-cost staging area; launch recovered instances in minutes.
- **S3 Cross-Region Replication**, **Aurora Global Database**, **DynamoDB global tables** for data.
- **Route 53 failover routing** + health checks, or **Global Accelerator**, to move traffic.
- **CloudFormation / CDK** to rebuild infrastructure quickly and identically.

## Test it

A DR plan that has never been tested doesn't work. Run game days; use **AWS Fault Injection Service** to inject failures safely.`,
      questions: [
        q('A company can tolerate losing up to 4 hours of data. Which metric is this?', ['RTO', 'RPO', 'SLA', 'MTTR'], 1, 'RPO is the acceptable data loss.'),
        q('A company needs the lowest-cost DR strategy and can accept a recovery time of a day. Which fits?', ['Multi-site active/active', 'Warm standby', 'Backup and restore', 'Pilot light'], 2, 'Backup and restore is cheapest, with the longest RTO.'),
        q('A DR design keeps the database replicating to the second Region, while application servers are only launched during a disaster. Which strategy is this?', ['Backup and restore', 'Pilot light', 'Warm standby', 'Active/active'], 1, 'Pilot light keeps core data live and the rest off until needed.'),
        q('A company needs an RTO of minutes and runs a smaller, fully functional copy of production in another Region. Which strategy is this?', ['Pilot light', 'Warm standby', 'Backup and restore', 'Cold standby'], 1, 'Warm standby runs a scaled-down but working environment.'),
        q('Backups must be copied to another account and Region, and must be impossible to delete, even by administrators. What should be used?', ['AWS Backup with cross-account copy and Vault Lock', 'Manual EBS snapshots', 'S3 Standard-IA', 'Amazon Data Lifecycle Manager only'], 0, 'AWS Backup handles cross-account/Region copies; Vault Lock makes them immutable.'),
        q('A company wants to continuously replicate on-premises servers to AWS and recover them within minutes. Which service fits?', ['AWS Elastic Disaster Recovery', 'AWS DataSync', 'AWS Snowball Edge', 'Amazon S3 Glacier'], 0, 'Elastic Disaster Recovery replicates servers continuously for fast recovery.'),
      ],
    }),
    lesson({
      id: 'saa-global-routing',
      title: 'Routing Around Failure',
      system: 'Navigation Beacons',
      skills: ['aws-networking', 'aws-architecture'],
      brief: `**ARIA:** Two Regions are running. Now users need to be sent to the right one, and away from a broken one. That's DNS and the edge network's job.`,
      lesson: `## Route 53 routing policies

| Policy | Use it for |
|---|---|
| **Simple** | One resource (or several values, chosen randomly, no health checks) |
| **Weighted** | Split traffic by percentage: canary releases, A/B tests, blue/green |
| **Latency-based** | Send each user to the Region with the lowest latency |
| **Failover** | Active/passive: primary while healthy, secondary when not |
| **Geolocation** | By the user's **location** (continent, country, state): content rights, language, compliance |
| **Geoproximity** | By distance, with a **bias** to grow or shrink a Region's share (Traffic Flow) |
| **Multivalue answer** | Up to 8 healthy records returned, like simple DNS load balancing with health checks |
| **IP-based** | By the client's IP range |

- **Health checks** watch endpoints (or CloudWatch alarms, or other health checks) and remove unhealthy records.
- **Alias records** point at AWS resources (ALB, CloudFront, S3 website, API Gateway): free queries, and they work at the **zone apex** (\`example.com\`), unlike CNAMEs.
- DNS changes depend on **TTL**: clients may cache the old answer until it expires.

## Global Accelerator vs CloudFront

| | AWS Global Accelerator | Amazon CloudFront |
|---|---|---|
| What | Routes TCP/UDP over the AWS backbone to the best healthy endpoint | Caches HTTP(S) content at the edge |
| Addresses | **Two static anycast IPs** | Domain name |
| Failover | **Instant** (no DNS caching), health-based | Origin failover groups |
| Good for | Gaming, VoIP, IoT, non-HTTP, fast Regional failover | Websites, APIs, video, static assets |`,
      questions: [
        q('A company wants to send 10% of users to a new version of its application. Which routing policy fits?', ['Failover', 'Weighted', 'Geolocation', 'Simple'], 1, 'Weighted routing splits traffic by percentage.'),
        q('Users in Germany must always be served from eu-central-1 for legal reasons. Which policy fits?', ['Latency-based', 'Geolocation', 'Weighted', 'Multivalue answer'], 1, 'Geolocation routes by the user\'s location; latency routing might send them elsewhere.'),
        q('Why use an alias record instead of a CNAME for example.com pointing to an ALB?', ['CNAMEs are faster', 'Alias records work at the zone apex and queries to AWS resources are free', 'Alias records can point to any IP address', 'CNAMEs don\'t support HTTPS'], 1, 'CNAMEs can\'t be used at the apex; alias records can.'),
        q('A multiplayer game uses UDP and needs fast failover between Regions without waiting for DNS caches. Which service fits?', ['Route 53 failover routing', 'AWS Global Accelerator', 'Amazon CloudFront', 'An Application Load Balancer'], 1, 'Global Accelerator uses static anycast IPs and fails over instantly.'),
        q('An active/passive setup needs traffic switched to the standby Region only when the primary is unhealthy. What should be configured?', ['Weighted routing at 50/50', 'Failover routing with health checks', 'Geoproximity with a bias', 'Simple routing'], 1, 'Failover routing uses health checks to switch to the secondary.'),
        q('After a failover, some users still reach the old Region for several minutes. What is the likely cause?', ['Health checks are disabled for everyone', 'Clients cached the old DNS answer until its TTL expired', 'Alias records don\'t support failover', 'CloudFront is caching the database'], 1, 'DNS answers are cached for their TTL; lower TTLs (or Global Accelerator) speed up failover.'),
      ],
    }),
    checkpoint({
      id: 'saa-resilient-checkpoint',
      title: 'Checkpoint: Resilient Architectures',
      system: 'Resilience Certification Gate',
      skills: ['aws-architecture', 'aws-databases'],
      brief: `**ARIA:** Associate-level scenarios on availability, decoupling and disaster recovery. Watch for RPO/RTO numbers and "least operational overhead".`,
      lesson: `## Before you start

- Multi-AZ everything; stateless web tier; ELB health checks; target tracking / predictive scaling.
- SQS (visibility timeout, DLQ, FIFO), SNS fan-out, Step Functions for workflows.
- RDS Multi-AZ = HA (sync, auto failover). Read replicas = read scaling (async). Aurora Global, DynamoDB global tables.
- Backup & restore → pilot light → warm standby → active/active. Route 53 failover, Global Accelerator.`,
      questions: [
        q('An image-processing service sometimes receives 50x normal traffic for a few minutes, and workers can\'t keep up. Requests must not be lost. What is the best design?', ['Bigger instances', 'Put uploads into an SQS queue and scale workers on queue depth', 'Reject requests during spikes', 'Use a larger load balancer'], 1, 'The queue absorbs the spike; workers drain it as they scale.'),
        q('A database needs an RPO of seconds and an RTO under 1 minute for a Regional failure, with minimal management. Which fits?', ['RDS snapshots copied nightly', 'Aurora Global Database', 'RDS Multi-AZ in one Region', 'A database on EC2 with cron backups'], 1, 'Aurora Global Database replicates in about a second and can be promoted quickly.'),
        q('Which statement about RDS Multi-AZ instance deployments is correct?', ['The standby serves read traffic', 'Replication to the standby is synchronous and failover is automatic', 'The standby is in another Region', 'It replaces the need for backups'], 1, 'Synchronous standby, automatic failover; it isn\'t readable and doesn\'t replace backups.'),
        q('A web tier runs on four instances in one AZ. What change most improves availability?', ['Use larger instances', 'Spread the Auto Scaling group across multiple AZs behind a load balancer', 'Add more instances in the same AZ', 'Turn on detailed monitoring'], 1, 'Multiple AZs protect against an AZ failure.'),
        q('Messages in an SQS queue must be processed, and messages that fail 5 times must be kept for investigation. What should be configured?', ['A DLQ with maxReceiveCount of 5', 'A FIFO queue', 'A 5-second delay queue', 'SNS message filtering'], 0, 'The redrive policy moves messages to the DLQ after 5 failed receives.'),
        q('A company wants the cheapest DR strategy that still keeps its data continuously replicated to another Region, with RTO of under an hour. Which fits?', ['Multi-site active/active', 'Pilot light', 'Backup and restore with daily snapshots', 'No DR'], 1, 'Pilot light replicates data live but keeps compute off until needed.'),
        q('A static IP is required for clients, and traffic must fail over between two Regions within seconds. Which fits?', ['Route 53 latency routing', 'AWS Global Accelerator with endpoint groups in both Regions', 'CloudFront with an S3 origin', 'A NAT gateway in each Region'], 1, 'Global Accelerator provides static IPs and near-instant failover.'),
        q('An application runs a long nightly batch process in many steps; a failed step must be retried without rerunning the whole process. Which service fits best?', ['AWS Step Functions', 'Amazon SNS', 'An EC2 cron job', 'Amazon Route 53'], 0, 'Step Functions retries individual steps and tracks state.'),
      ],
    }),
  ],
};
