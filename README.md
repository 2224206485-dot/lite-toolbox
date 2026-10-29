# 轻巧工具箱

日常图片与 PDF 桌面工具。以 **miniPaint 4.14.3** 开源项目为图片编辑基础，补充拼图、PDF 处理和可独立调用的命令行。

## 为什么做 LiteToolbox

在使用一些软件的过程中，我发现连日常的图片和 PDF 处理也经常需要开通会员。与此同时，我一直没有在电脑端找到一款合适的拼图工具，以及足够简洁、顺手的图片处理软件。

所以，我构建了 **LiteToolbox**：把自己日常需要的裁剪、调色、拼图和 PDF 整理功能放在一起，尽量让常用操作简单、直观，并在本机完成处理。

## 已实现

- 照片：拖动裁剪、旋转、亮度、对比度、饱和度、色相及 RGB 调节；撤销；PNG / JPEG / WebP 导出。默认界面只有大图、自由裁剪与三个调色滑杆；图层、文字等保留在折叠的 miniPaint 高级编辑中。
- 拼图：带示意图的横向、竖向、双列、三列及自由排版；带形状的比例选择；默认完整显示照片；点击单张照片自由或按比例裁剪；自由画布拖动移动、拖角点等比缩放；调整图层顺序、底色并导出。
- PDF：合并、页码提取和排序、逐页拆分为 ZIP、删除页面、指定页面旋转、拖动自由裁剪、固定距离裁白边、无损结构优化、图片转 PDF。
- PDF 连续编辑与实时预览：先合并，再选择提取、旋转、裁边等操作，每步可加入待保存列表并撤销；预览显示累计结果，最后统一保存。拆分为 ZIP 必须放在最后。页码按上一步结果计算。
- 原生保存对话框；全本机处理；原图或原 PDF 不自动覆盖。
- Python CLI 与 GUI 共用图片 / PDF 处理核心；无需 MCP 即可由智能助手调用。

## 下载与使用

在 [Releases 下载页面](https://github.com/2224206485-dot/lite-toolbox/releases) 获取最新版本：

- **Windows 10 / 11 x64**：下载 `LiteToolbox-Windows-x64.zip`，完整解压后运行 `LiteToolbox/LiteToolbox.exe`。请保留同目录依赖文件夹；需要系统 WebView2 Runtime。
- **Apple Silicon Mac**：下载 `LiteToolbox-macOS-ARM64.zip`，解压后打开 `LiteToolbox.app`。此包不是 Intel 通用版。
- **二次开发**：克隆本仓库或下载 `LiteToolbox-Source.zip`。

目前是未使用开发者发行签名、未做 Apple 公证的早期版本。自动化检查覆盖处理逻辑与打包后的引擎；桌面交互体验欢迎通过 Issues 反馈。

## 从源码运行

建议 Python 3.13 或 3.14。无需 Node.js、Rust、Docker 或在线账户。

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python desktop.py
```

Mac 可双击 `启动-Mac.command`。Windows 安装 Python 后双击 `启动-Windows.bat`。首次会下载依赖，之后文件处理不需要联网。Windows 10 / 11 需要 Microsoft Edge WebView2 Runtime。

调试模式（仅监听本机地址）：

```sh
python desktop.py --browser --port 8877
```

## 打包 APP / EXE

安装构建依赖并运行：

```sh
python -m pip install -r requirements-build.txt
python -m unittest discover -s tests -v
python build.py
```

- **在 macOS 构建：** `dist/LiteToolbox.app`，架构与构建用的 Python 一致。
- **在 Windows 构建：** `dist/LiteToolbox/LiteToolbox.exe`。双击 `打包-Windows.bat` 即可。请分发整个 LiteToolbox 文件夹，不要只复制 exe。
- `.github/workflows/build.yml` 提供 Windows x64 和 Mac ARM64 的构建矩阵；会先跑测试和打包后的引擎检查，再统一发布 Windows、Mac 和源码 ZIP。
- 本地 Mac 无法直接用 PyInstaller 交叉生成 Windows exe。仓库的 Actions 可自动完成两个平台的构建。

pywebview 使用系统 WebKit / WebView2，避免捆绑完整 Chromium。打包仍包含 Python 及图片库，实际体积请以生成文件为准。

## PDF 自由裁剪

1. 添加 PDF，点击“自由裁剪”。
2. 翻到需要裁剪的页面，拖出需要保留的选区；可以拖选区移动、拖边角调整。右侧小图实时显示裁剪效果。
3. 选择应用到“当前预览页”“指定页码”或“全部页面（按相同比例）”。
4. 点击“加入待保存操作”，可继续旋转、提取或再次裁剪；最后点击“保存全部修改”。也可以直接保存当前裁剪。

自由裁剪按当前预览的方向工作，包括旋转过和已经裁过的页面；它保留 PDF 文字与矢量内容，不会将整页转成照片。裁剪改变可见范围，不能用作永久删除敏感信息。

## 命令行：助手可以直接调用

在项目目录中，使用已经装好依赖的 Python：

```sh
python -m toolbox.cli pdf-merge a.pdf b.pdf -o merged.pdf
python -m toolbox.cli pdf-extract input.pdf -o selected.pdf --options '{"pages":"1-3,5"}'
python -m toolbox.cli pdf-extract input.pdf -o reordered.pdf --options '{"pages":"3,1,2"}'
python -m toolbox.cli pdf-rotate input.pdf -o rotated.pdf --options '{"pages":"2,4","angle":90}'
python -m toolbox.cli pdf-split input.pdf -o pages.zip
python -m toolbox.cli pdf-delete input.pdf -o cleaned.pdf --options '{"pages":"2,4-6"}'
python -m toolbox.cli pdf-free-crop input.pdf -o selected-area.pdf --options '{"pages":"2","rect":[0.1,0.15,0.7,0.6]}'
python -m toolbox.cli pdf-crop input.pdf -o cropped.pdf --options '{"margin_mm":5}'
python -m toolbox.cli image-edit photo.jpg -o edited.jpg --options '{"crop":[100,50,800,600],"brightness":1.1,"contrast":1.05,"saturation":1.15,"format":"jpg"}'
python -m toolbox.cli collage a.jpg b.jpg c.jpg -o collage.jpg --options '{"columns":2,"cell_width":800,"cell_height":800,"gap":20,"format":"jpg"}'
python -m toolbox.cli images-pdf a.jpg b.jpg -o photos.pdf
python -m toolbox.cli pdf-pipeline input.pdf -o edited.pdf --options '{"steps":[{"action":"pdf-extract","options":{"pages":"1-3"}},{"action":"pdf-rotate","options":{"pages":"2","angle":90}}]}'
python -m toolbox.cli pdf-info input.pdf
python -m toolbox.cli pdf-preview input.pdf -o preview.png --options '{"operation":"pdf-rotate","angle":90}'
```

自由裁剪的 `rect` 为 `[x,y,width,height]`，以当前可见页面左上角为原点，数值为 0 到 1 的比例，适配不同页尺寸和旋转方向。

CLI 返回 JSON；失败返回非零退出码；默认拒绝覆盖已有文件；即使用 `--overwrite` 也不允许将原文件作为输出。页码从 1 开始；裁剪坐标在应用 EXIF 旋转后的照片上计算。

Mac 包内程序也支持：

```sh
./LiteToolbox.app/Contents/MacOS/LiteToolbox --cli pdf-info input.pdf
```

简约界面和 CLI 的导出都使用 Pillow。屏幕调色预览使用系统 CSS 显示，具体颜色以导出为准；miniPaint 高级模式独立使用上游算法。

## 二次开发结构

```text
desktop.py             原生窗口、本机预览服务、保存对话框
web/                   中文工具箱界面、miniPaint 适配脚本
vendor/minipaint/      下载的上游完整源码与预构建资源
vendor/UPSTREAM.json   上游下载来源及归档哈希
toolbox/core.py        可复用的图片 / PDF 处理函数
toolbox/cli.py         无界面的命令行入口
tests/                 文件内容、像素、页面顺序与覆盖保护测试
build.py               macOS / Windows PyInstaller 配置
licenses/              第三方许可证
```

本次直接复用上游已发布的 bundle，无需安装前端构建工具。若修改 miniPaint 的 JS 源码，需要在 `vendor/minipaint` 中安装其依赖并执行 `npm run build`；上游含一个 GitHub Git 依赖，需要可访问 GitHub。

## 边界

- 单次输入总大小 120 MB；单张图片或拼图上限 4000 万像素；拼图最多 30 张，横向拼图最多 10 张。
- 默认支持 PNG、JPEG、WebP；HEIC 和 RAW 未提供支持。多帧图按静态图处理。
- PDF 裁白边是改变可见范围，不是真正删去页面内容，不能用于敏感信息涂黑。
- PDF 无损优化不重压扫描图片，结果可能不变或变大。
- 暂不支持 PDF 正文编辑、OCR、密码解锁、PDF 转 Word。修改带签名的 PDF 会影响签名有效性；应保留原件。
- PDF 用文件列表及页码操作，并显示处理结果的页面预览；复杂表单和特殊 PDF 请检查输出。
- 当前桌面最小尺寸为 960 × 680。

## 发布新版本

打开仓库的 **Actions → Build and publish LiteToolbox → Run workflow**，填写版本号（例如 `v0.4.0`）。两个平台的测试、构建及包内引擎检查全部通过后，下载包会自动出现在 Releases。也支持推送 `v*` 标签触发。

## 许可证

本项目原创集成代码使用 MIT。上游与依赖保留各自许可证，见 `THIRD_PARTY.md`。当前核心不引入 PyMuPDF / Ghostscript 等 AGPL 组件。
