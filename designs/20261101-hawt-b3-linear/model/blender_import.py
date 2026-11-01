# Blender 4.x:匯入 rotor.stl(單位 mm,轉子軸 Z)、轉為 Z 向上、套用材質並存成 rotor.blend。
# 用法:blender --background --python blender_import.py   (或在 GUI 的 Scripting 分頁執行)
# 注意:排程容器沒有 Blender,此腳本未實際執行過(需在本機執行)。
import bpy, os, math
here = os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.stl_import(filepath=os.path.join(here, "rotor.stl"), global_scale=0.001,
                      forward_axis="Y", up_axis="Z")  # mm -> m,轉子軸為 Z
obj = bpy.context.selected_objects[0]
obj.name = "Rotor_HAWT_B2_TSR9_CFRP"
bpy.ops.object.shade_smooth()
mat = bpy.data.materials.new("CFRP"); mat.use_nodes = True
b = mat.node_tree.nodes["Principled BSDF"]
b.inputs["Base Color"].default_value = (0.08, 0.08, 0.09, 1); b.inputs["Roughness"].default_value = 0.35
obj.data.materials.append(mat)
bpy.ops.object.light_add(type="SUN", location=(3, -3, 4))
bpy.ops.object.camera_add(location=(4, -4, 2.5), rotation=(1.2, 0, 0.8))
bpy.context.scene.camera = bpy.context.object
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(here, "rotor.blend"))
