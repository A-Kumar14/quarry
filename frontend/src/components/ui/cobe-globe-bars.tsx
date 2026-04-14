"use client"

import { useEffect, useRef, useCallback } from "react"
import createGlobe from "cobe"

interface BarMarker {
  id: string
  location: [number, number]
  value: number
  label: string
}

interface GlobeBarsProps {
  markers?: BarMarker[]
  className?: string
  speed?: number
  dark?: boolean
}

const defaultMarkers: BarMarker[] = [
  { id: "bar-1", location: [40.71, -74.01], value: 85, label: "NYC" },
  { id: "bar-2", location: [51.51, -0.13], value: 62, label: "London" },
  { id: "bar-3", location: [35.68, 139.65], value: 94, label: "Tokyo" },
  { id: "bar-4", location: [1.35, 103.82], value: 78, label: "Singapore" },
]

export function GlobeBars({
  markers = defaultMarkers,
  className = "",
  speed = 0.003,
  dark = false,
}: GlobeBarsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointerInteracting = useRef<{ x: number; y: number } | null>(null)
  const dragOffset = useRef({ phi: 0, theta: 0 })
  const phiOffsetRef = useRef(0)
  const thetaOffsetRef = useRef(0)
  const isPausedRef = useRef(false)

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    pointerInteracting.current = { x: e.clientX, y: e.clientY }
    if (canvasRef.current) canvasRef.current.style.cursor = "grabbing"
    isPausedRef.current = true
  }, [])

  const handlePointerUp = useCallback(() => {
    if (pointerInteracting.current !== null) {
      phiOffsetRef.current += dragOffset.current.phi
      thetaOffsetRef.current += dragOffset.current.theta
      dragOffset.current = { phi: 0, theta: 0 }
    }
    pointerInteracting.current = null
    if (canvasRef.current) canvasRef.current.style.cursor = "grab"
    isPausedRef.current = false
  }, [])

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (pointerInteracting.current !== null) {
        dragOffset.current = {
          phi: (e.clientX - pointerInteracting.current.x) / 300,
          theta: (e.clientY - pointerInteracting.current.y) / 1000,
        }
      }
    }
    window.addEventListener("pointermove", handlePointerMove, { passive: true })
    window.addEventListener("pointerup", handlePointerUp, { passive: true })
    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
    }
  }, [handlePointerUp])

  useEffect(() => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    let globe: ReturnType<typeof createGlobe> | null = null
    let animationId: number
    let phi = 0

    function init() {
      const width = canvas.offsetWidth
      if (width === 0 || globe) return

      // Quarry-themed colors
      const baseColor: [number, number, number] = dark
        ? [0.08, 0.10, 0.14]
        : [0.93, 0.90, 0.87]
      const markerColor: [number, number, number] = [0.98, 0.45, 0.09] // Quarry orange
      const glowColor: [number, number, number] = dark
        ? [0.06, 0.08, 0.12]
        : [0.93, 0.88, 0.82]

      globe = createGlobe(canvas, {
        devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        width,
        height: width,
        phi: 0,
        theta: 0.25,
        dark: dark ? 1 : 0,
        diffuse: dark ? 1.2 : 1.8,
        mapSamples: 16000,
        mapBrightness: dark ? 5 : 8,
        baseColor,
        markerColor,
        glowColor,
        markers: markers.map((m) => ({ location: m.location, size: 0.04 })),
      })

      function animate() {
        if (!isPausedRef.current) phi += speed
        globe!.update({
          phi: phi + phiOffsetRef.current + dragOffset.current.phi,
          theta: 0.25 + thetaOffsetRef.current + dragOffset.current.theta,
        })
        animationId = requestAnimationFrame(animate)
      }
      animate()
      setTimeout(() => canvas && (canvas.style.opacity = "1"))
    }

    if (canvas.offsetWidth > 0) {
      init()
    } else {
      const ro = new ResizeObserver((entries) => {
        if (entries[0]?.contentRect.width > 0) {
          ro.disconnect()
          init()
        }
      })
      ro.observe(canvas)
    }

    return () => {
      if (animationId) cancelAnimationFrame(animationId)
      if (globe) globe.destroy()
    }
  }, [markers, speed, dark])

  return (
    <div className={`relative w-full h-full select-none ${className}`}>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        style={{
          width: "100%",
          height: "100%",
          cursor: "grab",
          opacity: 0,
          transition: "opacity 1.2s ease",
          touchAction: "none",
        }}
      />
    </div>
  )
}
