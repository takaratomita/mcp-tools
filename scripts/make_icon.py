"""assets/icon.svg と同じ図柄を標準ライブラリだけで assets/icon.png (512x512) に描く。

    python3 scripts/make_icon.py
"""
import struct
import zlib
from pathlib import Path

SIZE, SS = 512, 3  # 3x3 スーパーサンプリング
NAVY, WHITE, RED = (30, 58, 95), (255, 255, 255), (200, 16, 46)


def color_at(x: float, y: float):
    # 角丸四角（半径96）の外は透明
    cx, cy = min(max(x, 96), 416), min(max(y, 96), 416)
    if (x - cx) ** 2 + (y - cy) ** 2 > 96**2:
        return None
    d2 = (x - 256) ** 2 + (y - 256) ** 2
    if d2 <= 48**2:
        return RED
    if d2 <= 120**2:
        return WHITE
    # 上下左右の目盛り（太さ18の線、端は丸）
    for (x1, y1, x2, y2) in ((256, 60, 256, 100), (256, 412, 256, 452), (60, 256, 100, 256), (412, 256, 452, 256)):
        px, py = x - x1, y - y1
        dx, dy = x2 - x1, y2 - y1
        t = max(0.0, min(1.0, (px * dx + py * dy) / (dx * dx + dy * dy)))
        if (px - t * dx) ** 2 + (py - t * dy) ** 2 <= 9**2:
            return WHITE
    return NAVY


def render() -> bytes:
    rows = []
    for j in range(SIZE):
        row = bytearray([0])
        for i in range(SIZE):
            acc, cover = [0, 0, 0], 0
            for sj in range(SS):
                for si in range(SS):
                    c = color_at(i + (si + 0.5) / SS, j + (sj + 0.5) / SS)
                    if c:
                        cover += 1
                        for k in range(3):
                            acc[k] += c[k]
            n = SS * SS
            if cover:
                row += bytes(a // cover for a in acc) + bytes([255 * cover // n])
            else:
                row += bytes(4)
        rows.append(bytes(row))
    return b"".join(rows)


def chunk(tag: bytes, data: bytes) -> bytes:
    body = tag + data
    return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))


png = (
    b"\x89PNG\r\n\x1a\n"
    + chunk(b"IHDR", struct.pack(">IIBBBBB", SIZE, SIZE, 8, 6, 0, 0, 0))
    + chunk(b"IDAT", zlib.compress(render(), 9))
    + chunk(b"IEND", b"")
)
out = Path(__file__).resolve().parent.parent / "assets" / "icon.png"
out.write_bytes(png)
print(f"wrote {out} ({len(png)} bytes)")
