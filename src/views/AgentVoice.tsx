import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../components/Icon";
import { InfoTooltip } from "../components/InfoTooltip";

type VoiceStatus = "idle" | "listening" | "demo" | "error";
type AudioMetrics = {
  volume: number;
  bass: number;
  mid: number;
  treble: number;
  centroid: number;
};

const FFT_SIZE = 1024;
const SMOOTHING = 0.78;
const INITIAL_METRICS: AudioMetrics = { volume: 0, bass: 0, mid: 0, treble: 0, centroid: 0 };

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function bandAverage(data: Uint8Array, startRatio: number, endRatio: number) {
  const start = Math.max(0, Math.floor(data.length * startRatio));
  const end = Math.max(start + 1, Math.floor(data.length * endRatio));
  let total = 0;
  for (let i = start; i < end; i += 1) total += data[i];
  return clamp01(total / ((end - start) * 255));
}

function rms(data: Uint8Array) {
  let total = 0;
  for (let i = 0; i < data.length; i += 1) {
    const centered = (data[i] - 128) / 128;
    total += centered * centered;
  }
  return clamp01(Math.sqrt(total / data.length) * 1.8);
}

function spectralCentroid(data: Uint8Array) {
  let weighted = 0;
  let total = 0;
  for (let i = 0; i < data.length; i += 1) {
    const amp = data[i] / 255;
    weighted += amp * i;
    total += amp;
  }
  return total <= 0.0001 ? 0 : clamp01(weighted / total / data.length);
}

function morphMetric(previous: number, next: number, smoothing = SMOOTHING) {
  return previous * smoothing + next * (1 - smoothing);
}

function statusLabel(status: VoiceStatus) {
  if (status === "listening") return "Live microphone input";
  if (status === "demo") return "Demo oscillator input";
  if (status === "error") return "Microphone unavailable";
  return "Visualizer idle";
}

export function AgentVoice() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const metricsRef = useRef<AudioMetrics>(INITIAL_METRICS);
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [metrics, setMetrics] = useState<AudioMetrics>(INITIAL_METRICS);
  const [error, setError] = useState<string | null>(null);

  const isRunning = status === "listening" || status === "demo";

  const summary = useMemo(() => [
    { label: "volume", value: metrics.volume },
    { label: "bass", value: metrics.bass },
    { label: "mid", value: metrics.mid },
    { label: "treble", value: metrics.treble },
  ], [metrics]);

  function stop() {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    oscillatorRef.current?.stop();
    oscillatorRef.current = null;
    gainRef.current?.disconnect();
    gainRef.current = null;
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    void contextRef.current?.close();
    contextRef.current = null;
    metricsRef.current = INITIAL_METRICS;
    setMetrics(INITIAL_METRICS);
    setStatus("idle");
  }

  function startLoop(analyser: AnalyserNode) {
    const frequency = new Uint8Array(analyser.frequencyBinCount);
    const time = new Uint8Array(analyser.fftSize);
    let frame = 0;

    const tick = () => {
      analyser.getByteFrequencyData(frequency);
      analyser.getByteTimeDomainData(time);
      const raw = {
        volume: rms(time),
        bass: bandAverage(frequency, 0.015, 0.13),
        mid: bandAverage(frequency, 0.13, 0.46),
        treble: bandAverage(frequency, 0.46, 0.92),
        centroid: spectralCentroid(frequency),
      };
      const previous = metricsRef.current;
      const next = {
        volume: morphMetric(previous.volume, raw.volume, 0.68),
        bass: morphMetric(previous.bass, raw.bass),
        mid: morphMetric(previous.mid, raw.mid),
        treble: morphMetric(previous.treble, raw.treble),
        centroid: morphMetric(previous.centroid, raw.centroid, 0.72),
      };
      metricsRef.current = next;
      if (frame % 3 === 0) setMetrics(next);
      drawVoiceField(canvasRef.current, frequency, next, performance.now());
      frame += 1;
      animationRef.current = requestAnimationFrame(tick);
    };

    tick();
  }

  async function startMic() {
    stop();
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser does not expose microphone capture. Use HTTPS and a modern Chromium/Safari/Firefox browser.");
      setStatus("error");
      return;
    }
    try {
      const context = new AudioContext({ latencyHint: "interactive" });
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
        video: false,
      });
      const analyser = context.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = 0.62;
      context.createMediaStreamSource(stream).connect(analyser);
      contextRef.current = context;
      streamRef.current = stream;
      analyserRef.current = analyser;
      setStatus("listening");
      startLoop(analyser);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Microphone permission was denied or unavailable.");
      setStatus("error");
    }
  }

  async function startDemo() {
    stop();
    setError(null);
    const context = new AudioContext({ latencyHint: "interactive" });
    const analyser = context.createAnalyser();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0.6;
    oscillator.type = "sawtooth";
    oscillator.frequency.value = 138;
    gain.gain.value = 0.08;
    oscillator.connect(gain).connect(analyser);
    oscillator.start();
    contextRef.current = context;
    analyserRef.current = analyser;
    oscillatorRef.current = oscillator;
    gainRef.current = gain;
    setStatus("demo");

    const wobble = () => {
      if (!oscillatorRef.current || !gainRef.current) return;
      const now = performance.now() / 1000;
      oscillatorRef.current.frequency.value = 120 + Math.sin(now * 1.4) * 44 + Math.sin(now * 5.1) * 18;
      gainRef.current.gain.value = 0.045 + Math.max(0, Math.sin(now * 2.7)) * 0.075;
      window.setTimeout(wobble, 64);
    };
    wobble();
    startLoop(analyser);
  }

  useEffect(() => {
    drawVoiceField(canvasRef.current, new Uint8Array(FFT_SIZE / 2), INITIAL_METRICS, performance.now());
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="agent-voice-page scroll">
      <header className="agent-voice-hero">
        <div className="agent-voice-titleblock">
          <span className="stub-tag">AGENT VOICE INTERFACE</span>
          <div className="hero-title-with-help">
            <h1>JARVIS-style Live Voice Visualizer</h1>
            <InfoTooltip label="About voice visualizer">
              A low-latency voice-reactive canvas that morphs rings, particles, color, and frequency bands from live speech features. It uses the browser Web Audio pipeline for the deployed Mission Control page, with a demo oscillator fallback for environments without microphone permission.
            </InfoTooltip>
          </div>
        </div>
        <div className="agent-voice-actions">
          <span className={`agent-voice-status ${status}`}>{statusLabel(status)}</span>
          <button className="task-icon-action dark" onClick={() => void startMic()} aria-label="Start live microphone visualizer" title="Start microphone">
            <Icon name="mic" size={18} />
          </button>
          <button className="btn" onClick={() => void startDemo()}>{status === "demo" ? "Restart demo" : "Demo mode"}</button>
          <button className="btn ghost" onClick={stop} disabled={!isRunning}>Stop</button>
        </div>
      </header>

      <section className="agent-voice-stage" aria-label="Live agent voice morphing visualizer">
        <canvas ref={canvasRef} className="agent-voice-canvas" width={1280} height={720} />
        <div className="voice-hud top-left">
          <span>AudioContext</span>
          <b>{isRunning ? "interactive" : "standby"}</b>
        </div>
        <div className="voice-hud top-right">
          <span>Latency target</span>
          <b>&lt; 50ms UI loop</b>
        </div>
        <div className="voice-core-label">
          <span>Hermes Voice Core</span>
          <b>{Math.round(metrics.volume * 100)}%</b>
        </div>
      </section>

      {error && <div className="agent-voice-error">{error}</div>}

      <section className="agent-voice-metrics" aria-label="Audio feature metrics">
        {summary.map((item) => (
          <div className="voice-meter" key={item.label}>
            <div className="voice-meter-row"><span>{item.label}</span><b>{Math.round(item.value * 100)}</b></div>
            <i><em style={{ width: `${Math.round(item.value * 100)}%` }} /></i>
          </div>
        ))}
        <div className="voice-meter">
          <div className="voice-meter-row"><span>centroid</span><b>{Math.round(metrics.centroid * 100)}</b></div>
          <i><em style={{ width: `${Math.round(metrics.centroid * 100)}%` }} /></i>
        </div>
      </section>

      <section className="agent-voice-notes">
        <div>
          <h2>Mapping logic</h2>
          <p>Volume expands the core and particle radius. Bass drives ring thickness, mids bend the polygon lattice, treble injects sparks, and spectral centroid shifts the teal → blue → gold color mix.</p>
        </div>
        <div>
          <h2>Performance posture</h2>
          <p>Canvas rendering is isolated from React state. Audio metrics update every animation frame, while React HUD values are throttled to every third frame to keep the interface responsive.</p>
        </div>
        <div>
          <h2>Java note</h2>
          <p>If we later need a native kiosk app, the same signal model can be ported to Processing or LWJGL. For this web page, Web Audio is the lowest-latency deployment path.</p>
        </div>
      </section>
    </div>
  );
}

function drawVoiceField(canvas: HTMLCanvasElement | null, frequency: Uint8Array, metrics: AudioMetrics, nowMs: number) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;

  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(640, Math.floor((rect.width || 1280) * dpr));
  const height = Math.max(360, Math.floor((rect.height || 720) * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const t = nowMs / 1000;
  const cx = width / 2;
  const cy = height / 2;
  const min = Math.min(width, height);
  const pulse = 0.76 + metrics.volume * 0.38;
  const bass = metrics.bass;
  const mid = metrics.mid;
  const treble = metrics.treble;
  const hue = 176 + metrics.centroid * 52 + treble * 18;

  const gradient = ctx.createRadialGradient(cx, cy, min * 0.02, cx, cy, min * 0.72);
  gradient.addColorStop(0, `hsl(${hue}, 92%, ${10 + metrics.volume * 9}%)`);
  gradient.addColorStop(0.45, "#07111f");
  gradient.addColorStop(1, "#02050b");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(cx, cy);

  for (let ring = 0; ring < 7; ring += 1) {
    const radius = min * (0.12 + ring * 0.052) * pulse + Math.sin(t * (1.2 + ring * 0.11)) * min * 0.006;
    ctx.beginPath();
    const sides = 96;
    for (let i = 0; i <= sides; i += 1) {
      const a = (Math.PI * 2 * i) / sides;
      const freqIndex = Math.floor((i / sides) * frequency.length);
      const amp = (frequency[freqIndex] || 0) / 255;
      const wobble = Math.sin(a * (3 + ring) + t * (1.5 + ring * 0.2)) * mid * min * 0.018;
      const spoke = amp * min * (0.018 + ring * 0.002);
      const r = radius + wobble + spoke;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = `hsla(${hue + ring * 8}, 94%, ${58 + ring * 3}%, ${0.2 + 0.08 * ring + metrics.volume * 0.2})`;
    ctx.lineWidth = Math.max(1, min * (0.0014 + bass * 0.006));
    ctx.shadowColor = `hsla(${hue}, 95%, 62%, ${0.3 + metrics.volume * 0.42})`;
    ctx.shadowBlur = min * (0.01 + metrics.volume * 0.018);
    ctx.stroke();
  }

  const bars = 96;
  for (let i = 0; i < bars; i += 1) {
    const a = (Math.PI * 2 * i) / bars + t * 0.12;
    const f = frequency[Math.floor((i / bars) * frequency.length)] / 255 || 0;
    const inner = min * (0.305 + bass * 0.035);
    const outer = inner + min * (0.03 + f * 0.17 + treble * 0.035);
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
    ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
    ctx.strokeStyle = `hsla(${hue + f * 70}, 96%, ${54 + f * 24}%, ${0.18 + f * 0.72})`;
    ctx.lineWidth = Math.max(1, min * 0.0022);
    ctx.shadowBlur = min * 0.004 + f * min * 0.018;
    ctx.stroke();
  }

  for (let i = 0; i < 150; i += 1) {
    const seed = i * 12.9898;
    const a = (seed + t * (0.1 + treble * 0.45)) % (Math.PI * 2);
    const lane = (i % 9) / 9;
    const jitter = Math.sin(t * (0.7 + lane) + i) * min * 0.015 * mid;
    const r = min * (0.22 + lane * 0.42) + jitter + metrics.volume * min * 0.09;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    const size = min * (0.0018 + ((i % 5) / 5) * 0.002 + treble * 0.0038);
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${hue + lane * 72}, 90%, ${54 + lane * 22}%, ${0.16 + treble * 0.58})`;
    ctx.shadowBlur = size * 6;
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(0, 0, min * (0.078 + metrics.volume * 0.048), 0, Math.PI * 2);
  const core = ctx.createRadialGradient(0, 0, min * 0.005, 0, 0, min * (0.13 + metrics.volume * 0.04));
  core.addColorStop(0, "rgba(255,255,255,.95)");
  core.addColorStop(0.18, `hsla(${hue}, 95%, 68%, .92)`);
  core.addColorStop(0.58, `hsla(${hue + 22}, 95%, 46%, .28)`);
  core.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = core;
  ctx.shadowColor = `hsla(${hue}, 95%, 62%, .8)`;
  ctx.shadowBlur = min * (0.04 + metrics.volume * 0.05);
  ctx.fill();

  ctx.restore();
}
