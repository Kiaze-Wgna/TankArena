import * as THREE from "three";
import { GLTFLoader } from "jsm/loaders/GLTFLoader.js";
import { RGBELoader } from "jsm/loaders/RGBELoader.js";
import {OrbitControls} from "jsm/controls/OrbitControls.js"

//constants
const locked=true;
var physics=false
const tankWidth=3.7
const chassisBoxLength=690
const chassisBoxWidth=463
const chassisBoxHeight=195
const pixelPerMeter=chassisBoxWidth/tankWidth
const tankLength=chassisBoxLength/pixelPerMeter
const tankHeight=chassisBoxHeight/pixelPerMeter
const playerMass=60000
const physicsSettings=[0.4,0.2,9.8]
const timescale=1
const outBoundRate=100
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
            if ((e.key === "p")||(e.key === "P")){
                physics=true;
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

class Terrain{
    constructor(game){
        this.game=game
        this.geometry = new THREE.PlaneGeometry(20000, 20000,200,200);
        this.geometry.rotateX(-Math.PI / 2);
        this.pos = this.geometry.attributes.position;
        for (let i = 0; i < this.pos.count; i++) {
            this.x = this.pos.getX(i);
            this.z = this.pos.getZ(i);
            this.pos.setY(i, this.heightAt(this.x, this.z));
        }
        this.pos.needsUpdate = true;
        this.geometry.computeVertexNormals();
        
        this.mat= new THREE.MeshStandardMaterial({
            color: 0x7CFC00,
        });
        this.mat.wireframe = true;
        this.terrain = new THREE.Mesh(this.geometry, this.mat);
        this.terrain.receiveShadow = true;
        this.game.scene.add(this.terrain);
    }
    heightAt(x, z) {
        let y = 0;
    
        let amplitude = 5*pixelPerMeter;
        let frequency = 1/(50*pixelPerMeter);
    
        for (let i = 0; i < 5; i++) {
            const nx = x * frequency;
            const nz = z * frequency;
    
            y += Math.sin(nx + Math.sin(nz * 1.7)) * amplitude;
            y += Math.cos(nz + Math.cos(nx * 1.3)) * amplitude * 0.5;
    
            amplitude *= 0.5;
            frequency *= 2.2;
        }
    
        return y;
    }
}

class Player{
    constructor(game,mass,length,width,height){
        this.game=game;
        this.mass=mass
        // Chassis
        this.chassisL=length
        this.chassisW=width
        this.chassisH=height
        this.objL=this.chassisL/this.game.pixelPerMeter
        this.objW=this.chassisW/this.game.pixelPerMeter
        this.objH=this.chassisH/this.game.pixelPerMeter
        this.obj= new THREE.Object3D();
        this.obj.position.set(0,700,0)
        this.game.scene.add(this.obj)
        // Collision
        this.collisionBox= new THREE.BoxGeometry(this.chassisW,this.chassisH,this.chassisL)
        this.collisionMat= new THREE.MeshStandardMaterial({
            color: 0xcffffff,
            flatShading:true
        });
        this.collision= new THREE.Mesh(this.collisionBox,this.collisionMat);
        this.collision.position.y=chassisBoxHeight/2
        this.collision.position.z=-6
        this.obj.add(this.collision)
        // Turret Pivot
        this.turretPivot= new THREE.Object3D();
        this.turretPivot.position.set(0, 210, 39)
        this.obj.add(this.turretPivot)
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
        this.CObject=new CObject(this,this.game.terrain,physicsSettings)
        if (locked){
            this.cameraArm.add(this.game.camera.camera)
        }
        this.loadModels();
    }
    loadModels(){
        this.game.loader.load("/assets/chassis.glb", (gltf) => {
            this.obj.add(gltf.scene);
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
            this.obj.position.z+=1;
        }
        if (this.game.keyBwd){
            this.obj.position.z-=1;
        }
        if (this.game.keyRight){
            this.obj.rotation.z+=0.3;
        }
        if (this.game.keyLeft){
            this.obj.rotation.z-=0.3;
        }
        if (this.game.keyJump){
            this.obj.rotation.x-=0.1;
        }
        if (this.game.keySneak){
            this.obj.rotation.x+=0.1;
        }
        if (physics){
        this.CObject.update()
        }
    }
};

class CObject{
    constructor(object,terrain,settings){
        this.cosf=settings[0]
        this.codf=settings[1]
        this.g=settings[2]
        this.accuracy=1
        this.object=object
        this.terrain=terrain
        this.pixelPerMeter=this.object.game.pixelPerMeter
        
        this.touFR=false
        this.touFL=false
        this.touBR=false
        this.touBL=false
        
        this.forces=[]
        this.acceleration=[]
        this.velocityX=0
        this.velocityY=0
        this.velocityZ=0

        this.torqueX=0
        this.torqueY=0
        this.torqueZ=0
        this.angAccX=0
        this.angAccY=0
        this.angAccZ=0
        this.inertiaX = this.object.mass * ( (this.object.objL*this.object.objL)/12 + (this.object.objH*this.object.objH)/3 );
        this.inertiaY = this.object.mass * ( (this.object.objW*this.object.objW + this.object.objL*this.object.objL) / 12 );
        this.inertiaZ = this.object.mass * ( (this.object.objW*this.object.objW)/12 + (this.object.objH*this.object.objH)/3 );
        this.angVecX=0
        this.angVecY=0
        this.angVecZ=0

        this.resetForces()
    }
    update(){
        this.resetForces()
        this.getNormals()
        this.sumForces()
    }
    applyNormalVelocityConstraint(normal) {
        let v = new THREE.Vector3(
            this.velocityX,
            this.velocityY,
            this.velocityZ
        );
    
        let vn = v.dot(normal);
    
        if (vn < 0) {
            v.addScaledVector(normal, -vn);
            this.velocityX = v.x;
            this.velocityY = v.y;
            this.velocityZ = v.z;
        }
    }    
    resetForces(){
        this.forcesFR=[0,0,0]
        this.forcesFL=[0,0,0]
        this.forcesBR=[0,0,0]
        this.forcesBL=[0,0,0]

        this.normalFR=[0,0,0]
        this.normalFL=[0,0,0]
        this.normalBR=[0,0,0]
        this.normalBL=[0,0,0]

        this.pFR = new THREE.Vector3();
        this.pFL = new THREE.Vector3();
        this.pBR = new THREE.Vector3();
        this.pBL = new THREE.Vector3();

        this.updateCorners()
    }
    updateCorners() {
        var hx = this.object.chassisW / 2;
        var hz = this.object.chassisL  / 2;

        var euler = new THREE.Euler(this.object.obj.rotation.x, this.object.obj.rotation.y, this.object.obj.rotation.z, 'XYZ');

        var FR = new THREE.Vector3( hx, 0,  hz);
        var FL = new THREE.Vector3(-hx, 0,  hz);
        var BR = new THREE.Vector3( hx, 0, -hz);
        var BL = new THREE.Vector3(-hx, 0, -hz);

        this.pFR.copy(FR).applyEuler(euler).add(this.object.obj.position);
        this.pFL.copy(FL).applyEuler(euler).add(this.object.obj.position);
        this.pBR.copy(BR).applyEuler(euler).add(this.object.obj.position);
        this.pBL.copy(BL).applyEuler(euler).add(this.object.obj.position);
    }
    getNormals(){
        var hx = this.object.objL / 2;
        var hz = this.object.objW  / 2;

        var dx = Math.sin(this.object.obj.rotation.z) * hx;
        var dz = Math.sin(this.object.obj.rotation.x) * hz;
    
        var u = dx / this.object.objL + 0.5;
        var v = dz / this.object.objW  + 0.5;
    
        var wFR = u * v;
        var wFL = (1 - u) * v;
        var wBL = (1 - u) * (1 - v);
        var wBR = u * (1 - v);
        var wTot=0

        if (this.pFR.y<=this.terrain.heightAt(this.pFR.x,this.pFR.z)){
            wTot+=wFR
            this.touFR=true
        }
        if (this.pFL.y<=this.terrain.heightAt(this.pFL.x,this.pFL.z)){
            wTot+=wFL
            this.touFL=true
        }
        if (this.pBR.y<=this.terrain.heightAt(this.pBR.x,this.pBR.z)){
            wTot+=wBR
            this.touBR=true
        }
        if (this.pBL.y<=this.terrain.heightAt(this.pBL.x,this.pBL.z)){
            wTot+=wBL
            this.touBL=true
        }

        this.weightFR= this.object.mass * this.g * (wFR/wTot)// + (this.terrain.heightAt(this.pFR.x,this.pFR.z)-this.pFR.y)*outBoundRate
        this.weightFL= this.object.mass * this.g * (wFL/wTot)// + (this.terrain.heightAt(this.pFL.x,this.pFL.z)-this.pFL.y)*outBoundRate
        this.weightBR= this.object.mass * this.g * (wBR/wTot)// + (this.terrain.heightAt(this.pBR.x,this.pBR.z)-this.pBR.y)*outBoundRate
        this.weightBL= this.object.mass * this.g * (wBL/wTot)// + (this.terrain.heightAt(this.pBL.x,this.pBL.z)-this.pBL.y)*outBoundRate
    
    
        if (this.touFR){
            this.touFR=false
            var dydx=((this.terrain.heightAt(this.pFR.x+this.accuracy,this.pFR.z)-this.terrain.heightAt(this.pFR.x-this.accuracy,this.pFR.z))/(2*this.accuracy))/this.pixelPerMeter
            var dydz=((this.terrain.heightAt(this.pFR.x,this.pFR.z+this.accuracy)-this.terrain.heightAt(this.pFR.x,this.pFR.z-this.accuracy))/(2*this.accuracy))/this.pixelPerMeter
            
            var normal = new THREE.Vector3(-dydx, 1, -dydz).normalize();
            this.forcesFR[0] += normal.x * this.weightFR;
            this.forcesFR[1] += normal.y * this.weightFR;
            this.forcesFR[2] += normal.z * this.weightFR;

            this.applyNormalVelocityConstraint(normal);
        }
        if (this.touFL){
            this.touFL=false
            var dydx=((this.terrain.heightAt(this.pFL.x+this.accuracy,this.pFL.z)-this.terrain.heightAt(this.pFL.x-this.accuracy,this.pFL.z))/(2*this.accuracy))/this.pixelPerMeter
            var dydz=((this.terrain.heightAt(this.pFL.x,this.pFL.z+this.accuracy)-this.terrain.heightAt(this.pFL.x,this.pFL.z-this.accuracy))/(2*this.accuracy))/this.pixelPerMeter
            
            var normal = new THREE.Vector3(-dydx, 1, -dydz).normalize();
            this.forcesFL[0] += normal.x * this.weightFL;
            this.forcesFL[1] += normal.y * this.weightFL;
            this.forcesFL[2] += normal.z * this.weightFL;

            this.applyNormalVelocityConstraint(normal);
        }
        if (this.touBR){
            this.touBR=false
            var dydx=((this.terrain.heightAt(this.pBR.x+this.accuracy,this.pBR.z)-this.terrain.heightAt(this.pBR.x-this.accuracy,this.pBR.z))/(2*this.accuracy))/this.pixelPerMeter
            var dydz=((this.terrain.heightAt(this.pBR.x,this.pBR.z+this.accuracy)-this.terrain.heightAt(this.pBR.x,this.pBR.z-this.accuracy))/(2*this.accuracy))/this.pixelPerMeter
            
            var normal = new THREE.Vector3(-dydx, 1, -dydz).normalize();
            this.forcesBR[0] += normal.x * this.weightBR;
            this.forcesBR[1] += normal.y * this.weightBR;
            this.forcesBR[2] += normal.z * this.weightBR;

            this.applyNormalVelocityConstraint(normal);
        }
        if (this.touBL){
            this.touBL=false
            var dydx=((this.terrain.heightAt(this.pBL.x+this.accuracy,this.pBL.z)-this.terrain.heightAt(this.pBL.x-this.accuracy,this.pBL.z))/(2*this.accuracy))/this.pixelPerMeter
            var dydz=((this.terrain.heightAt(this.pBL.x,this.pBL.z+this.accuracy)-this.terrain.heightAt(this.pBL.x,this.pBL.z-this.accuracy))/(2*this.accuracy))/this.pixelPerMeter
            
            var normal = new THREE.Vector3(-dydx, 1, -dydz).normalize();
            this.forcesBL[0] += normal.x * this.weightBL;
            this.forcesBL[1] += normal.y * this.weightBL;
            this.forcesBL[2] += normal.z * this.weightBL;

            this.applyNormalVelocityConstraint(normal);
        }
    }
    sumForces(){
        this.forces=[
            this.forcesFR[0]+this.forcesFL[0]+this.forcesBR[0]+this.forcesBL[0],
            this.forcesFR[1]+this.forcesFL[1]+this.forcesBR[1]+this.forcesBL[1]-(this.object.mass * this.g),
            this.forcesFR[2]+this.forcesFL[2]+this.forcesBR[2]+this.forcesBL[2]]
        this.acceleration=[this.forces[0]/this.object.mass,this.forces[1]/this.object.mass,this.forces[2]/this.object.mass]
        this.velocityX+= this.acceleration[0]*this.object.game.time
        this.velocityY+= this.acceleration[1]*this.object.game.time
        this.velocityZ+= this.acceleration[2]*this.object.game.time
        this.object.obj.position.x+=this.velocityX*this.object.game.time*this.pixelPerMeter
        this.object.obj.position.y+=this.velocityY*this.object.game.time*this.pixelPerMeter
        this.object.obj.position.z+=this.velocityZ*this.object.game.time*this.pixelPerMeter
        
        this.torqueX=(this.forcesBR[1]+this.forcesBL[1]-this.forcesFR[1]-this.forcesFL[1])*(this.object.objL/2)
        this.torqueY=(((this.forcesFR[0]+this.forcesFL[0]-this.forcesBR[0]-this.forcesBL[0])*(this.object.objL/2))-((this.forcesFR[2]+this.forcesBR[2]-this.forcesFL[2]-this.forcesBL[2])*(this.object.objW/2)))
        this.torqueZ=(this.forcesFR[1]+this.forcesBR[1]-this.forcesFL[1]-this.forcesBL[1])*(this.object.objW/2)
        this.angAccX=this.torqueX/this.inertiaX
        this.angAccY=this.torqueY/this.inertiaY
        this.angAccZ=this.torqueZ/this.inertiaZ
        this.angVecX+=this.angAccX*this.object.game.time
        this.angVecY+=this.angAccY*this.object.game.time
        this.angVecZ+=this.angAccZ*this.object.game.time
        this.object.obj.rotation.x+=this.angVecX*this.object.game.time
        this.object.obj.rotation.y+=this.angVecY*this.object.game.time
        this.object.obj.rotation.z+=this.angVecZ*this.object.game.time
    }
}

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
    constructor(pixelPerMeter){
        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                this.hiddenLastTime = performance.now();
            }
        });        
        this.pixelPerMeter=pixelPerMeter
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
        // time
        this.last_time=performance.now();
        this.current_time=performance.now();
        this.time=0;
        // Game Keys
        this.input=new InputHandler(this);
        this.keyFwd=false;
        this.keyBwd=false;
        this.keyRight=false;
        this.keyLeft=false;
        this.keyJump=false;
        this.keySneak=false;
        this.loader= new GLTFLoader();
        //Terrain
        this.terrain=new Terrain(this)
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
        this.player=new Player(this,playerMass,chassisBoxLength,chassisBoxWidth,chassisBoxHeight);
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
        this.current_time=performance.now()
        if (this.hiddenLastTime!=0){
            this.last_time=this.hiddenLastTime
            this.hiddenLastTime=0
        }
        this.time=((this.current_time-this.last_time)/1000)*timescale
        this.time = Math.min(this.time, 0.033);
        this.last_time=this.current_time
        this.player.update();
        this.camera.update();
    }
    render(){
        this.renderer.render(this.scene, this.camera.camera);
    }
};

//actual code
var gamelis=[new Game(pixelPerMeter)]
function animation() {
    gamelis[0].update();
    gamelis[0].render();
    //console.log([gamelis[0].keyFwd,gamelis[0].keyBwd,gamelis[0].keyRight,gamelis[0].keyLeft,gamelis[0].keyJump,gamelis[0].keySneak]);
    requestAnimationFrame(animation);
}
animation();

window.addEventListener("resize", () => {gamelis[0].resize(window.innerWidth, window.innerHeight)}, false)