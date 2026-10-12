// AWS Certified Cloud Practitioner (CLF-C02): the foundational AWS exam, and
// where the AWS journey starts. Six floors of lessons follow the exam guide's
// four domains, and a bank of exam-style questions (including "Choose TWO")
// feeds the practice exams.
import type { Path } from '../../game/types';
import { clfBilling } from './clf/billing';
import { clfCompute } from './clf/compute';
import { clfConcepts } from './clf/concepts';
import { clfData } from './clf/data';
import { clfSecurity } from './clf/security';
import { clfServices } from './clf/services';
import { bankFor } from './kit';

const d1 = bankFor('clf', 'clf-d1');
const d2 = bankFor('clf', 'clf-d2');
const d3 = bankFor('clf', 'clf-d3');
const d4 = bankFor('clf', 'clf-d4');

export const CLF: Path = {
  id: 'aws-clf',
  name: 'AWS Certified Cloud Practitioner',
  short: 'Cloud Practitioner',
  tagline: 'The foundational AWS exam: what the cloud is, the core services, security and billing.',
  icon: '☁',
  exam: {
    code: 'CLF-C02',
    name: 'AWS Certified Cloud Practitioner',
    level: 'Foundational',
    questions: 65,
    minutes: 90,
    pass: 700,
    domains: [
      { id: 'clf-d1', name: 'Cloud Concepts', weight: 24 },
      { id: 'clf-d2', name: 'Security and Compliance', weight: 30 },
      { id: 'clf-d3', name: 'Cloud Technology and Services', weight: 34 },
      { id: 'clf-d4', name: 'Billing, Pricing, and Support', weight: 12 },
    ],
    guide: 'https://aws.amazon.com/certification/certified-cloud-practitioner/',
  },
  decks: [clfConcepts, clfCompute, clfData, clfServices, clfSecurity, clfBilling],
  bank: [
    // ------------------------------------------------------------ Domain 1
    d1(1, 'Which are advantages of cloud computing, as AWS defines them? (Choose TWO.)', ['Trade fixed expense for variable expense', 'Guarantee that applications never fail', 'Stop guessing capacity', 'Pay for capacity before using it', 'Eliminate the need for security'], [0, 2], 'Both are among the six advantages. Nothing guarantees no failures, and security is still needed (it\'s shared).'),
    d1(2, 'Which Well-Architected pillars focus on keeping a workload running through failures and on spending wisely? (Choose TWO.)', ['Reliability', 'Sustainability', 'Cost Optimization', 'Operational Excellence', 'Performance Efficiency'], [0, 2], 'Reliability covers recovering from failure; Cost Optimization covers delivering value at the lowest price.'),
    d1(3, 'A company wants to reduce the time between having an idea and testing it with customers. Which cloud benefit addresses this most directly?', ['Increased speed and agility', 'Economies of scale', 'High durability', 'Data residency'], 0, 'Fast, cheap provisioning lets teams experiment quickly: agility.'),
    d1(4, 'Which migration strategies involve NO change to the application\'s code? (Choose TWO.)', ['Rehost', 'Refactor', 'Relocate', 'Re-architect', 'Repurchase'], [0, 2], 'Rehost (lift and shift) and relocate (moving a virtualised environment) leave the application as it is. Repurchase replaces it entirely.'),
    d1(5, 'Which AWS CAF perspective helps make sure cloud investments accelerate business outcomes?', ['Business', 'Platform', 'Operations', 'Security'], 0, 'The **Business** perspective ties cloud adoption to business goals.'),
    d1(6, 'Which describes elasticity?', ['Running a workload in more than one Region', 'Automatically acquiring and releasing resources to match demand', 'Storing data with eleven nines of durability', 'Encrypting data at rest'], 1, 'Elasticity is capacity that follows demand, in both directions.'),
    d1(7, 'Which costs are part of an on-premises total cost of ownership that the cloud can reduce? (Choose TWO.)', ['Data centre power and cooling', 'Hardware refresh cycles', 'The cost of writing application features', 'Time spent by product managers on requirements', 'Customer support for end users'], [0, 1], 'Facilities and hardware refreshes are infrastructure costs AWS absorbs.'),
    d1(8, 'A company wants to modernise an application by moving it to containers and serverless services for maximum agility. Which migration strategy is this?', ['Refactor / re-architect', 'Retain', 'Rehost', 'Retire'], 0, 'Re-architecting with cloud-native services is refactoring.'),
    d1(9, 'Which Well-Architected design principle helps a team avoid over-provisioning?', ['Stop guessing your capacity needs', 'Make large changes infrequently', 'Manage infrastructure manually', 'Use a single Availability Zone'], 0, 'Scaling with demand removes the need to guess, and to buy for the peak.'),
    // ------------------------------------------------------------ Domain 2
    d2(1, 'Which are the customer\'s responsibilities under the shared responsibility model when using Amazon EC2? (Choose TWO.)', ['Patching the guest operating system', 'Physical security of the data centre', 'Configuring security group rules', 'Maintaining the hypervisor', 'Replacing failed hard drives'], [0, 2], 'On EC2, the guest OS and firewall rules are yours; physical infrastructure and the hypervisor are AWS\'s.'),
    d2(2, 'Which are AWS\'s responsibilities under the shared responsibility model? (Choose TWO.)', ['Securing the global infrastructure of Regions and AZs', 'Encrypting customer data in S3 buckets', 'Managing IAM user permissions', 'Patching the database engine in Amazon RDS', 'Writing secure application code'], [0, 3], 'AWS secures its infrastructure and the software of managed services like RDS.'),
    d2(3, 'Which are IAM best practices? (Choose TWO.)', ['Enable MFA for privileged users', 'Share credentials between team members', 'Grant least privilege', 'Use the root user for daily tasks', 'Embed access keys in source code'], [0, 2], 'MFA and least privilege are core IAM best practices.'),
    d2(4, 'A company needs to detect compromised EC2 instances mining cryptocurrency. Which service detects this?', ['Amazon GuardDuty', 'AWS Shield', 'AWS WAF', 'AWS Artifact'], 0, 'GuardDuty analyses logs to detect threats like crypto-mining.'),
    d2(5, 'Which services help protect against DDoS attacks? (Choose TWO.)', ['AWS Shield', 'Amazon CloudFront', 'Amazon Macie', 'AWS Artifact', 'AWS Audit Manager'], [0, 1], 'Shield protects against DDoS, and CloudFront absorbs attacks at the edge (with Shield Standard built in).'),
    d2(6, 'Which IAM identity should an AWS Lambda function use to access a DynamoDB table?', ['An IAM role (the function\'s execution role)', 'The root user', 'An IAM group', 'An IAM user with long-term access keys'], 0, 'Services assume roles to get temporary credentials.'),
    d2(7, 'Which service provides a single place to view and prioritise security findings from GuardDuty, Inspector and Macie?', ['AWS Security Hub', 'Amazon Detective', 'AWS Config', 'AWS CloudTrail'], 0, 'Security Hub aggregates findings across services and accounts.'),
    d2(8, 'Which can be used to encrypt data at rest in Amazon EBS? (Choose TWO.)', ['AWS KMS keys', 'AWS Certificate Manager', 'EBS encryption settings on the volume', 'AWS WAF', 'Amazon Route 53'], [0, 2], 'EBS encryption uses KMS keys. ACM certificates are for data in transit.'),
    d2(9, 'Which statement about service control policies (SCPs) is correct?', ['They grant permissions to users in member accounts', 'They set the maximum available permissions for accounts in an organisation', 'They replace IAM policies', 'They only apply to the root user of the management account'], 1, 'SCPs are guardrails: they limit, never grant.'),
    d2(10, 'A company must show auditors that AWS data centres meet ISO 27001. What should it provide?', ['The ISO certificate downloaded from AWS Artifact', 'A screenshot of the IAM console', 'AWS Trusted Advisor results', 'CloudWatch dashboards'], 0, 'AWS compliance reports and certificates come from Artifact.'),
    d2(11, 'Which service rotates database credentials automatically?', ['AWS Secrets Manager', 'AWS KMS', 'AWS IAM', 'Amazon Cognito'], 0, 'Secrets Manager stores secrets and rotates them on a schedule.'),
    // ------------------------------------------------------------ Domain 3
    d3(1, 'Which services are serverless? (Choose TWO.)', ['AWS Lambda', 'Amazon EC2', 'Amazon DynamoDB', 'Amazon RDS for Oracle', 'Amazon EC2 Dedicated Hosts'], [0, 2], 'Lambda and DynamoDB need no server management at all.'),
    d3(2, 'Which services store data in key-value or document form rather than relational tables? (Choose TWO.)', ['Amazon DynamoDB', 'Amazon Aurora', 'Amazon DocumentDB', 'Amazon RDS for MySQL', 'Amazon Redshift'], [0, 2], 'DynamoDB (key-value) and DocumentDB (document) are NoSQL; the others are relational or warehouse.'),
    d3(3, 'A company wants to cache static website content at locations close to users worldwide. Which service fits?', ['Amazon CloudFront', 'Amazon ElastiCache', 'AWS Global Accelerator', 'Amazon EFS'], 0, 'CloudFront caches content at edge locations.'),
    d3(4, 'Which are features of Amazon EC2 Auto Scaling? (Choose TWO.)', ['Replacing unhealthy instances automatically', 'Encrypting EBS volumes', 'Adding and removing instances based on demand', 'Registering domain names', 'Caching content at edge locations'], [0, 2], 'Auto Scaling maintains health and adjusts capacity.'),
    d3(5, 'Which service should a company use to run a relational database with automated backups, patching and Multi-AZ failover, without managing servers?', ['Amazon RDS', 'MySQL on EC2', 'Amazon DynamoDB', 'Amazon S3'], 0, 'RDS is the managed relational database service.'),
    d3(6, 'Which AWS services can deploy infrastructure as code? (Choose TWO.)', ['AWS CloudFormation', 'AWS CDK', 'Amazon CloudWatch', 'AWS Artifact', 'Amazon Inspector'], [0, 1], 'CloudFormation templates, and the CDK, which generates them.'),
    d3(7, 'Which storage service is best for a shared file system used by many Linux instances?', ['Amazon EFS', 'Amazon EBS', 'Amazon S3 Glacier', 'Instance store'], 0, 'EFS is a shared, elastic NFS file system.'),
    d3(8, 'Which service decouples a web tier from a processing tier so that spikes don\'t overload the processors?', ['Amazon SQS', 'Amazon Route 53', 'AWS Direct Connect', 'Amazon Athena'], 0, 'A queue absorbs spikes and lets processors work at their own pace.'),
    d3(9, 'Which AWS services help monitor and log activity in an account? (Choose TWO.)', ['Amazon CloudWatch', 'AWS CloudTrail', 'Amazon Polly', 'AWS Snowball Edge', 'Amazon Lightsail'], [0, 1], 'CloudWatch monitors metrics and logs; CloudTrail logs API calls.'),
    d3(10, 'A company wants to transcribe customer support calls into text. Which service fits?', ['Amazon Transcribe', 'Amazon Polly', 'Amazon Translate', 'Amazon Textract'], 0, 'Transcribe converts speech to text.'),
    d3(11, 'Which describes an AWS Region?', ['A physical location with multiple, isolated Availability Zones', 'A single data centre', 'A content cache in a large city', 'A virtual network inside an account'], 0, 'A Region contains multiple AZs.'),
    // ------------------------------------------------------------ Domain 4
    d4(1, 'Which pricing options reduce EC2 costs in exchange for a 1- or 3-year commitment? (Choose TWO.)', ['Reserved Instances', 'Savings Plans', 'Spot Instances', 'On-Demand Instances', 'The Free Tier'], [0, 1], 'Reserved Instances and Savings Plans trade a commitment for a discount. Spot needs no commitment.'),
    d4(2, 'Which tools help a company track and control AWS spending? (Choose TWO.)', ['AWS Budgets', 'AWS Cost Explorer', 'Amazon Inspector', 'AWS Shield', 'Amazon Macie'], [0, 1], 'Budgets alerts on spend; Cost Explorer analyses it.'),
    d4(3, 'Which support plans include a Technical Account Manager? (Choose TWO.)', ['Enterprise On-Ramp', 'Enterprise', 'Business', 'Developer', 'Basic'], [0, 1], 'Enterprise On-Ramp gives a pool of TAMs; Enterprise a designated TAM.'),
    d4(4, 'Which statement about AWS Marketplace is true?', ['It sells only AWS-built services', 'Third-party software bought there is billed through the AWS bill', 'It is only for Enterprise Support customers', 'It is where AWS compliance reports are downloaded'], 1, 'Marketplace purchases appear on your AWS bill.'),
    d4(5, 'A startup has a stateless web application with steady traffic during the day and very little at night. Which approach costs least?', ['Auto Scaling with On-Demand Instances, plus a Savings Plan for the baseline', 'Dedicated Hosts running 24/7', 'One very large instance running 24/7', 'Reserved capacity for the daytime peak, all year'], 0, 'Commit only to the baseline and let Auto Scaling handle the rest.'),
    d4(6, 'Which are charged by AWS? (Choose TWO.)', ['Data transfer out of AWS to the internet', 'Data transfer into AWS from the internet', 'Data stored in Amazon S3', 'Creating IAM users', 'Using the AWS Management Console'], [0, 2], 'Outbound transfer and storage are charged; inbound transfer, IAM and the console are free.'),
  ],
};
