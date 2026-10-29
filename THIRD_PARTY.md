# 开源来源与修改说明

本项目在现有开源项目 miniPaint 上扩展，而非重写照片编辑器。

| 项目 | 来源 | 用途 | 许可证 |
| --- | --- | --- | --- |
| miniPaint 4.14.3 | https://github.com/viliusle/miniPaint | 完整照片编辑器，直接使用上游预构建 bundle | MIT |
| Pillow 13.0.0 | https://github.com/python-pillow/Pillow | 拼图、CLI 图片处理、图片转 PDF | HPND，详见其许可证及所捆绑编解码库说明 |
| pypdf 6.21.4 | https://github.com/py-pdf/pypdf | PDF 页面处理 | BSD-3-Clause |
| pypdfium2 5.14.0 / PDFium | https://github.com/pypdfium2-team/pypdfium2 | 本机 PDF 实时结果渲染 | Apache-2.0 / BSD 等，详见 licenses/pypdfium2 |
| pywebview 6.2.1 | https://github.com/r0x0r/pywebview | Windows / macOS 原生网页窗口 | BSD-3-Clause |
| Python / PyObjC | https://www.python.org/ / https://github.com/ronaldoussoren/pyobjc | 桌面运行时 | 详见 licenses/ |
| PyInstaller | https://github.com/pyinstaller/pyinstaller | 构建工具 | GPL with bootloader exception；随包保留许可 |

miniPaint 完整源码、上游 MIT-LICENSE.txt、bundle.js.LICENSE.txt 保存在 vendor/minipaint。
下载日期、归档来源及 SHA-256 记录在 vendor/UPSTREAM.json。

对上游的唯一文件修改为 index.html 中插入 /editor-adapter.js。
适配脚本在本项目 web/editor-adapter.js，设置中文界面和浅色主题，并将上游保存动作接入桌面保存对话框。
其余扩展采用独立模块：照片拼图、PDF 工具、CLI、桌面封装及打包配置。

licenses/ 包含安装依赖的原始许可证副本。重新打包或升级依赖时应同步这些文件。
上游带有在线服务链接和在线字体入口，本项目的内容安全策略限制外部请求；本地功能不依赖这些服务。
