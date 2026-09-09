"""
Generate QR codes for the StaySmartGuest Expo app.

- LAN QR:     exp://192.168.0.119:8081     (same Wi-Fi, fastest)
- Tunnel QR:  exp:// (via @expo/ngrok)     (works through firewalls, slower)

The Expo dev server prints these URLs when you run `npx expo start`.
This script just bakes the LAN URL into a PNG so you can save and share it.
"""

import qrcode
import socket
import sys

LAN_IP = "192.168.0.119"          # ← matches `ipconfig` from this machine
PORT = 8081                       # Expo's default Metro port

LAN_URL = f"exp://{LAN_IP}:{PORT}"

qr = qrcode.QRCode(
    version=None,
    error_correction=qrcode.constants.ERROR_CORRECT_M,
    box_size=10,
    border=2,
)
qr.add_data(LAN_URL)
qr.make(fit=True)

img = qr.make_image(fill_color="black", back_color="white")
out = "qrcode_lan_current.png"
img.save(out)
print(f"Saved: {out}")
print(f"Encoded URL: {LAN_URL}")
print()
print("To use:")
print("  1. Make sure your phone is on the same Wi-Fi as this PC")
print("  2. Open Expo Go on your phone")
print("  3. Tap 'Scan QR code' and scan this file (or the PNG below)")
print("  4. Wait for the JS bundle to load and the app to launch")
