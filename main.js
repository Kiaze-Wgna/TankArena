import * as THREE from "three";
import { Explosion } from "./explosion.js";
import { GLTFLoader } from "jsm/loaders/GLTFLoader.js";
import { RGBELoader } from "jsm/loaders/RGBELoader.js";
import {OrbitControls} from "jsm/controls/OrbitControls.js"

//constants
const locked=true;
const tankWidth=3.7
const chassisBoxLength=690
const chassisBoxWidth=463
const chassisBoxHeight=195
const pixelPerMeter=chassisBoxWidth/tankWidth
const tankLength=chassisBoxLength/pixelPerMeter
const tankHeight=chassisBoxHeight/pixelPerMeter
const playerMass=60000
const physicsSettings=[0.16,0.13,9.8]
const timescale=1
const tractionForceRatio=0.2
const projectileReloadTime=1;
const projectileRenderDistance = 100;
const maxVelocity=7
const maxAngVel=1
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
            if ((e.key === " ")&&(this.game.keyShoot==false)){
                this.game.keyShoot=true;
            }
            if (e.key === "Shift"){
                if (this.game.keySKCam){
                    this.game.keySKCam=false;
                } else {
                    this.game.keySKCam=true;
                }
            }
        });
        window.addEventListener("mousedown", e => {
            if (e.button === 0) {
                this.game.keyShoot=true;
            }
            if (e.button === 2) {
                this.game.keySCam=true;
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
                this.game.keyShoot=false;
            }
        });
        window.addEventListener("mouseup", e => {
            if (e.button === 0) {
                this.game.keyShoot=false;
            }
            if (e.button === 2) {
                this.game.keySCam=false;
            }
        });
    }
}

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
    
        let amplitude = 3*pixelPerMeter;
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

class Projectile{
    constructor(player,orientation,position){
        this.player=player
        this.bulletGeo= new THREE.CylinderGeometry(9,9,30)
        this.bulletGeo.rotateX(Math.PI / 2)
        this.bulletMat= new THREE.MeshStandardMaterial({
            color: 0xcffffff,
            flatShading:true
        });
        this.bullet= new THREE.Mesh(this.bulletGeo,this.bulletMat);
        this.bullet.quaternion.copy(orientation)
        this.bullet.position.set(position.x,position.y,position.z)
        this.player.game.scene.add(this.bullet)

        var forward = new THREE.Vector3(0, 0, 10);
        forward.applyQuaternion(orientation);
        this.speedX=forward.x + this.player.CObject.velocity.x;
        this.speedY=forward.y;
        this.speedZ=forward.z + this.player.CObject.velocity.z;
        this.deltapos = 0;
        this.bullet.position.x+=forward.x * 0.39 * this.player.game.pixelPerMeter; 
        this.bullet.position.y+=forward.y * 0.39 * this.player.game.pixelPerMeter; 
        this.bullet.position.z+=forward.z * 0.39 * this.player.game.pixelPerMeter; 
        this.explosion = null;
        this.dead = false;
    }
    update() {
        if (this.explosion == null) {
            this.deltapos += 10 * this.player.game.time * this.player.game.pixelPerMeter; 
            this.bullet.position.x+=this.speedX * this.player.game.time * this.player.game.pixelPerMeter; 
            this.bullet.position.y+=this.speedY * this.player.game.time * this.player.game.pixelPerMeter; 
            this.bullet.position.z+=this.speedZ * this.player.game.time * this.player.game.pixelPerMeter; 
            if (this.player.game.terrain.heightAt(this.bullet.position.x, this.bullet.position.z) >= this.bullet.position.y) {
                this.explosion = new Explosion(this.player.game, this.bullet.position, false);
                this._dispose();
            }
            if (this.deltapos > projectileRenderDistance * this.player.game.pixelPerMeter) {
                this._dispose();
                this.dead = true;
            }
        } else {
            this.explosion.update();
            if (this.explosion.dead) {
                this.dead = true;
            }
        }

    }
    _dispose() {
        this.player.game.scene.remove(this.bullet);
        this.bullet.geometry.dispose();
        this.bullet.material.dispose();
        this.bullet = null;
    }
}


class Player{
    constructor(game,mass,chassisDimensions,realDimensions){
        this.game=game;
        this.mass=mass;
        // Projectiles
        this.armed=false;
        this.reload=projectileReloadTime;
        this.projectiles=[]
        // Chassis
        this.chassisL=chassisDimensions[0]
        this.chassisW=chassisDimensions[1]
        this.chassisH=chassisDimensions[2]
        this.objL=realDimensions[0]
        this.objW=realDimensions[1]
        this.objH=realDimensions[2]
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
        this.gunPivot.position.set(0,58,235);
        this.turretPivot.add(this.gunPivot)
        // Shooting Camera Arm
        this.cameraShootArm= new THREE.Object3D();
        this.cameraShootArm.position.set(0,58,10);
        this.cameraShootArm.rotation.y=Math.PI;
        this.gunPivot.add(this.cameraShootArm);
        // Gun
        this.gun= new THREE.Object3D();
        this.gunPivot.add(this.gun);
        // Camera Pivot
        this.cameraPivot= new THREE.Object3D();
        this.turretPivot.add(this.cameraPivot)
        // Camera Arm
        this.cameraArm = new THREE.Object3D();
        this.cameraXi=0
        this.cameraYi=500
        this.cameraZi=-1500
        this.cameraArm.position.set(this.cameraXi,this.cameraYi,this.cameraZi); 
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
    handleProjectiles(){
        if (!this.armed){
            this.reload-=this.game.time
        }
        if (this.reload<=0) {
            this.reload=projectileReloadTime
            this.armed=true
        }
        if ((this.game.keyShoot)&&(this.armed)){
            this.armed=false
            var gunRotation= new THREE.Quaternion();
            this.gunPivot.getWorldQuaternion(gunRotation);
            var gunPosition= new THREE.Vector3();
            this.gunPivot.getWorldPosition(gunPosition);
            this.projectiles.push(new Projectile(this,gunRotation,gunPosition))
        }
        for (let i = 0; i < this.projectiles.length; i++){
            this.projectiles[i].update()
            if (this.projectiles[i].dead) {
                this.projectiles.splice(i, 1);
            }
        }
        console.log(this.projectiles);
    }
    update(){
        if (locked){
            if ((this.game.keySCam) || (this.game.keySKCam)) {
                this.cameraShootArm.add(this.game.camera.camera)
            } else {
                this.cameraArm.add(this.game.camera.camera)
            }
        }
        this.handleProjectiles()
        this.CObject.updateState()
        if (this.game.keyFwd){
            this.CObject.forwards()
        }
        if (this.game.keyBwd){
            this.CObject.backwards()
        }
        if (this.game.keyRight){
            this.CObject.right()
        }
        if (this.game.keyLeft){
            this.CObject.left()
        }
        this.CObject.update()
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

        this.forces=[0,0,0]
        this.acceleration=[0,0,0]
        this.velocity=new THREE.Vector3(0,0,0)

        this.torqueY=0
        this.angAccY=0
        this.inertiaY = this.object.mass * ( (this.object.objW*this.object.objW + this.object.objL*this.object.objL) / 12 );
        this.angVelY=0
        this.rotation=0

        this.object.obj.position.x=0
        this.object.obj.position.y=0
        this.object.obj.position.z=0
        this.yawQuat = new THREE.Quaternion();
        this.tiltQuat = new THREE.Quaternion();

        this.updateState()
    } 
    update(){
        this.updatePosition()
        this.updateProjection()
    }
    updateState(){
        this.torqueY = 0
        this.forces=[0,0,0]
        if ((this.velocity.x==0)&&(this.velocity.z==0)&&(this.angVelY==0)){
            this.cFriction=this.cosf;
        } else {
            this.cFriction=this.codf;
        }
        this.forward = new THREE.Vector3(0, 0, tractionForceRatio*this.object.mass*this.g);
        this.forward.applyEuler(new THREE.Euler(0,this.rotation,0));
    }
    forwards(){
        this.forces[0]+=this.forward.x
        this.forces[2]+=this.forward.z
    }
    backwards(){
        this.forces[0]-=this.forward.x
        this.forces[2]-=this.forward.z
    }
    right(){
        this.torqueY -= tractionForceRatio*this.object.mass*this.g*(this.object.objW/2);
    }
    left(){
        this.torqueY += tractionForceRatio*this.object.mass*this.g*(this.object.objW/2);
    }
    updatePosition(){
        this.acceleration=[this.forces[0]/this.object.mass,0,this.forces[2]/this.object.mass]
        this.velocity.x += this.acceleration[0]*this.object.game.time
        this.velocity.z += this.acceleration[2]*this.object.game.time
        //friction
        if (this.velocity.length()>this.cFriction*this.g*this.object.game.time){
            this.velocity.addScaledVector(this.velocity, -this.cFriction*this.g*this.object.game.time/this.velocity.length());
        } else {
            this.velocity.set(0,0,0)
        }

        if (this.velocity.length()>maxVelocity){
            this.velocity.setLength(maxVelocity)
        }

        this.object.obj.position.x+=this.velocity.x*this.object.game.time*this.pixelPerMeter
        this.object.obj.position.z+=this.velocity.z*this.object.game.time*this.pixelPerMeter

        this.angAccY=this.torqueY/this.inertiaY
        this.angVelY+=this.angAccY*this.object.game.time
        //Friction
        if (Math.abs(this.angVelY)>(this.object.objW/2)*this.cFriction*(this.object.mass/this.inertiaY)*this.g*this.object.game.time){
            this.angVelY-=Math.sign(this.angVelY)*(this.object.objW/2)*this.cFriction*(this.object.mass/this.inertiaY)*this.g*this.object.game.time
        } else {
            this.angVelY=0
        }

        this.angVelY = Math.max(-maxAngVel, Math.min(maxAngVel,this.angVelY))

        this.rotation+=this.angVelY*this.object.game.time
        this.yawQuat.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.angVelY * this.object.game.time));
    }
    updateProjection(){
        this.finalQuat = this.yawQuat.clone().multiply(this.tiltQuat);
        var hw = this.object.chassisW / 2;
        var hl = this.object.chassisL  / 2;

        this.corners = [
            new THREE.Vector3( hw, 0,  hl),
            new THREE.Vector3(-hw, 0,  hl),
            new THREE.Vector3( hw, 0, -hl),
            new THREE.Vector3(-hw, 0, -hl),
        ];

        for (let c of this.corners){
            c.applyQuaternion(this.finalQuat);
            c.add(this.object.obj.position);
            c.y = this.terrain.heightAt(c.x, c.z);
        }

        const right = new THREE.Vector3()
            .subVectors(this.corners[2], this.corners[3]) // BR - BL
            .normalize();

            const forward = new THREE.Vector3()
            .subVectors(this.corners[0], this.corners[2]) // FLIP
            .normalize();

        const up = new THREE.Vector3()
            .crossVectors(forward, right)
            .normalize();
        if (up.y < 0) {
            right.negate();
            up.crossVectors(forward, right).normalize();
        }
        const rotationMatrix = new THREE.Matrix4().makeBasis(
            right,
            up,
            forward
        );
        
        this.tiltQuat.setFromRotationMatrix(rotationMatrix);
        const euler = new THREE.Euler().setFromQuaternion(this.tiltQuat, 'YXZ');

        euler.y = 0;
        this.tiltQuat.setFromEuler(euler);
        this.object.obj.quaternion.copy(this.finalQuat);
        this.object.obj.position.y =
            (this.corners[0].y + this.corners[1].y + this.corners[2].y + this.corners[3].y) * 0.25;
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
        this.listener = new THREE.AudioListener();
        this.camera.add(this.listener);
        if (locked){
            this.yaw = 0;
            this.pitch = 0;
            window.addEventListener("mousemove", e => {
                this.yaw   -= e.movementX * 0.002;
                this.pitch -= e.movementY * 0.002;
                if ((this.game.keySCam)||(this.game.keySKCam)) {
                    this.pitch = Math.max(-0.13, Math.min(0.45, this.pitch));
                } else {
                    this.pitch = Math.max(-0.1, Math.min(0.05, this.pitch));
                }
                
            });
            this.minZoomScale = 0.7;
            this.maxZoomScale = 1.5;
            this.zoomSpeed = 0.001;
            window.addEventListener("wheel", e => {
                if ((this.game.keySCam==false)&&(this.game.keySKCam==false)){
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
                }
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
        this.hiddenLastTime=0
        // Game Keys
        this.input=new InputHandler(this);
        this.keyFwd=false;
        this.keyBwd=false;
        this.keyRight=false;
        this.keyLeft=false;
        this.keyShoot=false;
        this.keySCam=false;
        this.keySKCam=false;
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
        this.player=new Player(this,playerMass,[chassisBoxLength,chassisBoxWidth,chassisBoxHeight],[tankLength,tankWidth,tankHeight]);

        this.audioLoader = new THREE.AudioLoader();
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
    requestAnimationFrame(animation);
}
animation();

window.addEventListener("resize", () => {gamelis[0].resize(window.innerWidth, window.innerHeight)}, false)