# Multiplayer Tic-Tac-Toe with Nakama

A production-ready, real-time multiplayer Tic-Tac-Toe game with **server-authoritative architecture** using [Nakama](https://heroiclabs.com/nakama/) as the game server backend.

---

## Live Deployments

| Deliverable | URL |
|---|---|
| **Deployed Game** | [http://43.204.23.210](http://43.204.23.210) |
| **Nakama Server Endpoint** | [http://43.204.23.210:7350](http://43.204.23.210:7350) |
| **Nakama Admin Console** | [http://43.204.23.210:7351](http://43.204.23.210:7351) |
| **Source Code** | [https://github.com/sj1705/multiplayer-tictactoe](https://github.com/sj1705/multiplayer-tictactoe) |

---

## Features

- **Server-Authoritative Game Logic** — All moves validated server-side; clients are display-only, preventing cheating
- **Real-time Multiplayer** — WebSocket-based communication for instant game state updates
- **Multiple Matchmaking Options** — Auto-matchmaker, create private rooms, or join by match ID
- **Timer Mode (Bonus)** — 30-second turn limit with visual circular countdown and auto-forfeit
- **Concurrent Games (Bonus)** — Multiple isolated game sessions running simultaneously
- **Disconnect Handling** — Opponent wins by forfeit if a player leaves mid-game
- **Responsive UI** — Mobile-optimized React frontend with dark theme

---

## Architecture and Design Decisions

### System Architecture

```
                          AWS EC2 (t2.micro)
                    ┌──────────────────────────────┐
                    │                              │
┌──────────┐  HTTP  │  ┌────────┐    Nginx         │
│  Browser │◄──────►│  │ Nginx  │    (Port 80)     │
│  (React) │  :80   │  │  Web   │    Serves React  │
└──────────┘        │  │ Server │    static files   │
     │              │  └────────┘                   │
     │   WebSocket  │                              │
     └──────────────┼─► ┌──────────────────┐       │
           :7350    │   │  Nakama Server   │       │
                    │   │  (Lua Modules)   │       │
                    │   │                  │       │
                    │   │  - Match Handler │       │
                    │   │  - Matchmaking   │       │
                    │   │  - Timer Logic   │       │
                    │   └────────┬─────────┘       │
                    │            │                  │
                    │   ┌────────▼─────────┐       │
                    │   │  CockroachDB     │       │
                    │   │  (Persistence)   │       │
                    │   └──────────────────┘       │
                    │                              │
                    └──────────────────────────────┘
```

### Server-Authoritative Design

The server (Nakama Lua modules) owns **all** game state. The client is purely a display layer. The flow for each move:

1. Client sends a move request (cell position 0-8) via WebSocket
2. Server validates: correct player's turn, cell is empty, game is not over
3. Server applies the move, checks for win/draw conditions
4. Server broadcasts the updated game state to **all** players in the match
5. Clients render the received state — they cannot modify game state directly

This architecture prevents cheating and ensures game integrity across all clients.

### Key Design Decisions

1. **Lua over Go plugins** — Nakama supports both Go and Lua runtimes. Lua was chosen to avoid Go protobuf version conflicts with the Nakama binary and for simpler deployment (no compilation step required).

2. **Single global socket listener** — The `App.tsx` component owns the single WebSocket `onmatchdata` handler. This prevents race conditions from multiple components competing for the same socket event and ensures no messages are missed during screen transitions.

3. **Lua array normalization** — Lua encodes arrays as 1-indexed objects (`{"1":0,"2":1,...}` instead of `[0,1,...]`). The frontend includes a `luaToArray()` helper to normalize these into standard JavaScript arrays.

4. **Device-based authentication** — Players authenticate with auto-generated device IDs stored in `localStorage`. This provides persistent identity without requiring email/password, making the game instantly playable.

5. **Authoritative match model** — The Nakama authoritative match handler processes all game logic server-side at a 1Hz tick rate. The match handler controls turn order, move validation, win detection, timer enforcement, and game-over conditions.

6. **Nginx reverse proxy** — Frontend static files are served via Nginx on port 80 on the same EC2 instance as Nakama. This avoids HTTPS mixed-content issues that would arise from hosting the frontend on a separate HTTPS host (like GitHub Pages) while Nakama runs on HTTP.

### Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4 |
| Backend | Nakama 3.21.1 (Lua runtime modules) |
| Database | CockroachDB (bundled with Nakama for persistence) |
| Transport | WebSocket (real-time game data), HTTP (RPCs, authentication) |
| Web Server | Nginx (serves static frontend, port 80) |
| Infrastructure | AWS EC2 t2.micro, Docker, Docker Compose |

---

## Setup and Installation Instructions

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)
- [Node.js](https://nodejs.org/) >= 18 (for frontend development)

### 1. Clone the repository

```bash
git clone https://github.com/sj1705/multiplayer-tictactoe.git
cd multiplayer-tictactoe
```

### 2. Start Nakama server (backend)

```bash
docker compose up --build
```

This starts two containers:
- **Nakama** game server on `http://localhost:7350` (API) and `http://localhost:7351` (admin console)
- **CockroachDB** database on `localhost:26257`

Wait until you see `"Startup done"` in the logs.

### 3. Install and start the frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend development server runs at `http://localhost:5173`.

### 4. Access Nakama Admin Console (optional)

Open `http://localhost:7351` in your browser.
- Username: `admin`
- Password: `password`

Here you can view active matches, connected users, and server status.

---

## How to Test the Multiplayer Functionality

### Test 1: Create Room and Join (Private Match)

1. Open `http://localhost:5173` in **Browser Tab 1**
2. Enter a nickname (e.g., "Alice") and click **Continue**
3. Click **Create Room** — a Match ID appears on screen
4. Copy the Match ID using the **Copy Match ID** button
5. Open `http://localhost:5173` in **Browser Tab 2**
6. Enter a different nickname (e.g., "Bob") and click **Continue**
7. Paste the Match ID into the input field and click **Join**
8. Both tabs now show the 3x3 game board
9. The player assigned **X** goes first — click a cell to make a move
10. Turns alternate between tabs until someone wins or the board is full
11. The result screen shows **WINNER!**, **DEFEATED**, or **DRAW**
12. Click **Play Again** to return to matchmaking

### Test 2: Auto-Matchmaking (Find Match)

1. Open two browser tabs at `http://localhost:5173`
2. Log in with different nicknames in each tab
3. In **both tabs**, click **Find Match**
4. The Nakama matchmaker automatically pairs them (may take up to 25 seconds)
5. Both tabs transition to the game board once matched
6. Play the game as normal

### Test 3: Timer Mode (30-second turns)

1. Open two browser tabs and log in
2. In **both tabs**, select **Timed (30s)** mode before matchmaking
3. Start a match (via Create Room or Find Match)
4. A circular countdown timer appears between the player names
5. Each player has 30 seconds to make their move
6. Timer changes color: green (>10s) → orange (5-10s) → red (<5s)
7. If the timer reaches 0, the current player forfeits and the opponent wins with reason "Opponent ran out of time"

### Test 4: Concurrent Games

1. Open **4 browser tabs** (representing 4 different players)
2. Log in with 4 different nicknames
3. Create two separate rooms (Tab 1 creates Room A, Tab 3 creates Room B)
4. Tab 2 joins Room A, Tab 4 joins Room B
5. Play both games simultaneously — they are fully independent and isolated
6. Moves in one game do not affect the other

### Test 5: Disconnect Handling

1. Start a game between two tabs
2. Close one tab mid-game (or navigate away)
3. The remaining player wins by forfeit
4. Result screen shows "Opponent left the game"

### Testing on the Live Deployment

Replace `http://localhost:5173` with `http://43.204.23.210` in all tests above. You can test across different devices on the same network or across the internet.

---

## API / Server Configuration Details

### Nakama Server Configuration

The server runtime configuration is in `nakama/local.yml`:

```yaml
logger:
  level: "DEBUG"
```

### Lua Game Modules

| File | Purpose |
|---|---|
| `nakama/modules/tictactoe.lua` | Registers RPCs, matchmaker matched callback, module initialization |
| `nakama/modules/tictactoe_match.lua` | Authoritative match handler — contains all game logic (move validation, win/draw detection, timer enforcement, state broadcasting) |

### Authentication

- **Method:** Device-based authentication (`authenticateDevice`)
- **Endpoint:** `POST /v2/account/authenticate/device`
- **How it works:** A random device ID is generated on first visit and stored in `localStorage`. Subsequent visits reuse the same ID for persistent identity.
- **Server key:** `defaultkey`

### RPCs (Remote Procedure Calls)

| RPC ID | Method | Payload | Response | Description |
|---|---|---|---|---|
| `create_match` | POST | `{ "timed_mode": true/false }` | `{ "match_id": "uuid.nakama1" }` | Creates a new private match room. The caller must then join via WebSocket. |

### WebSocket Match OpCodes

These are the real-time message types exchanged during gameplay:

| OpCode | Name | Direction | Payload | Description |
|---|---|---|---|---|
| 1 | `MOVE` | Client → Server | `{ "position": 0-8 }` | Player requests to place their mark at the given board position (0=top-left, 8=bottom-right) |
| 2 | `STATE` | Server → Client | `{ "board": [...], "players": {...}, "current_turn": "uid", "timed_mode": bool, "turn_deadline": ms }` | Full game state broadcast after every move or when a player joins |
| 3 | `GAME_OVER` | Server → Client | `{ "winner": "uid", "reason": "win/draw/timeout/forfeit", "win_line": [0,4,8] }` | Sent when the game ends. `win_line` contains the winning cell indices (null for draw/forfeit) |
| 4 | `TIMER_UPDATE` | Server → Client | `{ "deadline": ms, "now": ms }` | Timer deadline update, sent each tick in timed mode |
| 5 | `ERROR` | Server → Client | `{ "error": "message" }` | Error message (e.g., "Not your turn", "Invalid position") |

### Game State Object

```json
{
  "board": [0, 1, 2, 0, 0, 0, 0, 0, 0],
  "players": { "user-id-1": 1, "user-id-2": 2 },
  "player_names": { "user-id-1": "Alice", "user-id-2": "Bob" },
  "current_turn": "user-id-1",
  "game_over": false,
  "winner": "",
  "win_line": null,
  "timed_mode": false,
  "turn_deadline": 0
}
```

Board values: `0` = empty, `1` = X, `2` = O

### Frontend Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VITE_NAKAMA_HOST` | `window.location.hostname` | Nakama server hostname or IP |
| `VITE_NAKAMA_PORT` | `7350` | Nakama server gRPC/HTTP port |
| `VITE_NAKAMA_USE_SSL` | `false` | Enable SSL (WSS/HTTPS) |
| `VITE_NAKAMA_KEY` | `defaultkey` | Nakama server authentication key |

### Docker Services

| Service | Image | Ports | Purpose |
|---|---|---|---|
| `nakama` | `heroiclabs/nakama:3.21.1` | 7349, 7350, 7351 | Game server (gRPC, HTTP/WS API, Admin Console) |
| `cockroachdb` | `cockroachdb/cockroach:latest-v23.1` | 26257, 8090 | Persistent database for user accounts, match data |

---

## Deployment Process Documentation

### Infrastructure Overview

The entire application is deployed on a single **AWS EC2 t2.micro** instance running Ubuntu 22.04:

- **Nginx** (port 80) — Serves the React frontend static files
- **Nakama** (port 7350) — Game server API and WebSocket endpoint
- **Nakama Console** (port 7351) — Admin dashboard
- **CockroachDB** (port 26257) — Database (internal, not exposed publicly)

### Step-by-Step Deployment

#### 1. Launch EC2 Instance

1. Go to [AWS EC2 Console](https://console.aws.amazon.com/ec2/)
2. Click **Launch Instance**
3. Configuration:
   - **Name:** `nakama-tictactoe`
   - **AMI:** Ubuntu Server 22.04 LTS (free tier eligible)
   - **Instance type:** `t2.micro` (free tier)
   - **Key pair:** Create or select an existing `.pem` key
   - **Network:** Select a VPC with a public subnet and internet gateway
   - **Auto-assign public IP:** Enable
   - **Security Group** inbound rules:
     - SSH (port 22) — Your IP
     - HTTP (port 80) — 0.0.0.0/0 (game frontend)
     - Custom TCP (port 7350) — 0.0.0.0/0 (Nakama API)
     - Custom TCP (port 7351) — Your IP (Admin console)

#### 2. SSH into the Instance

```bash
chmod 400 nakama-key.pem
ssh -i nakama-key.pem ubuntu@<EC2-PUBLIC-IP>
```

#### 3. Install Docker

```bash
sudo apt update && sudo apt install -y docker.io docker-compose nginx
sudo usermod -aG docker $USER && newgrp docker
```

#### 4. Clone and Start Nakama

```bash
git clone https://github.com/sj1705/multiplayer-tictactoe.git ~/tictactoe
cd ~/tictactoe
docker-compose up -d --build
```

Verify it's running:
```bash
docker ps
curl http://localhost:7350/healthcheck
# Should return: {}
```

#### 5. Deploy Frontend to Nginx

```bash
sudo cp -r ~/tictactoe/frontend/dist/* /var/www/html/
```

#### 6. Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/default
```

Replace contents with:
```nginx
server {
    listen 80 default_server;
    server_name _;

    root /var/www/html;
    index index.html;

    location / {
        try_files $uri /index.html =404;
    }
}
```

Restart Nginx:
```bash
sudo nginx -t && sudo systemctl restart nginx
```

#### 7. Verify Deployment

- Frontend: `http://<EC2-IP>` — Should show the game login screen
- Nakama API: `http://<EC2-IP>:7350/healthcheck` — Should return `{}`
- Admin Console: `http://<EC2-IP>:7351` — Login with admin/password

### Updating the Deployment

To deploy code changes:

```bash
cd ~/tictactoe
git pull

# If backend (Lua) files changed:
docker-compose build nakama && docker-compose up -d

# If frontend files changed:
sudo rm -rf /var/www/html/*
sudo cp -r frontend/dist/* /var/www/html/
```

---

## Project Structure

```
multiplayer-tictactoe/
├── frontend/                     # React app (Vite + TypeScript + Tailwind)
│   ├── src/
│   │   ├── components/
│   │   │   ├── App.tsx           # Main app — screen routing, single global socket listener
│   │   │   ├── Login.tsx         # Nickname entry + device authentication
│   │   │   ├── Matchmaking.tsx   # Find match / create room / join room by ID
│   │   │   ├── GameBoard.tsx     # 3x3 game board (pure display component)
│   │   │   ├── GameResult.tsx    # Win/loss/draw result screen
│   │   │   └── Timer.tsx         # Circular SVG countdown timer (30s)
│   │   ├── lib/
│   │   │   └── nakama.ts         # Nakama client singleton, auth, socket, RPC helpers
│   │   └── types/
│   │       └── game.ts           # Shared TypeScript types & OpCode constants
│   ├── dist/                     # Production build (served by Nginx)
│   ├── .env.production           # Production environment variables (EC2 IP)
│   ├── index.html                # HTML entry point
│   ├── vite.config.ts            # Vite build configuration
│   └── package.json              # Dependencies
├── nakama/                       # Nakama server modules (Lua)
│   ├── modules/
│   │   ├── tictactoe.lua         # RPC registration, matchmaker callback
│   │   └── tictactoe_match.lua   # Authoritative match handler (all game logic)
│   └── local.yml                 # Nakama runtime configuration
├── deploy/
│   └── aws-setup.md              # AWS deployment notes
├── docker-compose.yml            # Docker Compose — Nakama + CockroachDB services
├── Dockerfile.nakama             # Copies Lua modules into Nakama Docker image
└── README.md                     # This file
```

---

## Game Flow Diagram

```
Player A                    Server (Nakama)                Player B
   │                            │                            │
   │── authenticate ───────────►│◄────────── authenticate ───│
   │                            │                            │
   │── createMatch (RPC) ──────►│                            │
   │◄── match_id ──────────────│                            │
   │── joinMatch (WS) ────────►│                            │
   │                            │◄──────── joinMatch (WS) ──│
   │                            │                            │
   │◄── STATE (both players) ──│── STATE (both players) ───►│
   │                            │                            │
   │── MOVE {position: 0} ────►│                            │
   │                            │── validate move            │
   │                            │── check win/draw           │
   │◄── STATE (updated) ──────│── STATE (updated) ────────►│
   │                            │                            │
   │                            │◄──── MOVE {position: 4} ──│
   │                            │── validate move            │
   │                            │── check win/draw           │
   │◄── STATE (updated) ──────│── STATE (updated) ────────►│
   │                            │                            │
   │         ... game continues until win/draw ...          │
   │                            │                            │
   │◄── GAME_OVER ────────────│── GAME_OVER ──────────────►│
```

---

## License

MIT
