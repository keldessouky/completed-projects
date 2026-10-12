// SAA-C03 Domain 1, part 1: secure access to AWS resources.
import type { Deck } from '../../../game/types';
import { checkpoint, lesson, q } from '../kit';

export const saaAccess: Deck = {
  id: 'saa-access',
  name: 'Secure Access',
  subtitle: 'Domain 1 · 30% of the exam (part 1 of 2)',
  outcome: 'Design who can do what: policies, roles, federation, many accounts and locked-down buckets.',
  hue: 350,
  domain: 'saa-d1',
  levels: [
    lesson({
      id: 'saa-policy-evaluation',
      title: 'How AWS Decides: Policy Evaluation',
      system: 'Clearance Engine',
      skills: ['aws-security', 'aws-architecture'],
      brief: `**ARIA:** Cloud Practitioner taught you what IAM is. An architect needs to know exactly how AWS decides "allow" or "deny" when several policies apply at once.`,
      lesson: `## The evaluation logic

For a request inside one account, AWS evaluates every policy that applies:

1. **Explicit deny** anywhere? → **Denied.** Nothing overrides it.
2. **Organizations SCP** doesn't allow it? → Denied.
3. A **resource-based policy** (like a bucket policy) allows it? → Allowed (for principals in the same account).
4. A **permissions boundary** or **session policy** doesn't allow it? → Denied.
5. An **identity-based policy** allows it? → **Allowed.**
6. Otherwise → **implicit deny.** Everything starts denied.

So: **explicit deny > explicit allow > implicit deny.**

## Kinds of policy

| Policy | Attached to | Purpose |
|---|---|---|
| **Identity-based** | Users, groups, roles | What this identity may do |
| **Resource-based** | Resources (S3 bucket, SQS queue, KMS key, Lambda function) | Who may use this resource; can name other accounts |
| **Permissions boundary** | A user or role | The **maximum** an identity-based policy can grant: for safely delegating "create roles, but never more powerful than this" |
| **SCP** | Accounts / OUs in Organizations | The maximum for every identity in those accounts |
| **Session policy** | An assumed-role session | Narrows one session further |

## Conditions

Policies can add **conditions**: \`aws:SourceIp\` (only from the office), \`aws:MultiFactorAuthPresent\` (only with MFA), \`aws:RequestedRegion\` (only in approved Regions), \`aws:PrincipalOrgID\` (only identities from our organisation), \`aws:SourceVpce\` (only through our VPC endpoint).

## Cross-account access

For another account to use your resource, **both sides** must allow it: your resource policy (or role trust policy) must allow their principal, **and** their identity policy must allow the action.`,
      questions: [
        q('An identity policy allows `s3:GetObject` on a bucket, and the bucket policy explicitly denies that user. What happens?', ['Allowed, because identity policies win', 'Denied, because an explicit deny always wins', 'Allowed only from the console', 'It depends on which policy was created first'], 1, 'Explicit deny overrides every allow.'),
        q('A request matches no policy statement at all. What is the result?', ['Allowed by default', 'Implicitly denied', 'Allowed for the root user only', 'Sent for manual approval'], 1, 'Everything is denied unless something explicitly allows it.'),
        q('A team lead must be able to create IAM roles for developers, but never roles with more permissions than a set limit. What should be used?', ['A service control policy on the lead\'s user', 'A permissions boundary required on the roles they create', 'An S3 bucket policy', 'A session policy'], 1, 'Permissions boundaries cap what identity policies can grant, which makes delegated role creation safe.'),
        q('Which policy type is attached to the resource and can grant access to principals in another AWS account?', ['Identity-based policy', 'Resource-based policy', 'Permissions boundary', 'Service control policy'], 1, 'Resource-based policies (bucket policies, queue policies, key policies) can name external principals.'),
        q('A bucket must only be readable from inside the company\'s organisation in AWS Organizations, whatever account the request comes from. Which condition key fits?', ['aws:SourceIp', 'aws:PrincipalOrgID', 'aws:RequestedRegion', 'aws:CurrentTime'], 1, '`aws:PrincipalOrgID` matches any principal from your organisation.'),
        q('Account A wants to read an SQS queue in account B. What is required?', ['Only a policy in account A', 'Only a policy on the queue in account B', 'The queue policy in B allows A\'s principal, AND A\'s identity policy allows the action', 'An SCP in account B'], 2, 'Cross-account access needs permission on both sides.'),
      ],
    }),
    lesson({
      id: 'saa-roles-federation',
      title: 'Roles, STS and Federation',
      system: 'Borrowed Badges',
      skills: ['aws-security'],
      brief: `**ARIA:** Long-term access keys leak. Architects design so that nothing holds permanent credentials: everyone borrows temporary ones. That's what roles are for.`,
      lesson: `## Roles and the Security Token Service

An **IAM role** has permissions but no long-term credentials. Something **assumes** it, and **AWS STS** (Security Token Service) hands back **temporary credentials** that expire (minutes to hours).

A role has two policies:

- **Trust policy:** *who* may assume the role (an AWS service, another account, a federated identity).
- **Permissions policy:** *what* the role may do.

## Common patterns

| Need | Design |
|---|---|
| EC2 app calls AWS APIs | **Instance profile** (a role attached to the instance). The SDK picks up rotating credentials automatically. Never put access keys on instances. |
| Lambda function calls DynamoDB | The function's **execution role** |
| ECS task calls S3 | A **task role** (per task, not per host) |
| Account A's users need access in account B | A role in B whose trust policy allows A; users call **AssumeRole**. For third parties, require an **external ID** to prevent the "confused deputy" problem. |
| Employees sign in with the corporate directory | **Federation**: **IAM Identity Center** (recommended) or **SAML 2.0** to IAM roles |
| Mobile/web app users need AWS access | **Amazon Cognito identity pools** (next lessons) or OIDC web identity federation |

## IAM Identity Center

The recommended way to give the workforce access across **many accounts**: connect an identity source (its own directory, **Active Directory**, or an external IdP like Okta or Entra ID), define **permission sets**, and assign them to users and groups per account.

## AWS Directory Service

- **AWS Managed Microsoft AD:** a real Active Directory in AWS (trusts with on-premises AD possible).
- **AD Connector:** a proxy that sends authentication to your **on-premises** AD, without storing anything in the cloud.`,
      questions: [
        q('What is the most secure way for an application on EC2 to access DynamoDB?', ['Store IAM user access keys in a config file', 'Attach an IAM role through an instance profile', 'Use the root user\'s keys', 'Hard-code keys in the AMI'], 1, 'Instance profiles provide automatically rotated temporary credentials.'),
        q('Which part of a role defines WHO can assume it?', ['The permissions policy', 'The trust policy', 'The permissions boundary', 'The session policy'], 1, 'The trust policy lists the principals allowed to assume the role.'),
        q('A third-party monitoring company needs read-only access to a customer\'s account. How should this be designed?', ['Create an IAM user and email the keys', 'Create a cross-account role that trusts the vendor\'s account and requires an external ID', 'Share the root password', 'Make the resources public'], 1, 'A cross-account role with an external ID prevents the confused deputy problem.'),
        q('Different ECS tasks on the same EC2 host need different S3 permissions. What should be used?', ['The EC2 instance profile for all of them', 'An ECS task role for each task definition', 'One IAM user per container', 'Bucket ACLs'], 1, 'Task roles scope permissions to each task rather than the whole host.'),
        q('A company wants employees to use their existing Active Directory credentials to access 40 AWS accounts. What is the recommended approach?', ['Create IAM users in every account', 'IAM Identity Center connected to Active Directory, with permission sets per account', 'Share one IAM user per department', 'Use Cognito user pools'], 1, 'Identity Center is the recommended multi-account workforce sign-in.'),
        q('A company wants AWS applications to authenticate against its on-premises Active Directory without replicating the directory into AWS. Which service fits?', ['AWS Managed Microsoft AD', 'AD Connector', 'Amazon Cognito', 'IAM Access Analyzer'], 1, 'AD Connector proxies requests to on-premises AD and caches nothing in the cloud.'),
      ],
    }),
    lesson({
      id: 'saa-multi-account',
      title: 'Multi-Account Guardrails',
      system: 'Fleet Command',
      skills: ['aws-security', 'aws-architecture'],
      brief: `**ARIA:** Ground control is splitting into twenty accounts. As the architect, you design the guardrails that stop any one account from doing something dangerous.`,
      lesson: `## AWS Organizations, as an architect sees it

- A **management account** at the top, member accounts grouped in **OUs** (for example Security, Infrastructure, Workloads/Prod, Workloads/Dev, Sandbox).
- **SCPs** restrict what member accounts can do: deny leaving the organisation, deny disabling CloudTrail or GuardDuty, deny Regions you don't use, deny creating IAM users. SCPs **don't affect the management account**, and they never grant permissions.
- **Tag policies** standardise tags; **backup policies** enforce AWS Backup plans.
- **Delegated administrator:** run a security service (GuardDuty, Security Hub, Config) from a dedicated security account instead of the management account.

## AWS Control Tower

Automates a **landing zone** with a log archive account and an audit account, applies **controls** (preventive ones are SCPs; detective ones are Config rules; proactive ones are CloudFormation hooks), and offers **Account Factory** to create new accounts that start compliant.

## Centralise security data

- An **organisation trail** in CloudTrail logs every account into one S3 bucket in the log archive account.
- **AWS Config aggregators** collect configuration across accounts and Regions.
- **Security Hub** and **GuardDuty** with a delegated admin give one view of findings.

## Sharing instead of copying

**AWS Resource Access Manager (RAM)** shares resources across accounts: **VPC subnets** (a shared VPC), Transit Gateways, Route 53 Resolver rules, License Manager configurations and more.`,
      questions: [
        q('A company wants to make sure no account in its organisation can launch resources outside two approved Regions. What is the most effective control?', ['An IAM policy in each account', 'An SCP denying actions when aws:RequestedRegion isn\'t approved', 'A Config rule that emails the team', 'Budgets alerts per Region'], 1, 'An SCP is preventive and applies to every identity in the member accounts.'),
        q('Which statement about SCPs is correct?', ['They grant permissions to member accounts', 'They limit permissions in member accounts but don\'t affect the management account', 'They apply only to IAM users, not roles', 'They replace IAM identity policies'], 1, 'SCPs never grant and don\'t restrict the management account.'),
        q('A security team wants all CloudTrail logs from 30 accounts in one bucket that member accounts can\'t modify. What should it use?', ['A trail in every account writing to its own bucket', 'An organisation trail writing to a bucket in a dedicated log archive account', 'CloudWatch metrics', 'VPC Flow Logs'], 1, 'Organisation trails centralise logging; the log archive account keeps them out of members\' reach.'),
        q('Which service creates new accounts that already follow the company\'s baseline and guardrails?', ['AWS Control Tower Account Factory', 'AWS Service Catalog alone', 'AWS RAM', 'AWS Artifact'], 0, 'Account Factory in Control Tower provisions compliant accounts.'),
        q('Several application accounts must deploy into subnets of one central VPC owned by a networking account. Which service enables this?', ['VPC peering', 'AWS Resource Access Manager (shared VPC subnets)', 'AWS Direct Connect', 'An SCP'], 1, 'RAM shares subnets so other accounts launch into a shared VPC.'),
        q('A company wants to run GuardDuty for every account from a security account rather than the management account. What should it configure?', ['A delegated administrator for GuardDuty', 'An SCP', 'A cross-account IAM user', 'A Config aggregator'], 0, 'Delegated administration keeps day-to-day security work out of the management account.'),
      ],
    }),
    lesson({
      id: 'saa-app-identity',
      title: 'Identity for Applications',
      system: 'Visitor Passes',
      skills: ['aws-security', 'aws-architecture'],
      brief: `**ARIA:** The ground control app has a million public users. They're not employees, and they must never get IAM users. Here's how architects let customers sign in.`,
      lesson: `## Amazon Cognito

| Part | Gives you | Use it for |
|---|---|---|
| **User pools** | A **user directory**: sign-up, sign-in, MFA, password reset, social and SAML/OIDC sign-in. Returns **JWT tokens**. | Authenticating your app's users |
| **Identity pools** | **Temporary AWS credentials** for users (signed in, or guests), mapped to IAM roles | Letting a mobile app upload straight to S3 or call DynamoDB |

A common design: sign in with a **user pool**, exchange the token at an **identity pool** for AWS credentials scoped by role (for example, only your own S3 prefix).

## Protecting APIs

**Amazon API Gateway** can authorise requests with:

- A **Cognito user pool authorizer** (validates the JWT)
- A **Lambda authorizer** (your own logic: custom tokens, third-party auth)
- **IAM authorisation** (SigV4-signed requests from AWS identities)

An **Application Load Balancer** can also authenticate users with Cognito or any OIDC provider before traffic reaches your targets.

## Patterns to recognise

- "Users sign up and sign in to a mobile app" → **Cognito user pool**
- "Users upload directly to S3 from the app" → **Cognito identity pool** (or presigned URLs)
- "Custom token validation in front of an API" → **Lambda authorizer**
- "Employees", "Active Directory", "many AWS accounts" → **IAM Identity Center**, not Cognito`,
      questions: [
        q('A mobile app needs user sign-up, sign-in and MFA for millions of customers. Which service fits?', ['IAM users', 'Amazon Cognito user pools', 'IAM Identity Center', 'AWS Directory Service'], 1, 'Cognito user pools are the customer identity directory.'),
        q('A mobile app must let signed-in users upload photos directly to their own folder in S3. Which feature provides the AWS credentials?', ['Cognito identity pools', 'Cognito user pools alone', 'An IAM user embedded in the app', 'S3 bucket ACLs'], 0, 'Identity pools exchange tokens for temporary AWS credentials mapped to roles.'),
        q('An API must validate a custom token format issued by a third-party system. Which API Gateway option fits?', ['A Lambda authorizer', 'A Cognito user pool authorizer', 'An API key only', 'A resource policy'], 0, 'Lambda authorizers run your own validation logic.'),
        q('Which component can authenticate users with an OIDC provider before requests reach EC2 targets, without changing the application?', ['Network Load Balancer', 'Application Load Balancer', 'Amazon Route 53', 'NAT gateway'], 1, 'ALBs support built-in authentication with Cognito or OIDC.'),
        q('What do Cognito user pools return after a successful sign-in?', ['Long-term IAM access keys', 'JSON Web Tokens (JWTs)', 'An SSH key', 'A KMS key'], 1, 'User pools issue ID, access and refresh tokens as JWTs.'),
        q('Internal employees need to sign in to the AWS console across 15 accounts. Which service should be used?', ['Amazon Cognito', 'IAM Identity Center', 'API Gateway Lambda authorizers', 'S3 presigned URLs'], 1, 'Workforce access to AWS accounts is Identity Center\'s job; Cognito is for customers.'),
      ],
    }),
    lesson({
      id: 'saa-s3-security',
      title: 'Locking Down S3',
      system: 'Sealed Cargo',
      skills: ['aws-security', 'aws-storage'],
      brief: `**ARIA:** Most cloud data leaks are an S3 bucket someone opened by mistake. As an architect, you'll design buckets that can't leak, and still share data safely when you need to.`,
      lesson: `## Who can reach a bucket

- **Bucket policies** (resource-based JSON) are the main tool: grant other accounts, require encryption, require TLS (\`aws:SecureTransport\`), or allow only from a **VPC endpoint** (\`aws:SourceVpce\`).
- **S3 Block Public Access** (account and bucket level) overrides any policy or ACL that would make data public. Keep it on.
- **Object Ownership: bucket owner enforced** disables ACLs, so access is controlled only by policies (the recommended default).

## Sharing safely

- **Presigned URLs:** time-limited URLs that let anyone with the link GET or PUT one object, using the signer's permissions. Great for downloads and browser uploads without making anything public.
- **CloudFront with Origin Access Control (OAC):** keep the bucket private and let only CloudFront read it, so users go through the CDN (with caching, HTTPS, WAF).

## Protecting data from deletion and change

- **Versioning** keeps old versions.
- **MFA Delete** requires MFA to delete versions or change versioning (set by the root user).
- **S3 Object Lock** makes objects **write-once-read-many (WORM)** for a retention period:
  - **Governance mode:** most users can't delete; specially permitted users can.
  - **Compliance mode:** **nobody**, not even the root user, can delete until retention ends.
  - **Legal hold:** no expiry, until removed.
- **Cross-Region Replication** keeps a copy in another Region (versioning required).

## Encryption

New objects are encrypted with **SSE-S3** by default. Use **SSE-KMS** for audit trails of key use and key-level access control; a bucket policy can **require** a specific encryption header.`,
      questions: [
        q('Users must download private files from S3 for 15 minutes without the bucket becoming public. What should the application generate?', ['A bucket policy allowing everyone', 'A presigned URL', 'A new IAM user per download', 'An S3 access point open to the internet'], 1, 'Presigned URLs give time-limited access to one object.'),
        q('A static website on S3 should only be reachable through CloudFront, never directly. What should be configured?', ['S3 static website hosting with a public bucket', 'CloudFront Origin Access Control and a bucket policy allowing only that distribution', 'S3 Transfer Acceleration', 'A NAT gateway'], 1, 'OAC lets CloudFront read a private bucket while direct access stays blocked.'),
        q('Regulations require financial records to be undeletable by anyone, including administrators, for 7 years. Which feature fits?', ['S3 Versioning', 'S3 Object Lock in compliance mode', 'S3 Object Lock in governance mode', 'MFA Delete'], 1, 'Compliance mode prevents deletion by anyone until retention expires.'),
        q('How can a bucket be restricted so it only accepts requests that arrive through a specific VPC endpoint?', ['A bucket policy with an aws:SourceVpce condition', 'A security group on the bucket', 'A network ACL on S3', 'S3 Lifecycle rules'], 0, 'Bucket policies can require `aws:SourceVpce`.'),
        q('What is the recommended setting to make sure access to a bucket is controlled only by policies, not ACLs?', ['Object Ownership: bucket owner enforced', 'Requester Pays', 'Transfer Acceleration', 'Intelligent-Tiering'], 0, 'Bucket owner enforced disables ACLs entirely.'),
        q('A company must prove which users used the keys protecting its S3 data, and control key access separately from bucket access. Which encryption should it use?', ['SSE-S3', 'SSE-KMS with a customer managed key', 'No encryption, with versioning', 'Client-side encoding with Base64'], 1, 'SSE-KMS logs key use in CloudTrail and adds key policy controls.'),
      ],
    }),
    checkpoint({
      id: 'saa-access-checkpoint',
      title: 'Checkpoint: Secure Access',
      system: 'Clearance Certification Gate',
      skills: ['aws-security', 'aws-architecture'],
      brief: `**ARIA:** Associate-level scenarios. Several answers will "work": pick the one that is most secure with the least operational overhead.`,
      lesson: `## Before you start

- Explicit deny > allow > implicit deny. Cross-account needs both sides.
- Roles + STS for everything; instance profiles, task roles, execution roles; external ID for third parties.
- Organizations + SCPs (preventive), Control Tower (landing zone), RAM (sharing).
- Cognito user pools = sign-in (JWT); identity pools = AWS credentials. Workforce = Identity Center.
- S3: Block Public Access, presigned URLs, OAC, Object Lock (governance vs compliance).`,
      questions: [
        q('Developers in a sandbox account have AdministratorAccess. The company must stop them disabling GuardDuty. What is the best solution?', ['Remove AdministratorAccess from every developer', 'An SCP on the sandbox OU denying GuardDuty disable/delete actions', 'A Config rule that re-enables GuardDuty daily', 'A CloudWatch alarm'], 1, 'An SCP blocks the action regardless of the developers\' IAM permissions.'),
        q('A Lambda function in account A must write to a DynamoDB table in account B. What is the most secure design?', ['Create an IAM user in B and store its keys in the function', 'Create a role in B that trusts A\'s function role; the function assumes it', 'Make the table public', 'Copy the table to account A'], 1, 'Cross-account role assumption gives temporary, scoped credentials.'),
        q('A web app lets users upload large files straight from the browser to S3 without passing through the app servers, and without public write access. What should be used?', ['Presigned PUT URLs generated by the backend', 'A public bucket with versioning', 'IAM users for every customer', 'An S3 Gateway endpoint'], 0, 'Presigned PUT URLs allow direct, time-limited uploads.'),
        q('An auditor needs read access to CloudTrail logs in the log archive account, for 30 days. What is the most appropriate approach?', ['Share the root user credentials', 'A role in the log archive account with read-only access to the bucket, assumable by the auditor', 'Make the bucket public', 'Email the logs every day'], 1, 'Temporary role access fits a time-boxed need and can be removed afterwards.'),
        q('A company\'s IAM policy for an S3 bucket allows `s3:*`. The bucket policy denies all requests where aws:SecureTransport is false. A user calls S3 over plain HTTP. What happens?', ['Allowed, because the identity policy allows s3:*', 'Denied by the explicit deny in the bucket policy', 'Allowed if the user has MFA', 'Redirected to HTTPS automatically'], 1, 'The explicit deny for non-TLS requests wins.'),
        q('Which combination lets a mobile game\'s players sign in with Google, then read only their own items in DynamoDB?', ['Cognito user pool with Google federation, plus an identity pool role using fine-grained access conditions', 'IAM users for every player', 'IAM Identity Center with permission sets', 'API keys in the app'], 0, 'User pool federation authenticates; the identity pool maps to a role that limits each player to their own items.'),
        q('A company wants new accounts automatically created with CloudTrail, Config and guardrails already in place. Which service requires the least custom work?', ['AWS Control Tower', 'Custom CloudFormation scripts run by hand', 'AWS Artifact', 'Amazon Inspector'], 0, 'Control Tower automates the landing zone and compliant account creation.'),
        q('Which statement about permissions boundaries is correct?', ['They grant permissions to a role', 'They set the maximum permissions an identity-based policy can give a user or role', 'They apply to whole accounts', 'They are the same as SCPs'], 1, 'Boundaries cap identity policies for a single user or role.'),
      ],
    }),
  ],
};
