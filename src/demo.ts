export function createDemo(): string {
  const canvas = document.createElement('canvas')
  canvas.width = 144; canvas.height = 144
  const c = canvas.getContext('2d')!
  c.fillStyle = '#194e43'
  c.beginPath(); c.roundRect(0, 0, 144, 144, 22); c.fill()
  const gradient = c.createLinearGradient(0, 2, 0, 140)
  gradient.addColorStop(0, '#a5d8bd'); gradient.addColorStop(0.12, '#7ebd9e'); gradient.addColorStop(1, '#5c9b7c')
  c.fillStyle = gradient
  c.beginPath(); c.roundRect(3, 3, 138, 136, 19); c.fill()
  c.strokeStyle = '#c6ead4'; c.lineWidth = 2
  c.beginPath(); c.roundRect(7, 7, 130, 128, 15); c.stroke()
  c.fillStyle = '#d3ead3'
  c.beginPath(); c.roundRect(18, 18, 108, 108, 8); c.fill()
  c.strokeStyle = '#3f7a60'; c.lineWidth = 2
  c.beginPath(); c.roundRect(18, 18, 108, 108, 8); c.stroke()
  c.fillStyle = '#b7d6b9'
  for (let y = 28; y < 126; y += 12) for (let x = 28; x < 126; x += 12) {
    c.beginPath(); c.arc(x, y, 1.2, 0, Math.PI * 2); c.fill()
  }
  return canvas.toDataURL('image/png')
}
