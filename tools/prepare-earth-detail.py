from pathlib import Path
from PIL import Image, __version__ as pillow_version
import hashlib,json,subprocess,time
root=Path(__file__).resolve().parents[1]
source=root/'research/source/world.200407.3x21600x10800.jpg'
Image.MAX_IMAGE_PIXELS=300_000_000
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
image=Image.open(source);assert image.size==(21600,10800);image=image.convert('RGB')
out=root/'public/assets/textures';out.mkdir(parents=True,exist_ok=True)
encoder=root/'research/encoder/ktx-4.4.2/bin/toktx.exe'
manifest={'source':{'url':'https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/july/world.200407.3x21600x10800.jpg','page':'https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/','credit':'NASA Earth Observatory / Reto Stöckli','date':'July 2004 historical monthly composite','width':21600,'height':10800,'bytes':source.stat().st_size,'sha256':sha(source)},'rights':'NASA Images and Media Usage Guidelines; credit NASA Earth Observatory; no endorsement. Not labelled CC0.','rightsUrl':'https://www.nasa.gov/nasa-brand-center/images-and-media/','sourceLimitationsUrl':'https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/','encoder':{'name':'Khronos KTX-Software toktx','version':'4.4.2','distributionUrl':'https://github.com/KhronosGroup/KTX-Software/releases/download/v4.4.2/KTX-Software-4.4.2-Windows-x64.exe','sha256':sha(encoder)},'processing':{'pillow':pillow_version,'resize':'LANCZOS downsampling to exact 2:1 dimensions; opaque RGB; no sharpening, recolouring, generated noise, or added geographic content','encoding':'ETC1S KTX2 qlevel255 clevel1; sRGB; full generated mip chain; baked lower-left orientation for the accepted sphere UVs; 4 CPU threads'},'outputs':[]}
for width in [8192,16384]:
    start=time.monotonic();name=f'earth-bmng-july2004-{width//1024}k'
    png=root/f'research/source/{name}.png';image.resize((width,width//2),Image.Resampling.LANCZOS).save(png,compress_level=2)
    dest=out/f'{name}.ktx2'
    cmd=[str(encoder),'--t2','--encode','etc1s','--qlevel','255','--clevel','1','--threads','4','--genmipmap','--assign_oetf','srgb','--lower_left_maps_to_s0t0',str(dest),str(png)]
    with (root/f'research/source/{name}-encoder.log').open('w',encoding='utf-8') as log:subprocess.run(cmd,stdout=log,stderr=subprocess.STDOUT,check=True)
    manifest['outputs'].append({'file':dest.relative_to(root/'public').as_posix(),'width':width,'height':width//2,'bytes':dest.stat().st_size,'sha256':sha(dest),'resampledPngSha256':sha(png),'command':cmd,'elapsedSeconds':time.monotonic()-start})
    (root/'public/data/earth-surface-detail.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    print(json.dumps(manifest['outputs'][-1]),flush=True)
