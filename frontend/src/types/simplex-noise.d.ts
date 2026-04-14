declare module 'simplex-noise' {
  export type Noise2D = (x: number, y: number) => number

  export function createNoise2D(seed?: string | number): Noise2D
}

