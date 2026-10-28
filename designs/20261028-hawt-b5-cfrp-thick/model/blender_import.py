# Blender 4.x:Scripting 分頁開啟並執行,匯入 rotor.stl(單位 mm)、套用平滑與材質,並渲染預覽。
# 用法:blender --background --python blender_import.py   (或在 GUI 內執行)
import bpy, os
here = os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.stl_import(filepath=os.path.join(here, "rotor.stl"), global_scale=0.001)  # mm -> m
obj = bpy.context.selected_objects[0]
obj.name = "Rotor_B5_CFRP"
bpy.ops.object.shade_smooth()
mat = bpy.data.materials.new("CFRP"); mat.use_nodes = True
mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.03, 0.03, 0.035, 1)
mat.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.25
obj.data.materials.append(mat)
bpy.ops.object.light_add(type="SUN", location=(3, -3, 4))
bpy.ops.object.camera_add(location=(4.5, -1.5, 1.2), rotation=(1.35, 0, 1.2))
bpy.context.scene.camera = bpy.context.object
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(here, "rotor.blend"))
