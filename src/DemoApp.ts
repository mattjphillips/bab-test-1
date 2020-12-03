import { ArcRotateCamera, Camera, Color3, CubeTexture, Engine, HemisphericLight, InstancedMesh, LinesBuilder, Mesh, MeshBuilder, PBRMetallicRoughnessMaterial, Scene, StandardMaterial, Texture, Vector3, VertexData, VolumetricLightScatteringPostProcess } from "babylonjs"
import { Font } from "./Font";
import { Transform } from "./Shape";
import { IMesh3D, PolygonWithHoles } from "./PolygonWithHoles";
import { GETTYSBURG_ADDRESS, SHORT_PHRASE } from "./TextSources";

import "./index.html";
import "./fonts/AdobeClean-Bold.otf";
import "./fonts/AmaticSC-Bold.ttf";
import "./fonts/Lobster-Regular.ttf";
import "./fonts/Pacifico-Regular.ttf";
import "./textures/grass.png";
import "./textures/environment.dds";

// Get the canvas DOM element
var canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;

const controls = {
    fontSelect: document.getElementById("font-select") as HTMLSelectElement,
    rockCamera: document.getElementById("rock-camera") as HTMLInputElement,
    animateText: document.getElementById("animate-text") as HTMLInputElement,

    extruded: document.getElementById("extruded") as HTMLInputElement,
    colorSelect: document.getElementById("color-select") as HTMLSelectElement,
    finishSelect: document.getElementById("finish-select") as HTMLSelectElement,

    fxSpeed: document.getElementById("fx-speed") as HTMLSelectElement,
    fxIn: document.getElementById("fx-in-select") as HTMLSelectElement,
    fxOut: document.getElementById("fx-out-select") as HTMLSelectElement,
    playEffect: document.getElementById("play-effect") as HTMLButtonElement,

    btnGettysburg: document.getElementById("btn-gettysburg") as HTMLButtonElement
}

interface MeshPair {
    mesh3d: IMesh3D;
    mesh: InstancedMesh;
}

export class DemoApp {

    engine: Engine;
    scene: Scene;
    light: HemisphericLight;
    pbr: PBRMetallicRoughnessMaterial;
    camera: ArcRotateCamera;
    
    effectStartMS: number = -1;
    effect = "";
    effectLengthMS: number = 1000;

    masterMeshCache: { [id: string]: Mesh } = {};
    meshInstanceCache: { [id: string]: InstancedMesh[] } = {};

    fontScale: number = 10;
    top: number;
    left: number;
    maxChars: number;
    meshes: MeshPair[] = [];

    currentFont: Font;

    text: string;
    lines: string[] = [];

    appStartTimeMS = new Date().getTime();

    constructor() {
    }

    async start() {
        this.engine = new Engine(canvas, true, {preserveDrawingBuffer: true, stencil: true});
        this.scene = new Scene(this.engine);
        this.setupScene();

        let loopIndex = 0;
        this.engine.runRenderLoop(() => {
            this.updateScene();
        });

        window.addEventListener('resize', () => { 
            this.engine.resize();
        });

        await this.loadFonts();

        this.text = SHORT_PHRASE;
        this.currentFont = this.fonts[0];

        this.renderText(this.text);

        this.addControlListeners();

        console.log("startup complete");
    }

    setupScene() {
        const scene = this.scene
        this.camera = new ArcRotateCamera("Camera", -Math.PI / 2,  Math.PI / 2, 100, Vector3.Zero(), scene);
        
        if (false) {
            this.camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
            this.camera.orthoLeft = -1;
            this.camera.orthoRight = 5;
            this.camera.orthoTop = 1;
            this.camera.orthoBottom = -5;
        }
        
        this.camera.attachControl(canvas, true);
        
        this.light = new HemisphericLight("hemiLight", new Vector3(-1, 1, 0), scene);
        
        this.pbr = new PBRMetallicRoughnessMaterial("pbr", scene);
        this.pbr.baseColor = new Color3(1.0, 0.766, 0.336);
        this.pbr.metallic = 1.0;
        this.pbr.roughness = 0.15;
        this.pbr.environmentTexture = CubeTexture.CreateFromPrefilteredData("img/environment.dds", scene);
    }

    resetMeshes() {
        this.meshes.forEach(m => {
            m.mesh.position.x = m.mesh3d.xform.tx;
            m.mesh.position.y = m.mesh3d.xform.ty;
            m.mesh.position.z = m.mesh3d.xform.tz;

            m.mesh.scaling.x = m.mesh3d.xform.scale;
            m.mesh.scaling.y = m.mesh3d.xform.scale;
            m.mesh.scaling.z = m.mesh3d.xform.scale;

            m.mesh.rotation.x = 0;
            m.mesh.rotation.y = 0;
            m.mesh.rotation.z = 0;

            m.mesh.isVisible = true;            
        });
    }

    updateScene() {

        const t = this.elapsedMS();
        const ts = t / 1000;

        if (true) {
            this.light.direction.x = Math.sin(ts * 2);   
            this.light.direction.y = Math.cos(ts * 2); 
            this.light.direction.z = 20;  
        }

        if (controls.rockCamera.checked) {
            this.camera.alpha = this.camera.alpha + Math.cos(ts) * 0.001;
        }

        if (controls.animateText.checked) {
            this.meshes.forEach((m, i) => {
                m.mesh.rotation.x = 0.05 * Math.cos(ts * 4 + i * 0.4); 
                m.mesh.rotation.y = 0.05 * Math.cos(ts * 10 + i * 0.5);
                m.mesh.scaling.x += 0.00002 * Math.cos(ts * 3 + i * 0.04);
                m.mesh.position.x += 0.02 * Math.cos(ts * 4 + i * 0.04);
            })
        }

        if (this.effectStartMS >= 0) {
            let fxTime = (t - this.effectStartMS) / this.effectLengthMS;

            if (fxTime > 1) {
                if (this.effect === controls.fxOut.value) {
                    this.effect = controls.fxIn.value;
                    fxTime = 0;
                    this.effectStartMS = t;
                } else {
                    this.effect = "";
                    this.effectStartMS = -1;
                }
                this.resetMeshes();
            } 
            
            const delayedRamps = (
                rampTime: number, 
                reversed: boolean, 
                easing: "no-ease" | "ease-start" | "ease-end" | "ease-both", 
                cbfn: (m: MeshPair, t: number, i: number) => void
            ) => {
                this.meshes.forEach((m, i) => {
                    const ii = reversed ? this.meshes.length - i : i;
                    const delay = (ii / this.meshes.length) * (1 - rampTime);
                    const tlin = Math.min(1, Math.max(0, (fxTime - delay) / rampTime));

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

            // a "far off distance" -- assuming the camera isn't too far out, so
            // obviously this is a total hack
            const D = 50 * this.lines.length;

            if (this.effect === "drop-in") {
                delayedRamps(0.5, true, "ease-end", (m, t) => {
                    m.mesh.position.x = m.mesh3d.xform.tx;
                    m.mesh.position.y = m.mesh3d.xform.ty + D * (1 -t);
                    m.mesh.position.z = m.mesh3d.xform.tz;
                })
            } else if (this.effect === "slide-off") {
                delayedRamps(0.7, true, "ease-start", (m, t) => {
                    m.mesh.position.x = m.mesh3d.xform.tx + D * t;
                    m.mesh.position.y = m.mesh3d.xform.ty;
                    m.mesh.position.z = m.mesh3d.xform.tz;
                });
            } else if (this.effect === "slide-in") {
                delayedRamps(0.7, true, "ease-end", (m, t) => {
                    m.mesh.position.x = m.mesh3d.xform.tx - D + D * t;
                    m.mesh.position.y = m.mesh3d.xform.ty;
                    m.mesh.position.z = m.mesh3d.xform.tz;
                });
            } else if (this.effect === "zoom") {
                delayedRamps(0.5, false, "ease-start", (m, t) => {
                    m.mesh.position.z = m.mesh3d.xform.tz - t * D;
                });
            } else if (this.effect === "zoom-in-1") {
                delayedRamps(0.2, false, "ease-end", (m, t) => {
                    m.mesh.position.z = m.mesh3d.xform.tz - D + t * D;
                });
            } else if (this.effect === "zoom-in-2") {
                delayedRamps(0.9, false, "ease-end", (m, t) => {
                    m.mesh.position.z = m.mesh3d.xform.tz - D + t * D;
                });
            } else if (this.effect === "twist-away") {
                delayedRamps(0.5, false, "ease-start", (m, t) => {
                    const tinv = 1 - t;
                    const scale = m.mesh3d.xform.scale * tinv;
                    m.mesh.scaling.x = m.mesh3d.xform.scale * tinv;
                    m.mesh.scaling.z = m.mesh3d.xform.scale * tinv;
                    m.mesh.rotation.y = t * Math.PI / 2;
                });
            } else if (this.effect === "fall-down") {
                delayedRamps(0.1, false, "ease-both", (m, t) => {
                    const s = m.mesh3d.xform.scale;
                    m.mesh.scaling.x = s * (t === 1 ? 0 : 1);
                    m.mesh.scaling.z = s * (1 - t);
                    m.mesh.rotation.x = t * Math.PI / 2;
                });
            } else if (this.effect === "explode") {
                const t = fxTime; // want rapid exit
                this.meshes.forEach((m, i) => {
                    m.mesh.rotation.z = t * 10 * Math.cos(i * 0.1);
                    m.mesh.rotation.y = t * 10 * Math.sin(i * 0.13);
                    m.mesh.position.x = m.mesh3d.xform.tx + t * D * Math.cos(i);
                    m.mesh.position.y = m.mesh3d.xform.ty + t * D * Math.sin(i);
                    m.mesh.position.z = m.mesh3d.xform.tz + t * D * Math.sin(i * 2);
                })
            } else if (this.effect === "unexplode") {
                const t = Math.pow(1 - fxTime, 2); // soft landing
                this.meshes.forEach((m, i) => {
                    m.mesh.rotation.z = t * 10 * Math.cos(i * 0.1);
                    m.mesh.rotation.y = t * 10 * Math.sin(i * 0.13);
                    m.mesh.position.x = m.mesh3d.xform.tx + t * D * Math.cos(i);
                    m.mesh.position.y = m.mesh3d.xform.ty + t * D * Math.sin(i);
                    m.mesh.position.z = m.mesh3d.xform.tz + t * D * Math.sin(i * 2);
                })
            } else if (this.effect === "typewriter") {
                this.meshes.forEach((m, i) => {
                    m.mesh.isVisible = fxTime >= (i / this.meshes.length);
                })
            }

        }

        this.scene.render();
    }

    renderText(text: string) {

        let oldMeshes = this.meshes;
        this.meshes = [];

        this.lines = this.flowText(text);
        let y = this.top;

        const t0 = performance.now();

        this.lines.forEach(t => {
            if (!t) {
                y -= 0.5;
                return;
            }
            const glyphs = this.currentFont.createShapeForText(t, new Transform(this.left, this.fontScale * (y--), 0, this.fontScale));

            const d = controls.extruded.checked ? 1 : 0;
            const mesh3ds = glyphs.createMeshes(d, 0.2, Transform.Identity);

            mesh3ds.forEach(mesh3d => {

                let masterMesh = this.masterMeshCache[mesh3d.id];
                if (!masterMesh) {
                    masterMesh = new Mesh(`poly${PolygonWithHoles.nextID++}`, this.scene);
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
                    masterMesh.material = this.pbr;
                    this.masterMeshCache[mesh3d.id] = masterMesh;
                }

                let mesh: InstancedMesh = null;

                const old = oldMeshes.find(m => m.mesh3d.id === mesh3d.id);
                if (old) {
                    mesh = old.mesh;
                    oldMeshes.splice(oldMeshes.indexOf(old), 1);
                } else {
                    let cached = this.meshInstanceCache[mesh3d.id];

                    if (cached && cached.length > 0) {
                        mesh = cached.pop();
                        mesh.getScene().addMesh(mesh);
                    } else {
                        mesh = masterMesh.createInstance(`poly${PolygonWithHoles.nextID++}`);
                    }
                }

                mesh.position.x = mesh3d.xform.tx;
                mesh.position.y = mesh3d.xform.ty;
                mesh.position.z = mesh3d.xform.tz;
                mesh.scaling.x = mesh3d.xform.scale;
                mesh.scaling.y = mesh3d.xform.scale;
                mesh.scaling.z = mesh3d.xform.scale;

                this.meshes.push({ mesh: mesh, mesh3d: mesh3d });
            });

        })

        oldMeshes.forEach(m => {
            m.mesh.getScene().removeMesh(m.mesh);
            const list = this.meshInstanceCache[m.mesh3d.id] || (this.meshInstanceCache[m.mesh3d.id] = []);
            list.push(m.mesh);
        })

        const t1 = performance.now();
        console.log(`reflow took ${(t1-t0).toFixed(1)}`)

    }

    flowText(text: string): string[] {
        this.maxChars = Math.min(80, Math.max(20, 2 * Math.floor(Math.sqrt(text.length))));
        const lines: string[] = [];
        const paragraphs = text.split("\n");
        paragraphs.forEach(para => {
            const words = para.split(" ").filter(s => s.length > 0);
            let line = words.shift() || "";
            while(words.length > 0) {
                const w = words.shift();
                if (line.length + w.length + 1 <= this.maxChars) {
                    line = line + " " + w;
                } else {
                    lines.push(line);
                    line = w;
                }
            }
            lines.push(line);
            lines.push("")
        })

        this.left = this.maxChars * -2;
        this.top = (lines.length - 1) / 2        

        return lines;
    }

    fonts: Font[] = [];

    async loadFonts() {
        const t0 = performance.now();
        this.fonts.push(await new Font('fonts/AdobeClean-Bold.otf', "f1").ready());
        this.fonts.push(await new Font('fonts/AmaticSC-Bold.ttf', "f2").ready());
        this.fonts.push(await new Font('fonts/Lobster-Regular.ttf', "f3").ready());
        this.fonts.push(await new Font('fonts/Pacifico-Regular.ttf', "f4").ready());
        const t1 = performance.now();
        console.log(`loading all the fonts took ${(t1-t0).toFixed(1)} ms`);
    }


    elapsedMS() {
        return new Date().getTime() - this.appStartTimeMS;
    }

    addControlListeners() {

        document.addEventListener('keydown', e => {
            switch(e.key) {
                case "Backspace":
                    this.text = this.text.substring(0, this.text.length - 1);
                    break;
                case "Enter":
                    this.text = this.text + "\n";
                    break;
                case "Escape":
                    this.text = "";
                    break;
                default:
                    if (e.key.length === 1) {
                        this.text = this.text + e.key;
                    }
                    break;
            }
            this.renderText(this.text);
        })

        controls.extruded.onchange = () => { this.renderText(this.text) };
        
        const play = () => {
            this.effectStartMS = this.elapsedMS();
            this.effect = controls.fxOut.value;
            this.effectLengthMS = parseFloat(controls.fxSpeed.value);
        }

        controls.playEffect.onclick = play;
        controls.fxOut.onchange = play;
        controls.fxIn.onchange = play;
        controls.fxSpeed.onchange = play;

        controls.finishSelect.onchange = evt => {
            this.pbr.roughness = parseFloat(controls.finishSelect.value);
        }

        controls.colorSelect.onchange = evt => {
            this.pbr.baseColor = new Color3(...controls.colorSelect.value.split(",").map(s => parseFloat(s)));
        }
            
        controls.fontSelect.onchange = evt => {
            switch(controls.fontSelect.value) {
                case "adobe-clean-bold":
                    this.currentFont = this.fonts[0];
                    break;
                case "amatic-sc-bold":
                    this.currentFont = this.fonts[1];
                    break;
                case "lobster-regular":
                    this.currentFont = this.fonts[2];
                    break;
                case "pacifico-regular":
                    this.currentFont = this.fonts[3];
                    break;
            }
            this.renderText(this.text);
        }

        controls.btnGettysburg.onclick = evt => {
            if (this.text.startsWith(GETTYSBURG_ADDRESS)) {
                this.text = this.text + "\n" + GETTYSBURG_ADDRESS;
            } else {
                this.text = GETTYSBURG_ADDRESS;
            }
            this.renderText(this.text);
        }    
    }
}

