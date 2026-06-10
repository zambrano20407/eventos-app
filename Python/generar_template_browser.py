"""
generar_template_browser.py
Genera una version de la plantilla PTFT38 compatible con ExcelJS
(sin imagenes embebidas que causan el error 'anchors').
Ejecutar UNA sola vez cuando cambie la plantilla.
"""
import os, shutil
import openpyxl

PYTHON_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR   = os.path.dirname(PYTHON_DIR)

ENTRADA = os.path.join(PYTHON_DIR, "Formato_PTFT38.xlsx")
SALIDA  = os.path.join(BASE_DIR,   "formato_ptft38.xlsx")

print("Cargando plantilla original...")
wb = openpyxl.load_workbook(ENTRADA)
ws = wb.active

# Eliminar imagenes embebidas (causan error en ExcelJS)
ws._images = []

# Guardar version limpia en la raiz del proyecto
wb.save(SALIDA)
print(f"✅ Plantilla browser generada: {SALIDA}")
print("   Ahora ejecute: firebase deploy --only hosting")
