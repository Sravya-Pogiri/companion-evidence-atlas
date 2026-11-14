import { useEffect, useState, type Ref } from "react";
import { Play, Pause, Volume2, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import cameraImage from "@/assets/market-camera.jpg";

export function ReviewVideo({ bodycam = false, highlightRef }: { bodycam?: boolean; highlightRef?: Ref<HTMLElement> }) {
  const marker = bodycam ? 1385 : 942;
  const duration = bodycam ? 4113 : 2530;
  const [time, setTime] = useState(marker);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  useEffect(() => { setTime(marker); setPlaying(false); }, [marker]);
  useEffect(() => { if (!playing) return; const timer = window.setInterval(() => setTime(t => { if (t >= duration) { setPlaying(false); return duration; } return t + 1; }), 1000); return () => window.clearInterval(timer); }, [playing, duration]);
  const stamp = (seconds: number) => `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return <div className="review-video">
    <div className={`camera-frame ${bodycam ? "camera-bodycam" : ""}`}>
      {!bodycam && <img src={cameraImage} alt="Reconstructed convenience-store surveillance still" width={1280} height={720} loading="lazy" />}
      {bodycam && <><div className="street-line" /><div className="bodycam-subject"><i /><span /></div></>}
      <div className="camera-scanlines" /><span className="camera-overlay">{bodycam ? "BWC 01 · OFC. PATEL · 2026-11-02 20:41:05" : "CAM 02 · HALVORSEN MKT · 2026-11-02 20:15:42"}</span>
      <span className="camera-demo">Reconstructed demo still</span>
    </div>
    <div className="video-scrub"><input type="range" aria-label="Video position" min={0} max={duration} value={time} onChange={e => setTime(Number(e.target.value))} /><i style={{ left: `${marker / duration * 100}%` }} /></div>
    <div className="video-controls"><Button variant="ghost" size="icon" aria-label={playing ? "Pause preview" : "Play preview"} onClick={() => setPlaying(!playing)}>{playing ? <Pause /> : <Play />}</Button><span className="font-mono">{stamp(time)} / {bodycam ? "01:08:33" : "00:42:10"}</span><Button variant="ghost" size="icon" aria-label={muted ? "Unmute preview" : "Mute preview"} aria-pressed={!muted} onClick={() => setMuted(!muted)}><Volume2 /></Button><Button variant="ghost" size="icon" aria-label="Expand preview" onClick={e => { const preview = e.currentTarget.closest(".review-video"); if (document.fullscreenElement) void document.exitFullscreen().catch(() => {}); else void preview?.requestFullscreen().catch(() => {}); }}><Maximize2 /></Button></div>
    <div className="camera-log"><h3>Event log</h3>{bodycam ? <><p><time>00:21:40</time> Officer approaches at 5th & Oak</p><p><time>00:23:05</time> Subject appears to wear a <mark ref={highlightRef}>blue zip jacket</mark></p><p><time>00:24:12</time> Detention continues</p></> : <><p><time>00:15:10</time> Individual enters frame</p><p><time>00:15:42</time> Individual exits store at speed, heading north on Elm <mark ref={highlightRef}>20:15:42</mark></p><p><time>00:16:05</time> Frame clear</p></>}</div>
  </div>;
}
