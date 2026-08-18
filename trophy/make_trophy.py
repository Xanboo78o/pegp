#!/usr/bin/env python3
"""PeGP round trophy — small loving cup with checkered band.
Pure python, no deps. Writes binary STL (mm). ~55mm tall.
Slicers auto-union the overlapping closed shells (cup, handles, checkers).
Tweak the PROFILE / knobs below and re-run to taste.
"""
import math, struct

SEGS = 96          # revolve resolution
OUT = 'pegp-trophy.stl'

# outer silhouette then inner cavity, as (radius, height) — both ends on the axis
PROFILE = [
    (0, 0), (21, 0), (21, 4), (17, 4), (17, 7), (13.5, 7), (13.5, 9),   # stepped base
    (6, 11), (4.5, 13), (4.5, 19), (7, 22), (4.5, 25), (4.5, 27),       # stem + knop
    (8, 29), (13, 34), (16.5, 40), (18.5, 47), (19.5, 52), (20, 55),    # bowl outside
    (17.5, 55),                                                          # lip
    (16, 50), (13, 44), (9, 39), (4, 36), (0, 35),                       # bowl cavity
]

tris = []  # list of 9-float tuples

def quad(a, b, c, d):
    tris.append(a + b + c)
    tris.append(a + c + d)

def revolve(profile, segs):
    for i in range(len(profile) - 1):
        (r0, z0), (r1, z1) = profile[i], profile[i + 1]
        for s in range(segs):
            a0 = 2 * math.pi * s / segs
            a1 = 2 * math.pi * (s + 1) / segs
            p00 = (r0 * math.cos(a0), r0 * math.sin(a0), z0)
            p01 = (r0 * math.cos(a1), r0 * math.sin(a1), z0)
            p10 = (r1 * math.cos(a0), r1 * math.sin(a0), z1)
            p11 = (r1 * math.cos(a1), r1 * math.sin(a1), z1)
            if r0 == 0 and r1 == 0:
                continue
            if r0 == 0:
                tris.append(p00 + p11 + p10)
            elif r1 == 0:
                tris.append(p00 + p01 + p10)
            else:
                quad(p00, p01, p11, p10)

def torus(cx, cz, major, minor, seg_u=48, seg_v=16, flip=False):
    """ring in the XZ plane (classic cup ear), centered (cx, 0, cz)"""
    pts = []
    for u in range(seg_u):
        au = 2 * math.pi * u / seg_u
        ring = []
        # ring center path in XZ plane
        rcx = cx + major * math.cos(au)
        rcz = cz + major * math.sin(au)
        for v in range(seg_v):
            av = 2 * math.pi * v / seg_v
            # tube cross-section: radial dir in XZ plane + Y
            dx = math.cos(au) * minor * math.cos(av)
            dz = math.sin(au) * minor * math.cos(av)
            dy = minor * math.sin(av)
            ring.append((rcx + dx, dy, rcz + dz))
        pts.append(ring)
    for u in range(seg_u):
        for v in range(seg_v):
            a = pts[u][v]
            b = pts[(u + 1) % seg_u][v]
            c = pts[(u + 1) % seg_u][(v + 1) % seg_v]
            d = pts[u][(v + 1) % seg_v]
            if flip: quad(a, d, c, b)
            else: quad(a, b, c, d)

def box_at(angle, r, z, w, h, d):
    """small radially-aimed box for the checker band; w=tangential h=vertical d=radial"""
    ca, sa = math.cos(angle), math.sin(angle)
    # local frame: radial (ca,sa,0), tangential (-sa,ca,0), up (0,0,1)
    def p(t, u, v):  # t tangential [-1,1], u radial [0,1], v vertical [-1,1]
        rr = r + u * d
        return (rr * ca - t * (w / 2) * sa, rr * sa + t * (w / 2) * ca, z + v * h / 2)
    v000, v100 = p(-1, 0, -1), p(1, 0, -1)
    v010, v110 = p(-1, 1, -1), p(1, 1, -1)
    v001, v101 = p(-1, 0, 1), p(1, 0, 1)
    v011, v111 = p(-1, 1, 1), p(1, 1, 1)
    quad(v000, v100, v110, v010)  # bottom
    quad(v001, v011, v111, v101)  # top
    quad(v000, v010, v011, v001)  # side -t
    quad(v100, v101, v111, v110)  # side +t
    quad(v010, v110, v111, v011)  # outer
    quad(v000, v001, v101, v100)  # inner

# ── build ──
revolve(PROFILE, SEGS)

# ear handles, one each side
torus(19, 45, 6, 2.0)
torus(-19, 45, 6, 2.0, flip=True)

# checkered band: two offset rows of raised squares around the bowl
N = 18
for row, z in enumerate((41.5, 44.7)):
    # bowl outer radius near those heights (between profile pts) ≈ 17.0 / 18.0
    r = 16.6 if row == 0 else 17.6
    for i in range(N):
        if (i + row) % 2:
            continue
        box_at(2 * math.pi * (i + 0.5) / N, r - 0.6, z, w=2.9, h=3.0, d=1.8)

# ── write binary STL ──
with open(OUT, 'wb') as f:
    f.write(b'PeGP round trophy - pembroke grand prix'.ljust(80, b' '))
    f.write(struct.pack('<I', len(tris)))
    for t in tris:
        ax, ay, az, bx, by, bz, cx, cy, cz = t
        ux, uy, uz = bx - ax, by - ay, bz - az
        vx, vy, vz = cx - ax, cy - ay, cz - az
        nx, ny, nz = uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx
        ln = math.sqrt(nx * nx + ny * ny + nz * nz) or 1
        f.write(struct.pack('<3f', nx / ln, ny / ln, nz / ln))
        f.write(struct.pack('<9f', *t))
        f.write(struct.pack('<H', 0))

xs = [t[i] for t in tris for i in (0, 3, 6)]
ys = [t[i] for t in tris for i in (1, 4, 7)]
zs = [t[i] for t in tris for i in (2, 5, 8)]
print(f'{OUT}: {len(tris)} triangles')
print(f'size: {max(xs)-min(xs):.1f} x {max(ys)-min(ys):.1f} x {max(zs)-min(zs):.1f} mm')
