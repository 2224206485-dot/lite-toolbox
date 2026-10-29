"""Exercise real packaged binaries without opening a GUI."""
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image
from pypdf import PdfReader, PdfWriter

root = Path(__file__).resolve().parents[1]
binary = (root / 'dist/LiteToolbox.app/Contents/MacOS/LiteToolbox' if sys.platform == 'darwin'
          else root / 'dist/LiteToolbox/LiteToolbox.exe')
if not binary.exists():
    raise SystemExit(f'Packaged app missing: {binary}')

with tempfile.TemporaryDirectory() as folder:
    temp = Path(folder)
    photo = temp / 'input.png'
    Image.new('RGB', (200, 120), 'red').save(photo)
    image_out = temp / 'cropped.png'
    subprocess.run([str(binary), '--cli', 'image-edit', str(photo), '-o', str(image_out),
                    '--options', '{"crop":[10,10,100,80]}'], check=True, timeout=90)
    with Image.open(image_out) as image:
        assert image.size == (100, 80)
    writer = PdfWriter(); writer.add_blank_page(200, 300)
    pdf = temp / 'input.pdf'
    writer.write(pdf)
    pdf_out = temp / 'result.pdf'
    subprocess.run([str(binary), '--cli', 'pdf-pipeline', str(pdf), '-o', str(pdf_out), '--options',
                    '{"steps":[{"action":"pdf-rotate","options":{"angle":90}},{"action":"pdf-free-crop","options":{"rect":[0,0,0.5,1]}}]}'],
                   check=True, timeout=90)
    page = PdfReader(pdf_out).pages[0]
    assert page.rotation == 90
    assert abs(float(page.cropbox.height) - 150) < .01
    preview = temp / 'preview.png'
    subprocess.run([str(binary), '--cli', 'pdf-preview', str(pdf_out), '-o', str(preview)], check=True, timeout=90)
    with Image.open(preview) as image:
        assert image.width > 0 and image.height > 0
print('Packaged image / PDF processing and preview passed.')
