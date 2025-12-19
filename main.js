import * as THREE from "three";
import { GLTFLoader } from "jsm/loaders/GLTFLoader.js";
import { RGBELoader } from "jsm/loaders/RGBELoader.js";
import {OrbitControls} from "jsm/controls/OrbitControls.js"

//constants
const locked=true;
//classes
class InputHandler {
    constructor(game){
        this.game = game;
        if (locked){
            window.addEventListener("click", () => {
                document.body.requestPointerLock();
            });
        }
        window.addEventListener("keydown", e => {
            if (((e.key === "ArrowUp")||(e.key === "w")||(e.key === "W"))&&(this.game.keyFwd==false)){
                this.game.keyFwd=true;
            }
            if (((e.key === "ArrowDown")||(e.key === "s")||(e.key === "S"))&&(this.game.keyBwd==false)){
                this.game.keyBwd=true;
            }
            if (((e.key === "ArrowRight")||(e.key === "d")||(e.key === "D"))&&(this.game.keyRight==false)){
                this.game.keyRight=true;
            }
            if (((e.key === "ArrowLeft")||(e.key === "a")||(e.key === "A"))&&(this.game.keyLeft==false)){
                this.game.keyLeft=true;
            }
            if ((e.key === " ")&&(this.game.keyJump==false)){
                this.game.keyJump=true;
            }
            if ((e.key === "Shift")&&(this.game.keySneak==false)){
                this.game.keySneak=true;
            }
        });
        window.addEventListener("keyup", e => {
            if ((e.key === "ArrowUp")||(e.key === "w")||(e.key === "W")){
                this.game.keyFwd=false;
            }
            if ((e.key === "ArrowDown")||(e.key === "s")||(e.key === "S")){
                this.game.keyBwd=false;
            }
            if ((e.key === "ArrowRight")||(e.key === "d")||(e.key === "D")){
                this.game.keyRight=false;
            }
            if ((e.key === "ArrowLeft")||(e.key === "a")||(e.key === "A")){
                this.game.keyLeft=false;
            }
            if (e.key === " "){
                this.game.keyJump=false;
            }
            if (e.key === "Shift"){
                this.game.keySneak=false;
            }
        });
    }
}

class Block{
    constructor(game){
        this.game=game;
        this.geo = new THREE.BoxGeometry(500,1,500);
        this.mat= new THREE.MeshStandardMaterial({
            color: 0xcffffff,
            flatShading: true
        });
        this.mesh= new THREE.Mesh(this.geo,this.mat);
        this.mesh.position.y=-3;
        this.game.scene.add(this.mesh)
    }
};

class Player{
    constructor(game){
        this.game=game;
        // Chassis
        this.chassis= new THREE.Object3D();
        this.game.scene.add(this.chassis)
        // Turret Pivot
        this.turretPivot= new THREE.Object3D();
        this.turretPivot.position.set(0, 212, 39)
        this.chassis.add(this.turretPivot)
        // Turret
        this.turret= new THREE.Object3D();
        this.turretPivot.add(this.turret);
        // Gun Pivot
        this.gunPivot= new THREE.Object3D();
        this.turretPivot.add(this.gunPivot)
        // Gun
        this.gun= new THREE.Object3D();
        this.gun.position.set(0,58,235);
        this.gunPivot.add(this.gun);
        // Camera Pivot
        this.cameraPivot= new THREE.Object3D();
        this.turretPivot.add(this.cameraPivot)
        // Camera Arm
        this.cameraArm = new THREE.Object3D();
        this.cameraXi=0;
        this.cameraYi=500;
        this.cameraZi=-1500;
        this.cameraArm.position.set(this.cameraXi, this.cameraYi, this.cameraZi); 
        this.cameraArm.rotation.y=Math.PI;
        this.cameraPivot.add(this.cameraArm);
        if (locked){
            this.cameraArm.add(this.game.camera.camera)
        }
        this.loadModels();
    }
    loadModels(){
        this.game.loader.load("/assets/chassis.glb", (gltf) => {
            this.chassis.add(gltf.scene);
        });
        this.game.loader.load("/assets/turret.glb", (gltf) => {
            this.turret.add(gltf.scene);
        });
        this.game.loader.load("/assets/gun.glb", (gltf) => {
            this.gun.add(gltf.scene);
        });
    }
    update(){
        if (this.game.keyFwd){
            this.chassis.translateZ(1);
        }
        if (this.game.keyBwd){
            this.chassis.translateZ(-1);
        }
        if (this.game.keyRight){
            this.chassis.rotation.y-=0.3;
        }
        if (this.game.keyLeft){
            this.chassis.rotation.y+=0.3;
        }
        if (this.game.keyJump){
            this.chassis.rotation.x-=0.1;
        }
        if (this.game.keySneak){
            this.chassis.rotation.x+=0.1;
        }
    }
};

class Camera{
    constructor(game){
        this.game=game;
        this.fov = 75;
        this.aspect = this.game.width/this.game.height;
        this.nearLimit = 0.1; //<near no render
        this.farLimit = 50000; //>far no render
        this.camera = new THREE.PerspectiveCamera(this.fov,this.aspect,this.nearLimit,this.farLimit);
        if (locked){
            this.yaw = 0;
            this.pitch = 0;
            window.addEventListener("mousemove", e => {
                this.yaw   -= e.movementX * 0.002;
                this.pitch -= e.movementY * 0.002;
                this.pitch = Math.max(-0.1, Math.min(0.05, this.pitch));
            });
            this.minZoomScale = 0.7;
            this.maxZoomScale = 1.5;
            this.zoomSpeed = 0.001;
            window.addEventListener("wheel", e => {
                this.game.player.cameraArm.position.x += e.deltaY * this.zoomSpeed * this.game.player.cameraXi;
                this.game.player.cameraArm.position.x = Math.max(
                    this.minZoomScale * this.game.player.cameraXi,
                    Math.min(this.maxZoomScale * this.game.player.cameraXi, this.game.player.cameraArm.position.x)
                );

                this.game.player.cameraArm.position.y += e.deltaY * this.zoomSpeed * this.game.player.cameraYi;
                this.game.player.cameraArm.position.y = Math.max(
                    this.minZoomScale * this.game.player.cameraYi,
                    Math.min(this.maxZoomScale * this.game.player.cameraYi, this.game.player.cameraArm.position.y)
                );

                this.game.player.cameraArm.position.z += e.deltaY * this.zoomSpeed * this.game.player.cameraZi;
                this.game.player.cameraArm.position.z = Math.min(
                    this.minZoomScale * this.game.player.cameraZi,
                    Math.max(this.maxZoomScale * this.game.player.cameraZi, this.game.player.cameraArm.position.z)
                );
            }, { passive: false });
        } else{
            this.camera.position.set(0,900,-800);
            this.controls = new OrbitControls(this.camera, this.game.renderer.domElement)
        }
        
    }
    update(){
        if (locked){
            this.game.player.turretPivot.rotation.y = this.yaw;
            this.game.player.cameraPivot.rotation.x = this.pitch;
            this.game.player.gunPivot.rotation.x = -this.pitch;
        }
    }
};

class Game{
    constructor(){
        // Renderer
        this.width= window.innerWidth;
        this.height= window.innerHeight;
        this.renderer = new THREE.WebGLRenderer({antialias:true});
        this.renderer.setSize(this.width,this.height);
        document.body.appendChild(this.renderer.domElement);
        // Scene
        this.scene = new THREE.Scene();
        this.light = new THREE.HemisphereLight(0xffffff,0x111111,1.2);
        this.scene.add(this.light);
        // Game Keys
        this.input=new InputHandler(this);
        this.keyFwd=false;
        this.keyBwd=false;
        this.keyRight=false;
        this.keyLeft=false;
        this.keyJump=false;
        this.keySneak=false;
        this.loader= new GLTFLoader();
        // Camera
        this.camera=new Camera(this)
        // Environment
        this.pmrem = new THREE.PMREMGenerator(this.renderer);
        this.pmrem.compileEquirectangularShader();
        new RGBELoader()
            .setPath("/assets/")
            .load("studio.hdr", (hdr) => {
                this.envMap = this.pmrem.fromEquirectangular(hdr).texture;
                this.scene.environment = this.envMap;
                this.scene.background = this.envMap;
                hdr.dispose();
                this.pmrem.dispose();
            });
        // Player
        this.player=new Player(this);
        this.test=new Block(this);
    }
    resize(newWidth, newHeight){
        this.width= newWidth;
        this.height= newHeight;
        this.camera.camera.aspect=this.width/this.height;
        this.camera.camera.updateProjectionMatrix();
        this.renderer.setSize(this.width, this.height);
    }
    update(){
        this.player.update();
        this.camera.update();
    }
    render(){
        this.renderer.render(this.scene, this.camera.camera);
    }
};

//actual code
var gamelis=[new Game()]
function animation() {
    gamelis[0].update();
    gamelis[0].render();
    //console.log([gamelis[0].keyFwd,gamelis[0].keyBwd,gamelis[0].keyRight,gamelis[0].keyLeft,gamelis[0].keyJump,gamelis[0].keySneak]);
    requestAnimationFrame(animation);
}
animation();

window.addEventListener("resize", () => {gamelis[0].resize(window.innerWidth, window.innerHeight)}, false)