// CLF-C02 Domain 3, part 2: storage, databases and networking.
import type { Deck } from '../../../game/types';
import { checkpoint, lesson, q } from '../kit';

export const clfData: Deck = {
  id: 'clf-data',
  name: 'Storage, Databases and Networks',
  subtitle: 'Domain 3 · 34% of the exam (part 2 of 3)',
  outcome: 'Choose where data lives, which database fits, and how traffic reaches it.',
  hue: 150,
  domain: 'clf-d3',
  levels: [
    lesson({
      id: 'clf-s3',
      title: 'Amazon S3',
      system: 'Cargo Hold',
      skills: ['aws-storage'],
      brief: `**ARIA:** Every photo, log and backup ground control has ever made needs a home. Amazon S3 holds practically unlimited objects, and knowing its storage classes is worth several exam points.`,
      lesson: `## Amazon S3 (Simple Storage Service)

**Object storage**: you store **objects** (files plus metadata) in **buckets**.

- Practically unlimited total storage; one object can be up to **5 TB**.
- Designed for **99.999999999% durability** ("eleven nines"): data is stored redundantly across multiple AZs (except One Zone classes).
- Bucket names are globally unique; a bucket lives in one Region.
- Uses: backups, data lakes, media, logs, **static website hosting**.
- **Versioning** keeps every version of an object, protecting against accidental overwrite and deletion.

## Storage classes

| Class | For | Retrieval |
|---|---|---|
| **S3 Standard** | Frequently accessed data | Milliseconds |
| **S3 Intelligent-Tiering** | **Unknown or changing** access patterns: moves objects between tiers automatically | Milliseconds (archive tiers optional) |
| **S3 Standard-IA** (Infrequent Access) | Rarely read but needed fast when it is | Milliseconds, with a retrieval fee |
| **S3 One Zone-IA** | Infrequent, **re-creatable** data: stored in one AZ, cheaper | Milliseconds |
| **S3 Glacier Instant Retrieval** | Archive accessed about once a quarter, needed instantly | Milliseconds |
| **S3 Glacier Flexible Retrieval** | Archive; minutes to hours is fine | Minutes to hours |
| **S3 Glacier Deep Archive** | Long-term archive, rarely if ever read: **the cheapest** | Within 12 hours |

**S3 Lifecycle** rules move objects to cheaper classes as they age, or delete them: for example, Standard → Standard-IA after 30 days → Glacier Deep Archive after a year.`,
      questions: [
        q('Which S3 storage class is the lowest-cost option for data kept for years and rarely, if ever, accessed?', ['S3 Standard-IA', 'S3 Glacier Deep Archive', 'S3 One Zone-IA', 'S3 Intelligent-Tiering'], 1, '**Glacier Deep Archive** is the cheapest storage, with retrieval within 12 hours.'),
        q('A company stores data whose access pattern is unpredictable. Which class automatically moves objects to the most cost-effective tier?', ['S3 Standard', 'S3 Intelligent-Tiering', 'S3 Glacier Flexible Retrieval', 'S3 One Zone-IA'], 1, '**Intelligent-Tiering** monitors access and moves objects between tiers for you.'),
        q('What kind of storage is Amazon S3?', ['Block storage', 'File storage', 'Object storage', 'Instance storage'], 2, 'S3 stores objects in buckets.'),
        q('Which S3 feature protects against accidental deletion by keeping previous copies of objects?', ['Lifecycle rules', 'Versioning', 'Transfer Acceleration', 'Static website hosting'], 1, 'With **versioning** on, a delete or overwrite keeps the older versions.'),
        q('Which class is cheapest for infrequently accessed data that can easily be re-created if lost?', ['S3 Standard', 'S3 Standard-IA', 'S3 One Zone-IA', 'S3 Glacier Instant Retrieval'], 2, '**One Zone-IA** stores data in a single AZ, so it costs less but isn\'t resilient to that AZ\'s loss. Fine for re-creatable data.'),
        q('A company wants objects to move to cheaper storage automatically 90 days after creation. What should it configure?', ['An S3 Lifecycle rule', 'S3 Versioning', 'A bucket policy', 'Cross-Region Replication'], 0, '**Lifecycle rules** transition or expire objects based on age.'),
      ],
    }),
    lesson({
      id: 'clf-block-file',
      title: 'Block, File and Hybrid Storage',
      system: 'Storage Lockers',
      skills: ['aws-storage'],
      brief: `**ARIA:** Not all storage is objects in buckets. Servers need disks, teams need shared folders, and old systems need a bridge to the cloud.`,
      lesson: `## Three kinds of storage

| Kind | Like | AWS |
|---|---|---|
| **Block** | A hard drive attached to one computer | **Amazon EBS** |
| **File** | A shared network folder many computers use at once | **Amazon EFS**, **Amazon FSx** |
| **Object** | Files in buckets, reached over HTTP | **Amazon S3** |

## Amazon EBS (Elastic Block Store)

- Persistent block volumes for **EC2**: the instance's disks.
- A volume lives in **one Availability Zone** and attaches to instances in that AZ.
- **Snapshots** back volumes up (stored in S3, incremental) and can create new volumes, even in other AZs or Regions.

## Shared file systems

- **Amazon EFS (Elastic File System):** a managed, elastic **NFS** file system for **Linux**, shared by many instances across AZs; it grows and shrinks automatically.
- **Amazon FSx:** managed third-party file systems: **FSx for Windows File Server** (SMB, Active Directory), **FSx for Lustre** (high-performance computing), FSx for NetApp ONTAP and FSx for OpenZFS.

## Hybrid and backup

- **AWS Storage Gateway:** connects on-premises applications to cloud storage (S3 and more), so local apps can use the cloud as if it were local.
- **AWS DataSync:** moves data online between on-premises storage and AWS, fast and automatically.
- **AWS Snowball Edge:** a rugged device for moving data **offline** when the network is too slow, and for edge computing.
- **AWS Backup:** one place to manage and automate backups across AWS services (EBS, RDS, DynamoDB, EFS, S3…).`,
      questions: [
        q('Which service provides persistent block storage volumes for EC2 instances?', ['Amazon S3', 'Amazon EBS', 'Amazon EFS', 'AWS Storage Gateway'], 1, '**EBS** volumes are block storage for EC2.'),
        q('Many Linux EC2 instances in different Availability Zones need to read and write the same files at the same time. Which service fits?', ['Amazon EBS', 'Amazon EFS', 'Instance store', 'S3 Glacier'], 1, '**EFS** is a shared NFS file system across AZs.'),
        q('A company needs a fully managed Windows file share that integrates with Active Directory. Which service fits?', ['Amazon EFS', 'Amazon FSx for Windows File Server', 'Amazon EBS', 'Amazon S3'], 1, '**FSx for Windows File Server** provides SMB shares with Active Directory integration.'),
        q('Which service lets on-premises applications use cloud storage as if it were local?', ['AWS Storage Gateway', 'AWS Snowball Edge', 'Amazon EBS', 'AWS Backup'], 0, '**Storage Gateway** bridges on-premises apps to AWS storage.'),
        q('Which service centrally manages and automates backups across multiple AWS services?', ['Amazon S3 Versioning', 'AWS Backup', 'EBS Snapshots only', 'AWS DataSync'], 1, '**AWS Backup** is the central backup service.'),
        q('An EBS volume is in Availability Zone A. Which statement is true?', ['It can be attached to an instance in any Region', 'It can be attached to instances in the same AZ', 'It is automatically replicated to every AZ', 'It is a shared file system'], 1, 'EBS volumes are AZ-scoped. To move data to another AZ, create a snapshot and restore it there.'),
      ],
    }),
    lesson({
      id: 'clf-databases',
      title: 'Databases',
      system: 'Crew Records',
      skills: ['aws-databases'],
      brief: `**ARIA:** Ground control's records live in three different databases and nobody knows why. Learn which AWS database fits which job; the exam asks it a dozen ways.`,
      lesson: `## Relational (SQL)

Tables with rows and columns, related by keys, queried with SQL.

- **Amazon RDS (Relational Database Service):** managed relational databases. Engines: MySQL, PostgreSQL, MariaDB, Oracle, SQL Server and Db2. AWS handles provisioning, **patching, backups** and failover (**Multi-AZ**); you manage your data and schema.
- **Amazon Aurora:** AWS's own relational engine, **MySQL- and PostgreSQL-compatible**, faster and highly available: six copies of your data across three AZs.

## NoSQL and purpose-built

| Need | Service |
|---|---|
| Key-value, **serverless**, single-digit millisecond at any scale | **Amazon DynamoDB** |
| In-memory cache to speed up reads | **Amazon ElastiCache** (Valkey, Redis OSS, Memcached) |
| Document database, MongoDB-compatible | **Amazon DocumentDB** |
| Graph: relationships like social networks, fraud rings | **Amazon Neptune** |
| Apache Cassandra-compatible wide-column | **Amazon Keyspaces** |
| Time-series data from sensors and IoT | **Amazon Timestream** |
| Data warehouse: analytics over huge amounts of data | **Amazon Redshift** |

## Managed vs self-managed

You **can** install a database on EC2, but then you patch, back up and scale it yourself. Managed services move that work to AWS.

## Moving databases

- **AWS Database Migration Service (DMS):** migrates databases to AWS while the source stays usable.
- **AWS Schema Conversion Tool (SCT):** converts a schema from one engine to another (for example Oracle to PostgreSQL).`,
      questions: [
        q('Which service is a serverless key-value NoSQL database with single-digit millisecond performance?', ['Amazon RDS', 'Amazon DynamoDB', 'Amazon Redshift', 'Amazon Neptune'], 1, '**DynamoDB** is serverless key-value and document NoSQL.'),
        q('A company needs a managed relational database for PostgreSQL. Which services fit? Choose the best one listed.', ['Amazon DynamoDB', 'Amazon ElastiCache', 'Amazon RDS', 'Amazon DocumentDB'], 2, '**RDS** (or Aurora) runs managed PostgreSQL.'),
        q('Which service runs analytics queries over petabytes of structured data as a data warehouse?', ['Amazon Redshift', 'Amazon RDS', 'Amazon DynamoDB', 'Amazon ElastiCache'], 0, '**Redshift** is the data warehouse.'),
        q('Which database is best for highly connected data like social networks and recommendation engines?', ['Amazon Neptune', 'Amazon Timestream', 'Amazon Aurora', 'Amazon DocumentDB'], 0, '**Neptune** is the graph database.'),
        q('What does AWS manage for you with Amazon RDS that you would manage yourself with a database on EC2?', ['Your table design', 'Database patching and automated backups', 'Your SQL queries', 'Which data you store'], 1, 'RDS handles patching, backups and failover; your schema and data stay yours.'),
        q('Which service converts a database schema from Oracle to Amazon Aurora PostgreSQL as part of a migration?', ['AWS DMS alone', 'AWS Schema Conversion Tool', 'AWS DataSync', 'AWS Snowball Edge'], 1, 'The **SCT** converts schemas between engines; **DMS** then moves the data.'),
      ],
    }),
    lesson({
      id: 'clf-vpc',
      title: 'Virtual Private Cloud',
      system: 'Bulkhead Network',
      skills: ['aws-networking'],
      brief: `**ARIA:** Every resource needs a network, and on AWS you build your own: a private, isolated section of the cloud. Learn its parts.`,
      lesson: `## Amazon VPC

A **Virtual Private Cloud** is your own logically isolated network in AWS. You choose its IP address range and divide it into **subnets**.

- **Subnet:** a range of addresses in **one Availability Zone**.
  - **Public subnet:** has a route to an **internet gateway**, so resources can be reached from the internet (web servers, load balancers).
  - **Private subnet:** no direct route from the internet (databases, app servers).
- **Internet gateway:** connects a VPC to the internet.
- **NAT gateway:** lets resources in a private subnet reach **out** to the internet (for updates) without being reachable **from** it.
- **Route tables** decide where traffic in each subnet goes.

## Two firewalls

| | Security group | Network ACL |
|---|---|---|
| Protects | An **instance** (its network interface) | A **subnet** |
| Rules | **Allow only** | Allow **and deny** |
| State | **Stateful**: return traffic is allowed automatically | **Stateless**: return traffic must be allowed explicitly |
| Default | Denies all inbound, allows all outbound | Default NACL allows everything |

## Connecting VPCs

- **VPC peering:** connects two VPCs privately.
- **AWS Transit Gateway:** a hub that connects many VPCs and on-premises networks.

**VPC Flow Logs** record the IP traffic going to and from network interfaces, for troubleshooting and security analysis.`,
      questions: [
        q('Which acts as a firewall at the **instance** level and is stateful?', ['Network ACL', 'Security group', 'Route table', 'Internet gateway'], 1, 'Security groups are stateful instance-level firewalls with allow rules only.'),
        q('Which statement about network ACLs is correct?', ['They are stateful', 'They support both allow and deny rules at the subnet level', 'They only apply to a single instance', 'They can\'t block traffic'], 1, 'NACLs are stateless, work at the subnet level, and can explicitly deny.'),
        q('Instances in a private subnet need to download software updates from the internet without accepting inbound connections. What do they need?', ['An internet gateway attached directly to the instances', 'A NAT gateway', 'VPC peering', 'A security group allowing all inbound traffic'], 1, 'A **NAT gateway** allows outbound internet access from private subnets while blocking unsolicited inbound traffic.'),
        q('What makes a subnet "public"?', ['It is in a public Region', 'Its route table has a route to an internet gateway', 'It has no security groups', 'It contains a database'], 1, 'A public subnet routes internet traffic through an internet gateway.'),
        q('Which service connects many VPCs and on-premises networks through a central hub?', ['VPC peering', 'AWS Transit Gateway', 'Amazon Route 53', 'NAT gateway'], 1, '**Transit Gateway** is the hub-and-spoke option for many networks.'),
        q('A security engineer wants a record of IP traffic going to and from network interfaces in a VPC. What should they enable?', ['AWS CloudTrail', 'VPC Flow Logs', 'Amazon Inspector', 'AWS Artifact'], 1, '**VPC Flow Logs** capture IP traffic information. CloudTrail logs API calls, not network traffic.'),
      ],
    }),
    lesson({
      id: 'clf-edge-network',
      title: 'DNS, CDN and Private Links',
      system: 'Long-Range Antenna',
      skills: ['aws-networking'],
      brief: `**ARIA:** Users around the world need to find ground control, quickly, and the old data centre needs a private line in. Four services to learn.`,
      lesson: `## Amazon Route 53

AWS's **DNS** service: it turns names like \`example.com\` into IP addresses.

- **Registers domain names.**
- **Routing policies:** simple, weighted (A/B testing), latency-based (send users to the fastest Region), failover (to a standby when health checks fail), geolocation, and more.
- **Health checks** monitor endpoints.

## Amazon CloudFront

A **content delivery network (CDN)**: caches content at **edge locations** around the world, so users get it from somewhere close. Faster websites, video and APIs, and protection from attacks with AWS Shield and AWS WAF.

## AWS Global Accelerator

Sends users' traffic onto the **AWS global network** at the nearest edge location, and gives your application **static anycast IP addresses**. Improves performance and availability for TCP/UDP applications. (CloudFront caches content; Global Accelerator speeds up the network path.)

## Connecting your data centre

| | AWS Site-to-Site VPN | AWS Direct Connect |
|---|---|---|
| Path | Encrypted tunnel **over the internet** | **Dedicated private** connection |
| Setup | Minutes | Weeks (a physical link) |
| Performance | Varies with the internet | Consistent, high bandwidth |

**AWS Client VPN** connects individual users' devices to AWS securely.`,
      questions: [
        q('Which AWS service is a DNS service that can also register domain names?', ['Amazon CloudFront', 'Amazon Route 53', 'AWS Global Accelerator', 'Elastic Load Balancing'], 1, '**Route 53** is DNS, domain registration and health checking.'),
        q('A company wants to deliver videos with low latency to viewers worldwide by caching them near users. Which service fits?', ['Amazon CloudFront', 'AWS Direct Connect', 'Amazon Route 53', 'Amazon VPC'], 0, '**CloudFront** caches content at edge locations.'),
        q('A company needs a consistent, high-bandwidth, private connection between its data centre and AWS that doesn\'t use the public internet. What should it use?', ['AWS Site-to-Site VPN', 'AWS Direct Connect', 'AWS Client VPN', 'An internet gateway'], 1, '**Direct Connect** is the dedicated private link.'),
        q('Which Route 53 routing policy sends users to the Region that gives them the lowest latency?', ['Weighted', 'Failover', 'Latency-based', 'Simple'], 2, '**Latency-based routing** picks the Region with the best latency for each user.'),
        q('Which service gives an application static IP addresses and routes traffic over the AWS global network for better performance?', ['Amazon CloudFront', 'AWS Global Accelerator', 'Amazon Route 53', 'NAT gateway'], 1, '**Global Accelerator** provides static anycast IPs and uses AWS\'s backbone.'),
        q('A company needs a connection to AWS today, and an encrypted tunnel over the internet is acceptable. What is the quickest option?', ['AWS Direct Connect', 'AWS Site-to-Site VPN', 'AWS Snowball Edge', 'VPC peering'], 1, 'A **Site-to-Site VPN** can be set up in minutes; Direct Connect takes weeks.'),
      ],
    }),
    checkpoint({
      id: 'clf-data-checkpoint',
      title: 'Checkpoint: Storage, Databases and Networks',
      system: 'Cargo Certification Gate',
      skills: ['aws-storage', 'aws-databases', 'aws-networking'],
      brief: `**ARIA:** Exam-style scenarios. Read the requirement words carefully: "shared", "key-value", "private", "cheapest", "unknown access pattern".`,
      lesson: `## Before you start

- Object = S3, block = EBS, file = EFS (Linux) / FSx (Windows, Lustre…).
- Relational = RDS / Aurora. Key-value = DynamoDB. Cache = ElastiCache. Graph = Neptune. Warehouse = Redshift.
- Security group: instance, stateful, allow-only. NACL: subnet, stateless, allow and deny.
- Route 53 = DNS. CloudFront = CDN. Direct Connect = private line. VPN = encrypted over internet.`,
      questions: [
        q('A website\'s database queries are slow because the same data is read over and over. Which service can cache the results in memory?', ['Amazon ElastiCache', 'Amazon Redshift', 'Amazon S3 Glacier', 'Amazon EBS'], 0, '**ElastiCache** keeps frequently read data in memory.'),
        q('Which storage option should hold temporary scratch data that can be lost if the instance stops, at the highest speed?', ['Amazon EBS', 'Instance store', 'Amazon S3', 'Amazon EFS'], 1, 'Instance store is the fastest, but temporary.'),
        q('A company must retain audit records for 7 years, rarely reads them, and can wait hours for a retrieval. What is the most cost-effective storage?', ['S3 Standard', 'S3 Glacier Deep Archive', 'Amazon EBS', 'S3 Standard-IA'], 1, 'Long-term, rarely read, hours acceptable: **Glacier Deep Archive**.'),
        q('Which statement about security groups is true?', ['They can contain deny rules', 'They are stateless', 'They are stateful and allow return traffic automatically', 'They apply to whole subnets'], 2, 'Security groups are stateful, instance-level and allow-only.'),
        q('A mobile game needs a database that handles millions of requests per second with consistent single-digit millisecond latency and no servers to manage. Which fits?', ['Amazon RDS for MySQL', 'Amazon DynamoDB', 'Amazon Redshift', 'A database on EC2'], 1, 'Massive scale, millisecond latency, serverless: **DynamoDB**.'),
        q('Which service helps migrate a production database to AWS while the source database keeps running?', ['AWS Database Migration Service', 'AWS Snowball Edge', 'Amazon S3 Transfer Acceleration', 'AWS Backup'], 0, '**DMS** keeps the source operational during migration.'),
        q('A company wants to route traffic to a backup site automatically when its primary site\'s health check fails. Which Route 53 routing policy fits?', ['Weighted', 'Geolocation', 'Failover', 'Simple'], 2, '**Failover routing** switches to the secondary when the primary is unhealthy.'),
        q('Which is a characteristic of Amazon S3?', ['Data is stored as blocks attached to one instance', 'It is designed for 99.999999999% durability', 'Objects are limited to 5 GB', 'Buckets are shared file systems mounted over NFS'], 1, 'S3 is designed for eleven nines of durability, with objects up to 5 TB.'),
      ],
    }),
  ],
};
