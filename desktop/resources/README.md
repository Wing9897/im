# Resources

## Icons

Generated from `docs/images/logo.png` (product mark):

- `icon.png` — 512x512 for macOS/Linux (and default `icon`; mac requires ≥512)
- `icon.ico` — Windows multi-size ICO (16…256) for tray + NSIS

Regenerate from the source PNG (system Pillow, not a project dependency):

```powershell
python -c "from PIL import Image; src=Image.open('../docs/images/logo.png').convert('RGBA'); src.resize((512,512), Image.Resampling.LANCZOS).save('icon.png'); src.save('icon.ico', format='ICO', sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])"
```

Referenced in `electron-builder.yml` (`icon` / `win.icon` / `mac.icon` / `linux.icon`) and `desktop/main.ts` (tray + window icon).
