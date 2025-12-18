import * as THREE from "three";
import {OrbitControls} from "jsm/controls/OrbitControls.js"

//constants

//classes
class InputHandler {
    constructor(game){
        this.game = game;
        window.addEventListener("click", () => {
            document.body.requestPointerLock();
        });
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
        this.geo = new THREE.BoxGeometry(5,1,5);
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
        this.chassisGeo = new THREE.BoxGeometry(2,1,3);
        this.mat= new THREE.MeshStandardMaterial({
            color: 0xcffffff,
            flatShading: true
        });
        this.chassis= new THREE.Mesh(this.chassisGeo,this.mat);
        this.game.scene.add(this.chassis)
        // Turret Pivot
        this.turretPivot= new THREE.Object3D();
        this.turretPivot.position.set(0, 1 ,0.9)
        this.chassis.add(this.turretPivot)
        // Turret
        this.turretGeo = new THREE.CylinderGeometry(0.3,0.6,1,16);
        this.turret = new THREE.Mesh(this.turretGeo, this.mat);
        this.turretPivot.add(this.turret);
        // Gun Pivot
        this.gunPivot= new THREE.Object3D();
        this.turretPivot.add(this.gunPivot)
        // Gun
        this.gunGeo = new THREE.CylinderGeometry(0.1,0.1,1,16);
        this.gun= new THREE.Mesh(this.gunGeo,this.mat);
        this.gun.position.set(0,0.2,-0.8);
        this.gun.rotation.x= - Math.PI/3;
        this.gunPivot.add(this.gun);
        // Camera Arm
        this.cameraArm = new THREE.Object3D();
        this.cameraArm.position.set(0, 1, 3); 
        this.gunPivot.add(this.cameraArm);
        this.cameraArm.add(this.game.camera.camera)
    }
    update(){
        if (this.game.keyFwd){
            this.chassis.translateZ(-1);
        }
        if (this.game.keyBwd){
            this.chassis.translateZ(1);
        }
        if (this.game.keyRight){
            this.chassis.rotation.y-=0.3;
        }
        if (this.game.keyLeft){
            this.chassis.rotation.y+=0.3;
        }
        if (this.game.keyJump){
            this.chassis.rotation.x+=0.1;
        }
        if (this.game.keySneak){
            this.chassis.rotation.x-=0.1;
        }
    }
};

class Camera{
    constructor(game){
        this.game=game;
        this.fov = 75;
        this.aspect = this.game.width/this.game.height;
        this.nearLimit = 0.1; //<near no render
        this.farLimit = 50; //>far no render
        this.camera = new THREE.PerspectiveCamera(this.fov,this.aspect,this.nearLimit,this.farLimit);
        this.camera.position.z =5;
        this.yaw = 0;
        this.pitch = 0;
        window.addEventListener("mousemove", e => {
            this.yaw   -= e.movementX * 0.002;
            this.pitch -= e.movementY * 0.002;
            this.pitch = Math.max(-0.6, Math.min(0.3, this.pitch));
        });
        this.minZoom = 2;
        this.maxZoom = 10;
        this.zoomSpeed = 0.002;
        window.addEventListener("wheel", e => {
            this.game.player.cameraArm.position.z += e.deltaY * this.zoomSpeed;

            this.game.player.cameraArm.position.z = Math.max(
                this.minZoom,
                Math.min(this.maxZoom, this.cameraArm.position.z)
            );
        });
    }
    update(){
        this.game.player.turretPivot.rotation.y = this.yaw;
        this.game.player.gunPivot.rotation.x = this.pitch;
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
        this.light=new THREE.HemisphereLight(0x0099ff, 0xaa5500)
        this.scene.add(this.light);
        // Game Keys
        this.input=new InputHandler(this);
        this.keyFwd=false;
        this.keyBwd=false;
        this.keyRight=false;
        this.keyLeft=false;
        this.keyJump=false;
        this.keySneak=false;
        // Camera
        this.camera=new Camera(this)
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