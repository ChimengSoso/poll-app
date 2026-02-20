# Quick Start Guide

## Running the Application

### Terminal 1 - Backend (Scala + Pekko)

```bash
cd backend
sbt run
```

Wait for the message: `Server online at http://0.0.0.0:8080/`

### Terminal 2 - Frontend (React)

```bash
cd frontend
npm run dev
```

Open browser at: `http://localhost:3000`

## Usage

1. **Create Poll**: Fill in poll title and add restaurants
2. **View Polls**: Browse all polls in AG-Grid table
3. **Vote**: Click "View/Vote" and select your favorite restaurant
4. **Results**: Check Results tab to see statistics

## API Test (Optional)

Test backend directly:

```bash
# Create a poll
curl -X POST http://localhost:8080/api/polls \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Lunch Today?",
    "restaurants": [
      {"name": "Pizza Place", "description": "Best pizza in town"},
      {"name": "Sushi Bar", "description": "Fresh sushi"}
    ]
  }'

# Get all polls
curl http://localhost:8080/api/polls
```

## Tech Stack

- **Backend**: Scala 3 + Pekko Actor Typed + Pekko HTTP (Port 8080)
- **Frontend**: React + TypeScript + AG-Grid + Ant Design (Port 3000)
