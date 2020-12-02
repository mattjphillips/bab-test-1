import * as OpenType from "opentype.js";
import { Shape, Transform } from "./Shape";
import { Polygon } from "./Polygon";
import { IMesh3D, PolygonWithHoles } from "./PolygonWithHoles";
import { ShapeGroup } from "./ShapeGroup";
import { Mesh, Scene } from "babylonjs";
import { Pt } from "./GraphicTypes";
import { Polygon2D } from "./geometry/Polygon2D";
import { Point2D } from "./geometry/Point2D";

class EmptyShape extends Shape {
    constructor(xform: Transform = Transform.Identity) {
        super(xform);
    }

    createMeshes(depth: number, bevel: number, incomingXform: Transform): IMesh3D[] {
        return [];
    }

    withXform(xform: Transform): Shape {
        return new EmptyShape(xform);
    }
}

class GlyphPathHelper {
    constructor(public commands: OpenType.PathCommand[] = []) {
    }

    isClockwise(invertY: boolean) {
        let sum = 0;
        let last = this.commands[this.commands.length - 1];
        this.commands.forEach(cmd => {
            if (last.type !== 'Z' && cmd.type !== 'Z') {
                sum += (cmd.x - last.x) * (cmd.y + last.y);
            }
            last = cmd;
        });
        return invertY ? sum < 0 : sum > 0;
    }

    expand(): Polygon2D {
        const pts: Pt[] = [];
        let cur: Pt = null;

        const addPt = (pt: Pt) => {
            if (pts.length === 0 || pts[pts.length-1].x != pt.x || pts[pts.length-1].y != pt.y) {
                pts.push(pt);
            }
        }

        this.commands.forEach(cmd => {
            switch (cmd.type) {
                case 'M':
                    cur = { x: cmd.x, y: cmd.y };
                    addPt(cur);
                    break;
                case 'L':
                    cur = { x: cmd.x, y: cmd.y };
                    addPt(cur);
                    break;
                case 'C':
                    // HAAAAACK
                    const N = 10;
                    for (let i = 0; i < N; i++) {
                        const t = (i + 1) / N;
                        const t2 = t * t;
                        const t3 = t2 * t;
                        const tm = 1 - t;
                        const tm2 = tm * tm;
                        const tm3 = tm2 * tm;
                        const x = tm3 * cur.x + 3 * tm2 * t * cmd.x1 + 3 * tm * t2 * cmd.x2 + t3 * cmd.x;
                        const y = tm3 * cur.y + 3 * tm2 * t * cmd.y1 + 3 * tm * t2 * cmd.y2 + t3 * cmd.y;
                        addPt({ x, y });
                    }
                    cur = { x: cmd.x, y: cmd.y };
                    break;
                case 'Z':
                    break;
            }
        });

        if (pts.length > 1 && pts[0].x == pts[pts.length-1].x && pts[0].y == pts[pts.length-1].y) pts.pop();

        return new Polygon2D(pts.map(p => new Point2D(p.x, p.y)));
    }
}

/** Helper class that turns paths coming from fonts into shapes */

export class GlyphPathConverter {

    static shapeForPath(path: OpenType.Path, sx: number, tx: number, sy: number, ty: number): Shape {

        let paths: GlyphPathHelper[] = [];
        let curPath: GlyphPathHelper = null;
        path.commands.forEach(cmd => {
            if (cmd.type === 'M') {
                curPath = new GlyphPathHelper([cmd]);
                paths.push(curPath);
            } else if (cmd.type !== 'Z') {
                curPath.commands.push(cmd);
            }
        });

        let positives: Polygon2D[] = [];
        let holes: Polygon2D[] = [];
    
        const xformPt = (pt: Pt) => new Point2D(pt.x * sx + tx, pt.y * sy + ty);

        paths.forEach(path => {
            if (path.isClockwise(true))
                positives.push(path.expand().map(xformPt));
            else
                holes.push(path.expand().map(xformPt));
        });

        if (positives.length > 1) { // eg, i or j
            return new ShapeGroup(positives.map(p => new PolygonWithHoles(p, [])));
        }

        if (positives.length == 0) { // eg whitespace
            return new EmptyShape();
        }

        return new PolygonWithHoles(positives[0], holes);
    }

}
