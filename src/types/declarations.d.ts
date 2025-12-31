declare module 'svg-path-properties' {
  export class svgPathProperties {
    constructor(d: string);
    getTotalLength(): number;
    getPointAtLength(length: number): { x: number; y: number };
    getTangentAtLength(length: number): { x: number; y: number };
    getPropertiesAtLength(length: number): { x: number; y: number; tangentX: number; tangentY: number };
    getParts(): any[];
  }
}

declare module 'potpack' {
  export default function potpack(boxes: any[]): { w: number; h: number; fill: number };
}
