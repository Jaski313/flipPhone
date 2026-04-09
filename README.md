# flipPhone

A mobile-first web app for playing Game of Skate with your phone. Flip it like a skateboard, let the ML model judge.

---

## What it is

flipPhone is a multiplayer Game of Skate where tricks are physical phone movements — kickflips, heelflips, shuvits — detected in real time via the device's motion sensors and classified by a machine learning model.

Challenge a friend, set a line of tricks, make them match it. Miss it, you get a letter. First to spell S-K-A-T-E loses.

Every trick performed in-game is silently saved as training data, so the model gets better the more people play.

---

## How it works

The phone's accelerometer and gyroscope record a burst of sensor data while you flip it. That data is sent to an ML classifier running locally (or on a server) which returns a trick label and confidence score. If the confidence is above the threshold, the trick counts.

```
flip phone → sensor burst → /api/predict → { trick, confidence } → game logic
                                         ↘ saved silently as training sample
```

---

## Tech stack

- **Frontend** — Vanilla HTML/CSS/JS, Canvas 2D, Device Motion API
- **Backend** — Python Flask, SQLite
- **ML Service** — runs separately on `localhost:8000`, Flask proxies to it
- No build tools, no frameworks, no dependencies beyond Flask and the ML service

---

## URL structure

| Route    | What it is                           |
| -------- | ------------------------------------ |
| `/`      | Game of Skate — login, home, play    |
| `/lab`   | Recorder, dataset viewer, playground |
| `/admin` | Key management, references, export   |

`/lab` and `/admin` have no prominent links from the main app. They exist for contributors and admins.

---

## Tricks

8 tricks are currently supported:

`kickflip` `heelflip` `fs_shuvit` `fs_360_shuvit` `bs_shuvit` `bs_360_shuvit` `treflip` `late_kickflip`

---

## Project structure

```
flipphone/
  app.py                  ← Application factory, blueprint registration
  database.py             ← SQLite helpers, schema init
  blueprints/
    game_bp.py            ← Game of Skate, auth, friends (prefix: /)
    lab_bp.py             ← Recorder, dataset, playground (prefix: /lab)
    admin_bp.py           ← Admin tools (prefix: /admin)
  static/
    game/                 ← Game frontend JS/CSS
    lab/                  ← Recorder frontend JS/CSS
    shared/
      sensor.js           ← Device Motion / Gyro
      renderer.js         ← 3D Canvas renderer (Quaternion → Canvas)
  templates/
    game/index.html
    lab/index.html
    lab/playground.html
    admin/index.html
```

---

## Database

Two auth systems run in parallel — the game needs persistent user identities for friends and challenges, while the lab uses API keys for simplicity.

**Game tables** — `game_users`, `game_sessions`, `friendships`, `games`, `game_turns`

**Lab tables** — `api_keys`, `recordings`, `references`

Recordings have a `source` column (`'game'` or `'lab'`) so admin can filter by origin. Game recordings tend to be higher quality training data — the user had a specific trick to match, so the label is reliable.

---

## Auth

**Game (`/`)** — username + password, session token stored in `localStorage` as `fp_game_token`. Token valid 30 days.

**Lab/Admin (`/lab`, `/admin`)** — API key in header: `X-API-Key: fp_...`

---

## Game of Skate rules

1. Challenger sets a line of 1–3 tricks
2. Opponent must match the line in order
3. Each failed match earns a letter (S → K → A → T → E)
4. Then roles flip — the matcher becomes the setter
5. First player to complete S-K-A-T-E loses

Gameplay is async — no need to be online at the same time. The game state lives in the database, updates are delivered via polling.

---

## Sensor data format

Each sample collected during a flip:

```json
{
  "timestamp": 1234567890,
  "ax": 0.0,
  "ay": 9.8,
  "az": 0.1,
  "gx": 0.0,
  "gy": 0.0,
  "gz": 0.0
}
```

`ax/ay/az` in m/s², `gx/gy/gz` in rad/s (mapped from `alpha/beta/gamma`). Data is stored raw and unfiltered.

---

## Running locally

```bash
# Install dependencies
pip install flask

# Start the app
python app.py

# Start the ML service separately (required for predict)
# See /ml for setup instructions
```

The app runs on `http://localhost:5000`. HTTPS is required on real devices for the Device Motion API — use a tunnel like ngrok or deploy to a host with TLS.

---

## iOS note

iOS requires an explicit permission prompt for motion sensors. The app shows a banner on first load if permission hasn't been granted yet. This must happen on user gesture (button tap) — it cannot be triggered automatically.

---

## `/lab` — contributing data

`/lab` is the data collection interface. If you have an API key, you can record labeled trick samples, review them with the 3D playback animation, and submit them to the dataset. The ML model is retrained periodically from all collected data.

The playground at `/lab/playground` lets you test the current model without an account — just flip and see what it thinks.

---

## `/admin` — administration

Admin accounts can manage API keys, set reference recordings per trick (used as canonical examples), export the full dataset as JSON or CSV, and view aggregate stats across all users.
