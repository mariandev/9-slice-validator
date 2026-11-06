export type Slices = { top: number; right: number; bottom: number; left: number }
export type Mode = 'stretch' | 'repeat'
export type SliceType = 'sliced' | 'tiled'
export type AssetType = 'sprite' | 'texture' | 'vector'
export type SliceOptions = { slices: Slices; scale: number; smooth: boolean } & (
  | { profile: 'custom'; horizontal: Mode; vertical: Mode; center: Mode; fill: boolean }
  | { profile: 'unity'; sliceType: SliceType; assetType: AssetType; spritePPU: number; referencePPU: number }
)

export function effectiveScale(options: SliceOptions): number {
  // Unity 6000.3 UIElementsUtility.PixelsPerUnitScaleForElement uses this ratio.
  // The manual's 16/100 example reverses it; follow the engine implementation.
  return options.scale * (options.profile === 'unity' && options.assetType === 'sprite'
    ? options.referencePPU / Math.max(0.01, options.spritePPU) : 1)
}

export function renderSettings(options: SliceOptions) {
  if (options.profile === 'custom') return { ...options, effectiveScale: effectiveScale(options) }
  const mode: Mode = options.sliceType === 'tiled' && options.assetType === 'sprite' ? 'repeat' : 'stretch'
  return { horizontal: mode, vertical: mode, center: mode, fill: true, effectiveScale: effectiveScale(options) }
}

export function clampSlice(slices: Slices, side: keyof Slices, value: number, width: number, height: number): Slices {
  const opposite = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' } as const
  const total = side === 'left' || side === 'right' ? width : height
  return { ...slices, [side]: Math.max(0, Math.min(total - slices[opposite[side]], Math.round(value) || 0)) }
}

export function sliceLayout(sourceWidth: number, sourceHeight: number, width: number, height: number, options: SliceOptions) {
  const { top, right, bottom, left } = options.slices
  const scale = effectiveScale(options)
  const scaleX = Math.min(scale, width / Math.max(1, left + right))
  const scaleY = Math.min(scale, height / Math.max(1, top + bottom))
  return {
    sx: [0, left, sourceWidth - right, sourceWidth],
    sy: [0, top, sourceHeight - bottom, sourceHeight],
    dx: [0, left * scaleX, width - right * scaleX, width],
    dy: [0, top * scaleY, height - bottom * scaleY, height],
  }
}

export function renderSlice(canvas: HTMLCanvasElement, source: HTMLImageElement, width: number, height: number, options: SliceOptions) {
  canvas.width = width; canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = options.smooth
  // UI Toolkit only activates its sliced mesh path when at least one inset is nonzero.
  if (options.profile === 'unity' && Object.values(options.slices).every(value => value === 0)) {
    ctx.drawImage(source, 0, 0, width, height)
    return
  }
  const settings = renderSettings(options)
  const { sx, sy, dx, dy } = sliceLayout(source.naturalWidth, source.naturalHeight, width, height, options)
  for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
    if (row === 1 && col === 1 && !settings.fill) continue
    const sw = sx[col + 1] - sx[col], sh = sy[row + 1] - sy[row]
    const dw = dx[col + 1] - dx[col], dh = dy[row + 1] - dy[row]
    if (sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) continue
    const center = row === 1 && col === 1
    const repeatX = col === 1 && (center ? settings.center : settings.horizontal) === 'repeat'
    const repeatY = row === 1 && (center ? settings.center : settings.vertical) === 'repeat'
    if (!repeatX && !repeatY) {
      ctx.drawImage(source, sx[col], sy[row], sw, sh, dx[col], dy[row], dw, dh)
      continue
    }
    const tileW = repeatX ? sw * settings.effectiveScale : dw
    const tileH = repeatY ? sh * settings.effectiveScale : dh
    if (tileW <= 0 || tileH <= 0) continue
    const tile = document.createElement('canvas')
    tile.width = sw; tile.height = sh
    const tileCtx = tile.getContext('2d')!
    tileCtx.imageSmoothingEnabled = options.smooth
    tileCtx.drawImage(source, sx[col], sy[row], sw, sh, 0, 0, tile.width, tile.height)
    ctx.save(); ctx.translate(dx[col], dy[row])
    const pattern = ctx.createPattern(tile, 'repeat')!
    pattern.setTransform(new DOMMatrix().scale(tileW / sw, tileH / sh))
    ctx.fillStyle = pattern
    ctx.fillRect(0, 0, dw, dh); ctx.restore()
  }
}

