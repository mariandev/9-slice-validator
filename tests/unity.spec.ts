import { expect, test } from '@playwright/test'

test('slice type switches the preview between sliced and tiled', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('botanical-panel.png', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sliced', exact: true })).toHaveAttribute('aria-pressed', 'true')
  const stretched = await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL())
  await page.getByRole('button', { name: 'Tiled', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Tiled', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL())).not.toBe(stretched)
  await page.getByRole('button', { name: 'Sliced', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Sliced', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

test('Unity pixels: unified tiling, clipped tiles, PPU, zero insets and border compression', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const path = '/src/slice.ts'
    const { renderSlice, sliceLayout, effectiveScale, clampSlice } = await import(/* @vite-ignore */ path)
    const source = document.createElement('canvas'); source.width = 12; source.height = 12
    const ctx = source.getContext('2d')!
    ctx.fillStyle = '#00ff00'; ctx.fillRect(0, 0, 12, 12)
    ctx.fillStyle = '#ff0000'; ctx.fillRect(4, 0, 2, 12)
    ctx.fillStyle = '#0000ff'; ctx.fillRect(6, 0, 2, 12)
    const image = new Image(); image.src = source.toDataURL(); await image.decode()
    const target = document.createElement('canvas')
    const options = { profile: 'unity', sliceType: 'sliced', assetType: 'sprite', spritePPU: 100, referencePPU: 100, scale: 1, smooth: false, slices: { top: 4, right: 4, bottom: 4, left: 4 } }
    const pixel = (x: number, y: number) => Array.from(target.getContext('2d')!.getImageData(x, y, 1, 1).data)
    const pixels = () => Array.from(target.getContext('2d')!.getImageData(0, 0, target.width, target.height).data)
    renderSlice(target, image, 19, 20, options)
    const sliced = [pixel(6, 1), pixel(6, 10), pixel(18, 1)]
    const tiledOptions = { ...options, sliceType: 'tiled' }
    renderSlice(target, image, 19, 20, tiledOptions)
    const tiled = [pixel(6, 1), pixel(6, 10), pixel(18, 1), pixel(14, 10), pixel(15, 10)]
    const baseline = pixels()
    const ppuOptions = { ...tiledOptions, spritePPU: 16, scale: 0.16 }
    renderSlice(target, image, 19, 20, ppuOptions)
    const compensated = pixels()
    renderSlice(target, image, 40, 20, { ...tiledOptions, scale: 2 })
    const scaledTile = pixel(12, 1)
    const zero = { ...tiledOptions, slices: { top: 0, right: 0, bottom: 0, left: 0 } }
    renderSlice(target, image, 19, 20, zero)
    const noSliceTiled = pixels()
    renderSlice(target, image, 19, 20, { ...zero, sliceType: 'sliced' })
    const noSliceSliced = pixels()
    const compressed = sliceLayout(12, 12, 6, 5, { ...options, slices: { left: 4, right: 2, top: 4, bottom: 4 }, scale: 2 })
    return {
      sliced, tiled, identicalPPU: JSON.stringify(baseline) === JSON.stringify(compensated), scaledTile,
      noSliceEqual: JSON.stringify(noSliceTiled) === JSON.stringify(noSliceSliced),
      spriteScale: effectiveScale({ ...options, spritePPU: 16, scale: 2 }),
      textureScale: effectiveScale({ ...options, assetType: 'texture', spritePPU: 16, scale: 2 }),
      vectorScale: effectiveScale({ ...options, assetType: 'vector', spritePPU: 16, scale: 2 }),
      compressed,
      touching: clampSlice(options.slices, 'left', 8, 12, 12),
    }
  })
  const red = [255, 0, 0, 255], blue = [0, 0, 255, 255], green = [0, 255, 0, 255]
  expect(result.sliced).toEqual([red, red, green])
  expect(result.tiled).toEqual([blue, blue, green, blue, green])
  expect(result.identicalPPU).toBe(true)
  expect(result.scaledTile).toEqual(blue)
  expect(result.spriteScale).toBe(12.5)
  expect(result.textureScale).toBe(2)
  expect(result.vectorScale).toBe(2)
  expect(result.noSliceEqual).toBe(true)
  expect(result.compressed.dx).toEqual([0, 4, 4, 6])
  expect(result.compressed.dy).toEqual([0, 2.5, 2.5, 5])
  expect(result.touching.left).toBe(8)
})
