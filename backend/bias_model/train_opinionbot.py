"""
train_opinionbot.py

Lightweight training scaffold for '오피니언봇' (KoELECTRA fine-tuning).
This script is a minimal scaffold to fine-tune a Korean ELECTRA (KoELECTRA) model
on collected editorials. It expects a JSONL or CSV dataset of documents and
supports incremental training when new editorials are added.

Notes:
- This script requires a GPU environment and installed packages: transformers, datasets, torch.
- This is a scaffold: tune hyperparameters and data preprocessing for production.
"""

import os
import json
from pathlib import Path

try:
    from transformers import AutoTokenizer, AutoModelForSequenceClassification, Trainer, TrainingArguments
    from datasets import Dataset
    import torch
except Exception:
    print("Please install transformers, datasets, torch to run training.")

MODEL_NAME = "monologg/koelectra-base-v3-discriminator"  # example
DATA_DIR = Path(__file__).resolve().parent.parent / 'data' / 'editorials'
MODEL_OUT = Path(__file__).resolve().parent.parent / 'models' / 'opinionbot'

os.makedirs(MODEL_OUT, exist_ok=True)

def gather_corpus(date=None):
    files = []
    if date:
        p = DATA_DIR / f"{date}.json"
        if p.exists(): files.append(p)
    else:
        for f in DATA_DIR.glob('*.json'):
            files.append(f)
    texts = []
    for f in files:
        with open(f, 'r', encoding='utf-8') as fh:
            data = json.load(fh)
            for press, arr in data.items():
                for ed in arr:
                    txt = ed.get('full_text') or ed.get('description') or ed.get('title')
                    if txt and len(txt) > 50:
                        texts.append({ 'text': txt })
    return texts


def prepare_dataset(texts):
    # For pretraining-like approach, we could use a next-sentence / MLM objective.
    # Here we provide a simple classification fine-tune scaffold (placeholder).
    ds = Dataset.from_list([{'text': t['text'], 'label': 0} for t in texts])
    return ds


def train(date=None):
    texts = gather_corpus(date)
    if not texts:
        print('No texts found for training.')
        return
    ds = prepare_dataset(texts)
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    def tok(x):
        return tokenizer(x['text'], truncation=True, padding='max_length', max_length=512)
    ds = ds.map(tok, batched=True)
    ds = ds.rename_column('label', 'labels')
    ds.set_format(type='torch', columns=['input_ids','attention_mask','labels'])

    model = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME, num_labels=2)

    training_args = TrainingArguments(
        output_dir=str(MODEL_OUT),
        num_train_epochs=1,
        per_device_train_batch_size=4,
        save_steps=500,
        save_total_limit=2,
        logging_steps=100,
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=ds,
    )

    trainer.train()
    trainer.save_model(str(MODEL_OUT))
    print('Model saved to', MODEL_OUT)


if __name__ == '__main__':
    import sys
    date = sys.argv[1] if len(sys.argv) > 1 else None
    train(date)
