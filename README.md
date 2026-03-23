# FlipPhone

A mobile-first web app for gathering phone flip sensor data to train a classification model.

## What is it?

Phone flips are skateboarding-style tricks performed by flipping your phone in the air with your hands (Kickflip, Heelflip, Shuvit, etc.). This app records the accelerometer and gyroscope data from your phone while you perform a trick, then lets you decide whether to save or discard each recording – keeping your dataset clean.

Recordings are stored on a **central server**, so you can invite friends to collect data using their own keys.

---

## Quick start

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

### 2. Create an admin key for yourself

```bash
python server.py create-key "myname" --admin
```

This prints your key. Keep it safe – you'll need it to access the app.

### 3. Create keys for friends

```bash
python server.py create-key "alice"
python server.py create-key "bob"
```

Share the printed key and your server URL with each friend.

### 4. Start the server

```bash
python server.py runserver
# or with a custom port:
python server.py runserver --port 8080
```

### 5. Open the app

Navigate to `http://your-server:5000` on your phone. Enter the server URL and your API key when prompted.

Friends open the same URL and enter their own key.

---

## CLI reference

| Command | Description |
|---|---|
| `python server.py create-key <name>` | Create a regular API key |
| `python server.py create-key <name> --admin` | Create an admin key |
| `python server.py list-keys` | List all keys (ID, name, preview) |
| `python server.py revoke-key <id>` | Revoke a key by its numeric ID |
| `python server.py runserver [--port N] [--debug]` | Start the web server |

---

## Admin UI

When you connect with an **admin key**, a key management panel appears in the Dataset tab:

- See all keys and their preview
- Create a new friend key directly from the browser
- Revoke any key

Admins also see **all** recordings from all collectors in the dataset view.

---

## Features

- **Trick selector** – Choose the trick (Kickflip, Heelflip, Shuvit, 360 Shuvit, Treflip, Hardflip, Varial Kick, Varial Heel, Impossible, Custom)
- **Live sensor display** – Real-time accelerometer (m/s²) and gyroscope (rad/s) values
- **Tap-to-record** – Press the round button to start/stop capturing `devicemotion` data
- **Review screen** – Duration, sample count, sample rate, acceleration-magnitude chart; **Save** or **Discard** each take
- **Server storage** – Accepted recordings are POSTed to the server (SQLite)
- **Dataset view** – Per-trick counts, list with collector name, delete entries
- **Export** – Download the dataset as **JSON** or flat **CSV** for ML training

---

## Data format

Each recording stored on the server:

```json
{
  "id": "unique-uuid",
  "trick": "Kickflip",
  "timestamp": "2026-03-23T22:00:00.000Z",
  "durationMs": 1234,
  "sampleCount": 74,
  "sampleRateHz": 60,
  "collector": "alice",
  "samples": [
    { "t": 0,   "ax": 0.12, "ay": 9.81, "az": -0.05, "gx": 0.01, "gy": -0.03, "gz": 0.02 },
    { "t": 17,  "ax": 0.44, "ay": 8.20, "az":  1.30, "gx": 0.45, "gy":  1.10, "gz": 0.80 }
  ]
}
```

| Field | Description |
|---|---|
| `t` | Milliseconds from recording start |
| `ax/ay/az` | Accelerometer including gravity (m/s²) |
| `gx/gy/gz` | Gyroscope rotation rate (rad/s) |
| `collector` | Name of the key that submitted this recording |

---

## REST API

All endpoints require an `X-API-Key` header (or `?api_key=` query param for downloads).

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/me` | any | Info about the current key |
| POST | `/api/recordings` | any | Save a recording |
| GET | `/api/recordings` | any | List recordings (admin sees all, user sees own) |
| DELETE | `/api/recordings/<id>` | any | Delete a recording (admin or owner) |
| GET | `/api/export/json` | any | Download dataset as JSON |
| GET | `/api/export/csv` | any | Download dataset as flat CSV |
| GET | `/api/keys` | admin | List all API keys |
| POST | `/api/keys` | admin | Create a new key `{"name": "…"}` |
| DELETE | `/api/keys/<id>` | admin | Revoke a key |

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `FLIPPHONE_DB` | `flipphone.db` | Path to the SQLite database file |
| `PORT` | `5000` | Port to listen on (overridden by `--port`) |

---

## Files

| File | Description |
|---|---|
| `server.py` | Flask backend (SQLite, API key auth, REST endpoints) |
| `requirements.txt` | Python dependencies (Flask) |
| `index.html` | App markup |
| `style.css` | Styles (dark mobile-first theme) |
| `app.js` | All client logic: sensor capture, API calls, UI |

---

## Platform notes

- **iOS 13+**: Safari requires a permission prompt before motion sensors are available. Tap **Enable Sensors** when the banner appears.
- **Android / desktop**: Sensors attach automatically, no permission needed.
- **HTTPS recommended**: iOS Safari blocks `DeviceMotionEvent` on non-localhost HTTP. Use a reverse proxy (nginx, Caddy) with a TLS certificate when deploying publicly.
