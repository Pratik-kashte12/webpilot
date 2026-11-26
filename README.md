# WebPilot

WebPilot is a full-stack AI-powered browser automation dashboard.  
Users can enter a natural-language command, and the app extracts a Wikipedia topic, opens the page in a real browser, extracts its summary, and displays the result in real time.

## Features

- Create automation tasks from a React dashboard
- Store tasks and results in MongoDB
- Run browser automation with Python and Playwright
- Open Wikipedia pages and extract page title, URL, and summary
- View live task status and browser logs using Socket.IO
- See completed results without refreshing the dashboard
- Use an offline topic parser when AI is unavailable
- Use OpenAI to convert natural-language commands into exact Wikipedia topics when API credits are available

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, Tailwind CSS |
| Backend | Node.js, Express.js |
| Real-time updates | Socket.IO |
| Database | MongoDB Atlas, Mongoose |
| Browser automation | Python, Playwright |
| AI command parsing | OpenAI API, with offline fallback |

## Project Structure

```text
webpilot/
├── automation/
│   └── agent.py
├── client/
│   ├── src/
│   │   └── App.jsx
│   └── package.json
├── server/
│   ├── models/
│   │   └── Task.js
│   ├── ai.js
│   ├── topicParser.js
│   ├── server.js
│   └── package.json
└── .venv/
```

## How It Works

1. User enters a command such as `Tell me about India`.
2. The backend extracts a clean Wikipedia topic.
3. The backend starts the Python Playwright agent.
4. The agent opens the Wikipedia page in Chromium.
5. It extracts the page title, URL, and summary.
6. The result is saved in MongoDB.
7. Socket.IO sends live task updates and logs to the dashboard.
8. The dashboard displays the final result.

## Local Setup

### 1. Clone the repository

```bash
git clone [https://github.com/Pratik-kashte12/webpilot.git](https://github.com/Pratik-kashte12/webpilot.git)
cd webpilot
```

### 2. Install backend dependencies

```bash
cd server
npm install
```

### 3. Install frontend dependencies

```bash
cd ../client
npm install
```

### 4. Create Python virtual environment

From the project root:

```bash
python -m venv .venv
```

Activate it on Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
```

Install Playwright:

```bash
pip install playwright
playwright install chromium
```

### 5. Create environment variables

Create a file named `.env` inside the `server` folder:

```env
MONGO_URI=your_mongodb_connection_string
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini
```

Never commit `.env` or share API keys publicly.

### 6. Start the backend

```bash
cd server
npm run dev
```

The backend runs at:

```text
http://localhost:5000
```

### 7. Start the frontend

Open another terminal:

```bash
cd client
npm run dev
```

The dashboard runs at:

```text
http://localhost:5173
```

## Example Commands

```text
Tell me about India
Search Python programming
Open Wikipedia page for Taj Mahal
What is JavaScript?
```

## Current Status

- Core browser automation flow is working.
- Tasks, results, errors, and live logs are saved in MongoDB.
- Socket.IO updates work across multiple dashboard tabs.
- Offline command parsing works without AI credits.
- OpenAI-powered natural-language command parsing is available when API credits are added.

## Future Improvements

- Multi-step browser automation
- AI planning for complex tasks
- User authentication
- Task history and filters
- Detailed browser screenshots
- Deployment to cloud platforms