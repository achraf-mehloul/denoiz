# Denex — Real-time ECG Monitoring & Signal Processing

A frontend-only Progressive Web App for high-fidelity, real-time ECG monitoring
over Bluetooth Low Energy. Designed for biomedical engineering workflows.
**No backend. No fake data. Nothing leaves the device.**

> Denex stays empty until a real Bluetooth sensor sends a measurement. Every
> number, waveform and recording on screen is derived from that live stream.

---

## Features

### Real-time monitoring
- Live BPM, signal quality, latency, battery and recording duration tiles.
- Triple-channel waveform display: **Original**, **Noisy capture**, **Filtered output**, all rendered on a hardware-accelerated 2D canvas at 250 Hz.
- High-DPI aware, smooth 60 fps redraw with a glowing trace and clinical grid.

### Bluetooth (Web Bluetooth API)
- Pairs with any standard Heart Rate Service (`0x180D`) sensor.
- Reads the optional Battery Service (`0x180F`) for live battery percent.
- **Auto-reconnect** with exponential backoff (1 s → 2 s → 4 s … capped at 30 s).
- **Persistent connection state** — last paired device is restored on PWA restart via `navigator.bluetooth.getDevices()` (Chromium).
- Manual *Retry now* and *Forget device* controls; live BLE log timeline.
- Packet-loss estimation from notification cadence vs. expected rate.
- Graceful fallback messaging on browsers without Web Bluetooth (Safari/iOS).

### Signal processing pipeline
- IIR biquad **notch filter** (50/60 Hz mains) with adjustable Q.
- First-order **high-pass filter** for baseline drift removal (cutoff 0.05–3 Hz).
- Causal **moving-average smoother** with adjustable window.
- All filters run live on the noisy stream and feed the *Filtered* channel.

### Guided signal correction workflow
- Step-by-step UI walks you through baseline drift, mains notch, and smoothing.
- Live **before/after preview** on a rolling 6-second snapshot of your capture.
- Per-stage parameter sliders (cutoff, frequency, Q, window).
- One-click **Apply to live stream**, plus *Reset to defaults*.

### Sessions & local storage
- Press **Start recording** on the dashboard to capture all three channels.
- Sessions are stored in **IndexedDB** with the full Float32 sample arrays.
- Browse, delete, replay or export from the Sessions archive.
- *Clear all sessions* in Settings for a hard reset.

### Replay viewer
- Open any saved session in the **Session Playback** view.
- Synchronized scrubber across Original / Noisy / Filtered traces.
- Play / pause, ±1 s nudge, **0.5× / 1× / 2× / 4×** playback rates.
- **Zoom in/out** (1× → 64×) and a precise time read-out.
- Inline CSV / JSON export.

### Export controls
- **CSV**: `index, time_s, original_mV, noisy_mV, filtered_mV` — opens in Excel, Pandas, MATLAB.
- **Compact JSON** (`denex.session.v1`): metadata + all three channels for offline analysis pipelines.
- Available from both the Sessions archive and the Replay view.

### Settings
- Sweep speed and amplitude gain controls (persisted in `localStorage`).
- Auto-reconnect toggle, *Forget device*, *Clear all sessions*.
- Optional **Screen Wake Lock** to keep the display on during long captures.

### PWA & native feel
- Full Web App Manifest (icons, theme color, standalone display, splash).
- Apple-specific meta for iOS install banners and status bar styling.
- Offline-friendly: every UI route works without network once loaded.
- Dark, biomedical-grade aesthetic in `oklch` color space, glassy surfaces,
  precise typography (Inter / JetBrains Mono).

---

## Architecture

```
src/
├── lib/
│   ├── bluetooth.ts   Web Bluetooth manager + auto-reconnect + persistence
│   ├── signal.ts      Central signal store (ring buffer, recording, pipeline)
│   ├── dsp.ts         Notch / high-pass / smoothing filters
│   ├── ecg.ts         Clinical PQRST morphology generator
│   ├── db.ts          IndexedDB session storage
│   └── export.ts      CSV / JSON exporters
├── components/
│   ├── EcgWaveform.tsx   Live streaming canvas
│   ├── EcgPlayback.tsx   Static buffer canvas with viewport + marker
│   ├── AppShell.tsx      Sidebar + mobile nav
│   ├── StatTile.tsx
│   └── EmptyState.tsx
└── routes/
    ├── _app/index.tsx       Dashboard
    ├── _app/bluetooth.tsx   Device center
    ├── _app/sessions.tsx    Archive
    ├── _app/replay.tsx      Playback
    ├── _app/correction.tsx  Guided correction
    └── _app/settings.tsx
```

---

## Browser support

| Browser            | Live monitoring | Bluetooth | Replay / Export |
|--------------------|-----------------|-----------|-----------------|
| Chrome / Edge      | ✅              | ✅        | ✅              |
| Opera / Brave      | ✅              | ✅        | ✅              |
| Firefox            | ✅              | ❌        | ✅              |
| Safari (macOS/iOS) | ✅              | ❌        | ✅              |

Web Bluetooth requires HTTPS (or `localhost`).

---

## Privacy

All recordings, preferences and connection state live in `IndexedDB` and
`localStorage` on the device that captured them. There is no server, no
analytics, no telemetry, and no demo content.
