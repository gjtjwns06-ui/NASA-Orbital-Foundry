"""Build the locally cached NASA sky backdrop; no AI imagery or runtime network.

Source is linear half-float EXR. A documented photographic exposure and
Reinhard compression preserve star positions and the real Milky Way band.
The sky is an infinite background only, never the game's planet geometry.
"""
from pathlib import Path
import hashlib
import json
import OpenEXR
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = root / 'research/source/starmap_2020_4k.exr'
target = root / 'public/assets/textures/nasa-star-map-2020-4k.webp'
target.parent.mkdir(parents=True, exist_ok=True)
with OpenEXR.File(str(source)) as file:
    rgb = file.channels()['RGB'].pixels.astype(np.float32)
exposure = 1.4
linear = np.maximum(rgb, 0) * exposure
mapped = linear / (1 + linear)
srgb = np.where(mapped <= .0031308, mapped * 12.92, 1.055 * mapped ** (1 / 2.4) - .055)
Image.fromarray(np.uint8(np.clip(srgb * 255 + .5, 0, 255))).save(target, quality=91, method=6)
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
manifest = {
    'file': 'assets/textures/nasa-star-map-2020-4k.webp',
    'sourcePage': 'https://svs.gsfc.nasa.gov/4851/',
    'sourceUrl': 'https://svs.gsfc.nasa.gov/vis/a000000/a004800/a004851/starmap_2020_4k.exr',
    'credit': 'NASA/Goddard Space Flight Center Scientific Visualization Studio; Ernie Wright. Gaia DR2: ESA/Gaia/DPAC.',
    'sourceDescription': 'Deep Star Maps 2020, celestial ICRF/J2000 plate carree star catalogue rendering, released 2020-09-09. No constellation overlays.',
    'sourceSha256': sha(source),
    'sourceBytes': source.stat().st_size,
    'processing': {'exposure': exposure, 'toneMap': 'Reinhard x/(1+x), linear to IEC sRGB; full 4096x2048 retained; WebP quality 91 method 6', 'openexrVersion': OpenEXR.__version__, 'script': 'tools/prepare-solar-sky.py'},
    'width': 4096, 'height': 2048, 'sha256': sha(target), 'bytes': target.stat().st_size,
    'usage': 'NASA educational/informational media usage guidelines; source credits retained; no endorsement; third-party Gaia data credited.',
    'licenseUrl': 'https://www.nasa.gov/nasa-brand-center/images-and-media/',
    'reviewedOn': '2026-11-15',
    'limitations': 'Display exposure, sky orientation and planet brightness are artistic. The background does not provide a calibrated astrometric or photometric instrument. All nearby worlds, spacecraft, ray intersections and camera motion use 3D geometry.'
}
(root / 'public/assets/solar-sky-provenance.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'output': str(target), 'bytes': manifest['bytes'], 'sha256': manifest['sha256']}))
