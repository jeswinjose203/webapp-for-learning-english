# English Learning AI

An AI-powered web application for learning English with personalized lessons, grammar correction, vocabulary building, and conversation practice.

## Features

- **Personalized Lessons** — Daily lessons generated based on your weaknesses and level
- **Grammar Engine** — Rule-based grammar error detection with corrections and explanations
- **Vocabulary Builder** — Spaced repetition system for learning new words
- **Conversation Practice** — Chat with AI and get instant feedback
- **Progress Tracking** — Detailed stats across all skill areas

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Vite
- **Backend**: Python, FastAPI, SQLAlchemy
- **Database**: PostgreSQL
- **AI**: Rule-based (MVP) → ML models (future phases)

## Quick Start

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create PostgreSQL database
createdb english_learning

# Start the server
uvicorn main:app --reload --port 8000
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Open http://localhost:5173 in your browser.

## Project Structure

```
english-ai/
├── frontend/           # React + TypeScript + Tailwind
│   └── src/
│       ├── pages/      # Home, Learn, Chat, Progress, Settings
│       ├── components/ # Navbar, ChatBubble, ProgressBar, LessonCard
│       ├── hooks/      # useApi
│       └── services/   # API client
│
├── backend/            # FastAPI + SQLAlchemy
│   ├── api/            # REST endpoints
│   ├── ai/             # AI modules
│   │   ├── brain/      # Coordinator
│   │   ├── grammar/    # Grammar engine
│   │   ├── vocabulary/ # Spaced repetition
│   │   ├── conversation/ # Dialogue management
│   │   ├── memory/     # Mistake tracking
│   │   ├── lesson/     # Lesson generator
│   │   ├── recommendation/ # Focus calculator
│   │   ├── scoring/    # Progress calculator
│   │   └── pronunciation/ # Pronunciation tips
│   ├── database/       # Models and connection
│   └── utils/          # Helpers
│
├── datasets/           # Training data (future)
├── training/           # Model training (future)
└── tests/              # Test suite (future)
```

## AI Modules

### Grammar Engine
Detects and corrects:
- Subject-verb agreement
- Article usage
- Verb tense errors
- Preposition mistakes
- Common ESL errors

### Vocabulary Engine
- CEFR-level word banks (A1-C1)
- Simplified SM-2 spaced repetition
- Mastery tracking (3 correct = mastered)

### Conversation Engine
- Topic-based dialogue templates
- Inline corrections with explanations
- Follow-up question generation

### Memory Engine
- Tracks every mistake over time
- Identifies patterns and weaknesses
- Auto-removes resolved issues

### Lesson Generator
- Creates personalized daily lessons
- Adjusts content based on weaknesses
- Mixes grammar, vocabulary, and speaking

## Roadmap

- [x] **MVP** — Rule-based grammar correction, personalized lessons, chat interface
- [ ] **AI v1** — Intent detection, adaptive vocabulary, conversation state management
- [ ] **AI v2** — Train custom ML models, speaking evaluation, smarter dialogue
- [ ] **AI v3** — Fine-tune language model for English education

## License

MIT
