import base64
import io
import json
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

from PIL import Image, ImageChops, ImageStat
from pypdf import PdfReader, PdfWriter
from pypdf.generic import DecodedStreamObject, NameObject, RectangleObject
from toolbox.core import collage, edit_image, pages, pdf_operation, run


def picture(color=(120, 100, 80, 255), size=(200, 100)):
    out = io.BytesIO()
    Image.new("RGBA", size, color).save(out, "PNG")
    return out.getvalue()


def document(widths=(200, 300, 400)):
    writer = PdfWriter()
    for width in widths:
        writer.add_blank_page(width=width, height=500)
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


class Images(unittest.TestCase):
    def test_crop_rotate_and_aspect_resize(self):
        data, ext = edit_image(picture(), {"crop": [10, 10, 80, 40], "rotate": 90, "width": 100})
        self.assertEqual(Image.open(io.BytesIO(data)).size, (100, 200))
        self.assertEqual(ext, "png")

    def test_transparent_brightness_and_saturation(self):
        data, _ = edit_image(picture((100, 80, 60, 77)), {"brightness": 1.5, "saturation": 0})
        pixel = Image.open(io.BytesIO(data)).getpixel((0, 0))
        self.assertEqual(pixel[3], 77)
        self.assertEqual(pixel[0], pixel[1])
        self.assertGreater(pixel[0], 100)

    def test_jpeg_alpha_has_white_background(self):
        data, _ = edit_image(picture((0, 0, 0, 0)), {"format": "jpg"})
        self.assertGreater(min(Image.open(io.BytesIO(data)).getpixel((0, 0))), 250)

    def test_invalid_crop_and_dimensions(self):
        for options in [{"crop": [190, 0, 30, 10]}, {"width": -1}, {"brightness": -1}]:
            with self.assertRaises(ValueError):
                edit_image(picture(), options)

    def test_exif_orientation_is_applied(self):
        im = Image.new("RGB", (200, 100), "red")
        exif = im.getexif(); exif[274] = 6
        out = io.BytesIO(); im.save(out, "JPEG", exif=exif)
        data, _ = edit_image(out.getvalue(), {})
        self.assertEqual(Image.open(io.BytesIO(data)).size, (100, 200))

    def test_collage_order_gap_and_background(self):
        files = [("a.png", picture((255, 0, 0, 255))), ("b.png", picture((0, 0, 255, 255))), ("c.png", picture((0, 255, 0, 255)))]
        data, _ = collage(files, {"columns": 2, "cell_width": 60, "cell_height": 40, "gap": 10, "format": "png"})
        im = Image.open(io.BytesIO(data))
        self.assertEqual(im.size, (150, 110))
        self.assertEqual(im.getpixel((0, 0)), (255, 255, 255))
        self.assertEqual(im.getpixel((20, 20)), (255, 0, 0))
        self.assertEqual(im.getpixel((90, 20)), (0, 0, 255))
        self.assertEqual(im.getpixel((20, 70)), (0, 255, 0))

    def test_collage_contain_does_not_stretch(self):
        data, _ = collage([("a", picture((255, 0, 0, 255)))], {"columns": 1, "cell_width": 100, "cell_height": 100, "gap": 0, "fit": "contain", "format": "png"})
        im = Image.open(io.BytesIO(data))
        self.assertEqual(im.getpixel((50, 0)), (255, 255, 255))
        self.assertEqual(im.getpixel((50, 50)), (255, 0, 0))

    def test_collage_defaults_to_whole_photo(self):
        data, _ = collage([("a", picture((255, 0, 0, 255)))], {"columns": 1, "cell_width": 100, "cell_height": 100, "gap": 0, "format": "png"})
        im = Image.open(io.BytesIO(data))
        self.assertEqual(im.getpixel((50, 0)), (255, 255, 255))
        self.assertEqual(im.getpixel((50, 50)), (255, 0, 0))

    def test_free_collage_positions_layers_and_individual_crop(self):
        image = Image.new("RGB", (100, 100), "red")
        image.paste(Image.new("RGB", (50, 100), "blue"), (50, 0))
        stream = io.BytesIO(); image.save(stream, "PNG")
        data, _ = collage([("a", picture((0, 255, 0, 255))), ("b", stream.getvalue())], {
            "layout": "free", "board_width": 300, "board_height": 300, "format": "png",
            "frames": [{"x": 10, "y": 10, "w": 100, "h": 100}, {"x": 50, "y": 50, "w": 100, "h": 100}],
            "crops": [None, [50, 0, 50, 100]],
        })
        im = Image.open(io.BytesIO(data))
        self.assertEqual(im.getpixel((0, 0)), (255, 255, 255))
        self.assertEqual(im.getpixel((20, 20)), (0, 255, 0))
        self.assertEqual(im.getpixel((60, 60)), (0, 0, 255))

    def test_collage_individual_crop_is_validated(self):
        with self.assertRaises(ValueError):
            collage([("a", picture())], {"crops": [[190, 0, 80, 100]]})


class PDFs(unittest.TestCase):
    def setUp(self):
        self.file = [("sample.pdf", document())]

    def test_merge_preserves_order_dimensions(self):
        data, _ = pdf_operation("pdf-merge", self.file + [("second.pdf", document((600,)))], {})
        reader = PdfReader(io.BytesIO(data))
        self.assertEqual([int(p.mediabox.width) for p in reader.pages], [200, 300, 400, 600])

    def test_extract_reorder_reverse_repeat(self):
        data, _ = pdf_operation("pdf-extract", self.file, {"pages": "3-1,2"})
        self.assertEqual([int(p.mediabox.width) for p in PdfReader(io.BytesIO(data)).pages], [400, 300, 200, 300])

    def test_delete_and_no_empty_output(self):
        data, _ = pdf_operation("pdf-delete", self.file, {"pages": "2"})
        self.assertEqual(len(PdfReader(io.BytesIO(data)).pages), 2)
        for spec in ["", "1-3"]:
            with self.assertRaises(ValueError):
                pdf_operation("pdf-delete", self.file, {"pages": spec})

    def test_rotate_only_selected_page(self):
        data, _ = pdf_operation("pdf-rotate", self.file, {"pages": "2", "angle": 90})
        self.assertEqual([p.rotation for p in PdfReader(io.BytesIO(data)).pages], [0, 90, 0])

    def test_split_zip_contents(self):
        data, filename = pdf_operation("pdf-split", self.file, {"pages": "1,3"})
        self.assertEqual(filename, "pages.zip")
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            self.assertEqual(len(archive.namelist()), 2)
            self.assertEqual(int(PdfReader(io.BytesIO(archive.read(archive.namelist()[1]))).pages[0].mediabox.width), 400)

    def test_crop_selected_and_preserves_original_media(self):
        data, _ = pdf_operation("pdf-crop", self.file, {"pages": "1", "margin_mm": 5})
        reader = PdfReader(io.BytesIO(data))
        self.assertAlmostEqual(float(reader.pages[0].cropbox.width), 200 - 10 * 72 / 25.4, places=4)
        self.assertEqual(float(reader.pages[0].mediabox.width), 200)
        self.assertEqual(float(reader.pages[1].cropbox.width), 300)

    def test_invalid_range(self):
        for spec in ["0", "4", "1,,2", "1-x", "-1"]:
            with self.assertRaises(ValueError):
                pages(spec, 3)

    def test_images_to_pdf_and_optimize(self):
        data, _ = pdf_operation("images-pdf", [("a.png", picture()), ("b.png", picture())], {})
        self.assertEqual(len(PdfReader(io.BytesIO(data)).pages), 2)
        optimized, _ = pdf_operation("pdf-optimize", [("photo.pdf", data)], {})
        self.assertEqual(len(PdfReader(io.BytesIO(optimized)).pages), 2)

    def test_encrypted_file_rejected(self):
        writer = PdfWriter(); writer.add_blank_page(200, 300); writer.encrypt("secret")
        stream = io.BytesIO(); writer.write(stream)
        with self.assertRaisesRegex(ValueError, "密码"):
            run("pdf-info", [("locked.pdf", stream.getvalue())])

    def test_result_preview_tracks_rotation_crop_and_order(self):
        result = run("pdf-preview", self.file, {"operation": "pdf-extract", "pages": "3,1", "page": 1})
        self.assertEqual(result["pages"], 2)
        self.assertEqual(result["width"], 200)
        image = Image.open(io.BytesIO(base64.b64decode(result["data"])))
        self.assertGreater(image.height, image.width)
        rotated = run("pdf-preview", self.file, {"operation": "pdf-rotate", "pages": "1", "angle": 90})
        self.assertEqual(rotated["width"], 500)
        cropped = run("pdf-preview", self.file, {"operation": "pdf-crop", "margin_mm": 5})
        self.assertLess(cropped["width"], 200)

    def test_preview_split_and_invalid_page_setting(self):
        result = run("pdf-preview", self.file, {"operation": "pdf-split", "pages": "2-3", "page": 99})
        self.assertEqual(result["page"], 1)
        self.assertEqual(result["pages"], 2)
        with self.assertRaises(ValueError):
            run("pdf-preview", self.file, {"operation": "pdf-delete", "pages": "1-3"})

    def test_free_crop_targets_and_validation(self):
        data, _ = pdf_operation("pdf-free-crop", self.file, {"pages": "2", "rect": [.1, .2, .5, .6]})
        reader = PdfReader(io.BytesIO(data))
        self.assertEqual(tuple(reader.pages[0].cropbox), (0, 0, 200, 500))
        self.assertEqual(tuple(reader.pages[1].cropbox), (30, 100, 180, 400))
        self.assertEqual(tuple(reader.pages[1].mediabox), (0, 0, 300, 500))
        for rect in [None, [], [0, 0, 0, 1], [-.1, 0, .5, .5], [.5, 0, .6, 1], [float('nan'), 0, 1, 1]]:
            with self.subTest(rect=rect), self.assertRaises((ValueError, TypeError)):
                pdf_operation("pdf-free-crop", self.file, {"rect": rect})

    def test_free_crop_pixels_match_displayed_selection_for_all_rotations(self):
        for rotation in [0, 90, 180, 270]:
            with self.subTest(rotation=rotation):
                writer = PdfWriter(); page = writer.add_blank_page(200, 120)
                page.mediabox = RectangleObject((40, 70, 240, 190))
                page.cropbox = RectangleObject((60, 80, 220, 180))
                stream = DecodedStreamObject()
                stream.set_data(b"1 0 0 rg 40 70 100 60 re f\n0 1 0 rg 140 70 100 60 re f\n0 0 1 rg 40 130 100 60 re f\n1 1 0 rg 140 130 100 60 re f\n")
                page[NameObject('/Contents')] = writer._add_object(stream)
                page.rotate(rotation)
                buf = io.BytesIO(); writer.write(buf)
                files = [('quadrants.pdf', buf.getvalue())]
                baseline = run('pdf-preview', files, {'operation': 'pdf-merge'})
                cropped = run('pdf-preview', files, {'operation': 'pdf-free-crop', 'rect': [.25, .2, .5, .6]})
                before = Image.open(io.BytesIO(base64.b64decode(baseline['data']))).convert('RGB')
                after = Image.open(io.BytesIO(base64.b64decode(cropped['data']))).convert('RGB')
                W, H = before.size
                expected = before.crop((round(W*.25), round(H*.2), round(W*.75), round(H*.8)))
                expected = expected.resize(after.size)
                self.assertLess(max(ImageStat.Stat(ImageChops.difference(expected, after)).mean), 2)

    def test_free_crop_can_accumulate_after_rotation_and_crop(self):
        steps = [{'action': 'pdf-rotate', 'options': {'angle': 90}},
                 {'action': 'pdf-free-crop', 'options': {'rect': [0, 0, .5, 1]}},
                 {'action': 'pdf-free-crop', 'options': {'rect': [0, 0, .5, 1]}}]
        result = run('pdf-preview', self.file, {'operation': 'pdf-pipeline', 'steps': steps})
        self.assertAlmostEqual(result['width'], 125)
        self.assertAlmostEqual(result['height'], 200)

    def test_pdf_pipeline_accumulates_operations(self):
        steps = [
            {"action": "pdf-extract", "options": {"pages": "3,1"}},
            {"action": "pdf-rotate", "options": {"pages": "2", "angle": 90}},
            {"action": "pdf-crop", "options": {"pages": "1", "margin_mm": 5}},
        ]
        result = run("pdf-pipeline", self.file, {"steps": steps})
        reader = PdfReader(io.BytesIO(base64.b64decode(result["data"])))
        self.assertEqual([int(p.mediabox.width) for p in reader.pages], [400, 200])
        self.assertEqual([p.rotation for p in reader.pages], [0, 90])
        self.assertLess(float(reader.pages[0].cropbox.width), 400)
        preview = run("pdf-preview", self.file, {"operation": "pdf-pipeline", "steps": steps, "page": 1})
        self.assertEqual(preview["pages"], 2)
        self.assertEqual(preview["width"], 500)

    def test_pipeline_split_is_last_and_can_be_previewed(self):
        steps = [{"action": "pdf-rotate", "options": {"angle": 90}}, {"action": "pdf-split", "options": {"pages": "1-2"}}]
        result = run("pdf-pipeline", self.file, {"steps": steps})
        self.assertEqual(result["name"], "pages.zip")
        preview = run("pdf-preview", self.file, {"operation": "pdf-pipeline", "steps": steps})
        self.assertEqual(preview["pages"], 2)
        with self.assertRaises(ValueError):
            run("pdf-pipeline", self.file, {"steps": steps + [{"action": "pdf-delete", "options": {"pages": "1"}}]})

    def test_cli_output_guard_and_json(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "sample.pdf"; path.write_bytes(self.file[0][1])
            output = Path(tmp) / "result.pdf"
            args = [sys.executable, "-m", "toolbox.cli", "pdf-extract", str(path), "-o", str(output), "--options", '{"pages":"2"}']
            first = subprocess.run(args, capture_output=True, text=True)
            self.assertEqual(first.returncode, 0, first.stderr)
            self.assertEqual(Path(json.loads(first.stdout)["output"]).resolve(), output.resolve())
            self.assertEqual(int(PdfReader(output).pages[0].mediabox.width), 300)
            second = subprocess.run(args, capture_output=True, text=True)
            self.assertNotEqual(second.returncode, 0)
            self.assertIn("已存在", second.stderr)


if __name__ == "__main__":
    unittest.main()
