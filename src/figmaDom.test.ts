import { describe, it, expect, test } from 'vitest'
import { FigmaDocument } from './figmaDom'
import { FigmaNode } from './figmaNode'
import { ApiNode, ApiNodeType } from './figmaApiSchema'
import { FigmaVariableLibrary } from './figmaVariables'

describe('Figma DOM', () => {
  test('should have a child node', () => {
    const figmaNode = new FigmaNode({
      id: '1',
      name: '',
      pluginData: {},
      sharedPluginData: {},
      visible: true,
      isFixed: true,
    })

    const childNode = new FigmaNode({
      id: '2',
      name: '',
      pluginData: {},
      sharedPluginData: {},
      visible: true,
      isFixed: true,
    })
    const siblingNode = new FigmaNode({
      id: '3',
      name: '',
      pluginData: {},
      sharedPluginData: {},
      visible: true,
      isFixed: true,
    })
    // @ts-ignore
    childNode.data = 'childNode'

    // @ts-ignore
    siblingNode.data = 'siblingNode'

    figmaNode.appendChild(childNode)
    figmaNode.appendChild(siblingNode)

    debugger

    expect(figmaNode.firstChild).toBe(childNode)
    expect(figmaNode.lastChild).toBe(siblingNode)
    expect(Array.from(figmaNode.children)).toEqual([childNode, siblingNode])

    childNode.remove()

    expect(figmaNode.firstChild).toBe(siblingNode)
    expect(figmaNode.lastChild).toBe(siblingNode)
    expect(Array.from(figmaNode.children)).toEqual([siblingNode])

    siblingNode.remove()

    expect(figmaNode.firstChild).toBe(null)
    expect(figmaNode.lastChild).toBe(null)
    expect(Array.from(figmaNode.children)).toEqual([])

    expect(childNode.parentNode).toBe(null)
    expect(siblingNode.parentNode).toBe(null)
  })

  test('should query selector', () => {
    const figmaNode = new FigmaNode({
      id: '1',
      name: '',
      pluginData: {},
      sharedPluginData: {},
      visible: true,
      isFixed: true,
    })
    const figmaLibrary = new FigmaVariableLibrary({
      variables: {},
      variableCollections: {},
    })

    const childNode = new FigmaDocument(
      {
        children: [],
        id: '2',
        name: 'foo',
        pluginData: {},
        sharedPluginData: {},
        type: ApiNodeType.DOCUMENT,
        visible: true,
        isFixed: true,
      },
      figmaLibrary
    )
    const additionalNode = new FigmaDocument(
      {
        children: [],
        id: '3',
        name: 'bar',
        pluginData: {},
        sharedPluginData: {},
        type: ApiNodeType.DOCUMENT,
        visible: true,
        isFixed: true,
      },
      figmaLibrary
    )
    const siblingNode = new FigmaNode({
      id: '4',
      name: '',
      pluginData: {},
      sharedPluginData: {},
      visible: true,
      isFixed: true,
    })

    figmaNode.appendChild(childNode)
    childNode.appendChild(additionalNode)
    figmaNode.appendChild(siblingNode)

    debugger

    expect(figmaNode.firstChild).toBe(childNode)

    expect(figmaNode.querySelector({ nodeType: FigmaDocument })).toBe(childNode)
    expect(figmaNode.querySelector({ nodeType: FigmaNode })).toBe(childNode)

    expect(
      Array.from(figmaNode.querySelectorAll({ nodeType: FigmaNode }))
    ).toEqual([childNode, additionalNode, siblingNode])
    expect(
      Array.from(figmaNode.querySelectorAll({ nodeType: FigmaDocument }))
    ).toEqual([childNode, additionalNode])
    expect(Array.from(figmaNode.querySelectorAll({ name: /^b/ }))).toEqual([
      additionalNode,
    ])
    expect(Array.from(figmaNode.querySelectorAll({ name: 'bar' }))).toEqual([
      additionalNode,
    ])
    expect(
      Array.from(
        figmaNode.querySelectorAll({ name: (value) => value === 'bar' })
      )
    ).toEqual([additionalNode])

    siblingNode.remove()

    expect(figmaNode.querySelectorAll({ nodeType: FigmaNode }).length).toBe(2)
  })

  test('works with the api', async () => {
    const doc = await FigmaDocument.fromApi({
      key: import.meta.env.VITEST_FIGMA_FILE_KEY,
      apiKey: import.meta.env.VITEST_FIGMA_API_KEY,
    })

    expect(doc.name).toBe('Document')
    expect(doc.children.length).toBeGreaterThan(0)
  })

  test('should render an svg', async () => {
    const doc = await FigmaDocument.fromApi({
      key: import.meta.env.VITEST_FIGMA_FILE_KEY,
      apiKey: import.meta.env.VITEST_FIGMA_API_KEY,
    })
  })
})
