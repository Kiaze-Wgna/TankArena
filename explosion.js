import * as THREE from "three";

export class Explosion {
  constructor(game, position, continuous) {
    this.game = game;
    this.scale = this.game.pixelPerMeter;
    this.scene = game.scene;
    this.continuous = continuous;

    this.time = 0;
    this.duration = 3;

    this.group = new THREE.Group();
    this.group.position.copy(position);
    this.scene.add(this.group);
    this.dead = false;
    this.currentFire = true;
    this.oldGroups = [];

    this.stexture = new THREE.TextureLoader().load('/assets/smoke_blur.png');
    this.ftexture = new THREE.TextureLoader().load('/assets/fire_desat.png');

    this.sound = new THREE.PositionalAudio(this.game.camera.listener);
    this.group.add(this.sound);

    this._createFire();
    this.smokeCreate = false;    
  }

  _createFire() {
    this.fire = this._createSystem({
      count: 600,
      speedMin: 3 * this.scale,
      speedMax: 7 * this.scale,
      sizeMin: 10 * this.scale,
      sizeMax: 30 * this.scale,
      spread: 0.3,
      upscale: 0.9,
      lifeScale: 0.7,
      texture: this.ftexture,
      blending: THREE.AdditiveBlending,
      colorA: new THREE.Color(1, 0.7, 0.2),
      colorB: new THREE.Color(0.8, 0.1, 0.0)
    });

    this.group.add(this.fire.points);
    this.game.audioLoader.load("/assets/explosion.mp3", (buffer) => {
      this.sound.setBuffer(buffer);
      this.sound.setRefDistance(5 * this.scale);   // distance where volume is “normal”
      this.sound.setVolume(5.0);
      this.sound.play();
    });
  }

  _createSmoke() {
    this.smoke = this._createSystem({
      count: 500,
      speedMin: 8 * this.scale,
      speedMax: 10 * this.scale,
      sizeMin: 5 * this.scale,
      sizeMax: 15 * this.scale,
      spread: 0.41,
      upscale: 1.1,
      lifeScale: 0.5,
      texture: this.stexture,
      blending: THREE.NormalBlending,
      colorA: new THREE.Color(0.3, 0.3, 0.3),
      colorB: new THREE.Color(0.05, 0.05, 0.05)
    });

    this.group.add(this.smoke.points);
  }

  _createSystem(opts) {
    const geo = new THREE.BufferGeometry();

    const positions = new Float32Array(opts.count * 3);
    const velocities = new Float32Array(opts.count * 3);
    const sizes = new Float32Array(opts.count);
    const life = new Float32Array(opts.count);

    for (let i = 0; i < opts.count; i++) {
      const dir = new THREE.Vector3().randomDirection();
      const speed = opts.speedMin + Math.random() * (opts.speedMax - opts.speedMin);
      const spread = opts.spread;

      positions.set([0, 0, 0], i * 3);

      velocities.set([dir.x * speed * spread, Math.abs(dir.y) * speed * opts.upscale + this.scale, dir.z * speed * spread], i * 3);

      sizes[i] = opts.sizeMin + Math.random() * (opts.sizeMax - opts.sizeMin);
      life[i] = Math.random();
    }

    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("velocity", new THREE.BufferAttribute(velocities, 3));
    geo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute("life", new THREE.BufferAttribute(life, 1));

    const mat = new THREE.ShaderMaterial({
      defines: {
        LOOP: opts.continuous ? 1 : 0
      },
      transparent: true,
      depthWrite: false,
      blending: opts.blending,

      uniforms: {
        uTime: { value: 0 },
        uTexture: { value: opts.texture },
        uColorA: { value: opts.colorA },
        uColorB: { value: opts.colorB },
        uLifeScale: { value: opts.lifeScale }
      },

      vertexShader: `
        attribute vec3 velocity;
        attribute float size;
        attribute float life;

        uniform float uTime;
        uniform float uLifeScale;

        varying float vLife;

        void main() {
          float t = (uTime * uLifeScale) - life;
          t = clamp(t, 0.0, 1.0);

          vLife = t;

          if (t <= 0.0) {
            gl_PointSize = 0.0;
            gl_Position = vec4(0.0);
            return;
          }

          float ease = 1.0 - pow(1.0 - t, 2.0); // fast start, slow end

          vec3 pos = position + velocity * ease;

          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mvPosition;

          float grow = smoothstep(0.0, 0.3, t);

          gl_PointSize = size * grow * (80.0 / -mvPosition.z);
        }
      `,

      fragmentShader: `
        uniform sampler2D uTexture;
        uniform vec3 uColorA;
        uniform vec3 uColorB;

        varying float vLife;

        void main() {
          vec4 tex = texture2D(uTexture, gl_PointCoord);

          float alpha = smoothstep(1.0, 0.2, vLife) * tex.a;

          vec3 color = mix(uColorA, uColorB, vLife);

          gl_FragColor = vec4(color, alpha);
        }
      `
    });

    return {
      points: new THREE.Points(geo, mat),
      material: mat
    };
  }

  update() {
    this.time += this.game.time;
    
    if (this.time > (this.duration - 0.9) && this.continuous) {
      this.oldGroups.push({
        group: this.group,
        fire: this.fire,
        smoke: this.smoke,
        startTime: this.time
      });
      this.currentFire = false;

      this.group = new THREE.Group();
      this.scene.add(this.group);
  
      this.time = 0;
  
      this._createSmoke();
    }

    const smokeDelay = 0.2;
    if (this.currentFire) {
      this.fire.material.uniforms.uTime.value = this.time;
    }
    if (this.time > smokeDelay) {
      if (this.smokeCreate) {
        this.smoke.material.uniforms.uTime.value = Math.max(0, this.time - smokeDelay);
      } else {
        this._createSmoke();
        this.smokeCreate = true;
      }
    }

    for (let i = this.oldGroups.length - 1; i >= 0; i--) {
      const g = this.oldGroups[i];

      g.startTime += this.game.time;
  
      if (g.fire) g.fire.material.uniforms.uTime.value = g.startTime;
      if (g.smoke) g.smoke.material.uniforms.uTime.value = g.startTime - smokeDelay;
  
      if (g.startTime > this.duration + 1.0) {
        this.scene.remove(g.group);
  
        g.group.traverse(obj => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) obj.material.dispose();
        });
  
        this.oldGroups.splice(i, 1);
      }
    }

    if (!this.continuous && this.time > this.duration + 1.0) {
      this.scene.remove(this.group);
      this.group.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
      this.dead = true;
    }
  }
}