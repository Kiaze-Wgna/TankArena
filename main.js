import * as THREE from "three";
import {OrbitControls} from "jsm/controls/OrbitControls.js"

//constants

//classes
class InputHandler {
    constructor(game){
        this.game = game;
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
        this.geo = new THREE.IcosahedronGeometry(1.0,2);
        this.mat= new THREE.MeshStandardMaterial({
            color: 0xcffffff,
            flatShading: true
        });
        this.mesh= new THREE.Mesh(this.geo,this.mat);
        this.game.scene.add(this.mesh)
    }
    update(){
        if (this.game.keyFwd){
            this.mesh.position.x+=1;
        }
        if (this.game.keyBwd){
            this.mesh.position.x-=1;
        }
        if (this.game.keyRight){
            this.mesh.position.z+=1;
        }
        if (this.game.keyLeft){
            this.mesh.position.z-=1;
        }
        if (this.game.keyJump){
            this.mesh.position.y+=1;
        }
        if (this.game.keySneak){
            this.mesh.position.y-=1;
        }
    }
};

class Camera{
    constructor(game){
        this.game=game;
        this.fov = 75;
        this.aspect = this.game.width/this.game.height;
        this.nearLimit = 0.1; //<near no render
        this.farLimit = 10; //>far no render
        this.camera = new THREE.PerspectiveCamera(this.fov,this.aspect,this.nearLimit,this.farLimit);
        this.camera.position.z =5;
        this.controls = new OrbitControls(this.camera, this.game.renderer.domElement)
    }
    update(){
        this.camera.position.x=this.game.player.mesh.position.x;
        this.camera.position.y=this.game.player.mesh.position.y;
        this.camera.position.z=this.game.player.mesh.position.z+5;
    }
};

class Game{
    constructor(){
        this.width= window.innerWidth;
        this.height= window.innerHeight;
        this.renderer = new THREE.WebGLRenderer({antialias:true});
        this.renderer.setSize(this.width,this.height);
        document.body.appendChild(this.renderer.domElement);
        this.camera=new Camera(this)
        this.scene = new THREE.Scene();
        this.light=new THREE.HemisphereLight(0x0099ff, 0xaa5500)
        this.scene.add(this.light);
        // Player
        this.player=new Player(this);
        this.test=new Block(this);
        // Game Keys
        this.input=new InputHandler(this);
        this.keyFwd=false;
        this.keyBwd=false;
        this.keyRight=false;
        this.keyLeft=false;
        this.keyJump=false;
        this.keySneak=false;
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