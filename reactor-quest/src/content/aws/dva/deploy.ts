// DVA-C02 Domain 3: Deployment (24% of the exam).
import type { Deck } from '../../../game/types';
import { checkpoint, lesson, q } from '../kit';

export const dvaDeploy: Deck = {
  id: 'dva-deploy',
  name: 'Deployment',
  subtitle: 'Domain 3 · 24% of the exam',
  outcome: 'Package, configure, test and ship applications with SAM, CloudFormation and the AWS CI/CD services, and roll back safely.',
  hue: 120,
  domain: 'dva-d3',
  levels: [
    lesson({
      id: 'dva-packaging',
      title: 'Packaging and Infrastructure as Code',
      system: 'Cargo Packing',
      skills: ['aws-operations', 'aws-compute'],
      brief: `**ARIA:** Before code can ship, it has to be packaged with its dependencies and described as infrastructure. SAM and CloudFormation are how developers do both.`,
      lesson: `## Lambda deployment packages

| Option | Limits and notes |
|---|---|
| **.zip archive** | 50 MB zipped for direct upload (larger via S3), **250 MB unzipped** including layers |
| **Container image** | Up to **10 GB**, stored in **Amazon ECR**; for big dependencies or existing container tooling |
| **Layers** | Shared dependencies, up to 5 per function, versioned |

Keep dependencies inside the package (or a layer), configuration in **environment variables** or **AWS AppConfig**, and secrets in Secrets Manager. Organise the repo so each function's handler and dependencies are clear.

## AWS SAM (Serverless Application Model)

A CloudFormation extension (\`Transform: AWS::Serverless-2016-10-31\`) with short resource types: \`AWS::Serverless::Function\`, \`::Api\`, \`::HttpApi\`, \`::SimpleTable\`, \`::LayerVersion\`.

- \`sam build\` → build artefacts; \`sam deploy --guided\` → package to S3 and deploy a stack.
- \`sam local invoke\`, \`sam local start-api\`, \`sam local generate-event\` for local testing.
- \`sam sync --watch\` pushes code changes fast to a dev stack.
- \`DeploymentPreference\` adds **CodeDeploy** canary/linear traffic shifting with alarms and hooks.
- Deploy the same template to **different stages/accounts** with parameters.

## AWS CloudFormation essentials

- **Template** → **stack**. **Parameters** (inputs), **Mappings**, **Conditions**, **Resources**, **Outputs** (with **Export** for cross-stack references via \`Fn::ImportValue\`).
- Intrinsic functions: \`Ref\`, \`Fn::GetAtt\`, \`Fn::Sub\`, \`Fn::Join\`, \`Fn::If\`.
- **Change sets** preview changes before updating. **Drift detection** finds manual changes. Failures **roll back** automatically.
- **Nested stacks** and **StackSets** (many accounts/Regions).

## AWS AppConfig

Manage **configuration and feature flags** separately from code: validate (JSON schema or Lambda validators), deploy gradually with a **deployment strategy**, and **roll back automatically** on CloudWatch alarms. Different configuration per environment (dev, test, prod).`,
      questions: [
        q('A Lambda function needs 3 GB of machine-learning libraries. Which packaging option fits?', ['A container image in Amazon ECR', 'A .zip uploaded directly', 'A single layer', 'An environment variable'], 0, 'Container images go up to 10 GB; zip packages are limited to 250 MB unzipped.'),
        q('Which line in a template tells CloudFormation it is an AWS SAM template?', ['Transform: AWS::Serverless-2016-10-31', 'AWSTemplateFormatVersion only', 'Outputs: Export', 'Fn::ImportValue'], 0, 'The SAM transform expands serverless resource types.'),
        q('A team wants to see exactly what will change in a production stack before updating it. What should it use?', ['A CloudFormation change set', 'Drift detection', 'Stack deletion', 'A nested stack'], 0, 'Change sets preview updates.'),
        q('Stack B needs the VPC ID created by stack A. How should it be shared?', ['Export it from A\'s Outputs and use Fn::ImportValue in B', 'Copy the ID by hand', 'Use a mapping', 'Put it in a Lambda layer'], 0, 'Exports and ImportValue share values across stacks.'),
        q('A team wants to turn a new feature on for 10% of users and roll back automatically if errors rise, without redeploying code. Which service fits?', ['AWS AppConfig feature flags with a deployment strategy and alarm rollback', 'CloudFormation drift detection', 'Amazon ECR', 'AWS Private CA'], 0, 'AppConfig deploys config gradually with automatic rollback.'),
        q('Which SAM command runs an API and its Lambda functions locally for testing?', ['sam local start-api', 'sam deploy', 'aws cloudformation describe-stacks', 'sam logs'], 0, 'start-api emulates API Gateway locally.'),
      ],
    }),
    lesson({
      id: 'dva-environments',
      title: 'Environments and Testing',
      system: 'Test Range',
      skills: ['aws-operations'],
      brief: `**ARIA:** Dev, test and prod must run the same code with different settings, and you must be able to test each before users see it. Stages, aliases and tags make that possible.`,
      lesson: `## Environments inside services

- **API Gateway stages** (\`dev\`, \`test\`, \`prod\`): each a separate deployment of the API with its own URL, settings, throttling and **stage variables**. A stage variable can choose the backend, for example \`${'${'}stageVariables.lambdaAlias}\` to call the matching Lambda **alias**.
- **Custom domain names** map \`api.example.com\` to stages (base path mappings).
- **Lambda versions and aliases:** \`dev\` → $LATEST, \`prod\` → version 7. Promote by moving the alias.
- **Container image tags** pin approved versions for integration testing.
- **AWS Amplify branches:** each Git branch can deploy its own environment.
- Separate **accounts** for dev and prod give the strongest isolation.

## Testing

- **Test events:** JSON payloads for Lambda (console test events, \`sam local generate-event\`).
- **Integration tests** against a deployed dev/test stage; **mock** external dependencies (API Gateway mock integrations, SDK client mocks, stubs).
- **Event-driven apps:** publish test events to EventBridge or SQS and assert on outcomes; use EventBridge archive and replay.
- Deploy the same **SAM/CloudFormation template** to a staging stack with different parameters to test updates before production.
- **Amazon Q Developer** can generate unit tests.`,
      questions: [
        q('The prod stage of an API must call the prod alias of a Lambda function, and the dev stage the dev alias, with one API definition. What should be used?', ['Stage variables referencing the Lambda alias', 'Two separate AWS accounts only', 'A usage plan', 'A mock integration'], 0, 'Stage variables can select the alias per stage.'),
        q('How should a Lambda function be released to production so the release can be reversed instantly?', ['Point the prod alias at a new version; move it back to roll back', 'Edit $LATEST in place', 'Delete the old version first', 'Change the handler name'], 0, 'Aliases make promotion and rollback a pointer change.'),
        q('A team needs each feature branch of its web front end deployed to its own preview URL. Which service fits?', ['AWS Amplify branch deployments', 'Amazon SQS', 'AWS Backup', 'AWS Artifact'], 0, 'Amplify can deploy every branch as an environment.'),
        q('Integration tests must not call a slow, paid third-party API. What is a good approach?', ['Mock the external dependency (for example with a mock integration or SDK stub)', 'Call production instead', 'Skip integration tests', 'Raise the API timeout'], 0, 'Mocks isolate tests from external services.'),
        q('How can an event-driven workflow be tested end to end in a dev account?', ['Publish test events to the bus or queue and assert on the resulting outputs', 'Only unit-test the handler signatures', 'Test in production at night', 'Disable EventBridge rules'], 0, 'Inject events and verify outcomes.'),
        q('Which gives the strongest isolation between development and production?', ['Separate AWS accounts', 'Different Lambda memory sizes', 'Different log group names only', 'Different tags only'], 0, 'Separate accounts isolate permissions, limits and blast radius.'),
      ],
    }),
    lesson({
      id: 'dva-cicd',
      title: 'CI/CD and Deployment Strategies',
      system: 'Launch Sequencer',
      skills: ['aws-operations'],
      brief: `**ARIA:** Commit, build, test, deploy, and if it goes wrong, undo, automatically. The exam tests the AWS CI/CD services and every deployment strategy by name.`,
      lesson: `## The pipeline services

| Service | Job | Config |
|---|---|---|
| **AWS CodePipeline** | Orchestrates **stages** (source → build → test → deploy), with **manual approvals** | Pipeline definition |
| **AWS CodeBuild** | Compiles, runs tests, builds images | **buildspec.yml**: phases \`install\`, \`pre_build\`, \`build\`, \`post_build\`; \`artifacts\`; env vars (also from Parameter Store/Secrets Manager); cache |
| **AWS CodeDeploy** | Deploys to **EC2/on-premises, Lambda, ECS** | **appspec.yml** with lifecycle **hooks** (for EC2: \`BeforeInstall\`, \`AfterInstall\`, \`ApplicationStart\`, \`ValidateService\`…) |
| **AWS CodeArtifact** | Package repository (npm, Maven, pip) | |

Source is usually **GitHub, GitLab or Bitbucket** through **CodeConnections**, or S3 or ECR. A **commit** to a branch triggers the pipeline; **tags and branches** mark versions and releases.

## Deployment strategies

| Strategy | How |
|---|---|
| **All at once** | Everything updates together: fastest, downtime and risk |
| **Rolling** | Batches of instances update in turn |
| **Rolling with additional batch** | Adds new instances first, keeping full capacity |
| **Immutable** | Launches a fresh set of instances, then swaps |
| **Blue/green** | A full new environment (green) next to the old (blue); switch traffic, switch back to roll back |
| **Canary** | A small percentage first, then the rest (Lambda: \`Canary10Percent5Minutes\`) |
| **Linear** | Equal increments over time (\`Linear10PercentEvery1Minute\`) |

**CodeDeploy** shifts Lambda alias traffic and ECS (blue/green) traffic, runs validation hooks, and **rolls back automatically** when a **CloudWatch alarm** fires or the deployment fails. **Elastic Beanstalk** offers all-at-once, rolling, rolling with additional batch, immutable and traffic splitting, plus blue/green by swapping environment URLs.`,
      questions: [
        q('Which file tells CodeBuild how to build and test a project?', ['buildspec.yml', 'appspec.yml', 'template.yaml', 'package.json only'], 0, 'buildspec.yml defines build phases and artifacts.'),
        q('Which file defines CodeDeploy lifecycle hooks such as BeforeInstall and ValidateService?', ['appspec.yml', 'buildspec.yml', 'Dockerfile', 'samconfig.toml'], 0, 'appspec.yml describes the deployment and hooks.'),
        q('A Lambda release should send 10% of traffic to the new version for 5 minutes, then the rest. Which configuration fits?', ['CodeDeploy Canary10Percent5Minutes', 'Linear10PercentEvery1Minute', 'AllAtOnce', 'Rolling with additional batch'], 0, 'Canary: one small step, then everything.'),
        q('A deployment must roll back automatically if errors increase. What should be configured?', ['CodeDeploy automatic rollback tied to a CloudWatch alarm', 'A manual approval only', 'A longer buildspec', 'A larger instance'], 0, 'Alarm-based rollback reverses bad deployments automatically.'),
        q('An Elastic Beanstalk app must keep full capacity during deployment and launch new instances instead of updating existing ones in place. Which policies fit? (Pick the best answer.)', ['Immutable (or rolling with additional batch)', 'All at once', 'Rolling without additional batch', 'Delete and recreate the environment'], 0, 'Immutable launches new instances; rolling with additional batch keeps capacity.'),
        q('A pipeline must pause for a manager to approve before deploying to production. What should be added?', ['A manual approval action in CodePipeline', 'A CodeBuild cache', 'A Lambda layer', 'An S3 lifecycle rule'], 0, 'CodePipeline supports manual approval actions.'),
      ],
    }),
    checkpoint({
      id: 'dva-deploy-checkpoint',
      title: 'Checkpoint: Deployment',
      system: 'Launch Certification Gate',
      skills: ['aws-operations'],
      brief: `**ARIA:** Developer-level scenarios on packaging, SAM and CloudFormation, environments, and CI/CD strategies.`,
      lesson: `## Before you start

- Zip (250 MB unzipped) vs container image (10 GB, ECR) vs layers. SAM transform; sam build/deploy/local; change sets; Outputs/Export/ImportValue; AppConfig.
- API Gateway stages and stage variables; Lambda versions and aliases; Amplify branches; separate accounts.
- buildspec.yml (CodeBuild), appspec.yml (CodeDeploy), CodePipeline stages and approvals.
- All at once, rolling, rolling + batch, immutable, blue/green, canary, linear; alarm-based rollback.`,
      questions: [
        q('A team wants the lowest-risk way to release a new ECS service version, with instant rollback by switching traffic back. Which strategy fits?', ['Blue/green deployment with CodeDeploy', 'All at once', 'In-place rolling with no health checks', 'Deleting the old service first'], 0, 'Blue/green keeps the old version ready to switch back.'),
        q('A SAM template should deploy a function with traffic shifting and alarms. Which property adds this?', ['DeploymentPreference on the AWS::Serverless::Function', 'Outputs', 'Mappings', 'A buildspec phase'], 0, 'DeploymentPreference configures CodeDeploy traffic shifting.'),
        q('A CloudFormation update fails halfway. What does CloudFormation do by default?', ['Rolls back to the last stable state', 'Leaves half the changes in place', 'Deletes the stack', 'Retries forever'], 0, 'Failed updates roll back automatically.'),
        q('Different environments need different database URLs without code changes. Where should they live?', ['Environment-specific configuration: environment variables, Parameter Store or AppConfig', 'Hard-coded in the source', 'In the Lambda handler name', 'In the S3 bucket name only'], 0, 'Configuration belongs outside code, per environment.'),
        q('A build needs a database password during integration tests. How should CodeBuild get it?', ['Reference it from Secrets Manager or Parameter Store in buildspec env', 'Commit it to the repository', 'Print it in the build logs', 'Store it in the artifact'], 0, 'buildspec can pull secrets from Secrets Manager or Parameter Store.'),
        q('Which strategy shifts equal portions of traffic at regular intervals until 100%?', ['Linear', 'Canary', 'All at once', 'Blue/green with an instant switch'], 0, 'Linear shifts equal increments over time.'),
        q('A developer pushes to the main branch and wants build, test and deploy to start automatically. What is needed?', ['A CodePipeline with the repository as its source (via CodeConnections)', 'A manual sam deploy each time', 'A CloudFormation change set only', 'An SQS queue'], 0, 'Pipelines trigger on commits to the source.'),
        q('A function\'s deployment package is 300 MB unzipped with its layers. What should be done?', ['Package it as a container image', 'Split the handler name', 'Increase memory', 'Raise the timeout'], 0, 'Zip packages are limited to 250 MB unzipped; container images go to 10 GB.'),
      ],
    }),
  ],
};
