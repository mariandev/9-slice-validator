import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { Check, ChevronDown, Expand, Grid2X2, ImagePlus, Link2, Maximize2, Minimize2, MousePointer2, Plus, Unlink2 } from 'lucide-react'
import { clampSlice, renderSlice, sliceLayout } from './slice'
import type { SliceOptions, SliceType, Slices } from './slice'
import { createDemo } from './demo'

type Asset = { image: HTMLImageElement; url: string; name: string }
const initialSlices: Slices = { top: 26, right: 26, bottom: 26, left: 26 }
const sides = ['top', 'right', 'bottom', 'left'] as const
const handles = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n))

function App() {
  const [asset, setAsset] = useState<Asset | null>(null)
  const [slices, setSlices] = useState<Slices>(initialSlices)
  const [linked, setLinked] = useState(false)
  const [sliceType, setSliceType] = useState<SliceType>('sliced')
  const smooth = true
  const [box, setBox] = useState({ width: 360, height: 240, x: 0, y: 0 })
  const [guides, setGuides] = useState(false)
  const [background, setBackground] = useState('dots')
  const [zoom, setZoom] = useState(1)
  const [draggingFile, setDraggingFile] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [nativeFullscreen, setNativeFullscreen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const previewPanel = useRef<HTMLElement>(null)
  const isFullscreen = nativeFullscreen || expanded
  const canvas = useRef<HTMLCanvasElement>(null)
  const sourceFrame = useRef<HTMLDivElement>(null)
  const playground = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState({ width: 700, height: 410 })
  const fileInput = useRef<HTMLInputElement>(null)
  const loadVersion = useRef(0)
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const options: SliceOptions = { profile: 'unity', slices, sliceType, assetType: 'sprite', spritePPU: 100, referencePPU: 100, scale: 1, smooth }

  function loadDemo() {
    const version = ++loadVersion.current
    const url = createDemo(), image = new Image()
    image.onload = () => { if (version === loadVersion.current) { setAsset({ image, url, name: 'botanical-panel.png' }); setSlices(initialSlices); setError('') } }
    image.src = url
  }
  useEffect(() => { loadDemo(); return () => { clearTimeout(noticeTimer.current) } }, [])
  useEffect(() => {
    const onFullscreenChange = () => setNativeFullscreen(document.fullscreenElement === previewPanel.current)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])
  useEffect(() => {
    if (!expanded) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setExpanded(false) }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', onKeyDown) }
  }, [expanded])
  useEffect(() => {
    if (!playground.current) return
    const observer = new ResizeObserver(([entry]) => setViewport({ width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(playground.current)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (asset && canvas.current) renderSlice(canvas.current, asset.image, box.width, box.height, options)
  }, [asset, slices, sliceType, box.width, box.height])
  function notify(message: string) { setNotice(message); clearTimeout(noticeTimer.current); noticeTimer.current = setTimeout(() => setNotice(''), 2800) }
  async function toggleFullscreen() {
    if (document.fullscreenElement === previewPanel.current) {
      await document.exitFullscreen()
    } else if (expanded) {
      setExpanded(false)
    } else {
      try {
        if (!previewPanel.current?.requestFullscreen) { setExpanded(true); return }
        await previewPanel.current.requestFullscreen()
      } catch {
        // Embedded browsers can block the Fullscreen API; expand within the viewport instead.
        setExpanded(true)
      }
    }
  }
  async function upload(file?: File) {
    if (!file) return
    const version = ++loadVersion.current
    setError('')
    if (file.size > 25 * 1024 * 1024) { setError('Please choose an image smaller than 25 MB.'); return }
    try {
      const url = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file) })
      const image = new Image(); image.src = url; await image.decode()
      if (version !== loadVersion.current) return
      if (image.naturalWidth > 8192 || image.naturalHeight > 8192 || image.naturalWidth * image.naturalHeight > 32000000) throw new Error('size')
      const inset = 0
      setAsset({ image, url, name: file.name }); setSlices({ top: inset, right: inset, bottom: inset, left: inset }); setZoom(1)
      notify('Image ready. Make it your own.')
    } catch (err) { if (version === loadVersion.current) setError(err instanceof Error && err.message === 'size' ? 'Please use an image up to 8192 px per side and 32 megapixels.' : 'This image could not be opened. Try a PNG, JPG, WebP, or SVG.') }
  }

  function updateSlice(side: keyof Slices, value: number) {
    if (!asset) return
    if (linked) {
      const next = clamp(Math.round(value) || 0, 0, Math.floor(Math.min(asset.image.naturalWidth, asset.image.naturalHeight) / 2))
      setSlices({ top: next, right: next, bottom: next, left: next })
    } else setSlices(old => clampSlice(old, side, value, asset.image.naturalWidth, asset.image.naturalHeight))
  }

  function dragGuide(event: ReactPointerEvent<HTMLButtonElement>, side: keyof Slices) {
    if (!asset || !sourceFrame.current) return
    event.preventDefault()
    const rect = sourceFrame.current.getBoundingClientRect()
    const move = (e: PointerEvent) => {
      const x = (e.clientX - rect.left) / rect.width * asset.image.naturalWidth
      const y = (e.clientY - rect.top) / rect.height * asset.image.naturalHeight
      updateSlice(side, side === 'left' ? x : side === 'right' ? asset.image.naturalWidth - x : side === 'top' ? y : asset.image.naturalHeight - y)
    }
    trackPointer(event, move)
  }

  function trackPointer(event: ReactPointerEvent<HTMLElement>, move: (e: PointerEvent) => void) {
    const target = event.currentTarget
    target.setPointerCapture(event.pointerId)
    const stop = () => { target.removeEventListener('pointermove', move); target.removeEventListener('pointerup', stop); target.removeEventListener('pointercancel', stop); target.removeEventListener('lostpointercapture', stop) }
    target.addEventListener('pointermove', move); target.addEventListener('pointerup', stop); target.addEventListener('pointercancel', stop); target.addEventListener('lostpointercapture', stop)
  }

  function resize(event: ReactPointerEvent<HTMLButtonElement>, handle: typeof handles[number]) {
    event.preventDefault()
    const start = { ...box }, startX = event.clientX, startY = event.clientY
    trackPointer(event, e => {
      const dx = e.clientX - startX, dy = e.clientY - startY
      const width = clamp(Math.round(start.width + (handle.includes('e') ? dx : handle.includes('w') ? -dx : 0)), 32, 2048)
      const height = clamp(Math.round(start.height + (handle.includes('s') ? dy : handle.includes('n') ? -dy : 0)), 32, 2048)
      setBox({ width, height, x: start.x + (handle.includes('w') ? (start.width - width) / 2 : handle.includes('e') ? (width - start.width) / 2 : 0), y: start.y + (handle.includes('n') ? (start.height - height) / 2 : handle.includes('s') ? (height - start.height) / 2 : 0) })
    })
  }

  const sourceWidth = asset?.image.naturalWidth ?? 144, sourceHeight = asset?.image.naturalHeight ?? 144
  const fit = Math.min(240 / sourceWidth, 208 / sourceHeight) * zoom
  const previewLeft = Math.max(30, viewport.width / 2 + box.x - box.width / 2)
  const previewTop = Math.max(40, viewport.height / 2 + box.y - box.height / 2)
  const layout = sliceLayout(sourceWidth, sourceHeight, box.width, box.height, options)
  const guideStyle = { '--slice-top': `${slices.top / sourceHeight * 100}%`, '--slice-right': `${slices.right / sourceWidth * 100}%`, '--slice-bottom': `${slices.bottom / sourceHeight * 100}%`, '--slice-left': `${slices.left / sourceWidth * 100}%` } as CSSProperties

  return <div className="app-shell">
    <main className="editor-layout">

      <div className="editor-grid">
          <section className={`panel source-panel ${draggingFile ? 'file-hover' : ''}`} onDragOver={e => {
            if (!e.dataTransfer.types.includes('Files')) return
            e.preventDefault()
            e.dataTransfer.dropEffect = 'copy'
            setDraggingFile(true)
          }} onDragLeave={e => {
            if (!(e.relatedTarget instanceof Node) || !e.currentTarget.contains(e.relatedTarget)) setDraggingFile(false)
          }} onDrop={e => {
            e.preventDefault()
            setDraggingFile(false)
            void upload(e.dataTransfer.files[0])
          }}>
            <div className="panel-heading"><h2><span className="step">01</span>Source image</h2></div>
            <input ref={fileInput} type="file" accept="image/*" className="sr-only" onChange={e => { void upload(e.target.files?.[0]); e.target.value = '' }} />
            <div className="source-workspace checker">
              <span className="canvas-label">SOURCE / SLICE GUIDES</span>
              <div className="source-scroll"><div ref={sourceFrame} className="source-frame" style={{ ...guideStyle, width: sourceWidth * fit, height: sourceHeight * fit }}>
                {asset && <img draggable={false} src={asset.url} alt="Source with draggable slice boundaries" style={{ imageRendering: smooth ? 'auto' : 'pixelated' }} />}
                <div className="source-center" />
                {sides.map(side => <button key={side} className={`slice-guide guide-${side}`} onPointerDown={e => dragGuide(e, side)} aria-label={`Drag ${side} slice guide`} onKeyDown={e => { if (['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].includes(e.key)) { e.preventDefault(); updateSlice(side, slices[side] + (['ArrowUp', 'ArrowRight'].includes(e.key) ? 1 : -1) * (e.shiftKey ? 10 : 1)) } }}><span /></button>)}
              </div></div>
              <div className="source-bottom"><span><MousePointer2 size={12} />Drag guides to slice</span><button onClick={() => setZoom(zoom === 1 ? 2 : 1)} title="Toggle source zoom">{zoom === 1 ? 'Fit' : '2×'}<ChevronDown size={12} /></button></div>
            </div>
            <div className="source-file-bar">
              <div className="file-row"><span className="file-icon"><ImagePlus size={17} /></span><div><strong title={asset?.name}>{asset?.name ?? 'Loading sample…'}</strong><span>{sourceWidth} × {sourceHeight} px <i>·</i> {asset?.name.split('.').pop()?.toUpperCase()}</span></div></div>
              <button className="upload-zone" onClick={() => fileInput.current?.click()}><Plus size={15} /> Upload image <span>or drop anywhere in this box</span></button>
            </div>
            {error && <p className="error" role="alert">{error}</p>}
          </section>

          <section className="panel offsets-panel"><div className="panel-heading"><h2><span className="step">02</span>Slice settings</h2><button className={`icon-button ${linked ? 'selected' : ''}`} title="Link all slice values" aria-label="Link all slice values" aria-pressed={linked} onClick={() => setLinked(!linked)}>{linked ? <Link2 size={16} /> : <Unlink2 size={16} />}</button></div>
            <p className="section-description">Keep the corners. Give the rest room to grow.</p>
            <div className="inset-grid">{sides.map(side => <label className="number-field" key={side}><span><i className={`side-icon side-${side}`} />{side}</span><div><input aria-label={side} type="number" min="0" max={side === 'top' || side === 'bottom' ? sourceHeight - slices[side === 'top' ? 'bottom' : 'top'] : sourceWidth - slices[side === 'left' ? 'right' : 'left']} value={slices[side]} onChange={e => updateSlice(side, Number(e.target.value))} /><span>px</span></div></label>)}</div>
            <div className="inset-footer"><span className="orange-dot" />Insets are measured from each edge.</div>
            <div className="slice-type-settings"><div className="unity-type-row"><span>Slice type</span><div className="segmented" aria-label="Slice type">{(['sliced', 'tiled'] as const).map(type => <button key={type} aria-pressed={sliceType === type} className={sliceType === type ? 'active' : ''} onClick={() => setSliceType(type)}>{type === 'sliced' ? <Expand size={13} /> : <Grid2X2 size={13} />}{type === 'sliced' ? 'Sliced' : 'Tiled'}</button>)}</div></div><p className="unity-explanation">{sliceType === 'sliced' ? 'Edges and center stretch to fill. Corners keep their shape.' : 'Edges and center repeat. Corners keep their shape.'}</p></div>
          </section>
          <section ref={previewPanel} className={`panel preview-panel ${expanded ? 'is-expanded' : ''}`}><div className="panel-heading"><h2><span className="step">03</span>Live playground</h2><div className="preview-tools"><div className="background-options" aria-label="Preview background">{['dots', 'light', 'dark'].map(bg => <button key={bg} className={`swatch swatch-${bg} ${background === bg ? 'active' : ''}`} aria-label={`${bg} background`} aria-pressed={background === bg} onClick={() => setBackground(bg)} />)}</div><button className={`icon-button ${guides ? 'selected' : ''}`} aria-label="Show preview slice guides" title="Show preview slice guides" aria-pressed={guides} onClick={() => setGuides(!guides)}><Grid2X2 size={16} /></button><button className="icon-button" aria-label={isFullscreen ? 'Exit preview fullscreen' : 'Enter preview fullscreen'} title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen preview'} aria-pressed={isFullscreen} onClick={() => { void toggleFullscreen() }}>{isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button></div></div>
            <div className={`playground bg-${background}`}><div className="playground-scroll" ref={playground}><div className="playground-area" style={{ minWidth: previewLeft + box.width + 30, minHeight: Math.max(viewport.height, previewTop + box.height + 55) }}>
              <span className="canvas-label">THE POSSIBILITIES ARE RESIZABLE</span>
              <div className="resize-box" style={{ width: box.width, height: box.height, left: previewLeft, top: previewTop, transform: 'none' }}>
                <canvas ref={canvas} aria-label={`Nine-slice preview, ${box.width} by ${box.height} pixels`} />
                {guides && <div className="preview-guides" style={{ '--slice-top': `${layout.dy[1]}px`, '--slice-bottom': `${box.height - layout.dy[2]}px`, '--slice-left': `${layout.dx[1]}px`, '--slice-right': `${box.width - layout.dx[2]}px` } as CSSProperties}>{sides.map(side => <i key={side} className={`preview-guide guide-${side}`} />)}</div>}
                <span className="size-badge">{box.width} × {box.height}</span>
                {handles.map(handle => <button key={handle} className={`resize-handle handle-${handle}`} aria-label={`Resize ${handle}`} title={`Drag to resize (${handle})`} onPointerDown={e => resize(e, handle)} onKeyDown={e => { if (['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].includes(e.key)) { e.preventDefault(); const delta = e.shiftKey ? 10 : 1; setBox(b => ({ ...b, width: clamp(b.width + (e.key === 'ArrowRight' ? delta : e.key === 'ArrowLeft' ? -delta : 0), 32, 2048), height: clamp(b.height + (e.key === 'ArrowDown' ? delta : e.key === 'ArrowUp' ? -delta : 0), 32, 2048) })) } }} />)}
              </div>
            </div></div><span className="drag-hint"><MousePointer2 size={13} />Pull an edge or corner. See what happens.</span></div>
          </section>

      </div>
    </main>
    {notice && <div className="toast" role="status"><Check size={16} />{notice}</div>}

  </div>
}
export default App


