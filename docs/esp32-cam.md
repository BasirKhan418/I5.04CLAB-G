# ESP32 door lock (no camera)

Live door camera is **removed**. The board is lock-only: WebSocket JSON on `/door`, then pulse GPIO 12 / 13 / 14.

Flash `firmware/esp32-cam-door/esp32-cam-door.ino`. That sketch does not init the OV2640 and does not send JPEG.

Same protocol as [esp32-door.md](./esp32-door.md):

```
wss://icccc.devsomeware.com/door?token=<DOOR_DEVICE_TOKEN>
```

On connect the server sends:

```json
{ "type": "hello", "holdMs": 2500, "heartbeatMs": 15000 }
```

There is no `cam`, `stream`, `cam-on`, or `cam-off`. Visitor face capture on the kiosk (`kyc-camera`) is a browser camera and is unrelated.

Wiring used in the lab:

| GPIO | Role |
|---|---|
| 12 | Buzzer |
| 13 | Idle HIGH / open LOW |
| 14 | Idle LOW / open HIGH → Arduino D3 |

Do not put Wi-Fi or `DOOR_DEVICE_TOKEN` in git. Copy them onto the board from the server `.env`.
