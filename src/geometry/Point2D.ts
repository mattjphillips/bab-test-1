import { Vec2D } from "./Vec2D";
import { Line2D } from "./Line2D";


export class Point2D {
    constructor(public readonly x: number, public readonly y: number) { }

    bisector(p0: Point2D, p2: Point2D): Vec2D {
        // check for colinear
        const v1 = p0.vectorTo(this);
        const v2 = this.vectorTo(p2);
        if (Math.abs(v1.dot(v2)) == v1.length * v2.length) {
            // colinear, so just right angle
            return v1.right90;
        }

        // use bisecting angle rule here
        const v3 = p0.vectorTo(p2);
        const p1a = v3.mul(v1.length / (v1.length + v2.length));
        const v = this.vectorTo(p0.add(p1a)).unit;

        // use dot product to figure out if this is a right turn or a left turn
        // and adjust the direction of v accordingly
        const dot = v1.right90.dot(v2);
        return dot > 0 ? v : v.mul(-1);
    }

    inset(p0: Point2D, p2: Point2D, d: number): Point2D {
        const bi = new Line2D(this, this.bisector(p0, p2));
        const v01 = p0.vectorTo(this);
        const parallel = new Line2D(this.add(v01.right90.unit.mul(d)), v01);
        return parallel.intersection(bi);
    }

    vectorTo(p: Point2D): Vec2D {
        return new Vec2D(p.x - this.x, p.y - this.y);
    }

    add(v: Vec2D): Point2D {
        return new Point2D(this.x + v.dx, this.y + v.dy);
    }

    equal(other: Point2D): boolean {
        return this.x == other.x && this.y == other.y;
    }
}
