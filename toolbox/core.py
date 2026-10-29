from __future__ import annotations

import base64
import io
import math
import zipfile
import threading
import hashlib
from pathlib import Path

from PIL import Image, ImageColor, ImageEnhance, ImageOps
from pypdf import PdfReader, PdfWriter

MAX_PIXELS = 40_000_000
MAX_INPUT = 120 * 1024 * 1024
_preview_lock = threading.Lock()
_preview_cache = {}


def pages(spec: str, count: int) -> list[int]:
    """User-facing page numbers are one-based; preserve order and repetitions."""
    if not spec or not spec.strip():
        return list(range(count))
    result = []
    for part in spec.replace("，", ",").split(","):
        part = part.strip()
        if "-" in part:
            a, b = (int(x.strip()) for x in part.split("-", 1))
            step = 1 if b >= a else -1
            selected = range(a, b + step, step)
        else:
            selected = [int(part)]
        for n in selected:
            if not 1 <= n <= count:
                raise ValueError(f"页码 {n} 超出范围（共 {count} 页）")
            result.append(n - 1)
    if not result:
        raise ValueError("请至少选择一页")
    return result


def open_pdf(data: bytes) -> PdfReader:
    reader = PdfReader(io.BytesIO(data), strict=False)
    if reader.is_encrypted and reader.decrypt("") == 0:
        raise ValueError("此 PDF 需要密码，请先使用原软件解除密码保护")
    if not len(reader.pages):
        raise ValueError("PDF 中没有页面")
    return reader


def open_image(data: bytes) -> Image.Image:
    with Image.open(io.BytesIO(data)) as original:
        check_size(original.width, original.height)
        original.seek(0)
        return ImageOps.exif_transpose(original).convert("RGBA")


def check_size(w: int, h: int):
    if w < 1 or h < 1 or w * h > MAX_PIXELS:
        raise ValueError("图片尺寸须大于零，且不超过 4000 万像素")


def encode_image(image: Image.Image, fmt="png", quality=90) -> tuple[bytes, str]:
    fmt = fmt.lower()
    if fmt not in {"png", "jpg", "jpeg", "webp"}:
        raise ValueError("导出格式仅支持 PNG、JPEG 和 WebP")
    out = io.BytesIO()
    if fmt in {"jpg", "jpeg"}:
        background = Image.new("RGB", image.size, "white")
        if image.mode == "RGBA":
            background.paste(image, mask=image.getchannel("A"))
        else:
            background.paste(image.convert("RGB"))
        background.save(out, "JPEG", quality=int(quality), optimize=True)
        fmt = "jpg"
    else:
        image.save(out, fmt.upper(), **({"quality": int(quality)} if fmt == "webp" else {}))
    return out.getvalue(), fmt


def edit_image(data: bytes, options: dict) -> tuple[bytes, str]:
    im = open_image(data)
    if options.get("crop"):
        x, y, w, h = (int(v) for v in options["crop"])
        if x < 0 or y < 0 or w <= 0 or h <= 0 or x + w > im.width or y + h > im.height:
            raise ValueError("裁剪框超出图片边界")
        im = im.crop((x, y, x + w, y + h))
    if options.get("rotate"):
        angle = int(options["rotate"])
        if angle % 90:
            raise ValueError("旋转角度须为 90 的倍数")
        im = im.rotate(-angle, expand=True)
    alpha = im.getchannel("A")
    rgb = im.convert("RGB")
    for key, enhancer in [("brightness", ImageEnhance.Brightness), ("contrast", ImageEnhance.Contrast), ("saturation", ImageEnhance.Color)]:
        value = float(options.get(key, 1))
        if not math.isfinite(value) or not 0 <= value <= 3:
            raise ValueError("亮度、对比度与饱和度须为 0 到 3")
        rgb = enhancer(rgb).enhance(value)
    rgb.putalpha(alpha)
    im = rgb
    if options.get("width"):
        w = int(options["width"])
        h = max(1, round(im.height * w / im.width))
        check_size(w, h)
        im = im.resize((w, h), Image.Resampling.LANCZOS)
    return encode_image(im, options.get("format", "png"), options.get("quality", 90))


def collage(files: list[tuple[str, bytes]], options: dict) -> tuple[bytes, str]:
    if not files or len(files) > 30:
        raise ValueError("请添加 1 到 30 张照片")
    if options.get("layout") == "free":
        w, h = int(options.get("board_width", 1600)), int(options.get("board_height", 1000))
        check_size(w, h)
        canvas = Image.new("RGB", (w, h), ImageColor.getrgb(options.get("background", "#ffffff")))
        frames = options.get("frames", [])
        if len(frames) != len(files):
            raise ValueError("照片排版信息不完整")
        for index, ((_, data), frame) in enumerate(zip(files, frames)):
            x, y, fw, fh = (int(round(float(frame[k]))) for k in ("x", "y", "w", "h"))
            check_size(fw, fh)
            image = ImageOps.fit(collage_image(data, options, index), (fw, fh), Image.Resampling.LANCZOS)
            canvas.paste(image, (x, y), image.getchannel("A"))
        return encode_image(canvas, options.get("format", "jpg"), options.get("quality", 92))
    columns = int(options.get("columns", 2))
    if not 1 <= columns <= 10:
        raise ValueError("列数须为 1 到 10")
    cw, ch = int(options.get("cell_width", 600)), int(options.get("cell_height", 600))
    gap = int(options.get("gap", 16))
    if not 0 <= gap <= 200:
        raise ValueError("间距须为 0 到 200 像素")
    rows = math.ceil(len(files) / columns)
    w, h = columns * cw + (columns + 1) * gap, rows * ch + (rows + 1) * gap
    check_size(w, h)
    check_size(cw, ch)
    background = ImageColor.getrgb(options.get("background", "#ffffff"))
    canvas = Image.new("RGB", (w, h), background)
    for i, (_, data) in enumerate(files):
        image = collage_image(data, options, i)
        if options.get("fit", "contain") == "contain":
            image.thumbnail((cw, ch), Image.Resampling.LANCZOS)
        else:
            image = ImageOps.fit(image, (cw, ch), Image.Resampling.LANCZOS)
        x = gap + (i % columns) * (cw + gap) + (cw - image.width) // 2
        y = gap + (i // columns) * (ch + gap) + (ch - image.height) // 2
        canvas.paste(image, (x, y), image.getchannel("A"))
    return encode_image(canvas, options.get("format", "jpg"), options.get("quality", 92))


def collage_image(data: bytes, options: dict, index: int) -> Image.Image:
    image = open_image(data)
    crops = options.get("crops", [])
    crop = crops[index] if index < len(crops) else None
    if crop:
        x, y, w, h = (int(round(v)) for v in crop)
        if x < 0 or y < 0 or w < 1 or h < 1 or x + w > image.width or y + h > image.height:
            raise ValueError("拼图照片的裁剪范围无效")
        image = image.crop((x, y, x + w, y + h))
    return image


def crop_pdf_visible(page, rect):
    """Crop normalized [x,y,w,h] in the displayed page, including /Rotate."""
    if not isinstance(rect, (list, tuple)) or len(rect) != 4:
        raise ValueError("请先在 PDF 预览上拖动选择保留区域")
    x, y, w, h = (float(v) for v in rect)
    if (not all(math.isfinite(v) for v in (x, y, w, h)) or x < 0 or y < 0
            or w <= 0 or h <= 0 or x + w > 1 + 1e-8 or y + h > 1 + 1e-8):
        raise ValueError("PDF 裁剪区域超出页面范围")
    w, h = min(w, 1 - x), min(h, 1 - y)
    if w <= 0 or h <= 0:
        raise ValueError("PDF 裁剪区域必须有实际宽度和高度")
    box, media = page.cropbox, page.mediabox
    left, bottom = max(float(box.left), float(media.left)), max(float(box.bottom), float(media.bottom))
    right, top = min(float(box.right), float(media.right)), min(float(box.top), float(media.top))
    width, height = right - left, top - bottom
    if width <= 0 or height <= 0:
        raise ValueError("PDF 页面没有有效的可见范围")
    rotation = page.rotation % 360
    if rotation not in {0, 90, 180, 270}:
        raise ValueError("此页面的旋转角度不支持自由裁剪")
    def inverse(u, v):
        if rotation == 90:
            return left + v * width, bottom + u * height
        if rotation == 180:
            return right - u * width, bottom + v * height
        if rotation == 270:
            return right - v * width, top - u * height
        return left + u * width, top - v * height
    corners = [inverse(u, v) for u in (x, x + w) for v in (y, y + h)]
    box.lower_left = (min(p[0] for p in corners), min(p[1] for p in corners))
    box.upper_right = (max(p[0] for p in corners), max(p[1] for p in corners))


def pdf_operation(action: str, files: list[tuple[str, bytes]], options: dict) -> tuple[bytes, str]:
    if not files:
        raise ValueError("请先添加文件")
    writer = PdfWriter()
    if action == "images-pdf":
        for _, data in files:
            im = open_image(data)
            white = Image.new("RGB", im.size, "white")
            white.paste(im, mask=im.getchannel("A"))
            stream = io.BytesIO()
            white.save(stream, "PDF", resolution=150.0)
            writer.append(io.BytesIO(stream.getvalue()))
    elif action == "pdf-merge":
        for _, data in files:
            reader = open_pdf(data)
            writer.append(reader)
    else:
        if len(files) != 1:
            raise ValueError("此功能一次处理一个 PDF；请先移除多余文件")
        reader = open_pdf(files[0][1])
        count = len(reader.pages)
        selected = pages(str(options.get("pages", "")), count)
        if action == "pdf-split":
            out = io.BytesIO()
            with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
                for sequence, i in enumerate(selected, 1):
                    single = PdfWriter()
                    single.add_page(reader.pages[i])
                    stream = io.BytesIO()
                    single.write(stream)
                    z.writestr(f"{sequence:03d}_page_{i + 1:03d}.pdf", stream.getvalue())
            return out.getvalue(), "pages.zip"
        if action == "pdf-delete":
            if not str(options.get("pages", "")).strip():
                raise ValueError("请填写要删除的页码")
            removed = set(selected)
            selected = [i for i in range(count) if i not in removed]
        elif action in {"pdf-rotate", "pdf-crop", "pdf-free-crop", "pdf-optimize"}:
            selected = list(range(count))
        elif action != "pdf-extract":
            raise ValueError("未知 PDF 功能")
        if not selected:
            raise ValueError("不能删除所有页面")
        targets = set(pages(str(options.get("pages", "")), count))
        for i in selected:
            p = writer.add_page(reader.pages[i])
            if action == "pdf-rotate" and i in targets:
                angle = int(options.get("angle", 90))
                if angle % 90:
                    raise ValueError("旋转角度须为 90 的倍数")
                p.rotate(angle)
            if action == "pdf-crop" and i in targets:
                margin = float(options.get("margin_mm", 5)) * 72 / 25.4
                box = p.cropbox
                if not math.isfinite(margin) or margin < 0 or margin * 2 >= min(float(box.width), float(box.height)):
                    raise ValueError("裁边尺寸过大或无效")
                box.lower_left = (float(box.left) + margin, float(box.bottom) + margin)
                box.upper_right = (float(box.right) - margin, float(box.top) - margin)
            if action == "pdf-free-crop" and i in targets:
                crop_pdf_visible(p, options.get("rect"))
            if action == "pdf-optimize":
                p.compress_content_streams()
        if action == "pdf-optimize":
            writer.compress_identical_objects(remove_duplicates=True, remove_unreferenced=True)
    stream = io.BytesIO()
    writer.write(stream)
    return stream.getvalue(), "result.pdf"


def run(action: str, files: list[tuple[str, bytes]], options: dict | None = None) -> dict:
    options = options or {}
    if sum(len(data) for _, data in files) > MAX_INPUT:
        raise ValueError("一次处理的文件总大小不能超过 120 MB")
    if action == "pdf-preview":
        return pdf_preview(files, options)
    if action == "pdf-pipeline":
        data, name = pdf_pipeline(files, options)
        return {"name": name, "data": base64.b64encode(data).decode(), "size": len(data)}
    if action == "pdf-info":
        return {"files": [{"name": name, "pages": len(open_pdf(data).pages)} for name, data in files]}
    if action == "image-edit":
        if len(files) != 1:
            raise ValueError("请添加一张照片")
        data, ext = edit_image(files[0][1], options)
        name = f"{Path(files[0][0]).stem}_edited.{ext}"
    elif action == "collage":
        data, ext = collage(files, options)
        name = f"collage.{ext}"
    else:
        data, name = pdf_operation(action, files, options)
        if len(files) == 1 and name == "result.pdf":
            name = f"{Path(files[0][0]).stem}_{action.removeprefix('pdf-')}.pdf"
        elif action == "pdf-merge":
            name = "merged.pdf"
    return {"name": name, "data": base64.b64encode(data).decode(), "size": len(data)}


def pdf_preview(files: list[tuple[str, bytes]], options: dict) -> dict:
    """Render the actual processed output, serialized because PDFium is not thread safe."""
    import json
    import pypdfium2 as pdfium
    operation = options.get("operation", "pdf-merge")
    if operation not in {"pdf-pipeline", "pdf-merge", "pdf-extract", "pdf-delete", "pdf-rotate", "pdf-split", "pdf-crop", "pdf-free-crop", "pdf-optimize", "images-pdf"}:
        raise ValueError("未知预览功能")
    rendering_options = {k: v for k, v in options.items() if k not in {"page", "operation"}}
    digest = hashlib.sha256(json.dumps([operation, rendering_options], sort_keys=True).encode())
    for name, data in files:
        digest.update(name.encode()); digest.update(data)
    key = digest.hexdigest()
    with _preview_lock:
        processed = _preview_cache.get(key)
        if processed is None:
            # A split preview shows the selected sequence before it is packaged into per-page PDFs.
            if operation == "pdf-pipeline":
                processed, _ = pdf_pipeline(files, rendering_options, preview=True)
            else:
                processed, _ = pdf_operation("pdf-extract" if operation == "pdf-split" else operation, files, rendering_options)
            _preview_cache.clear()
            _preview_cache[key] = processed
        with pdfium.PdfDocument(processed) as document:
            count = len(document)
            index = max(0, min(int(options.get("page", 0)), count - 1))
            page = document[index]
            w, h = page.get_size()
            bitmap = page.render(scale=min(2, 1100 / max(w, h)))
            try:
                image = bitmap.to_pil().copy()
                stream = io.BytesIO(); image.save(stream, "PNG")
            finally:
                bitmap.close(); page.close()
            return {"data": base64.b64encode(stream.getvalue()).decode(), "pages": count, "page": index, "width": w, "height": h}


def pdf_pipeline(files: list[tuple[str, bytes]], options: dict, preview=False) -> tuple[bytes, str]:
    """Apply operations to the previous result; only the final bytes are exported."""
    steps = options.get("steps", [])
    if not isinstance(steps, list) or len(steps) > 50:
        raise ValueError("最多支持连续 50 个操作")
    data, _ = pdf_operation("images-pdf" if options.get("source_kind") == "images" else "pdf-merge", files, {})
    name = "edited.pdf"
    for i, step in enumerate(steps):
        action = step.get("action")
        if action in {"pdf-merge", "images-pdf"}:
            continue
        if action not in {"pdf-extract", "pdf-delete", "pdf-rotate", "pdf-crop", "pdf-free-crop", "pdf-optimize", "pdf-split"}:
            raise ValueError("未知连续处理操作")
        if action == "pdf-split":
            if i != len(steps) - 1:
                raise ValueError("逐页拆分需要放在最后；请先撤销拆分，再添加其他操作")
            action = "pdf-extract" if preview else action
        data, name = pdf_operation(action, [("working.pdf", data)], step.get("options", {}))
    return data, "pages.zip" if name.endswith(".zip") else "edited.pdf"
