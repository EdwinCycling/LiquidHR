import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { LiquidHRLogo } from './liquidhr-logo'

describe('LiquidHRLogo', () => {
  it('renders the approved horizontal master with intrinsic dimensions and semantic text', () => {
    const markup = renderToStaticMarkup(createElement(LiquidHRLogo, { alt: 'LiquidHR', size: 'md', variant: 'horizontal' }))

    expect(markup).toContain('logo-horizontal-transparent.png')
    expect(markup).toContain('alt="LiquidHR"')
    expect(markup).toContain('width="2039"')
    expect(markup).toContain('height="678"')
    expect(markup).toContain('sizes="136px"')
    expect(markup).toContain('loading="eager"')
  })

  it('marks compact imagery as decorative when its link already has an accessible name', () => {
    const markup = renderToStaticMarkup(createElement(LiquidHRLogo, { decorative: true, size: 'sm', variant: 'mark' }))

    expect(markup).toContain('mark-transparent.png')
    expect(markup).toContain('aria-hidden="true"')
    expect(markup).toContain('alt=""')
    expect(markup).toContain('size-10')
  })
})
