import { useCallback, useState } from 'react'

/** The width of an element, kept current as the window changes or the element comes and goes. */
export function useWidth() {
  const [width, setWidth] = useState(0)
  const ref = useCallback((element: HTMLElement | null) => {
    if (element === null) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}
