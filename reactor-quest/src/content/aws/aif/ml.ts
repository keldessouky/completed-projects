// AIF-C01 Domain 1: Fundamentals of AI and ML (20% of the exam).
import type { Deck } from '../../../game/types';
import { checkpoint, lesson, q } from '../kit';

export const aifMl: Deck = {
  id: 'aif-ml',
  name: 'AI and ML Fundamentals',
  subtitle: 'Domain 1 · 20% of the exam',
  outcome: 'Speak the language of AI: what models learn from, which technique fits a problem, and how a model gets to production.',
  hue: 260,
  domain: 'aif-d1',
  levels: [
    lesson({
      id: 'aif-ai-terms',
      title: 'AI, ML, Deep Learning, GenAI',
      system: 'ARIA\'s Family Tree',
      skills: ['ai-ml'],
      brief: `**ARIA:** People keep asking me whether I'm "AI" or "machine learning" or "generative". The honest answer is: yes. Let's sort the words out, because the exam uses every one of them precisely.`,
      lesson: `## Nested ideas

- **Artificial intelligence (AI):** any technique that lets a computer do something we'd call intelligent: understand language, recognise images, make decisions.
- **Machine learning (ML):** a kind of AI where the computer **learns patterns from data** instead of being given rules by a programmer.
- **Deep learning:** ML that uses **neural networks** with many layers. It powers modern vision, speech and language.
- **Generative AI (GenAI):** deep learning models that **create new content** (text, images, audio, code) rather than only classify or predict.
- **Agentic AI:** systems where a model **plans and takes actions** towards a goal, using tools (APIs, databases, other agents), with some autonomy.

Each is a subset of the one before it, except agentic AI, which is a way of *using* models (usually generative ones).

## Words you must know

| Term | Meaning |
|---|---|
| **Algorithm** | The method used to learn (for example, a decision tree or a neural network) |
| **Model** | What you get after training: the learned patterns, ready to make predictions |
| **Training** | Feeding data to an algorithm so it learns |
| **Inference** | Using a trained model to make a prediction on new data |
| **Neural network** | Layers of connected "neurons" whose connection weights are learned |
| **Computer vision (CV)** | AI that understands images and video |
| **Natural language processing (NLP)** | AI that understands and produces human language |
| **Large language model (LLM)** | A very large neural network (a **transformer**) trained on huge amounts of text |
| **Fit** | How well a model matches the data: **overfitting** memorises the training data and fails on new data; **underfitting** hasn't learned enough |
| **Bias** | A systematic error, for example from unrepresentative data, that can make outcomes unfair to some groups |
| **Fairness** | Outcomes that don't disadvantage groups of people unjustly |`,
      questions: [
        q('Which statement best describes machine learning?', ['A programmer writes explicit rules for every case', 'A computer learns patterns from data to make predictions', 'A robot that moves on its own', 'Any software that uses a database'], 1, 'ML learns from data instead of following hand-written rules.'),
        q('What is inference?', ['Collecting training data', 'Using a trained model to make predictions on new data', 'Labelling images by hand', 'Choosing an algorithm'], 1, 'Training builds the model; inference uses it.'),
        q('Which is the correct relationship?', ['ML is a subset of deep learning', 'Deep learning is a subset of ML, which is a subset of AI', 'AI is a subset of generative AI', 'GenAI and deep learning are unrelated'], 1, 'AI ⊃ ML ⊃ deep learning ⊃ generative AI.'),
        q('A model scores 99% on its training data but 60% on new data. What is happening?', ['Underfitting', 'Overfitting', 'Good generalisation', 'Data drift'], 1, 'Memorising the training data and failing on new data is overfitting.'),
        q('Which describes agentic AI?', ['A model that only classifies images', 'A system where a model plans and takes actions with tools to reach a goal', 'A database of labelled data', 'A rule-based chatbot'], 1, 'Agents reason, plan and act using tools, with some autonomy.'),
        q('Which field of AI focuses on understanding human language?', ['Computer vision', 'Natural language processing', 'Reinforcement learning', 'Time-series forecasting'], 1, 'NLP covers understanding and generating language.'),
      ],
    }),
    lesson({
      id: 'aif-learning-data',
      title: 'How Models Learn, and From What',
      system: 'Training Grounds',
      skills: ['ai-ml'],
      brief: `**ARIA:** A model is only as good as what it learned from, and how. Three ways to learn; many kinds of data. The exam asks you to match them to problems.`,
      lesson: `## Three types of learning

| Type | Learns from | Example |
|---|---|---|
| **Supervised learning** | **Labelled** data: inputs with the right answers | Emails labelled spam/not spam → predict spam |
| **Unsupervised learning** | **Unlabelled** data: finds structure by itself | Group customers into segments nobody defined |
| **Reinforcement learning (RL)** | **Rewards and penalties** from trying actions in an environment | A robot, game player or warehouse route learning by trial and error |

Also: **self-supervised learning** (how foundation models are pre-trained: the data labels itself, for example "predict the next word"), and **RLHF**, reinforcement learning from human feedback, used to align language models with what people prefer.

## Kinds of data

- **Labelled** (has the answer attached) vs **unlabelled**.
- **Structured** (rows and columns, a schema) vs **unstructured** (free text, images, audio, video).
- **Tabular:** spreadsheet-like rows and columns.
- **Time-series:** values over time (sensor readings, sales per day) where order matters.
- **Image**, **text**, **audio**, **video**.

Labelling is often the expensive part. **Amazon SageMaker Ground Truth** helps build labelled datasets with human labellers (your own, vendors, or a crowd) and active learning.`,
      questions: [
        q('A bank has historical transactions labelled "fraud" or "legitimate" and wants to flag new fraud. Which type of learning fits?', ['Unsupervised learning', 'Supervised learning', 'Reinforcement learning', 'No ML is needed'], 1, 'Labelled examples with known answers → supervised learning.'),
        q('A retailer wants to discover natural groups among its customers without predefined categories. Which type of learning fits?', ['Supervised learning', 'Unsupervised learning (clustering)', 'Reinforcement learning', 'Regression'], 1, 'Finding structure in unlabelled data is unsupervised learning.'),
        q('A system learns to control a robot arm by trying actions and receiving rewards for success. Which type is this?', ['Reinforcement learning', 'Supervised learning', 'Unsupervised learning', 'Transfer learning'], 0, 'Learning from rewards in an environment is reinforcement learning.'),
        q('Which is an example of unstructured data?', ['A table of customer orders', 'Customer support call recordings', 'A CSV of daily sales', 'A relational database of products'], 1, 'Audio, images and free text are unstructured.'),
        q('Hourly temperature readings from a sensor, where order matters, are which type of data?', ['Tabular only', 'Time-series', 'Image', 'Unlabelled text'], 1, 'Values indexed by time are time-series data.'),
        q('Which AWS service helps create high-quality labelled training datasets with human labellers?', ['Amazon SageMaker Ground Truth', 'Amazon Polly', 'AWS Glue', 'Amazon Kendra'], 0, 'Ground Truth manages data labelling workflows.'),
      ],
    }),
    lesson({
      id: 'aif-use-cases',
      title: 'When AI Helps, and When It Doesn\'t',
      system: 'Mission Triage',
      skills: ['ai-ml'],
      brief: `**ARIA:** Ground control wants "AI for everything". Part of the job is knowing which technique fits a problem, and when the answer is "don't use AI at all".`,
      lesson: `## Where AI/ML adds value

- **Assisting human decisions** (flagging risky loans for a person to review)
- **Scaling** work no team could do by hand (reading millions of documents)
- **Automating** repetitive tasks (routing support tickets)
- Finding patterns too complex for hand-written rules

## When AI is **not** the right choice

- When you need a **specific, guaranteed outcome**, not a prediction (calculating tax owed exactly: write the rule).
- When the **cost outweighs the benefit** (little data, small problem, a simple rule works).
- When decisions must be fully **explainable** and the model can't be.
- When there isn't enough good data.

## Matching technique to problem

| Problem | Technique | Example |
|---|---|---|
| Predict a **number** | **Regression** | House price, demand next week |
| Predict a **category** | **Classification** (binary or multi-class) | Spam or not, which product category |
| Find **groups** | **Clustering** | Customer segments |
| Spot **unusual** items | **Anomaly detection** | Fraud, failing machines |
| Predict future values over time | **Forecasting** | Sales next quarter |
| Suggest items | **Recommendation** | "Customers also bought" |

## Traditional ML or a foundation model?

- **Traditional ML** (a model trained for one task on your data): cheaper per prediction, more **explainable**, easier to satisfy strict **regulators**, predictable latency. Good for tabular predictions like credit scoring.
- **Foundation models**: flexible, handle language and images out of the box, quick to start, but larger, costlier per call, less explainable and **nondeterministic**.`,
      questions: [
        q('A company wants to predict the price a used car will sell for. Which technique fits?', ['Classification', 'Regression', 'Clustering', 'Anomaly detection'], 1, 'Predicting a continuous number is regression.'),
        q('An insurer wants to sort incoming claims into "auto", "home" or "travel". Which technique fits?', ['Multi-class classification', 'Regression', 'Clustering', 'Reinforcement learning'], 0, 'Assigning one of several categories is classification.'),
        q('When is an AI/ML solution NOT appropriate?', ['When patterns are too complex for rules', 'When an exact, deterministic result is required and a simple rule can produce it', 'When there is a lot of labelled data', 'When work must scale to millions of items'], 1, 'If you need a guaranteed exact outcome, write the rule; ML gives predictions.'),
        q('A regulated lender must explain every credit decision to customers and regulators. What is usually the better fit?', ['A large general-purpose foundation model', 'A traditional, explainable ML model trained on its own data', 'A diffusion model', 'No model, randomly approve'], 1, 'Explainability and regulatory needs favour traditional, interpretable models.'),
        q('A factory wants to detect machines behaving unusually before they fail. Which technique fits?', ['Anomaly detection', 'Text summarisation', 'Image generation', 'Regression on prices'], 0, 'Spotting unusual behaviour is anomaly detection.'),
        q('Which is a valid reason to use AI/ML?', ['To replace a one-line rule that already works perfectly', 'To help people review millions of documents they couldn\'t read by hand', 'To calculate an invoice total exactly', 'Because every project needs AI'], 1, 'Scale and automation of complex tasks are where ML adds value.'),
      ],
    }),
    lesson({
      id: 'aif-aws-ai-services',
      title: 'AWS AI Services',
      system: 'ARIA\'s Cousins',
      skills: ['ai-ml', 'genai'],
      brief: `**ARIA:** Before you build anything, check whether AWS already has a ready-made service for it. Most exam scenarios have one right answer here.`,
      lesson: `## Ready-made AI services (no ML expertise needed)

| Task | Service |
|---|---|
| **Speech to text** | **Amazon Transcribe** (also call analytics, medical) |
| **Text to speech** | **Amazon Polly** |
| **Translate** text | **Amazon Translate** |
| **Understand text**: sentiment, entities, key phrases, PII, language | **Amazon Comprehend** (Comprehend Medical for health text) |
| **Chatbots**, voice and text | **Amazon Lex** |
| **Images and video**: objects, faces, text, unsafe content | **Amazon Rekognition** |
| **Extract text, forms and tables** from documents | **Amazon Textract** |
| **Search** company documents with natural language | **Amazon Kendra** |
| **Recommendations** | **Amazon Personalize** |
| Generative AI with foundation models | **Amazon Bedrock** (next floor) |

## Building your own models: Amazon SageMaker AI

A fully managed platform to **build, train and deploy** ML models. Parts you'll see on the exam:

- **SageMaker Canvas:** build ML models with **no code**.
- **SageMaker JumpStart:** a hub of **pre-trained models** and solutions to deploy or fine-tune.
- **SageMaker Data Wrangler:** prepare and transform data visually. **Feature Store:** store and share features.
- **SageMaker Clarify:** detect **bias** and **explain** predictions.
- **SageMaker Model Monitor:** watch deployed models for **drift** and quality problems.
- **SageMaker Model Cards:** document a model's purpose, data and risks. **Model Registry:** version models.
- **SageMaker Pipelines:** automate ML workflows (MLOps).
- **Amazon Augmented AI (A2I):** send low-confidence predictions to **human reviewers**.`,
      questions: [
        q('A company wants to convert recorded customer calls into text. Which service fits?', ['Amazon Polly', 'Amazon Transcribe', 'Amazon Translate', 'Amazon Lex'], 1, 'Transcribe converts speech to text.'),
        q('Which service detects the sentiment of product reviews?', ['Amazon Comprehend', 'Amazon Rekognition', 'Amazon Textract', 'Amazon Personalize'], 0, 'Comprehend analyses text for sentiment, entities and more.'),
        q('A business analyst with no coding skills wants to build a prediction model from a spreadsheet. Which tool fits?', ['SageMaker Canvas', 'SageMaker Pipelines', 'Amazon EC2', 'AWS Glue'], 0, 'Canvas is no-code ML.'),
        q('Which SageMaker feature detects bias in data and explains model predictions?', ['SageMaker Clarify', 'SageMaker Model Monitor', 'SageMaker JumpStart', 'SageMaker Feature Store'], 0, 'Clarify handles bias detection and explainability.'),
        q('A team wants low-confidence predictions from its model to be checked by people. Which service fits?', ['Amazon Augmented AI (A2I)', 'Amazon Polly', 'AWS Config', 'Amazon Kendra'], 0, 'A2I adds human review workflows.'),
        q('Which service extracts data from scanned forms and tables?', ['Amazon Textract', 'Amazon Transcribe', 'Amazon Comprehend', 'Amazon Translate'], 0, 'Textract extracts text, forms and tables from documents.'),
      ],
    }),
    lesson({
      id: 'aif-ml-lifecycle',
      title: 'The ML Lifecycle and MLOps',
      system: 'Assembly Line',
      skills: ['ai-ml'],
      brief: `**ARIA:** A model isn't a one-off. It's collected, cleaned, trained, tested, deployed, watched, and retrained. Learn the pipeline and where each AWS tool fits.`,
      lesson: `## The ML pipeline

1. **Define the business problem** and how success is measured.
2. **Collect data.**
3. **Prepare data:** clean, label, explore (EDA), **feature engineering** (turn raw data into useful inputs). Split into **training, validation and test** sets.
4. **Train** the model; **tune hyperparameters** (settings chosen before training, like learning rate or number of layers).
5. **Evaluate** against metrics on data it hasn't seen.
6. **Deploy** for inference.
7. **Monitor** for **drift** (the real world changing so the data no longer looks like the training data) and **retrain**.

## Where models come from

- Open-source **pre-trained** models (for example, from SageMaker JumpStart or Hugging Face).
- Models offered as a **managed API** (Amazon Bedrock).
- **Training your own** custom model.

## Ways to run a model in production

- A **managed API service** (Bedrock: no infrastructure).
- **Self-hosted** on an endpoint you manage (SageMaker AI or EC2).

## SageMaker AI inference options

| Option | Use it when |
|---|---|
| **Real-time** endpoint | Low latency, steady traffic, one prediction at a time |
| **Serverless** inference | Intermittent or unpredictable traffic; pay only when used; tolerates cold starts |
| **Asynchronous** inference | Large payloads (up to 1 GB) or long processing (up to an hour); requests are queued |
| **Batch transform** | Predictions over a whole dataset at once, no endpoint needed |

## MLOps

Applying DevOps ideas to ML: **experimentation** tracked, **repeatable** automated pipelines, **scalable** systems, managing **technical debt**, **production readiness**, **monitoring** and automated **re-training**. AWS tools: SageMaker Pipelines, Model Registry, Model Monitor, Experiments.`,
      questions: [
        q('Which step turns raw data into inputs that help a model learn, such as extracting "day of week" from a timestamp?', ['Feature engineering', 'Inference', 'Deployment', 'Monitoring'], 0, 'Feature engineering creates useful model inputs.'),
        q('A model\'s accuracy drops months after deployment because customer behaviour changed. What is this called?', ['Overfitting', 'Data or model drift', 'Hyperparameter tuning', 'Underfitting during training'], 1, 'Drift happens when real-world data moves away from the training data.'),
        q('A company needs predictions for 10 million records once a month, with no need for a live endpoint. Which option fits?', ['Real-time inference', 'Batch transform', 'Serverless inference', 'Asynchronous inference'], 1, 'Batch transform scores whole datasets offline.'),
        q('An app receives a few prediction requests a day at random times and wants to pay only when used. Which option fits?', ['Real-time endpoint running 24/7', 'Serverless inference', 'Batch transform', 'A dedicated GPU instance'], 1, 'Serverless inference scales to zero between requests.'),
        q('Requests carry 500 MB video files and take 20 minutes to process. Which SageMaker option fits?', ['Real-time inference', 'Asynchronous inference', 'Serverless inference', 'Batch transform for a single request'], 1, 'Asynchronous inference handles large payloads and long processing.'),
        q('Which is a core MLOps practice?', ['Training models by hand on a laptop each time', 'Automated, repeatable pipelines with model monitoring and retraining', 'Never updating a deployed model', 'Skipping evaluation to deploy faster'], 1, 'MLOps automates and monitors the ML lifecycle.'),
      ],
    }),
    lesson({
      id: 'aif-metrics',
      title: 'Measuring Models',
      system: 'Calibration Bench',
      skills: ['ai-ml'],
      brief: `**ARIA:** "The model is 95% accurate" can be meaningless. Learn which metric fits which mistake, and remember the business always asks a different question: was it worth it?`,
      lesson: `## The confusion matrix (classification)

|  | Predicted positive | Predicted negative |
|---|---|---|
| **Actually positive** | True positive (TP) | False negative (FN) |
| **Actually negative** | False positive (FP) | True negative (TN) |

| Metric | Formula | Ask it when… |
|---|---|---|
| **Accuracy** | (TP + TN) / all | Classes are balanced |
| **Precision** | TP / (TP + FP): of the predicted positives, how many were right | **False positives are costly** (flagging good emails as spam) |
| **Recall** | TP / (TP + FN): of the real positives, how many we caught | **Missing a positive is costly** (missing cancer, missing fraud) |
| **F1 score** | Harmonic mean of precision and recall | You need a balance, especially with **imbalanced** classes |
| **AUC-ROC** | How well the model separates classes across thresholds | Comparing classifiers |

Why accuracy can lie: if 1% of transactions are fraud, a model that always says "not fraud" is 99% accurate and useless.

## Regression metrics

**MAE** (mean absolute error), **RMSE** (root mean squared error, punishes big errors more), **R²** (how much variance is explained).

## Business metrics

Models must also pay off: **cost per user**, **development costs**, **customer feedback**, **return on investment (ROI)**, conversion rate, time saved.`,
      questions: [
        q('A medical screening model must miss as few real cases as possible. Which metric should be prioritised?', ['Precision', 'Recall', 'Accuracy', 'RMSE'], 1, 'Recall measures how many real positives are caught.'),
        q('A spam filter keeps sending important emails to spam. Which metric is too low?', ['Recall', 'Precision', 'R²', 'MAE'], 1, 'False positives hurt precision.'),
        q('Only 1% of transactions are fraudulent. Why is accuracy a poor metric here?', ['Accuracy can\'t be calculated for fraud', 'A model that never predicts fraud would still be 99% accurate', 'Accuracy only works for regression', 'Accuracy ignores true negatives'], 1, 'With imbalanced classes, accuracy hides failure; use precision, recall or F1.'),
        q('Which metric balances precision and recall in one number?', ['F1 score', 'RMSE', 'MAE', 'Accuracy'], 0, 'F1 is the harmonic mean of precision and recall.'),
        q('Which metric fits a model that predicts house prices?', ['RMSE', 'Recall', 'Precision', 'F1 score'], 0, 'Regression uses errors like RMSE and MAE.'),
        q('Which is a business metric for an ML solution?', ['Return on investment', 'Recall', 'F1 score', 'AUC-ROC'], 0, 'ROI, cost per user and customer feedback measure business value.'),
      ],
    }),
    checkpoint({
      id: 'aif-ml-checkpoint',
      title: 'Checkpoint: AI and ML Fundamentals',
      system: 'Fundamentals Certification Gate',
      skills: ['ai-ml'],
      brief: `**ARIA:** Exam-style scenarios on AI vocabulary, learning types, use cases, the ML lifecycle and metrics. Already know it? Pass the checkpoint.`,
      lesson: `## Before you start

- AI ⊃ ML ⊃ deep learning ⊃ GenAI; agentic AI = models that plan and act with tools.
- Supervised (labelled), unsupervised (unlabelled), reinforcement (rewards).
- Regression = number, classification = category, clustering = groups.
- SageMaker inference: real-time, serverless, asynchronous, batch transform.
- Precision (false positives costly), recall (missed positives costly), F1 (balance).`,
      questions: [
        q('A streaming service wants to group films by viewing patterns without predefined genres. Which approach fits?', ['Supervised classification', 'Unsupervised clustering', 'Reinforcement learning', 'Linear regression'], 1, 'Grouping without labels is clustering.'),
        q('Which SageMaker feature watches a deployed model and alerts when input data drifts from the training data?', ['SageMaker Model Monitor', 'SageMaker Canvas', 'SageMaker Ground Truth', 'SageMaker JumpStart'], 0, 'Model Monitor detects drift and quality issues.'),
        q('A company wants to translate its website into 12 languages with the least effort. Which service fits?', ['Amazon Translate', 'Amazon Comprehend', 'Training a custom model in SageMaker', 'Amazon Lex'], 0, 'A managed service beats building your own.'),
        q('Settings like learning rate, chosen before training rather than learned, are called what?', ['Features', 'Hyperparameters', 'Labels', 'Inferences'], 1, 'Hyperparameters are set before training and tuned.'),
        q('A fraud model catches 95% of fraud but also blocks many genuine customers. What should the team improve?', ['Recall', 'Precision', 'Training speed', 'The amount of unlabelled data'], 1, 'Many false positives means low precision.'),
        q('A team needs a way to document a model\'s intended use, training data and evaluation results for auditors. Which feature fits?', ['SageMaker Model Cards', 'SageMaker Data Wrangler', 'Amazon Polly', 'SageMaker Serverless Inference'], 0, 'Model Cards document models for governance.'),
        q('Which describes deep learning?', ['Hand-written if/else rules', 'ML using neural networks with many layers', 'Any use of a spreadsheet', 'Only reinforcement learning'], 1, 'Deep learning is multi-layer neural networks.'),
        q('A retailer wants product recommendations on its website without building ML infrastructure. Which service fits?', ['Amazon Personalize', 'Amazon Textract', 'Amazon Polly', 'AWS Glue'], 0, 'Personalize provides managed recommendations.'),
      ],
    }),
  ],
};
