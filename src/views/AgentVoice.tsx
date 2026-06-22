import { useEffect, useRef } from "react";
import * as THREE from "three";
import { InfoTooltip } from "../components/InfoTooltip";

const PREMIUM_COSMIC_ACCENT = "#8b5cf6";
const ORB_TEAL = "#22d3ee";

function isWebGLAvailable() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(window.WebGLRenderingContext && (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")));
  } catch {
    return false;
  }
}

export function AgentVoice() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const statusRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    if (!isWebGLAvailable()) {
      mount.classList.add("agent-voice-webgl-missing");
      mount.innerHTML = "<div>WebGL is unavailable in this browser session.</div>";
      if (statusRef.current) statusRef.current.textContent = "WebGL unavailable";
      return undefined;
    }

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.className = "agent-voice-webgl-canvas";
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0.08, 6.2);

    const orbColor = new THREE.Color(ORB_TEAL);
    const violetColor = new THREE.Color(PREMIUM_COSMIC_ACCENT);

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
      },
      vertexShader: `
        uniform float uTime;
        varying vec3 vNormalW;
        varying vec3 vPositionW;

        float wave(vec3 p, float scale, float speed, float phase) {
          return sin(p.x * scale + uTime * speed + phase) *
                 cos(p.y * (scale * 0.73) - uTime * (speed * 0.82) + phase * 0.37) *
                 sin(p.z * (scale * 0.51) + uTime * (speed * 0.49));
        }

        void main() {
          vec3 n = normalize(normal);
          float breathe = sin(uTime * 1.2) * 0.022;
          float layered = wave(position, 3.2, 0.62, 0.0) * 0.055;
          layered += wave(position, 6.7, -0.38, 1.7) * 0.031;
          layered += wave(position, 12.0, 0.23, 3.1) * 0.014;
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
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        varying vec3 vNormalW;
        varying vec3 vPositionW;
        void main() {
          vec3 viewDir = normalize(cameraPosition - vPositionW);
          float rim = pow(1.0 - abs(dot(normalize(vNormalW), viewDir)), 2.0);
          float pulse = 0.68 + sin(uTime * 1.05) * 0.08;
          vec3 color = mix(uColorA, uColorB, 0.28 + sin(uTime * 0.18) * 0.08);
          gl_FragColor = vec4(color * (0.34 + rim * 0.8), rim * 0.24 * pulse);
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

    let animationFrame = 0;
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
      orbMaterial.uniforms.uTime.value = elapsed;
      glowMaterial.uniforms.uTime.value = elapsed;
      orb.rotation.y = elapsed * 0.185;
      orb.rotation.x = Math.sin(elapsed * 0.19) * 0.11 + elapsed * 0.035;
      glow.rotation.copy(orb.rotation);
      halo.rotation.z = elapsed * 0.12;
      halo.scale.setScalar(1 + Math.sin(elapsed * 1.15) * 0.018);
      softLight.intensity = 1.48 + Math.sin(elapsed * 1.1) * 0.22;
      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(animate);
    };

    if (statusRef.current) statusRef.current.textContent = "Tier 1 rendering";
    animate();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
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

  return (
    <div className="agent-voice-page agent-voice-page-cosmic scroll">
      <header className="agent-voice-hero agent-voice-cosmic-hero">
        <div className="agent-voice-titleblock">
          <span className="stub-tag">AGENT VOICE INTERFACE · TIER 1</span>
          <div className="hero-title-with-help">
            <h1>Melkizac Cosmic Voice Core</h1>
            <InfoTooltip label="About Melkizac voice core">
              Tier 1 replaces the old voice morph video with a live WebGL orb: a premium-cosmic, teal energy-field presence for Melkizac. Next tiers add nebula background, spoken-response audio reactivity, and the Andrej / Enrico / Lynx / Troas constellation.
            </InfoTooltip>
          </div>
          <p>
            Plan locked: Melkizac as the primary face, premium cosmic palette, agent spoken-response reactivity, full idle/listening/processing/speaking/error states, and desktop docking for Andrej, Enrico, Lynx, and Troas.
          </p>
        </div>
        <div className="agent-voice-actions agent-voice-cosmic-actions" aria-label="Tier 1 status">
          <span ref={statusRef} className="agent-voice-status demo">Preparing WebGL</span>
          <span className="agent-voice-pill">Standalone route first</span>
          <span className="agent-voice-pill accent">Premium cosmic</span>
        </div>
      </header>

      <section className="agent-voice-stage agent-voice-cosmic-stage" aria-label="Tier 1 Melkizac voice-reactive orb preview">
        <div ref={mountRef} className="agent-voice-three-mount" />
        <div className="voice-hud top-left">
          <span>Primary agent</span>
          <b>Melkizac</b>
        </div>
        <div className="voice-hud top-right">
          <span>Current layer</span>
          <b>Orb only</b>
        </div>
        <div className="voice-core-label">
          <span>Tier 1 verification</span>
          <b>wireframe · halo · breathing</b>
        </div>
      </section>

      <section className="agent-voice-notes agent-voice-tier-notes">
        <div>
          <h2>Tier 1 target</h2>
          <p>A centered, dim teal wireframe icosahedron with fresnel rim glow, transparent energy-field edges, a soft halo shell, and slow two-axis tumbling.</p>
        </div>
        <div>
          <h2>Next layer</h2>
          <p>Tier 2 adds the separate deep-space background renderer: procedural nebula drift, twinkling stars, pooled glow, distant network nodes, and dust.</p>
        </div>
        <div>
          <h2>Voice integration direction</h2>
          <p>The real signal target is Melkizac's spoken response audio, with synthetic motion as fallback and iOS-safe analyser handling when we wire Tier 3.</p>
        </div>
      </section>
    </div>
  );
}
