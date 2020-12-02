import { Line2D } from "./Line2D";
import { Point2D } from "./Point2D";
import { Segment2D } from "./Segment2D";


export class Polygon2D {

    private _noRepeatedPoints: boolean | null = null;
    private _isCW: boolean | null = null;
    private _isIntersectionFree: boolean | null = null;
    private _area: number | null = null;

    constructor(public readonly points: Point2D[], public readonly positiveYisUp = true) {
        if (points.length < 3) throw new Error("insufficient number of points");
    }

    get isClockwise(): boolean {
        if (this._isCW === null) {
            let sum = 0;
            let last = this.points[this.points.length - 1];
            this.points.forEach(pt => {
                sum += (pt.x - last.x) * (pt.y + last.y);
                last = pt;
            });
            this._isCW = this.positiveYisUp ? sum < 0 : sum > 0;
        }

        return this._isCW;
    }

    get area(): number {
        if (this._area === null) {
            let sum = 0;
            let last = this.points[this.points.length - 1];
            this.points.forEach(pt => {
                sum += (last.x * pt.y - last.y * pt.x);
                last = pt;
            });
            this._area = (this.positiveYisUp ? sum : -sum) / 2;
        }

        return this._area;
    }

    reversed(): Polygon2D {
        const p = new Polygon2D(this.points.concat().reverse(), this.positiveYisUp);
        p._noRepeatedPoints = this._noRepeatedPoints;
        p._isCW = (this._isCW === null) ? null : !this._isCW;
        p._isIntersectionFree = this._isIntersectionFree;
        p._area = this._area === null ? null : -this._area;
        return p;
    }

    makeClockwise(): Polygon2D {
        return this.isClockwise ? this : this.reversed();
    }

    inset(distance: number): Polygon2D[] {
        const isCW = this.isClockwise;
        const p = this.insetSimple(distance);

        return p.deintersect().filter(poly => isCW === poly.isClockwise && poly.area > 0);
    }

    /** 
     * Outsets by the specified distance in a very simple way -- just computing
     * the intersections of the lines parallel to each segment and forming a new
     * polygon from those intersections. This gives the right result in many cases
     * but not when the angles are sharp and/or the distances are large.
     */
    insetSimple(distance: number): Polygon2D {

        if (distance === 0) return this;

        const d = this.isClockwise ? distance : -distance;
        const poly = this.eliminateRepeatedPoints();

        const inset = (p0: Point2D, p1: Point2D, d: number) => {
            const v = p0.vectorTo(p1);
            return new Line2D(p0.add(v.right90.unit.mul(d)), v);
        }

        const N = poly.points.length;
        const pts = new Array<Point2D>(N);

        for(let i = 0; i < poly.points.length; i++) {
            const p0 = poly.points[(i + N - 1) % N];
            const p1 = poly.points[i];
            const p2 = poly.points[(i + 1) % N];

            const inset01 = inset(p0, p1, d);
            const inset12 = inset(p1, p2, d);
            pts[i] = inset01.intersection(inset12);
        }

        return new Polygon2D(pts, this.positiveYisUp);
    }

    eliminateRepeatedPoints(): Polygon2D {
        if (this._noRepeatedPoints === true) return this;

        const unique: Point2D[] = [];

        for(let i = 0; i < this.points.length; i++) {
            const p0 = this.points[i];
            const p1 = this.points[(i+1) % this.points.length];
            if (!p0.equal(p1)) unique.push(p0);
        }
        if (unique.length === this.points.length) {
            this._noRepeatedPoints = true;
            return this;
        }
        const p = new Polygon2D(unique);
        p._noRepeatedPoints = true;
        p._isCW = this._isCW;
        p._isIntersectionFree = this._isIntersectionFree;
        p._area = this._area;
        return p;
    }

    deintersect(): Polygon2D[] {
        
        const segments = Segment2D.arrayFromPoints(this.points);

        for(let i = 0; i < segments.length; i++) {
            for(let j = 0; j < segments.length; j++) {
                // only compare segments that aren't same or abutting
                const delta = Math.abs(i-j);
                if (delta < 2 || delta === segments.length - 1) continue;

                const ts = segments[i].intersectionTs(segments[j]);
                if (ts !== null) {

                    const isegs = segments[i].split(ts[0]);
                    const jsegs = segments[i].split(ts[1]);

                    segments.splice(i, 1, ...isegs);
                    if (j > i) j += isegs.length - 1;

                    segments.splice(j, 1, ...jsegs);
                    if (i > j) i += isegs.length - 1;

                    // repeat at same indices in case there are more intersections
                }
            }
        }

        const points = segments.map(seg => seg.p1);
        const polys: Point2D[][] = [points];

        for(let i = 0; i < points.length; i++) {
            for(let j = i + 1; j < points.length; j++) {
                if (points[i].equal(points[j])) {
                    polys.push(points.splice(i + 1, j - i));
                }
            }
        }

        if (polys.length === 1) return [this];

        return polys.map(pts => new Polygon2D(pts));
    }

    map(xform: (pt: Point2D) => Point2D) {
        return new Polygon2D(this.points.map(xform));
    }
}
