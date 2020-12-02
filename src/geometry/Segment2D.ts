import { Point2D } from "./Point2D";
import { Line2D } from "./Line2D";


export class Segment2D {

    readonly line: Line2D;
    constructor(public readonly p1: Point2D, public readonly p2: Point2D) {
        if (p1.equal(p2))
            throw new Error("zero-length segment not allowed");
        this.line = new Line2D(p1, p1.vectorTo(p2));
    }

    intersectionTs(other: Segment2D): [number, number] | null {
        const ts = this.line.intersectionTs(other.line);
        if (ts === null || ts[0] < 0 || ts[0] > 1 || ts[1] < 0 || ts[1] > 1) return null;
        return ts;
    }

    intersectionPt(other: Segment2D): Point2D {
        const ts = this.intersectionTs(other);
        if (ts === null) return null;
        return this.line.pointAtT(ts[0]);
    }

    pointAt(t: number): Point2D {
        return this.line.pointAtT(t);
    }

    subsegment(t0: number, t1: number): Segment2D {
        return new Segment2D(this.pointAt(t0), this.pointAt(t1));
    }

    split(t: number): Segment2D[] {
        if (t === 0 || t === 1) return [this];
        return [this.subsegment(0, t), this.subsegment(t, 1)];
    }

    static arrayFromPoints(points: Point2D[]): Segment2D[] {
        return points.map((pt, i) => new Segment2D(pt, points[(i+1) % points.length]))
    }
}
