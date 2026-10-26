// Diagnostics for vaso in any browser: what each glass and group built, and what looks broken.
//
// In a validation script:  page.addScriptTag({ path: 'validation/probe.js' }), then page.evaluate(() => vasoProbe())
// In a real browser:       paste this file into the console (Safari: Develop > Show Web Inspector > Console), then
//                          vasoProbe() for a report, or vasoProbe.show() for a live panel on the page
;(() => {
  // Backdrop copies clone the page into glass layers, glasses and groups included; those clones aren't glass
  const isClone = (el) => !!el.parentElement?.closest('[data-vaso]')
  const kindOf = (href) => (!href ? 'none' : href.startsWith('blob:') ? 'blob' : href.startsWith('data:') ? 'data' : 'url')
  const size = (el) => (el ? `${el.offsetWidth}x${el.offsetHeight}` : '-')

  function filterInfo(filter) {
    if (!filter) return null
    const image = filter.querySelector('feImage')
    return {
      units: filter.getAttribute('filterUnits'),
      primitives: filter.children.length,
      bands: filter.querySelectorAll('feDisplacementMap').length,
      map: kindOf(image?.getAttribute('href')),
      // WebKit's framed filters place each primitive in fractions of a frame around the copy
      framed: filter.getAttribute('primitiveUnits') === 'objectBoundingBox',
      area: image && filter.getAttribute('primitiveUnits') === 'objectBoundingBox'
        ? ['x', 'y', 'width', 'height'].map((name) => Number(image.getAttribute(name) ?? NaN).toFixed(3)).join(',')
        : undefined,
    }
  }

  // The copy a glass refracts in Safari and Firefox: the element carrying `filter: url(#…)`, with the clones inside
  function copyInfo(copy, problems, label) {
    if (!copy) return null
    const filterId = /url\("?#([^")]+)"?\)/.exec(copy.style.filter)?.[1]
    const frame = [...copy.children].find((child) => child.tagName === 'SPAN' && !child.hasAttribute('aria-hidden') && !child.childElementCount)
    const clones = [...copy.children].filter((child) => child.getAttribute('aria-hidden') === 'true')
    if (!filterId) problems.push(`${label}: the copy has no filter`)
    else if (!document.getElementById(filterId)) problems.push(`${label}: filter #${filterId} isn't in the document`)
    // Glass away from the viewport doesn't copy until it comes near it
    const r = copy.getBoundingClientRect()
    const near = r.bottom > -100 && r.top < innerHeight + 100 && r.right > -100 && r.left < innerWidth + 100
    if (!clones.length && near) problems.push(`${label}: nothing copied (no ancestor with visible content, or over the size limit)`)
    return {
      filter: filterId ?? null,
      clones: clones.length,
      cloneSize: clones[0] ? `${clones[0].style.width}x${clones[0].style.height}` : '-',
      frame: frame ? `${frame.style.width}x${frame.style.height}` : null,
      clip: copy.style.clipPath || null,
    }
  }

  function vasoProbe() {
    const problems = []
    const groups = [...document.querySelectorAll('[data-vaso-group]')].filter((el) => !isClone(el)).map((root, i) => {
      const id = root.getAttribute('data-vaso-group')
      const label = `group ${i} (${root.className || id})`
      const layer = root.querySelector(':scope > [data-vaso-group-layer]')
      const filter = document.getElementById(id)
      const members = [...root.querySelectorAll('[data-vaso-root]')].filter((el) => !isClone(el)).length
      const path = layer?.style.backdropFilter.includes('url(') ? 'backdrop' : 'copy'
      const copy = path === 'copy' ? layer?.querySelector(':scope > span > span') : null
      const info = filterInfo(filter)
      if (!layer) problems.push(`${label}: no layer`)
      else if (!layer.offsetWidth || !layer.offsetHeight) problems.push(`${label}: the layer has no size`)
      if (!filter) problems.push(`${label}: filter #${id} isn't in the document`)
      if (members && info?.map === 'none') problems.push(`${label}: ${members} members but no displacement map`)
      if (path === 'copy' && !copy) problems.push(`${label}: no copy layer`)
      // Which homepage demo it belongs to, if any
      const demo = root.closest('figure')?.querySelector('figcaption > span')?.textContent.trim() ?? null
      return { id, demo, path, members, layer: size(layer), filter: info, copy: copyInfo(copy, members ? problems : [], label) }
    })

    const glasses = { backdrop: 0, copy: 0, frosted: 0, member: 0 }
    ;[...document.querySelectorAll('[data-vaso-root]')].filter((el) => !isClone(el)).forEach((root, i) => {
      const layer = root.querySelector(':scope > [data-vaso]')
      if (!layer || layer.style.display === 'none') return glasses.member++
      if (layer.style.backdropFilter.includes('url(')) return glasses.backdrop++
      const copy = layer.querySelector(':scope > span[aria-hidden] > span')
      if (!copy) return glasses.frosted++
      glasses.copy++
      copyInfo(copy, problems, `glass ${i} (${root.className || layer.getAttribute('data-vaso')})`)
    })

    return { userAgent: navigator.userAgent, glasses, groups, problems }
  }

  let panel = null
  let timer = 0
  /** A live report pinned to the page, for browsers you can only look at */
  vasoProbe.show = () => {
    panel ??= Object.assign(document.createElement('pre'), { id: 'vaso-probe' })
    Object.assign(panel.style, {
      position: 'fixed', right: '8px', bottom: '8px', zIndex: 2147483647, maxWidth: '520px', maxHeight: '60vh', overflow: 'auto',
      margin: 0, padding: '8px 10px', font: '11px/1.4 ui-monospace, monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
      background: 'rgba(0,0,0,.82)', color: '#fff', borderRadius: '8px', pointerEvents: 'none',
    })
    document.body.appendChild(panel)
    const render = () => {
      const report = vasoProbe()
      panel.textContent = JSON.stringify({ ...report, userAgent: report.userAgent.slice(0, 60) }, null, 1)
    }
    clearInterval(timer)
    timer = setInterval(render, 700)
    render()
  }
  vasoProbe.hide = () => {
    clearInterval(timer)
    panel?.remove()
  }

  window.vasoProbe = vasoProbe
})()
