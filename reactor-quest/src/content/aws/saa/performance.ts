// SAA-C03 Domain 3: Design High-Performing Architectures (24% of the exam).
import type { Deck } from '../../../game/types';
import { checkpoint, lesson, q } from '../kit';

export const saaPerformance: Deck = {
  id: 'saa-performance',
  name: 'High-Performing Architectures',
  subtitle: 'Domain 3 · 24% of the exam',
  outcome: 'Pick fast storage, cache what you can, choose the right compute and database, and move data at scale.',
  hue: 45,
  domain: 'saa-d3',
  levels: [
    lesson({
      id: 'saa-storage-performance',
      title: 'Fast Storage',
      system: 'Hyperdrive Disks',
      skills: ['aws-storage', 'aws-architecture'],
      brief: `**ARIA:** The analytics job is slow, and it's the disks. Every storage service has performance knobs. Learn which to turn.`,
      lesson: `## EBS volume types

| Type | Kind | Best for |
|---|---|---|
| **gp3** | General purpose SSD | Most workloads. **3,000 IOPS and 125 MB/s baseline**, and you can raise IOPS and throughput **independently of size**. Cheaper than gp2. |
| **io2 Block Express** | Provisioned IOPS SSD | The most demanding databases: very high IOPS, sub-millisecond latency, high durability; supports **Multi-Attach** |
| **st1** | Throughput-optimised HDD | Big sequential reads: log processing, data warehouses |
| **sc1** | Cold HDD | Infrequently accessed sequential data, lowest cost |

HDD volumes can't be boot volumes. **Instance store** is fastest of all, but temporary.

## Shared file systems

- **EFS:** NFS for Linux; **Elastic throughput** mode scales automatically; **Max I/O** performance mode for highly parallel workloads; storage classes with lifecycle (Standard, Infrequent Access, Archive).
- **FSx for Lustre:** **high-performance computing and ML** with sub-millisecond latency and huge throughput; can be **linked to an S3 bucket**.
- **FSx for Windows File Server:** SMB, Active Directory, DFS.
- **FSx for NetApp ONTAP:** multi-protocol (NFS, SMB, iSCSI), snapshots, clones.

## Amazon S3 performance

- At least **3,500 PUT/COPY/POST/DELETE and 5,500 GET/HEAD requests per second per prefix**: spread objects across prefixes for more.
- **Multipart upload** for large objects (recommended above 100 MB, required above 5 GB): parallel parts, retry individual parts.
- **Byte-range fetches** download parts of an object in parallel.
- **S3 Transfer Acceleration:** faster long-distance uploads through CloudFront edge locations.
- **S3 Express One Zone:** single-digit millisecond access in one AZ, for the most latency-sensitive workloads.`,
      questions: [
        q('A database needs 6,000 IOPS on a 200 GB volume at the lowest cost. Which EBS type fits?', ['gp3 with provisioned IOPS raised to 6,000', 'io2 Block Express', 'st1', 'sc1'], 0, 'gp3 lets you set IOPS independently of size, cheaper than io2.'),
        q('A machine learning cluster needs a high-performance file system that reads its training data from S3. Which fits?', ['Amazon EFS', 'Amazon FSx for Lustre linked to S3', 'Amazon EBS gp3', 'FSx for Windows File Server'], 1, 'FSx for Lustre is built for HPC/ML and integrates with S3.'),
        q('Users around the world upload large files to one S3 bucket and uploads are slow. What helps most?', ['S3 Transfer Acceleration and multipart upload', 'S3 One Zone-IA', 'S3 Object Lock', 'Requester Pays'], 0, 'Transfer Acceleration uses edge locations; multipart upload parallelises.'),
        q('An application needs more than 5,500 GET requests per second to one bucket. What design helps?', ['Spread objects across multiple prefixes', 'Use one prefix for everything', 'Enable versioning', 'Use Glacier Instant Retrieval'], 0, 'The request rate limit applies per prefix.'),
        q('A log-processing job reads large files sequentially and needs high throughput at low cost. Which EBS type fits?', ['io2 Block Express', 'st1 throughput-optimised HDD', 'gp3', 'sc1 as a boot volume'], 1, 'st1 is designed for big sequential throughput.'),
        q('A clustered application requires the same block volume attached to several instances at once. Which EBS feature fits?', ['io2 with Multi-Attach', 'gp3 snapshots', 'st1', 'EBS encryption'], 0, 'Multi-Attach is supported on Provisioned IOPS (io1/io2) volumes.'),
      ],
    }),
    lesson({
      id: 'saa-caching',
      title: 'Caching',
      system: 'Quick Access Shelves',
      skills: ['aws-architecture', 'aws-databases'],
      brief: `**ARIA:** The fastest request is the one that never reaches your database. Caches at every layer, and the trade-offs each one makes.`,
      lesson: `## Where to cache

| Layer | Service | Caches |
|---|---|---|
| Edge | **CloudFront** | Static and dynamic content near users; TTLs, cache policies, origin shield |
| API | **API Gateway caching** | Responses per stage |
| Application | **ElastiCache** (Valkey, Redis OSS, Memcached) | Query results, sessions, computed values |
| DynamoDB | **DAX** (DynamoDB Accelerator) | Item reads in **microseconds**, with **no application rewrite** (API-compatible) |
| Database | **RDS/Aurora read replicas** | Not a cache, but offload reads |

## ElastiCache engines

- **Valkey / Redis OSS:** data structures (sorted sets for **leaderboards**), replication, **Multi-AZ failover**, persistence, pub/sub.
- **Memcached:** simple, multi-threaded, **no replication or persistence**; scale out by adding nodes.

## Caching strategies

- **Lazy loading (cache-aside):** read the cache; on a miss, read the DB and write the cache. Only requested data is cached, but the first read is slow and data can be stale.
- **Write-through:** write to the cache whenever you write to the DB. Never stale, but caches data nobody reads.
- **TTL:** expire entries so stale data ages out. Most designs combine lazy loading with a TTL.

## CloudFront details

- **Origins:** S3, ALB, EC2, API Gateway, any HTTP server; **origin groups** for failover.
- **Cache key:** which headers, cookies and query strings vary the cached copy. Fewer → higher hit ratio.
- **Lambda@Edge / CloudFront Functions:** run code at the edge (rewrites, auth headers).`,
      questions: [
        q('A DynamoDB-backed app needs microsecond read latency without changing its data access code. What should be added?', ['ElastiCache for Memcached', 'DynamoDB Accelerator (DAX)', 'A read replica', 'CloudFront'], 1, 'DAX is API-compatible with DynamoDB and returns cached reads in microseconds.'),
        q('A game needs a real-time leaderboard with sorted rankings. Which fits best?', ['ElastiCache for Redis OSS/Valkey (sorted sets)', 'ElastiCache for Memcached', 'Amazon S3', 'Amazon Athena'], 0, 'Sorted sets make leaderboards trivial.'),
        q('Which caching strategy ensures the cache is never stale, at the cost of caching data that might not be read?', ['Lazy loading', 'Write-through', 'TTL only', 'No caching'], 1, 'Write-through updates the cache on every write.'),
        q('A product catalogue is read thousands of times per second but changes rarely, and RDS CPU is high. What helps most?', ['Cache query results in ElastiCache with a TTL', 'Enable Multi-AZ', 'Use a bigger NAT gateway', 'Move to S3 Glacier'], 0, 'Caching hot, rarely changing reads relieves the database.'),
        q('CloudFront\'s cache hit ratio is low because every request includes a unique tracking query string. What should be changed?', ['Remove that query string from the cache key', 'Shorten the TTL to zero', 'Add more origins', 'Disable compression'], 0, 'Excluding irrelevant query strings from the cache key improves hits.'),
        q('Which ElastiCache engine should be used when the cache must replicate across AZs and fail over automatically?', ['Memcached', 'Valkey or Redis OSS with Multi-AZ', 'Either: both replicate', 'Neither'], 1, 'Memcached has no replication; Valkey/Redis OSS supports Multi-AZ failover.'),
      ],
    }),
    lesson({
      id: 'saa-compute-performance',
      title: 'The Right Compute',
      system: 'Engine Tuning',
      skills: ['aws-compute', 'aws-architecture'],
      brief: `**ARIA:** Servers, containers or functions? Close together or far apart? The exam gives you a workload and asks for the best fit.`,
      lesson: `## Choosing compute

| Workload | Good fit |
|---|---|
| Event-driven, short (< 15 min), spiky | **Lambda** |
| Containers without managing servers | **ECS or EKS on Fargate** |
| Containers needing GPUs, specific instance types, or lowest cost at steady scale | ECS/EKS on **EC2** |
| Long-running, full OS control, licences | **EC2** |
| Batch jobs at scale | **AWS Batch** (on EC2, Spot or Fargate) |
| Simple web app from code or image | **App Runner** or **Elastic Beanstalk** |

## Lambda performance

- **Memory setting controls CPU** too: more memory = more CPU = often faster *and* cheaper per run.
- **Cold starts:** use **provisioned concurrency** to keep functions initialised for latency-sensitive APIs (SnapStart for Java, Python and .NET).
- **Reserved concurrency** guarantees (and caps) concurrency for one function.

## EC2 performance

- **Placement groups:**
  - **Cluster:** instances packed close in **one AZ** for the **lowest latency and highest throughput** between them (HPC).
  - **Spread:** each instance on **distinct hardware** (max 7 per AZ) for critical instances.
  - **Partition:** groups of instances on separate racks, for big distributed systems (HDFS, Cassandra, Kafka).
- **Enhanced networking (ENA)** for high packet rates; **Elastic Fabric Adapter (EFA)** for HPC and ML that need very low-latency inter-node communication.
- **Graviton** (Arm) instances: better price-performance for many workloads.
- **Compute Optimizer** recommends instance types from real usage.`,
      questions: [
        q('An HPC application needs the lowest possible network latency between its instances. Which placement group fits?', ['Spread', 'Cluster', 'Partition', 'None'], 1, 'Cluster placement packs instances close together in one AZ.'),
        q('Five critical instances must never share underlying hardware. Which placement group fits?', ['Cluster', 'Spread', 'Partition', 'Dedicated Host'], 1, 'Spread placement puts each instance on distinct hardware.'),
        q('A latency-sensitive API on Lambda suffers from cold starts. What helps?', ['Provisioned concurrency', 'Lower memory', 'Reserved concurrency of zero', 'A NAT gateway'], 0, 'Provisioned concurrency keeps execution environments initialised.'),
        q('A Lambda function is CPU-bound and slow. What is the first thing to try?', ['Increase its memory setting, which also increases CPU', 'Add a DLQ', 'Move it to a private subnet', 'Use a FIFO queue'], 0, 'Lambda allocates CPU in proportion to memory.'),
        q('A company wants to run containers without managing servers or clusters of EC2 instances. Which fits?', ['ECS on EC2', 'ECS or EKS on Fargate', 'EC2 Auto Scaling', 'AWS Outposts'], 1, 'Fargate removes server management for containers.'),
        q('A distributed database like Cassandra needs replicas spread across separate racks to limit correlated failures. Which placement group fits?', ['Cluster', 'Partition', 'Spread with one instance', 'None'], 1, 'Partition placement groups isolate groups of instances on separate racks.'),
      ],
    }),
    lesson({
      id: 'saa-database-choice',
      title: 'Choosing the Database',
      system: 'Archive Selection',
      skills: ['aws-databases', 'aws-architecture'],
      brief: `**ARIA:** "Purpose-built databases" is AWS's motto. The exam gives a data shape and an access pattern; you pick the engine and tune it.`,
      lesson: `## Match the data

| Data and access | Choose |
|---|---|
| Relational, transactions, joins | **RDS** or **Aurora** |
| Relational, unpredictable or intermittent load | **Aurora Serverless v2** |
| Key-value at any scale, single-digit ms | **DynamoDB** |
| Documents (JSON), MongoDB-compatible | **DocumentDB** |
| Relationships, graph traversals | **Neptune** |
| Time-series metrics | **Timestream** |
| Analytics on structured data, columnar | **Redshift** |
| Full-text search, log analytics | **OpenSearch Service** |
| In-memory primary database with durability | **MemoryDB** |

## DynamoDB performance

- **Partition key** choice spreads load: high-cardinality keys avoid **hot partitions**.
- **Global secondary indexes (GSI):** query by other attributes (own capacity). **Local secondary indexes** must be created with the table.
- Capacity modes: **on-demand** (pay per request; spiky or unknown traffic) or **provisioned** with **auto scaling** (steady, predictable; cheaper).
- **DynamoDB Streams** capture changes for triggers and replication. **TTL** deletes expired items for free.

## Relational performance

- **Read replicas** for read-heavy loads (Aurora: up to 15, shared storage).
- **RDS Proxy** for many short-lived connections (Lambda).
- **Aurora** gives higher throughput than standard MySQL/PostgreSQL on RDS.
- **Performance Insights** finds slow queries.`,
      questions: [
        q('A shopping cart service needs single-digit millisecond reads and writes at any scale, accessed by cart ID. Which database fits?', ['Amazon Redshift', 'Amazon DynamoDB', 'Amazon Neptune', 'Amazon RDS for Oracle'], 1, 'Key-value access at scale is DynamoDB\'s strength.'),
        q('A DynamoDB table throttles because most writes go to a few partition key values. What fixes it?', ['A partition key with higher cardinality that spreads writes', 'More LSIs', 'Switching to Memcached', 'Using a smaller item size'], 0, 'Even key distribution avoids hot partitions.'),
        q('A social network needs to find "friends of friends who like the same bands" quickly. Which database fits?', ['Amazon Neptune', 'Amazon DynamoDB', 'Amazon Redshift', 'Amazon Timestream'], 0, 'Graph traversals are Neptune\'s purpose.'),
        q('A relational application has unpredictable traffic with long idle periods. Which option minimises management while scaling automatically?', ['Aurora Serverless v2', 'RDS on a fixed large instance', 'DynamoDB provisioned mode', 'Redshift'], 0, 'Aurora Serverless v2 scales capacity up and down automatically.'),
        q('Users need to query a DynamoDB table by email address, which isn\'t the partition key. What should be added?', ['A global secondary index on email', 'A scan on every request', 'A read replica', 'DAX'], 0, 'GSIs let you query by alternative keys.'),
        q('IoT sensors send millions of temperature readings per minute that must be queried by time range. Which database is purpose-built for this?', ['Amazon Timestream', 'Amazon Neptune', 'Amazon DocumentDB', 'Amazon Aurora'], 0, 'Timestream is built for time-series data.'),
      ],
    }),
    lesson({
      id: 'saa-data-ingestion',
      title: 'Moving Data at Scale',
      system: 'Data Pipelines',
      skills: ['aws-architecture', 'aws-storage'],
      brief: `**ARIA:** Millions of events a minute, terabytes to migrate, queries over a data lake. Pick the pipeline that keeps up.`,
      lesson: `## Streaming

| | Kinesis Data Streams | Amazon Data Firehose | Amazon MSK |
|---|---|---|---|
| What | Real-time stream you consume with your own code | **Fully managed delivery** to S3, Redshift, OpenSearch, Splunk, HTTP endpoints | Managed **Apache Kafka** |
| Latency | Real time (ms) | **Near real time** (buffers seconds) | Real time |
| Scaling | Shards (or on-demand mode) | Automatic | Brokers (or MSK Serverless) |
| Replay | **Yes** (retention 24h to 365 days) | No | Yes |
| Transform | In your consumers | Lambda transforms, format conversion to **Parquet/ORC** | In your consumers |

Rule of thumb: "**load streaming data into S3/Redshift with no code**" → **Firehose**. "**Custom real-time processing, multiple consumers, replay**" → **Kinesis Data Streams**.

## Analytics on a data lake

- Store in S3 in **columnar formats (Parquet, ORC)**, **compressed**, and **partitioned** (by date): **Athena** scans less data → faster and cheaper.
- **Glue** crawlers build the **Data Catalog**; Glue jobs transform data.
- **Redshift Spectrum** queries S3 from Redshift.
- **EMR** for Spark/Hadoop at scale.

## Bulk transfer

| Need | Service |
|---|---|
| Online sync from on-premises NFS/SMB to S3/EFS/FSx, scheduled | **AWS DataSync** |
| SFTP/FTPS endpoints for partners into S3 | **AWS Transfer Family** |
| Tens of TB+ with slow networks | **Snowball Edge** |
| Ongoing hybrid access to cloud storage | **Storage Gateway** |
| Database migration, minimal downtime | **DMS** (+ SCT) |`,
      questions: [
        q('Clickstream data must be loaded into S3 in Parquet format with no custom code. Which service fits?', ['Kinesis Data Streams with EC2 consumers', 'Amazon Data Firehose with format conversion', 'AWS DataSync', 'Amazon SQS'], 1, 'Firehose delivers to S3 and converts to Parquet with no code.'),
        q('Several applications must each process the same real-time event stream, and be able to replay the last 3 days. Which fits?', ['Amazon Data Firehose', 'Kinesis Data Streams with extended retention', 'Amazon SQS standard queue', 'Amazon SNS'], 1, 'Kinesis Data Streams supports multiple consumers and replay within retention.'),
        q('Athena queries on CSV logs in S3 are slow and expensive. What improves both?', ['Convert to compressed Parquet and partition by date', 'Move the logs to EBS', 'Use S3 Standard-IA', 'Enable S3 versioning'], 0, 'Columnar, compressed, partitioned data cuts scanned bytes.'),
        q('Partners must upload files to S3 using SFTP. Which service fits with the least management?', ['AWS Transfer Family', 'An EC2 SFTP server', 'AWS DataSync', 'Amazon WorkDocs'], 0, 'Transfer Family provides managed SFTP endpoints backed by S3.'),
        q('A company must copy 300 TB from an on-premises NAS to S3 over a 1 Gbps link that is already busy. Which is fastest?', ['AWS DataSync over the internet', 'AWS Snowball Edge devices', 'S3 Transfer Acceleration', 'A Site-to-Site VPN'], 1, 'At that size and bandwidth, shipping Snowball Edge devices is faster.'),
        q('A company needs a scheduled, automated, online transfer of files from on-premises NFS shares to Amazon EFS. Which fits?', ['AWS DataSync', 'AWS Snowball Edge', 'Amazon Kinesis', 'AWS Backup'], 0, 'DataSync automates online transfers to S3, EFS and FSx.'),
      ],
    }),
    checkpoint({
      id: 'saa-performance-checkpoint',
      title: 'Checkpoint: High-Performing Architectures',
      system: 'Performance Certification Gate',
      skills: ['aws-architecture', 'aws-databases', 'aws-storage'],
      brief: `**ARIA:** Associate-level scenarios on storage, caching, compute, databases and pipelines.`,
      lesson: `## Before you start

- gp3 (IOPS independent of size), io2 Block Express (highest), st1 (throughput HDD). FSx for Lustre = HPC/ML. S3 per-prefix limits, multipart, Transfer Acceleration.
- CloudFront, ElastiCache (Redis/Valkey vs Memcached), DAX for DynamoDB.
- Placement groups: cluster / spread / partition. Lambda memory = CPU; provisioned concurrency.
- Firehose = managed delivery; Kinesis Data Streams = custom real time with replay. Parquet + partitions for Athena.`,
      questions: [
        q('A news site\'s images are served from S3 to users worldwide and load slowly far from the bucket\'s Region. What is the best fix?', ['S3 Cross-Region Replication to every Region', 'Serve the images through CloudFront', 'Use S3 Transfer Acceleration for downloads', 'Move images to EBS'], 1, 'CloudFront caches content near users.'),
        q('A database on EC2 needs consistent sub-millisecond latency and 100,000+ IOPS. Which storage fits?', ['gp3', 'io2 Block Express', 'st1', 'EFS Standard'], 1, 'io2 Block Express provides the highest IOPS and lowest latency.'),
        q('Session data for a web tier must be fast and survive an AZ failure. Which fits?', ['ElastiCache for Memcached', 'ElastiCache for Valkey/Redis OSS with Multi-AZ', 'Instance store', 'S3 Glacier'], 1, 'Replicated Redis/Valkey keeps sessions through an AZ failure.'),
        q('Thousands of IoT devices send data that needs custom real-time anomaly detection by two separate applications. Which ingestion service fits?', ['Amazon Data Firehose to S3', 'Kinesis Data Streams', 'AWS DataSync', 'S3 batch uploads every hour'], 1, 'Kinesis Data Streams supports multiple real-time consumers.'),
        q('A Lambda function processing images runs slowly and costs a lot. Profiling shows it is CPU-bound. What should be done?', ['Raise the memory setting', 'Add reserved concurrency of 1', 'Move the function into a VPC', 'Increase the timeout only'], 0, 'More memory gives more CPU, often reducing duration and cost.'),
        q('An application\'s reads from DynamoDB are mostly for the same few thousand hot items. What reduces latency the most with the fewest code changes?', ['DynamoDB Accelerator (DAX)', 'A global secondary index', 'DynamoDB Streams', 'On-demand capacity'], 0, 'DAX caches hot items with an API-compatible client.'),
        q('A genomics workload on many instances needs low-latency, high-bandwidth communication between nodes using MPI. What should be used?', ['Instances with Elastic Fabric Adapter in a cluster placement group', 'Spread placement group with gp2 volumes', 'Lambda functions', 'A NAT gateway per instance'], 0, 'EFA plus cluster placement suits tightly coupled HPC.'),
        q('Which change makes Athena queries over a 10 TB S3 data lake cheaper?', ['Partition the data and store it as compressed Parquet', 'Store it as uncompressed JSON', 'Move it to S3 Glacier Deep Archive', 'Turn on versioning'], 0, 'Athena charges per byte scanned; columnar, compressed, partitioned data scans less.'),
      ],
    }),
  ],
};
