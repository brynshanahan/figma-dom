import { FigmaColor } from './figmaColor'
import {
  VariableCollection,
  VariableLibrary,
  Variable,
  BooleanVariable,
  isVariableAlias,
  ColorVariable,
  FloatVariable,
  StringVariable,
  ApiVariableAlias,
} from './figmaSchema'

export class FigmaVariableLibrary {
  variables: { [variableId: string]: FigmaVariable } = {}
  variableCollections: { [collectionId: string]: VariableCollection } = {}

  libraryResolver: () => Promise<VariableLibrary>
  resolved: boolean = false
  loading: boolean | Promise<any> = false

  constructor(fileKey: string, branchKey: string | undefined, apiKey: string) {
    this.libraryResolver = async () => {
      let url = new URL(`https://api.figma.com/v1/files/${fileKey}`)

      if (branchKey) {
        url.searchParams.set('branch', branchKey)
      }

      const response = await fetch(url.href, {
        headers: {
          'X-Figma-Token': apiKey,
        },
      })

      const data = await response.json()

      return data as VariableLibrary
    }
  }

  get<T extends FigmaVariable>(id: string) {
    if (!this.resolved) {
      throw new Error('Library not resolved')
    }

    return this.variables[id] as T
  }

  async resolve<T extends FigmaVariable>(
    id: string,
    resolveDeep: boolean = false
  ) {
    if (this.resolved) {
      return
    }

    this.resolved = true

    let promise = this.libraryResolver()

    this.loading = promise.then((library) => {
      this.variables = {}
      this.variableCollections = {}

      for (const variableId in library.variables) {
        const variable = library.variables[variableId]
        let variableCls
        switch (variable.resolvedType) {
          case 'BOOLEAN': {
            variableCls = new FigmaBooleanVariable(variable, this)
            break
          }
          case 'COLOR': {
            variableCls = new FigmaColorVariable(variable, this)
            break
          }
          case 'FLOAT': {
            variableCls = new FigmaFloatVariable(variable, this)
            break
          }
          case 'STRING': {
            variableCls = new FigmaStringVariable(variable, this)
            break
          }
        }

        this.variables[variable.id] = variableCls
      }

      for (const collectionId in library.variableCollections) {
        const collection = library.variableCollections[collectionId]
        this.variableCollections[collection.id] = collection
      }

      this.loading = false
    })

    await this.loading

    return this.variables[id] as T
  }
}
export class FigmaVariable implements Variable {
  codeSyntax: {}
  description: string
  hiddenFromPublishing: false
  id: string
  key: string
  name: string
  remote: boolean
  variableCollectionId: string

  library: FigmaVariableLibrary

  constructor(
    variable: Variable | FigmaVariable,
    library: FigmaVariableLibrary
  ) {
    this.codeSyntax = variable.codeSyntax
    this.description = variable.description
    this.hiddenFromPublishing = variable.hiddenFromPublishing
    this.id = variable.id
    this.key = variable.key
    this.name = variable.name
    this.remote = variable.remote
    this.variableCollectionId = variable.variableCollectionId
    this.library = library
  }
}
export class FigmaBooleanVariable
  extends FigmaVariable
  implements Omit<BooleanVariable, 'valuesByMode'>
{
  type: 'BOOLEAN' = 'BOOLEAN'

  scopes: BooleanVariable['scopes']
  valuesByMode: {
    [modeId: string]: boolean | FigmaBooleanVariable
  }
  resolvedType: 'BOOLEAN' = 'BOOLEAN'

  constructor(variable: BooleanVariable, library: FigmaVariableLibrary) {
    super(variable, library)
    this.scopes = variable.scopes
    this.valuesByMode = {}

    for (const key in variable.valuesByMode) {
      const value = variable.valuesByMode[key]

      if (typeof value === 'boolean') {
        this.valuesByMode[key] = value
      } else if (isVariableAlias(value)) {
        this.valuesByMode[key] = this.library.get<FigmaBooleanVariable>(
          value.id
        )
      }
    }
  }

  value() {
    const defaultMode =
      this.library.variableCollections[this.variableCollectionId].defaultModeId
    return this.valuesByMode[defaultMode]
  }

  resolvedValue() {
    let value = this.value()
    while (value instanceof FigmaBooleanVariable) {
      value = value.value()
    }
    return value
  }
}
export class FigmaColorVariable
  extends FigmaVariable
  implements Omit<ColorVariable, 'valuesByMode'>
{
  type: 'COLOR' = 'COLOR'
  resolvedType: 'COLOR' = 'COLOR'

  scopes: ColorVariable['scopes']
  valuesByMode: {
    [key: string]: FigmaColor | FigmaColorVariable
  }

  constructor(variable: ColorVariable, library: FigmaVariableLibrary) {
    super(variable, library)
    this.scopes = variable.scopes
    this.valuesByMode = {}
  }

  value() {
    const defaultMode =
      this.library.variableCollections[this.variableCollectionId].defaultModeId
    return this.valuesByMode[defaultMode]
  }

  resolvedValue() {
    let value = this.value()
    while (value instanceof FigmaColorVariable) {
      value = value.value()
    }
    return value
  }
}
export class FigmaFloatVariable
  extends FigmaVariable
  implements Omit<FloatVariable, 'valuesByMode'>
{
  type: 'FLOAT' = 'FLOAT'
  resolvedType: 'FLOAT' = 'FLOAT'

  scopes: FloatVariable['scopes']
  valuesByMode: {
    [key: string]: number | FigmaFloatVariable
  }

  constructor(variable: FloatVariable, library: FigmaVariableLibrary) {
    super(variable, library)
    this.scopes = variable.scopes
    this.valuesByMode = {}

    for (const key in variable.valuesByMode) {
      const value = variable.valuesByMode[key]

      if (typeof value === 'number') {
        this.valuesByMode[key] = value
      } else if (isVariableAlias(value)) {
        this.valuesByMode[key] = this.library.get<FigmaFloatVariable>(value.id)
      }
    }
  }

  value() {
    const defaultMode =
      this.library.variableCollections[this.variableCollectionId].defaultModeId
    return this.valuesByMode[defaultMode]
  }

  resolvedValue() {
    let value = this.value()
    while (value instanceof FigmaFloatVariable) {
      value = value.value()
    }
    return value
  }
}
export class FigmaStringVariable
  extends FigmaVariable
  implements Omit<StringVariable, 'valuesByMode'>
{
  type: 'STRING' = 'STRING'
  resolvedType: 'STRING' = 'STRING'

  scopes: StringVariable['scopes']
  valuesByMode: {
    [key: string]: string | FigmaStringVariable
  }

  value() {
    const defaultMode =
      this.library.variableCollections[this.variableCollectionId].defaultModeId
    return this.valuesByMode[defaultMode]
  }

  resolvedValue() {
    let value = this.value()
    while (value instanceof FigmaStringVariable) {
      value = value.value()
    }
    return value
  }

  constructor(variable: StringVariable, library: FigmaVariableLibrary) {
    super(variable, library)
    this.scopes = variable.scopes
    this.valuesByMode = {}

    for (const key in variable.valuesByMode) {
      const value = variable.valuesByMode[key]

      if (typeof value === 'string') {
        this.valuesByMode[key] = value
      } else if (isVariableAlias(value)) {
        this.valuesByMode[key] = this.library.get<FigmaStringVariable>(value.id)
      }
    }
  }
}
export class FigmaVariableAlias<
  T extends
    | FigmaFloatVariable
    | FigmaBooleanVariable
    | FigmaColorVariable
    | FigmaStringVariable
> implements ApiVariableAlias
{
  type: 'VARIABLE_ALIAS' = 'VARIABLE_ALIAS'
  id: string

  library: FigmaVariableLibrary

  constructor(
    value: ApiVariableAlias | FigmaVariableAlias<T>,
    library: FigmaVariableLibrary
  ) {
    this.id = value.id
    this.library = library
  }

  async name() {
    return (await this.resolve()).name
  }

  async description() {
    return (await this.resolve()).description
  }

  async scopes() {
    return (await this.resolve()).scopes
  }

  async valuesByMode() {
    return (await this.resolve()).valuesByMode
  }

  async resolvedType() {
    return (await this.resolve()).resolvedType
  }

  async value() {
    return (await this.resolve()).value()
  }

  async resolve() {
    if (!this.library) {
      throw new Error('No library getter provided')
    }

    let resolved = await this.library.resolve<T>(this.id)

    if (!resolved) {
      throw new Error(`Variable ${this.id} could not be resolved`)
    }

    return resolved
  }
}
