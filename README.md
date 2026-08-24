# Poker Tracker v2

A full-stack web application for tracking poker games, player statistics, and financial settlements. Built with a React/TypeScript frontend and a Node.js/Express backend (Postgres).

## 🚀 Features

- **Player Management**: Add, edit, and track poker players with detailed statistics
- **Game Tracking**: Record poker game sessions with buy-ins, cash-outs, and profit calculations
- **Settlement System**: Track financial settlements between players
- **Dashboard Analytics**: Overview statistics and recent activity
- **Responsive Design**: Mobile-first design with Tailwind CSS
- **Authentication**: Secure JWT-based authentication system
- **Real-time Updates**: Automatic data refresh after operations

## 🏗️ Architecture

### Frontend (React + TypeScript)
- **Framework**: React 18.2.0 with TypeScript 4.7.4
- **Styling**: Tailwind CSS 3.3.2 with custom components
- **Icons**: Lucide React for consistent iconography
- **Build Tool**: Create React App (react-scripts 5.0.1)
- **State Management**: React hooks (useState, useEffect)
- **HTTP Client**: Custom API service layer

### Backend (Node.js + Express)

One server, on Postgres, running the same code locally and in production.

```
server/
  app.js               entry point: middleware, health, router mounting
  db.js                connection pool and queryDatabase()
  middleware/auth.js   the JWT gate (see Security below)
  routes/              one router per resource
    auth.js  players.js  games.js  settlements.js
    discrepancy.js  bulkGame.js  export.js
  utils/               text parsing and fuzzy name matching
  notifications/       game-result emails
```

`vercel.json` maps every `/api/*` request to `server/app.js`. Locally that same
file serves directly (`npm run dev` in `server/`), reading `server/.env`.

- **Runtime**: Node.js with Express 4.18.2
- **Database**: Postgres via `DATABASE_URL`
- **Authentication**: JWT tokens with bcryptjs password hashing
- **Port**: 5001 (configurable via environment)

### Database Schema
- **users**: User authentication and management
- **players**: Poker players (global, shared across users)
- **games**: Poker game sessions (global, shared across users)
- **game_players**: Many-to-many relationship between games and players
- **settlements**: Financial settlements between players

## 🛠️ Development Setup

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- PostgreSQL (local instance, or a hosted database URL)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd poker_tracker_v2
   ```

2. **Install all dependencies**
   ```bash
   npm run install-all
   ```

3. **Set up environment variables**
   ```bash
   # Copy the example environment file
   cp server/env.example server/.env
   
   # Edit the .env file with your configuration
   nano server/.env
   ```

4. **Start the development servers**
   ```bash
   npm run dev
   ```

5. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5001

### Environment Variables

Create a `.env` file in the `server` directory (see `server/env.example`):

```env
PORT=5001
NODE_ENV=development

# Required. The server exits on startup if this is missing, so that it can never
# fall back to a default secret and serve an unauthenticated API.
JWT_SECRET=<openssl rand -hex 32>

# Required. Postgres connection string; point it at a local database for
# development, or at the production database to work against real data.
DATABASE_URL=postgresql://user@localhost:5432/poker
```

On Vercel these live in **Project → Settings → Environment Variables**. Changing
`JWT_SECRET` invalidates every issued token, so everyone signs in again.

## 🐳 Production Deployment

### Docker Deployment

1. **Build and run with Docker Compose**
   ```bash
   docker-compose up -d
   ```

2. **Access the application**
   - Application: http://localhost:5001

### Manual Deployment

1. **Build the frontend**
   ```bash
   cd client
   npm run build
   ```

2. **Start the backend**
   ```bash
   cd server
   npm start
   ```

### Vercel Deployment (Frontend)

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Deploy**
   ```bash
   cd client
   vercel
   ```

## 📊 API Endpoints

All endpoints below require an `Authorization: Bearer <token>` header, except
`/api/health`, `/api/auth/login`, and `/api/auth/verify`. Requests without a
valid token get `401`.

### Authentication
- `POST /api/auth/login` - Login user
- `GET /api/auth/verify` - Verify JWT token

Registration is closed: `POST /api/auth/register` was removed so that the auth
requirement cannot be sidestepped by signing up. New accounts are provisioned
directly in the database.

### Players
- `GET /api/players` - Get all players
- `GET /api/players/:id` - Get single player
- `POST /api/players` - Create new player
- `PUT /api/players/:id` - Update player
- `DELETE /api/players/:id` - Delete player
- `GET /api/players/:id/stats` - Get player statistics

### Games
- `GET /api/games` - Get all games
- `GET /api/games/:id` - Get single game with players
- `POST /api/games` - Create new game
- `PUT /api/games/:id` - Update game
- `DELETE /api/games/:id` - Delete game
- `GET /api/games/stats/overview` - Get game statistics

### Settlements
- `GET /api/settlements` - Get all settlements
- `GET /api/settlements/:id` - Get single settlement
- `POST /api/settlements` - Create new settlement
- `PUT /api/settlements/:id` - Update settlement
- `DELETE /api/settlements/:id` - Delete settlement
- `GET /api/settlements/stats/overview` - Get settlement statistics
- `GET /api/settlements/player/:playerId/debts` - Get player debt information

### Export
- `GET /api/export/games` - CSV, one row per player per game
- `GET /api/export/players` - CSV of player totals
- `GET /api/export/settlements` - CSV of settlements

### Health Check
- `GET /api/health` - Health check endpoint

## 🔒 Security Features

- **JWT Authentication**: enforced by a single fail-closed gate in
  `server/middleware/auth.js`, applied before any router. Routes are protected
  by default; exposing one publicly means adding it to `PUBLIC_PATHS`
  deliberately.
- **No fallback secret**: the server refuses to start without `JWT_SECRET`
- **Closed registration**: no self-service account creation
- **Password Hashing**: bcryptjs
- **SQL Injection Protection**: parameterized queries

Not currently applied: Helmet, CORS, express-validator, and rate limiting.
These existed only on the retired SQLite dev server and were deliberately not
carried over in the consolidation, since rate limiting in particular needs
tuning against real client traffic before it goes live.

## 📱 Responsive Design

- **Mobile-first approach** with Tailwind CSS
- **Responsive navigation** with collapsible tabs
- **Touch-friendly interface** for mobile devices
- **Consistent spacing and typography**
- **Custom scrollbars and smooth animations**

## 🧪 Testing

```bash
# Run frontend tests
cd client
npm test

# Run backend tests (if implemented)
cd server
npm test
```

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

If you have any questions or need help, please open an issue in the repository.

## 🎯 Roadmap

- [x] Player performance charts and analytics (recharts; `PlayerPerformanceModal`)
- [x] Consolidate the two server implementations onto one codebase
- [x] Game history export functionality (CSV, per resource)
- [ ] Multi-user support with user-specific data
- [ ] Real-time notifications
- [ ] Mobile app (React Native)
- [ ] Advanced reporting and insights
- [ ] Integration with poker tracking software
- [ ] Tournament support
