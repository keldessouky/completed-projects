// AWS Certified Solutions Architect – Associate (SAA-C03): the next step after
// Cloud Practitioner. Its floors follow the exam guide's four design domains.
import type { Path } from '../../game/types';
import { bankFor } from './kit';
import { saaAccess } from './saa/access';
import { saaCost } from './saa/cost';
import { saaPerformance } from './saa/performance';
import { saaProtect } from './saa/protect';
import { saaResilient } from './saa/resilient';

const d1 = bankFor('saa', 'saa-d1');
const d2 = bankFor('saa', 'saa-d2');
const d3 = bankFor('saa', 'saa-d3');
const d4 = bankFor('saa', 'saa-d4');

export const SAA: Path = {
  id: 'aws-saa',
  name: 'AWS Certified Solutions Architect – Associate',
  short: 'Solutions Architect',
  tagline: 'Design secure, resilient, fast and cost-effective systems on AWS. Take it after Cloud Practitioner.',
  icon: '🏛',
  exam: {
    code: 'SAA-C03',
    name: 'AWS Certified Solutions Architect – Associate',
    level: 'Associate',
    questions: 65,
    minutes: 130,
    pass: 720,
    domains: [
      { id: 'saa-d1', name: 'Design Secure Architectures', weight: 30 },
      { id: 'saa-d2', name: 'Design Resilient Architectures', weight: 26 },
      { id: 'saa-d3', name: 'Design High-Performing Architectures', weight: 24 },
      { id: 'saa-d4', name: 'Design Cost-Optimized Architectures', weight: 20 },
    ],
    guide: 'https://aws.amazon.com/certification/certified-solutions-architect-associate/',
  },
  decks: [saaAccess, saaProtect, saaResilient, saaPerformance, saaCost],
  bank: [
    // ------------------------------------------------------------ Domain 1: secure
    d1(1, 'A company must give EC2 instances in private subnets access to S3 without traversing the internet, and restrict the bucket to that access path only. Which TWO steps are needed? (Choose TWO.)', ['Create an S3 gateway VPC endpoint', 'Add a bucket policy that denies requests not coming through the endpoint (aws:SourceVpce)', 'Attach an internet gateway to the private subnets', 'Make the bucket public', 'Create a NAT gateway'], [0, 1], 'The gateway endpoint gives the private path; the bucket policy enforces it.'),
    d1(2, 'Which actions improve the security of an application\'s database credentials? (Choose TWO.)', ['Store them in AWS Secrets Manager with automatic rotation', 'Grant the application an IAM role that can read only that secret', 'Commit them to the source repository encrypted with Base64', 'Bake them into the AMI', 'Share them over email with the operations team'], [0, 1], 'Secrets Manager rotates them, and least-privilege role access keeps them off servers.'),
    d1(3, 'An organisation wants to prevent anyone in member accounts from disabling AWS CloudTrail and from using unapproved Regions. What is the most effective approach?', ['SCPs attached to the OUs', 'IAM policies in each account', 'AWS Config rules with notifications', 'CloudWatch alarms'], 0, 'SCPs are preventive guardrails that no member-account identity can bypass.'),
    d1(4, 'A company runs a public web application behind an ALB and wants protection from SQL injection and from IPs sending excessive requests. Which TWO features should it use? (Choose TWO.)', ['AWS WAF managed rule group for SQL injection', 'AWS WAF rate-based rule', 'Security group deny rules', 'Amazon Macie', 'S3 Object Lock'], [0, 1], 'WAF managed rules block SQL injection; rate-based rules throttle abusive IPs.'),
    d1(5, 'A mobile app must let users upload directly to S3, each only to their own prefix. Which design is most secure?', ['Cognito identity pool with an IAM role whose policy uses the identity ID in the resource path', 'One shared IAM user\'s keys embedded in the app', 'A public bucket with obscure object names', 'Presigned URLs valid for one year'], 0, 'Identity pool roles can scope access per user with policy variables.'),
    d1(6, 'Data in an existing unencrypted RDS for PostgreSQL instance must be encrypted at rest with minimal downtime. Which approach works?', ['Modify the instance to enable encryption', 'Create an encrypted snapshot copy and restore it, then switch over (or use DMS for minimal downtime)', 'Enable SSL connections', 'Create an encrypted read replica of the unencrypted primary'], 1, 'Encryption can\'t be enabled in place; restore from an encrypted copy (DMS can keep downtime low).'),
    d1(7, 'Which are characteristics of security groups? (Choose TWO.)', ['They are stateful', 'They support allow rules only', 'They are evaluated at the subnet boundary', 'They support explicit deny rules', 'They are stateless'], [0, 1], 'Security groups are stateful and allow-only, attached to ENIs.'),
    d1(8, 'A partner must access an internal service in a company\'s VPC privately, without VPC peering and without exposing other resources. Which fits?', ['AWS PrivateLink (endpoint service behind an NLB)', 'An internet-facing ALB', 'VPC peering with restrictive security groups', 'A NAT gateway'], 0, 'PrivateLink exposes exactly one service, one-way.'),
    d1(9, 'A security team must be alerted when an IAM access key is used from an unusual location. Which service detects this?', ['Amazon GuardDuty', 'AWS Config', 'Amazon Inspector', 'AWS Trusted Advisor'], 0, 'GuardDuty flags anomalous credential use.'),
    // ------------------------------------------------------------ Domain 2: resilient
    d2(1, 'An application must remain available if an Availability Zone fails. Which TWO design choices are required? (Choose TWO.)', ['Run the Auto Scaling group across at least two AZs behind a load balancer', 'Use RDS Multi-AZ for the database', 'Use a larger instance type', 'Store sessions on the instances\' local disk', 'Use a single NAT gateway for all AZs'], [0, 1], 'Both compute and database tiers must span AZs.'),
    d2(2, 'A company needs RPO of 15 minutes and RTO of 1 hour for an EC2-based app in another Region, at the lowest cost. Which strategy fits?', ['Multi-site active/active', 'Pilot light with continuously replicated data and IaC to launch compute', 'Backup and restore with weekly backups', 'No DR, rely on Multi-AZ'], 1, 'Pilot light meets minutes-level RPO and around-an-hour RTO cheaply.'),
    d2(3, 'An order service must not lose messages if the processing tier is down for an hour. Which design fits?', ['Synchronous HTTP calls from the web tier', 'An SQS queue between the tiers', 'An SNS topic with no subscribers', 'Writing orders to instance store'], 1, 'SQS keeps messages (up to 14 days) until processed.'),
    d2(4, 'Which statements about Amazon Aurora are correct? (Choose TWO.)', ['Storage is replicated six ways across three AZs', 'It supports up to 15 low-latency read replicas', 'It only supports Oracle', 'Failover requires restoring from a snapshot', 'It can\'t span Regions'], [0, 1], 'Aurora stores six copies across three AZs and supports up to 15 replicas; Global Database spans Regions.'),
    d2(5, 'A web application on EC2 must fail over to a static maintenance page in S3 if all instances are unhealthy. What should be configured?', ['Route 53 failover routing with health checks, secondary pointing to the S3 website', 'A second ALB in the same AZ', 'S3 Cross-Region Replication', 'A NAT gateway'], 0, 'Failover routing switches to the secondary record when the primary\'s health check fails.'),
    d2(6, 'An Auto Scaling group must replace instances whose application stops responding, even though EC2 status checks pass. What is needed?', ['ELB health checks on the Auto Scaling group', 'Detailed monitoring', 'A larger warm pool', 'A scheduled action'], 0, 'ELB health checks detect application failures.'),
    d2(7, 'A company must ensure its DynamoDB data can be restored to any second in the last month after accidental writes. What should it enable?', ['Point-in-time recovery', 'DynamoDB Streams only', 'Global tables', 'DAX'], 0, 'PITR restores to any second within the last 35 days.'),
    d2(8, 'Which services help decouple application components? (Choose TWO.)', ['Amazon SQS', 'Amazon EventBridge', 'Amazon EBS', 'AWS KMS', 'Amazon Route 53 Resolver'], [0, 1], 'Queues and event buses let components communicate asynchronously.'),
    // ------------------------------------------------------------ Domain 3: high-performing
    d3(1, 'A read-heavy application suffers from slow database reads of the same data. Which TWO options improve read performance? (Choose TWO.)', ['Add an ElastiCache cache in front of the database', 'Add RDS read replicas and route reads to them', 'Enable Multi-AZ and read from the standby', 'Reduce the instance size', 'Turn off automated backups'], [0, 1], 'Caching and read replicas both offload reads; a Multi-AZ instance standby isn\'t readable.'),
    d3(2, 'A media company uploads 5 GB video files from many countries to one bucket. Which TWO features speed up uploads? (Choose TWO.)', ['Multipart upload', 'S3 Transfer Acceleration', 'S3 Object Lock', 'S3 Glacier Deep Archive', 'Bucket versioning'], [0, 1], 'Multipart parallelises; Transfer Acceleration uses edge locations.'),
    d3(3, 'A stateless API has unpredictable traffic from zero to thousands of requests per second. Which architecture scales with the least management?', ['API Gateway with AWS Lambda', 'EC2 instances with manual scaling', 'A single large EC2 instance', 'Dedicated Hosts'], 0, 'API Gateway and Lambda scale automatically from zero.'),
    d3(4, 'An application needs a shared file system for hundreds of Linux containers across AZs with elastic capacity. Which fits?', ['Amazon EFS', 'Amazon EBS gp3', 'Instance store', 'FSx for Windows File Server'], 0, 'EFS is elastic, multi-AZ NFS.'),
    d3(5, 'Streaming data must be delivered to Amazon Redshift every minute with no servers to manage. Which fits?', ['Amazon Data Firehose', 'Amazon SQS', 'AWS DataSync', 'Amazon EMR on EC2'], 0, 'Firehose delivers streams to Redshift (via S3) with no management.'),
    d3(6, 'A relational database receives thousands of short-lived connections from Lambda and runs out of connections. What should be added?', ['Amazon RDS Proxy', 'A read replica', 'Larger storage', 'An S3 gateway endpoint'], 0, 'RDS Proxy pools connections.'),
    d3(7, 'Which TWO approaches reduce latency for users of a global web application? (Choose TWO.)', ['Serve content through Amazon CloudFront', 'Use Route 53 latency-based routing to multiple Regions', 'Put everything in a single AZ', 'Use S3 Glacier for static assets', 'Use larger NAT gateways'], [0, 1], 'Edge caching and routing users to their nearest Region both cut latency.'),
    // ------------------------------------------------------------ Domain 4: cost-optimized
    d4(1, 'A company has steady 24/7 EC2 usage and spiky, interruptible batch work. Which TWO purchasing choices minimise cost? (Choose TWO.)', ['Savings Plans for the steady usage', 'Spot Instances for the batch work', 'On-Demand for everything', 'Dedicated Hosts for the batch work', 'Capacity Reservations without a discount'], [0, 1], 'Commit for the baseline, use Spot for interruptible work.'),
    d4(2, 'Which TWO actions reduce data transfer costs for private instances that use S3 heavily? (Choose TWO.)', ['Add an S3 gateway endpoint', 'Keep instances and their NAT gateway in the same AZ for remaining internet traffic', 'Move instances to public subnets with Elastic IPs', 'Use S3 Transfer Acceleration for every request', 'Route S3 traffic through a VPN'], [0, 1], 'Gateway endpoints avoid NAT charges; same-AZ NAT avoids cross-AZ fees.'),
    d4(3, 'Backups must be kept 10 years, are accessed once a year at most, and retrieval within 48 hours is fine. Which storage is cheapest?', ['S3 Glacier Deep Archive', 'S3 Standard-IA', 'S3 Glacier Instant Retrieval', 'EBS snapshots in the standard tier'], 0, 'Deep Archive is the lowest-cost storage class.'),
    d4(4, 'A company wants an email when its forecast monthly spend exceeds a threshold, and wants anomalies flagged automatically. Which TWO services fit? (Choose TWO.)', ['AWS Budgets', 'AWS Cost Anomaly Detection', 'AWS Artifact', 'Amazon Inspector', 'AWS Shield'], [0, 1], 'Budgets alerts on forecasts; Cost Anomaly Detection flags unusual spend.'),
    d4(5, 'A small internal tool is used for a few minutes each day. Which hosting choice costs least?', ['Lambda with API Gateway or a Lambda function URL', 'An EC2 instance running 24/7', 'An EKS cluster', 'An RDS instance with a web front end'], 0, 'Pay only for invocations; nothing when idle.'),
    d4(6, 'An application\'s data in S3 has unpredictable access patterns. Which storage class reduces cost without risking retrieval fees?', ['S3 Intelligent-Tiering', 'S3 Standard-IA', 'S3 Glacier Flexible Retrieval', 'S3 One Zone-IA'], 0, 'Intelligent-Tiering adapts automatically with no retrieval fees.'),
  ],
};
