import { ArcRotateCamera, Camera, Color3, CubeTexture, Engine, HemisphericLight, Mesh, MeshBuilder, PBRMetallicRoughnessMaterial, Scene, StandardMaterial, Texture, Vector3, VertexData, VolumetricLightScatteringPostProcess } from "babylonjs"

const Offset = require("polygon-offset");

import "./index.html";
import "./fonts/AdobeClean-Bold.otf";
import "./textures/grass.png";
import "./textures/environment.dds";
import { Font } from "./Font";
import { Transform } from "./Shape";
import { PolygonWithHoles } from "./PolygonWithHoles";

// Get the canvas DOM element
var canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;

const rockCamera = document.getElementById("rock-camera") as HTMLInputElement;
const animateText = document.getElementById("animate-text") as HTMLInputElement;
const varyFinish = document.getElementById("vary-finish") as HTMLInputElement;

// Load the 3D engine
var engine = new Engine(canvas, true, {preserveDrawingBuffer: true, stencil: true});

var grass0: StandardMaterial;
export var grass1: StandardMaterial;
var grass2: StandardMaterial;
var light: HemisphericLight;
export var pbr: PBRMetallicRoughnessMaterial;
var camera: ArcRotateCamera;

// CreateScene function that creates and return the scene
var createScene = function(){
    var scene = new Scene(engine);
    camera = new ArcRotateCamera("Camera", -Math.PI / 2,  Math.PI / 2, 100, Vector3.Zero(), scene);

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

var scene = createScene();
let meshes: Mesh[] = [];

let n = 0;
engine.runRenderLoop(function(){
    n++;
    let i = 0;

    if (false) {
        light.direction.x = Math.sin(n * 0.02);   
        light.direction.y = Math.cos(n * 0.02); 
        light.direction.z = 20;  
    }

    if (rockCamera.checked) {
        camera.alpha = camera.alpha + Math.cos(n * 0.01) * 0.001;
    }
    if (varyFinish.checked) {
        pbr.roughness = Math.sin(n * 0.01) * 0.2 + 0.2;
    }

    if (animateText.checked) {
        meshes.forEach((m, i) => {
            m.rotation = new Vector3(0.05 * Math.cos(n * 0.04 + i * 0.4), 0.05 * Math.cos(n * 0.1 + i * 0.5), 0);
            m.position.x = 2 * Math.cos(n * 0.04 + i * 0.04);
        })
    }

    scene.render();
});

window.addEventListener('resize', function(){
    engine.resize();
});

async function start() {
    const font = await new Font('fonts/AdobeClean-Bold.otf').ready();
    const s = 10;
    const d = 1;
    const x = -45;

    let text = "Once upon a time there was an island in the middle of the pacific ocean which had two very interesting features.";
    
    function flowText(text: string): string[] {
        const MAXCHARS = 20;
        const lines: string[] = [];
        const paragraphs = text.split("\n");
        paragraphs.forEach(para => {
            const words = para.split(" ").filter(s => s.length > 0);
            let line = words.shift() || "";
            while(words.length > 0) {
                const w = words.shift();
                if (line.length + w.length + 1 <= MAXCHARS) {
                    line = line + " " + w;
                } else {
                    lines.push(line);
                    line = w;
                }
            }
            if (line) lines.push(line);
        })
        return lines;
    }

    function renderText(text: string) {
        let y = 3;

        meshes.forEach(m => {
            m.getScene().removeMesh(m);
            m.dispose();
        })

        meshes = [];

        flowText(text).forEach(t => {
            const glyphs = font.createShapeForText(t, new Transform(x, s * (y--), 0, s));
            const mesh3ds = glyphs.createMeshes(d, 0.2, Transform.Identity);

            mesh3ds.forEach(mesh3d => {
                var customMesh = new Mesh(`poly${PolygonWithHoles.nextID++}`, scene);
                var vertexData = new VertexData();

                const positions = new Array<number>(3 * mesh3d.points.length);
                mesh3d.points.forEach((pt, i) => {
                    positions[3*i] = pt.x;
                    positions[3*i+1] = pt.y;
                    positions[3*i+2] = pt.z;
                })
                vertexData.positions = positions;
                vertexData.indices = mesh3d.indices;
                vertexData.applyToMesh(customMesh);
                customMesh.position.y = 0.1;
                customMesh.material = pbr;

                meshes.push(customMesh);
            });

        })
    }

    renderText(text);

    document.addEventListener('keydown', e => {
        switch(e.key) {
            case "Backspace":
                text = text.substring(0, text.length - 1);
                break;
            case "Enter":
                text = text + "\n";
                break;
            default:
                if (e.key.length === 1) {
                    text = text + e.key;
                }
                break;
        }
       renderText(text);
    })
}

start();
