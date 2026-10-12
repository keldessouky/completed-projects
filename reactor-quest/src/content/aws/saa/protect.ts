// SAA-C03 Domain 1, part 2: secure workloads, networks and data.
import type { Deck } from '../../../game/types';
import { checkpoint, lesson, q } from '../kit';

export const saaProtect: Deck = {
  id: 'saa-protect',
  name: 'Secure Workloads and Data',
  subtitle: 'Domain 1 · 30% of the exam (part 2 of 2)',
  outcome: 'Build private networks, keep traffic off the internet, encrypt everything and spot attacks.',
  hue: 15,
  domain: 'saa-d1',
  levels: [
    lesson({
      id: 'saa-vpc-security',
      title: 'Network Layers of Defence',
      system: 'Bulkhead Doors',
      skills: ['aws-networking', 'aws-security'],
      brief: `**ARIA:** A three-tier app: load balancer, app servers, database. Only one of those should ever be reachable from the internet. Design the network so that's true.`,
      lesson: `## The classic three-tier VPC

- **Public subnets** (one per AZ): the load balancer and NAT gateways. Route \`0.0.0.0/0\` → internet gateway.
- **Private app subnets:** EC2/containers. Route \`0.0.0.0/0\` → NAT gateway (outbound only).
- **Private data subnets:** databases. No internet route at all.

## Security groups that reference each other

Instead of IP ranges, a security group rule can allow traffic **from another security group**:

- ALB SG: allow 443 from \`0.0.0.0/0\`
- App SG: allow 8080 **from the ALB SG**
- DB SG: allow 5432 **from the App SG**

Each tier accepts only the tier in front of it, and it keeps working as instances come and go.

## NACLs: the subnet-level backstop

Stateless and ordered by rule number, with allow **and deny**. Remember **ephemeral ports**: return traffic goes to high ports (1024–65535), which a NACL must allow explicitly. Use NACLs to **block specific IP addresses** (security groups can't deny).

## Reaching private instances without opening ports

- **AWS Systems Manager Session Manager:** shell access through the SSM agent: **no inbound ports, no SSH keys, no bastion**, with sessions logged.
- **EC2 Instance Connect Endpoint:** SSH to private instances without a public IP.
- A **bastion host** in a public subnet still works, but it's more to secure.

## Visibility

**VPC Flow Logs** (to CloudWatch Logs or S3) record accepted and rejected traffic for ENIs, subnets or VPCs.`,
      questions: [
        q('How should the database tier\'s security group be configured in a three-tier app?', ['Allow port 5432 from 0.0.0.0/0', 'Allow port 5432 from the application tier\'s security group', 'Allow all traffic from the VPC CIDR', 'Allow port 22 from the internet'], 1, 'Referencing the app tier\'s security group allows only that tier.'),
        q('A company needs to block traffic from a specific malicious IP address range to a subnet. What should it use?', ['A security group deny rule', 'A network ACL deny rule', 'An IAM policy', 'A route table entry'], 1, 'Security groups can\'t deny; NACLs can.'),
        q('Administrators need shell access to private EC2 instances with no inbound ports open and a log of every session. What fits best?', ['A bastion host with SSH from 0.0.0.0/0', 'AWS Systems Manager Session Manager', 'A public IP on each instance', 'A Site-to-Site VPN per administrator'], 1, 'Session Manager needs no inbound ports and logs sessions.'),
        q('A NACL allows inbound port 443 but responses from the web servers aren\'t reaching clients. What is the likely cause?', ['Security groups are stateless', 'The NACL doesn\'t allow outbound ephemeral ports', 'The internet gateway is missing a security group', 'HTTPS needs port 80 too'], 1, 'NACLs are stateless, so outbound ephemeral ports must be allowed for return traffic.'),
        q('Where should NAT gateways be placed?', ['In private subnets', 'In public subnets, with a route to the internet gateway', 'In the data subnets', 'Outside the VPC'], 1, 'A NAT gateway lives in a public subnet and is targeted by private subnets\' routes.'),
        q('A security team needs to see which connections to an instance were rejected. What should be enabled?', ['AWS CloudTrail data events', 'VPC Flow Logs', 'AWS Config', 'Amazon Inspector'], 1, 'Flow Logs record ACCEPT and REJECT traffic.'),
      ],
    }),
    lesson({
      id: 'saa-private-connectivity',
      title: 'Keeping Traffic Private',
      system: 'Sealed Conduits',
      skills: ['aws-networking', 'aws-security'],
      brief: `**ARIA:** The app servers talk to S3 and DynamoDB through the NAT gateway and out over the internet. It works, but it costs money and it's not private. There's a better road.`,
      lesson: `## VPC endpoints

Reach AWS services **without an internet gateway, NAT or public IPs**:

| | Gateway endpoint | Interface endpoint (AWS PrivateLink) |
|---|---|---|
| Services | **S3 and DynamoDB only** | Most AWS services (SQS, KMS, Secrets Manager, ECR, STS…), plus your own and partners' |
| How | A **route table** target | An **ENI with a private IP** in your subnet |
| Cost | **Free** | Hourly per AZ plus per GB |
| From on-premises | No | Yes (over Direct Connect or VPN) |

Endpoint policies can restrict what is reachable through the endpoint.

## Exposing your own service privately

**AWS PrivateLink** puts a **Network Load Balancer** in front of your service, and consumers in other VPCs or accounts reach it through interface endpoints: no peering, no overlapping-CIDR problems, one-way access.

## Connecting VPCs

| | VPC peering | AWS Transit Gateway |
|---|---|---|
| Shape | One-to-one | Hub and spoke for **thousands** of VPCs and on-premises links |
| Transitive? | **No**: A–B and B–C doesn't give A–C | Yes, controlled with route tables |
| Overlapping CIDRs | Not allowed | Not allowed for routed attachments |

## Connecting on-premises

- **Site-to-Site VPN:** IPsec over the internet, quick to set up.
- **Direct Connect:** private dedicated link, consistent latency. **Not encrypted by default**: add **MACsec** or run a VPN over it. For resilience, use two connections at two locations, or a VPN as backup.`,
      questions: [
        q('EC2 instances in private subnets read from S3 through a NAT gateway. How can the company cut NAT costs and keep the traffic private?', ['Add an S3 gateway VPC endpoint', 'Move the instances to public subnets', 'Use S3 Transfer Acceleration', 'Add a second NAT gateway'], 0, 'A gateway endpoint for S3 is free and keeps traffic on the AWS network.'),
        q('Applications in private subnets must call AWS Secrets Manager without internet access. What is needed?', ['A gateway endpoint for Secrets Manager', 'An interface VPC endpoint (PrivateLink) for Secrets Manager', 'An internet gateway', 'VPC peering'], 1, 'Only S3 and DynamoDB have gateway endpoints; other services use interface endpoints.'),
        q('VPC A is peered with B, and B is peered with C. Can A reach C through B?', ['Yes, peering is transitive', 'No, peering is not transitive', 'Only for S3 traffic', 'Only if the CIDRs overlap'], 1, 'Peering is not transitive. Use Transit Gateway, or peer A and C directly.'),
        q('A SaaS provider wants hundreds of customer VPCs to reach its API privately, without peering and despite overlapping CIDRs. What should it use?', ['VPC peering with every customer', 'AWS PrivateLink with a Network Load Balancer', 'A public API with IP allow-lists', 'Transit Gateway with every customer'], 1, 'PrivateLink exposes a service through interface endpoints, with no CIDR conflicts.'),
        q('A company connects 60 VPCs and two data centres and wants central routing. Which service fits?', ['Full mesh VPC peering', 'AWS Transit Gateway', 'NAT gateways', 'Internet gateways'], 1, 'Transit Gateway is the hub for many VPCs and on-premises connections.'),
        q('A Direct Connect link carries sensitive data and must be encrypted. What should be done?', ['Nothing: Direct Connect is encrypted by default', 'Enable MACsec or run an IPsec VPN over the Direct Connect connection', 'Use a gateway endpoint', 'Enable S3 encryption'], 1, 'Direct Connect isn\'t encrypted by default; MACsec or VPN over DX adds encryption.'),
      ],
    }),
    lesson({
      id: 'saa-encryption',
      title: 'Encryption Everywhere',
      system: 'Cipher Core',
      skills: ['aws-security', 'aws-storage'],
      brief: `**ARIA:** "Encrypt everything" is easy to say. The exam asks how: which keys, which service, and what to do with a database that was created unencrypted.`,
      lesson: `## AWS KMS

- **AWS managed keys** (\`aws/s3\`, \`aws/ebs\`…): created for you, no control over policies.
- **Customer managed keys:** you control the **key policy**, rotation (automatic yearly or on demand), and who can use or administer them. Every use is logged in **CloudTrail**.
- **Envelope encryption:** KMS encrypts a small **data key**; the data key encrypts the data. Big data never travels to KMS.
- KMS keys are **regional**; **multi-Region keys** share key material across Regions for cross-Region encryption.
- Access needs **both** IAM permission **and** a key policy that allows it.

## Service by service

| Service | Notes |
|---|---|
| **S3** | SSE-S3 (default), **SSE-KMS** (audit, key control), DSSE-KMS (two layers), SSE-C (you supply the key per request), or client-side |
| **EBS** | Encrypt at creation; turn on **encryption by default** per Region. To encrypt an existing unencrypted volume: **snapshot → copy the snapshot with encryption → create a volume** |
| **RDS / Aurora** | Encryption **only at creation**. To encrypt an existing database: **snapshot → copy encrypted → restore**. Read replicas share the primary's encryption |
| **DynamoDB** | Always encrypted at rest; choose AWS owned, AWS managed or customer managed keys |

## In transit

- **ACM** certificates on **ALB, NLB, CloudFront and API Gateway** for HTTPS; ACM renews them automatically.
- Enforce TLS: S3 bucket policies with \`aws:SecureTransport\`, RDS parameter settings that require SSL.

## CloudHSM

**Single-tenant hardware security modules** you fully control (FIPS 140-3 Level 3). Use when **you** must hold exclusive control of keys, or need custom key stores for KMS.`,
      questions: [
        q('An existing Amazon RDS database was created unencrypted. How can it be encrypted?', ['Turn on encryption in the console', 'Snapshot it, copy the snapshot with encryption enabled, restore a new instance from the encrypted copy', 'Enable SSL connections', 'Create an encrypted read replica and promote it'], 1, 'RDS encryption is set at creation; encrypt via an encrypted snapshot copy and restore.'),
        q('A company must make sure every new EBS volume in a Region is encrypted, even when developers forget. What should it do?', ['Enable EBS encryption by default for the Region', 'Use instance store volumes', 'Ask developers to tick the box', 'Encrypt the AMI only'], 0, 'Encryption by default applies to every new volume.'),
        q('Which KMS feature lets a company control exactly who can use a key and audit every use?', ['AWS managed keys', 'Customer managed keys with a key policy, logged in CloudTrail', 'SSE-S3', 'Default EBS encryption'], 1, 'Customer managed keys give policy control; CloudTrail logs usage.'),
        q('Why does KMS use envelope encryption for large data?', ['KMS can\'t encrypt anything', 'Data is encrypted locally with a data key, and only the small data key is encrypted by KMS', 'It makes data public', 'It removes the need for keys'], 1, 'Envelope encryption keeps bulk data local and fast.'),
        q('Which service provides HTTPS certificates for an Application Load Balancer and renews them automatically?', ['AWS Certificate Manager', 'AWS CloudHSM', 'AWS Secrets Manager', 'AWS KMS'], 0, 'ACM issues and renews public certificates for integrated services.'),
        q('A regulator requires that the company alone controls the hardware holding its encryption keys. What should be used?', ['AWS managed keys', 'AWS CloudHSM', 'SSE-S3', 'IAM policies'], 1, 'CloudHSM gives single-tenant, customer-controlled HSMs.'),
      ],
    }),
    lesson({
      id: 'saa-threat-protection',
      title: 'Secrets and Shields',
      system: 'Perimeter Defence',
      skills: ['aws-security'],
      brief: `**ARIA:** Somebody committed a database password to the repository, and a bot is hammering the login page. Two problems, two families of services.`,
      lesson: `## Secrets

| | AWS Secrets Manager | SSM Parameter Store |
|---|---|---|
| Stores | Secrets (DB passwords, API keys) | Config values and secrets (SecureString with KMS) |
| **Automatic rotation** | **Yes**, built in for RDS, Aurora, Redshift, DocumentDB; Lambda for anything else | No built-in rotation |
| Cross-Region replication | Yes | No |
| Cost | Per secret per month | Standard parameters free |

Rule of thumb: **needs rotation → Secrets Manager.** Plain configuration → Parameter Store.

## Edge protection

- **AWS WAF** on **CloudFront, ALB, API Gateway, AppSync, Cognito**: managed rule groups (OWASP top 10, known bad inputs, bot control), **rate-based rules** (block an IP sending too many requests), **geo-match** (block countries), IP sets.
- **AWS Shield Standard:** free layer 3/4 DDoS protection. **Shield Advanced:** protection for EC2, ELB, CloudFront, Global Accelerator and Route 53; 24/7 Shield Response Team; **cost protection** for scaling caused by attacks.
- **AWS Firewall Manager:** apply WAF rules, Shield Advanced, security groups and Network Firewall policies **across all accounts** in an organisation.
- **AWS Network Firewall:** stateful inspection and intrusion prevention for VPC traffic, including domain allow-lists for outbound traffic.

## Detection

- **GuardDuty:** threat detection from CloudTrail, VPC Flow Logs, DNS logs, plus S3, EKS, RDS and Lambda protections.
- **Inspector:** vulnerabilities in EC2, ECR images and Lambda.
- **Macie:** sensitive data in S3.
- **Security Hub:** aggregates and scores findings against standards (like AWS Foundational Security Best Practices).

Combine with **EventBridge** to respond automatically: a GuardDuty finding triggers a Lambda that isolates the instance.`,
      questions: [
        q('An application needs its database password rotated every 30 days automatically, with no code changes to rotation logic. Which service fits?', ['SSM Parameter Store standard parameters', 'AWS Secrets Manager', 'An environment variable', 'An S3 object'], 1, 'Secrets Manager rotates RDS credentials natively.'),
        q('A login page is attacked by a single IP sending thousands of requests per minute. What is the simplest mitigation?', ['A WAF rate-based rule on the ALB or CloudFront', 'A bigger instance type', 'A new security group per attacker', 'Shield Standard only'], 0, 'Rate-based WAF rules block IPs that exceed a request threshold.'),
        q('A company wants WAF rules applied consistently to every ALB across 50 accounts. Which service centralises this?', ['AWS Firewall Manager', 'AWS Config', 'Amazon Inspector', 'AWS Shield Standard'], 0, 'Firewall Manager applies security policies across an organisation.'),
        q('Which service offers 24/7 access to a DDoS response team and protection against attack-driven scaling costs?', ['AWS WAF', 'AWS Shield Advanced', 'Amazon GuardDuty', 'AWS Network Firewall'], 1, 'Shield Advanced includes the Shield Response Team and cost protection.'),
        q('A company wants compromised EC2 instances isolated automatically when GuardDuty detects them. What is a good design?', ['Check GuardDuty findings by hand each week', 'An EventBridge rule on GuardDuty findings that invokes a Lambda function to change the instance\'s security group', 'Enable Macie', 'A Config rule on instance types'], 1, 'EventBridge plus Lambda turns findings into automatic responses.'),
        q('Outbound traffic from a VPC may only reach a list of approved internet domains. Which service can enforce this?', ['Security groups', 'AWS Network Firewall with a domain allow-list', 'An S3 gateway endpoint', 'AWS Shield'], 1, 'Network Firewall can filter outbound traffic by domain name.'),
      ],
    }),
    lesson({
      id: 'saa-logging-audit',
      title: 'Audit Trails That Hold Up',
      system: 'Flight Recorder',
      skills: ['aws-security', 'aws-operations'],
      brief: `**ARIA:** After an incident, investigators need logs that are complete, centralised and provably untouched. Design the flight recorder.`,
      lesson: `## CloudTrail in depth

- **Management events** (create, delete, modify resources) are logged by default; **data events** (S3 object reads and writes, Lambda invocations, DynamoDB item operations) must be turned on, and cost extra.
- **CloudTrail Insights** spots unusual API activity.
- Make logs trustworthy: an **organisation trail** to a **central S3 bucket** in a separate account, **log file integrity validation** (digest files prove nothing was changed), SSE-KMS encryption, Object Lock if required.
- **CloudTrail Lake** stores and queries events with SQL.
- Send trails to **CloudWatch Logs** to alarm on specific API calls (for example, root user sign-in).

## AWS Config

- Records **configuration history** of resources.
- **Config rules** (managed or custom) evaluate compliance continuously: "S3 buckets block public access", "EBS volumes encrypted".
- **Automatic remediation** with Systems Manager Automation documents.
- **Conformance packs** bundle rules for a standard.

## Other logs

| Log | Captures |
|---|---|
| VPC Flow Logs | IP traffic metadata |
| ELB access logs | Every request to the load balancer |
| S3 server access logs | Requests to a bucket |
| CloudFront logs | Edge requests |
| Route 53 Resolver query logs | DNS queries from your VPC |

## Answering "who changed what?"

- **Who** called the API → CloudTrail.
- **What** the resource looked like before and after → Config.
- **How** it is performing → CloudWatch.`,
      questions: [
        q('Investigators need proof that CloudTrail log files weren\'t modified after delivery. What should be enabled?', ['S3 Transfer Acceleration', 'CloudTrail log file integrity validation', 'VPC Flow Logs', 'S3 Intelligent-Tiering'], 1, 'Integrity validation creates signed digest files that detect changes.'),
        q('A company must log every GetObject request on a sensitive S3 bucket. What must be enabled?', ['CloudTrail management events only', 'CloudTrail data events for S3 (or S3 server access logs)', 'AWS Config', 'CloudWatch metrics'], 1, 'Object-level reads are data events, which are off by default.'),
        q('A company wants unencrypted EBS volumes detected and flagged continuously across its account. Which service fits?', ['AWS Config with a managed rule', 'AWS CloudTrail', 'Amazon Macie', 'AWS Trusted Advisor only'], 0, 'Config rules continuously evaluate resource compliance.'),
        q('The security team wants an alarm whenever the root user signs in. How?', ['Send CloudTrail to CloudWatch Logs with a metric filter and alarm', 'Enable S3 versioning', 'Use AWS Artifact', 'Use VPC Flow Logs'], 0, 'A metric filter on CloudTrail events in CloudWatch Logs can trigger an alarm.'),
        q('A Config rule finds a security group open to the world on port 22. The company wants it fixed automatically. What should be used?', ['Config automatic remediation with an SSM Automation document', 'CloudTrail Insights', 'Amazon Inspector', 'AWS Budgets'], 0, 'Config remediation runs Systems Manager Automation to fix non-compliance.'),
        q('Which service shows what a security group\'s rules were three days ago?', ['AWS Config', 'Amazon CloudWatch', 'AWS Shield', 'Amazon GuardDuty'], 0, 'Config keeps configuration history for each resource.'),
      ],
    }),
    checkpoint({
      id: 'saa-protect-checkpoint',
      title: 'Checkpoint: Secure Workloads and Data',
      system: 'Perimeter Certification Gate',
      skills: ['aws-security', 'aws-networking'],
      brief: `**ARIA:** Associate-level scenarios on networks, encryption, secrets and detection. Look for the answer with the least operational overhead.`,
      lesson: `## Before you start

- Tiered subnets; SGs referencing SGs; NACLs for deny; Session Manager instead of bastions.
- Gateway endpoints (S3, DynamoDB, free) vs interface endpoints (everything else, PrivateLink). Peering isn't transitive; Transit Gateway is the hub.
- Encrypt RDS/EBS at creation, or via encrypted snapshot copies. Customer managed KMS keys for control and audit.
- Rotation → Secrets Manager. WAF rate-based rules. Firewall Manager across accounts. GuardDuty + EventBridge + Lambda.`,
      questions: [
        q('Containers in private subnets pull images from Amazon ECR. The company wants no internet access at all. Which endpoints are needed?', ['Only an S3 gateway endpoint', 'ECR interface endpoints (api and dkr) plus an S3 gateway endpoint for the image layers', 'A NAT gateway', 'A VPC peering connection to ECR'], 1, 'ECR uses its API and Docker endpoints, and image layers come from S3.'),
        q('A company needs to share an encrypted EBS snapshot with another account. What must also be shared?', ['Nothing else', 'Access to the customer managed KMS key used to encrypt it', 'The root user password', 'The VPC'], 1, 'The other account needs permission to use the KMS key. (Snapshots encrypted with the default AWS managed key can\'t be shared.)'),
        q('An app\'s database credentials are in a config file on every server. What is the most secure improvement?', ['Encrypt the config file with Base64', 'Store them in Secrets Manager with rotation, and read them at runtime using an IAM role', 'Put them in environment variables in the AMI', 'Email them to administrators'], 1, 'Secrets Manager plus IAM roles removes secrets from servers and rotates them.'),
        q('Which design allows an on-premises network to reach Amazon SQS privately over Direct Connect?', ['An interface VPC endpoint for SQS, reached over Direct Connect', 'A gateway endpoint for SQS', 'A public SQS endpoint over the internet', 'VPC peering with SQS'], 0, 'Interface endpoints are reachable from on-premises via DX or VPN; gateway endpoints are not.'),
        q('A global website on CloudFront must block requests from certain countries. What is the simplest solution?', ['A WAF geo-match rule (or CloudFront geographic restrictions)', 'Security groups on CloudFront', 'Network ACLs on S3', 'Route 53 weighted routing'], 0, 'WAF geo-match rules or CloudFront geo restriction block by country.'),
        q('Which pair of services answers "who deleted this security group rule?" and "what did the rule look like before?"', ['CloudWatch and Inspector', 'CloudTrail and Config', 'GuardDuty and Macie', 'Shield and WAF'], 1, 'CloudTrail records the API call and caller; Config keeps the configuration history.'),
        q('A team must reach private EC2 instances for troubleshooting while the security team forbids inbound SSH entirely. What should be used?', ['A bastion host', 'Systems Manager Session Manager', 'An Elastic IP on each instance', 'A NAT gateway'], 1, 'Session Manager needs no inbound ports.'),
        q('A company stores sensitive customer documents in S3 and must discover any that contain personal data. Which service fits?', ['Amazon Macie', 'Amazon Inspector', 'AWS Shield', 'AWS Config'], 0, 'Macie discovers sensitive data in S3.'),
      ],
    }),
  ],
};
