// AWS Certified Developer – Associate (DVA-C02): building, securing,
// deploying and debugging applications on AWS. Five floors follow the exam
// guide's four domains, and a bank of exam-style questions feeds practice.
import type { Path } from '../../game/types';
import { dvaBuild } from './dva/build';
import { dvaDeploy } from './dva/deploy';
import { dvaLambda } from './dva/lambda';
import { dvaSecurity } from './dva/security';
import { dvaTroubleshoot } from './dva/troubleshoot';
import { bankFor } from './kit';

const d1 = bankFor('dva', 'dva-d1');
const d2 = bankFor('dva', 'dva-d2');
const d3 = bankFor('dva', 'dva-d3');
const d4 = bankFor('dva', 'dva-d4');

export const DVA: Path = {
  id: 'aws-dva',
  name: 'AWS Certified Developer – Associate',
  short: 'Developer',
  tagline: 'Write, secure, deploy and debug applications on AWS: Lambda, API Gateway, DynamoDB, messaging, KMS, SAM and CI/CD.',
  icon: '🧑‍💻',
  exam: {
    code: 'DVA-C02',
    name: 'AWS Certified Developer – Associate',
    level: 'Associate',
    questions: 65,
    minutes: 130,
    pass: 720,
    domains: [
      { id: 'dva-d1', name: 'Development with AWS Services', weight: 32 },
      { id: 'dva-d2', name: 'Security', weight: 26 },
      { id: 'dva-d3', name: 'Deployment', weight: 24 },
      { id: 'dva-d4', name: 'Troubleshooting and Optimization', weight: 18 },
    ],
    guide: 'https://docs.aws.amazon.com/aws-certification/latest/developer-associate-02/developer-associate-02.html',
  },
  decks: [dvaBuild, dvaLambda, dvaSecurity, dvaDeploy, dvaTroubleshoot],
  bank: [
    // ------------------------------------------------------------ Domain 1
    d1(1, 'Which actions make code that calls a throttled AWS API more resilient? (Choose TWO.)', ['Retry with exponential backoff and jitter', 'Make the operation idempotent so retries are safe', 'Retry immediately in a tight loop', 'Disable SDK retries', 'Increase the request size'], [0, 1], 'Backoff with jitter plus idempotency makes retries safe and effective.'),
    d1(2, 'Which are true of DynamoDB global secondary indexes? (Choose TWO.)', ['They can be created after the table', 'They support only eventually consistent reads', 'They must use the table\'s partition key', 'They must be created with the table', 'They support strongly consistent reads'], [0, 1], 'GSIs are flexible but eventually consistent; LSIs share the partition key and are created with the table.'),
    d1(3, 'A Lambda function processes an SQS queue. Which settings prevent one bad message from blocking or endlessly retrying a batch? (Choose TWO.)', ['Report partial batch failures', 'A dead-letter queue with maxReceiveCount on the source queue', 'A shorter function timeout than the visibility timeout is long', 'Disable the event source mapping', 'Use a FIFO queue for every workload'], [0, 1], 'Partial batch responses retry only failures; the DLQ catches poison messages.'),
    d1(4, 'A REST API must transform a legacy backend\'s XML response into JSON and change its status code. Which feature fits?', ['A non-proxy integration with mapping templates', 'A Lambda proxy integration with no code', 'A usage plan', 'A WebSocket API'], 0, 'Mapping templates transform payloads and status codes.'),
    d1(5, 'Which SQS settings reduce cost when consumers poll mostly empty queues? (Choose TWO.)', ['Long polling (WaitTimeSeconds up to 20)', 'Receiving messages in batches of up to 10', 'Short polling every millisecond', 'Smaller visibility timeout', 'More consumer threads'], [0, 1], 'Long polling and batching cut API calls.'),
    d1(6, 'An event must reach several AWS targets based on its content, with an archive to replay events later. Which service fits?', ['Amazon EventBridge', 'Amazon SQS standard queue', 'Amazon Kinesis Data Firehose', 'AWS AppConfig'], 0, 'EventBridge routes by content and supports archive and replay.'),
    d1(7, 'How many RCUs are needed for 20 eventually consistent reads per second of 6 KB items?', ['10', '20', '40', '30'], 1, '6 KB → 2 units of 4 KB; eventually consistent halves it: 20 × 2 / 2 = 20.'),
    d1(8, 'Which Lambda features reduce cold-start latency? (Choose TWO.)', ['Provisioned concurrency', 'SnapStart (for supported runtimes)', 'Reserved concurrency set to 0', 'A longer timeout', 'More environment variables'], [0, 1], 'Provisioned concurrency and SnapStart keep functions ready.'),
    // ------------------------------------------------------------ Domain 2
    d2(1, 'Which are secure ways to give code AWS credentials? (Choose TWO.)', ['An IAM role attached to the compute (execution role, task role, instance profile)', 'IAM Identity Center temporary credentials for local development', 'Access keys hard-coded in source', 'The root user\'s keys', 'Keys committed to a private repository'], [0, 1], 'Roles and temporary credentials avoid long-term keys.'),
    d2(2, 'Which are true of envelope encryption with KMS? (Choose TWO.)', ['Data is encrypted locally with a data key', 'The encrypted data key is stored with the data', 'The full data is sent to KMS', 'It only works up to 4 KB', 'It requires SSE-C'], [0, 1], 'Data keys encrypt locally; the encrypted key travels with the data.'),
    d2(3, 'A mobile app\'s users must sign in, then call an API Gateway REST API. Which combination fits?', ['Cognito user pool sign-in and a Cognito user pool authorizer on the API', 'IAM users for every customer', 'API keys as the only authentication', 'S3 presigned URLs for the API'], 0, 'User pools issue JWTs; the authorizer validates them.'),
    d2(4, 'Which services store secrets or sensitive configuration securely? (Choose TWO.)', ['AWS Secrets Manager', 'SSM Parameter Store SecureString parameters', 'Plain-text Lambda environment variables', 'Public S3 objects', 'CloudWatch Logs'], [0, 1], 'Both encrypt with KMS; Secrets Manager also rotates.'),
    d2(5, 'A Lambda function must decrypt data with a customer managed KMS key in another account. What is required?', ['The key policy in the other account allows the function\'s role, and the role\'s policy allows kms:Decrypt', 'Only the role policy', 'Only the key policy', 'Copy the key to the function\'s account'], 0, 'Cross-account KMS use needs both policies.'),
    d2(6, 'Which reduce the risk of personal data appearing in logs? (Choose TWO.)', ['Mask or redact sensitive fields before logging', 'CloudWatch Logs data protection policies', 'Logging full request bodies at debug level in production', 'Longer log retention', 'Sending logs to a public bucket'], [0, 1], 'Masking in code plus data protection policies.'),
    d2(7, 'Which IAM condition restricts identity-pool users to DynamoDB items whose partition key is their own identity ID?', ['dynamodb:LeadingKeys', 'aws:SourceIp', 'aws:RequestedRegion', 's3:prefix'], 0, 'LeadingKeys limits access by partition key value.'),
    // ------------------------------------------------------------ Domain 3
    d3(1, 'Which strategies shift traffic gradually to a new Lambda version? (Choose TWO.)', ['Canary', 'Linear', 'All at once', 'In-place with no alias', 'Deleting the old version first'], [0, 1], 'Canary and linear deployments shift traffic in steps.'),
    d3(2, 'Which files configure the AWS CI/CD services? (Choose TWO.)', ['buildspec.yml for CodeBuild', 'appspec.yml for CodeDeploy', 'Dockerfile for CodePipeline', 'package.json for CodeDeploy', 'samconfig.toml for CodeBuild'], [0, 1], 'buildspec.yml drives builds; appspec.yml drives deployments.'),
    d3(3, 'A team deploys the same SAM template to dev, staging and prod. How should environment differences be handled?', ['Template parameters (and samconfig environments) with per-environment values', 'Separate copies of the template edited by hand', 'Hard-coded values per branch', 'Different handler names'], 0, 'Parameters keep one template for every environment.'),
    d3(4, 'An API must keep a stable URL while each stage points at a different Lambda alias. Which features fit? (Choose TWO.)', ['API Gateway stages', 'Stage variables referencing the alias', 'Usage plans', 'Mock integrations', 'CloudFront geo restriction'], [0, 1], 'Stages plus stage variables select the alias per environment.'),
    d3(5, 'A deployment must roll back automatically if a CloudWatch alarm fires during traffic shifting. Which service provides this for Lambda?', ['AWS CodeDeploy', 'AWS CodeArtifact', 'Amazon ECR', 'AWS AppSync'], 0, 'CodeDeploy monitors alarms and rolls back.'),
    d3(6, 'Which packaging choice fits a Lambda function whose dependencies total 1.5 GB?', ['A container image', 'A .zip archive', 'Inline code in the console', 'An environment variable'], 0, 'Container images support up to 10 GB.'),
    // ------------------------------------------------------------ Domain 4
    d4(1, 'Which help find why requests through several services are slow? (Choose TWO.)', ['AWS X-Ray traces', 'CloudWatch Logs Insights queries on structured logs', 'AWS Artifact reports', 'S3 lifecycle rules', 'IAM Access Analyzer'], [0, 1], 'Traces show where time goes; Logs Insights finds slow requests.'),
    d4(2, 'Which ways publish custom application metrics to CloudWatch? (Choose TWO.)', ['PutMetricData API calls', 'Embedded Metric Format log lines', 'X-Ray metadata', 'S3 object tags', 'CloudFormation outputs'], [0, 1], 'Both create custom metrics.'),
    d4(3, 'A Kinesis-triggered function\'s IteratorAge keeps rising. What does it indicate?', ['Records are waiting longer before processing: the consumer is falling behind', 'The function is idle', 'The stream has no records', 'X-Ray is disabled'], 0, 'IteratorAge measures processing lag.'),
    d4(4, 'Which changes improve the CloudFront cache hit ratio? (Choose TWO.)', ['Remove headers and query strings that don\'t change the response from the cache key', 'Use a longer TTL for content that rarely changes', 'Add every cookie to the cache key', 'Set TTL to zero', 'Disable caching for static files'], [0, 1], 'Smaller cache keys and sensible TTLs increase hits.'),
    d4(5, 'An API returns 403 AccessDenied after a new release. Where should a developer look first?', ['The IAM policies and resource policies involved, and CloudTrail for the denied call', 'The CloudFront price class', 'The DynamoDB capacity mode', 'The S3 storage class'], 0, '403 is a permissions problem; CloudTrail shows the denial.'),
    d4(6, 'A function handles 100 requests per second at 300 ms each. About how many concurrent executions does it need?', ['30', '100', '300', '3'], 0, '100 × 0.3 s = 30.'),
  ],
};
