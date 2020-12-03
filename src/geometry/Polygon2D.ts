import { Line2D } from "./Line2D";
import { Point2D } from "./Point2D";
import { Segment2D } from "./Segment2D";

export class Rect2D {
    constructor(public readonly x1: number, public readonly y1: number, public readonly x2: number, public readonly y2: number) {
        if (x1 > x2 || y1 > y2) throw new Error("crossed rectangle");
    }

    intersects(other: Rect2D): boolean {
        return this.x1 <= other.x2 && this.x2 >= other.x1 && this.y1 <= other.y2 && this.y2 >= other.y1;
    }

    contains(other: Rect2D): boolean {
        return this.x1 <= other.x1 && this.x2 >= other.x2 && this.y1 <= other.y1 && this.y2 >= other.y2;
    }
}


export class Polygon2D {

    private _noRepeatedPoints: boolean | null = null;
    private _isCW: boolean | null = null;
    private _isIntersectionFree: boolean | null = null;
    private _area: number | null = null;
    private _bounds: Rect2D | null = null;

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
            this._area = Math.abs(sum) / 2;
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

    makeCW(): Polygon2D {
        return this.isClockwise ? this : this.reversed();
    }

    makeCCW(): Polygon2D {
        return this.isClockwise ? this.reversed() : this;
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

    contains(pt: Point2D): boolean {
        const orientation = (p: Point2D, q: Point2D, r: Point2D) =>  {
            const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
            return (val === 0) ? 0 : (val > 0 ? 1 : 2);
        }

        const onSegment = (p: Point2D, q: Point2D, r: Point2D) => {
            return q.x <= Math.max(p.x, r.x) && 
                q.x >= Math.min(p.x, r.x) && 
                q.y <= Math.max(p.y, r.y) && 
                q.y >= Math.min(p.y, r.y);
        }

        const doIntersect = (p1: Point2D, q1: Point2D, p2: Point2D, q2: Point2D) => {
            const o1 = orientation(p1, q1, p2); 
            const o2 = orientation(p1, q1, q2); 
            const o3 = orientation(p2, q2, p1); 
            const o4 = orientation(p2, q2, q1); 

            return (o1 != o2 && o3 != o4)
                || (o1 == 0 && onSegment(p1, p2, q1))
                || (o2 == 0 && onSegment(p1, q2, q1))
                || (o3 == 0 && onSegment(p2, p1, q2))
                || (o4 == 0 && onSegment(p2, q1, q2));
        }

        // Create a point for line segment from p to infinite 
        const extreme = new Point2D(1e10, pt.y); 

        // Count intersections of the above line  
        // with sides of polygon 
        let count = 0, i = 0; 
        do { 
            const next = (i + 1) % this.points.length; 
  
            if (doIntersect(this.points[i], this.points[next], pt, extreme)) { 
                if (orientation(this.points[i], pt, this.points[next]) == 0) { 
                    return onSegment(this.points[i], pt, this.points[next]); 
                } 
                count++; 
            } 
            i = next; 
        } while (i != 0); 
  
        return count % 2 == 1;
    } 

    containsPoly(other: Polygon2D): boolean {
        return this.bounds.contains(other.bounds) && !other.points.find(pt => !this.contains(pt));
    }
    
    intersectsPoly(other: Polygon2D): boolean {
        return this.bounds.intersects(other.bounds) && !!other.points.find(pt => this.contains(pt));
    }
    
    get bounds(): Rect2D {
        if (this._bounds === null) {
            const xs = this.points.map(pt => pt.x);
            const ys = this.points.map(pt => pt.y);
            this._bounds = new Rect2D( Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
        }
        return this._bounds;
    }
}
