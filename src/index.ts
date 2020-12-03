import { ArcRotateCamera, Camera, Color3, CubeTexture, Engine, HemisphericLight, InstancedMesh, LinesBuilder, Mesh, MeshBuilder, PBRMetallicRoughnessMaterial, Scene, StandardMaterial, Texture, Vector3, VertexData, VolumetricLightScatteringPostProcess } from "babylonjs"
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

const extruded = document.getElementById("extruded") as HTMLInputElement;
const colorSelect = document.getElementById("color-select") as HTMLSelectElement;
const finishSelect = document.getElementById("finish-select") as HTMLSelectElement;

const fxSpeed = document.getElementById("fx-speed") as HTMLSelectElement;
const whichEffect = document.getElementById("fx-select") as HTMLSelectElement;
const playEffect = document.getElementById("play-effect") as HTMLButtonElement;

const btnGettysburg = document.getElementById("btn-gettysburg") as HTMLButtonElement;

let effectStartMS: number = -1;
let effect = "";
let effectLengthMS: number = 1000;

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
    pbr.roughness = 0.15;
    pbr.environmentTexture = CubeTexture.CreateFromPrefilteredData("img/environment.dds", scene);

    return scene;
}

var scene = createScene();

interface MeshPair {
    mesh3d: IMesh3D;
    mesh: InstancedMesh;
}
let meshes: MeshPair[] = [];

const gettysburg = 
    "Four score and seven years ago our fathers brought forth on this continent, a new nation, conceived in Liberty, "
    + "and dedicated to the proposition that all men are created equal.\n"
    + "Now we are engaged in a great civil war, testing whether that "
    + "nation, or any nation so conceived and so dedicated, can long endure. We are met on a great battle-field of that war. We have come "
    + "to dedicate a portion of that field, as a final resting place for those who here gave their lives that that nation might live. It "
    + "is altogether fitting and proper that we should do this.\n"
    + "But, in a larger sense, we can not dedicate — we can not consecrate — we can not hallow — this ground. The brave men, living "
    + "and dead, who struggled here, have consecrated it, far above our poor power to add or detract. The world will little note, nor long "
    + "remember what we say here, but it can never forget what they did here. It is for us the living, rather, to be dedicated here to the "
    + "unfinished work which they who fought here have thus far so nobly advanced. It is rather for us to be here dedicated to the great "
    + "task remaining before us — that from these honored dead we take increased devotion to that cause for which they gave the last full "
    + "measure of devotion — that we here highly resolve that these dead shall not have died in vain — that this nation, under God, shall "
    + "have a new birth of freedom — and that government of the people, by the people, for the people, shall not perish from the earth.\n"
    + "Abraham Lincoln\n"
    + "November 19, 1863\n";

function resetMeshes() {
    meshes.forEach(m => {
        m.mesh.position = new Vector3(m.mesh3d.xform.tx, m.mesh3d.xform.ty, m.mesh3d.xform.tz);
        m.mesh.scaling = new Vector3(m.mesh3d.xform.scale, m.mesh3d.xform.scale, m.mesh3d.xform.scale);

        m.mesh.rotation.x = 0;
        m.mesh.rotation.y = 0;
        m.mesh.rotation.z = 0;
    });
}

let loopIndex = 0;
engine.runRenderLoop(function(){
    loopIndex++;

    if (true) {
        light.direction.x = Math.sin(loopIndex * 0.02);   
        light.direction.y = Math.cos(loopIndex * 0.02); 
        light.direction.z = 20;  
    }

    if (rockCamera.checked) {
        camera.alpha = camera.alpha + Math.cos(loopIndex * 0.01) * 0.001;
    }

    if (animateText.checked) {
        meshes.forEach((m, i) => {
            m.mesh.rotation = new Vector3(0.05 * Math.cos(loopIndex * 0.04 + i * 0.4), 0.05 * Math.cos(loopIndex * 0.1 + i * 0.5), 0);
            m.mesh.scaling.x += 0.00002 * Math.cos(loopIndex * 0.03 + i * 0.04);
            m.mesh.position.x += 0.02 * Math.cos(loopIndex * 0.04 + i * 0.04);
        })
    }

    if (effectStartMS >= 0) {
        let t = ((new Date().getTime() - effectStartMS) / effectLengthMS);

        if (t > 1) {
            if (effect && effect != "drop-in") {
                effect = "drop-in";
                t = 0;
                effectStartMS = new Date().getTime();
            } else {
                effect = "";
                effectStartMS = -1;
            }
            resetMeshes();
        } 
        
        function delayedRamps(rampTime: number, reversed: boolean, easing: "no-ease" | "ease-start" | "ease-end" | "ease-both", cbfn: (m: MeshPair, t: number, i: number) => void) {
            meshes.forEach((m, i) => {
                const ii = reversed ? meshes.length - i : i;
                const delay = (ii / meshes.length) * (1 - rampTime);
                const tlin = Math.min(1, Math.max(0, (t - delay) / rampTime));

                let tt: number = tlin;
                const pi2 = Math.PI / 2;

                switch(easing) {
                    case "no-ease":
                        break;
                    case "ease-start":
                        tt = 1 + Math.sin(tt * pi2 - pi2);
                        break;
                    case "ease-end":
                        tt = Math.sin(tt * pi2);
                        break;
                    case "ease-both":
                        tt = (1 + Math.sin(tt * pi2 * 2 - pi2)) / 2;
                        break;
                }

                cbfn(m, tt, i);
            })
        }

        function ramps(reversed: boolean, cbfn: (mesh: MeshPair, t: number, i: number) => void) {
            meshes.forEach((m, i) => {
                const ii = reversed ? meshes.length - i : i;
                const rampTime = (ii + 1)/ meshes.length;
                const tt = Math.min(1, t / rampTime);
                cbfn(m, tt, i);
            })
        }

        // a "far off distance" -- assuming the camera isn't too far out, so
        // obviously this is a total hack
        const D = 50 * lines.length;

        if (effect === "drop-in") {
            delayedRamps(0.5, true, "ease-end", (m, t) => {
                m.mesh.position.x = m.mesh3d.xform.tx;
                m.mesh.position.y = m.mesh3d.xform.ty + D * (1 -t);
                m.mesh.position.z = m.mesh3d.xform.tz;
            })
        } else if (effect === "slide-off") {
            delayedRamps(0.7, true, "ease-start", (m, t) => {
                m.mesh.position.x = m.mesh3d.xform.tx + D * t;
                m.mesh.position.y = m.mesh3d.xform.ty;
                m.mesh.position.z = m.mesh3d.xform.tz;
            });
        } else if (effect === "zoom") {
            delayedRamps(0.5, false, "ease-start", (m, t) => {
                m.mesh.position.z = m.mesh3d.xform.tz - t * D;
            });
        } else if (effect === "twist-away") {
            delayedRamps(0.5, false, "ease-start", (m, t) => {
                const tinv = 1 - t;
                const scale = m.mesh3d.xform.scale * tinv;
                m.mesh.scaling.x = m.mesh3d.xform.scale * tinv;
                m.mesh.scaling.z = m.mesh3d.xform.scale * tinv;
                m.mesh.rotation.y = t * Math.PI / 2;
            });
        } else if (effect === "fall-down") {
            delayedRamps(0.1, false, "ease-both", (m, t) => {
                const s = m.mesh3d.xform.scale;
                m.mesh.scaling.x = s * (t === 1 ? 0 : 1);
                m.mesh.scaling.z = s * (1 - t);
                m.mesh.rotation.x = t * Math.PI / 2;
            });
        } else if (effect === "explode") {
            meshes.forEach((m, i) => {
                m.mesh.rotation.z = t * 10 * Math.cos(i * 0.1);
                m.mesh.rotation.y = t * 10 * Math.sin(i * 0.13);
                m.mesh.position.x = m.mesh3d.xform.tx + t * D * Math.cos(i);
                m.mesh.position.y = m.mesh3d.xform.ty + t * D * Math.sin(i);
                m.mesh.position.z = m.mesh3d.xform.tz + t * D * Math.sin(i * 2);
            })
        }

    }

    scene.render();
});

window.addEventListener('resize', function(){
    engine.resize();
});

const masterMeshCache: { [id: string]: Mesh } = {};
const meshInstanceCache: { [id: string]: InstancedMesh[] } = {};

let lines: string[] = [];

async function start() {

    const t0 = performance.now();
    const f1 = await new Font('fonts/AdobeClean-Bold.otf', "f1").ready();
    const f2 = await new Font('fonts/AmaticSC-Bold.ttf', "f2").ready();
    const f3 = await new Font('fonts/Lobster-Regular.ttf', "f3").ready();
    const f4 = await new Font('fonts/Pacifico-Regular.ttf', "f4").ready();
    const t1 = performance.now();
    console.log(`loading all the fonts took ${(t1-t0).toFixed(1)} ms`);

    const s = 10;
    const d = 1;

    let top = 0;
    let left = -45;
    let maxChars = 20;

    let text = "Once upon a time there was an island in the middle of the pacific ocean.";
    
    function flowText(text: string): string[] {
        maxChars = Math.min(80, Math.max(20, 2 * Math.floor(Math.sqrt(text.length))));
        left = maxChars * -2;
        const lines: string[] = [];
        const paragraphs = text.split("\n");
        paragraphs.forEach(para => {
            const words = para.split(" ").filter(s => s.length > 0);
            let line = words.shift() || "";
            while(words.length > 0) {
                const w = words.shift();
                if (line.length + w.length + 1 <= maxChars) {
                    line = line + " " + w;
                } else {
                    lines.push(line);
                    line = w;
                }
            }
            lines.push(line);
            lines.push("")
        })

        top = (lines.length - 1) / 2        

        return lines;
    }

    let font = f1;

    function renderText(text: string) {

        let oldMeshes = meshes;
        meshes = [];

        lines = flowText(text);
        let y = top;

        const t0 = performance.now();

        lines.forEach(t => {
            if (!t) {
                y -= 0.5;
                return;
            }
            const glyphs = font.createShapeForText(t, new Transform(left, s * (y--), 0, s));

            const d = extruded.checked ? 1 : 0;
            const mesh3ds = glyphs.createMeshes(d, 0.2, Transform.Identity);

            // TODO: Stop creating meshes each time; reuse, and also use instances so we
            // don't need to create multiple instances of the same glyph.

            mesh3ds.forEach(mesh3d => {

                let masterMesh = masterMeshCache[mesh3d.id];
                if (!masterMesh) {
                    masterMesh = new Mesh(`poly${PolygonWithHoles.nextID++}`, scene);
                    masterMesh.isVisible = false;

                    var vertexData = new VertexData();

                    const positions = new Array<number>(3 * mesh3d.points.length);
                    mesh3d.points.forEach((pt, i) => {
                        positions[3*i] = pt.x;
                        positions[3*i+1] = pt.y;
                        positions[3*i+2] = pt.z;
                    })
                    vertexData.positions = positions;
                    vertexData.indices = mesh3d.indices;
                    vertexData.applyToMesh(masterMesh);
                    masterMesh.material = pbr;
                    masterMeshCache[mesh3d.id] = masterMesh;
                }

                let mesh: InstancedMesh = null;

                const old = oldMeshes.find(m => m.mesh3d.id === mesh3d.id);
                if (old) {
                    mesh = old.mesh;
                    oldMeshes.splice(oldMeshes.indexOf(old), 1);
                } else {
                    let cached = meshInstanceCache[mesh3d.id];

                    if (cached && cached.length > 0) {
                        mesh = cached.pop();
                        mesh.getScene().addMesh(mesh);
                    } else {
                        mesh = masterMesh.createInstance(`poly${PolygonWithHoles.nextID++}`);
                    }
                }

                mesh.position = new Vector3(mesh3d.xform.tx, mesh3d.xform.ty, mesh3d.xform.tz);
                mesh.scaling = new Vector3(mesh3d.xform.scale, mesh3d.xform.scale, mesh3d.xform.scale)
                meshes.push({ mesh: mesh, mesh3d: mesh3d });
            });

        })

        oldMeshes.forEach(m => {
            m.mesh.getScene().removeMesh(m.mesh);
            const list = meshInstanceCache[m.mesh3d.id] || (meshInstanceCache[m.mesh3d.id] = []);
            list.push(m.mesh);
        })

        const t1 = performance.now();
        console.log(`reflow took ${(t1-t0).toFixed(1)}`)

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

    extruded.onchange = () => { renderText(text) };
    
    function play() {
        effectStartMS = new Date().getTime();
        effect = whichEffect.value;
        effectLengthMS = parseFloat(fxSpeed.value);
    }

    playEffect.onclick = play;
    whichEffect.onchange = play;
    fxSpeed.onchange = play;

    finishSelect.onchange = evt => {
        pbr.roughness = parseFloat(finishSelect.value);
    }

    colorSelect.onchange = evt => {
        pbr.baseColor = new Color3(...colorSelect.value.split(",").map(s => parseFloat(s)));
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

    btnGettysburg.onclick = evt => {
        if (text.startsWith(gettysburg)) {
            text = text + "\n" + gettysburg;
        } else {
            text = gettysburg;
        }
        renderText(text);
    }    
}

start();
