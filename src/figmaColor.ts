import {
  ApiColor,
  ApiPaintType,
  BlendMode,
  Vector,
  ApiPaintGradient,
  ApiPaintSolidScaleMode,
  Transform,
  ApiPaintImage,
  ApiPaint,
  isPaintGradient,
  isPaintImage,
  isPaintSolid,
} from './figmaSchema'
import { FigmaVariableAlias, FigmaColorVariable } from './figmaVariables'

export class FigmaColor {
  r: number
  g: number
  b: number
  a: number

  constructor(color: ApiColor) {
    this.r = color.r
    this.g = color.g
    this.b = color.b
    this.a = color.a
  }

  toString() {
    return `rgba(${this.r * 255}, ${this.g * 255}, ${this.b * 255}, ${this.a})`
  }
}

export class FigmaColorStop {
  position: number
  color: FigmaColor

  constructor(stop: { position: number; color: ApiColor }) {
    this.position = stop.position
    this.color = new FigmaColor(stop.color)
  }
}
export class FigmaPaintSolid {
  type: 'SOLID' = 'SOLID'
  color: FigmaColor

  boundVariables?: {
    color: FigmaVariableAlias<FigmaColorVariable>
  }

  constructor(paint: { color: ApiColor }) {
    this.color = new FigmaColor(paint.color)
  }
}

export class FigmaPaintGradient {
  type:
    | ApiPaintType.GRADIENT_LINEAR
    | ApiPaintType.GRADIENT_RADIAL
    | ApiPaintType.GRADIENT_ANGULAR
    | ApiPaintType.GRADIENT_DIAMOND
  /**
   * How this node blends with nodes behind it in the scene (see blend mode section for more details)
   */
  blendMode: BlendMode

  /**
   * This field contains three vectors, each of which are a position in normalized object space (normalized object space is if the top left corner of the bounding box of the object is (0, 0) and the bottom right is (1,1)). The first position corresponds to the start of the gradient (value 0 for the purposes of calculating gradient stops), the second position is the end of the gradient (value 1), and the third handle position determines the width of the gradient (only relevant for non-linear gradients).
   */
  gradientHandlePositions: Vector[]

  /**
   * Positions of key points along the gradient axis with the colors anchored there. Colors along the gradient are interpolated smoothly between neighboring gradient stops.
   */
  gradientStops: FigmaColorStop[]

  constructor(paint: ApiPaintGradient) {
    this.type = paint.type
    this.blendMode = paint.blendMode
    this.gradientHandlePositions = paint.gradientHandlePositions
    this.gradientStops = paint.gradientStops.map(
      (stop) => new FigmaColorStop(stop)
    )
  }
}

export class FigmaPaintImage {
  type: ApiPaintType.IMAGE
  /** Image scaling mode */
  scaleMode: ApiPaintSolidScaleMode
  /** Image reference, get it with `Api.getImage` */
  imageRef: string
  /** Affine transform applied to the image, only present if scaleMode is STRETCH */
  imageTransform?: Transform
  /** Amount image is scaled by in tiling, only present if scaleMode is TILE */
  scalingFactor?: number
  /** Image rotation, in degrees. */
  rotation: number
  /** A reference to the GIF embedded in this node, if the image is a GIF. To download the image using this reference, use the GET file images endpoint to retrieve the mapping from image references to image URLs */
  gifRef: string

  constructor(paint: ApiPaintImage) {
    this.type = paint.type
    this.scaleMode = paint.scaleMode
    this.imageRef = paint.imageRef
    this.imageTransform = paint.imageTransform
    this.scalingFactor = paint.scalingFactor
    this.rotation = paint.rotation
    this.gifRef = paint.gifRef
  }
}

export type FigmaPaint = FigmaPaintSolid | FigmaPaintGradient | FigmaPaintImage

export function createFigmaPaint(apiPaint: ApiPaint) {
  switch (true) {
    case isPaintGradient(apiPaint):
      return new FigmaPaintGradient(apiPaint)
    case isPaintImage(apiPaint):
      return new FigmaPaintImage(apiPaint)
    case isPaintSolid(apiPaint):
      return new FigmaPaintSolid(apiPaint)
    default:
      throw new Error('Unknown paint type')
  }
}
