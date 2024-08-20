import { FigmaColor, createFigmaPaint, FigmaPaint } from './figmaColor'
import {
  ApiNode,
  ApiNodeType,
  isNodeType,
  isNodeWithChildren,
  ExportSetting,
  StrokeAlign,
  LayoutConstraint,
  Rectangle,
  Transform,
  AxisSizingMode,
  LayoutGrid,
  Effect,
  BlendMode,
  LayoutAlign,
  EasingType,
  Vector,
  StrokeCap,
  Path,
  StrokeJoin,
  StylesMap,
  BooleanOperationType,
  TypeStyle,
  LineTypes,
} from './figmaSchema'
import { FigmaVariableLibrary } from './figmaVariables'

const stateField = Symbol('state')

type QuerySelector<T extends FigmaNode> = {
  nodeType?: new (...args: any[]) => T
} & {
  [P in keyof T]?: T[P] | RegExp | ((value: T[P]) => boolean)
}

export class FigmaNodeList<T extends FigmaNode> {
  [stateField] = {
    nodes: undefined as T[] | undefined,
    iter: undefined! as IterableIterator<T>,
  }

  constructor(iter: IterableIterator<T>) {
    this[stateField].iter = iter
  }

  toArray() {
    if (this[stateField].nodes === undefined) {
      this[stateField].nodes = Array.from(this[stateField].iter)
    }

    return this[stateField].nodes
  }

  [Symbol.iterator]() {
    return this[stateField].iter
  }

  item(index: number) {
    return this.toArray()[index]
  }

  get length() {
    return this.toArray().length
  }
}

const figmaNode = Symbol('nodeType')
const typeField = Symbol('type')

export class FigmaNode {
  [figmaNode] = true;
  [typeField] = 'FigmaNode'

  id: string = ''
  name: string = ''
  visible: boolean = true
  pluginData: any
  sharedPluginData: any
  isFixed?: boolean

  firstChild: FigmaNode | null = null
  lastChild: FigmaNode | null = null

  previousSibling: FigmaNode | null = null
  nextSibling: FigmaNode | null = null
  parentNode: FigmaNode | null = null

  constructor(node: {
    id: string
    name: string
    visible: boolean
    pluginData: any
    sharedPluginData: any
    isFixed?: boolean
  }) {
    this.id = node.id
    this.name = node.name
    this.visible = node.visible
    this.pluginData = node.pluginData
    this.sharedPluginData = node.sharedPluginData
    this.isFixed = node.isFixed
  }

  static isNode(value: any): value is FigmaNode {
    return value[figmaNode] === true
  }

  static isType(value: any): value is FigmaNode {
    return value[typeField] === 'FigmaNode'
  }

  matches<T extends FigmaNode>(query: QuerySelector<T>): this is T {
    if (query.nodeType && !(this instanceof query.nodeType)) {
      return false
    }
    for (const key of Object.keys(query) as (keyof QuerySelector<T>)[]) {
      if (key === 'nodeType') {
        continue
      }

      debugger

      if (!(key in this)) {
        return false
      }

      const value = query[key]

      const k = key as keyof this

      if (value instanceof RegExp) {
        if (typeof this[k] !== 'string') {
          return false
        }

        if (!value.test(this[k])) {
          return false
        }
      } else if (typeof value === 'function') {
        if (!value(this[k])) {
          return false
        }
      } else if (this[k] !== value) {
        return false
      }
    }

    return true
  }

  querySelector<T extends FigmaNode>(query: QuerySelector<T>) {
    for (let item of this.querySelectorAll<T>(query)) {
      return item
    }

    return null
  }

  querySelectorAll<T extends FigmaNode>(
    query: QuerySelector<T>
  ): FigmaNodeList<T> {
    let nextChild = this.firstChild

    return new FigmaNodeList<T>({
      [Symbol.iterator]() {
        return this
      },
      next() {
        while (nextChild) {
          if (nextChild.matches(query)) {
            const node = nextChild
            nextChild = nextChild.nextSibling
            return {
              value: node,
              done: false,
            }
          } else {
            nextChild = nextChild.nextSibling
          }
        }
        return {
          done: true,
          value: undefined,
        }
      },
    })
  }

  appendChild(node: FigmaNode, after: FigmaNode | null = this.lastChild) {
    if (after) {
      node.previousSibling = after
      node.nextSibling = after.nextSibling
      after.nextSibling = node
    }
    if (this.lastChild === after) {
      this.lastChild = node
    }
    if (this.firstChild === null) {
      this.firstChild = node
    }
    node.parentNode = this
  }

  get children() {
    let currentNode: FigmaNode | null | undefined = this.firstChild

    const iter = {
      next() {
        if (currentNode) {
          let node = currentNode
          currentNode = currentNode?.nextSibling
          return {
            value: node,
            done: false as false,
          }
        } else {
          return {
            done: true as true,
            value: undefined,
          }
        }
      },
      [Symbol.iterator]() {
        return this
      },
    }

    return new FigmaNodeList(iter)
  }

  remove() {
    if (this.parentNode?.firstChild === this) {
      this.parentNode.firstChild = this.nextSibling
    }
    if (this.parentNode?.lastChild === this) {
      this.parentNode.lastChild = this.previousSibling
    }

    if (this.previousSibling) {
      this.previousSibling.nextSibling = this.nextSibling
    }
    if (this.nextSibling) {
      this.nextSibling.previousSibling = this.previousSibling
    }

    this.parentNode = null
  }
}

export class FigmaDocument extends FigmaNode {
  apiNode: ApiNode<ApiNodeType.DOCUMENT>
  library: FigmaVariableLibrary;

  [typeField] = 'FigmaDocument'

  static isType(value: any): value is FigmaDocument {
    return value[typeField] === 'FigmaDocument'
  }

  constructor(
    node: FigmaDocument | ApiNode<ApiNodeType.DOCUMENT>,
    library: FigmaVariableLibrary
  ) {
    super(node)
    this.library = library

    if (FigmaNode.isNode(node) && node instanceof FigmaDocument) {
      this.id = node.id
      this.name = node.name
      this.visible = node.visible
      this.apiNode = node.apiNode
    } else {
      this.id = node.id
      this.name = node.name
      this.visible = node.visible
      this.apiNode = node
    }
  }

  static apiNodeToFigmaNode(
    node: ApiNode<ApiNodeType>,
    library: FigmaVariableLibrary
  ) {
    let figmaNode: FigmaNode
    switch (true) {
      case isNodeType(node, ApiNodeType.DOCUMENT):
        figmaNode = new FigmaDocument(node, library)
        break
      case isNodeType(node, ApiNodeType.CANVAS):
        figmaNode = new FigmaCanvasNode(node, library)
        break
      case isNodeType(node, ApiNodeType.FRAME):
        figmaNode = new FigmaFrameNode(node)
        break
      default:
        throw new Error(`Unknown node type: ${node.type}`)
    }

    if (isNodeWithChildren(node)) {
      for (let child of node.children) {
        figmaNode.appendChild(FigmaDocument.apiNodeToFigmaNode(child, library))
      }
    }

    return figmaNode
  }

  static async fromApi(fileKey: string, branchKey: string, apiKey: string) {
    const response = await fetch(
      `https://api.figma.com/v1/files/${fileKey}?branch=${branchKey}`,
      {
        headers: {
          'X-Figma-Token': apiKey,
        },
      }
    )

    const data = await response.json()

    return new FigmaDocument(
      data as ApiNode<ApiNodeType.DOCUMENT>,
      new FigmaVariableLibrary(fileKey, branchKey, apiKey)
    )
  }
}

export class FigmaCanvasNode extends FigmaNode {
  backgroundColor: FigmaColor
  exportSettings: ExportSetting[]
  prototypeStartNodeID?: string | null

  apiNode: ApiNode<ApiNodeType.CANVAS>
  library: FigmaVariableLibrary;

  [typeField] = 'FigmaCanvas'

  static isType(value: any): value is FigmaCanvasNode {
    return value[typeField] === 'FigmaCanvas'
  }

  constructor(
    node: FigmaCanvasNode | ApiNode<ApiNodeType.CANVAS>,
    library: FigmaVariableLibrary
  ) {
    super(node)
    this.library = library
    this.exportSettings = node.exportSettings

    if (FigmaNode.isNode(node) && node instanceof FigmaCanvasNode) {
      this.id = node.id
      this.name = node.name
      this.visible = node.visible
      this.apiNode = node.apiNode
      this.backgroundColor = new FigmaColor(node.backgroundColor)
    } else {
      this.id = node.id
      this.name = node.name
      this.visible = node.visible
      this.apiNode = node
      this.backgroundColor = new FigmaColor(node.backgroundColor)
    }
  }
}

export class FigmaFrameBase extends FigmaNode {
  locked?: boolean
  background!: FigmaPaint[]
  backgroundColor?: FigmaColor
  fills!: FigmaPaint[]
  strokes!: FigmaPaint[]
  strokeWeight!: number
  individualStrokeWeights?: {
    top: number
    right: number
    bottom: number
    left: number
  }
  strokeAlign!: StrokeAlign
  cornerRadius!: number
  rectangleCornerRadii!: [number, number, number, number]
  exportSettings!: ExportSetting[]
  blendMode!: BlendMode
  preserveRatio!: boolean
  constraints!: LayoutConstraint
  layoutAlign!: LayoutAlign
  layoutGrow?: number
  transitionNodeID?: string | null
  transitionDuration?: number | null
  transitionEasing?: EasingType | null
  opacity?: number
  absoluteBoundingBox!: Rectangle
  size?: Vector
  relativeTransform?: Transform
  clipsContent!: boolean
  layoutMode!: 'NONE' | 'HORIZONTAL' | 'VERTICAL'
  primaryAxisSizingMode!: AxisSizingMode
  counterAxisSizingMode!: AxisSizingMode
  primaryAxisAlignItems!: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN'
  counterAxisAlignItems!: 'MIN' | 'CENTER' | 'MAX' | 'BASELINE'
  paddingLeft!: number
  paddingRight!: number
  paddingTop!: number
  paddingBottom!: number
  horizontalPadding!: number
  verticalPadding!: number
  itemSpacing!: number
  itemReverseZIndex!: boolean
  strokesIncludedInLayout!: boolean
  overflowDirection!:
    | 'NONE'
    | 'HORIZONTAL_SCROLLING'
    | 'VERTICAL_SCROLLING'
    | 'HORIZONTAL_AND_VERTICAL_SCROLLING'
  layoutGrids?: LayoutGrid[]
  effects!: Effect[]
  isMask!: boolean
  isMaskOutline!: boolean
  layoutPositioning!: 'AUTO' | 'ABSOLUTE'

  constructor(
    node:
      | FigmaFrameBase
      | ApiNode<
          | ApiNodeType.FRAME
          | ApiNodeType.GROUP
          | ApiNodeType.COMPONENT
          | ApiNodeType.COMPONENT_SET
          | ApiNodeType.INSTANCE
        >
  ) {
    super(node)

    const allFieldKeys = [
      'id',
      'name',
      'visible',
      'background',
      'backgroundColor',
      'fills',
      'strokes',
      'strokeWeight',
      'individualStrokeWeights',
      'strokeAlign',
      'cornerRadius',
      'rectangleCornerRadii',
      'exportSettings',
      'blendMode',
      'preserveRatio',
      'constraints',
      'layoutAlign',
      'layoutGrow',
      'transitionNodeID',
      'transitionDuration',
      'transitionEasing',
      'opacity',
      'absoluteBoundingBox',
      'size',
      'relativeTransform',
      'clipsContent',
      'layoutMode',
      'primaryAxisSizingMode',
      'counterAxisSizingMode',
      'primaryAxisAlignItems',
      'counterAxisAlignItems',
      'paddingLeft',
      'paddingRight',
      'paddingTop',
      'paddingBottom',
      'horizontalPadding',
      'verticalPadding',
      'itemSpacing',
      'itemReverseZIndex',
      'strokesIncludedInLayout',
      'overflowDirection',
      'layoutGrids',
      'effects',
      'isMask',
      'isMaskOutline',
      'layoutPositioning',
    ]

    for (const key of allFieldKeys) {
      switch (key) {
        case 'background':
        case 'fills':
        case 'strokes':
          if (!FigmaNode.isNode(node)) {
            this[key] = node[key].map((paint) => createFigmaPaint(paint))
          } else {
            this[key] = node[key]
          }
          break
        case 'backgroundColor':
          this[key] = node[key] ? new FigmaColor(node[key]) : undefined
          break
        default:
          // @ts-ignore
          this[key] = node[key]!
      }
    }
  }
}

export class FigmaFrameNode extends FigmaFrameBase {
  apiNode: ApiNode<ApiNodeType.FRAME>;

  [typeField] = 'FigmaFrame'

  static isType(value: any): value is FigmaFrameNode {
    return value[typeField] === 'FigmaFrame'
  }

  constructor(node: FigmaFrameNode | ApiNode<ApiNodeType.FRAME>) {
    super(node)

    if (FigmaNode.isNode(node) && node instanceof FigmaFrameNode) {
      this.apiNode = node.apiNode
    } else {
      this.apiNode = node
    }
  }
}

export class FigmaGroupNode extends FigmaFrameBase {
  apiNode: ApiNode<ApiNodeType.GROUP>;

  [typeField] = 'FigmaGroup'

  static isType(value: any): value is FigmaGroupNode {
    return value[typeField] === 'FigmaGroup'
  }

  constructor(node: FigmaGroupNode | ApiNode<ApiNodeType.GROUP>) {
    super(node)

    if (FigmaNode.isNode(node) && node instanceof FigmaGroupNode) {
      this.apiNode = node.apiNode
    } else {
      this.apiNode = node
    }
  }
}

export class FigmaComponentNode extends FigmaFrameBase {
  apiNode: ApiNode<ApiNodeType.COMPONENT>;

  [typeField] = 'FigmaComponent'

  static isType(value: any): value is FigmaComponentNode {
    return value[typeField] === 'FigmaComponent'
  }

  constructor(node: FigmaComponentNode | ApiNode<ApiNodeType.COMPONENT>) {
    super(node)

    if (FigmaNode.isNode(node) && node instanceof FigmaComponentNode) {
      this.apiNode = node.apiNode
    } else {
      this.apiNode = node
    }
  }
}

export class FigmaComponentSetNode extends FigmaFrameBase {
  apiNode: ApiNode<ApiNodeType.COMPONENT_SET>;

  [typeField] = 'FigmaComponentSet'

  static isType(value: any): value is FigmaComponentSetNode {
    return value[typeField] === 'FigmaComponentSet'
  }

  constructor(
    node: FigmaComponentSetNode | ApiNode<ApiNodeType.COMPONENT_SET>
  ) {
    super(node)

    if (FigmaNode.isNode(node) && node instanceof FigmaComponentSetNode) {
      this.apiNode = node.apiNode
    } else {
      this.apiNode = node
    }
  }
}

export class FigmaInstanceNode extends FigmaFrameBase {
  apiNode: ApiNode<ApiNodeType.INSTANCE>;

  [typeField] = 'FigmaInstance'

  static isType(value: any): value is FigmaInstanceNode {
    return value[typeField] === 'FigmaInstance'
  }

  constructor(node: FigmaInstanceNode | ApiNode<ApiNodeType.INSTANCE>) {
    super(node)

    if (FigmaNode.isNode(node) && node instanceof FigmaInstanceNode) {
      this.apiNode = node.apiNode
    } else {
      this.apiNode = node
    }
  }
}

export class FigmaVectorBase extends FigmaNode {
  /** default: [] An array of export settings representing images to export from node */
  exportSettings!: ExportSetting[]
  /** If true, layer is locked and cannot be edited, default `false` */
  locked?: boolean
  /** How this node blends with nodes behind it in the scene (see blend mode section for more details) */
  blendMode!: BlendMode
  /** default: false Keep height and width constrained to same ratio */
  preserveRatio?: boolean
  /** Determines if the layer should stretch along the parent’s counter axis. This property is only provided for direct children of auto-layout frames. */
  layoutAlign!: LayoutAlign
  /** default: 0. This property is applicable only for direct children of auto-layout frames, ignored otherwise. Determines whether a layer should stretch along the parent’s primary axis. A 0 corresponds to a fixed size and 1 corresponds to stretch. */
  layoutGrow?: number
  /** Horizontal and vertical layout constraints for node */
  constraints!: LayoutConstraint
  /** default: null Node ID of node to transition to in prototyping */
  transitionNodeID?: string | null
  /** default: null The duration of the prototyping transition on this node (in milliseconds). */
  transitionDuration?: number | null
  /** default: null The easing curve used in the prototyping transition on this node. */
  transitionEasing?: EasingType | null
  /** default: 1 Opacity of the node */
  opacity?: number
  /** Bounding box of the node in absolute space coordinates */
  absoluteBoundingBox!: Rectangle
  /** Width and height of element. This is different from the width and height of the bounding box in that the absolute bounding box represents the element after scaling and rotation. Only present if geometry=paths is passed */
  size?: Vector
  /** The top two rows of a matrix that represents the 2D transform of this node relative to its parent. The bottom row of the matrix is implicitly always (0, 0, 1). Use to transform coordinates in geometry. Only present if geometry=paths is passed */
  relativeTransform?: Transform
  /** default: [] An array of effects attached to this node (see effects section for more details) */
  effects?: Effect[]
  /** default: false Does this node mask sibling nodes in front of it? */
  isMask?: boolean
  /** default: [] An array of fill paints applied to the node */
  fills!: FigmaPaint[]
  /** Only specified if parameter geometry=paths is used. An array of paths representing the object fill */
  fillGeometry?: Path[]
  /** default: [] An array of stroke paints applied to the node */
  strokes!: FigmaPaint[]
  /** The weight of strokes on the node */
  strokeWeight!: number
  /** The weight of strokes on different side of the node */
  individualStrokeWeights?: {
    top: number
    right: number
    left: number
    bottom: number
  }
  /** default: NONE. A string enum with value of "NONE", "ROUND", "SQUARE", "LINE_ARROW", or "TRIANGLE_ARROW", describing the end caps of vector paths. */
  strokeCap?: StrokeCap
  /** Only specified if parameter geometry=paths is used. An array of paths representing the object stroke */
  strokeGeometry?: Path[]
  /** Where stroke is drawn relative to the vector outline as a string enum
  "INSIDE": draw stroke inside the shape boundary
  "OUTSIDE": draw stroke outside the shape boundary
  "CENTER": draw stroke centered along the shape boundary */
  strokeAlign!: StrokeAlign
  /** A string enum with value of "MITER", "BEVEL", or "ROUND", describing how corners in vector paths are rendered. */
  strokeJoin?: StrokeJoin
  /** An array of floating point numbers describing the pattern of dash length and gap lengths that the vector path follows. For example a value of [1, 2] indicates that the path has a dash of length 1 followed by a gap of length 2, repeated. */
  strokeDashes?: number[]
  /** Only valid if strokeJoin is "MITER". The corner angle, in degrees, below which strokeJoin will be set to "BEVEL" to avoid super sharp corners. By default this is 28.96 degrees. */
  strokeMiterAngle?: number
  /** A mapping of a StyleType to style ID (see Style) of styles present on this node. The style ID can be used to look up more information about the style in the top-level styles field. */
  styles?: StylesMap
  /** default: AUTO */
  layoutPositioning!: 'AUTO' | 'ABSOLUTE'

  constructor(
    node:
      | FigmaVectorBase
      | ApiNode<
          | ApiNodeType.VECTOR
          | ApiNodeType.STAR
          | ApiNodeType.LINE
          | ApiNodeType.ELLIPSE
          | ApiNodeType.REGULAR_POLYGON
          | ApiNodeType.RECTANGLE
          | ApiNodeType.TEXT
          | ApiNodeType.BOOLEAN_OPERATION
          | ApiNodeType.BOOLEAN
        >
  ) {
    super(node)

    const allFieldKeys = [
      'id',
      'name',
      'visible',
      'exportSettings',
      'locked',
      'blendMode',
      'preserveRatio',
      'layoutAlign',
      'layoutGrow',
      'constraints',
      'transitionNodeID',
      'transitionDuration',
      'transitionEasing',
      'opacity',
      'absoluteBoundingBox',
      'size',
      'relativeTransform',
      'effects',
      'isMask',
      'fills',
      'strokes',
      'strokeWeight',
      'individualStrokeWeights',
      'strokeAlign',
      'layoutPositioning',
      'strokeJoin',
      'strokeCap',
      'strokeDashes',
      'strokeMiterAngle',
      'styles',
    ] as const

    for (const key of allFieldKeys) {
      if (key in node) {
        switch (key) {
          case 'fills':
          case 'strokes':
            if (!FigmaNode.isNode(node)) {
              this[key] = node[key].map((paint) => createFigmaPaint(paint))
            } else {
              this[key] = node[key]
            }
            break
          default:
            // @ts-ignore
            this[key] = node[key]
        }
      }
    }
  }
}

export class FigmaVectorNode extends FigmaVectorBase {
  apiNode: ApiNode<ApiNodeType.VECTOR>;

  [typeField] = 'FigmaVector'

  static isType(value: any): value is FigmaVectorNode {
    return value[typeField] === 'FigmaVector'
  }

  constructor(node: FigmaVectorNode | ApiNode<ApiNodeType.VECTOR>) {
    super(node)

    if (FigmaNode.isNode(node) && node instanceof FigmaVectorNode) {
      this.apiNode = node.apiNode
    } else {
      this.apiNode = node
    }
  }
}

export class FigmaBooleanNode extends FigmaVectorBase {
  apiNode: ApiNode<ApiNodeType.BOOLEAN_OPERATION>;

  [typeField] = 'FigmaBooleanNode'

  static isType(value: any): value is FigmaBooleanNode {
    return value[typeField] === 'FigmaBooleanNode'
  }

  constructor(node: FigmaBooleanNode | ApiNode<ApiNodeType.BOOLEAN_OPERATION>) {
    super(node)

    const allFieldKeys = [] as const

    for (const key of allFieldKeys) {
      if (key in node) {
        // @ts-ignore
        this[key] = node[key]
      }
    }

    if (FigmaNode.isNode(node) && node instanceof FigmaBooleanNode) {
      this.apiNode = node.apiNode
    } else {
      this.apiNode = node
    }
  }
}

export class FigmaBooleanOperationNode extends FigmaVectorBase {
  apiNode: ApiNode<ApiNodeType.BOOLEAN_OPERATION>;

  [typeField] = 'FigmaBooleanOperationNode'
  booleanOperation!: BooleanOperationType

  static isType(value: any): value is FigmaBooleanOperationNode {
    return value[typeField] === 'FigmaBooleanOperationNode'
  }

  constructor(
    node: FigmaBooleanOperationNode | ApiNode<ApiNodeType.BOOLEAN_OPERATION>
  ) {
    super(node)
    const allFieldKeys = ['booleanOperation'] as const

    for (const key of allFieldKeys) {
      if (key in node) {
        // @ts-ignore
        this[key] = node[key]
      }
    }

    if (FigmaNode.isNode(node) && node instanceof FigmaBooleanOperationNode) {
      this.apiNode = node.apiNode
    } else {
      this.apiNode = node
    }
  }
}

export class FigmaStarNode extends FigmaVectorBase {
  apiNode: ApiNode<ApiNodeType.STAR>;

  [typeField] = 'FigmaStar'

  static isType(value: any): value is FigmaStarNode {
    return value[typeField] === 'FigmaStar'
  }

  constructor(node: FigmaStarNode | ApiNode<ApiNodeType.STAR>) {
    super(node)

    if (FigmaNode.isNode(node) && node instanceof FigmaStarNode) {
      this.apiNode = node.apiNode
    } else {
      this.apiNode = node
    }
  }
}

export class FigmaLineNode extends FigmaVectorBase {
  apiNode: ApiNode<ApiNodeType.LINE>;

  [typeField] = 'FigmaLine'

  static isType(value: any): value is FigmaLineNode {
    return value[typeField] === 'FigmaLine'
  }

  constructor(node: FigmaLineNode | ApiNode<ApiNodeType.LINE>) {
    super(node)

    if (FigmaNode.isNode(node) && node instanceof FigmaLineNode) {
      this.apiNode = node.apiNode
    } else {
      this.apiNode = node
    }
  }
}

export class FigmaEllipseNode extends FigmaVectorBase {
  apiNode: ApiNode<ApiNodeType.ELLIPSE>;

  [typeField] = 'FigmaEllipse'

  static isType(value: any): value is FigmaEllipseNode {
    return value[typeField] === 'FigmaEllipse'
  }

  constructor(node: FigmaEllipseNode | ApiNode<ApiNodeType.ELLIPSE>) {
    super(node)

    if (FigmaNode.isNode(node) && node instanceof FigmaEllipseNode) {
      this.apiNode = node.apiNode
    } else {
      this.apiNode = node
    }
  }
}

export class FigmaRegularPolygonNode extends FigmaVectorBase {
  apiNode: ApiNode<ApiNodeType.REGULAR_POLYGON>;

  [typeField] = 'FigmaRegularPolygon'

  static isType(value: any): value is FigmaRegularPolygonNode {
    return value[typeField] === 'FigmaRegularPolygon'
  }

  constructor(
    node: FigmaRegularPolygonNode | ApiNode<ApiNodeType.REGULAR_POLYGON>
  ) {
    super(node)

    if (FigmaNode.isNode(node) && node instanceof FigmaRegularPolygonNode) {
      this.apiNode = node.apiNode
    } else {
      this.apiNode = node
    }
  }
}

export class FigmaRectangleNode extends FigmaVectorBase {
  apiNode: ApiNode<ApiNodeType.RECTANGLE>;

  [typeField] = 'FigmaRectangle'
  cornerRadius!: number
  rectangleCornerRadii!: [number, number, number, number]

  static isType(value: any): value is FigmaRectangleNode {
    return value[typeField] === 'FigmaRectangle'
  }

  constructor(node: FigmaRectangleNode | ApiNode<ApiNodeType.RECTANGLE>) {
    super(node)

    const allFieldKeys = ['cornerRadius', 'rectangleCornerRadii'] as const

    for (const key of allFieldKeys) {
      if (key in node) {
        // @ts-ignore
        this[key] = node[key]
      }
    }

    if (FigmaNode.isNode(node) && node instanceof FigmaRectangleNode) {
      this.apiNode = node.apiNode
    } else {
      this.apiNode = node
    }
  }
}

export class FigmaTextNode extends FigmaVectorBase {
  apiNode: ApiNode<ApiNodeType.TEXT>;

  [typeField] = 'FigmaText'
  characters!: string
  style!: TypeStyle
  characterStyleOverrides!: number[]
  styleOverrideTable!: { [mapId: number]: TypeStyle }
  lineTypes!: LineTypes[]
  lineIndentations!: number[]

  static isType(value: any): value is FigmaTextNode {
    return value[typeField] === 'FigmaText'
  }

  constructor(node: FigmaTextNode | ApiNode<ApiNodeType.TEXT>) {
    super(node)

    const allFieldKeys = [
      'characters',
      'style',
      'characterStyleOverrides',
      'styleOverrideTable',
      'lineTypes',
      'lineIndentations',
    ] as const

    for (const key of allFieldKeys) {
      if (key in node) {
        // @ts-ignore
        this[key] = node[key]
      }
    }

    if (FigmaNode.isNode(node) && node instanceof FigmaTextNode) {
      this.apiNode = node.apiNode
    } else {
      this.apiNode = node
    }
  }
}

export class FigmaSliceNode extends FigmaNode {
  apiNode: ApiNode<ApiNodeType.SLICE>;

  [typeField] = 'FigmaSlice'
  exportSettings!: ExportSetting[]
  absoluteBoundingbox!: Rectangle
  size?: Vector
  relativeTransform?: Transform

  static isType(value: any): value is FigmaSliceNode {
    return value[typeField] === 'FigmaSlice'
  }

  constructor(node: FigmaSliceNode | ApiNode<ApiNodeType.SLICE>) {
    super(node)

    const allFieldKeys = [
      'exportSettings',
      'absoluteBoundingBox',
      'size',
      'relativeTransform',
    ] as const

    for (const key of allFieldKeys) {
      if (key in node) {
        // @ts-ignore
        this[key] = node[key]
      }
    }

    if (FigmaNode.isNode(node) && node instanceof FigmaSliceNode) {
      this.apiNode = node.apiNode
    } else {
      this.apiNode = node
    }
  }
}

export type FigmaNodeTypes =
  | FigmaDocument
  | FigmaCanvasNode
  | FigmaFrameNode
  | FigmaGroupNode
  | FigmaComponentNode
  | FigmaComponentSetNode
  | FigmaInstanceNode
  | FigmaVectorNode
  | FigmaBooleanNode
  | FigmaBooleanOperationNode
  | FigmaStarNode
  | FigmaLineNode
  | FigmaEllipseNode
  | FigmaRegularPolygonNode
  | FigmaRectangleNode
  | FigmaTextNode
  | FigmaSliceNode
