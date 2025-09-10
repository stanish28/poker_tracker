# Poker Tracker v2

A full-stack web application for tracking poker games, player statistics, and financial settlements. Built with React/TypeScript frontend and Node.js/Express backend with SQLite database.

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
- **Runtime**: Node.js with Express 4.18.2
- **Database**: SQLite3 5.1.6 with custom database layer
- **Authentication**: JWT tokens with bcryptjs password hashing
- **Security**: Helmet, CORS, rate limiting, input validation
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
- SQLite3

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

Create a `.env` file in the `server` directory:

```env
PORT=5001
JWT_SECRET=your_jwt_secret_key_here
NODE_ENV=development
```

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

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/verify` - Verify JWT token

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

### Health Check
- `GET /api/health` - Health check endpoint

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcryptjs for password security
- **Input Validation**: express-validator for request validation
- **SQL Injection Protection**: Parameterized queries
- **CORS Configuration**: Cross-origin resource sharing
- **Rate Limiting**: Request throttling to prevent abuse
- **Security Headers**: Helmet for security headers

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

- [ ] Player performance charts and analytics
- [ ] Game history export functionality
- [ ] Multi-user support with user-specific data
- [ ] Real-time notifications
- [ ] Mobile app (React Native)
- [ ] Advanced reporting and insights
- [ ] Integration with poker tracking software
- [ ] Tournament support
