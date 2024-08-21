# figma-dom

A type document object model for Figma.

Node types

```typescript
import {
  FigmaDocument,
  FigmaCanvasNode,
  FigmaFrameNode,
  FigmaGroupNode,
  FigmaComponentNode,
  FigmaComponentSetNode,
  FigmaInstanceNode,
  FigmaVectorNode,
  FigmaBooleanNode,
  FigmaBooleanOperationNode,
  FigmaStarNode,
  FigmaLineNode,
  FigmaEllipseNode,
  FigmaRegularPolygonNode,
  FigmaRectangleNode,
  FigmaTextNode,
  FigmaSliceNode,
} from 'figma-dom'

const doc = await FigmaDocument.fromApi({
  apiKey: string,
  key: string,
})

// Resolve all figma variables
await doc.library.resolveAll()

for (let node of doc.querySelectorAll({
  nodeType: FigmaComponentNode,
  name: (name) => name.startsWith('Icon'),
})) {
  let div = document.createElement('div')

  div.innerHTML = node.toSvg().toString()
  div.appendChild(document.createTextNode(node.name))

  document.body.appendChild(div)
}
```
