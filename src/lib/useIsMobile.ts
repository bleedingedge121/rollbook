'use client'

import { useState, useEffect } from 'react'

/**
 * Hook to detect whether the user is on a mobile phone / small screen device.
 * Checks both userAgent (iOS, Android, etc.) and viewport width (< 768px).
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(false)

  useEffect(() => {
    const checkMobile = () => {
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
      const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
      const hasTouch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
      const isNarrow = typeof window !== 'undefined' && window.innerWidth < 768

      setIsMobile(isMobileUA || (hasTouch && isNarrow) || isNarrow)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return isMobile
}
