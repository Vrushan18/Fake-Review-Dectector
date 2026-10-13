# ==============================================================================
# FINE-TUNED RoBERTa-BASE FOR FAKE REVIEW DETECTION (PyTorch & HuggingFace)
# Author: Vrushan Patil
# Target Model: roberta-base (Contextual Transformer Encoder)
# Hardware: Google Colab GPU (T4 / V100 / A100)
# ==============================================================================

# --- STEP 1: INSTALL NECESSARY LIBRARIES ---
# Run this in Colab:
# !pip install -q transformers datasets accelerate evaluate torch scikit-learn seaborn matplotlib openpyxl

import os
import re
import torch
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, classification_report, confusion_matrix
from transformers import (
    AutoTokenizer, 
    AutoModelForSequenceClassification, 
    Trainer, 
    TrainingArguments,
    DataCollatorWithPadding
)
from datasets import Dataset

# Check GPU availability
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"✓ Using Device: {device.upper()}")
if device == "cuda":
    print(f"✓ GPU Model: {torch.cuda.get_device_name(0)}")
else:
    print("⚠️ WARNING: Running on CPU. In Colab, go to Runtime -> Change runtime type -> Select T4 GPU for 20x faster training!")

# --- STEP 2: UPLOAD DATASET (CSV or Excel) ---
from google.colab import files
print("\nPlease upload your dataset ('fake_reviews_dataset.csv' or 'Fake_Reviews_Dataset.xlsx'):")
uploaded = files.upload()
filename = list(uploaded.keys())[0]

if filename.endswith('.xlsx'):
    df = pd.read_excel(filename)
    if 'Review Text' in df.columns:
        df['text_'] = df['Review Text']
        df['label'] = df['Original Label']
else:
    df = pd.read_csv(filename)

print(f"✓ Total raw reviews loaded: {len(df):,}")

# --- STEP 3: PREPARE LABELS & SAMPLES ---
text_col = 'text_' if 'text_' in df.columns else 'Review Text'
label_col = 'label' if 'label' in df.columns else 'Original Label'

df = df.dropna(subset=[text_col, label_col])
# Map CG (Computer Generated / Fake) -> 1, OR (Original / Real) -> 0
df['target'] = df[label_col].map({'CG': 1, 'OR': 0})

def clean_for_roberta(text):
    text = str(text).strip()
    text = re.sub(r'http\S+|www\S+', '', text) # remove URLs
    text = re.sub(r'\s+', ' ', text) # normalize whitespace
    return text

df['clean_text'] = df[text_col].apply(clean_for_roberta)

# For fast, high-accuracy training on Colab T4 GPU: Sample 10,000 balanced reviews (or use all)
df_sample = df.groupby('target', group_keys=False).apply(lambda x: x.sample(min(len(x), 5000), random_state=42)).reset_index(drop=True)
print(f"✓ Using {len(df_sample):,} reviews for fine-tuning RoBERTa ({len(df_sample)//2} Real vs {len(df_sample)//2} Fake)")

# Split into 80% Train, 10% Validation, 10% Test
train_df, test_df = train_test_split(df_sample, test_size=0.20, random_state=42, stratify=df_sample['target'])
val_df, test_df = train_test_split(test_df, test_size=0.50, random_state=42, stratify=test_df['target'])

print(f"Train samples: {len(train_df):,} | Val samples: {len(val_df):,} | Test samples: {len(test_df):,}")

# --- STEP 4: TOKENIZE WITH ROBERTA BYTE-PAIR ENCODING (BPE) ---
MODEL_NAME = "roberta-base"
print(f"\nLoading {MODEL_NAME} tokenizer & pre-trained weights...")
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

def tokenize_function(examples):
    return tokenizer(examples['clean_text'], truncation=True, max_length=128)

train_dataset = Dataset.from_pandas(train_df[['clean_text', 'target']].rename(columns={'target': 'label'}))
val_dataset = Dataset.from_pandas(val_df[['clean_text', 'target']].rename(columns={'target': 'label'}))
test_dataset = Dataset.from_pandas(test_df[['clean_text', 'target']].rename(columns={'target': 'label'}))

tokenized_train = train_dataset.map(tokenize_function, batched=True)
tokenized_val = val_dataset.map(tokenize_function, batched=True)
tokenized_test = test_dataset.map(tokenize_function, batched=True)

data_collator = DataCollatorWithPadding(tokenizer=tokenizer)

# --- STEP 5: LOAD ROBERTA FOR SEQUENCE CLASSIFICATION ---
model = AutoModelForSequenceClassification.from_pretrained(
    MODEL_NAME, 
    num_labels=2,
    id2label={0: "REAL", 1: "FAKE"},
    label2id={"REAL": 0, "FAKE": 1}
)

def compute_metrics(eval_pred):
    logits, labels = eval_pred
    preds = np.argmax(logits, axis=1)
    acc = accuracy_score(labels, preds)
    precision, recall, f1, _ = precision_recall_fscore_support(labels, preds, average='binary')
    return {
        'accuracy': acc,
        'precision': precision,
        'recall': recall,
        'f1': f1
    }

# --- STEP 6: FINE-TUNING HYPERPARAMETERS ---
training_args = TrainingArguments(
    output_dir="./roberta_fake_review_model",
    learning_rate=2e-5,
    per_device_train_batch_size=16,
    per_device_eval_batch_size=32,
    num_train_epochs=3,
    weight_decay=0.01,
    evaluation_strategy="epoch",
    save_strategy="epoch",
    load_best_model_at_end=True,
    metric_for_best_model="f1",
    fp16=torch.cuda.is_available(), # Mixed precision for 2x faster GPU training
    logging_steps=50,
    report_to="none"
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=tokenized_train,
    eval_dataset=tokenized_val,
    tokenizer=tokenizer,
    data_collator=data_collator,
    compute_metrics=compute_metrics,
)

print("\n🚀 Starting RoBERTa Fine-Tuning...")
trainer.train()

# --- STEP 7: EVALUATION ON UNSEEN TEST SET ---
print("\n" + "=" * 65)
print("          EVALUATING FINE-TUNED ROBERTA ON TEST SET")
print("=" * 65)
test_predictions = trainer.predict(tokenized_test)
preds = np.argmax(test_predictions.predictions, axis=1)
labels = test_predictions.label_ids

acc = accuracy_score(labels, preds)
print(f"\nFinal Test Accuracy: {acc * 100:.2f}%")
print("\nClassification Report:")
print(classification_report(labels, preds, target_names=["Real Review (OR)", "Fake Review (CG)"]))

# Plot Confusion Matrix
cm = confusion_matrix(labels, preds)
plt.figure(figsize=(6, 5))
sns.heatmap(cm, annot=True, fmt='d', cmap='Purples', 
            xticklabels=['Pred Real', 'Pred Fake'], 
            yticklabels=['Actual Real', 'Actual Fake'])
plt.title(f'Fine-Tuned RoBERTa Confusion Matrix (Accuracy: {acc*100:.1f}%)')
plt.ylabel('Actual Label')
plt.xlabel('Predicted Label')
plt.show()

# --- STEP 8: LIVE INTERACTIVE REVIEW VERIFIER ---
def predict_review_roberta(review_text):
    inputs = tokenizer(review_text, return_tensors="pt", truncation=True, max_length=128).to(model.device)
    model.eval()
    with torch.no_grad():
        outputs = model(**inputs)
        probs = torch.nn.functional.softmax(outputs.logits, dim=-1)[0].cpu().numpy()
        pred = np.argmax(probs)
    
    print("\n" + "=" * 70)
    print(f"Review: \"{review_text}\"")
    print("-" * 70)
    if pred == 1:
        print(f"🚨 VERDICT: FAKE / COMPUTER-GENERATED REVIEW (CG)")
        print(f"Probability: {probs[1] * 100:.2f}% Fake  |  {probs[0] * 100:.2f}% Real")
    else:
        print(f"✅ VERDICT: REAL / GENUINE HUMAN REVIEW (OR)")
        print(f"Probability: {probs[0] * 100:.2f}% Real  |  {probs[1] * 100:.2f}% Fake")
    print("=" * 70)

# Test Examples
predict_review_roberta("Love this! Well made, sturdy, and very comfortable. I love it! Very pretty")
predict_review_roberta("Very small but works if you don't have a lot of space. Cord is a bit short though.")

# Interactive user loop
while True:
    user_input = input("\nEnter a review to verify with RoBERTa (or type 'exit' to quit): ")
    if user_input.strip().lower() in ['exit', 'quit', 'q']:
        print("Done!")
        break
    if user_input.strip():
        predict_review_roberta(user_input)
