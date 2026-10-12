// DVA-C02 Domain 2: Security (26% of the exam).
import type { Deck } from '../../../game/types';
import { checkpoint, lesson, q } from '../kit';

export const dvaSecurity: Deck = {
  id: 'dva-security',
  name: 'Security for Developers',
  subtitle: 'Domain 2 · 26% of the exam',
  outcome: 'Authenticate users and services, encrypt data with KMS, and keep secrets and personal data out of code and logs.',
  hue: 350,
  domain: 'dva-d2',
  levels: [
    lesson({
      id: 'dva-auth',
      title: 'Authenticating Users and APIs',
      system: 'Gatehouse',
      skills: ['aws-security'],
      brief: `**ARIA:** Customers sign in, then call our API with a token. Learn how Cognito issues tokens, how API Gateway checks them, and how to stop users seeing each other's data.`,
      lesson: `## Amazon Cognito

- **User pools:** a user directory with sign-up, sign-in, MFA and federation (Google, Apple, SAML, OIDC). Successful sign-in returns **JWTs**: an **ID token** (who the user is), an **access token** (what they may call) and a **refresh token**.
- **Identity pools:** exchange a token (from a user pool or another provider) for **temporary AWS credentials** mapped to IAM roles, so apps can call S3 or DynamoDB directly.

## Bearer tokens

Clients send \`Authorization: Bearer <token>\`. The API **validates** the token's signature, expiry, issuer and audience before trusting it. Never trust claims you haven't verified.

## Authorising API Gateway requests

| Authorizer | Use |
|---|---|
| **Cognito user pool authorizer** | Validate Cognito JWTs (REST APIs) |
| **JWT authorizer** | Any OIDC/OAuth 2.0 provider (HTTP APIs) |
| **Lambda authorizer** | Custom logic: token-based (a header) or request-based (headers, query, context); returns an IAM policy; results can be cached |
| **IAM authorization** | Callers sign requests with **SigV4** using AWS credentials (service-to-service) |

## Fine-grained, application-level authorisation

- IAM conditions such as **\`dynamodb:LeadingKeys\`** restrict a user to items whose partition key is their own ID.
- **Amazon Verified Permissions** evaluates fine-grained permissions written in the **Cedar** policy language, outside your code.
- In **multi-tenant** apps, include the **tenant ID** in keys and enforce it in every query (and in IAM conditions), never trusting a tenant ID sent by the client.`,
      questions: [
        q('Which Cognito token is meant for authorising calls to an API?', ['Access token', 'Refresh token', 'An IAM access key', 'A KMS key'], 0, 'Access tokens carry scopes for API access; ID tokens describe the user.'),
        q('A mobile app must upload files directly to S3 for signed-in users. Which Cognito feature provides AWS credentials?', ['Identity pools', 'User pools alone', 'A Lambda layer', 'API keys'], 0, 'Identity pools exchange tokens for temporary AWS credentials.'),
        q('An API must accept tokens from a third-party OAuth provider using custom validation rules. Which authorizer fits a REST API?', ['A Lambda authorizer', 'An API key', 'A usage plan', 'A mock integration'], 0, 'Lambda authorizers run custom validation logic.'),
        q('Each user may read only their own items in a DynamoDB table keyed by userId, using identity pool credentials. How is this enforced?', ['An IAM policy condition on dynamodb:LeadingKeys matching the user\'s identity', 'Client-side filtering', 'A Scan with a FilterExpression', 'A GSI'], 0, 'LeadingKeys restricts access to items with the caller\'s partition key.'),
        q('Microservices inside AWS call each other\'s API Gateway endpoints. Which authorization method uses their IAM roles?', ['IAM authorization with SigV4-signed requests', 'Cognito user pools', 'API keys only', 'Basic auth'], 0, 'IAM auth verifies SigV4 signatures from AWS principals.'),
        q('A team wants to manage fine-grained application permissions as policies outside the code. Which service fits?', ['Amazon Verified Permissions', 'Amazon Macie', 'AWS Artifact', 'Amazon Inspector'], 0, 'Verified Permissions evaluates Cedar policies.'),
      ],
    }),
    lesson({
      id: 'dva-iam-code',
      title: 'Credentials in Code',
      system: 'Keyring',
      skills: ['aws-security'],
      brief: `**ARIA:** Somebody committed access keys to a public repo, and within minutes bots were mining crypto on our bill. Learn where SDKs find credentials, and how to never need long-term keys.`,
      lesson: `## How SDKs find credentials

The **default credential provider chain** checks, in order (roughly):

1. Explicit credentials in code (avoid).
2. **Environment variables** (\`AWS_ACCESS_KEY_ID\`, \`AWS_SECRET_ACCESS_KEY\`, \`AWS_SESSION_TOKEN\`).
3. The **shared credentials/config files** (\`~/.aws/credentials\`, profiles, SSO).
4. Container credentials (ECS **task role**).
5. **Instance profile** credentials from the EC2 metadata service.

On AWS compute (Lambda, ECS, EC2), **use the role**: the SDK picks up temporary credentials automatically. Locally, use **IAM Identity Center** (\`aws sso login\`) or a profile.

## Roles and STS

- \`AssumeRole\`: get temporary credentials for a role (cross-account, elevated access).
- \`AssumeRoleWithWebIdentity\`: exchange an OIDC token (used by EKS service accounts, CI systems like GitHub Actions).
- \`GetSessionToken\`: temporary credentials, for example with **MFA**.
- Every request is signed with **SigV4**; signed requests are time-limited.

## Permissions for your code

- **Least privilege**: the Lambda execution role gets only the actions and resources the function uses.
- Resource-based policies (Lambda function policy, S3 bucket policy, KMS key policy) grant other principals or services access.
- \`AccessDenied\` errors: check the identity policy, resource policy, SCPs, permission boundaries and KMS key policy.
- **IAM Access Analyzer** can generate least-privilege policies from CloudTrail activity.`,
      questions: [
        q('What is the recommended way for code running on Lambda to get AWS credentials?', ['The function\'s execution role, picked up automatically by the SDK', 'Access keys in environment variables', 'Hard-coded keys in the code', 'The root user\'s keys'], 0, 'Roles provide rotating temporary credentials.'),
        q('A GitHub Actions workflow must deploy to AWS without storing long-term access keys. Which STS operation fits?', ['AssumeRoleWithWebIdentity (OIDC federation)', 'GetSessionToken with root keys', 'Creating an IAM user per run', 'DecodeAuthorizationMessage'], 0, 'OIDC federation exchanges the workflow\'s token for role credentials.'),
        q('An ECS task needs permission to read an S3 bucket. Where should the permission be granted?', ['The task role', 'The EC2 instance profile of the cluster', 'An IAM user embedded in the image', 'The bucket ACL only'], 0, 'Task roles scope permissions per task.'),
        q('A developer wants to work locally with short-lived credentials through the company\'s single sign-on. What should they use?', ['IAM Identity Center with aws sso login and a profile', 'Long-term access keys in a text file', 'The root user', 'An EC2 instance profile on a laptop'], 0, 'Identity Center provides temporary credentials locally.'),
        q('A function gets AccessDenied writing to an S3 bucket encrypted with a customer managed KMS key, even though the role allows s3:PutObject. What is likely missing?', ['Permission to use the KMS key (kms:GenerateDataKey in IAM and the key policy)', 'A larger timeout', 'A NAT gateway', 'An S3 lifecycle rule'], 0, 'SSE-KMS writes also need KMS permissions.'),
        q('Which service can generate a least-privilege policy based on what a role actually used?', ['IAM Access Analyzer', 'AWS Budgets', 'Amazon Polly', 'AWS Snowball Edge'], 0, 'Access Analyzer generates policies from CloudTrail activity.'),
      ],
    }),
    lesson({
      id: 'dva-encryption',
      title: 'Encryption with KMS',
      system: 'Cipher Lab',
      skills: ['aws-security'],
      brief: `**ARIA:** "Just call KMS Encrypt" works until the payload is 5 KB. Learn envelope encryption, key policies, rotation and certificates, the developer way.`,
      lesson: `## At rest and in transit

- **At rest:** data stored in S3, EBS, DynamoDB, RDS is encrypted with keys managed in **AWS KMS**.
- **In transit:** TLS (HTTPS) between clients and services, and between services.

## Server-side vs client-side

- **Server-side encryption:** the service encrypts after receiving your data (S3 **SSE-S3**, **SSE-KMS**, **SSE-C**).
- **Client-side encryption:** **you** encrypt before sending (for example with the **AWS Encryption SDK**); AWS only ever sees ciphertext.

## KMS API for developers

| Operation | Use |
|---|---|
| \`Encrypt\` / \`Decrypt\` | Small data only: **up to 4 KB** |
| \`GenerateDataKey\` | Returns a **plaintext data key** and an **encrypted copy**: encrypt your data locally with the plaintext key, store the encrypted key next to the data, discard the plaintext. This is **envelope encryption** |
| \`GenerateDataKeyWithoutPlaintext\` | Just the encrypted data key, for later use |
| \`ReEncrypt\` | Change the key protecting ciphertext without exposing plaintext |

KMS has request quotas; heavy use can throttle. The Encryption SDK's **data key caching** reduces calls.

## Keys and policies

- Access needs the **key policy** to allow it (plus IAM, if the key policy delegates to IAM).
- **Cross-account** use: the key policy must allow the other account, **and** that account's IAM must allow the action.
- **Automatic rotation** of customer managed keys can be enabled (yearly by default, configurable); old key material is kept, so old data still decrypts. You can also **rotate on demand**.

## Certificates and keys for development

- **AWS Certificate Manager (ACM):** public TLS certificates for ELB, CloudFront and API Gateway, renewed automatically.
- **AWS Private CA:** issue **private certificates** for internal services and devices.
- SSH key pairs for EC2 come from EC2 (or \`ssh-keygen\`); use Session Manager instead of SSH when you can.`,
      questions: [
        q('An application must encrypt 2 MB files with a KMS key. What is the correct approach?', ['Call KMS Encrypt on the whole file', 'Use GenerateDataKey and encrypt the file locally with the data key (envelope encryption)', 'Base64-encode the file', 'Store it in a public bucket'], 1, 'KMS Encrypt handles up to 4 KB; larger data uses envelope encryption.'),
        q('With client-side encryption, who encrypts the data?', ['The AWS service after it arrives', 'The application, before sending it to AWS', 'Nobody', 'The network'], 1, 'Client-side encryption happens in your code.'),
        q('Account B must decrypt data encrypted with a KMS key in account A. What is required?', ['The key policy in A allows account B, and B\'s IAM policy allows the decrypt action', 'Only an IAM policy in B', 'Only a bucket policy', 'Copying the key material to B'], 0, 'Cross-account KMS needs both the key policy and IAM.'),
        q('A high-traffic service is throttled by KMS when encrypting many small records. What helps?', ['Data key caching with the AWS Encryption SDK', 'Calling Encrypt twice', 'Turning off encryption', 'Using a bigger Lambda'], 0, 'Reusing data keys reduces KMS calls.'),
        q('After enabling automatic rotation on a customer managed key, can data encrypted before rotation still be decrypted?', ['No, it must be re-encrypted first', 'Yes, KMS keeps the old key material for decryption', 'Only for 7 days', 'Only with the root user'], 1, 'Rotation keeps older key material available.'),
        q('Internal microservices need TLS certificates from a company-controlled certificate authority. Which service fits?', ['AWS Private CA', 'Amazon Route 53', 'AWS Budgets', 'Amazon Inspector'], 0, 'Private CA issues private certificates.'),
      ],
    }),
    lesson({
      id: 'dva-sensitive-data',
      title: 'Secrets and Sensitive Data',
      system: 'Sealed Records',
      skills: ['aws-security'],
      brief: `**ARIA:** Passwords in environment variables, card numbers in log files. Let's clean up: where secrets belong, and how to keep personal data out of places it shouldn't be.`,
      lesson: `## Classify the data

- **PII** (personally identifiable information): names, emails, phone numbers, addresses, ID numbers.
- **PHI** (protected health information): health data linked to a person, regulated by laws such as HIPAA.
- Payment card data (PCI DSS). Classify first; protect each class accordingly.

## Where secrets belong

| | AWS Secrets Manager | SSM Parameter Store |
|---|---|---|
| For | Database passwords, API keys | Configuration and secrets (\`SecureString\`, KMS-encrypted) |
| **Rotation** | **Built-in automatic rotation** | None built in |
| Extras | Cross-Region replication, cross-account | Hierarchies (\`/app/prod/db\`), versions, free standard tier |

Read secrets at runtime with the SDK (cache them; the **Parameters and Secrets Lambda extension** caches for Lambda). **Lambda environment variables** are encrypted at rest; for sensitive values, encrypt them with a **customer managed KMS key** and decrypt in code, or better, keep them in Secrets Manager.

## Keeping sensitive data out of logs and outputs

- **Sanitise** inputs and **mask** sensitive fields before logging (\`****1234\`).
- **CloudWatch Logs data protection** policies can detect and **mask** sensitive data in log groups.
- **Amazon Macie** finds sensitive data in S3; **Amazon Comprehend** can detect PII in text.
- Return only the fields a caller needs (data minimisation).

## Multi-tenant data access

- **Silo:** a separate resource per tenant (strong isolation, higher cost).
- **Pool:** shared tables with the **tenant ID in the key**; enforce it in every query and with IAM conditions.
- **Bridge:** a mix. Always derive the tenant from the authenticated identity, never from user input.`,
      questions: [
        q('A database password must rotate every 30 days with no application downtime. Where should it be stored?', ['AWS Secrets Manager with automatic rotation', 'A Lambda environment variable in plain text', 'A Parameter Store String parameter', 'The source code'], 0, 'Secrets Manager rotates secrets automatically.'),
        q('Which is an example of PHI?', ['A patient\'s diagnosis linked to their name', 'A product price', 'A public company address', 'A server\'s CPU metric'], 0, 'Health information tied to an individual is PHI.'),
        q('Application logs contain customers\' email addresses. Which feature can automatically mask them in CloudWatch Logs?', ['CloudWatch Logs data protection policies', 'S3 Lifecycle rules', 'CloudFront caching', 'X-Ray sampling'], 0, 'Data protection policies detect and mask sensitive data in logs.'),
        q('A Lambda function reads the same secret on every invocation and hits Secrets Manager limits. What helps?', ['Cache the secret (for example with the Parameters and Secrets Lambda extension)', 'Store the secret in the code', 'Disable encryption', 'Use a larger timeout'], 0, 'Caching reduces calls and latency.'),
        q('A SaaS app stores all tenants in one DynamoDB table. How should tenant isolation be enforced?', ['Use the tenant ID from the authenticated identity in the partition key and enforce it in queries and IAM conditions', 'Trust the tenant ID sent in the request body', 'Give every tenant full table access', 'Filter results in the browser'], 0, 'Derive the tenant from identity and enforce it server-side.'),
        q('Which keeps configuration values in a hierarchy like /app/prod/db-url with versions, at no cost for standard parameters?', ['SSM Parameter Store', 'Amazon Macie', 'AWS Private CA', 'Amazon Cognito'], 0, 'Parameter Store supports hierarchies and versions.'),
      ],
    }),
    checkpoint({
      id: 'dva-security-checkpoint',
      title: 'Checkpoint: Security for Developers',
      system: 'Security Certification Gate',
      skills: ['aws-security'],
      brief: `**ARIA:** Developer-level scenarios on authentication, credentials, KMS and sensitive data.`,
      lesson: `## Before you start

- User pools → JWTs (ID, access, refresh); identity pools → AWS credentials. Authorizers: Cognito, JWT, Lambda, IAM (SigV4).
- Credential chain: env vars → shared files → container role → instance profile. Roles everywhere; AssumeRoleWithWebIdentity for OIDC.
- KMS Encrypt ≤ 4 KB; envelope encryption with GenerateDataKey; key policy + IAM; rotation keeps old material.
- Secrets Manager (rotation) vs Parameter Store; mask PII in logs; tenant ID from identity.`,
      questions: [
        q('An HTTP API must accept JWTs issued by Auth0 without custom code. Which authorizer fits?', ['A JWT authorizer', 'A Lambda request authorizer', 'IAM authorization', 'An API key'], 0, 'HTTP APIs have built-in JWT authorizers for OIDC providers.'),
        q('A developer\'s laptop has an old access key in environment variables that overrides their SSO profile. Why?', ['Environment variables come before the shared config files in the SDK credential chain', 'SSO profiles are always ignored', 'Access keys expire every hour', 'The SDK only reads instance profiles'], 0, 'The provider chain checks environment variables first.'),
        q('A service must store an encrypted data key alongside each encrypted object. Which KMS operation produces it?', ['GenerateDataKey', 'Encrypt with the whole object', 'CreateAlias', 'ScheduleKeyDeletion'], 0, 'GenerateDataKey returns plaintext and encrypted data keys.'),
        q('Which is the most secure place for a third-party API key used by a Lambda function?', ['Secrets Manager, read at runtime with the execution role', 'A plain-text environment variable', 'The function\'s code', 'A public S3 object'], 0, 'Secrets Manager plus IAM keeps the key out of code and config.'),
        q('A Lambda authorizer\'s checks add latency to every request. What reduces it?', ['Enable authorizer result caching with a TTL', 'Increase the API timeout', 'Use a mock integration', 'Disable the authorizer'], 0, 'Cached authorizer results skip repeated checks.'),
        q('Data must be encrypted so that not even AWS can read it in plaintext. Which approach fits?', ['Client-side encryption before upload', 'SSE-S3', 'Default EBS encryption', 'TLS only'], 0, 'With client-side encryption, AWS only receives ciphertext.'),
        q('Which statement about Cognito user pools and identity pools is correct?', ['User pools authenticate users and issue JWTs; identity pools provide temporary AWS credentials', 'Both issue IAM users', 'Identity pools store passwords', 'User pools provide KMS keys'], 0, 'Authentication vs AWS credentials.'),
        q('A request is denied even though the identity policy allows it. Which could cause this? (Pick the best answer.)', ['An explicit deny in a resource policy, SCP or permission boundary', 'The SDK version', 'The function memory', 'The log retention period'], 0, 'Any explicit deny or missing resource permission blocks the request.'),
      ],
    }),
  ],
};
