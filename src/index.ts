import { ArcRotateCamera, Camera, Color3, CubeTexture, Engine, HemisphericLight, Mesh, MeshBuilder, PBRMetallicRoughnessMaterial, PolygonMeshBuilder, Scene, StandardMaterial, Texture, Vector2, Vector3, VertexData, VolumetricLightScatteringPostProcess } from "babylonjs"
import * as OpenType from "opentype.js";

import Earcut from "earcut";
const Offset = require("polygon-offset");

import "./index.html";
import "./fonts/AdobeClean-Bold.otf";
import "./textures/grass.png";
import "./textures/environment.dds";

// Get the canvas DOM element
var canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;

// Load the 3D engine
var engine = new Engine(canvas, true, {preserveDrawingBuffer: true, stencil: true});

var grass0: StandardMaterial;
var grass1: StandardMaterial;
var grass2: StandardMaterial;
var light: HemisphericLight;
var pbr: PBRMetallicRoughnessMaterial;

// CreateScene function that creates and return the scene
var createScene = function(){
    var scene = new Scene(engine);
    var camera = new ArcRotateCamera("Camera", Math.PI / 2,  Math.PI / 2, 100, Vector3.Zero(), scene);

    if (false) {
    camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
    camera.orthoLeft = -1;
    camera.orthoRight = 5;
    camera.orthoTop = 1;
    camera.orthoBottom = -5;
    }

    camera.attachControl(canvas, true);
	
	//Light direction is up and left
	light = new HemisphericLight("hemiLight", new Vector3(-1, 1, 0), scene);
	//light.diffuse = new Color3(1, 0, 0);
	//light.specular = new Color3(0, 1, 0);
	//light.groundColor = new Color3(0, 1, 0);
	
	grass0 = new StandardMaterial("grass0", scene);
    grass0.diffuseTexture = new Texture("img/grass.png", scene);
	
	grass1 = new StandardMaterial("grass1", scene);
	grass1.emissiveTexture = new Texture("img/grass.png", scene);
	
	grass2 = new StandardMaterial("grass2", scene);
	grass2.ambientTexture = new Texture("img/grass.png", scene);
    grass2.diffuseColor = new Color3(1, 0, 0);
    
    pbr = new PBRMetallicRoughnessMaterial("pbr", scene);

    pbr.baseColor = new Color3(1.0, 0.766, 0.336);
    pbr.metallic = 1.0;
    pbr.roughness = 0.1;
    pbr.environmentTexture = CubeTexture.CreateFromPrefilteredData("img/environment.dds", scene);

    return scene;
}

// call the createScene function
var scene = createScene();

const allGlyphs: Mesh[] = []

// run the render loop

let n = 0;
engine.runRenderLoop(function(){
    n++;
    let i = 0;

    //light.direction.x = Math.sin(n * 0.02);   
    //light.direction.z = Math.cos(n * 0.02); 
    //light.direction.y = 0.1;  

    if (true) {
        allGlyphs.forEach(g => {
            g.rotation = new Vector3(Math.cos(n * 0.01) * Math.PI + i * 0.1 * Math.sin(n * 0.02), 0, 0);
            i++;
        })
        }
    scene.render();
});
// the canvas/window resize event handler
window.addEventListener('resize', function(){
    engine.resize();
});

interface Pt { x: number, y: number }

class PathHelper {
    constructor(public commands: OpenType.PathCommand[] = []) {

    }

    isClockwise() {
        let sum = 0;
        let last = this.commands[this.commands.length - 1];
        this.commands.forEach(cmd => {
            if (last.type !== 'Z' && cmd.type !== 'Z') {
                sum += (cmd.x - last.x) * (cmd.y + last.y);
            }
            last = cmd;
        })
        return sum > 0;
    }

    expand(): Pt[] {
        const pts: Pt[] = [];
        let cur: Pt = null;

        this.commands.forEach(cmd => {
            switch(cmd.type) {
                case 'M':
                    cur = { x: cmd.x, y: cmd.y }
                    pts.push(cur);
                    break;
                case 'L':
                    cur = { x: cmd.x, y: cmd.y }
                    pts.push(cur);
                    break;
                case 'C':
                    // HAAAAACK
                    const N = 50;
                    for(let i = 0; i < N; i++) {
                        const t = (i + 1) / N;
                        const t2 = t*t;
                        const t3 = t2 * t;
                        const tm = 1 - t;
                        const tm2 = tm * tm;
                        const tm3 = tm2 * tm;
                        const x = tm3 * cur.x + 3 * tm2 * t * cmd.x1 + 3 * tm * t2 * cmd.x2 + t3 * cmd.x;
                        const y = tm3 * cur.y + 3 * tm2 * t * cmd.y1 + 3 * tm * t2 * cmd.y2 + t3 * cmd.y;
                        pts.push({x, y});
                    }
                    cur = { x: cmd.x, y: cmd.y }
                    break;
                case 'Z':
                    break;
            }
        })
        // eliminate duplicates

        return pts.filter((pt, i) => {
            const next = pts[(i + 1) % pts.length];
            return pt.x != next.x || pt.y != next.y;
        })
    }
}

class Vec2D {

    static readonly Zero = new Vec2D(0, 0);

    constructor(public readonly dx: number, public readonly dy: number) {}

    add(other: Vec2D): Vec2D {
        return new Vec2D(this.dx + other.dx, this.dy + other.dy);
    }

    mul(m: number): Vec2D {
        return new Vec2D(this.dx * m, this.dy * m);
    }

    get length(): number {
        return Math.hypot(this.dx, this.dy);
    }

    get unit(): Vec2D {
        const len = this.length;
        if (len === 0) return Vec2D.Zero;
        return new Vec2D(this.dx / len, this.dy / len);
    }

    dot(other: Vec2D): number {
        return this.dx * other.dx + this.dy * other.dy;
    }

    get right90(): Vec2D {
        return new Vec2D(this.dy, -this.dx);
    }
}

class Line2D {
    constructor(public readonly pt: Point2D, public readonly vec: Vec2D) {}

    intersection(other: Line2D): Point2D | null {
        const a1 = this.pt.x, b1 = this.vec.dx, c1 = this.pt.y, d1 = this.vec.dy;
        const a2 = other.pt.x, b2 = other.vec.dx, c2 = other.pt.y, d2 = other.vec.dy;

        if (d1 * b2 + b1 * d2 == 0) {
            return null;
        }

        const t = (b1 * (c2-c1) - d1 * (a2 - a1)) / (d1 * b2 - b1 * d2);
        return new Point2D(a2 + b2 * t, c2 + d2 * t);
    }
}

class Point2D {
    constructor(public readonly x: number, public readonly y: number) {}

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
}

class Glyph {

    static nextID = 1;

    positives: Pt[][] = [];
    holes: Pt[][] = [];

    constructor(path: OpenType.Path) {
        let paths: PathHelper[] = [];
        let curPath: PathHelper = null;
        path.commands.forEach(cmd => {
            if (cmd.type === 'M') {
                curPath = new PathHelper([cmd]);
                paths.push(curPath);
            } else if (cmd.type !== 'Z') {
                curPath.commands.push(cmd);
            }
        })

        paths.forEach(path => {
            if (path.isClockwise()) this.positives.push(path.expand());
            else this.holes.push(path.expand())
        })
    }

    make(scene: Scene, depth: number): Mesh[] {
        return this.positives.map(positive => {

            if (true) {
                const bevel = 0.2;
                const d1 = 0;
                const d2 = depth * (1 - bevel);
                const d3 = depth;

                const coords3d: number[] = [];

                const pts = positive.map(p => new Point2D(p.x, p.y));
                const paddedPts = new Array<Pt>(pts.length);
                 
                for(let i = 0; i < positive.length; i++) {
                    const p0 = pts[(i + pts.length - 1) % pts.length];
                    const p1 = pts[i];
                    const p2 = pts[(i + 1) % pts.length];
                    paddedPts[i] = p1.inset(p0, p2, depth * -bevel);
                }

                function add3dpt(x: number, y: number, z: number) {
                    coords3d.push(-x, -y, z);
                }

                const indices: number[] = [];

                let index = 0;

                function addShape(pts: Pt[], d: number, reverse: boolean) {

                    const coords2d: number[] = [];
                    pts.forEach(pt => {
                        coords2d.push(pt.x, -pt.y)
                        add3dpt(pt.x, pt.y, d);
                    });

                    const tiled = Earcut(coords2d);
                    if (reverse) tiled.reverse();
                    indices.push(...tiled.map(i => i + index));
                    index += pts.length;
                }

                // front face
                addShape(positive, d3, false);
                addShape(paddedPts, d1, true);

                // extruded edges
                for(let i = 0; i < paddedPts.length; i++) {
                    const p1 = paddedPts[i];
                    const p2 = paddedPts[(i+1) % paddedPts.length];

                    add3dpt(p1.x, p1.y, d1);
                    add3dpt(p2.x, p2.y, d1);
                    add3dpt(p1.x, p1.y, d2);
                    
                    add3dpt(p2.x, p2.y, d1);
                    add3dpt(p2.x, p2.y, d2);
                    add3dpt(p1.x, p1.y, d2);

                    for(let i = 0; i < 6; i++) indices.push(index++);
                }

                // beveled edges
                for(let i = 0; i < positive.length; i++) {
                    const a1 = positive[i];
                    const a2 = positive[(i+1) % positive.length];
                    const b1 = paddedPts[i];
                    const b2 = paddedPts[(i+1) % paddedPts.length];

                    add3dpt(b1.x, b1.y, d2);
                    add3dpt(a2.x, a2.y, d3);
                    add3dpt(a1.x, a1.y, d3);
                    add3dpt(b1.x, b1.y, d2);
                    add3dpt(b2.x, b2.y, d2); 
                    add3dpt(a2.x, a2.y, d3);

                    for(let i = 0; i < 6; i++) indices.push(index++);
                }
                    
                var customMesh = new Mesh(`poly${Glyph.nextID++}`, scene);
                var vertexData = new VertexData();
                vertexData.positions = coords3d;
                vertexData.indices = indices;   
                vertexData.applyToMesh(customMesh);            
                customMesh.position.y = 0.1;
                customMesh.material = pbr;
                return customMesh
            }
        
            let text: Mesh;
            if (depth > 0) {
                const builder = new PolygonMeshBuilder(`poly${Glyph.nextID++}`, positive.map(pt => new Vector2(pt.x, -pt.y)));
                this.holes.forEach(hole => builder.addHole(hole.concat().reverse().map(pt => new Vector2(pt.x, -pt.y))));
                text = builder.build(false, depth);
                text.position.y = depth;
                text.material = grass1;
            } else {
                text = Mesh.CreatePolygon(
                    `poly${Glyph.nextID++}`, 
                    positive.map(pt => new Vector3(pt.x, 0, -pt.y)), 
                    scene, 
                    this.holes.map(hole => hole.map(pt => new Vector3(pt.x, 0, -pt.y)))
                );
                text.position.y = 0.1;
                text.material = pbr;
            }
            return text;
        });
    }
}

async function start() {
    const font = await OpenType.load('fonts/AdobeClean-Bold.otf');
    const s = 10;
    let y = 0;
    const d = 1;
    const text = [
        'Halogen:','Look ma,', 'no holes!'
    ]
    
    text.forEach(t => {
        font.getPaths(t, 0, s * (y++), s)
        .forEach(path => allGlyphs.push(... new Glyph(path).make(scene, d)))
    })
}

start();
