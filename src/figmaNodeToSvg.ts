import svgPath from 'svgpath'
import { Rectangle } from './figmaApiSchema'
import {
  FigmaComponentNode,
  FigmaFrameBase,
  FigmaNodeTypes,
  FigmaTextNode,
  FigmaVectorBase,
} from './figmaDom'
import { FigmaNode } from './figmaNode'
import { FigmaVariable } from './figmaVariables'
import { type } from 'os'
import { FigmaPaint } from './figmaColor'

export interface FigmaNodeToSvgOptions {
  shouldReferenceVariables?: boolean
  resolveVariableName?: (value: FigmaVariable) => string
}

type Bounds = {
  left: number
  right: number
  top: number
  bottom: number
}

type SVGRenderContext = {
  bounds: Bounds
  cumulativeBounds: Bounds
  depth: number
  isRoot: boolean
}

type Context = {
  [key: string]: any
}

let context: Context = {}

function withContext<T extends Context = Context, R extends any = any>(
  fn: () => R,
  currentContext: T
): R {
  let oldContext = context

  context = currentContext

  try {
    return fn()
  } finally {
    context = oldContext
  }
}

function createSvgContext(
  context: SVGRenderContext | Context
): SVGRenderContext {
  return {
    bounds: context.bounds ?? {
      left: Infinity,
      right: -Infinity,
      top: Infinity,
      bottom: -Infinity,
    },
    cumulativeBounds: context.cumulativeBounds ?? {
      left: Infinity,
      right: -Infinity,
      top: Infinity,
      bottom: -Infinity,
    },
    depth: context.depth ?? 0,
    isRoot: context.isRoot ?? true,
  }
}

function ctx<T extends Context = Context>() {
  return context as T
}

let renderContext: Context = {}

type ToStringContext = {
  depth: number
  isRoot: boolean
}

function createToStringContext(
  context: ToStringContext | Context
): ToStringContext {
  return {
    depth: context.depth ?? 0,
    isRoot: context.isRoot ?? true,
  }
}

function withToStringContext<T extends Context = Context, R extends any = any>(
  fn: () => R,
  currentContext: T
): R {
  let oldContext = renderContext

  renderContext = currentContext

  try {
    return fn()
  } finally {
    renderContext = oldContext
  }
}

export class ToStringElement {
  type: string | null
  props: { [k: string]: any }
  children: (ToStringElement | string)[]

  constructor(
    type: string | null,
    props: { [k: string]: string | number | undefined | boolean },
    children: (ToStringElement | string)[]
  ) {
    this.type = type
    this.props = props
    this.children = children
  }

  *[Symbol.iterator](): IterableIterator<string | ToStringElement> {
    for (let child of this.children) {
      if (child instanceof ToStringElement) {
        if (child.type === null) {
          yield* child
        } else {
          yield child
        }
      }
    }
  }

  toString(opts: { tabWidth?: number } = {}) {
    const { tabWidth = 2 } = opts
    const context = createToStringContext(ctx())

    let childrenContent = ''
    let childrenIndent =
      this.type !== null ? ' '.repeat(context.depth + tabWidth) : ''

    for (let child of this.children) {
      let content = withToStringContext(() => child.toString(), {
        ...context,
        depth: context.depth + 1,
        isRoot: false,
      })

      if (content) {
        childrenContent += `\n${childrenIndent}${content}`
      }
    }

    if (this.type === null) {
      return childrenContent
    }

    let nodeContent = `<${this.type} ${Object.entries(this.props)
      .map(([key, value]) => {
        if (typeof value === 'undefined') {
          return ''
        }

        if (typeof value === 'boolean') {
          return value ? propToAttr(key) : ''
        }

        return `${propToAttr(key)}="${value}"`
      })
      .filter(Boolean)
      .join(' ')}`

    if (childrenContent) {
      nodeContent += `>${childrenContent}\n${' '.repeat(context.depth)}</${
        this.type
      }>`
    } else {
      nodeContent += ` />`
    }

    return nodeContent
  }
}

function propToAttr(prop: string) {
  return prop.replace(/([A-Z])/g, '-$1').toLowerCase()
}

export function figmaNodeToSvg(
  node: FigmaNode,
  options?: FigmaNodeToSvgOptions
) {
  const {
    resolveVariableName = (v: FigmaVariable) =>
      '--' + v.name.split(/[ \/]/g).join('--'),
  } = options ?? {}
  let context = createSvgContext(ctx<SVGRenderContext | Context>())

  let parentBounds = context.bounds
  let cumulativeBounds = {
    ...parentBounds,
  }

  let currentBounds = {
    ...parentBounds,
  }

  expandBounds(currentBounds, node)
  expandBounds(cumulativeBounds, node)

  let children: ToStringElement[] = []

  for (let child of node.children) {
    let childContent = withContext(() => figmaNodeToSvg(child, options), {
      ...context,
      bounds: currentBounds,
      isRoot: false,
    })

    if (childContent) {
      children.push(childContent)
    }
  }

  let type = null
  let props: Record<string, string | number> = {}

  if (node instanceof FigmaTextNode) {
    type = 'text'
    props = {
      x: currentBounds.left,
      y: currentBounds.top,
      width: currentBounds.right - currentBounds.left,
      height: currentBounds.bottom - currentBounds.top,
    }
  }

  if (node instanceof FigmaFrameBase) {
    if (node.clipsContent) {
      let offsetLeft = node.absoluteBoundingBox.x - currentBounds.left
      let offsetTop = node.absoluteBoundingBox.y - currentBounds.top

      let clipPathId = 'clip' + node.id

      children = [
        new ToStringElement(
          'g',
          {
            clipPath: `url(#${clipPathId})`,
          },
          children
        ),
        new ToStringElement(
          'clipPath',
          {
            id: clipPathId,
          },
          [
            new ToStringElement(
              'rect',
              {
                x: offsetLeft,
                y: offsetTop,
                width: currentBounds.right - currentBounds.left,
                height: currentBounds.bottom - currentBounds.top,
              },
              []
            ),
          ]
        ),
      ]
    }
  }

  if (node instanceof FigmaVectorBase) {
    type = null

    let offsetLeft = node.absoluteBoundingBox.x - currentBounds.left
    let offsetTop = node.absoluteBoundingBox.y - currentBounds.top

    children.push(
      ...createPaths(
        node,
        'fillGeometry',
        'fills',
        offsetLeft,
        offsetTop,
        resolveVariableName
      ),
      ...createPaths(
        node,
        'strokeGeometry',
        'strokes',
        offsetLeft,
        offsetTop,
        resolveVariableName
      )
    )
  }

  let element = new ToStringElement(type, props, children)

  if (context.isRoot) {
    return new ToStringElement(
      'svg',
      {
        xmlns: 'http://www.w3.org/2000/svg',
        viewbox: `0 0 ${cumulativeBounds.right - cumulativeBounds.left} ${
          cumulativeBounds.bottom - cumulativeBounds.top
        }`,
        width: cumulativeBounds.right - cumulativeBounds.left,
        height: cumulativeBounds.bottom - cumulativeBounds.top,
      },
      [element]
    )
  }

  return element
}

function isBoundingBoxElement(
  node: FigmaNode
): node is typeof node & { absoluteBoundingBox: Rectangle } {
  return (
    'absoluteBoundingBox' in node &&
    typeof node.absoluteBoundingBox === 'object'
  )
}

function expandBounds(bounds: Bounds, node: FigmaNode) {
  if (isBoundingBoxElement(node)) {
    let { x, y, width, height } = node.absoluteBoundingBox

    bounds.left = Math.min(bounds.left, x)
    bounds.right = Math.max(bounds.right, x + width)
    bounds.top = Math.min(bounds.top, y)
    bounds.bottom = Math.max(bounds.bottom, y + height)
  }
}

export function asyncFigmaNodeToSvg(
  node: FigmaNode,
  options?: FigmaNodeToSvgOptions
): Promise<string> {
  return new Promise((resolve) => {
    resolve('')
  })
}

function createPaths(
  node: FigmaVectorBase,
  geoKey: 'fillGeometry' | 'strokeGeometry',
  fillKey: 'fills' | 'strokes',
  offsetLeft: number,
  offsetTop: number,
  resolveVariableName: (value: FigmaVariable) => string
) {
  const children: ToStringElement[] = []
  if (node[geoKey]?.length) {
    for (let idx = 0; idx < node[geoKey].length; idx++) {
      let pathType = 'path'
      let pathProps: Record<string, string | number | undefined> = {}

      let geo = node[geoKey][idx]
      let fill: FigmaPaint | undefined = node[fillKey][0]

      if (geo.overrideID) {
        fill = node.fillsOverrideTable?.[geo.overrideID].fills[0]
      }

      if (!fill) {
        continue
      }

      const path = svgPath(geo.path).translate(offsetLeft, offsetTop).round(4)

      pathProps.d = path.toString()

      if (node.strokeWeight) {
        pathProps.strokeWidth = node.strokeWeight
      }

      if (node.strokeAlign) {
        pathProps.strokeAlign = node.strokeAlign
      }

      if (node.strokeCap) {
        pathProps.strokeCap = node.strokeCap
      }

      if (node.strokeJoin) {
        pathProps.strokeJoin = node.strokeJoin
      }

      if (geo.windingRule === 'EVENODD') {
        pathProps.fillRule = 'evenodd'
        pathProps.clipRule = 'evenodd'
      } else if (geo.windingRule === 'NONZERO') {
        pathProps.fillRule = 'nonzero'
        pathProps.clipRule = 'nonzero'
      }

      if (node.visible === false) {
        pathProps.visibility = 'hidden'
      }

      if (node.blendMode) {
        pathProps.mixBlendMode = node.blendMode
      }

      if (node.opacity) {
        pathProps.opacity = node.opacity
      }

      if (node.id) {
        pathProps.id = node.id
      }

      if (fill) {
        switch (fill.type) {
          case 'SOLID':
            pathProps.fill = `${fill.color.toString()}`

            if (fill.boundVariables?.color) {
              pathProps.fill = undefined
              pathProps.style = `fill: var(${resolveVariableName(
                fill.boundVariables.color.resolveSync()
              )}, ${fill.color.toString()})`
            }

            break
          case 'GRADIENT_LINEAR':
          case 'GRADIENT_RADIAL':
          case 'GRADIENT_ANGULAR':
          case 'GRADIENT_DIAMOND':
            throw new Error(`${fill.type} not implemented yet`)
        }
      }

      children.push(new ToStringElement(pathType, pathProps, []))
    }
  }

  return children
}
