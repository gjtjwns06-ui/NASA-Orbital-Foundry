"""Original Orbital Foundry environment art. Run with Blender --background --python.

Blender authoring uses Z up; glTF exporter converts to Three.js Y up.
All geometry/materials below are authored for this game, not extracted from references.
"""
import bpy
import math
import random
import json
import urllib.request
import hashlib
import tempfile
import subprocess
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'public' / 'assets'
QA = ROOT / 'docs' / 'qa'
ASSETS.mkdir(parents=True, exist_ok=True)
QA.mkdir(parents=True, exist_ok=True)
random.seed(17)
M = {}


def download_planet_textures():
    """Download published raster maps; no generated or invented planetary geography."""
    sources = [
        ('earth-day.jpg', 'https://assets.science.nasa.gov/dynamicimage/assets/science/esd/eo/images/bmng/bmng-base/july/world.200407.3x5400x2700.jpg?w=4096&h=2048&fit=clip&crop=faces%2Cfocalpoint',
         'https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/', 'NASA Earth Observatory / Reto Stockli', 'July 2004 Blue Marble Next Generation; historical composite'),
        ('earth-night.jpg', 'https://assets.science.nasa.gov/dynamicimage/assets/science/esd/eo/images/imagerecords/144000/144898/BlackMarble_2016_01deg.jpg?w=2048&h=1024&fit=clip&crop=faces%2Cfocalpoint',
         'https://science.nasa.gov/earth/earth-observatory/earth-at-night/maps/', 'NASA Earth Observatory / Black Marble team', '2016 night lights; historical composite'),
        ('earth-clouds.png','https://svs.gsfc.nasa.gov/vis/a000000/a003800/a003837/frames/2048x1024_2x1_30p/Clouds/clouds.0350.tif',
         'https://svs.gsfc.nasa.gov/3837/', 'NASA/Goddard Space Flight Center Scientific Visualization Studio', 'GEOS-5 atmospheric model, published 2011; illustrative cloud layer, not live weather'),
        ('mars.jpg','https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/Images%20and%20Textures/Mars/Mars.jpg',
         'https://science.nasa.gov/3d-resources/mars/', 'NASA/Jet Propulsion Laboratory & Caltech', 'Viking imagery processed at USGS; global cylindrical map'),
    ]
    records=[]
    for filename, url, page, credit, note in sources:
        path=ASSETS/filename
        blob=urllib.request.urlopen(url,timeout=45).read()
        source_sha=hashlib.sha256(blob).hexdigest()
        if filename.endswith('.png'):
            with tempfile.TemporaryDirectory(prefix='orbital-texture-') as tmp:
                temp_path=Path(tmp)/'source.tif';temp_path.write_bytes(blob)
                # The source is LZW TIFF; Blender's build cannot decode it.
                # Preserve original alpha exactly; neutral-white RGB avoids associated-alpha
                # colour noise in this old TIFF and makes a clean cloud-shell texture.
                subprocess.run(['python','-c','from PIL import Image; import sys; src=Image.open(sys.argv[1]); dst=Image.new("RGBA",src.size,(255,255,255,255)); dst.putalpha(src.getchannel("A")); dst.save(sys.argv[2],optimize=True)',str(temp_path),str(path)],check=True)
                im=bpy.data.images.load(str(path),check_existing=False)
                width,height=im.size[:];bpy.data.images.remove(im)
            transform='Original alpha preserved exactly; RGB set to neutral white for cloud-shell rendering; dimensions unchanged; TIFF to PNG'
        else:
            path.write_bytes(blob)
            im=bpy.data.images.load(str(path),check_existing=False)
            width,height=im.size[:];bpy.data.images.remove(im)
            transform=f'NASA-served {width}x{height} derivative, bytes unchanged' if filename.startswith('earth') else 'Original bytes unchanged'
        max_width,max_height=(4096,2048) if filename=='earth-day.jpg' else (2048,1024)
        if width>max_width or height>max_height or width!=height*2:
            raise ValueError(f'Unexpected planetary map dimensions: {filename} {width}x{height}')
        records.append({'file':filename,'sourceUrl':url,'sourcePage':page,'credit':credit,'note':note,'transformation':transform,'width':width,'height':height,'bytes':path.stat().st_size,'sourceSha256':source_sha,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'usage':'NASA Images and Media Usage Guidelines; source attribution, no NASA endorsement implied'})
        print(f'TEXTURE_READY {filename} {width}x{height} {path.stat().st_size}')
    (ASSETS/'texture-provenance.json').write_text(json.dumps(records,indent=2),encoding='utf-8')


def material(name, rgb, rough=.55, metal=0, emission=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*rgb, 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    if emission:
        p.inputs['Emission Color'].default_value = (*rgb, 1)
        p.inputs['Emission Strength'].default_value = emission
    M[name] = m
    return m


def materials():
    M.clear()
    for n, c, r, me in [
        ('Ivory',(0.80,.85,.83),.4,.1), ('Paper',(.94,.96,.91),.45,0),
        ('Navy',(.035,.075,.12),.48,.25), ('Teal',(.055,.27,.30),.38,.2),
        ('Amber',(.95,.43,.10),.46,.15), ('Yellow',(.98,.67,.16),.4,.1),
        ('Steel',(.34,.44,.49),.35,.65), ('DarkSteel',(.10,.17,.21),.4,.5),
        ('Glass',(.055,.18,.26),.15,.38), ('Grass',(.29,.49,.36),.9,0),
        ('GrassLight',(.40,.59,.40),.9,0), ('Concrete',(.58,.66,.65),.8,0),
        ('ConcreteLight',(.74,.79,.74),.7,0), ('Asphalt',(.15,.22,.25),.9,0),
        ('TreeDark',(.08,.26,.22),1,0), ('TreeMid',(.19,.40,.30),1,0),
        ('TreeLight',(.41,.57,.37),1,0), ('Pink',(.68,.43,.45),1,0),
        ('Wood',(.22,.20,.16),1,0), ('Floor',(.18,.25,.29),.55,.15),
        ('FloorLine',(.27,.36,.39),.6,.1), ('Rubber',(.025,.04,.05),.9,0),
        ('Screen',(.035,.31,.36),.3,.1), ('Blue',(.08,.29,.45),.4,.4),
    ]:
        material(n,c,r,me)
    material('Lamp',(.82,.92,1),.35,0,3)
    material('WarmLamp',(1,.68,.27),.4,0,2)
    material('ScreenGlow',(.10,.75,.75),.4,0,.8)


def finish(obj, name, mat, bevel=0, smooth=False, group='Environment'):
    obj.name = name
    obj.data.materials.append(M[mat])
    obj['asset_group'] = group
    if bevel:
        mod = obj.modifiers.new('Manufactured edge bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        mod.affect = 'EDGES'
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
    if smooth:
        for face in obj.data.polygons:
            face.use_smooth = True
        if bevel:
            mod = obj.modifiers.new('Weighted corner normals', 'WEIGHTED_NORMAL')
            mod.keep_sharp = True
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def box(name, loc, scale, mat, bevel=.03, group='Environment'):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj=bpy.context.object
    obj.dimensions=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(obj,name,mat,min(bevel,min(scale)*.3),True,group)


def cyl(name, loc, radius, depth, mat, vertices=32, group='Environment'):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=loc)
    return finish(bpy.context.object,name,mat,.025,True,group)


def cone(name, loc, r1, r2, depth, mat, vertices=32, group='Environment'):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=r1,radius2=r2,depth=depth,location=loc)
    return finish(bpy.context.object,name,mat,0,True,group)


def ball(name, loc, scale, mat, subdivisions=1, group='Environment'):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions,radius=1,location=loc)
    obj=bpy.context.object
    obj.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(obj,name,mat,0,False,group)


def beam(name, a, b, width, mat, group='Environment'):
    mid=(Vector(a)+Vector(b))*.5
    d=Vector(b)-Vector(a)
    obj=box(name,mid,(width,width,d.length),mat,.018,group)
    obj.rotation_euler=d.to_track_quat('Z','Y').to_euler()
    return obj


def ring(name, loc, major, minor, mat, group='Environment'):
    bpy.ops.mesh.primitive_torus_add(major_radius=major,minor_radius=minor,major_segments=48,minor_segments=6,location=loc)
    return finish(bpy.context.object,name,mat,0,True,group)


def text(name, body, loc, size, mat, rotation=(math.pi/2,0,0), group='Environment'):
    bpy.ops.object.text_add(location=loc, rotation=rotation)
    obj=bpy.context.object
    obj.data.body=body
    obj.data.size=size
    obj.data.align_x='CENTER'
    obj.data.extrude=.002
    obj.data.bevel_depth=.001
    bpy.ops.object.convert(target='MESH')
    return finish(obj,name,mat,0,False,group)


def tree(x,y,z=0,s=1,pink=False):
    cyl('Tree trunk',(x,y,z+.65*s),.085*s,1.3*s,'Wood',8)
    colors=['Pink'] if pink else ['TreeDark','TreeMid','TreeLight']
    for i,(dx,dy,dz,r) in enumerate([(-.22,.05,1.3,.65),(.23,.08,1.45,.64),(0,-.1,1.85,.6)]):
        ball('Sculpted tree canopy',(x+dx*s,y+dy*s,z+dz*s),(r*s,r*.85*s,r*.95*s),colors[i%len(colors)],2)


def lamp(x,y,height=3):
    cyl('Light pole',(x,y,height/2),.045,height,'DarkSteel',12)
    beam('Lamp neck',(x,y,height),(x+.3,y,height),.07,'DarkSteel')
    box('Site lamp',(x+.3,y,height),(.5,.24,.12),'Ivory',.03)
    box('Site lamp lens',(x+.3,y,height-.07),(.4,.17,.02),'Lamp',.005)


def campus():
    box('Landscape plinth',(0,0,-.40),(32,31,.7),'Grass',.65)
    box('Beveled foundation',(0,0,-.86),(32.3,31.3,.25),'DarkSteel',.15)
    box('Launch access road',(0,-7,.01),(5,15,.07),'Asphalt',.1)
    box('Campus crossing road',(0,-9,.025),(31,3.4,.08),'Asphalt',.1)
    for y in [-13,-11.5,-8,-6.5,-5,-3.5]:
        box('Road center marker',(0,y,.075),(.07,.65,.012),'Paper',0)
    for x in range(-14,15,2):
        box('Crossroad marker',(x,-9,.075),(.7,.06,.012),'Paper',0)
    for x in [-2.5,2.5]:
        box('Paved shoulder',(x,-5,.07),(.25,12,.12),'ConcreteLight',.02)
    # Sculpted circular pad and radial access details.
    cyl('Launch apron',(0,0,.05),5.1,.15,'Concrete',64)
    cyl('Inset launch pad',(0,0,.16),3.7,.16,'ConcreteLight',64)
    ring('Safety ring',(0,0,.26),3.25,.035,'Yellow')
    cyl('Hold-down deck',(0,0,.36),1.45,.35,'DarkSteel',48)
    for x in [-1.15,1.15]:
        for y in [-.9,.9]:
            box('Hold down structure',(x,y,.70),(.36,.42,1.05),'Steel',.05)
            box('Hold down amber cover',(x,y,1.15),(.38,.45,.16),'Yellow',.025)
    # Original two-stage launch vehicle. Dedicated group keeps it independently animatable.
    rg='LaunchVehicle'
    cyl('First stage',(0,0,4.12),.68,6.05,'Ivory',48,rg)
    cyl('Stage coupling',(0,0,7.18),.69,.30,'Navy',48,rg)
    cyl('Second stage',(0,0,8.15),.61,1.64,'Paper',48,rg)
    cone('Payload shoulder',(0,0,9.18),.61,.80,.4,'Paper',48,rg)
    cyl('Payload fairing',(0,0,9.92),.8,1.1,'Paper',48,rg)
    cone('Ogive fairing',(0,0,11.12),.8,.12,1.3,'Paper',48,rg)
    cone('Fairing tip',(0,0,11.9),.12,0,.28,'Paper',24,rg)
    cyl('Lower skirt',(0,0,1.25),.7,.4,'Navy',48,rg)
    for y in [-.30,.30]:
        for x in [-.30,.30]:
            cone('Engine bell',(x,y,.7),.22,.14,.65,'DarkSteel',24,rg)
            ring('Engine rim',(x,y,.38),.21,.025,'Steel',rg)
    for x in [-1.04,1.04]:
        cyl('Strap-on booster',(x,0,3.30),.37,4.6,'Paper',32,rg)
        cone('Booster nose',(x,0,6.05),.37,0,.9,'Paper',32,rg)
        cyl('Booster accent',(x,0,1.2),.38,.3,'Amber',32,rg)
        cone('Booster engine',(x,0,.75),.29,.19,.6,'DarkSteel',24,rg)
        beam('Booster attachment',(x,0,4.4),(x*.5,0,4.4),.19,'Steel',rg)
    for z in [2,5.9]:
        cyl('Body accent band',(0,0,z),.687,.09,'Teal',48,rg)
    text('Vehicle marking','OF',(0,-.692,5),.38,'Navy',group=rg)
    text('Vehicle designation','01',(0,-.69,4.35),.28,'Navy',group=rg)
    # Braced gantry offset behind the craft.
    tx,ty=-2.0,1.7
    for x in [tx-.65,tx+.65]:
        for y in [ty-.65,ty+.65]:
            box('Gantry column',(x,y,6),(.18,.18,12),'Teal',.03)
    for z in [1.2,3.2,5.2,7.2,9.2,11.2]:
        box('Gantry floor',(tx,ty,z),(1.6,1.6,.18),'Steel',.03)
        if z < 11:
            for x in [tx-.65,tx+.65]:
                beam('Cross bracing',(x,ty-.65,z),(x,ty+.65,z+1.9),.09,'Teal')
                beam('Cross bracing',(x,ty+.65,z),(x,ty-.65,z+1.9),.09,'Teal')
            beam('Back cross bracing',(tx-.65,ty+.65,z),(tx+.65,ty+.65,z+1.9),.1,'Teal')
        box('Gantry edge',(tx,ty-.82,z+.08),(1.7,.1,.26),'Amber',.02)
    for z in [5.3,8.8]:
        box('Service access arm',(-.75,1.2,z),(2.4,.5,.25),'Amber',.04)
        for xx in [-1.7,-.7,.3]:
            beam('Access railing',(xx,1,z+.1),(xx,1,z+.6),.04,'Steel')
        beam('Access top rail',(-1.7,1,z+.6),(.3,1,z+.6),.04,'Steel')
    beam('Lightning rod',(-2,1.7,11.3),(-2,1.7,13.8),.06,'Steel')
    # Mission operations and integration buildings.
    building(-9,5.7,6.5,5.3,3.1,'MISSION OPERATIONS')
    building(8.7,6.4,7.1,6,4.2,'INTEGRATION  /  02')
    for x in [-11,-8,-5]:
        box('Administrative rooftop cooler',(x,5.8,3.55),(.8,1,.65),'DarkSteel',.1)
        for i in range(4):
            box('Cooler fin',(x-.3+i*.2,5.8,3.9),(.035,.75,.015),'Steel',0)
    # Ground station with a real concave, ribbed reflector silhouette.
    dish(8,-3.9,1.0,1.5)
    box('Comms platform',(8,-3.9,.12),(4.5,4.2,.22),'ConcreteLight',.14)
    # Fuel farm.
    for x in [-10.5,-8.8]:
        cyl('Propellant tank',(x,-3,1.20),.64,2.1,'Ivory',32)
        ball('Tank dome',(x,-3,2.25),(.64,.64,.34),'Ivory',2)
        ring('Tank brace',(x,-3,.6),.65,.055,'Teal')
        beam('Fuel pipe',(x,-3,.35),(x,-4.7,.35),.12,'Yellow')
    box('Tank service slab',(-9.5,-3,.06),(4,3.8,.12),'ConcreteLight',.12)
    # Landscaping uses one authored faceted style, avoiding mixed downloaded kits.
    for i,(x,y,s) in enumerate([(-13,-6,1),(-13,-1,1.1),(-13,3,.95),(-13,11,1),(-7,12,.9),(-2,12,1.1),(3,12,1),(13,11,1),(13,1,.9),(13,-5,1),(-9,-12,1.15),(-5,-12,.9),(7,-12,1),(12,-12,.85)]):
        box('Planting bed',(x,y,.05),(2.2,1.8,.14),'GrassLight',.3)
        tree(x,y,s=s,pink=i in [4,9,11])
    for x,y in [(-3,-5),(3,-5),(-12,-8),(12,-8),(-5,8),(5,8)]:
        lamp(x,y)
    for x in [-13.7,13.7]:
        for y in range(-6,12,2):
            cyl('Perimeter post',(x,y,.50),.025,1,'Steel',8)
        for h in [.35,.8]:
            beam('Perimeter rail',(x,-6,h),(x,10,h),.035,'Steel')
    box('Campus identity plinth',(-7,-7,.65),(4.5,.35,1.2),'Teal',.08)
    text('Campus wordmark','ORBITAL FOUNDRY',(-7,-7.19,.85),.29,'Paper')
    text('Campus subtitle','FLIGHT RESEARCH CAMPUS',(-7,-7.19,.38),.15,'Yellow')


def building(x,y,w,d,h,label):
    box('Building foundation',(x,y,.18),(w+.35,d+.35,.35),'ConcreteLight',.1)
    box('Building body',(x,y,h/2+.25),(w,d,h),'Ivory',.13)
    box('Building dark roof',(x,y,h+.32),(w+.24,d+.24,.28),'Teal',.07)
    box('Facade ribbon',(x,y-d/2-.015,h*.65),(w-.45,.08,.72),'Glass',.02)
    for wx in [x-w/2+.35+i*.8 for i in range(int((w-.6)/.8)+1)]:
        box('Window mullion',(wx,y-d/2-.07,h*.65),(.07,.14,.76),'Paper',.008)
    box('Entry canopy',(x,y-d/2-.45,.95),(2.4,1.2,.12),'Teal',.03)
    box('Entry glazing',(x,y-d/2-.04,.7),(1.5,.12,.9),'Glass',.02)
    text('Building sign',label,(x,y-d/2-.085,h-.28),.23,'Teal')


def dish(x,y,z,r):
    cyl('Ground antenna pedestal',(x,y,.8),.38,1.5,'Teal',24)
    root=bpy.data.objects.new('TrackingDish',None);bpy.context.collection.objects.link(root)
    root.location=(x,y,z+1)
    root.rotation_euler=(.52,0,.3)
    before=set(bpy.context.scene.objects)
    # Explicit paraboloid rings, including a visible solid thickness edge.
    verts=[];faces=[];rings=8;segs=48
    for j in range(rings+1):
        rr=r*j/rings
        for i in range(segs):
            a=2*math.pi*i/segs;verts.append((rr*math.cos(a),rr*math.sin(a),rr*rr/(2.6*r)))
    for j in range(rings):
        for i in range(segs):
            a=j*segs+i;b=j*segs+(i+1)%segs;faces.append((a,b,b+segs,a+segs))
    mesh=bpy.data.meshes.new('Parabolic reflector');mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new('Antenna reflector',mesh);bpy.context.collection.objects.link(o);finish(o,'Antenna reflector','Paper',smooth=True)
    sol=o.modifiers.new('Reflector thickness','SOLIDIFY');sol.thickness=.035;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=sol.name)
    ring('Reflector rim',(0,0,r/2.6),r,.035,'Steel')
    for a in [0,math.pi*.666,math.pi*1.333]:
        beam('Feed support',(r*.9*math.cos(a),r*.9*math.sin(a),r*.81/2.6),(0,0,r*1.05),.045,'DarkSteel')
    cyl('Feed receiver',(0,0,r*1.04),.12,.18,'Amber',16)
    for o in set(bpy.context.scene.objects)-before:
        if o!=root:o.parent=root


def hangar():
    box('Cleanroom foundation',(0,0,-.25),(18,17,.45),'DarkSteel',.15)
    box('Cleanroom polished floor',(0,0,-.015),(17.8,16.8,.06),'Floor',.06)
    # Restrained inlaid grid, all center equipment space stays empty.
    for x in range(-8,9,2):box('Floor expansion joint',(x,0,.021),(.025,16,.006),'FloorLine',0)
    for y in range(-8,9,2):box('Floor expansion joint',(0,y,.021),(17,.025,.006),'FloorLine',0)
    for x in [-3.5,3.5]:box('Safety boundary',(x,0,.029),(.07,11,.008),'Yellow',0)
    for y in [-4.5,4.5]:box('Safety boundary',(0,y,.029),(7,.07,.008),'Yellow',0)
    for y in [-6.2,5.3]:
        box('Walkway stripe',(0,y,.03),(15,.06,.008),'Yellow',0)
    for i in range(16):
        o=box('Hazard chevron',(-7.5+i,-5.9,.031),(.32,.5,.01),'Yellow',0);o.rotation_euler.z=-.55
    # Back wall (Blender +Y, Three -Z), full front remains open.
    box('Rear cleanroom wall',(0,7.65,3.5),(18,.3,7),'Ivory',.06)
    box('Rear wall dado',(0,7.42,.65),(18,.17,1.3),'Teal',.025)
    for x in [-8.5,-4.3,0,4.3,8.5]:
        box('Rear steel column',(x,7.2,3.7),(.23,.4,7.4),'Steel',.035)
    # Large segmented, framed airlock.
    box('Airlock outer surround',(0,7.26,3.05),(4.9,.4,5.7),'Navy',.06)
    for i in range(10):
        box('Airlock sectional door',(0,7.0,.5+i*.5),(4.4,.15,.46),'ConcreteLight',.025)
    box('Airlock header',(0,6.96,5.93),(5.2,.3,.4),'Teal',.04)
    text('Hangar bay label','INTEGRATION BAY  /  01',(0,6.78,6.25),.38,'Teal')
    text('Cleanroom label','FLIGHT HARDWARE  •  CLEAN ZONE',(0,6.78,5.82),.14,'Paper')
    for x in [-2.45,2.45]:
        for z in [.4,1.2,2,2.8,3.6,4.4,5.2]:
            box('Door warning blocks',(x,6.98,z),(.16,.1,.32),'Yellow',.012)
    # Side wings are partial height at front to keep camera freedom.
    for x in [-8.7,8.7]:
        box('Side cleanroom wall',(x,3.6,3.5),(.26,8,7),'Ivory',.06)
        box('Side blue dado',(x*.985,3.6,.65),(.1,8,1.3),'Teal',.02)
        for y in [-5,-1,3,7]:
            box('Open steel bay column',(x,y,3.7),(.25,.27,7.4),'Steel',.035)
    # Open roof beams and emissive linear fixtures; no solid roof occluding spacecraft.
    for y in [-5,-1,3,7]:
        box('Roof transverse girder',(0,y,7.45),(17.6,.26,.4),'DarkSteel',.04)
        for x in [-5.7,0,5.7]:
            box('Ceiling light housing',(x,y,7.15),(3,.40,.20),'Steel',.035)
            box('Ceiling light diffuser',(x,y,7.03),(2.8,.30,.045),'Lamp',.012)
    for x in [-6.4,6.4]:
        box('Crane runway',(x,0,6.7),(.25,14,.42),'Amber',.035)
    box('Overhead crane bridge',(0,3.4,6.95),(13,.7,.55),'Yellow',.06)
    box('Crane trolley',(2.8,3.4,6.45),(1,.9,.55),'Teal',.06)
    beam('Retracted crane cable',(2.8,3.4,6.15),(2.8,3.4,5.45),.035,'DarkSteel')
    ring('Crane lifting hook',(2.8,3.4,5.4),.15,.045,'Steel')
    # Workbenches and instrument racks outside clear ±2.5m assembly envelope.
    for x,y in [(-6.3,2),(-6.3,-2.5),(6.3,2),(6.3,-2.5)]:
        workbench(x,y)
    for x in [-6.4,6.4]:
        box('Rear equipment cabinet',(x,6.5,1.2),(2,1.1,2.4),'Ivory',.08)
        box('Equipment rack fascia',(x,5.92,1.3),(1.75,.08,1.9),'Navy',.025)
        for z in [.6,1,1.4,1.8]:
            box('Rack module',(x,5.86,z),(1.58,.07,.31),'Steel',.012)
            box('Rack status',(x-.58,5.81,z),(.22,.02,.06),'ScreenGlow',.005)
        text('Rack label','GROUND SYSTEMS',(x,5.83,2.12),.14,'Paper')
    # Flight-case trolley and coiled cable, scaled to human context.
    box('Transport case',(5.7,-5,0.63),(1.6,.95,.9),'Teal',.10)
    for xx in [5.08,6.32]:
        for yy in [-5.35,-4.65]:
            o=cyl('Case wheel',(xx,yy,.18),.14,.10,'Rubber',16);o.rotation_euler.x=math.pi/2
    for xx in [5.12,6.28]:box('Flightcase edge',(xx,-5,.63),(.08,1,.94),'Steel',.02)
    for rr in [.37,.44,.51]:ring('Cable loop',(-5.4,-5,.08),rr,.025,'Rubber')
    # Rear wall data screens: clear visual landmarks but no baked gameplay UI.
    for x in [-5.3,5.3]:
        box('Wall display casing',(x,7.1,4.35),(3.3,.2,1.65),'Navy',.07)
        box('Wall display glass',(x,6.98,4.35),(3.08,.03,1.43),'Screen',.015)
        for i in range(6):
            box('Display trace',(x-1.25+i*.46,6.95,4.06),(.20,.015,.15+i*.11),'ScreenGlow',0)
        text('Display legend','ORBITAL SYSTEMS',(x,6.94,4.83),.15,'Paper')
    text('Floor bay marking','01',(-4.5,-4.7,.038),.65,'ConcreteLight',(0,0,0))


def workbench(x,y):
    box('Workbench top',(x,y,1.15),(2.3,1,.12),'ConcreteLight',.035)
    for dx in [-.94,.94]:
        for dy in [-.34,.34]:box('Workbench leg',(x+dx,y+dy,.55),(.10,.10,1.1),'Steel',.015)
    box('Underbench drawers',(x+.6,y,.6),(.85,.75,.9),'Teal',.04)
    for z in [.35,.60,.85]:
        box('Drawer seam',(x+.6,y-.385,z),(.75,.025,.025),'DarkSteel',.005)
        box('Drawer grip',(x+.6,y-.42,z+.07),(.30,.05,.04),'Steel',.01)
    box('Desktop monitor',(x-.35,y+.17,1.68),(.85,.13,.52),'Navy',.03)
    box('Monitor image',(x-.35,y+.09,1.68),(.76,.02,.43),'ScreenGlow',.01)
    beam('Monitor support',(x-.35,y+.17,1.23),(x-.35,y+.17,1.5),.08,'Steel')
    box('Keyboard',(x-.35,y-.22,1.23),(.68,.22,.04),'DarkSteel',.01)
    box('Instrument module',(x+.65,y,1.36),(.45,.5,.3),'Ivory',.025)


def collapse_by_material():
    """Join static geometry into material buckets, preserving launch vehicle transform."""
    mesh_objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
    # Bake parent transforms first, including the tilted tracking dish.
    for obj in mesh_objects:
        mw=obj.matrix_world.copy();obj.parent=None;obj.matrix_world=mw
    buckets={}
    for o in mesh_objects:
        key=(o.get('asset_group','Environment'),o.data.materials[0].name)
        buckets.setdefault(key,[]).append(o)
    for (group,mat),objects in buckets.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        bpy.ops.object.join()
        o=bpy.context.object;o.name=f'{group}_{mat}'
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        if group=='LaunchVehicle':
            parent=bpy.data.objects.get('LaunchVehicle')
            if parent is None:
                parent=bpy.data.objects.new('LaunchVehicle',None);bpy.context.collection.objects.link(parent)
            mw=o.matrix_world.copy();o.parent=parent;o.matrix_world=mw
    for obj in list(bpy.context.scene.objects):
        if obj.type=='EMPTY' and not obj.children:bpy.data.objects.remove(obj,do_unlink=True)


def configure_render(name):
    scene=bpy.context.scene
    scene.render.engine='CYCLES'
    scene.cycles.samples=32
    scene.cycles.use_denoising=True
    scene.render.resolution_x=1500;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
    scene.world.color=(.25,.30,.38)
    scene.world.use_nodes=True
    bg=scene.world.node_tree.nodes.get('Background')
    bg.inputs['Color'].default_value=(.41,.56,.7,1)
    bg.inputs['Strength'].default_value=.55
    scene.view_settings.view_transform='AgX'
    def area(n,loc,power,size,color,target=(0,0,2)):
        data=bpy.data.lights.new(n,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=color
        o=bpy.data.objects.new(n,data);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
    if name=='launch-campus':
        loc=(28,-36,23);target=(0,0,4.1)
        area('Broad daylight',(4,-8,23),3500,8,(1,.85,.67))
        data=bpy.data.lights.new('Sun','SUN');data.energy=2.4;data.angle=.16
        sun=bpy.data.objects.new('Sun',data);bpy.context.collection.objects.link(sun);sun.rotation_euler=(.3,-.5,-.5)
    else:
        loc=(7,-9,5);target=(0,1,2.2)
        area('Ceiling softbox',(0,0,7),2100,8,(.75,.88,1))
        area('Front fill',(3,-7,5),1500,7,(1,.87,.65))
        area('Rear rim',(-4,6,5),1800,5,(.63,.81,1))
    data=bpy.data.cameras.new('PreviewCamera');cam=bpy.data.objects.new('PreviewCamera',data);bpy.context.collection.objects.link(cam)
    cam.location=loc;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=42 if name=='launch-campus' else 23
    scene.camera=cam
    scene.render.filepath=str(QA / f'{name}.png')
    bpy.ops.render.render(write_still=True)


def build(name,fn):
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    materials();fn();bpy.context.view_layer.update();collapse_by_material()
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
    tris=0
    for o in meshes:o.data.calc_loop_triangles();tris+=len(o.data.loop_triangles)
    path=ASSETS/f'{name}.glb'
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',export_yup=True,export_cameras=False,export_lights=False,export_extras=True)
    stats={'file':path.name,'triangles':tris,'meshObjects':len(meshes),'bytes':path.stat().st_size,'authoredBy':'Orbital Foundry project','coordinates':'glTF Y-up, metres'}
    print('ASSET_STATS '+json.dumps(stats))
    configure_render(name)
    return stats


if __name__=='__main__':
    download_planet_textures()
    stats=[build('launch-campus',campus),build('hangar',hangar)]
    (ASSETS/'environment-stats.json').write_text(json.dumps(stats,indent=2),encoding='utf-8')
