import { Mesh, PolygonMeshBuilder, Scene, Vector2, Vector3, VertexData } from "babylonjs";
import Earcut from "earcut";
import { Pt } from "./GraphicTypes";
import { Point2D } from "./geometry/Point2D";
import { Shape, Transform } from "./Shape";
import { pbr, grass1 } from "./index";
import { Polygon2D } from "./geometry/Polygon2D";

const PolygonOffset = require("polygon-offset");

export interface Pt3D {
    x: number;
    y: number;
    z: number;
}

export interface IMesh3D {
    points: Pt3D[];
    indices: number[];
}

/** A ahape represented by one positive polygon and any number of negative "hole" polygons cut out of it */
export class PolygonWithHoles extends Shape {

    static nextID = 1;


    static add3dpt(arr: Pt3D[], x: number, y: number, z: number) {
        arr.push({x: -x, y: -y, z: z});
    }

    constructor(public positive: Polygon2D, public holes: Polygon2D[], xform: Transform = Transform.Identity) {
        super(xform);
    }

    withXform(xform: Transform): Shape {
        return new PolygonWithHoles(this.positive, this.holes, xform);
    }

    static shapeToMesh(mesh: IMesh3D, positive: Polygon2D, holes: Polygon2D[], z: number, xform: Transform, reverse: boolean): IMesh3D {

        const coords2d: number[] = [];
        const baseIndex = mesh.points.length;
        
        const add3dpt = (pt: Point2D) => {
            mesh.points.push({ 
                x: pt.x * xform.scale + xform.tx, 
                y: pt.y * xform.scale + xform.ty,
                z: z * xform.scale + xform.tz 
            });
        }

        const addPts = (poly: Polygon2D) => {
            poly.points.forEach(pt => {
                coords2d.push(pt.x, pt.y);
                add3dpt(pt);
            });
        }

        addPts(positive);

        const holeIndices = new Array<number>(holes.length);
        holes.forEach((holePoly, i) => {
            holeIndices[i] = (coords2d.length) / 2;
            addPts(holePoly);
        });

        const indices = Earcut(coords2d, holeIndices);
        if (reverse) {
            indices.reverse();
        }
        indices.forEach(i => mesh.indices.push(i + baseIndex));


        return mesh;
    }

    createFrontMesh(mesh: IMesh3D, inset: number, z: number, xform: Transform) {
        PolygonWithHoles.shapeToMesh(mesh, this.positive, this.holes, z, xform, false);
    }

    createBackMesh(mesh: IMesh3D, inset: number, z: number, xform: Transform) {
        PolygonWithHoles.shapeToMesh(mesh, this.positive, this.holes, z, xform, true);
    }

    createSideMesh(mesh: IMesh3D, inset: number, zFront: number, zBack: number, xform: Transform) {
        let i = 0;

        const add3dpt = (pt: Point2D, z: number) => {
            mesh.points.push({ 
                x: pt.x * xform.scale + xform.tx, 
                y: pt.y * xform.scale + xform.ty,
                z: z * xform.scale + xform.tz 
            });
        }

        const addShape = (poly: Polygon2D) => {
            let iBase = mesh.points.length;
            const N = poly.points.length * 2;
            poly.points.forEach(p => {
                const i = mesh.points.length - iBase;
                add3dpt(p, zFront);
                add3dpt(p, zBack);
                mesh.indices.push(iBase + i+1, iBase + i, iBase + (i + 2) % N);
                mesh.indices.push(iBase + i+1, iBase + (i + 2) % N, iBase + (i + 3) % N);
            });
        }

        addShape(this.positive);
        this.holes.forEach(hole => addShape(hole));
    }

    createMeshes(depth: number, bevel: number, incomingXform: Transform): IMesh3D[] {

        const xform = incomingXform.concat(this.xform);

        // z of back face
        const z0 = 0;
        // z of top face
        const z2 = -depth / xform.scale;
        // z of beginning of bevel
        const z1 = z2 * (1 - bevel);

        const coords3d: Pt3D[] = [];

        const mesh: IMesh3D = { points: [], indices: [] };

        this.createFrontMesh(mesh, bevel * depth, z2, xform), 
        this.createBackMesh(mesh, 0, z0, xform),
        this.createSideMesh(mesh, 0, z0, z2, xform)

        return [mesh];
        /*

        // inset the positive

        const pts = this.positive.points.map(p => new Point2D(p.x * xform.scale + xform.tx, p.y * xform.scale * xform.ty));
        const paddedPts = new Array<Pt>(pts.length);

        for (let i = 0; i < this.positive.points.length; i++) {
            const p0 = pts[(i + pts.length - 1) % pts.length];
            const p1 = pts[i];
            const p2 = pts[(i + 1) % pts.length];
            paddedPts[i] = p1.inset(p0, p2, depth * -bevel);
        }

        const add3dpt = (x: number, y: number, z: number) => PolygonWithHoles.add3dpt(coords3d, x, y, z);
            coords3d.push(-x, -y, z);
        }

        const indices: number[] = [];

        let index = 0;

        const addShape = (pts: Pt[], z: number, reverse: boolean) => {

            const coords2d: number[] = [];
            pts.forEach(pt => {
                coords2d.push(pt.x, pt.y);
                add3dpt(pt.x, pt.y, z);
            });

            const tiled = Earcut(coords2d);
            if (reverse)
                tiled.reverse();
            indices.push(...tiled.map(i => i + index));
            index += pts.length;
        }

        // front face
        addShape(pts, z2, false);

        // back face
        addShape(paddedPts, z0, true);

        if (bevel < 1) {
            // extruded edges
            for (let i = 0; i < paddedPts.length; i++) {
                const p1 = paddedPts[i];
                const p2 = paddedPts[(i + 1) % paddedPts.length];

                add3dpt(p1.x, p1.y, z0);
                add3dpt(p2.x, p2.y, z0);
                add3dpt(p1.x, p1.y, z1);

                add3dpt(p2.x, p2.y, z0);
                add3dpt(p2.x, p2.y, z1);
                add3dpt(p1.x, p1.y, z1);

                for (let i = 0; i < 6; i++)
                    indices.push(index++);
            }
        }

        // beveled edges
        for (let i = 0; i < pts.length; i++) {
            const a1 = pts[i];
            const a2 = pts[(i + 1) % pts.length];
            const b1 = paddedPts[i];
            const b2 = paddedPts[(i + 1) % paddedPts.length];

            add3dpt(b1.x, b1.y, z1);
            add3dpt(a2.x, a2.y, z2);
            add3dpt(a1.x, a1.y, z2);
            add3dpt(b1.x, b1.y, z1);
            add3dpt(b2.x, b2.y, z1);
            add3dpt(a2.x, a2.y, z2);

            for (let i = 0; i < 6; i++)
                indices.push(index++);
        }
        */
    }
}
