# Resources

## icon.ico

The current `icon.ico` is a minimal 16x16 placeholder (blue square with white border).

### Replacing with a production icon

For the final release, replace `icon.ico` with a proper multi-resolution ICO file containing:
- 16x16
- 32x32
- 48x48
- 64x64
- 128x128
- 256x256

You can generate one from a PNG source using tools like:
- [ImageMagick](https://imagemagick.org/): `magick convert icon-256.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico`
- [RealFaviconGenerator](https://realfavicongenerator.net/)
- [IcoFX](https://icofx.ro/)

The icon is referenced in `electron-builder.yml` (`icon` / `win.icon` / `mac.icon` / `linux.icon`).
For macOS store builds, prefer a dedicated multi-resolution `.icns` (or high-res PNG source).
