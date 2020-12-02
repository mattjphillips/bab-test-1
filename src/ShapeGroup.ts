import { Mesh, Scene } from "babylonjs";
import { IMesh3D } from "./PolygonWithHoles";
import { Shape, Transform } from "./Shape";

/** A collection of other shapes */
export class ShapeGroup extends Shape {
    constructor(public children: Shape[], xform: Transform = Transform.Identity) {
        super(xform);
    }

    withXform(xform: Transform): Shape {
        return new ShapeGroup(this.children, xform);
    }

    createMeshes(depth: number, bevel: number, incomingXform: Transform): IMesh3D[] {
        const allMeshes: IMesh3D[] = [];
        const xform = incomingXform.concat(this.xform);
        this.children.forEach(child => {
            const meshes = child.createMeshes(depth, bevel, xform);
            allMeshes.push(...meshes);
        });
        return allMeshes;
    }
}
