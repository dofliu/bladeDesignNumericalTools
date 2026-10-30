# Blender 4.x:匯入 rotor.stl(單位 mm)並套用材質、燈光、相機,存成 rotor.blend。Savonius 轉軸為 STL 的 Y 軸,匯入後轉 Z 向上。
# 用法:blender --background --python blender_import.py   (或在 GUI 的 Scripting 分頁執行)
import bpy, os, math
here = os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.stl_import(filepath=os.path.join(here, "rotor.stl"), global_scale=0.001)  # mm -> m
obj = bpy.context.selected_objects[0]
obj.name = "Rotor_Savonius_B3"
obj.rotation_euler = (math.radians(90), 0, 0)
bpy.ops.object.transform_apply(rotation=True)
bpy.ops.object.shade_smooth()
mat = bpy.data.materials.new("GFRP"); mat.use_nodes = True
mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.82, 0.86, 0.88, 1)
mat.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.35
obj.data.materials.append(mat)
bpy.ops.object.light_add(type="SUN", location=(3, -3, 5))
bpy.ops.object.camera_add(location=(5.5, -4.5, 2.5), rotation=(1.2, 0, 0.88))
bpy.context.scene.camera = bpy.context.object
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(here, "rotor.blend"))
