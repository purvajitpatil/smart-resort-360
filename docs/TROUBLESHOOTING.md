# StaySmartGuest — Android Troubleshooting

Common issues when running the app on a phone.

## 1. App opens but "Network request failed" on login

**Cause**: The phone can't reach your computer's backend.

**Fix**:
- Confirm phone and computer are on the **same Wi-Fi**.
- Run `ipconfig` and find your **IPv4 Address** (e.g. `192.168.0.119`).
- Update `src/lib/api.ts` (the `NATIVE_DEFAULT_API` line) **OR** `.env` (the `EXPO_PUBLIC_API_BASE` line).
- Restart `npx expo start --clear` so the bundle picks up the new value.
- Backend must be started with `--host 0.0.0.0` (not the default `127.0.0.1`).

## 2. App stuck on splash / never loads JS

**Cause**: Metro bundler isn't running, or the QR is for a stale server.

**Fix**:
- Make sure `npx expo start` is still running in your terminal.
- Use the **LAN** URL, not the tunnel one (it can be slow / expired).
- Check the terminal for red error lines and paste them back.

## 3. App loads but the QR doesn't work

**Cause**: Scanning a QR from a screenshot works, but Expo Go sometimes refuses old bundles.

**Fix**:
- Open Expo Go → **"Enter URL manually"** → type `exp://YOUR_IP:8081`.

## 4. Quick network check

Before scanning the QR, run on your computer:
```powershell
ipconfig | findstr IPv4
curl http://YOUR_IP:8000/api/v1/health
```
You should get a 200 response. If the curl fails, the phone will fail too.

## 5. Windows firewall blocking port 8000

```powershell
New-NetFirewallRule -DisplayName "Allow Expo 8000" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow
```

## 6. Regenerate the QR code

```powershell
cd StaySmartGuest
python gen_qr.py
```

This produces `qrcode_lan_current.png` with your current LAN IP baked in.

## 7. What the app expects

| Var | Where | Example |
|---|---|---|
| `EXPO_PUBLIC_API_BASE` | `.env` | `http://192.168.0.119:8000/api/v1` |
| `NATIVE_DEFAULT_API` | `src/lib/api.ts` | Same as above (fallback) |
| Backend host flag | `uvicorn` | `--host 0.0.0.0` |

If all three match your current IP and the backend is running, the app will log in successfully.
