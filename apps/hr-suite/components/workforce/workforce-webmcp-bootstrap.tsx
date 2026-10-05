'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import {
  registerWorkforceWebMcp,
  type WorkforceWebMcpDescriptor,
} from '@/lib/workforce-tools/webmcp'

interface WorkforceWebMcpBootstrapProps {
  descriptors: readonly WorkforceWebMcpDescriptor[]
  lifecycleKey: string
}

/** Adds WebMCP tools to supported browsers without changing the page UI. */
export function WorkforceWebMcpBootstrap({
  descriptors,
  lifecycleKey,
}: WorkforceWebMcpBootstrapProps) {
  const pathname = usePathname()

  useEffect(() => {
    const lifecycleController = new AbortController()
    void registerWorkforceWebMcp({
      descriptors,
      lifecycleSignal: lifecycleController.signal,
    }).catch(() => undefined)

    return () => lifecycleController.abort()
  }, [descriptors, lifecycleKey, pathname])

  return null
}
