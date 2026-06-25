import { useEffect, useRef } from "react";
import * as THREE from "three";

type VoiceCoreOrbProps = {
  energy?: number;
  pitch?: number;
  rate?: number;
  className?: string;
};

function hasWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(window.WebGLRenderingContext && (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")));
  } catch {
    return false;
  }
}

export function VoiceCoreOrb({ energy = 1, pitch = 1, rate = 1, className = "" }: VoiceCoreOrbProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const visualRef = useRef({ energy, pitch, rate });

  useEffect(() => {
    visualRef.current = { energy, pitch, rate };
  }, [energy, pitch, rate]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    if (!hasWebGL()) {
      mount.classList.add("voice-core-webgl-missing");
      mount.textContent = "WebGL unavailable";
      return undefined;
    }

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.className = "voice-core-webgl-canvas";
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0.08, 6.2);

    const orbColor = new THREE.Color("#22d3ee");
    const violetColor = new THREE.Color("#8b5cf6");

    const orbGeometry = new THREE.IcosahedronGeometry(1.42, 7);
    const orbMaterial = new THREE.ShaderMaterial({
      transparent: true,
      wireframe: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uColorA: { value: orbColor },
        uColorB: { value: violetColor },
        uIntensity: { value: 0.92 },
        uEnergy: { value: 1 },
      },
      vertexShader: `
        uniform float uTime;
        uniform float uEnergy;
        varying vec3 vNormalW;
        varying vec3 vPositionW;

        float wave(vec3 p, float scale, float speed, float phase) {
          return sin(p.x * scale + uTime * speed + phase) *
                 cos(p.y * (scale * 0.73) - uTime * (speed * 0.82) + phase * 0.37) *
                 sin(p.z * (scale * 0.51) + uTime * (speed * 0.49));
        }

        void main() {
          vec3 n = normalize(normal);
          float breathe = sin(uTime * 1.2) * 0.022 * uEnergy;
          float layered = wave(position, 3.2, 0.62, 0.0) * 0.055 * uEnergy;
          layered += wave(position, 6.7, -0.38, 1.7) * 0.031 * uEnergy;
          layered += wave(position, 12.0, 0.23, 3.1) * 0.014 * uEnergy;
          vec3 displaced = position + n * (breathe + layered);
          vec4 world = modelMatrix * vec4(displaced, 1.0);
          vNormalW = normalize(mat3(modelMatrix) * n);
          vPositionW = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: `
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        uniform float uIntensity;
        varying vec3 vNormalW;
        varying vec3 vPositionW;

        void main() {
          vec3 viewDir = normalize(cameraPosition - vPositionW);
          float fresnel = pow(1.0 - max(dot(normalize(vNormalW), viewDir), 0.0), 2.35);
          vec3 color = mix(uColorA, uColorB, fresnel * 0.55);
          float alpha = 0.16 + fresnel * 0.82;
          gl_FragColor = vec4(color * (0.72 + fresnel * 1.45) * uIntensity, alpha);
        }
      `,
    });

    const orb = new THREE.Mesh(orbGeometry, orbMaterial);
    scene.add(orb);

    const glowGeometry = new THREE.SphereGeometry(1.68, 96, 64);
    const glowMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uColorA: { value: orbColor },
        uColorB: { value: violetColor },
        uEnergy: { value: 1 },
      },
      vertexShader: `
        varying vec3 vNormalW;
        varying vec3 vPositionW;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vPositionW = world.xyz;
          vNormalW = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uEnergy;
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        varying vec3 vNormalW;
        varying vec3 vPositionW;
        void main() {
          vec3 viewDir = normalize(cameraPosition - vPositionW);
          float rim = pow(1.0 - abs(dot(normalize(vNormalW), viewDir)), 2.0);
          float pulse = 0.68 + sin(uTime * 1.05) * 0.08;
          vec3 color = mix(uColorA, uColorB, 0.28 + sin(uTime * 0.18) * 0.08);
          gl_FragColor = vec4(color * (0.34 + rim * 0.8) * uEnergy, rim * 0.24 * pulse);
        }
      `,
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    scene.add(glow);

    const haloGeometry = new THREE.RingGeometry(1.95, 2.0, 180);
    const haloMaterial = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const halo = new THREE.Mesh(haloGeometry, haloMaterial);
    halo.rotation.x = Math.PI / 2.9;
    halo.rotation.y = Math.PI / 8;
    scene.add(halo);

    const softLight = new THREE.PointLight(0x22d3ee, 1.8, 10);
    softLight.position.set(0, 0, 2.8);
    scene.add(softLight);

    let frame = 0;
    let disposed = false;
    const startedAt = performance.now();

    const resize = () => {
      const { width, height } = mount.getBoundingClientRect();
      const nextWidth = Math.max(320, Math.floor(width));
      const nextHeight = Math.max(320, Math.floor(height));
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(nextWidth, nextHeight, false);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    const animate = () => {
      if (disposed) return;
      const elapsed = (performance.now() - startedAt) / 1000;
      const visual = visualRef.current;
      const safeEnergy = Math.max(0.65, Math.min(1.9, visual.energy || 1));
      const safePitch = Math.max(0.75, Math.min(1.45, visual.pitch || 1));
      const safeRate = Math.max(0.75, Math.min(1.6, visual.rate || 1));
      orbMaterial.uniforms.uTime.value = elapsed;
      orbMaterial.uniforms.uEnergy.value = safeEnergy;
      orbMaterial.uniforms.uIntensity.value = 0.82 + safeEnergy * 0.18;
      glowMaterial.uniforms.uTime.value = elapsed;
      glowMaterial.uniforms.uEnergy.value = 0.78 + safeEnergy * 0.22;
      orb.rotation.y = elapsed * 0.185 * safeRate;
      orb.rotation.x = Math.sin(elapsed * 0.19) * 0.11 * safePitch + elapsed * 0.035;
      glow.rotation.copy(orb.rotation);
      halo.rotation.z = elapsed * 0.12 * safeRate;
      halo.scale.setScalar(1 + Math.sin(elapsed * 1.15 * safeRate) * 0.018 * safeEnergy);
      softLight.intensity = 1.18 + safeEnergy * 0.52 + Math.sin(elapsed * 1.1) * 0.22;
      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(animate);
    };

    animate();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      scene.remove(orb, glow, halo, softLight);
      orbGeometry.dispose();
      orbMaterial.dispose();
      glowGeometry.dispose();
      glowMaterial.dispose();
      haloGeometry.dispose();
      haloMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={mountRef} className={`voice-core-orb ${className}`} aria-hidden="true" />;
}
