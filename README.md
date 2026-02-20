# Restaurant Poll App

A full-stack web application for creating and managing restaurant polls with real-time voting.

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **AG-Grid** for data tables
- **Ant Design** for UI components
- **Vite** for build tooling
- **Axios** for API calls

### Backend
- **Scala 3.3.1**
- **Pekko Actor Typed** for concurrency
- **Pekko HTTP** for REST API
- **SBT** for build management

## Project Structure

```
poll-app/
├── backend/                    # Scala backend
│   ├── src/main/scala/
│   │   ├── Main.scala         # HTTP server entry point
│   │   ├── actors/            # Pekko actors
│   │   │   ├── PollManager.scala
│   │   │   └── PollActor.scala
│   │   ├── routes/            # HTTP routes
│   │   │   └── PollRoutes.scala
│   │   ├── models/            # Domain models
│   │   │   └── Poll.scala
│   │   └── json/              # JSON serialization
│   │       └── JsonFormats.scala
│   ├── build.sbt
│   └── project/
│
└── frontend/                   # React frontend
    ├── src/
    │   ├── components/        # React components
    │   │   ├── CreatePoll.tsx
    │   │   ├── PollList.tsx
    │   │   ├── VotePanel.tsx
    │   │   └── Results.tsx
    │   ├── services/          # API layer
    │   │   └── api.ts
    │   ├── types/             # TypeScript types
    │   │   └── index.ts
    │   ├── App.tsx
    │   └── index.tsx
    ├── package.json
    └── vite.config.ts
```

## Features

- ✅ Create polls with multiple restaurant options
- ✅ View all polls in an AG-Grid table
- ✅ Vote for restaurants in real-time
- ✅ View live results with percentages and progress bars
- ✅ Delete polls
- ✅ Responsive UI with Ant Design
- ✅ RESTful API with Pekko HTTP
- ✅ Actor-based state management with Pekko Typed

## Getting Started

### Prerequisites

- **Java 17+** (for Scala backend)
- **SBT 1.9+**
- **Node.js 18+** and npm
- **Scala 3.3.1**

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Run the backend server:
   ```bash
   sbt run
   ```

   The server will start on `http://localhost:8080`

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

   The frontend will start on `http://localhost:3000`

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/polls` | Get all polls |
| POST | `/api/polls` | Create a new poll |
| GET | `/api/polls/:id` | Get a specific poll |
| DELETE | `/api/polls/:id` | Delete a poll |
| POST | `/api/polls/:id/vote` | Vote for a restaurant |
| GET | `/api/polls/:id/results` | Get poll results |

## Usage

1. **Create a Poll**: Enter a poll title and add restaurants with optional descriptions
2. **View Polls**: Browse all polls in the AG-Grid table
3. **Vote**: Click "View/Vote" on a poll and vote for your favorite restaurant
4. **View Results**: Check the Results tab to see voting statistics and the winner

## Architecture

### Backend Architecture
- **PollManager Actor**: Manages all polls and coordinates between poll actors
- **PollActor**: Each poll has its own actor managing its state
- **Pekko HTTP Routes**: RESTful API endpoints with CORS support
- **Spray JSON**: Automatic JSON serialization/deserialization

### Frontend Architecture
- **Component-based**: Modular React components with TypeScript
- **AG-Grid**: High-performance data tables for displaying polls and restaurants
- **Ant Design**: Beautiful UI components and forms
- **Axios**: Promise-based HTTP client with proxy configuration

## Development

### Build Backend
```bash
cd backend
sbt compile
```

### Build Frontend
```bash
cd frontend
npm run build
```

## License

MIT License
