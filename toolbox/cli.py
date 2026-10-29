"""Usage: python -m toolbox.cli --help"""
import argparse
import base64
import json
import os
import tempfile
from pathlib import Path

from .core import run


def main():
    parser = argparse.ArgumentParser(description="轻巧工具箱：本地图片与 PDF 处理。页码从 1 开始。")
    parser.add_argument("action", choices=["image-edit", "collage", "images-pdf", "pdf-merge", "pdf-info", "pdf-preview", "pdf-pipeline", "pdf-extract", "pdf-delete", "pdf-rotate", "pdf-split", "pdf-crop", "pdf-free-crop", "pdf-optimize"])
    parser.add_argument("inputs", nargs="+", type=Path)
    parser.add_argument("-o", "--output", type=Path)
    parser.add_argument("--options", default="{}", help='JSON，例如 {"pages":"1-3,5","angle":90}')
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()
    try:
        if args.action != "pdf-info" and args.output is None:
            raise ValueError("请用 -o 指定输出文件")
        if args.output:
            target = args.output.resolve()
            if target in {p.resolve() for p in args.inputs}:
                raise ValueError("输出文件不能是原文件，请另存一份")
            if target.exists() and not args.overwrite:
                raise ValueError("输出文件已存在；要替换请使用 --overwrite")
        options = json.loads(args.options)
        if not isinstance(options, dict):
            raise ValueError("--options 必须是 JSON 对象")
        result = run(args.action, [(p.name, p.read_bytes()) for p in args.inputs], options)
        if args.action == "pdf-info":
            print(json.dumps(result, ensure_ascii=False))
            return
        target.parent.mkdir(parents=True, exist_ok=True)
        data = base64.b64decode(result.pop("data"))
        # Write to a same-directory temporary file so interrupted work cannot leave a partial result.
        tmp = None
        try:
            with tempfile.NamedTemporaryFile(dir=target.parent, delete=False) as f:
                tmp = Path(f.name)
                f.write(data)
            if args.overwrite:
                os.replace(tmp, target)
            else:
                os.link(tmp, target)
        finally:
            if tmp and tmp.exists():
                tmp.unlink()
        result["output"] = str(target)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        parser.exit(1, json.dumps({"error": str(e)}, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
