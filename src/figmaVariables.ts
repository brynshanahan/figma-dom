import { FigmaColor } from './figmaColor'
import {
  VariableCollection,
  ApiVariableLibrary,
  Variable,
  BooleanVariable,
  isVariableAlias,
  ColorVariable,
  FloatVariable,
  StringVariable,
  ApiVariableAlias,
} from './figmaApiSchema'
import { ApiOpts } from './ApiOpts'

export class FigmaVariableLibrary {
  variables: { [variableId: string]: FigmaVariable } = {}
  variableCollections: { [collectionId: string]: VariableCollection } = {}

  libraryResolver: () => Promise<void> = async () => {}
  resolved: boolean = false
  loading: boolean | Promise<any> = false

  static isType(value: any): value is FigmaVariableLibrary {
    return value instanceof FigmaVariableLibrary
  }

  constructor(
    opts:
      | FigmaVariableLibrary
      | ApiVariableLibrary
      | { libraryResolver: () => Promise<ApiVariableLibrary> }
  ) {
    const parseFromApiVariableLibrary = (library: ApiVariableLibrary) => {
      this.resolved = true

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
    }

    if (opts instanceof FigmaVariableLibrary) {
      this.variables = opts.variables
      this.variableCollections = opts.variableCollections
      this.libraryResolver = opts.libraryResolver
      this.resolved = opts.resolved
      this.loading = opts.loading
    } else if ('libraryResolver' in opts) {
      this.libraryResolver = async () => {
        let library = await opts.libraryResolver()

        parseFromApiVariableLibrary(library)
      }
    } else {
      parseFromApiVariableLibrary(opts)
    }
  }

  static fromApi(opts: ApiOpts) {
    const { key, apiKey } = opts

    const library = new FigmaVariableLibrary({
      async libraryResolver() {
        const url = new URL(
          `/v1/files/${key}/variables/local`,
          `https://api.figma.com`
        )

        let cached = opts.cache && (await opts.cache.get(url.href))

        if (cached) {
          return cached.meta
        }

        const response = await fetch(url.href, {
          headers: {
            'X-Figma-Token': apiKey,
          },
        })

        const data = (await response.json()) as {
          error: boolean
          status: number
          meta: ApiVariableLibrary
        }

        if (opts.cache) {
          opts.cache.set(url.href, data)
        }

        if (data.error) {
          throw new Error('Error fetching variables')
        }

        return data.meta
      },
    })

    return library
  }

  get<T extends FigmaVariable>(id: string) {
    if (!this.resolved) {
      throw new Error('Library not resolved')
    }

    return this.variables[id] as T
  }

  async resolveAll() {
    if (this.resolved) {
      return
    }

    if (this.loading) {
      await this.loading
    }

    this.resolved = true

    let promise = this.libraryResolver()

    this.loading = promise.then(() => {
      this.loading = false
    })

    await this.loading
  }

  async resolve<T extends FigmaVariable>(id: string) {
    await this.resolveAll()

    return this.get<T>(id)
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
    [modeId: string]: boolean | FigmaVariableAlias<FigmaBooleanVariable>
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
        this.valuesByMode[key] = new FigmaVariableAlias(value, library)
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
    while (value instanceof FigmaVariableAlias) {
      value = value.resolveSync().value()
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
    [key: string]: FigmaColor | FigmaVariableAlias<FigmaColorVariable>
  }

  constructor(variable: ColorVariable, library: FigmaVariableLibrary) {
    super(variable, library)
    this.scopes = variable.scopes
    this.valuesByMode = {}

    for (const key in variable.valuesByMode) {
      const value = variable.valuesByMode[key]

      if (value instanceof FigmaColor) {
        this.valuesByMode[key] = value
      } else if (isVariableAlias(value)) {
        this.valuesByMode[key] = new FigmaVariableAlias(value, library)
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
    while (value instanceof FigmaVariableAlias) {
      value = value.resolveSync().value()
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
    [key: string]: number | FigmaVariableAlias<FigmaFloatVariable>
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
        this.valuesByMode[key] = new FigmaVariableAlias(value, library)
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
    while (value instanceof FigmaVariableAlias) {
      value = value.resolveSync().value()
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
    [key: string]: string | FigmaVariableAlias<FigmaStringVariable>
  }

  value() {
    const defaultMode =
      this.library.variableCollections[this.variableCollectionId].defaultModeId
    return this.valuesByMode[defaultMode]
  }

  resolvedValue() {
    let value = this.value()
    while (value instanceof FigmaVariableAlias) {
      value = value.resolveSync().value()
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
        this.valuesByMode[key] = new FigmaVariableAlias(value, library)
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

  resolveSync() {
    return this.library.get<T>(this.id)
  }
}
