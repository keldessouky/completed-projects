// CLF-C02 Domain 1: Cloud Concepts (24% of the exam).
import type { Deck } from '../../../game/types';
import { checkpoint, lesson, q } from '../kit';

export const clfConcepts: Deck = {
  id: 'clf-concepts',
  name: 'Cloud Concepts',
  subtitle: 'Domain 1 · 24% of the exam',
  outcome: 'Explain what the cloud is, why companies move to it, and how AWS says to build on it.',
  hue: 205,
  domain: 'clf-d1',
  levels: [
    lesson({
      id: 'clf-what-is-cloud',
      title: 'What the Cloud Is',
      system: 'Ground Control Uplink',
      skills: ['cloud-concepts'],
      brief: `**ARIA:** The station's ground control runs in the cloud, and nobody down there has the certificate to prove they understand it. Let's fix that, starting from the very beginning.`,
      lesson: `## Cloud computing

**Cloud computing** is the **on-demand delivery of IT resources over the internet with pay-as-you-go pricing**. Instead of buying servers, storage and data centres, you rent them from a provider like AWS, for as long as you need them, and pay only for what you use.

- **On demand:** you get resources in minutes, when you ask, with no purchase orders or waiting for hardware.
- **Over the internet:** you reach them from anywhere, through a browser, a command line or code.
- **Pay as you go:** no big payment up front; you pay for what you actually use.

## The three service models

| Model | You manage | The provider manages | Example |
|---|---|---|---|
| **IaaS** (Infrastructure as a Service) | The OS, apps and data | The hardware, network and virtualisation | Amazon EC2 virtual servers |
| **PaaS** (Platform as a Service) | Your app and data | Everything under it: servers, OS, runtime | AWS Elastic Beanstalk |
| **SaaS** (Software as a Service) | Just using it | The whole application | Web email, Amazon Chime |

The further from IaaS you go, the less you manage and the less you control.

## Who's who

**AWS** (Amazon Web Services) offers over 200 services from data centres around the world. You pay with an **AWS account**; everything you create lives in it.`,
      questions: [
        q('Which is the best definition of cloud computing?', ['Storing all of a company\'s files on a single shared server', 'The on-demand delivery of IT resources over the internet with pay-as-you-go pricing', 'Buying servers in bulk to get a discount', 'Running software only inside a web browser'], 1, 'That\'s AWS\'s own definition, and the exam uses it: on demand, over the internet, pay as you go.'),
        q('A company wants to run its own operating system and software, but not buy or maintain any physical servers. Which model fits?', ['SaaS', 'PaaS', 'IaaS', 'On-premises'], 2, 'With **IaaS** you rent the infrastructure (virtual servers, storage, network) and manage everything on top of it, including the operating system.'),
        q('A developer wants to upload their code and have the platform handle the servers, operating system and runtime for them. Which model is this?', ['IaaS', 'PaaS', 'SaaS', 'Colocation'], 1, '**PaaS** manages the platform under your app. AWS Elastic Beanstalk is the classic example: upload the code, and it provisions and runs everything.'),
        q('Which is an example of **SaaS**?', ['A virtual server you install software on', 'A database engine you patch yourself', 'A complete web email service you simply log in to and use', 'A rack of servers you rent in a data centre'], 2, 'With SaaS the provider runs the whole application; you just use it.'),
        q('What does "pay as you go" mean for a cloud customer?', ['You pay a large fixed fee before you can start', 'You pay only for the resources you actually use, as you use them', 'You pay once and use the service forever', 'You pay for the maximum capacity you might ever need'], 1, 'No up-front commitment: costs follow usage, so they shrink when you use less.'),
        q('In which model does the customer manage the **most**?', ['SaaS', 'PaaS', 'IaaS', 'They all require the same'], 2, 'IaaS gives you the most control, and the most to manage: the OS, patches, apps and data are all yours.'),
      ],
    }),
    lesson({
      id: 'clf-benefits',
      title: 'Why the Cloud',
      system: 'Mission Planning',
      skills: ['cloud-concepts'],
      brief: `**ARIA:** Ground control's finance team keeps asking why we don't just buy our own servers. Learn the answer the exam wants: AWS's six advantages of cloud computing.`,
      lesson: `## The six advantages of cloud computing

Learn these word for word; the exam quotes them.

1. **Trade fixed expense for variable expense.** Pay for what you use instead of investing in data centres and servers before you know how you'll use them.
2. **Benefit from massive economies of scale.** AWS buys at enormous scale, and passes the savings on as lower prices.
3. **Stop guessing capacity.** Scale up or down as needed, instead of buying too much (idle servers) or too little (outages at peak).
4. **Increase speed and agility.** New resources are a click away, so you can experiment and deliver faster.
5. **Stop spending money running and maintaining data centres.** Focus on your customers, not on racking and powering servers.
6. **Go global in minutes.** Deploy in AWS Regions around the world, close to your users, in a few clicks.

## Words the exam loves

- **Scalability:** the ability to grow to handle more load (add bigger or more resources).
- **Elasticity:** scaling **automatically** with demand, out *and back in*, so you never pay for idle capacity.
- **High availability:** the system keeps running with little downtime, usually by running in more than one place.
- **Fault tolerance:** the system keeps working even when a component fails, with no interruption.
- **Agility:** how fast you can try new things. In the cloud, a failed experiment costs little.`,
      questions: [
        q('A startup doesn\'t know how popular its new app will be. Which advantage of the cloud helps most?', ['Trade fixed expense for variable expense', 'Stop guessing capacity', 'Benefit from massive economies of scale', 'Go global in minutes'], 1, 'They can start small and scale as demand appears, instead of guessing how many servers to buy.'),
        q('Which advantage describes AWS passing on lower prices because of its huge number of customers?', ['Benefit from massive economies of scale', 'Increase speed and agility', 'Stop guessing capacity', 'Trade fixed expense for variable expense'], 0, 'Aggregated usage from hundreds of thousands of customers gives AWS economies of scale, which lowers pay-as-you-go prices.'),
        q('A website automatically adds servers during a sale and removes them afterwards. What is this called?', ['Fault tolerance', 'Elasticity', 'High availability', 'Durability'], 1, '**Elasticity** is scaling automatically with demand, in both directions, so capacity matches load.'),
        q('Instead of buying servers up front, a company pays monthly for what it uses. Which advantage is this?', ['Go global in minutes', 'Increase speed and agility', 'Trade fixed expense for variable expense', 'Stop spending money running data centres'], 2, 'Up-front capital spending (fixed) becomes usage-based spending (variable).'),
        q('A company wants to serve users in Asia with low latency without building a data centre there. Which advantage applies?', ['Go global in minutes', 'Stop guessing capacity', 'Benefit from massive economies of scale', 'Trade fixed expense for variable expense'], 0, 'Deploying to an AWS Region in Asia takes minutes.'),
        q('A system keeps running with no interruption even when one of its servers fails. Which term describes this best?', ['Elasticity', 'Agility', 'Fault tolerance', 'Scalability'], 2, '**Fault tolerance** means continuing to operate through a component failure. High availability is related, but allows a short interruption.'),
      ],
    }),
    lesson({
      id: 'clf-deployment',
      title: 'Deployment Models',
      system: 'Relay Topology',
      skills: ['cloud-concepts'],
      brief: `**ARIA:** Some of ground control's systems are in the cloud, some still sit in a basement. The exam calls that a deployment model. There are three.`,
      lesson: `## Three ways to deploy

| Model | What it means | When it fits |
|---|---|---|
| **Cloud** (cloud-native, all-in) | Everything runs in the cloud | New apps, or companies moving everything |
| **Hybrid** | Some resources in the cloud, some on-premises, **connected** | Gradual migrations, or data that must stay in your own building |
| **On-premises** (private cloud) | Everything in your own data centre, often using cloud-like virtualisation and automation | Strict rules that require it, or existing heavy investment |

**On-premises** means in your own building, on hardware you own.

## Connecting hybrid setups

Hybrid needs a link between your data centre and AWS:

- **AWS Site-to-Site VPN:** an encrypted tunnel over the public internet. Quick to set up.
- **AWS Direct Connect:** a dedicated private network connection to AWS. More consistent performance, not over the internet.
- **AWS Outposts:** AWS hardware installed **in your own data centre**, running AWS services there.

## Why migrate at all?

Moving from on-premises to the cloud usually aims for lower total cost, faster delivery and global reach, and the six advantages from the last lesson.`,
      questions: [
        q('A company keeps its customer database in its own data centre but runs its website on AWS, with the two connected. Which deployment model is this?', ['Cloud', 'Hybrid', 'On-premises', 'Multi-cloud'], 1, 'Part on-premises and part in the cloud, connected: that\'s **hybrid**.'),
        q('A brand-new company builds every system on AWS from day one. Which deployment model is this?', ['Hybrid', 'On-premises', 'Cloud', 'Private cloud'], 2, 'All in the cloud is the **cloud** (cloud-native) deployment model.'),
        q('Which deployment model is also called a **private cloud**?', ['Hybrid', 'Cloud', 'On-premises', 'Edge'], 2, 'On-premises deployments that use virtualisation and automation like a cloud are often called private clouds.'),
        q('Which AWS service puts AWS-managed hardware inside a customer\'s own data centre?', ['AWS Direct Connect', 'AWS Outposts', 'AWS Snowball Edge', 'Amazon CloudFront'], 1, '**Outposts** brings AWS infrastructure and services on-premises, for low latency or local data processing.'),
        q('Which gives a hybrid setup a **dedicated private** network connection to AWS that doesn\'t go over the public internet?', ['AWS Site-to-Site VPN', 'AWS Direct Connect', 'Amazon Route 53', 'An internet gateway'], 1, '**Direct Connect** is a private, dedicated line. A Site-to-Site VPN is encrypted but travels over the internet.'),
        q('A company must, by regulation, keep certain data in its own building but wants cloud flexibility for everything else. Which model fits?', ['Cloud', 'On-premises only', 'Hybrid', 'SaaS'], 2, 'Hybrid keeps the regulated data on-premises and puts everything else in the cloud.'),
      ],
    }),
    lesson({
      id: 'clf-well-architected',
      title: 'The Well-Architected Framework',
      system: 'Blueprint Archive',
      skills: ['cloud-concepts', 'aws-architecture'],
      brief: `**ARIA:** AWS has a rulebook for building well: the Well-Architected Framework. Six pillars. Expect several exam questions that describe a goal and ask which pillar it belongs to.`,
      lesson: `## The six pillars

| Pillar | It's about | Example practices |
|---|---|---|
| **Operational Excellence** | Running and monitoring systems, and improving processes | Infrastructure as code, small reversible changes, learning from failures |
| **Security** | Protecting data, systems and assets | Least privilege, encryption, traceability, security at every layer |
| **Reliability** | Recovering from failure and meeting demand | Automatic recovery, scaling horizontally, testing recovery |
| **Performance Efficiency** | Using resources efficiently as demand and technology change | Choosing the right resource types, going global, using serverless |
| **Cost Optimization** | Delivering value at the lowest price | Paying only for what you use, measuring efficiency, managed services |
| **Sustainability** | Minimising environmental impact | Maximising utilisation, using efficient hardware and managed services |

Memory hook: **"SPORCS"**: Security, Performance efficiency, Operational excellence, Reliability, Cost optimization, Sustainability.

## The Well-Architected Tool

The **AWS Well-Architected Tool** is a free service in the console: you answer questions about a workload, and it checks it against the pillars and suggests improvements.

## General design principles

- **Stop guessing capacity needs**; scale with demand.
- **Test systems at production scale**, then tear the test down.
- **Automate** to make experiments easy.
- **Allow for evolutionary architectures**: design to change over time.
- **Drive architectures using data**, and **improve through game days** (practice failures).`,
      questions: [
        q('A company wants its application to recover automatically when a server fails. Which pillar is this?', ['Performance Efficiency', 'Reliability', 'Operational Excellence', 'Security'], 1, '**Reliability** covers recovering from failures and meeting demand.'),
        q('Which pillar focuses on reducing the environmental impact of running workloads?', ['Cost Optimization', 'Performance Efficiency', 'Sustainability', 'Operational Excellence'], 2, '**Sustainability**, the sixth pillar, is about minimising environmental impact.'),
        q('A team defines its infrastructure as code and makes small, frequent, reversible changes. Which pillar does this support most?', ['Operational Excellence', 'Cost Optimization', 'Reliability', 'Sustainability'], 0, 'Infrastructure as code and small reversible changes are core **Operational Excellence** practices.'),
        q('Granting each user only the permissions they need belongs to which pillar?', ['Reliability', 'Operational Excellence', 'Performance Efficiency', 'Security'], 3, 'Least privilege is a **Security** pillar principle.'),
        q('Selecting the right instance type for a workload, and revisiting the choice as new types appear, belongs to which pillar?', ['Reliability', 'Performance Efficiency', 'Security', 'Sustainability'], 1, '**Performance Efficiency** is about using the right resources efficiently as needs and technology change.'),
        q('Which AWS tool reviews a workload against the Well-Architected Framework?', ['AWS Trusted Advisor', 'AWS Config', 'AWS Well-Architected Tool', 'AWS Artifact'], 2, 'The **Well-Architected Tool** asks questions about a workload and reports issues by pillar. (Trusted Advisor runs automated checks on your account, a different thing.)'),
      ],
    }),
    lesson({
      id: 'clf-caf-migration',
      title: 'Adoption and Migration',
      system: 'Transfer Corridor',
      skills: ['cloud-concepts'],
      brief: `**ARIA:** Ground control has fifty old systems to move. AWS has a framework for planning the move, and names for every way to move an app. Both are on the exam.`,
      lesson: `## The Cloud Adoption Framework (AWS CAF)

The **AWS CAF** helps organisations plan their move to the cloud. It groups the capabilities you need into six **perspectives**:

| Business-focused | Technical |
|---|---|
| **Business**: ensures cloud investments serve business goals | **Platform**: builds the cloud platform and architecture |
| **People**: culture, skills, training and change management | **Security**: confidentiality, integrity and availability of data and workloads |
| **Governance**: manages risk, portfolio and benefits | **Operations**: delivers cloud services at the agreed level of service |

The CAF says adoption brings: **reduced business risk, improved ESG performance, increased revenue, and increased operational efficiency.**

## The 7 Rs of migration

| Strategy | What you do |
|---|---|
| **Retire** | Turn it off: nobody needs it |
| **Retain** | Keep it where it is, for now |
| **Rehost** ("lift and shift") | Move it as it is, onto EC2 |
| **Relocate** | Move a whole virtualised environment (such as VMware) without changes |
| **Repurchase** ("drop and shop") | Replace it with a different product, often SaaS |
| **Replatform** ("lift, tinker and shift") | Small optimisations, like moving a database to Amazon RDS |
| **Refactor / re-architect** | Rebuild it with cloud-native features: the most effort, the most benefit |

## Migration tools

- **AWS Application Migration Service:** automates rehosting servers to AWS.
- **AWS Database Migration Service (DMS):** migrates databases with minimal downtime; the **Schema Conversion Tool** converts between database engines.
- **AWS Snowball Edge:** a physical device for moving huge amounts of data when the network is too slow.
- **AWS Migration Hub** tracks a migration; **Migration Evaluator** builds the business case.`,
      questions: [
        q('A company moves an application to EC2 without changing it. Which migration strategy is this?', ['Replatform', 'Rehost', 'Refactor', 'Repurchase'], 1, 'Moving as-is is **rehosting**, "lift and shift".'),
        q('A company replaces its self-hosted CRM with a SaaS product. Which strategy is this?', ['Repurchase', 'Retire', 'Relocate', 'Rehost'], 0, 'Switching to a different (often SaaS) product is **repurchasing**, "drop and shop".'),
        q('Moving a self-managed database to Amazon RDS during migration, with no other code changes, is which strategy?', ['Rehost', 'Refactor', 'Replatform', 'Retain'], 2, 'A small optimisation in transit, without rewriting the app, is **replatforming**.'),
        q('Which AWS CAF perspective focuses on culture, training and organisational change?', ['Governance', 'People', 'Operations', 'Business'], 1, 'The **People** perspective covers skills, culture and change management.'),
        q('Which AWS CAF perspectives are technical?', ['Business, People and Governance', 'Platform, Security and Operations', 'Business, Security and Platform', 'People, Operations and Governance'], 1, 'Platform, Security and Operations are the technical perspectives; Business, People and Governance are business-focused.'),
        q('A company needs to move 500 TB of data to AWS, but its internet connection would take months. What should it use?', ['AWS Snowball Edge', 'AWS Direct Connect', 'Amazon S3 Transfer Acceleration', 'AWS DataSync'], 0, '**Snowball Edge** devices are shipped to you, filled and shipped back: the fastest way to move very large data offline.'),
      ],
    }),
    lesson({
      id: 'clf-economics',
      title: 'Cloud Economics',
      system: 'Fuel Accounting',
      skills: ['cloud-concepts', 'aws-billing'],
      brief: `**ARIA:** Finance wants numbers. The cloud changes how money is spent, not just how much. Learn the vocabulary they'll use, and the exam will too.`,
      lesson: `## CapEx and OpEx

- **Capital expenditure (CapEx):** money spent up front on physical things you own: servers, buildings. A **fixed** cost.
- **Operational expenditure (OpEx):** ongoing spending on services you use: electricity, salaries, cloud bills. A **variable** cost.

Moving to the cloud turns much CapEx into OpEx.

## Total cost of ownership (TCO)

**TCO** compares the *full* cost of running on-premises against running on AWS. On-premises costs people forget:

- Buildings, power, cooling and physical security
- Hardware refreshes every few years
- Staff to rack, patch and repair servers
- Capacity bought for peak load that sits idle most of the time

## Ways the cloud cuts costs

- **Rightsizing:** choosing the smallest resource that does the job, and changing it when needs change.
- **Managed services** (like Amazon RDS) reduce the work, and the staff time, of running things yourself.
- **Automation** reduces manual work and mistakes.
- **Elasticity** means you stop paying for idle capacity.

## Licensing

- **License included:** the software licence is part of the AWS price (common for Windows Server, SQL Server on RDS).
- **Bring your own license (BYOL):** use licences you already own. Some licences are tied to physical servers or cores, which is when **Dedicated Hosts** matter (more in the billing floor).`,
      questions: [
        q('Buying servers for a new data centre is an example of what?', ['Operational expenditure', 'Capital expenditure', 'Variable expense', 'Pay-as-you-go pricing'], 1, 'Servers you buy and own up front are **capital expenditure** (CapEx).'),
        q('Which cost is easiest to forget when comparing on-premises to AWS for a TCO analysis?', ['The price of AWS EC2 instances', 'Power, cooling and the staff who maintain servers', 'The AWS monthly bill', 'Data transfer into AWS'], 1, 'TCO counts the hidden on-premises costs: facilities, power, cooling, hardware refreshes and staff time.'),
        q('Choosing a smaller instance type because the workload never uses more than 20% of its CPU is called what?', ['Rehosting', 'Rightsizing', 'Overprovisioning', 'Reserving'], 1, '**Rightsizing** matches resource size to actual need.'),
        q('How does using a managed service like Amazon RDS reduce costs?', ['It is always free', 'AWS handles tasks like patching and backups, reducing operational work', 'It removes the need for any database', 'It runs only on the customer\'s hardware'], 1, 'Managed services shift operational work (patching, backups, failover) to AWS, which reduces staff time and errors.'),
        q('A company wants to use Microsoft licences it already owns on AWS. What is this called?', ['License included', 'Bring your own license (BYOL)', 'Savings Plans', 'Repurchasing'], 1, '**BYOL** means using licences you already own, rather than paying for licence-included instances.'),
        q('Which change is typical when moving from on-premises to the cloud?', ['Variable costs become fixed costs', 'Capital expenditure is largely replaced by operational expenditure', 'All costs disappear', 'Staff costs always rise'], 1, 'Instead of buying hardware (CapEx), you pay for usage (OpEx).'),
      ],
    }),
    checkpoint({
      id: 'clf-concepts-checkpoint',
      title: 'Checkpoint: Cloud Concepts',
      system: 'Uplink Certification Gate',
      skills: ['cloud-concepts', 'aws-architecture'],
      brief: `**ARIA:** Exam-style questions from across the floor. Already know this? Pass the checkpoint to prove it.`,
      lesson: `## Before you start

- Six advantages: variable expense, economies of scale, stop guessing capacity, speed and agility, stop running data centres, go global in minutes.
- Deployment models: cloud, hybrid, on-premises.
- Well-Architected pillars: operational excellence, security, reliability, performance efficiency, cost optimization, sustainability.
- CAF perspectives: business, people, governance (business); platform, security, operations (technical).
- Migration: retire, retain, rehost, relocate, repurchase, replatform, refactor.`,
      questions: [
        q('A retailer\'s traffic triples every December. Which cloud characteristic lets it handle the peak without paying for idle servers the rest of the year?', ['Durability', 'Elasticity', 'Fault tolerance', 'Data residency'], 1, 'Elasticity adds capacity for the peak and removes it afterwards.'),
        q('Which Well-Architected pillar includes the practice of "test recovery procedures"?', ['Reliability', 'Security', 'Cost Optimization', 'Sustainability'], 0, 'Testing how you recover from failure is a Reliability design principle.'),
        q('A company runs 200 VMware virtual machines and wants to move them to AWS quickly without changing them or buying new licences. Which strategy fits?', ['Refactor', 'Repurchase', 'Relocate', 'Retire'], 2, '**Relocate** moves a whole virtualised (for example VMware) environment to the cloud without changes.'),
        q('Which statement about the cloud is true?', ['You must commit to three years before using AWS', 'You can provision resources in minutes and release them when finished', 'You pay for maximum capacity whether you use it or not', 'You must manage the physical security of AWS data centres'], 1, 'On-demand provisioning and release is the heart of cloud computing.'),
        q('Rebuilding a monolithic application as serverless microservices to take full advantage of the cloud is which migration strategy?', ['Rehost', 'Replatform', 'Refactor / re-architect', 'Retain'], 2, 'Re-architecting with cloud-native features is **refactoring**: the most work, and the most benefit.'),
        q('Which is a benefit the AWS CAF says cloud adoption brings?', ['Increased business risk', 'Reduced operational efficiency', 'Increased revenue', 'Longer time to market'], 2, 'The CAF lists reduced business risk, improved ESG performance, increased revenue and increased operational efficiency.'),
        q('A company can experiment with a new idea for a few dollars and shut it down if it fails. Which advantage does this show?', ['Increase speed and agility', 'Benefit from massive economies of scale', 'Go global in minutes', 'Stop spending money running data centres'], 0, 'Cheap, fast experiments are what agility means.'),
        q('Which is a design principle of the Well-Architected Framework?', ['Guess capacity needs carefully up front', 'Make large, infrequent changes', 'Automate to make architectural experimentation easier', 'Avoid testing at production scale'], 2, 'Automation, testing at production scale and stopping guessing capacity are all general design principles.'),
      ],
    }),
  ],
};
