# Blender 4.x:匯入 rotor.stl(單位 mm,STL 的 Y 軸為向上),轉成 Blender 的 Z 向上,加上主軸、材質與相機。
# 用法:blender --background --python blender_import.py   (或在 GUI 的 Scripting 分頁執行)
import bpy, os
here = os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.stl_import(filepath=os.path.join(here, "rotor.stl"), global_scale=0.001,
                      forward_axis='NEGATIVE_Z', up_axis='Y')  # mm -> m,Y up -> Z up
rotor = bpy.context.selected_objects[0]
rotor.name = "Rotor_Phi_B3_R1.2"
bpy.ops.object.shade_smooth()
mat = bpy.data.materials.new("GFRP"); mat.use_nodes = True
b = mat.node_tree.nodes["Principled BSDF"]
b.inputs["Base Color"].default_value = (0.85, 0.87, 0.9, 1); b.inputs["Roughness"].default_value = 0.35
rotor.data.materials.append(mat)
bpy.ops.mesh.primitive_cylinder_add(radius=0.03, depth=2.8, location=(0, 0, 1.2))  # 主軸
bpy.context.object.name = "Shaft"
bpy.ops.object.light_add(type="SUN", location=(3, -3, 5))
bpy.ops.object.camera_add(location=(5.5, -5.5, 2.6), rotation=(1.3, 0, 0.8))
bpy.context.scene.camera = bpy.context.object
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(here, "rotor.blend"))
