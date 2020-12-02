import { Pt } from "./GraphicTypes";

/** A simple closed polygon */

export class Polygon {
    constructor(public points: Pt[] = []) {
    }

    map(mapFn: (pt: Pt) => Pt): Polygon {
        return new Polygon(this.points.map(mapFn))
    }

    get asArray(): [number, number][] {
        return this.points.map(pt => [pt.x, pt.y]);
    }
}


