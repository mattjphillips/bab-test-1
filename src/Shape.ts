import { Mesh, Scene } from "babylonjs";
import { IMesh3D } from "./PolygonWithHoles";

export class Transform {

    static readonly Identity = new Transform(0, 0, 0, 1);

    constructor(
        public readonly tx: number = 0,
        public readonly ty: number = 0,
        public readonly tz: number = 0,
        public readonly scale: number = 1
    ) {}

    concat(other: Transform): Transform {
        return new Transform(
            other.tx * this.scale + this.tx,
            other.ty * this.scale + this.ty,
            other.tz * this.scale + this.tz,
            other.scale * this.scale
        );
    }
}

/** Represents fully generic Shape that might be simple, multi-shape, shape with holes, or any combination */
export abstract class Shape {
    constructor(public xform: Transform) {}
    abstract createMeshes(depth: number, bevel: number, incomingXform: Transform): IMesh3D[];
    abstract withXform(xform: Transform): Shape;
}
