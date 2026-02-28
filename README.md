# TaskMe - AI-Powered Task Management

A task management web application that uses LLM (OpenAI/Claude) to parse free-form natural language into structured, manageable tasks.

## Features

- **Natural Language Parsing** - Type tasks in plain English, AI extracts structured data
- **Dual LLM Support** - Choose between OpenAI GPT and Anthropic Claude
- **Modern Dashboard** - Table view and Kanban board
- **Full CRUD** - Create, edit, delete tasks with a clean modal interface
- **Excel Export** - Download tasks as formatted .xlsx spreadsheets
- **Email Notifications** - Send task reminders to owners via email
- **Shareable Links** - Create public read-only links for task lists
- **Filtering & Sorting** - Search, filter by status/priority/owner, sort columns

## Tech Stack

- **Backend:** Python, FastAPI, SQLModel, SQLite
- **Frontend:** React 19, Vite, Tailwind CSS, TanStack Table
- **AI:** OpenAI API / Anthropic API

## Quick Start

### 1. Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
cp .env.example .env         # Edit with your API keys
uvicorn app.main:app --reload
```

Backend runs at http://localhost:8000 (Swagger docs at /docs)

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at http://localhost:5173

### 3. Configure Environment

Edit `backend/.env` with your API keys:

```
OPENAI_API_KEY=sk-your-key-here
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

For email notifications, configure SMTP settings in the same file.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/tasks | List all tasks |
| POST | /api/v1/tasks | Create a task |
| POST | /api/v1/tasks/bulk | Create multiple tasks |
| PATCH | /api/v1/tasks/{id} | Update a task |
| DELETE | /api/v1/tasks/{id} | Delete a task |
| POST | /api/v1/parse | Parse natural language into tasks |
| GET | /api/v1/export/excel | Export tasks to Excel |
| POST | /api/v1/email/notify | Send email notifications |
| POST | /api/v1/share | Create share link |
| GET | /api/v1/share/{token} | View shared tasks |
