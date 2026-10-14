'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

type RevealProps = {
  children: ReactNode
  delay?: number
  variant?: 'up' | 'scale' | 'fade'
  className?: string
}

export function Reveal({ children, delay = 0, variant = 'up', className }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true)
        observer.disconnect()
      }
    }, { threshold: 0.25 })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const hidden = variant === 'scale' ? 'scale-95' : variant === 'up' ? 'translate-y-8' : ''
  return (
    <div
      ref={ref}
      style={{ transitionDelay: visible ? `${delay}ms` : '0ms' }}
      className={cn(
        'transition-all duration-700 ease-out motion-reduce:transition-none',
        visible ? 'translate-y-0 scale-100 opacity-100' : `opacity-0 ${hidden}`,
        className,
      )}
    >
      {children}
    </div>
  )
}

export default Reveal
