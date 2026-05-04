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
const physicsSettings=[playerMass,chassisBoxLength,chassisBoxWidth,chassisBoxHeight,tankLength,tankWidth,tankHeight,0.16,0.13,9.8]
const timescale=1
const tractionForceRatio=0.2
const projectileReloadTime=1.5;
const projectileRenderDistance = 10000;
const maxVelocity=5
const maxAngVel=0.5
const trackSoundLimit = 1

function fadeOut(sound, duration = 0.7) {
    const now = sound.context.currentTime;
    const gain = sound.gain.gain;

    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(0, now + duration);

    setTimeout(() => {
        sound.stop();
        gain.setValueAtTime(1.0, sound.context.currentTime);
    }, duration * 1000);
}

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
    constructor(tank,orientation,position){
        this.tank=tank
        this.bulletGeo= new THREE.CylinderGeometry(9,9,30)
        this.bulletGeo.rotateX(Math.PI / 2)
        this.bulletMat= new THREE.MeshStandardMaterial({
            color: 0xcffffff,
            flatShading:true
        });
        this.bullet= new THREE.Mesh(this.bulletGeo,this.bulletMat);
        this.bullet.quaternion.copy(orientation)
        this.bullet.position.set(position.x,position.y,position.z)
        this.tank.game.scene.add(this.bullet)

        var forward = new THREE.Vector3(0, 0, 10);
        forward.applyQuaternion(orientation);
        this.speedX=forward.x + this.tank.velocity.x;
        this.speedY=forward.y;
        this.speedZ=forward.z + this.tank.velocity.z;
        this.deltapos = 0;
        this.bullet.position.x+=forward.x * 0.39 * this.tank.pixelPerMeter; 
        this.bullet.position.y+=forward.y * 0.39 * this.tank.pixelPerMeter; 
        this.bullet.position.z+=forward.z * 0.39 * this.tank.pixelPerMeter; 
        this.explosion = null;
        this.dead = false;
    }
    update() {
        if (this.explosion == null) {
            this.deltapos += 10 * this.tank.game.time * this.tank.pixelPerMeter; 
            this.bullet.position.x+=this.speedX * this.tank.game.time * this.tank.pixelPerMeter; 
            this.bullet.position.y+=this.speedY * this.tank.game.time * this.tank.pixelPerMeter; 
            this.bullet.position.z+=this.speedZ * this.tank.game.time * this.tank.pixelPerMeter; 
            if (this.tank.terrain.heightAt(this.bullet.position.x, this.bullet.position.z) >= this.bullet.position.y) {
                this.explosion = new Explosion(this.tank.game, this.bullet.position, false);
                this._dispose();
            }
            if (this.deltapos > projectileRenderDistance * this.tank.pixelPerMeter) {
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
        this.tank.game.scene.remove(this.bullet);
        this.bullet.geometry.dispose();
        this.bullet.material.dispose();
        this.bullet = null;
    }
}

class Player{
    constructor(game){
        this.game=game;
        this.tank=new Tank(this.game,this.game.terrain,physicsSettings);
        this.turretPivot = this.tank.turretPivot
        this.gunPivot = this.tank.gunPivot
        
        // Shooting Camera Arm
        this.cameraShootArm= new THREE.Object3D();
        this.cameraShootArm.position.set(0,58,10);
        this.cameraShootArm.rotation.y=Math.PI;
        this.gunPivot.add(this.cameraShootArm);
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
        
        if (locked){
            this.cameraArm.add(this.game.camera.camera)
        }
    }
    update(){
        if (locked){
            if ((this.game.keySCam) || (this.game.keySKCam)) {
                this.cameraShootArm.add(this.game.camera.camera)
            } else {
                this.cameraArm.add(this.game.camera.camera)
            }
        }
        this.tank.updateState()
        if (this.game.keyShoot){
            this.tank.shoot();
        }
        if (this.game.keyFwd){
            this.tank.forwards()
        }
        if (this.game.keyBwd){
            this.tank.backwards()
        }
        if (this.game.keyRight){
            this.tank.right()
        }
        if (this.game.keyLeft){
            this.tank.left()
        }
        this.tank.update()
    }
};

class Tank{
    constructor(game,terrain,settings){
        this.game=game

        // Projectiles
        this.armed=false;
        this.reload=projectileReloadTime;
        this.projectiles=[];

        // Chassis
        this.mass=settings[0];
        this.chassisL=settings[1]
        this.chassisW=settings[2]
        this.chassisH=settings[3]
        this.objL=settings[4]
        this.objW=settings[5]
        this.objH=settings[6]
        this.obj= new THREE.Object3D();
        this.obj.position.set(0,700,0)
        this.game.scene.add(this.obj)
        // Track Sound
        this.trackSound = new THREE.PositionalAudio(this.game.camera.listener);
        this.trackFade = false;
        this.obj.add(this.trackSound);
        this.game.audioLoader.load("/assets/track.mp3", (buffer) => {
            this.trackSound.setBuffer(buffer);
            this.trackSound.setRefDistance(2 * this.pixelPerMeter);   // distance where volume is “normal”
            this.trackSound.setVolume(0.7);
        });
        this.accSound = new THREE.PositionalAudio(this.game.camera.listener);
        this.accFade = false;
        this.obj.add(this.accSound);
        this.game.audioLoader.load("/assets/acc.mp3", (buffer) => {
            this.accSound.setBuffer(buffer);
            this.accSound.setRefDistance(2 * this.pixelPerMeter);   // distance where volume is “normal”
            this.accSound.setVolume(1.0);
        });
        this.decSound = new THREE.PositionalAudio(this.game.camera.listener);
        this.decFade = false;
        this.obj.add(this.decSound);
        this.game.audioLoader.load("/assets/dec.mp3", (buffer) => {
            this.decSound.setBuffer(buffer);
            this.decSound.setRefDistance(2 * this.pixelPerMeter);   // distance where volume is “normal”
            this.decSound.setVolume(1.0);
        });
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
        // Gun
        this.gun= new THREE.Object3D();
        this.gunPivot.add(this.gun);
        // Track Sound
        this.fireSound = new THREE.PositionalAudio(this.game.camera.listener);
        this.gunPivot.add(this.fireSound);
        this.game.audioLoader.load("/assets/firing.mp3", (buffer) => {
            this.fireSound.setBuffer(buffer);
            this.fireSound.setRefDistance(2 * this.pixelPerMeter);   // distance where volume is “normal”
            this.fireSound.setVolume(1.0);
        });

        this.loadModels();

        this.cosf=settings[7]
        this.codf=settings[8]
        this.g=settings[9]
        this.accuracy=1
        this.terrain=terrain
        this.pixelPerMeter=this.game.pixelPerMeter

        this.forces=[0,0,0]
        this.acceleration=[0,0,0]
        this.velocity=new THREE.Vector3(0,0,0)
        this.totalVelocity = 0;

        this.torqueY=0
        this.angAccY=0
        this.inertiaY = this.mass * ( (this.objW*this.objW + this.objL*this.objL) / 12 );
        this.angVelY=0
        this.rotation=0

        this.obj.position.x=0
        this.obj.position.y=0
        this.obj.position.z=0
        this.yawQuat = new THREE.Quaternion();
        this.tiltQuat = new THREE.Quaternion();

        this.updateState()
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
        this.updatePosition()
        this.updateProjection()
        this.handleProjectiles()
    }
    handleProjectiles(){
        if (!this.armed){
            this.reload-=this.game.time
        }
        if (this.reload<=0) {
            this.reload=projectileReloadTime
            this.armed=true
        }
        
        for (let i = 0; i < this.projectiles.length; i++){
            this.projectiles[i].update()
            if (this.projectiles[i].dead) {
                this.projectiles.splice(i, 1);
            }
        }
    }
    shoot(){
        if (this.armed){
            this.armed=false
            var gunRotation= new THREE.Quaternion();
            this.gunPivot.getWorldQuaternion(gunRotation);
            var gunPosition= new THREE.Vector3();
            this.gunPivot.getWorldPosition(gunPosition);
            this.projectiles.push(new Projectile(this,gunRotation,gunPosition))
            this.fireSound.play();
        }
    }
    updateState(){
        this.torqueY = 0
        this.forces=[0,0,0]
        if ((this.velocity.x==0)&&(this.velocity.z==0)&&(this.angVelY==0)){
            this.cFriction=this.cosf;
        } else {
            this.cFriction=this.codf;
        }
        this.forward = new THREE.Vector3(0, 0, tractionForceRatio*this.mass*this.g);
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
        this.torqueY -= tractionForceRatio*this.mass*this.g*(this.objW/2);
    }
    left(){
        this.torqueY += tractionForceRatio*this.mass*this.g*(this.objW/2);
    }
    updatePosition(){
        this.acceleration=[this.forces[0]/this.mass,0,this.forces[2]/this.mass]
        this.velocity.x += this.acceleration[0]*this.game.time
        this.velocity.z += this.acceleration[2]*this.game.time
        //friction
        if (this.velocity.length()>this.cFriction*this.g*this.game.time){
            this.velocity.addScaledVector(this.velocity, -this.cFriction*this.g*this.game.time/this.velocity.length());
        } else {
            this.velocity.set(0,0,0)
        }

        if (this.velocity.length()>maxVelocity){
            this.velocity.setLength(maxVelocity)
        }
        const prevVelocity = this.totalVelocity
        this.totalVelocity = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);
        this.obj.position.x+=this.velocity.x*this.game.time*this.pixelPerMeter
        this.obj.position.z+=this.velocity.z*this.game.time*this.pixelPerMeter
        //track sounds
        if ((!this.trackSound.isPlaying) && (this.totalVelocity > trackSoundLimit + 0.3)) {
            this.trackFade = false;
            this.trackSound.play();
            this.decSound.stop()
        }
        if ((this.trackSound.isPlaying) && (this.totalVelocity <= trackSoundLimit - 0.3) && (!this.trackFade)) {
            this.trackFade = true;
            fadeOut(this.trackSound,0.7);
            this.decSound.play();
        }
        if ((!this.accSound.isPlaying) && (this.totalVelocity > prevVelocity)) {
            this.accFade = false;
            this.accSound.play();
        }
        if ((this.accSound.isPlaying) && (this.totalVelocity <= prevVelocity) && (!this.accFade)) {
            this.accFade = true;
            fadeOut(this.accSound,0.05);
        }


        this.angAccY=this.torqueY/this.inertiaY
        this.angVelY+=this.angAccY*this.game.time
        //Friction
        if (Math.abs(this.angVelY)>(this.objW/2)*this.cFriction*(this.mass/this.inertiaY)*this.g*this.game.time){
            this.angVelY-=Math.sign(this.angVelY)*(this.objW/2)*this.cFriction*(this.mass/this.inertiaY)*this.g*this.game.time
        } else {
            this.angVelY=0
        }

        this.angVelY = Math.max(-maxAngVel, Math.min(maxAngVel,this.angVelY))

        this.rotation+=this.angVelY*this.game.time
        this.yawQuat.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.angVelY * this.game.time));
    }
    updateProjection(){
        this.finalQuat = this.yawQuat.clone().multiply(this.tiltQuat);
        var hw = this.chassisW / 2;
        var hl = this.chassisL  / 2;

        this.corners = [
            new THREE.Vector3( hw, 0,  hl),
            new THREE.Vector3(-hw, 0,  hl),
            new THREE.Vector3( hw, 0, -hl),
            new THREE.Vector3(-hw, 0, -hl),
        ];

        for (let c of this.corners){
            c.applyQuaternion(this.finalQuat);
            c.add(this.obj.position);
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
        this.obj.quaternion.copy(this.finalQuat);
        this.obj.position.y =
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
        this.audioLoader = new THREE.AudioLoader();
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
        this.player=new Player(this);
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