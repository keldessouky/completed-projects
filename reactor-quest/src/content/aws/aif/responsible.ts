// AIF-C01 Domain 4: Guidelines for Responsible AI (14% of the exam).
import type { Deck } from '../../../game/types';
import { checkpoint, lesson, q } from '../kit';

export const aifResponsible: Deck = {
  id: 'aif-responsible',
  name: 'Responsible AI',
  subtitle: 'Domain 4 · 14% of the exam',
  outcome: 'Build AI that is fair, safe, honest and explainable, and know which AWS tools check it.',
  hue: 140,
  domain: 'aif-d4',
  levels: [
    lesson({
      id: 'aif-responsible-features',
      title: 'What Responsible AI Means',
      system: 'Ethics Core',
      skills: ['responsible-ai'],
      brief: `**ARIA:** I try very hard to be fair, safe and truthful. "Try" isn't good enough for an auditor, so AWS breaks responsible AI into named dimensions, and gives you tools to enforce them.`,
      lesson: `## The dimensions of responsible AI

| Dimension | Meaning |
|---|---|
| **Fairness** | Outcomes don't unjustly disadvantage groups of people |
| **Bias** (to avoid) | Systematic skew in data or outputs against some groups |
| **Inclusivity** | Works for diverse users, languages and abilities |
| **Robustness** | Works reliably, even with unusual or adversarial input |
| **Safety** | Avoids harmful output and harmful actions |
| **Veracity** | Outputs are **truthful and accurate** |
| **Explainability / transparency** | People can understand how and why it works |
| **Privacy and security**, **controllability**, **governance** | Protected data, human oversight, accountability |

## Amazon Bedrock Guardrails

Configurable safeguards applied to **inputs and outputs** of any model:

- **Content filters:** hate, insults, sexual, violence, misconduct, and **prompt attacks**, at adjustable strengths (for text and images).
- **Denied topics:** topics the app must refuse (for example, investment advice).
- **Word filters:** block specific words or phrases.
- **Sensitive information filters:** detect and **block or mask PII** (and custom regex patterns).
- **Contextual grounding checks:** catch answers **not supported by the source** or not relevant to the question (hallucinations in RAG).
- **Automated Reasoning checks:** verify answers against formal rules (policies) with logic.

## Choosing models responsibly

Consider **environmental impact and sustainability**: a smaller, efficient model (or one already trained) uses far less energy than training or running a huge one. Consider the model's documentation, licence and known limitations.`,
      questions: [
        q('An AI hiring tool consistently ranks applicants from one group lower for no job-related reason. Which responsible AI dimension is violated?', ['Fairness', 'Latency', 'Elasticity', 'Durability'], 0, 'Unjust disadvantage to a group violates fairness.'),
        q('Which dimension means AI outputs are truthful and accurate?', ['Veracity', 'Inclusivity', 'Controllability', 'Scalability'], 0, 'Veracity = truthfulness.'),
        q('A banking chatbot must never give investment advice. Which Guardrails feature fits?', ['Denied topics', 'Word filters only', 'Prompt caching', 'Provisioned Throughput'], 0, 'Denied topics block whole subjects.'),
        q('A support bot must mask customer phone numbers and emails in its responses. Which Guardrails feature fits?', ['Sensitive information (PII) filters', 'Contextual grounding check', 'Denied topics', 'Temperature control'], 0, 'Sensitive information filters block or mask PII.'),
        q('A RAG app sometimes answers with facts that aren\'t in its source documents. Which Guardrails feature helps detect this?', ['Contextual grounding check', 'Word filters', 'Content filter for insults', 'Batch inference'], 0, 'Grounding checks flag unsupported answers.'),
        q('Which choice is more sustainable when selecting a model?', ['Always the largest model available', 'The smallest efficient model that meets quality needs', 'Training a new model from scratch for every app', 'Running models 24/7 without traffic'], 1, 'Smaller, efficient models use less energy.'),
      ],
    }),
    lesson({
      id: 'aif-bias-data',
      title: 'Bias, Variance and Data',
      system: 'Balance Scales',
      skills: ['responsible-ai', 'ai-ml'],
      brief: `**ARIA:** Most unfair AI isn't malicious; it learned from lopsided data. Learn where bias comes from, how to spot it, and the legal trouble it brings.`,
      lesson: `## Good datasets are…

**Inclusive** and **diverse** (they represent everyone the model will serve), **balanced** (no group or class drowned out), from **curated**, trustworthy sources, accurately **labelled**, and lawfully obtained.

## Bias and variance

| | Means | Leads to |
|---|---|---|
| **High bias** | The model is **too simple**; misses real patterns | **Underfitting**: poor on training *and* new data |
| **High variance** | The model is **too sensitive** to training data | **Overfitting**: great on training data, poor on new data |

Aim for the balance. Bias in data (for example too few examples from one demographic group) causes **inaccurate and unfair results for that group**.

## Detecting and monitoring bias

- **SageMaker Clarify:** measures bias in data before training and in predictions after, and explains feature importance.
- **Analyse label quality:** wrong or inconsistent labels teach wrong lessons.
- **Subgroup analysis:** check metrics separately for each group, not just overall.
- **Human audits** and review (Amazon A2I).
- Monitor in production (SageMaker Model Monitor detects bias drift).

## Legal and business risks of GenAI

- **Intellectual property** infringement claims (outputs copying protected work, training data rights).
- **Biased outputs** leading to discrimination claims.
- **Hallucinations** causing harm or bad decisions.
- **Loss of customer trust** and reputational damage.
- **End-user risk**: people acting on wrong or harmful advice.`,
      questions: [
        q('A face-recognition model performs poorly for people with darker skin because they were rare in the training data. What is the root cause?', ['Unrepresentative (imbalanced) training data', 'Too high a temperature', 'Using an IAM role', 'Too many GPUs'], 0, 'Lack of diverse, balanced data causes biased performance.'),
        q('A model is too simple and performs poorly on both training and test data. What is this?', ['High variance (overfitting)', 'High bias (underfitting)', 'Perfect fit', 'Data leakage'], 1, 'High bias = underfitting.'),
        q('Which SageMaker feature measures bias in data and model predictions?', ['SageMaker Clarify', 'SageMaker Canvas', 'SageMaker Serverless Inference', 'SageMaker Feature Store'], 0, 'Clarify detects bias and explains predictions.'),
        q('Overall accuracy looks good, but a team wants to be sure the model works well for every age group. What should it do?', ['Subgroup analysis: measure performance separately for each group', 'Increase temperature', 'Remove the test set', 'Train for fewer steps'], 0, 'Subgroup analysis reveals hidden disparities.'),
        q('Which is a legal risk of using generative AI?', ['Outputs that infringe intellectual property', 'Lower latency', 'Smaller models', 'Using encryption'], 0, 'IP infringement claims are a key GenAI legal risk.'),
        q('What characterises a good training dataset for responsible AI?', ['As small as possible', 'Diverse, balanced, accurately labelled and from curated sources', 'Taken from any website without permission', 'Containing only one group of users'], 1, 'Diversity, balance, label quality and curation reduce bias.'),
      ],
    }),
    lesson({
      id: 'aif-explainability',
      title: 'Transparent and Explainable AI',
      system: 'Glass Box',
      skills: ['responsible-ai'],
      brief: `**ARIA:** "Computer says no" isn't an acceptable answer for a loan or a medical decision. Learn the difference between a model you can explain and one you can't, and the tools that help.`,
      lesson: `## Transparent vs opaque models

| Transparent / explainable | Not transparent ("black box") |
|---|---|
| Linear regression, decision trees, rule-based models | Deep neural networks, large foundation models |
| You can see **why** a prediction was made | Hard to trace why an output was produced |
| Often **less accurate** on complex tasks | Often **more capable** |

**Interpretability** (understanding the model's inner workings) and **explainability** (explaining individual outputs) often trade off against **performance**. There's also a trade-off with **safety**: publishing every detail of a model can help attackers. Choose based on the stakes: regulated, high-impact decisions need explainability.

## Tools for transparency

- **SageMaker Clarify:** explains predictions (which features mattered, using SHAP values).
- **SageMaker Model Cards:** documents a model's **intended use, training data, evaluation results, risks and limitations**.
- **Amazon Bedrock Model Evaluation:** documented, comparable evaluation results.
- **AWS AI Service Cards:** AWS's documentation of its own AI services' intended uses and limitations.
- **Open-source models**, open **data** and clear **licensing** make inspection possible.

## Human-centred design for explainable AI

- Show **why**: explain decisions in plain language.
- Let users give **feedback** and **contest** decisions.
- Be clear when people are interacting with AI (**AI decision transparency**).
- Keep **humans in the loop** for high-stakes decisions (Amazon A2I).`,
      questions: [
        q('A regulator requires a bank to explain each loan decision. Which model type makes this easiest?', ['A large opaque neural network', 'A transparent model such as a decision tree', 'A diffusion model', 'An image generator'], 1, 'Transparent models make explanations straightforward.'),
        q('Which tool documents a model\'s intended use, training data, evaluation results and limitations?', ['SageMaker Model Cards', 'Amazon CloudFront', 'AWS Budgets', 'Amazon Polly'], 0, 'Model Cards document models for transparency and governance.'),
        q('Which SageMaker feature shows which input features most influenced a prediction?', ['SageMaker Clarify (feature attributions)', 'SageMaker Ground Truth', 'SageMaker JumpStart', 'SageMaker Canvas only'], 0, 'Clarify explains predictions with feature importance.'),
        q('What is a common trade-off with highly interpretable models?', ['They are always the most accurate', 'They may perform worse on complex tasks than opaque models', 'They can\'t be documented', 'They need more GPUs'], 1, 'Interpretability often costs some performance.'),
        q('Which is a principle of human-centred design for explainable AI?', ['Hide that AI is involved', 'Let users understand, give feedback on and contest AI decisions', 'Never allow human review', 'Remove explanations to save time'], 1, 'Transparency and user feedback are core principles.'),
        q('Where does AWS document the intended uses and limitations of its own AI services?', ['AWS AI Service Cards', 'AWS Trusted Advisor', 'Amazon Macie', 'AWS Organizations'], 0, 'AI Service Cards cover AWS AI services\' responsible use.'),
      ],
    }),
    checkpoint({
      id: 'aif-responsible-checkpoint',
      title: 'Checkpoint: Responsible AI',
      system: 'Ethics Certification Gate',
      skills: ['responsible-ai'],
      brief: `**ARIA:** Exam-style scenarios on fairness, bias, Guardrails, explainability and the risks of GenAI.`,
      lesson: `## Before you start

- Fairness, bias, inclusivity, robustness, safety, veracity, explainability.
- Guardrails: content filters, denied topics, word filters, PII filters, contextual grounding, Automated Reasoning.
- High bias = underfitting; high variance = overfitting. Diverse, balanced, curated data.
- Clarify (bias, explanations), Model Cards (documentation), A2I (human review), subgroup analysis.
- Legal risks: IP, biased outputs, hallucinations, trust.`,
      questions: [
        q('A children\'s education app must block violent and sexual content in both prompts and responses. Which feature fits?', ['Bedrock Guardrails content filters', 'Prompt caching', 'Batch inference', 'SageMaker Canvas'], 0, 'Content filters screen inputs and outputs.'),
        q('After launch, a loan model starts approving one group less often than before. Which tool can monitor this bias drift?', ['SageMaker Model Monitor with Clarify', 'Amazon Polly', 'AWS Budgets', 'Amazon Translate'], 0, 'Model Monitor integrates Clarify to detect bias drift.'),
        q('A company worries that its image generator could reproduce copyrighted artwork. Which risk is this?', ['Intellectual property infringement', 'Latency', 'Underfitting', 'Token pricing'], 0, 'IP infringement is a GenAI legal risk.'),
        q('Which practice best reduces bias before training?', ['Use diverse, balanced, representative data and check label quality', 'Raise temperature', 'Train on one demographic group', 'Skip evaluation'], 0, 'Data quality and balance are the first line of defence.'),
        q('High-stakes medical predictions must be reviewed by doctors when the model is unsure. Which service fits?', ['Amazon Augmented AI (A2I)', 'Amazon S3', 'Amazon Lex', 'AWS Artifact'], 0, 'A2I routes low-confidence predictions to human reviewers.'),
        q('Which statement about model transparency is true?', ['Opaque models can never be used', 'More complex models are often more capable but harder to explain', 'Simple models are always more accurate', 'Transparency has no trade-offs'], 1, 'Capability and interpretability often trade off.'),
        q('A model performs well in training but poorly on new data. What should the team suspect?', ['High variance (overfitting)', 'High bias (underfitting)', 'Too much fairness', 'Prompt injection'], 0, 'Overfitting = high variance.'),
        q('A company must check its chatbot\'s answers about refund policy against the formal policy rules, with logic. Which Guardrails feature fits?', ['Automated Reasoning checks', 'Word filters', 'Content filters for insults', 'Prompt Management'], 0, 'Automated Reasoning checks verify answers against formal rules.'),
      ],
    }),
  ],
};
