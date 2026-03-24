# Multiplayer Tic-Tac-Toe with Nakama

A production-ready, real-time multiplayer Tic-Tac-Toe game with **server-authoritative architecture** using [Nakama](https://heroiclabs.com/nakama/) as the game server backend.

## Features

- **Server-Authoritative Game Logic** — All moves validated server-side; clients are display-only
- **Real-time Multiplayer** — WebSocket-based communication for instant game state updates
- **Multiple Matchmaking Options** — Auto-matchmaker, create private rooms, or join by match ID
- **Timer Mode** — 30-second turn limit with visual countdown and auto-forfeit
- **Concurrent Games** — Multiple isolated game sessions running simultaneously
- **Disconnect Handling** — Opponent wins by forfeit if a player leaves mid-game
- **Responsive UI** — Mobile-optimized React frontend with dark theme

## Architecture

```
┌─────────────┐     WebSocket/HTTP     ┌──────────────────┐
│  React App  │ <---------------------> │  Nakama Server   │
│  (Vite+TS)  │    Port 7350           │  (Lua Modules)   │
└─────────────┘                         │                  │
                                        │  - Match Handler │
                                        │  - Matchmaking   │
                                        │  - Timer Logic   │
                                        └────────┬─────────┘
                                                 │
                                        ┌────────▼─────────┐
                                        │  CockroachDB     │
                                        │  (Persistence)   │
                                        └──────────────────┘
```

### Server-Authoritative Design

The server (Nakama Lua modules) owns all game state. The flow for each move:

1. Client sends a move request (cell position 0–8) via WebSocket
2. Server validates: correct player's turn, cell is empty, game is not over
3. Server applies the move, checks for win/draw conditions
4. Server broadcasts the updated game state to all players
5. Clients render the received state — they cannot modify game state directly

This prevents cheating and ensures game integrity.

## Tech Stack

| Layer     | Technology                            |
|-----------|---------------------------------------|
| Frontend  | React 19, TypeScript, Vite, Tailwind CSS 4 |
| Backend   | Nakama 3.21.1 (Lua runtime modules)  |
| Database  | CockroachDB (bundled with Nakama)     |
| Transport | WebSocket (real-time), HTTP (RPCs)    |
| DevOps    | Docker, Docker Compose                |

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)
- [Node.js](https://nodejs.org/) >= 18

## Setup and Installation

### 1. Clone the repository

```bash
git clone https://github.com/sj1705/multiplayer-tictactoe.git
cd multiplayer-tictactoe
```

### 2. Start Nakama server (backend)

```bash
docker compose up --build
```

This starts:
- **Nakama** on `http://localhost:7350` (game API) and `http://localhost:7351` (admin console)
- **CockroachDB** on `localhost:26257` (database)

### 3. Install and start the frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`.

### 4. Access Nakama Admin Console (optional)

Open `http://localhost:7351` — credentials: `admin` / `password`

## How to Test Multiplayer Functionality

### Quick Test (Create Room)
1. Open `http://localhost:5173` in **Browser Tab 1**
2. Enter a nickname (e.g., "Alice") and click Continue
3. Click **Create Room** — a Match ID appears
4. Copy the Match ID
5. Open `http://localhost:5173` in **Browser Tab 2**
6. Enter a different nickname (e.g., "Bob") and click Continue
7. Paste the Match ID and click **Join**
8. Both tabs now show the game board — play!

### Auto-Matchmaking Test
1. Open two browser tabs, log in with different nicknames
2. In **both tabs**, click **Find Match**
3. The matchmaker pairs them automatically and the game starts

### Timer Mode Test
1. Before matchmaking, select **Timed (30s)** mode in both tabs
2. Start a match — a 30-second countdown timer appears
3. If a player doesn't move in 30 seconds, the opponent wins by timeout

### Concurrent Games Test
1. Open **4 browser tabs** (2 pairs of players)
2. Create two separate rooms (or use matchmaker twice)
3. Play both games simultaneously — they are fully independent

### Disconnect Test
1. Start a game between two tabs
2. Close one tab mid-game
3. The remaining player wins by forfeit

## Game Modes

### Classic
- Standard tic-tac-toe with no time pressure
- Players take turns until someone wins or the board is full

### Timed (30s)
- Each player has 30 seconds per turn
- Visual circular countdown timer with color changes (green → orange → red)
- Auto-forfeit if the timer expires

## Server API / Configuration

### Nakama Configuration

The server uses `nakama/local.yml` for runtime configuration. The Lua game modules are:

| File | Purpose |
|------|---------|
| `nakama/modules/tictactoe.lua` | RPCs, matchmaker callback, module init |
| `nakama/modules/tictactoe_match.lua` | Authoritative match handler (game logic) |

### RPCs

| RPC ID | Payload | Response | Description |
|--------|---------|----------|-------------|
| `create_match` | `{ "timed_mode": true/false }` | `{ "match_id": "..." }` | Create a private match room |

### Match OpCodes (WebSocket)

| Code | Name | Direction | Payload |
|------|------|-----------|---------|
| 1 | MOVE | Client → Server | `{ "position": 0-8 }` |
| 2 | STATE | Server → Client | Full game state (board, players, turn) |
| 3 | GAME_OVER | Server → Client | Winner ID, reason (win/draw/timeout/forfeit) |
| 4 | TIMER_UPDATE | Server → Client | Deadline timestamp (ms) |
| 5 | ERROR | Server → Client | Error message string |

### Frontend Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_NAKAMA_HOST` | `window.location.hostname` | Nakama server host |
| `VITE_NAKAMA_PORT` | `7350` | Nakama server port |
| `VITE_NAKAMA_USE_SSL` | `false` | Use WSS/HTTPS |
| `VITE_NAKAMA_KEY` | `defaultkey` | Nakama server key |

## Deployment

### Backend — Nakama on AWS EC2

1. Launch a **t2.micro** instance (free tier) with Ubuntu 22.04
2. Install Docker:
   ```bash
   sudo apt update && sudo apt install -y docker.io docker-compose
   sudo usermod -aG docker $USER
   # Log out and back in
   ```
3. Copy project files to EC2:
   ```bash
   scp -r nakama/ docker-compose.yml Dockerfile.nakama user@<EC2-IP>:~/tictactoe/
   ```
4. Start the server:
   ```bash
   cd ~/tictactoe && docker compose up -d --build
   ```
5. Configure **Security Group** — allow inbound TCP on ports:
   - **7350** (Nakama API — required)
   - **7351** (Admin console — optional)
6. (Optional) Attach an **Elastic IP** for a stable address

### Frontend — GitHub Pages (or any static host)

1. Create `.env.production` in the `frontend/` folder:
   ```
   VITE_NAKAMA_HOST=<your-ec2-ip-or-domain>
   VITE_NAKAMA_PORT=7350
   VITE_NAKAMA_USE_SSL=false
   ```
2. Build:
   ```bash
   cd frontend && npm run build
   ```
3. Deploy the `dist/` folder to GitHub Pages, Netlify, Vercel, or any static host

## Project Structure

```
├── frontend/                     # React app (Vite + TypeScript + Tailwind)
│   ├── src/
│   │   ├── components/
│   │   │   ├── App.tsx           # Main app — screen routing, socket listener
│   │   │   ├── Login.tsx         # Nickname entry + authentication
│   │   │   ├── Matchmaking.tsx   # Find match / create room / join room
│   │   │   ├── GameBoard.tsx     # 3x3 game board (display-only)
│   │   │   ├── GameResult.tsx    # Win/loss/draw result screen
│   │   │   └── Timer.tsx         # Circular SVG countdown timer
│   │   ├── lib/
│   │   │   └── nakama.ts         # Nakama client singleton + helpers
│   │   └── types/
│   │       └── game.ts           # Shared TypeScript types & OpCodes
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
├── nakama/                       # Nakama server modules (Lua)
│   ├── modules/
│   │   ├── tictactoe.lua         # RPCs, matchmaker callback
│   │   └── tictactoe_match.lua   # Authoritative match handler
│   └── local.yml                 # Nakama runtime config
├── docker-compose.yml            # Nakama + CockroachDB services
├── Dockerfile.nakama             # Copies Lua modules into Nakama image
└── README.md
```

## Design Decisions

1. **Lua over Go plugins** — Nakama supports both Go and Lua runtimes. Lua was chosen to avoid Go protobuf version conflicts with the Nakama binary and for simpler deployment (no compilation step).

2. **Single global socket listener** — The `App.tsx` component owns the WebSocket `onmatchdata` handler. This prevents race conditions from multiple components competing for the same socket event.

3. **Lua array normalization** — Lua encodes arrays as 1-indexed objects (`{"1":0,"2":1,...}`). The frontend includes `luaToArray()` helpers to normalize these into JavaScript arrays.

4. **Device-based authentication** — Players authenticate with auto-generated device IDs stored in localStorage. This provides persistent identity without requiring email/password.

5. **Authoritative match model** — The Nakama authoritative match handler processes all game logic server-side at a 1Hz tick rate, ensuring no client can cheat or desync.

## License

MIT
