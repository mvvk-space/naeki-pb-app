"""
Glitch Pulse — a custom VSE "effect" for Blender 5.2+ (works on 5.0/5.1 too)

Adds a compositor-based strip modifier that applies a randomized RGB-split
glitch to a strip. The glitch "pulses": bursts fire at random intervals,
each burst strobing with a randomized block-displacement pattern.

Usage (UI):
  1. Scripting workspace -> Text editor -> open/paste this file -> Run
  2. In the Video Sequencer, select the strip(s) you want to glitch
  3. Sequencer sidebar (N) -> "Glitch Pulse" tab -> tweak -> "Add Glitch Pulse"
  4. Tweak live: select the strip -> Modifiers panel -> expand "Glitch Pulse"
     -> open the node group (Int/Split/Density/Slice/Seed are group inputs;
        the pulse envelope lives as keyframes on Intensity + Seed)

Usage (scripting):
    import glitch_pulse
    glitch_pulse.apply_to_selected(seed=1234)

Notes
- Randomness is baked into keyframes (deterministic): preview == render,
  and you can edit every burst afterwards.
- If the "Image Coordinates"/White Noise nodes are missing (pre-4.5 Blender),
  the script automatically falls back to split+jump+blur without blocks.
"""
import bpy
import random

MOD_NAME = "Glitch Pulse"
GROUP_NAME = "Glitch Pulse FX"

# --- node type candidates (names differ across versions) --------------------
NT_COORDS = ["CompositorNodeImageCoordinates", "CompositorNodeCoords"]
NT_DISPLACE = ["CompositorNodeDisplace"]
NT_TRANSLATE = ["CompositorNodeTranslate"]
NT_DIRBLUR = ["CompositorNodeDirectionalBlur"]
NT_GROUP = ["CompositorNodeGroup"]
SH_SEP = "ShaderNodeSeparateColor"
SH_COMB = "ShaderNodeCombineColor"
SH_MATH = "ShaderNodeMath"
SH_SEPX = "ShaderNodeSeparateXYZ"
SH_COMX = "ShaderNodeCombineXYZ"
SH_MIX = "ShaderNodeMix"
SH_RGB = "ShaderNodeRGB"
SH_WN = "ShaderNodeTexWhiteNoise"
SH_CLAMP = "ShaderNodeClamp"


def new_node(tree, types, x=0, y=0, label=None):
    if isinstance(types, str):
        types = [types]
    for t in types:
        try:
            n = tree.nodes.new(t)
            break
        except Exception:
            n = None
    if n is None:
        raise RuntimeError(f"no node of types {types} available")
    n.location = (x, y)
    if label:
        n.label = label
    return n


def mathn(tree, op, x, y, label=None):
    n = new_node(tree, SH_MATH, x, y, label)
    n.operation = op
    return n


def sock(node, ident, out=False, fallback_index=0):
    coll = node.outputs if out else node.inputs
    for s in coll:
        if s.identifier == ident:
            return s
    for s in coll:
        if s.name == ident:
            return s
    return coll[min(fallback_index, len(coll) - 1)]


# ----------------------------------------------------------------------------
# The node group
# ----------------------------------------------------------------------------
def build_glitch_group(name):
    tree = bpy.data.node_groups.new(name, 'CompositorNodeTree')
    iface = tree.interface
    iface.new_socket("Image", in_out='INPUT', socket_type='NodeSocketColor')
    specs = [("Intensity", 0.0, 0.0, 1.0), ("Split", 18.0, 0.0, 400.0),
             ("Density", 0.35, 0.0, 1.0), ("Slice Height", 120.0, 4.0, 1000.0),
             ("Seed", 0.0, 0.0, 100000.0)]
    for nm, dv, mn, mx in specs:
        s = iface.new_socket(nm, in_out='INPUT', socket_type='NodeSocketFloat')
        s.default_value, s.min_value, s.max_value = dv, mn, mx
    iface.new_socket("Image", in_out='OUTPUT', socket_type='NodeSocketColor')

    gin = new_node(tree, 'NodeGroupInput', -1200, 0)
    gout = new_node(tree, 'NodeGroupOutput', 1200, 0)
    img = gin.outputs[0]
    inten = sock(gin, "Intensity", out=True, fallback_index=1)
    split = sock(gin, "Split", out=True, fallback_index=2)
    dens = sock(gin, "Density", out=True, fallback_index=3)
    slice_h = sock(gin, "Slice Height", out=True, fallback_index=4)
    seed_o = sock(gin, "Seed", out=True, fallback_index=5)

    # intensity curve: sharpen pulses  (i^1.6)
    ipow = mathn(tree, 'POWER', -1000, 300, "Punch")
    tree.links.new(inten, ipow.inputs[0])
    ipow.inputs[2].default_value = 1.6

    image = img
    blocks_ok = True
    # ---------------- randomized horizontal block displacement --------------
    try:
        coords = new_node(tree, NT_COORDS, -1200, -300, "Pixel coords")
        vec_out = None
        for o in coords.outputs:
            if o.type == 'VECTOR':
                vec_out = o
                break
        if vec_out is None:
            raise RuntimeError("no vector output on coordinates node")
        sxyz = new_node(tree, SH_SEPX, -1000, -300)
        tree.links.new(vec_out, sxyz.inputs[0])
        div = mathn(tree, 'DIVIDE', -840, -340)
        tree.links.new(sxyz.outputs[1], div.inputs[0])
        tree.links.new(slice_h, div.inputs[1])
        flr = mathn(tree, 'FLOOR', -680, -340)
        tree.links.new(div.outputs[0], flr.inputs[0])
        mulh = mathn(tree, 'MULTIPLY', -520, -340)
        tree.links.new(flr.outputs[0], mulh.inputs[0])
        tree.links.new(slice_h, mulh.inputs[1])
        rowq = mulh.outputs[0]

        # per-row random gate + amount, re-rolled by Seed
        seedoff = mathn(tree, 'MULTIPLY', -680, -500)
        tree.links.new(seed_o, seedoff.inputs[0])
        seedoff.inputs[1].default_value = 7919.0
        rvec = new_node(tree, SH_COMX, -360, -420)
        tree.links.new(rowq, rvec.inputs[0])
        tree.links.new(seedoff.outputs[0], rvec.inputs[1])
        wn_gate = new_node(tree, SH_WN, -200, -420, "Row gate")
        try:
            wn_gate.dimensions = '3D'
        except Exception:
            pass
        tree.links.new(rvec.outputs[0], sock(wn_gate, "Vector", fallback_index=0))
        thr = mathn(tree, 'SUBTRACT', -40, -300)
        thr.inputs[0].default_value = 1.0
        tree.links.new(dens, thr.inputs[1])
        gate = mathn(tree, 'GREATER_THAN', 120, -360)
        tree.links.new(sock(wn_gate, "Value", out=True, fallback_index=0), gate.inputs[0])
        tree.links.new(thr.outputs[0], gate.inputs[1])

        seedoff2 = mathn(tree, 'MULTIPLY_ADD', -680, -620)
        tree.links.new(seed_o, seedoff2.inputs[0])
        seedoff2.inputs[1].default_value = 104729.0
        seedoff2.inputs[2].default_value = 3.5
        rvec2 = new_node(tree, SH_COMX, -360, -620)
        tree.links.new(rowq, rvec2.inputs[0])
        tree.links.new(seedoff2.outputs[0], rvec.inputs[1])
        wn_amt = new_node(tree, SH_WN, -200, -620, "Row amount")
        try:
            wn_amt.dimensions = '3D'
        except Exception:
            pass
        tree.links.new(rvec.outputs[0], sock(wn_amt, "Vector", fallback_index=0))
        amt = mathn(tree, 'MULTIPLY_ADD', 120, -560, "-1..1")
        tree.links.new(sock(wn_amt, "Value", out=True, fallback_index=0), amt.inputs[0])
        amt.inputs[1].default_value = 2.0
        amt.inputs[2].default_value = -1.0
        m1 = mathn(tree, 'MULTIPLY', 280, -480)
        tree.links.new(gate.outputs[0], m1.inputs[0])
        tree.links.new(amt.outputs[0], m1.inputs[1])
        m2 = mathn(tree, 'MULTIPLY', 440, -480)
        tree.links.new(m1.outputs[0], m2.inputs[0])
        tree.links.new(slice_h, m2.inputs[1])
        dx = mathn(tree, 'MULTIPLY', 600, -480)
        tree.links.new(m2.outputs[0], dx.inputs[0])
        tree.links.new(ipow.outputs[0], dx.inputs[1])
        dy = mathn(tree, 'MULTIPLY', 600, -620)
        tree.links.new(dx.outputs[0], dy.inputs[0])
        dy.inputs[1].default_value = 0.25
        dvec = new_node(tree, SH_COMX, 760, -540)
        tree.links.new(dx.outputs[0], dvec.inputs[0])
        tree.links.new(dy.outputs[0], dvec.inputs[1])
        displace = new_node(tree, NT_DISPLACE, 920, -200, "Block glitch")
        displace.inputs["Scale"].default_value = 1.0
        tree.links.new(image, sock(displace, "Image", fallback_index=0))
        tree.links.new(dvec.outputs[0], sock(displace, "Vector", fallback_index=1))
        image = displace.outputs[0]
    except Exception as e:
        print(f"[Glitch Pulse] block displacement disabled ({e})")
        blocks_ok = False

    # ---------------- RGB split (blue/red channel offset) -------------------
    sep = new_node(tree, SH_SEP, 1100, 300)
    tree.links.new(image, sep.inputs[0])
    mono_r = new_node(tree, SH_COMB, 1260, 420)
    tree.links.new(sep.outputs[0], mono_r.inputs[0])
    tree.links.new(sep.outputs[3], mono_r.inputs[3])
    mono_b = new_node(tree, SH_COMB, 1260, 180)
    tree.links.new(sep.outputs[2], mono_b.inputs[2])
    tree.links.new(sep.outputs[3], mono_b.inputs[3])
    dxs = mathn(tree, 'MULTIPLY', 1100, 60, "Split px")
    tree.links.new(split, dxs.inputs[0])
    tree.links.new(ipow.outputs[0], dxs.inputs[1])
    dx1 = mathn(tree, 'MULTIPLY', 1260, 60)
    tree.links.new(dxs.outputs[0], dx1.inputs[0])
    dx1.inputs[1].default_value = 1.0
    dx2 = mathn(tree, 'MULTIPLY', 1260, -60)
    tree.links.new(dxs.outputs[0], dx2.inputs[0])
    dx2.inputs[1].default_value = -1.0
    tr = new_node(tree, NT_TRANSLATE, 1420, 420)
    tree.links.new(mono_r.outputs[0], tr.inputs[0])
    tree.links.new(dx1.outputs[0], sock(tr, "X", fallback_index=1))
    tb = new_node(tree, NT_TRANSLATE, 1420, 180)
    tree.links.new(mono_b.outputs[0], tb.inputs[0])
    tree.links.new(dx2.outputs[0], sock(tb, "X", fallback_index=1))
    sep_r = new_node(tree, SH_SEP, 1580, 420)
    tree.links.new(tr.outputs[0], sep_r.inputs[0])
    sep_b = new_node(tree, SH_SEP, 1580, 180)
    tree.links.new(tb.outputs[0], sep_b.inputs[0])
    glitched = new_node(tree, SH_COMB, 1740, 300)
    tree.links.new(sep_r.outputs[0], glitched.inputs[0])   # shifted red
    tree.links.new(sep.outputs[1], glitched.inputs[1])     # untouched green
    tree.links.new(sep_b.outputs[2], glitched.inputs[2])   # shifted blue
    tree.links.new(sep.outputs[3], glitched.inputs[3])     # original alpha

    # ---------------- pulse smear ------------------------------------------
    blur = None
    try:
        blur = new_node(tree, NT_DIRBLUR, 1900, 80, "Smear")
        tree.links.new(glitched.outputs[0], blur.inputs[0])
        bd = mathn(tree, 'MULTIPLY', 1740, -80)
        tree.links.new(ipow.outputs[0], bd.inputs[0])
        bd.inputs[1].default_value = 12.0
        tree.links.new(bd.outputs[0], sock(blur, "Distance", fallback_index=1))
    except Exception as e:
        print(f"[Glitch Pulse] smear disabled ({e})")

    out_img = glitched.outputs[0]
    if blur is not None:
        mix = new_node(tree, SH_MIX, 2060, 200, "Smear mix")
        try:
            mix.data_type = 'RGBA'
            mix.blend_type = 'MIX'
        except Exception:
            pass
        try:
            mix.inputs[0].default_value = 0.0
        except Exception:
            pass
        tree.links.new(ipow.outputs[0], sock(mix, "Factor", fallback_index=0))
        tree.links.new(glitched.outputs[0], sock(mix, "A_Color", fallback_index=6))
        tree.links.new(blur.outputs[0], sock(mix, "B_Color", fallback_index=7))
        out_img = sock(mix, "Result_Color", out=True, fallback_index=0)

    tree.links.new(out_img, gout.inputs[0])
    return tree


def build_wrapper(group_tree, name):
    """Modifier-facing tree: lets us keyframe per-strip without touching the
    shared effect group."""
    w = bpy.data.node_groups.new(name, 'CompositorNodeTree')
    iface = w.interface
    iface.new_socket("Image", in_out='INPUT', socket_type='NodeSocketColor')
    iface.new_socket("Image", in_out='OUTPUT', socket_type='NodeSocketColor')
    gin = new_node(w, 'NodeGroupInput', -400, 0)
    gout = new_node(w, 'NodeGroupOutput', 400, 0)
    g = new_node(w, NT_GROUP, 0, 0)
    g.node_tree = group_tree
    w.links.new(gin.outputs[0], g.inputs[0])
    w.links.new(g.outputs[0], gout.inputs[0])
    return w, g


NT_GROUP = ["CompositorNodeGroup"]


# ----------------------------------------------------------------------------
# The pulse schedule (keyframed randomness)
# ----------------------------------------------------------------------------
def schedule(strip, scene, p, idx_intensity, idx_seed):
    fps = scene.render.fps / max(scene.render.fps_base, 1e-6)
    f0, f1 = strip.frame_final_start, strip.frame_final_end
    keys = []
    t = f0 + int(random.uniform(0.3, 1.5) * fps)
    while t < f1 - 4:
        peak = random.uniform(0.6, 1.0)
        length = max(2, int(random.uniform(0.05, 0.4) * fps))
        end = min(t + length, f1 - 1)
        keys.append((t, idx_intensity, 0.0))
        keys.append((t, idx_seed, random.uniform(0, 100000)))
        jf = t + 1
        while jf < end:
            keys.append((jf, idx_intensity, peak * random.uniform(0.35, 1.0)))
            keys.append((jf, idx_seed, random.uniform(0, 100000)))
            jf += random.randint(1, 3)
        keys.append((end, idx_intensity, 0.0))
        keys.append((end, idx_seed, random.uniform(0, 100000)))
        t = end + int(random.uniform(p.min_gap, p.max_gap) * fps)
    return keys


def apply_to_strip(strip, scene, p):
    for m in list(getattr(strip, "modifiers", [])):
        if m.name == MOD_NAME:
            strip.modifiers.remove(m)

    group = build_glitch_group(f"{GROUP_NAME} {p.seed}")
    wrapper, gnode = build_wrapper(group, f"{GROUP_NAME} inst {p.seed}")
    idx_i, idx_s = 1, 5  # Intensity / Seed socket indices on the group node

    keys = schedule(strip, scene, p, idx_i, idx_s)
    if not keys:
        return 0
    for f, idx, val in keys:
        s = gnode.inputs[idx]
        s.default_value = val
        s.keyframe_insert("default_value", frame=f, group=MOD_NAME)

    # envelope + micro-shimmer: noise F-modifier on the intensity curve
    try:
        ad = wrapper.animation_data_create()
        act = ad.action
        for fc in act.fcurves:
            if f"inputs[{idx_i}]" in fc.data_path:
                for kp in fc.keyframe_points:
                    kp.interpolation = 'CONSTANT'
                fm = fc.modifiers.new('NOISE')
                fm.scale = 18.0
                fm.strength = 0.07 if p.base_jitter else 0.0
                fm.phase = random.uniform(0, 1000)
                try:
                    fm.blend_type = 'ADD'
                except Exception:
                    pass
                break
    except Exception as e:
        print(f"[Glitch Pulse] no noise shimmer ({e})")

    mod = strip.modifiers.new(MOD_NAME, 'COMPOSITOR')
    mod.node_group = wrapper
    mod.show_expanded = True
    return len(keys)


def target_strips(context):
    scene = context.scene
    ed = scene.sequence_editor
    if not ed:
        return []
    sel = getattr(context, "selected_strips", None)
    if sel is None:
        sel = getattr(context, "selected_sequences", [])
    if sel:
        return [s for s in sel if hasattr(s, "modifiers")]
    all_strips = getattr(ed, "strips_all", None)
    if all_strips is None:
        all_strips = getattr(ed, "sequences_all", [])
    ok = {'MOVIE', 'IMAGE', 'SCENE', 'META', 'COLOR'}
    return [s for s in all_strips if s.type in ok]


def apply_op(self, context):
    random.seed(self.seed)
    strips = target_strips(context)
    if not strips:
        self.report({'WARNING'}, "No visual strips selected (select strips in the sequencer)")
        return {'CANCELLED'}
    total = 0
    for s in strips:
        try:
            total += apply_to_strip(s, context.scene, self)
        except Exception as e:
            self.report({'ERROR'}, f"{s.name}: {e}")
            return {'CANCELLED'}
    self.report({'INFO'}, f"Glitch added to {len(strips)} strip(s): "
                          f"{total} pulse keyframes, seed {self.seed}")
    return {'FINISHED'}


# ----------------------------------------------------------------------------
# Operator + panel
# ----------------------------------------------------------------------------
class SEQUENCER_OT_glitch_pulse(bpy.types.Operator):
    bl_idname = "vse.glitch_pulse"
    bl_label = "Add Glitch Pulse"
    bl_description = "Randomized blue/red glitch that pulses at random intervals"
    bl_options = {'REGISTER', 'UNDO'}

    seed: bpy.props.IntProperty(name="Seed", default=1)
    min_gap: bpy.props.FloatProperty(name="Min gap (s)", default=1.2, min=0.2)
    max_gap: bpy.props.FloatProperty(name="Max gap (s)", default=4.0, min=0.3)
    split: bpy.props.FloatProperty(name="RGB split (px)", default=18.0, min=0)
    density: bpy.props.FloatProperty(name="Block density", default=0.35, min=0, max=1)
    slice_height: bpy.props.FloatProperty(name="Slice height (px)", default=120.0, min=4)
    base_jitter: bpy.props.BoolProperty(name="Base jitter between pulses", default=True)

    def execute(self, context):
        return apply_op(self, context)


class SEQUENCER_PT_glitch_pulse(bpy.types.Panel):
    bl_label = "Glitch Pulse"
    bl_space_type = 'SEQUENCE_EDITOR'
    bl_region_type = 'UI'
    bl_category = "Effects"

    def draw(self, context):
        lay = self.layout
        c = lay.column(align=True)
        c.prop(context.scene, "glitch_seed")
        c.prop(context.scene, "glitch_min_gap")
        c.prop(context.scene, "glitch_max_gap")
        c.prop(context.scene, "glitch_split")
        c.prop(context.scene, "glitch_density")
        c.prop(context.scene, "glitch_slice")
        c.prop(context.scene, "glitch_base_jitter")
        lay.operator("vse.glitch_pulse", icon='FULLSCREEN_ENTER')


def _scene_props():
    bpy.types.Scene.glitch_seed = bpy.props.IntProperty(name="Seed", default=1)
    bpy.types.Scene.glitch_min_gap = bpy.props.FloatProperty(name="Min gap (s)", default=1.0, min=0.2)
    bpy.types.Scene.glitch_max_gap = bpy.props.FloatProperty(name="Max gap (s)", default=4.0, min=0.3)
    bpy.types.Scene.glitch_split = bpy.props.FloatProperty(name="RGB split (px)", default=18.0, min=0)
    bpy.types.Scene.glitch_density = bpy.props.FloatProperty(name="Block density", default=0.35, min=0, max=1)
    bpy.types.Scene.glitch_slice = bpy.props.FloatProperty(name="Slice height (px)", default=120.0, min=4)
    bpy.types.Scene.glitch_base_jitter = bpy.props.BoolProperty(name="Base jitter", default=True)


def _apply_from_scene(self, context):
    class P:
        pass
    p = P()
    sc = context.scene
    p.seed, p.min_gap, p.max_gap = sc.glitch_seed, sc.glitch_min_gap, sc.glitch_max_gap
    p.split, p.density, p.slice_height = sc.glitch_split, sc.glitch_density, sc.glitch_slice
    p.base_jitter = sc.glitch_base_jitter
    random.seed(p.seed)
    strips = target_strips(context)
    if not strips:
        self.report({'WARNING'}, "Select a visual strip in the sequencer first")
        return {'CANCELLED'}
    total = 0
    for s in strips:
        try:
            total += apply_to_strip(s, context.scene, p)
        except Exception as e:
            self.report({'ERROR'}, f"{s.name}: {e}")
            return {'CANCELLED'}
    self.report({'INFO'}, f"Glitch on {len(strips)} strip(s), {total} pulse keys, seed {p.seed}")
    return {'FINISHED'}


def register():
    _scene_props()
    bpy.utils.register_class(SEQUENCER_OT_glitch_pulse)
    bpy.utils.register_class(SEQUENCER_PT_glitch_pulse)


def unregister():
    bpy.utils.unregister_class(SEQUENCER_PT_glitch_pulse)
    bpy.utils.unregister_class(SEQUENCER_OT_glitch_pulse)


if __name__ == "__main__":
    register()
