"""Build on the target OS: python build.py. No cross-compilation implied."""
import os
import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parent
out = Path(os.environ.get("TOOLBOX_DIST", str(root / "dist")))
build = Path(os.environ.get("TOOLBOX_BUILD", str(root / "build")))
separator = os.pathsep
args = [sys.executable, "-m", "PyInstaller", "--noconfirm", "--clean", "--windowed", "--onedir",
        "--name", "LiteToolbox", "--distpath", str(out), "--workpath", str(build), "--specpath", str(build),
        "--add-data", f"{root / 'web'}{separator}web",
        "--add-data", f"{root / 'vendor' / 'minipaint'}{separator}vendor/minipaint",
        "--add-data", f"{root / 'THIRD_PARTY.md'}{separator}.",
        "--add-data", f"{root / 'licenses'}{separator}licenses",
        "--collect-all", "webview", "--collect-all", "pypdfium2", "--collect-all", "pypdfium2_raw", "--collect-all", "pypdfium2_cfg", "--exclude-module", "tkinter", "--exclude-module", "pytest"]
if sys.platform == "darwin":
    args += ["--osx-bundle-identifier", "local.litetoolbox.simple", "--icon", str(root / "assets" / "icon.icns")]
elif sys.platform == "win32":
    args += ["--icon", str(root / "assets" / "icon.ico")]
args += [str(root / "desktop.py")]
subprocess.run(args, cwd=root, check=True)
print(f"Built for {sys.platform}: {out}")
