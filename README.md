# FlipPhone

A mobile-first web app for gathering phone flip sensor data to train a classification model.

## What is it?

Phone flips are skateboarding-style tricks performed by flipping your phone in the air with your hands (Kickflip, Heelflip, Shuvit, etc.). This app records the accelerometer and gyroscope data from your phone while you perform a trick, then lets you decide whether to save or discard each recording.

## Features

- **Trick selector** – Choose the trick you are about to perform (Kickflip, Heelflip, Shuvit, 360 Shuvit, Treflip, Hardflip, Varial Kick, Varial Heel, Impossible, Custom).
- **Live sensor display** – See real-time accelerometer (m/s²) and gyroscope (rad/s) values while recording.
- **Tap-to-record** – Press the large round button to start/stop capturing data.
- **Review screen** – After each recording you see a duration, sample count, sample rate, and an acceleration-magnitude chart. Tap **Save** to keep it or **Discard** to throw it away.
- **Dataset view** – Browse all saved recordings with per-trick counts, and delete individual entries.
- **Export** – Download your dataset as **JSON** or flat **CSV**, ready for ML training.

## Data format

Each saved recording is stored in `localStorage` and exported with the following structure:

```json
{
  "id": "unique-uuid",
  "trick": "Kickflip",
  "timestamp": "2026-03-23T22:00:00.000Z",
  "durationMs": 1234,
  "sampleCount": 74,
  "sampleRateHz": 60,
  "samples": [
    { "t": 0,   "ax": 0.12, "ay": 9.81, "az": -0.05, "gx": 0.01, "gy": -0.03, "gz": 0.02 },
    { "t": 17,  "ax": 0.44, "ay": 8.20, "az":  1.30, "gx": 0.45, "gy":  1.10, "gz": 0.80 }
  ]
}
```

Fields:
| Field | Description |
|---|---|
| `t` | Milliseconds from recording start |
| `ax/ay/az` | Accelerometer including gravity (m/s²) |
| `gx/gy/gz` | Gyroscope rotation rate (rad/s) |

## Usage

Open `index.html` in your **mobile browser** (Chrome, Safari, Firefox). No server or build step is needed.

> **iOS note:** Safari on iOS 13+ requires a permission prompt before motion sensors are available. Tap **Enable Sensors** when the banner appears.

## Files

| File | Description |
|---|---|
| `index.html` | App markup |
| `style.css` | Styles (dark mobile-first theme) |
| `app.js` | All application logic, sensor handling, storage, and export |
