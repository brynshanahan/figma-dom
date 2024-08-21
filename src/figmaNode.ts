import { resolve } from 'path'
import { FigmaVariable, FigmaVariableLibrary } from './figmaVariables'
import { figmaNodeToSvg, FigmaNodeToSvgOptions } from './figmaNodeToSvg'

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
export const typeField = Symbol('type')

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

  toSvg(opts: FigmaNodeToSvgOptions = {}) {
    return figmaNodeToSvg(this as any, opts)
  }

  matches<T extends FigmaNode>(query: QuerySelector<T>): this is T {
    if (query.nodeType && !(this instanceof query.nodeType)) {
      return false
    }
    for (const key of Object.keys(query) as (keyof T)[]) {
      if (key === 'nodeType') {
        continue
      }

      if (!(key in this)) {
        return false
      }

      const value = query[key]

      const keyName = key as keyof this

      if (value instanceof RegExp) {
        if (typeof this[keyName] !== 'string') {
          return false
        }

        if (!value.test(this[keyName])) {
          return false
        }
      } else if (typeof value === 'function') {
        if (!value(this[keyName])) {
          return false
        }
      } else if (this[keyName] !== value) {
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
    let self = this

    return new FigmaNodeList<T>(
      (function* () {
        for (let child of self.children) {
          if (child.matches(query)) {
            yield child
          }

          yield* child.querySelectorAll(query)
        }
      })()
    )
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
