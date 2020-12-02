import { Vec2D } from "./Vec2D";
import { Point2D } from "./Point2D";

export class Line2D {
    constructor(public readonly pt: Point2D, public readonly vec: Vec2D) { }

    intersectionTs(other: Line2D) : [number, number] {
        const a1 = this.pt.x, b1 = this.vec.dx, c1 = this.pt.y, d1 = this.vec.dy;
        const a2 = other.pt.x, b2 = other.vec.dx, c2 = other.pt.y, d2 = other.vec.dy;

        // basic algebra

        const denom = d1 * b2 + b1 * d2;
        if (denom == 0) {
            return null;
        }

        return [
            (b2 * (c1 - c2) - d2 * (a1 - a2)) / denom,
            (b1 * (c2 - c1) - d1 * (a2 - a1)) / denom
        ]
    }

    pointAtT(t: number): Point2D {
        return new Point2D(this.pt.x + t * this.vec.dx, this.pt.y + t * this.vec.dy);
    }

    /**
     * If the two lines intersect, returns the intersection point. Note that the lines
     * extend to infinity along -t and +t.
     * 
     * @param other The other line to intersect with.
     */
    intersection(other: Line2D): Point2D | null {
        const ts = this.intersectionTs(other);
        if (ts === null) return null;
        return this.pointAtT(ts[0]);
    }
}


