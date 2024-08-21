import { FigmaComponentNode, FigmaDocument } from './figmaDom'
import { ToStringElement } from './figmaNodeToSvg'
import localforage from 'localforage'

async function main(promise: Promise<FigmaDocument>) {
  document.body.innerHTML = ''

  const doc = await promise

  const select = document.createElement('select')

  for (let branch of doc.branches) {
    let option = document.createElement('option')
    option.value = branch.name
    option.textContent = branch.name
    select.appendChild(option)
  }

  select.addEventListener('change', async () => {
    const branch = select.value
    main(doc.branch(branch))
  })

  document.body.appendChild(select)

  await doc.library.resolveAll()

  for (let element of doc.querySelectorAll({
    nodeType: FigmaComponentNode,
    name: (name) =>
      name.startsWith('Pictogram/') ||
      name.startsWith('Pictograms/') ||
      name.startsWith('System icons/'),
  })) {
    let svg = createSvgNode(element.toSvg())
    let div = document.createElement('div')
    div.innerHTML = `<div>${element.name}</div>`
    div.appendChild(svg)
    document.body.appendChild(div)
  }

  for (let element of doc.querySelectorAll({
    name: 'nsw-government-logo',
  })) {
    let svg = createSvgNode(element.toSvg())
    let div = document.createElement('div')
    div.innerHTML = `<div>${element.name}</div>`
    div.appendChild(svg)
    document.body.appendChild(div)
  }

  document.body.style.display = 'flex'
  document.body.style.flexWrap = 'wrap'
  document.body.style.gap = '1rem'
  document.body.style.fontSize = '12px'
}

main(
  FigmaDocument.fromApi({
    apiKey: import.meta.env.VITE_FIGMA_API_KEY,
    // key: import.meta.env.VITE_FIGMA_FILE_KEY,
    key: 'e4nkf1sfNdmrn463wH6Rq4',
    cache: {
      async get(key) {
        let cached = await localforage.getItem(key)
        if (cached) {
          return JSON.parse(cached as any)
        }
      },
      async set(key, value) {
        await localforage.setItem(key, JSON.stringify(value))
      },
    },
  })
)

function createSvgNode(element: ToStringElement) {
  if (element.type === null) {
    throw new Error('Cannot create svg node with null type')
  }

  let node = document.createElement('div')

  node.innerHTML = element.toString()

  return node.querySelector('svg')!
}
