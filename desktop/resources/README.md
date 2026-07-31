# Resources

## Icons

- `icon.png` — 256x256 placeholder for macOS/Linux (and default `icon`)
- `icon.ico` — Windows placeholder (tray + NSIS)

Both are a minimal blue square with white border.

### Replacing with a production icon

For the final release, replace both with proper multi-resolution assets:
- PNG/ICNS for macOS (and PNG set for Linux)
- Multi-size ICO for Windows (16…256)

You can generate an ICO from a PNG source using tools like:
- [ImageMagick](https://imagemagick.org/): `magick convert icon-256.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico`
- [RealFaviconGenerator](https://realfavicongenerator.net/)
- [IcoFX](https://icofx.ro/)

Referenced in `electron-builder.yml` (`icon` / `win.icon` / `mac.icon` / `linux.icon`).
