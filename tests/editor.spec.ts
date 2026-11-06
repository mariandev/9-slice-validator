import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('botanical-panel.png', { exact: true })).toBeVisible()
})

test('slice guides drag, constrain opposing insets, and link values', async ({ page }) => {
  const left = page.getByRole('button', { name: 'Drag left slice guide', exact: true })
  const rect = (await left.boundingBox())!
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2)
  await page.mouse.down(); await page.mouse.move(rect.x + rect.width / 2 + 20, rect.y + rect.height / 2); await page.mouse.up()
  await expect(page.getByLabel('left', { exact: true })).toHaveValue('40')
  await page.getByLabel('left', { exact: true }).fill('999')
  await expect(page.getByLabel('left', { exact: true })).toHaveValue('118')
  await page.getByRole('button', { name: 'Link all slice values' }).click()
  await page.getByLabel('top', { exact: true }).fill('12')
  for (const side of ['top', 'right', 'bottom', 'left']) await expect(page.getByLabel(side, { exact: true })).toHaveValue('12')
})

test('preview resizes from each edge and corner and supports keyboard', async ({ page }) => {
  let width = 360, height = 240
  for (const handle of ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']) {
    const resizeHandle = page.getByRole('button', { name: `Resize ${handle}`, exact: true })
    await resizeHandle.scrollIntoViewIfNeeded()
    const bounds = (await resizeHandle.boundingBox())!
    const startX = bounds.x + bounds.width / 2, startY = bounds.y + bounds.height / 2
    const dx = handle.includes('w') ? -15 : handle.includes('e') ? 15 : 0
    const dy = handle.includes('n') ? -15 : handle.includes('s') ? 15 : 0
    await page.mouse.move(startX, startY); await page.mouse.down(); await page.mouse.move(startX + dx, startY + dy); await page.mouse.up()
    width += dx ? 15 : 0; height += dy ? 15 : 0
    await expect(page.locator('canvas')).toHaveAttribute('width', String(width))
    await expect(page.locator('canvas')).toHaveAttribute('height', String(height))
  }
  await page.getByRole('button', { name: 'Resize se', exact: true }).focus()
  await page.keyboard.press('Shift+ArrowRight')
  await expect(page.locator('canvas')).toHaveAttribute('width', String(width + 10))
})

test('uploads local images and rejects invalid files', async ({ page }) => {
  const data = await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL().split(',')[1])
  const dataTransfer = await page.evaluateHandle(async data => {
    const blob = await (await fetch(`data:image/png;base64,${data}`)).blob()
    const transfer = new DataTransfer()
    transfer.items.add(new File([blob], 'my-panel.png', { type: 'image/png' }))
    return transfer
  }, data)
  // Dropping on the heading outside the image canvas should also load the image.
  await page.locator('.source-panel .panel-heading').dispatchEvent('drop', { dataTransfer })
  await dataTransfer.dispose()
  await expect(page.getByText('my-panel.png', { exact: true })).toBeVisible()
  await page.locator('input[type=file]').setInputFiles({ name: 'bad.png', mimeType: 'image/png', buffer: Buffer.from('not an image') })
  await expect(page.getByRole('alert')).toContainText('could not be opened')
  await expect(page.getByText('my-panel.png', { exact: true })).toBeVisible()
})

test('fullscreen expands the preview, preserves box size, and follows browser exit', async ({ page }) => {
  await page.getByRole('button', { name: 'Resize se', exact: true }).focus()
  await page.keyboard.press('Shift+ArrowRight')
  await page.getByRole('button', { name: 'Enter preview fullscreen' }).click()
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.classList.contains('preview-panel'))).toBe(true)
  await expect(page.getByRole('button', { name: 'Exit preview fullscreen' })).toHaveAttribute('aria-pressed', 'true')
  const panel = await page.locator('.preview-panel').boundingBox()
  expect(panel?.height).toBe(page.viewportSize()!.height)
  await expect(page.locator('canvas')).toHaveAttribute('width', '370')
  await page.getByRole('button', { name: 'Resize se', exact: true }).focus()
  await page.keyboard.press('Shift+ArrowRight')
  await expect(page.locator('canvas')).toHaveAttribute('width', '380')
  await page.getByRole('button', { name: 'Exit preview fullscreen' }).click()
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true)
  await page.getByRole('button', { name: 'Enter preview fullscreen' }).click()
  await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null)).toBe(true)
  await page.evaluate(() => document.exitFullscreen())
  await expect(page.getByRole('button', { name: 'Enter preview fullscreen' })).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('canvas')).toHaveAttribute('width', '380')
})

test('fullscreen falls back to the viewport when blocked and exits with Escape', async ({ page }) => {
  await page.evaluate(() => { Element.prototype.requestFullscreen = () => Promise.reject(new Error('Blocked by embed')) })
  await page.getByRole('button', { name: 'Enter preview fullscreen' }).click()
  await expect(page.locator('.preview-panel')).toHaveClass(/is-expanded/)
  await expect(page.getByRole('button', { name: 'Exit preview fullscreen' })).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Escape')
  await expect(page.locator('.preview-panel')).not.toHaveClass(/is-expanded/)
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
})

test('renderer preserves corners and independently repeats edges and center', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const modulePath = '/src/slice.ts'
    const { renderSlice } = await import(/* @vite-ignore */ modulePath)
    const fixture = document.createElement('canvas'); fixture.width = 12; fixture.height = 12
    const context = fixture.getContext('2d')!
    context.fillStyle = '#00ff00'; context.fillRect(0, 0, 12, 12)
    context.fillStyle = '#ff0000'; context.fillRect(4, 0, 2, 12); context.fillRect(0, 4, 12, 2)
    context.fillStyle = '#0000ff'; context.fillRect(6, 0, 2, 12); context.fillRect(0, 6, 12, 2)
    const image = new Image(); image.src = fixture.toDataURL(); await image.decode()
    const target = document.createElement('canvas')
    const opts = { profile: 'custom', slices: { top: 4, right: 4, bottom: 4, left: 4 }, horizontal: 'stretch', vertical: 'stretch', center: 'stretch', fill: true, scale: 1, smooth: false }
    const pixel = (x: number, y: number) => Array.from(target.getContext('2d')!.getImageData(x, y, 1, 1).data)
    renderSlice(target, image, 32, 32, opts)
    const stretch = { corner: pixel(1, 1), horizontal: pixel(6, 1), vertical: pixel(1, 6), center: pixel(6, 6) }
    renderSlice(target, image, 32, 32, { ...opts, horizontal: 'repeat', vertical: 'repeat', center: 'repeat' })
    const repeat = { corner: pixel(1, 1), horizontal: pixel(6, 1), vertical: pixel(1, 6), center: pixel(6, 6) }
    renderSlice(target, image, 32, 32, { ...opts, fill: false })
    const empty = pixel(16, 16)
    renderSlice(target, image, 3, 3, { ...opts, horizontal: 'repeat', vertical: 'repeat', center: 'repeat' })
    return { stretch, repeat, empty, tiny: [target.width, target.height] }
  })
  expect(result.stretch.corner).toEqual([0, 255, 0, 255])
  expect(result.repeat.corner).toEqual(result.stretch.corner)
  for (const region of ['horizontal', 'vertical', 'center'] as const) {
    expect(result.stretch[region]).toEqual([255, 0, 0, 255])
    expect(result.repeat[region]).toEqual([0, 0, 255, 255])
  }
  expect(result.empty).toEqual([0, 0, 0, 0])
  expect(result.tiny).toEqual([3, 3])
})

test('fits a mobile screen without page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
  await expect(page.getByRole('button', { name: 'Tiled', exact: true })).toBeVisible()
})
