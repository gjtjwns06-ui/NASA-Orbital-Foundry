"""Original optional mission-control diorama; Blender 5.2 background script.

Reuses this project's geometry helpers, not its existing environments or exports.
Coordinates are authored Z-up and exported to glTF Y-up metres. No network calls.
"""
import bpy
import math
import json
import hashlib
import importlib.util
import sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'public' / 'assets'
QA = ROOT / 'docs' / 'qa'
SPEC = importlib.util.spec_from_file_location('foundry_assets', Path(__file__).with_name('create_assets.py'))
ART = importlib.util.module_from_spec(SPEC)
sys.dont_write_bytecode = True
SPEC.loader.exec_module(ART)
_box, _cyl, _cone, _ball = ART.box, ART.cyl, ART.cone, ART.ball
beam = ART.beam
M = ART.M
GEOMETRY = {}


def cached(name, loc, key, create):
    # Repeated keys/chairs/monitors share authoring mesh data until material batching.
    # This avoids thousands of identical expensive bevel modifier applications.
    if key not in GEOMETRY:
        obj = create()
        GEOMETRY[key] = obj.data
    else:
        obj = bpy.data.objects.new(name, GEOMETRY[key])
        bpy.context.collection.objects.link(obj)
    obj.name = name
    obj.location = loc
    return obj


def box(name, loc, scale, mat, bevel=.03, group='Environment'):
    def create():
        obj = _box(name,(0,0,0),scale,mat,0,group)
        if bevel:
            modifier = obj.modifiers.new('Single segment manufactured bevel', 'BEVEL')
            modifier.width = min(bevel,min(scale)*.3)
            modifier.segments = 1
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.modifier_apply(modifier=modifier.name)
            normal = obj.modifiers.new('Weighted flat normals', 'WEIGHTED_NORMAL')
            normal.keep_sharp = True
            bpy.ops.object.modifier_apply(modifier=normal.name)
        return obj
    return cached(name, loc, ('box',tuple(scale),mat,bevel), create)


def cyl(name, loc, radius, depth, mat, vertices=32, group='Environment'):
    return cached(name, loc, ('cylinder',radius,depth,mat,vertices), lambda: _cyl(name,(0,0,0),radius,depth,mat,vertices,group))


def cone(name, loc, r1, r2, depth, mat, vertices=32, group='Environment'):
    return cached(name, loc, ('cone',r1,r2,depth,mat,vertices), lambda: _cone(name,(0,0,0),r1,r2,depth,mat,vertices,group))


def ball(name, loc, scale, mat, subdivisions=1, group='Environment'):
    return cached(name, loc, ('ball',tuple(scale),mat,subdivisions), lambda: _ball(name,(0,0,0),scale,mat,subdivisions,group))


ART.box = box  # beam() resolves its box helper from the imported module.


def text(name, body, loc, size, mat, rotation=(math.pi/2,0,0)):
    # Tiny environmental lettering is flat printed vinyl, not bevelled sculpture.
    bpy.ops.object.text_add(location=loc, rotation=rotation)
    obj=bpy.context.object
    obj.data.body=body
    obj.data.size=size
    obj.data.align_x='CENTER'
    obj.data.resolution_u=3
    obj.data.extrude=0
    obj.data.bevel_depth=0
    bpy.ops.object.convert(target='MESH')
    return ART.finish(obj,name,mat,0,False)


def clear():
    GEOMETRY.clear()
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for material in list(bpy.data.materials):
        if material.users == 0:
            bpy.data.materials.remove(material)


def light(name, loc, power, size, color, target):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = power
    data.shape = 'DISK'
    data.size = size
    data.color = color
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = loc
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()


def camera(loc, target, lens=28):
    data = bpy.data.cameras.new('AssetInspectionCamera')
    cam = bpy.data.objects.new('AssetInspectionCamera', data)
    bpy.context.collection.objects.link(cam)
    cam.location = loc
    cam.rotation_euler = (Vector(target) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    cam.data.lens = lens
    bpy.context.scene.camera = cam
    return cam


def render_setup(width, height, samples=32):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = 'AgX'
    scene.world.use_nodes = True
    return scene


def screen_plane(name, loc, width, height, material):
    mesh = bpy.data.meshes.new(name + 'Geometry')
    # Front faces authoring -Y, which becomes glTF +Z.
    mesh.from_pydata([(-width/2,0,-height/2),(width/2,0,-height/2),(width/2,0,height/2),(-width/2,0,height/2)], [], [(0,1,2,3)])
    mesh.update()
    uv = mesh.uv_layers.new(name='UVMap')
    for loop, xy in zip(uv.data, [(0,0),(1,0),(1,1),(0,1)]):
        loop.uv = xy
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = loc
    mesh.materials.append(material)
    return obj


def placeholder():
    """Render a credited static Earth standby feed, not invented live telemetry."""
    clear()
    ART.materials()
    bpy.ops.mesh.primitive_uv_sphere_add(segments=80, ring_count=48, radius=1.72, location=(-1.18,0,0))
    earth = bpy.context.object
    earth.rotation_euler.z = math.radians(-55)
    for p in earth.data.polygons:
        p.use_smooth = True
    material = bpy.data.materials.new('NASA Blue Marble standby globe')
    material.use_nodes = True
    nodes = material.node_tree.nodes
    image = nodes.new('ShaderNodeTexImage')
    image.image = bpy.data.images.load(str(ASSETS / 'earth-day.jpg'), check_existing=True)
    p = nodes.get('Principled BSDF')
    p.inputs['Roughness'].default_value = .82
    material.node_tree.links.new(image.outputs['Color'], p.inputs['Base Color'])
    earth.data.materials.append(material)
    # Authored orbital graphic, explicitly decorative.
    curve = bpy.data.curves.new('Illustrative orbit', 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = .009
    curve.bevel_resolution = 1
    points = curve.splines.new('POLY')
    points.points.add(127)
    for i, pt in enumerate(points.points):
        t = i / 128 * 2 * math.pi
        pt.co = (-1.18 + 2.1*math.cos(t), -.45+1.45*math.sin(t), .65*math.sin(t)+.48*math.cos(t), 1)
    points.use_cyclic_u = True
    orbit = bpy.data.objects.new('Illustrative orbit', curve)
    bpy.context.collection.objects.link(orbit)
    curve.materials.append(M['ScreenGlow'])
    text('Standby heading','EARTH / OBSERVATION',(0,-2.35,2.08),.22,'Paper')
    text('Standby label','MISSION FEED',(2.25,-2.35,1.25),.24,'Paper')
    text('Standby status','STANDBY',(2.25,-2.35,.88),.18,'ScreenGlow')
    text('Standby notice','TRAINING DISPLAY',(2.25,-2.35,-1.4),.12,'Paper')
    for j, label in enumerate(['TRAJECTORY','POWER','CONTACT']):
        z=.25-j*.46
        text('Standby channel',label,(2.25,-2.35,z),.115,'Paper')
        for i in range(10):
            box('Standby channel segment',(1.4+i*.19,-2.34,z-.15),(.12,.015,.03),'ScreenGlow' if i<7 else 'Teal',0)
    scene=render_setup(1280,720,24)
    bg=scene.world.node_tree.nodes.get('Background')
    bg.inputs['Color'].default_value=(.006,.015,.026,1)
    bg.inputs['Strength'].default_value=.25
    light('Earth soft key',(-4,-5,5),850,3,(.82,.91,1),(-1.18,0,0))
    light('Earth subtle fill',(3,-4,0),80,5,(.35,.70,1),(-1.18,0,0))
    cam=camera((0,-12,0),(0,0,0))
    cam.data.type='ORTHO'
    cam.data.ortho_scale=8.8
    scene.render.filepath=str(QA / 'mission-control-screen.png')
    bpy.ops.render.render(write_still=True)
    return Path(scene.render.filepath)


def display(name, x, y, z, width, height, variant=0):
    box(name+' bezel',(x,y,z),(width+.13,.13,height+.13),'Navy',.035)
    box(name+' screen',(x,y-.075,z),(width,.018,height),'DisplayDark',.007)
    # Small screens use original flat geometry for topology-free chart markings.
    for i in range(5):
        level=.10 + ((i*3+variant*2)%7)/9*height*.58
        box('Instrument chart bar',(x-width*.38+i*width*.16,y-.087,z-height*.31+level/2),(width*.07,.005,level),'ScreenGlow' if i%3 else 'BlueGlow',0)
    box('Instrument chart axis',(x,y-.09,z-height*.34),(width*.86,.006,.008),'Steel',0)
    box('Instrument status line',(x-width*.1,y-.09,z+height*.32),(width*.60,.006,.013),'ScreenGlow',0)
    for i in range(3):
        box('Instrument indicator',(x+width*.27+i*.045,y-.09,z+height*.32),(.018,.006,.015),'AmberGlow' if i==2 else 'BlueGlow',0)


def chair(x,y,z):
    for a in range(5):
        angle=a*math.tau/5
        end=(x+math.cos(angle)*.34,y+math.sin(angle)*.34,z+.13)
        beam('Chair five-star base',(x,y,z+.20),end,.035,'DarkSteel')
        ball('Chair castor',end,(.065,.065,.065),'Rubber',1)
    cyl('Chair column',(x,y,z+.39),.055,.43,'Steel',12)
    box('Chair cushion',(x,y,z+.66),(.54,.50,.13),'Seat',.08)
    box('Chair ergonomic back',(x,y-.23,z+1.02),(.54,.12,.57),'Seat',.075)
    box('Chair back spine',(x,y-.31,z+.96),(.13,.07,.52),'DarkSteel',.02)
    for dx in [-.32,.32]:
        beam('Chair arm support',(x+dx,y,z+.68),(x+dx,y,z+.93),.035,'DarkSteel')
        box('Chair armrest',(x+dx,y+.04,z+.94),(.075,.38,.055),'Rubber',.025)


def operator(x,y,z,index):
    outfit=['OperatorTeal','OperatorIvory','OperatorAmber','OperatorNavy'][index%4]
    skin=['SkinWarm','SkinDeep','SkinLight'][index%3]
    cone('Operator jacket',(x,y,z+1.03),.215,.265,.48,outfit,10)
    ball('Operator shoulders',(x,y,z+1.22),(.28,.14,.12),outfit,1)
    cyl('Operator collar',(x,y,z+1.32),.073,.1,skin,10)
    ball('Operator head',(x,y+.015,z+1.51),(.15,.145,.19),skin,2)
    ball('Operator hair',(x,y-.045,z+1.58),(.158,.13,.135),'Hair',1)
    # Neutral low-poly silhouettes with headphones; no real-person likenesses.
    for dx in [-.155,.155]:
        o=cyl('Headset earpiece',(x+dx,y,z+1.52),.075,.04,'Navy',12)
        o.rotation_euler.y=math.pi/2
    for side in [-1,1]:
        shoulder=(x+side*.23,y,z+1.19)
        elbow=(x+side*.31,y+.18,z+.97)
        hand=(x+side*.18,y+.62,z+1.085)
        beam('Operator upper arm',shoulder,elbow,.125,outfit)
        beam('Operator forearm',elbow,hand,.10,outfit)
        ball('Operator hand',hand,(.065,.08,.045),skin,1)
        hip=(x+side*.13,y+.03,z+.72)
        knee=(x+side*.16,y+.39,z+.57)
        ankle=(x+side*.16,y+.42,z+.17)
        beam('Operator seated thigh',hip,knee,.15,'OperatorNavy')
        beam('Operator lower leg',knee,ankle,.125,'OperatorNavy')
        box('Operator shoe',(x+side*.16,y+.51,z+.115),(.16,.29,.12),'Rubber',.035)
    box('Operator collar tab',(x+.10,y+.15,z+1.19),(.035,.013,.07),'Paper',.003)


def console(x,y,z,index):
    box('Console sculpted worktop',(x,y,z+1.04),(2.95,1.25,.14),'DeskTop',.055)
    box('Console front edge',(x,y-.64,z+1.02),(2.96,.065,.075),'Teal',.018)
    for dx in [-1.02,1.02]:
        box('Console pedestal',(x+dx,y+.08,z+.52),(.55,.87,.94),'Navy',.04)
        box('Console ventilation',(x+dx,y-.37,z+.47),(.42,.022,.29),'DarkSteel',.008)
        for i in range(4):
            box('Console grille',(x+dx,y-.39,z+.38+i*.055),(.34,.015,.016),'Steel',0)
        box('Console plinth',(x+dx,y+.08,z+.08),(.60,.93,.09),'Rubber',.02)
    for dx in [-.68,.68]:
        box('Monitor foot',(x+dx,y+.28,z+1.14),(.42,.31,.045),'Steel',.012)
        beam('Monitor stem',(x+dx,y+.29,z+1.15),(x+dx,y+.29,z+1.43),.065,'Steel')
        display('Console monitor',x+dx,y+.25,z+1.54,1.10,.64,index+(dx>0))
    box('Operator keyboard',(x,y-.32,z+1.14),(.83,.28,.035),'Navy',.009)
    for row in range(3):
        for col in range(9):
            box('Keyboard key',(x-.34+col*.084,y-.40+row*.079,z+1.165),(.065,.058,.008),'Steel',0)
    ball('Trackball',(x+.62,y-.32,z+1.155),(.09,.11,.035),'DarkSteel',1)
    box('Mission notes',(x-.98,y-.30,z+1.145),(.29,.36,.015),'Paper',.003)
    # A few solid text labels, not expensive individual key glyphs.
    label=['FLIGHT','GUIDANCE','SCIENCE','COMMS'][index%4]
    text('Console role',label,(x,y-.68,z+.91),.10,'Paper')
    chair(x,y-1.05,z)
    operator(x,y-1.05,z,index)


def build_room(screen_path):
    clear()
    ART.materials()
    for name,rgb,rough,metal in [
        ('Wall',(.31,.38,.40),.85,0),('Panel',(.12,.19,.23),.65,.15),
        ('DeskTop',(.52,.61,.61),.46,.25),('Seat',(.075,.15,.19),.85,0),
        ('DisplayDark',(.008,.026,.043),.40,.1),('Hair',(.045,.035,.027),.95,0),
        ('OperatorTeal',(.09,.33,.34),.85,0),('OperatorIvory',(.64,.69,.62),.90,0),
        ('OperatorAmber',(.58,.28,.11),.90,0),('OperatorNavy',(.07,.13,.20),.90,0),
        ('SkinWarm',(.52,.29,.16),.80,0),('SkinDeep',(.23,.105,.065),.80,0),('SkinLight',(.72,.48,.31),.80,0),
    ]:
        ART.material(name,rgb,rough,metal)
    ART.material('BlueGlow',(.13,.49,.85),.40,0,1)
    ART.material('AmberGlow',(.98,.47,.11),.40,0,1)
    box('Diorama foundation',(0,0,-.28),(20.3,18.4,.52),'DarkSteel',.14)
    box('Floor',(0,0,-.015),(19.8,18,.13),'Floor',.025)
    # Three gently stepped rows, with a central access aisle.
    for row,(y,z) in enumerate([(3.6,.03),(-.1,.28),(-3.8,.53)]):
        if row:
            box('Raised console tier',(0,y-.1,z/2),(18.7,3.5,z),'Panel',.025)
            box('Tier safety edge',(0,y-1.82,z+.015),(18.7,.045,.025),'Yellow',.004)
        for i,x in enumerate([-6.75,-2.55,2.55,6.75]):
            console(x,y,z,row*4+i)
        for x in [-.47,.47]:
            box('Central aisle marker',(x,y-.1,z+.035),(.027,3.25,.016),'Yellow',0)
        print(f'CONTROL_ROOM_ROW_READY {row+1}',flush=True)
    for x in [-8.8,8.8]:
        for y,z in [(-5.85,.37),(-2.15,.18)]:
            box('Side access step',(x,y,z/2),(.95,.65,z),'Steel',.03)
            box('Step safety strip',(x,y-.29,z+.015),(.88,.055,.02),'Yellow',.003)
    # Back-wall screen composition and ceiling perimeter; front is deliberately open.
    box('Control wall',(0,8.02,3.8),(20,.30,7.6),'Wall',.05)
    box('Control wall lower band',(0,7.83,.75),(19.8,.12,1.3),'Navy',.025)
    for x in [-9.3,-4.85,4.85,9.3]:
        box('Display wall pilaster',(x,7.76,4.25),(.13,.16,6.2),'Steel',.02)
    box('Main display frame',(0,7.72,4.60),(9.14,.23,5.28),'Navy',.065)
    box('Main display inner bezel',(0,7.58,4.60),(8.94,.06,5.08),'DarkSteel',.012)
    material=bpy.data.materials.new('MainScreenMaterial')
    material.use_nodes=True
    nodes=material.node_tree.nodes
    nodes.clear()
    output=nodes.new('ShaderNodeOutputMaterial')
    emission=nodes.new('ShaderNodeEmission')
    texture=nodes.new('ShaderNodeTexImage')
    texture.image=bpy.data.images.load(str(screen_path),check_existing=True)
    emission.inputs['Strength'].default_value=.85
    material.node_tree.links.new(texture.outputs['Color'],emission.inputs['Color'])
    material.node_tree.links.new(emission.outputs['Emission'],output.inputs['Surface'])
    main=screen_plane('MainScreen',(0,7.535,4.60),8.80,4.95,material)
    main['runtime_role']='Replace whole material with MeshBasicMaterial using mission RenderTarget.texture; placeholder uses emissiveMap.'
    main['screen_aspect']=16/9
    for side in [-1,1]:
        display('Wall status board',side*6.95,7.60,5.70,3.15,1.82,1 if side<0 else 4)
        display('Wall diagnostics',side*6.95,7.60,3.42,3.15,1.82,3 if side<0 else 2)
        text('Wall console legend','ORBITAL / SYSTEMS' if side<0 else 'FLIGHT / NETWORK',(side*6.95,7.50,2.17),.15,'Paper')
        box('Screen wall skirting',(side*6.95,7.63,1.5),(3.3,.08,.12),'Teal',.02)
    text('Control room sign','ORBITAL  /  MISSION CONTROL',(0,7.62,7.30),.24,'Paper')
    # Acoustic side walls, low cutaway on the camera side.
    box('Left wall',(-9.92,.25,3.65),(.25,15.8,7.3),'Panel',.03)
    box('Right cutaway wall',(9.92,.25,.63),(.25,15.8,1.26),'Panel',.03)
    for y in [-6,-3,0,3,6]:
        box('Left acoustic panel',(-9.75,y,3.8),(.06,2.35,3.9),'Wall',.02)
        for z in [2.3,3.1,3.9,4.7,5.5]:
            box('Acoustic trim',(-9.70,y,z),(.025,2.10,.045),'Steel',.004)
    # Ceiling is cut away, keeping geometry and light fittings visible without hiding desks.
    for x in [-9.65,9.65]:
        box('Ceiling side beam',(x,.6,7.15),(.32,15.2,.42),'DarkSteel',.03)
    for y in [-6.4,-2.7,1,4.7,7.2]:
        box('Ceiling crossbeam',(0,y,7.25),(19.4,.22,.28),'DarkSteel',.025)
        for x in [-7.1,0,7.1]:
            box('Ceiling light fixture',(x,y,7.07),(3.25,.43,.13),'Navy',.025)
            box('Ceiling light diffuser',(x,y,6.99),(3.04,.31,.025),'WarmLamp',.006)
    # Rear-of-room technical equipment gives the front cutaway a finished edge.
    for x in [-8.5,8.5]:
        box('Comms equipment rack',(x,-7.5,1.30),(1.40,.75,2.55),'Navy',.04)
        for i in range(5):
            z=.40+i*.43
            box('Rack server',(x,-7.91,z),(1.17,.055,.29),'Steel',.008)
            box('Rack server dark vent',(x-.15,-7.95,z),(.70,.015,.18),'DarkSteel',.005)
            for xx in [.36,.47]:
                box('Rack LED',(x+xx,-7.965,z),(.035,.006,.035),'ScreenGlow',0)
    # Sparse human-scale objects, kept away from camera and active main display.
    text('Front floor identifier','CONTROL  01',(0,-7.50,.08),.38,'ConcreteLight',(0,0,0))
    box('Front edge trim',(0,-9.14,-.04),(19.8,.065,.12),'Teal',.012)


def batch():
    buckets={}
    for o in list(bpy.context.scene.objects):
        if o.type=='MESH' and o.name!='MainScreen':
            buckets.setdefault(o.data.materials[0].name,[]).append(o)
    for name,objects in buckets.items():
        if len(objects)==1:
            objects[0].name='ControlRoom_'+name
            continue
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        bpy.ops.object.join()
        bpy.context.object.name='ControlRoom_'+name


def main():
    ASSETS.mkdir(parents=True,exist_ok=True)
    QA.mkdir(parents=True,exist_ok=True)
    screen=placeholder()
    build_room(screen)
    bpy.context.view_layer.update()
    batch()
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
    triangles=0
    for o in meshes:
        o.data.calc_loop_triangles()
        triangles+=len(o.data.loop_triangles)
    if triangles>120000:
        raise RuntimeError(f'Triangle budget exceeded: {triangles}')
    output=ASSETS/'mission-control.glb'
    bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',export_yup=True,export_cameras=False,export_lights=False,export_extras=True)
    stats={'file':output.name,'triangles':triangles,'meshObjects':len(meshes),'materials':len({m.name for o in meshes for m in o.data.materials}),'bytes':output.stat().st_size,'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'coordinates':'glTF Y-up, metres','sizeMetres':[20.3,7.8,18.4],'front':'+Z open','camera':[7,5,14],'lookAt':[0,2.8,-2.5],'mainScreen':{'name':'MainScreen','center':[0,4.60,-7.535],'size':[8.80,4.95],'frontNormal':[0,0,1],'uvOrigin':'glTF image convention; invert V once for WebGLRenderTarget','aspect':16/9},'originalGeometry':True,'placeholder':'Static rendered NASA Blue Marble Earth plus original standby typography; not live telemetry','earthSourceAssetSha256':hashlib.sha256((ASSETS/'earth-day.jpg').read_bytes()).hexdigest(),'notes':'Optional lazy-loaded environment; no changes to launch campus, hangar, texture files, or app code.'}
    (ASSETS/'mission-control-stats.json').write_text(json.dumps(stats,indent=2),encoding='utf-8')
    print('CONTROL_ROOM_STATS '+json.dumps(stats),flush=True)
    scene=render_setup(1500,1000,32)
    bg=scene.world.node_tree.nodes.get('Background')
    bg.inputs['Color'].default_value=(.16,.24,.32,1)
    bg.inputs['Strength'].default_value=.36
    light('Ceiling soft light',(0,-1,8.2),2200,10,(.84,.92,1),(0,1,0))
    light('Front warm fill',(5,-10,6.0),1700,8,(1,.83,.64),(0,1,2))
    light('Screen soft glow',(0,7.2,5.5),1100,7,(.45,.80,1),(0,0,2))
    light('Side fill',(-8,0,5.8),900,6,(.62,.83,1),(0,0,1.8))
    camera((7,-14,5),(0,2.5,2.8),28)
    scene.render.filepath=str(QA/'mission-control.png')
    bpy.ops.render.render(write_still=True)
    camera((0,-8.7,3.3),(0,7,4.2),24)
    scene.render.filepath=str(QA/'mission-control-operators.png')
    bpy.ops.render.render(write_still=True)


if __name__=='__main__':
    main()
