'use client'

import { useState } from 'react'

/* eslint-disable @next/next/no-img-element -- private avatar routes must render directly without remote image configuration. */

interface EmployeePhotoAvatarProps {
  src: string | null
  initials: string
  size: 'large' | 'medium' | 'small' | 'only' | 'collage'
  square?: boolean
  collage?: boolean
}

export function EmployeePhotoAvatar({ src, initials, size, square = false, collage = false }: EmployeePhotoAvatarProps) {
  const [failed, setFailed] = useState(false)
  const circleSize = size === 'large' ? 'h-36 w-36 text-3xl' : size === 'small' ? 'h-14 w-14 text-sm' : 'h-20 w-20 text-lg'
  const squareImageClass = collage ? 'h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]' : 'h-full w-full rounded-lg border border-border object-cover transition-transform duration-200 group-hover:scale-[1.02]'
  const squareInitialsClass = collage ? 'flex h-full w-full items-center justify-center bg-primary text-2xl font-bold tracking-wide text-primary-foreground transition-transform duration-200 group-hover:scale-[1.03]' : 'flex h-full w-full items-center justify-center rounded-lg border border-border bg-primary text-2xl font-bold tracking-wide text-primary-foreground transition-transform duration-200 group-hover:scale-[1.02]'

  if (src && !failed) {
    return <img src={src} alt="" onError={() => setFailed(true)} className={square ? squareImageClass : `${circleSize} rounded-full border-2 border-surface object-cover shadow-lg transition-transform duration-200 group-hover:scale-[1.04]`} />
  }

  return <span aria-hidden="true" className={square ? squareInitialsClass : `flex ${circleSize} items-center justify-center rounded-full border-2 border-surface bg-primary font-bold tracking-wide text-primary-foreground shadow-lg transition-transform duration-200 group-hover:scale-[1.04]`}>{initials}</span>
}
