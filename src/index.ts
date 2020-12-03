import { ArcRotateCamera, Camera, Color3, CubeTexture, Engine, HemisphericLight, Mesh, MeshBuilder, PBRMetallicRoughnessMaterial, Scene, StandardMaterial, Texture, Vector3, VertexData, VolumetricLightScatteringPostProcess } from "babylonjs"
import { Font } from "./Font";
import { Transform } from "./Shape";
import { IMesh3D, PolygonWithHoles } from "./PolygonWithHoles";

import "./index.html";
import "./fonts/AdobeClean-Bold.otf";
import "./fonts/AmaticSC-Bold.ttf";
import "./fonts/Lobster-Regular.ttf";
import "./fonts/Pacifico-Regular.ttf";
import "./textures/grass.png";
import "./textures/environment.dds";

// Get the canvas DOM element
var canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;

const fontSelect = document.getElementById("font-select") as HTMLSelectElement;
const rockCamera = document.getElementById("rock-camera") as HTMLInputElement;
const animateText = document.getElementById("animate-text") as HTMLInputElement;
const finishSelect = document.getElementById("finish-select") as HTMLSelectElement;

const fxSpeed = document.getElementById("fx-speed") as HTMLSelectElement;
const whichEffect = document.getElementById("fx-select") as HTMLSelectElement;
const playEffect = document.getElementById("play-effect") as HTMLButtonElement;
const slowMo = document.getElementById("slow-mo") as HTMLInputElement;

let effectTime: number = -1;
let effect = "";
let effectSpeed: number = 1000;

// Load the 3D engine
var engine = new Engine(canvas, true, {preserveDrawingBuffer: true, stencil: true});

var light: HemisphericLight;
export var pbr: PBRMetallicRoughnessMaterial;
var camera: ArcRotateCamera;

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
	
	light = new HemisphericLight("hemiLight", new Vector3(-1, 1, 0), scene);

    pbr = new PBRMetallicRoughnessMaterial("pbr", scene);
    pbr.baseColor = new Color3(1.0, 0.766, 0.336);
    pbr.metallic = 1.0;
    pbr.roughness = 0.1;
    pbr.environmentTexture = CubeTexture.CreateFromPrefilteredData("img/environment.dds", scene);

    return scene;
}

var scene = createScene();

let meshes: {
    mesh3d: IMesh3D;
    mesh: Mesh;
}[] = [];

function resetMeshes() {
    meshes.forEach(m => {
        m.mesh.position = new Vector3(m.mesh3d.xform.tx, m.mesh3d.xform.ty, m.mesh3d.xform.tz);
        m.mesh.scaling = new Vector3(m.mesh3d.xform.scale, m.mesh3d.xform.scale, m.mesh3d.xform.scale);

        m.mesh.rotation.x = 0;
        m.mesh.rotation.y = 0;
        m.mesh.rotation.z = 0;
    });
}

let n = 0;
engine.runRenderLoop(function(){
    n++;

    if (false) {
        light.direction.x = Math.sin(n * 0.02);   
        light.direction.y = Math.cos(n * 0.02); 
        light.direction.z = 20;  
    }

    if (rockCamera.checked) {
        camera.alpha = camera.alpha + Math.cos(n * 0.01) * 0.001;
    }

    if (animateText.checked) {
        meshes.forEach((m, i) => {
            m.mesh.rotation = new Vector3(0.05 * Math.cos(n * 0.04 + i * 0.4), 0.05 * Math.cos(n * 0.1 + i * 0.5), 0);
            m.mesh.scaling.x += 0.00002 * Math.cos(n * 0.03 + i * 0.04);
            m.mesh.position.x += 0.02 * Math.cos(n * 0.04 + i * 0.04);
        })
    }

    if (effectTime >= 0) {
        let t = ((new Date().getTime() - effectTime) * 1000 / effectSpeed);
        const TMAX = 1000;

        if (t > TMAX) {
            if (effect && effect != "drop-in") {
                effect = "drop-in";
                t = 0;
                effectTime = new Date().getTime();
            } else {
                effect = "";
                effectTime = -1;
            }
            resetMeshes();
        } 
        
        if (effect === "drop-in") {
            meshes.forEach((m, i) => {
                const D = 100;
                const tt = Math.min(1, Math.max(0, t * 0.004 - (meshes.length - i) * 0.02));

                m.mesh.position.x = m.mesh3d.xform.tx;
                m.mesh.position.y = m.mesh3d.xform.ty + D - D * Math.sin(tt * Math.PI / 2);
                m.mesh.position.z = m.mesh3d.xform.tz;
            })
        } else if (effect === "slide-off") {
            meshes.forEach((m, i) => {

                const delay = (meshes.length - i) * (TMAX - 400) / (meshes.length);
                const tt = Math.max(0, t - delay);

                m.mesh.position.x = m.mesh3d.xform.tx + 0.001 * tt * tt;
                m.mesh.position.y = m.mesh3d.xform.ty;
                m.mesh.position.z = m.mesh3d.xform.tz;
            });
        } else if (effect === "zoom") {
            meshes.forEach((m, i) => {

                const SCALE_TIME = 600;
                const delay = i * (TMAX - SCALE_TIME) / (meshes.length);
                const tt = Math.max(0, Math.min(1, (t - delay) / SCALE_TIME));

                m.mesh.position.z = m.mesh3d.xform.tz - tt * 100;
            });
        } else if (effect === "twist-away") {
            meshes.forEach((m, i) => {

                const SCALE_TIME = 200;
                const delay = i * (TMAX - SCALE_TIME) / (meshes.length);
                const tt = Math.max(0, Math.min(1, (t - delay) / SCALE_TIME));

                const scale = m.mesh3d.xform.scale * (1 - tt) * (1 - tt);
                m.mesh.scaling.x = m.mesh3d.xform.scale * (1 - tt) * (1 - tt);
                m.mesh.scaling.z = m.mesh3d.xform.scale * (1 - tt);
                m.mesh.rotation.y = tt * Math.PI / 2;
                //m.mesh.scaling.z = scale;
            });
        } else if (effect === "fall-down") {
            meshes.forEach((m, i) => {

                const SCALE_TIME = 200;
                const delay = i * (TMAX - SCALE_TIME) / (meshes.length);
                const tt = Math.max(0, Math.min(1, (t - delay) / SCALE_TIME));

                const s = m.mesh3d.xform.scale;
                m.mesh.scaling.x = s * (tt === 1 ? 0 : 1);
                m.mesh.scaling.z = s * (1 - tt);
                m.mesh.rotation.x = tt * Math.PI / 2;
            });
        } else if (effect === "explode") {
            const t2 = t;
            meshes.forEach((m, i) => {
                m.mesh.rotation.z = t2 * 0.01 * Math.cos(i * 0.1);
                m.mesh.rotation.y = t2 * 0.01 * Math.sin(i * 0.13);
                m.mesh.position.x = m.mesh3d.xform.tx + t2 * 0.2 * Math.cos(i);
                m.mesh.position.y = m.mesh3d.xform.ty + t2 * 0.2 * Math.sin(i);
                m.mesh.position.z = m.mesh3d.xform.tz + t2 * 0.15 * Math.sin(i * 2);
            })
        }

    }

    scene.render();
});

window.addEventListener('resize', function(){
    engine.resize();
});

async function start() {
    const f1 = await new Font('fonts/AdobeClean-Bold.otf').ready();
    const f2 = await new Font('fonts/AmaticSC-Bold.ttf').ready();
    const f3 = await new Font('fonts/Lobster-Regular.ttf').ready();
    const f4 = await new Font('fonts/Pacifico-Regular.ttf').ready();
    const s = 10;
    const d = 1;
    const x = -45;

    let text = "Once upon a time there was an island in the middle of the pacific ocean.";
    
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

    let font = f1;

    function renderText(text: string) {

        meshes.forEach(m => {
            m.mesh.getScene().removeMesh(m.mesh);
            m.mesh.dispose();
        })

        meshes = [];

        const lines = flowText(text);
        let y = (lines.length - 1) / 2;

        lines.forEach(t => {
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
                customMesh.position = new Vector3(mesh3d.xform.tx, mesh3d.xform.ty, mesh3d.xform.tz);
                customMesh.scaling = new Vector3(mesh3d.xform.scale, mesh3d.xform.scale, mesh3d.xform.scale)
                customMesh.material = pbr;

                meshes.push({ mesh: customMesh, mesh3d: mesh3d });
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
            case "Escape":
                text = "";
                break;
            default:
                if (e.key.length === 1) {
                    text = text + e.key;
                }
                break;
        }
       renderText(text);
    })

    function play() {
        effectTime = new Date().getTime();
        effect = whichEffect.value;
        effectSpeed = parseFloat(fxSpeed.value);
    }
    playEffect.onclick = play;
    whichEffect.onchange = play;
    fxSpeed.onchange = play;

    finishSelect.onchange = evt => {
        pbr.roughness = parseFloat(finishSelect.value);
    }
        
    fontSelect.onchange = evt => {
        switch(fontSelect.value) {
            case "adobe-clean-bold":
                font = f1;
                break;
            case "amatic-sc-bold":
                font = f2;
                break;
            case "lobster-regular":
                font = f3;
                break;
            case "pacifico-regular":
                font = f4;
                break;
        }
        renderText(text);
    }
}

start();
