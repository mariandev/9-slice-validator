# 9-slice validator

A browser-only 9-slice validator built with React, TypeScript, Vite, and Tailwind CSS.

## Run locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. No backend, account, or external image service is needed.

## Publish on GitHub Pages

The included `.github/workflows/deploy-pages.yml` builds and deploys the site on every push to `main`. Vite uses relative asset paths so the build works under the repository's Pages URL as well as a custom domain.

1. In the GitHub repository, open **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Commit and push this setup to `main`. Under **Actions**, follow **Deploy to GitHub Pages**. If the setup was already pushed before enabling Pages, select that workflow and click **Run workflow** on `main`.
4. Once deployment succeeds, open https://mariandev.github.io/9-slice-validator/ (also shown in **Settings → Pages**).

If Actions are restricted, allow the official `actions/*` actions under **Settings → Actions → General**. If the `github-pages` environment has deployment branch restrictions, allow `main` under **Settings → Environments → github-pages**. No repository secrets or personal access token are needed; the workflow declares its deployment permissions.

For a different default branch, update `on.push.branches` in the workflow. Generated `dist/` files do not need to be committed.

## Features

- Upload or drag and drop an image; includes a generated sample panel.
- Drag four slice guides, type pixel insets, or link all inset values.
- Resize the preview using all eight edge and corner handles.
- Source image and slice settings sit side by side, with the live playground underneath (stacked on narrow screens).
- Switch between Unity-style Sliced and Tiled rendering in the Slice settings panel.
- Toggle preview slice overlays and background.
- Expand the preview to fullscreen with its toolbar button; press Escape or click again to exit. Box dimensions are preserved. Embedded browsers that block fullscreen use a viewport-filling fallback.
- Keyboard adjustments: focus guides or resize handles and use arrow keys; Shift changes by 10 pixels.

Images are decoded and rendered locally using Canvas. Insets may meet (zero source center width or height), but cannot cross. The preview supports 32–2048 pixels per side; uploaded files are limited to 25 MB, 8192 pixels per side, and 32 megapixels. The interface has no export bar, top navigation, or separate behavior panel.

## Unity behavior

The editor targets **Unity 6000.3 UI Toolkit background slicing**, using a Full Rect sprite, slice scale 1, sprite PPU 100, panel reference PPU 100, smooth filtering, and `background-size: 100% 100%` (stretch to fill). The underlying renderer also supports configurable PPU, scale, and custom per-region modes for programmatic use; these advanced controls are not exposed in the simplified interface.

- **Sliced:** preserves corner sizes; top/bottom stretch horizontally, left/right vertically, center along both axes.
- **Tiled:** repeats those same regions instead, at their scaled source size. Partial tiles are clipped. Unity requires Sprite (2D and UI), Mesh Type: Full Rect; the preview assumes that setup.
- **Slice scale:** scales source corner/border dimensions and tile periods, without changing the source cut positions. Sprite effective scale is `sliceScale * panelReferencePPU / spritePPU`. Texture and vector effective scale is `sliceScale`.
- **Zero insets:** uploaded images use zero insets. All-zero insets bypass slicing, including slice tiling. The included demo has 26 px insets to demonstrate slicing immediately.
- **Center:** always rendered in the interface, respecting the source image's alpha. `fillCenter` is a uGUI feature rather than a UI Toolkit background property.
- **Undersized target:** border pairs compress proportionally along each axis to avoid overlapping regions. Preview guides use the same calculated geometry as the renderer.
- **Insets:** represent explicit per-element overrides; the browser does not read Sprite Editor border metadata.

### Documentation discrepancy

The manual gives a sprite-scale example using `spritePPU / referencePPU`. Unity's **6000.3 engine implementation** instead returns `referencePPU / spritePPU` in `UIElementsUtility.PixelsPerUnitScaleForElement`, and the element builder multiplies the slice scale by that value. The tool follows the implementation. For example, PPU 16, reference PPU 100, and slice scale 0.16 produce effective scale 1; slice scale 2 produces effective scale 12.5.

### Sources

- [Unity 6000.3: Set background images](https://docs.unity.com/en-us/engine/6000.3/manual/uitoolkits/uielements/uie-uss/properties/uib-styling-ui-backgrounds)
- [Unity 6000.3: SliceType API](https://docs.unity.com/en-us/engine/6000.3/script-reference/unityengine/uielements/slicetype)
- [Unity 6000.3: 9-slicing overview](https://docs.unity.com/en-us/engine/6000.3/manual/unity2d/sprite/9-slice/9-slicing) (overview only; SpriteRenderer-specific adaptive tiling is not UI Toolkit behavior)
- [Unity 6000.3 source: PPU scaling](https://github.com/Unity-Technologies/UnityCsReference/blob/6000.3/Modules/UIElements/Core/UIElementsUtility.cs#L575)
- [Unity 6000.3 source: background rendering and slice flags](https://github.com/Unity-Technologies/UnityCsReference/blob/6000.3/Modules/UIElements/Core/Renderer/UIRElementBuilder.cs#L225)
- [Unity 6000.3 source: zero-slice handling and sprite border fallback](https://github.com/Unity-Technologies/UnityCsReference/blob/6000.3/Modules/UIElements/Core/Renderer/UIRMeshGenerator.cs)

### Scope and validation limits

This is a Canvas emulation, not Unity running in WebAssembly. Pixel tests verify expected geometry and tile behavior using generated fixtures; they have **not** been compared with captures from a running Unity editor. Native tessellation edge cases, including compressed borders and zero-width source regions, may differ. Texture atlas packing, tight meshes, import downsampling/compression, mipmaps, panel/DPI scaling, rounded element clipping, background tint, and non-fill background sizing/positioning are outside this preview's scope. SVG uploads are rasterized by the browser rather than tessellated using Unity's Vector Graphics package. Source insets are measured from image edges; the Sprite pivot does not offset these cut lines.

## Verify

```sh
npm run build
npx playwright install chromium
npm test
```

Tests cover slice constraints, guide dragging, all resize handles, uploads, slice type selection, mobile overflow, pixel-level stretch/repeat behavior, partial tiles, PPU scale compensation, all-zero insets, and undersized-border geometry.
