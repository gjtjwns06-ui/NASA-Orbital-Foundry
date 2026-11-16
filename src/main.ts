import "./style.css";
import "./keyboard-assembly.css";
import "./experience-reset.css";
import {KeyboardPlacement,keyboardPlacementHTML,installedPartsHTML} from "./keyboard-assembly";
import type { FullTransferPlan } from "./transfer/types";
import type { TransferExperience } from "./transfer-ui";
import type { OperationsLesson } from "./transfer/operations-types";
import type { SwingbyExperience } from "./swingby-ui";
import type { SwingbyPlan, SwingbyEvaluation, SwingbyIssue, SwingbyNumerics } from "./swingby/types";
import {
  getTargetRequirements,
  scienceTargetKey,
  normalizeScienceTarget,
  type ScienceProfile,
} from "./sim/targets";
import {
  LAUNCH_PACKAGES,
  evaluateLaunchPackage,
  getLaunchPackage,
  type LaunchPackageId,
} from "./sim/launch";
import type { FlightForecast } from "./flight-advisor";
import {
  scienceFlowHTML,
  scienceEventIds,
  scienceEventsSince,
  type ScienceEventIds,
} from "./ui-science-flow";
import { scienceModelHTML } from "./ui-science";
import { resourceGraph, requirementTable } from "./ui-analysis";
import { componentSourceHTML, componentEvidenceLinks } from "./ui-data";
import {
  buildDebrief,
  resolveDebriefTarget,
  type Debrief,
  type DebriefTarget,
} from "./debrief";
import { debriefHTML } from "./ui-debrief";
import {
  HARDWARE_MODELS,
  BUSES,
  createHardwareDesign,
  createHardwareTransferDesign,
  createHardwareRegionDesign,
  getPartDefinition,
  getBusDefinition,
  resolveHardware,
  HARDWARE_TRANSFER_MISSION_BUDGET,
  LEGACY_TRANSFER_MISSION_BUDGET,
  type HardwareModel,
  type BusId,
  type HardwareIssue,
} from "./hardware";
import {
  hardwareBusStrip,
  hardwareBusPickerHTML,
  hardwareConnectionsHTML,
  hardwareEvidenceHTML,
  hardwareThumbnailHTML,
} from "./ui-hardware";
import { setLanguage, getLanguage, translateDOM, t } from "./i18n";
import * as THREE from "three";
import { GameScene, type ViewMode } from "./render/scene";
import { isOrbitShapeHandle } from "./render/orbit-manipulator";
import {
  PARTS,
  MISSIONS,
  createDesign,
  evaluateDesign,
  evaluatePlacement,
  createSimulation,
  advanceSimulation,
  getTelemetry,
  getResult,
  flybyMetrics,
  getManeuvers,
  initialEarthOrbit,
  updateEarthApsis,
  conjunctionMetrics,
  queueCommand,
  makeSave,
  serializeSave,
  parseSave,
  saveLocal,
  loadLocal,
  trajectory,
} from "./sim";
import type {
  Design,
  MissionId,
  Part,
  PartKind,
  DataPacket,
  Telemetry,
  SimulationState,
  MissionPreview,
  MissionResult,
  OperationKind,
  SaveFile,
} from "./sim";

const $ = <T extends HTMLElement = HTMLElement>(q: string) =>
  document.querySelector<T>(q)!;
const esc = (s: unknown) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const fmt = (n: number, d = 0) =>
  Number.isFinite(n)
    ? n.toLocaleString("en-US", {
        maximumFractionDigits: d,
        minimumFractionDigits: d,
      })
    : "—";
const time = (s: number) =>
  `${Math.floor(s / 3600)
    .toString()
    .padStart(2, "0")}:${Math.floor((s % 3600) / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(s % 60)
    .toString()
    .padStart(2, "0")}`;
const mins = (s: number) => `${Math.floor(s / 60)}m`;
const paths: Record<string, string> = {
  arrow: "M5 12h14m-6-6 6 6-6 6",
  chevron: "m9 5 7 7-7 7",
  close: "m6 6 12 12M18 6 6 18",
  help: "M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3m0 3v.1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-6v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2",
  save: "M5 3h12l4 4v14H3V3h2Zm2 0v6h10V3M7 21v-7h10v7",
  load: "M3 7h7l2 2h9l-3 11H3V7Zm1 0V3h6l2 2h7v4",
  download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
  upload: "M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5",
  undo: "M3 10h11a7 7 0 0 1 0 14M3 10l5-5M3 10l5 5",
  redo: "M21 10H10a7 7 0 0 0 0 14m11-14-5-5m5 5-5 5",
  rotate: "M20 8A9 9 0 1 0 21 15M20 3v5h-5",
  trash: "M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-6v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5",
  solar: "M3 4h18l-2 12H5L3 4Zm6 0 1 12m5-12-1 12M4 10h16M12 16v5m-4 0h8",
  camera: "M3 7h5l2-3h4l2 3h5v14H3V7Zm13 7a4 4 0 1 0-8 0 4 4 0 0 0 8 0Z",
  antenna:
    "M3 3a15 15 0 0 0 18 18L3 3Zm9 9 7-7m-4-2a6 6 0 0 1 6 6M10 18l-4 4m8-2 2 2",
  battery: "M3 6h16v12H3V6Zm16 4h3v4h-3M7 9v6m4-6v6m4-6v6",
  engine: "M8 3h8v5l4 13H4L8 8V3Zm0 5h8M8 21l2-4m6 4-2-4",
  storage: "M3 3h18v7H3V3Zm0 11h18v7H3v-7Zm4-7h.01M7 18h.01m4-11h7m-7 11h7",
  radiator: "M5 3v18m4-18v18m4-18v18m4-18v18M3 7h18M3 17h18",
  spectrometer: "m3 20 9-16 9 16H3Zm9-16v16M3 13h18",
  orbit: "M7 5a8 8 0 1 1-3 7M2 3h5v5m8 4a3 3 0 1 0-6 0 3 3 0 0 0 6 0Z",
  mass: "M5 8h14l3 13H2L5 8Zm4 0V5a3 3 0 0 1 6 0v3",
  cost: "M12 3v18m5-14c-3-4-10-3-10 1 0 5 10 2 10 7 0 4-7 5-10 1",
  power: "m13 2-9 12h7l-1 8 10-13h-7l1-7",
  play: "m7 3 15 9-15 9V3Z",
  pause: "M7 4v16M17 4v16",
  target:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-6v4m0 12v4M2 12h4m12 0h4M20 12a8 8 0 1 0-16 0 8 8 0 0 0 16 0Z",
  check: "m4 12 5 5L20 6",
  warning: "m12 3 10 18H2L12 3Zm0 6v5m0 3v.1",
  science: "M8 3h8M9 3v7l-6 10h18l-6-10V3M7 14h10",
  mouse:
    "M8 2h8a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4Zm4 0v8M4 10h16",
  volume: "M3 9h4l5-5v16l-5-5H3V9Zm13-2a7 7 0 0 1 0 10",
  mute: "M3 9h4l5-5v16l-5-5H3V9Zm13 0 6 6m0-6-6 6",
  grid: "M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7",
  info: "M12 11v6m0-10v.1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
  moon: "M20 16A9 9 0 1 1 8 4a8 8 0 0 0 12 12Z",
  rocket:
    "m9 15 6-6m-9 9-3 3m3-6-3-3 6-3c0-4 6-7 12-6 1 6-2 12-6 12l-3 6-3-3M16 6h.1",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm13 0a3 3 0 1 0-6 0 3 3 0 0 0 6 0Z",
};
function icon(name: string) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.info}"/></svg>`;
}
const partIcon = (k: PartKind) => (k === "solarLarge" ? "solar" : k);
const button = (
  action: string,
  label: string,
  ico: string,
  cls = "icon-btn",
  extra = "",
) =>
  `<button class="${cls}" data-action="${action}" title="${esc(label)}" aria-label="${esc(label)}" ${extra}>${icon(ico)}${cls.includes("icon-btn") ? "" : esc(label)}</button>`;

let design = createDesign("earth", "starter"),
  sim: SimulationState | null = null,
  preview: MissionPreview | null = null,
  previousResult: MissionResult | undefined;
let mode: ViewMode = "campus",
  selected: string | null = null,
  category = "all",
  playing = false,
  speed = 120,
  revision = 0,
  acceptedRevision = -1,
  pending = false,
  previewTime = 0,
  assetsReady = false;
type DesignSnapshot = { design: Design; transferPlan?: FullTransferPlan };
let orbitEdit: {design:Design;history:DesignSnapshot[];future:DesignSnapshot[]}|null=null;
let history: DesignSnapshot[] = [],
  future: DesignSnapshot[] = [],
  navUndo = false,
  saveTimer = 0,
  previewTimer = 0,
  lastTelemetry = 0,
  toastTimer = 0,
  lastOperationId = 0,
  sound = false,
  reducedMotion = false;
let flightForecast: FlightForecast | null = null,
  forecastWorker: Worker | null = null,
  forecastSequence = 0,
  forecastPending = false,
  lastForecastTick = -Infinity,
  lastForecastCommandCount = -1,
  stopAtTime: number | null = null;
let scienceSeen: ScienceEventIds | null = null;
let scienceAnnouncement: { packetIds: string[]; announcedAt: number } | null =
  null;
const SCIENCE_ANNOUNCEMENT_MS = 3000;
let advisorExpanded = false;
let targetProfile: ScienceProfile | null = null;
let addNodeArmed = false,
  showResources = false,
  resourceScrubbing = false;
let scene: GameScene;
let transferAssembly = false,
  transferOpening = false;
let transferDraft: FullTransferPlan | undefined;
let transferExperience: TransferExperience | null = null;
let swingbyAssembly = false, swingbyOpening = false;
let swingbyDraft: SwingbyPlan | undefined;
let swingbyNumerics:SwingbyNumerics={cruiseStepSeconds:300,activeStepSeconds:1};
let swingbyExperience: SwingbyExperience | null = null;
let archiveReview:import("./review-ui").ReviewExperience|null=null;
let archiveReviewOpening=false;
let deploymentExperience:import("./deployment-ui").DeploymentExperience|null=null;
let deploymentOpening=false;
let solarExperience:import("./solar-experience").SolarExperience|null=null;
let solarOpening=false,solarAssembly=false;
let solarAssemblyBrief:{title:string;sensor:'camera'|'spectrometer';reason:string}|null=null;
const solarAssemblySlot="orbital-solar-assembly-v1";
let swingbyModel: typeof import("./swingby") | null = null;
let swingbyEvaluation: SwingbyEvaluation | null = null;
let swingbyIssues: SwingbyIssue[] = [];
let swingbyAssemblyWorker: Worker | null = null;
let swingbyRequestId = 0;
let swingbyAssemblySave: Promise<void> = Promise.resolve();
let worker: Worker;
let audioCtx: AudioContext | null = null;
let previewTimeout = 0;
let savedAvailable = false;
let savedHardwareAvailable = false;
let hardwareMission = false;
let activeDebrief: Debrief | null = null;
let reviewContext: { label: string; time?: number } | null = null;
let modalReturnFocus: HTMLElement | null = null;
try {
  setLanguage(localStorage.getItem("orbital-language") === "en" ? "en" : "ko");
} catch {}
const app = $("#app");
app.innerHTML = `<div id="viewport"></div><div id="ui" class="overlay"></div><div id="modal-root"></div><div id="toast-root"></div><input id="import-file" class="hidden" type="file" accept="application/json,.json"/><div class="loading" id="loading"><div class="loading-logo">ORBITAL FOUNDRY</div><p>탐사를 위한 공간을 준비하고 있습니다</p><div class="bar"><i id="load-bar" style="width:3%"></i></div><small id="load-status">3D 엔진 초기화</small></div>`;
const ui = $("#ui");
document.documentElement.lang = getLanguage();
document.body.dataset.language = getLanguage();

function toast(message: string, error = false) {
  clearTimeout(toastTimer);
  $("#toast-root").innerHTML =
    `<div class="toast ${error ? "error" : ""}" role="status">${esc(message)}</div>`;
  translateDOM($("#toast-root"));
  toastTimer = window.setTimeout(() => ($("#toast-root").innerHTML = ""), 4000);
}
function beep(type = "click") {
  if (!sound) return;
  try {
    audioCtx ??= new AudioContext();
    void audioCtx.resume();
    const o = audioCtx.createOscillator(),
      g = audioCtx.createGain();
    o.connect(g);
    g.connect(audioCtx.destination);
    o.type = "sine";
    o.frequency.setValueAtTime(
      type === "success" ? 680 : 360,
      audioCtx.currentTime,
    );
    o.frequency.exponentialRampToValueAtTime(
      type === "success" ? 950 : 260,
      audioCtx.currentTime + 0.08,
    );
    g.gain.setValueAtTime(0.035, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.14);
    o.start();
    o.stop(audioCtx.currentTime + 0.15);
  } catch {}
}
function checkpoint() {
  history.push(structuredClone({ design, transferPlan: transferDraft }));
  if (history.length > 60) history.shift();
  future = [];
}
function cancelOrbitEdit() {
  if(!orbitEdit)return;
  const previous=orbitEdit;orbitEdit=null;navUndo=false;design=previous.design;history=previous.history;future=previous.future;
  scene.setDesign(design);scene.setTrajectory(trajectory(design,400));designChanged(false);
}
function updateOrbitReadouts() {
  if(design.missionId!=='earth')return;
  const orbit=initialEarthOrbit(design.plan),values:Record<string,string>={periapsis:fmt(orbit.periapsisAltitudeKm),apoapsis:fmt(orbit.apoapsisAltitudeKm),inclination:fmt(orbit.inclinationDeg,1),eccentricity:fmt(orbit.eccentricity,3),period:fmt(orbit.periodSeconds/60,1)};
  for(const [key,value]of Object.entries(values)){const el=document.querySelector(`[data-orbit-stat="${key}"]`);if(el)el.textContent=value;}
  const frame=document.querySelector('[data-orbit-frame]');if(frame)frame.textContent=design.plan.earthOrbit?(getLanguage()==='ko'?'기동 축 T · R · N (직각)':'Burn frame T · R · N (orthogonal)'):(getLanguage()==='ko'?'원궤도 · 속도 / 반경 / 법선 방향':'Circular · velocity / radial / normal');
  const status=document.querySelector('.nav-preview-status');if(status&&pending)status.textContent=getLanguage()==='ko'?'새로운 경로 계산 중':'Computing the new trajectory';
}
function earthOrbitReadoutsHTML() {
  const orbit=initialEarthOrbit(design.plan),en=getLanguage()==='en';
  const metric=(key:string,label:string,value:string,unit:string)=>`<div class="kv"><span>${label}</span><strong><b data-orbit-stat="${key}">${value}</b><small>${unit}</small></strong></div>`;
  return metric('periapsis',en?'Periapsis · Pe':'근지점 · Pe',fmt(orbit.periapsisAltitudeKm),'km')+metric('apoapsis',en?'Apoapsis · Ap':'원지점 · Ap',fmt(orbit.apoapsisAltitudeKm),'km')+metric('inclination',en?'Inclination · i':'궤도 경사각 · i',fmt(orbit.inclinationDeg,1),'°')+metric('eccentricity',en?'Eccentricity':'이심률',fmt(orbit.eccentricity,3),'')+metric('period',en?'Initial orbit period':'초기 궤도 주기',fmt(orbit.periodSeconds/60,1),en?'min':'분')+`<p class="small-note" data-orbit-frame>${design.plan.earthOrbit?(en?'Burn frame T · R · N (orthogonal)':'기동 축 T · R · N (직각)'):(en?'Circular · velocity / radial / normal':'원궤도 · 속도 / 반경 / 법선 방향')}</p>`;
}
function designChanged(rebuild = true) {
  preview = null;
  swingbyEvaluation = null;
  swingbyIssues = [];
  pending = true;
  revision++;
  if (rebuild) scene.setDesign(design);
  syncSwingbyCarrier();
  scene.setSelected(selected);
  requestPreview();
  scheduleSave();
  render();
}
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(async () => {
    saveTimer = 0;
    try {
      if(solarAssembly){
        localStorage.setItem(solarAssemblySlot,serializeSave(makeSave(design)));
        const status=$("#save-status");if(status)status.textContent=getLanguage()==="ko"?"저장됨":"Saved";
        return;
      }
      if (swingbyAssembly && swingbyModel && swingbyDraft) {
        const model = swingbyModel,
          craft = structuredClone(design), plan = structuredClone(swingbyDraft);
        await persistSwingbyAssembly(model, plan, craft);
        return;
      }
      if (transferAssembly) {
        const craft = structuredClone(design),
          plan = transferDraft ? structuredClone(transferDraft) : undefined;
        const model = await import("./transfer");
        await model.saveTransferLocal(
          model.makeTransferSave(
            plan ??
              (craft.hardwareVersion
                ? model.createHardwareTransferPlan()
                : model.createTransferPlan()),
            craft,
          ),
        );
        return;
      }
      const hardware = !!design.hardwareVersion;
      await saveLocal(makeSave(design, sim ?? undefined, previousResult));
      if (hardware) savedHardwareAvailable = true;
      else savedAvailable = true;
      const l = $("#save-status");
      if (l) l.textContent = "저장됨";
    } catch {
      toast(
        "브라우저 저장에 실패했습니다. JSON 백업으로 현재 설계를 보관할 수 있습니다.",
        true,
      );
    }
  }, 600);
}
function requestPreview() {
  clearTimeout(previewTimer);
  previewTimer = window.setTimeout(() => {
    if (swingbyAssembly) {
      requestSwingbyAssemblyEvaluation();
      return;
    }
    worker.postMessage({ revision, design: structuredClone(design) });
    clearTimeout(previewTimeout);
    previewTimeout = window.setTimeout(() => {
      if (pending) {
        pending = false;
        toast(
          "예측 계산이 지연되었습니다. 계획을 다시 조정하거나 새로 계산해 주세요.",
          true,
        );
        render();
      }
    }, 20000);
  }, 80);
}
function setMode(next: ViewMode) {
  $("#toast-root").innerHTML = "";
  if (next === "build" && sim) {
    toast("실행 후 부품 변경은 결과의 재설계를 사용하세요.");
    return;
  }
  if (next === "plan" && sim) {
    toast(
      "실행 중에는 탑재된 일정만 확인합니다. 재설계에서 경로를 수정할 수 있습니다.",
    );
    return;
  }
  mode = next;
  scene.setMode(mode, !reducedMotion);
  render();
  if (next === "plan") {
    previewTime = design.missionId === "mars" ? 9000 : 2100;
    updatePreviewTelemetry();
  }
}
function startMission(
  id: MissionId,
  preset: "starter" | "balanced" | "science" = "starter",
  hardware = false,
) {
  clearSwingbyAssembly();
  solarAssembly=false;
  activeDebrief = null;
  reviewContext = null;
  transferAssembly = false;
  transferDraft = undefined;
  targetProfile = null;
  scene.targetPicking = false;
  scene.stowOpen = false;
  design = hardware
    ? createHardwareDesign(id, preset)
    : createDesign(id, preset);
  scienceSeen = null;
  scienceAnnouncement = null;
  resetFlightForecast();
  sim = null;
  preview = null;
  playing = false;
  previousResult = undefined;
  history = [];
  future = [];
  selected = null;
  revision++;
  pending = true;
  mode = "build";
  scene.setDesign(design);
  scene.setSelected(selected);
  scene.setMode(mode, !reducedMotion);
  requestPreview();
  closeModal();
  render();
  scheduleSave();
  toast(
    "부품 선반에서 장비를 잡아 기체 표면으로 끌어보세요. 오른쪽 드래그로 뒷면을 볼 수 있습니다.",
  );
}

function header() {
  const en=getLanguage()==="en";
  return `<header class="topbar"><button class="brand" data-action="home" aria-label="${en?"Launch complex":"발사 기지"}"><span class="brandmark"></span><span><strong>ORBITAL</strong><small>MISSION FOUNDRY</small></span></button>${mode==="campus"?`<div class="pill">SOLAR EXPLORATION PROGRAM</div>`:solarAssembly?`<div class="solar-assembly-heading">${en?"Your spacecraft · Solar expedition":"나의 탐사선 · 태양계 탐사"}</div>`:`<nav class="tabs" aria-label="${en?"Mission stages":"임무 단계"}"><button class="tab ${mode==="build"?"active":""}" data-action="build"><span>01</span> ${en?"Assembly":"우주선 조립"}</button><i class="tab-divider"></i><button class="tab ${mode==="plan"?"active":""}" data-action="plan"><span>02</span> ${en?"Flight path":"비행 설계"}</button><i class="tab-divider"></i><button class="tab ${mode==="flight"?"active":""}" data-action="flight"><span>03</span> ${en?"Flight":"임무 운영"}</button></nav>`}<div class="top-actions"><span class="save-state" id="save-status">${navigator.onLine?(en?"Local save":"자동 저장"):(en?"Offline ready":"오프라인")}</span><details class="header-menu" data-preserve-details="menu"><summary>${en?"Menu":"메뉴"} ${icon("chevron")}</summary><div>${button("save",en?"Save design":"설계 저장","save","secondary")}${button("help",en?"Controls":"조작 안내","help","secondary")}${button("settings",en?"Settings":"설정","settings","secondary")}<button class="secondary" data-action="language">${en?"한국어":"English"}</button></div></details></div></header>`;
}
async function openSolarCampaign(){
  if(solarExperience||solarOpening||deploymentExperience||deploymentOpening||archiveReview||archiveReviewOpening||transferOpening||transferExperience||swingbyOpening||swingbyExperience)return;
  solarOpening=true;playing=false;closeModal();
  try{
    let draft:Design|undefined=solarAssembly?structuredClone(design):undefined;
    if(solarAssembly)localStorage.setItem(solarAssemblySlot,serializeSave(makeSave(design)));
    else if(saveTimer)await action("save");
    if(!draft){
      try{const pendingDraft=localStorage.getItem(solarAssemblySlot);if(pendingDraft)draft=parseSave(pendingDraft).design;}
      catch{ /* An unavailable or corrupt draft must not block exploration. Keep its bytes for recovery. */ }
    }
    clearTimeout(saveTimer);saveTimer=0;clearTimeout(previewTimer);clearTimeout(previewTimeout);
    const {SolarExperience}=await import("./solar-experience");
    const leave=()=>{solarExperience?.dispose();solarExperience=null;ui.style.display="";scene.canvas.style.visibility="";};
    ui.style.display="none";scene.canvas.style.visibility="hidden";
    solarExperience=new SolarExperience(app,{language:getLanguage(),design:draft,
      onClose:()=>{leave();solarAssembly=false;pending=false;mode="campus";scene.setMode("campus",!reducedMotion);render();},
      onBuild:(craft:Design)=>{
        solarAssemblyBrief=solarExperience?.assemblyBrief()??null;
        leave();startMission("mars","balanced");solarAssembly=true;design=structuredClone(craft);selected=null;
        scene.setDesign(design);scene.setSelected(null);scene.setInspection(null);requestPreview();scheduleSave();render();
        toast(getLanguage()==="ko"?"장비를 기체에 끌어 놓으면 바로 설계에 반영됩니다.":"Drag equipment onto your spacecraft to change its design.");
      }});
    solarExperience.start();
    if(draft&&solarExperience.isSaved())try{localStorage.removeItem(solarAssemblySlot);}catch{ /* Preserve the draft if campaign storage is unavailable. */ }
    $("#toast-root").innerHTML="";
  }catch(error){solarExperience?.dispose();solarExperience=null;ui.style.display="";scene.canvas.style.visibility="";toast(error instanceof Error?error.message:String(error),true);if(mode==="build")requestPreview();}
  finally{solarOpening=false;}
}
async function openTransfer(initialSave?: string, lesson?: OperationsLesson) {
  if (solarExperience || solarOpening || deploymentExperience || deploymentOpening || archiveReview || archiveReviewOpening || transferOpening || transferExperience || swingbyOpening || swingbyExperience) return;
  transferOpening = true;
  playing = false;
  closeModal();
  clearTimeout(saveTimer);
  toast(
    getLanguage() === "ko"
      ? "행성 간 항법실을 준비하고 있습니다."
      : "Preparing interplanetary navigation.",
  );
  try {
    const { TransferExperience } = await import("./transfer-ui");
    clearSwingbyAssembly();
    ui.style.display = "none";
    scene.canvas.style.visibility = "hidden";
    transferExperience = new TransferExperience(
      lesson?.craft ??
        (initialSave ? createDesign("mars", "balanced") : design),
      lesson?.plan ?? transferDraft,
      {
        exit: () => {
          transferExperience = null;
          transferAssembly = false;
          ui.style.display = "";
          scene.canvas.style.visibility = "";
          mode = "campus";
          scene.setMode("campus", !reducedMotion);
          render();
        },
        edit: (craft, plan) => {
          activeDebrief = null;
          reviewContext = null;
          previousResult = undefined;
          transferExperience = null;
          transferAssembly = true;
          transferDraft = plan;
          design = craft;
          sim = null;
          history = [];
          future = [];
          selected = null;
          mode = "build";
          ui.style.display = "";
          scene.canvas.style.visibility = "";
          scene.setDesign(design);
          scene.setSelected(selected);
          scene.setMode("build", !reducedMotion);
          designChanged();
        },
      },
      initialSave,
      lesson
        ? {
            engine: { modelVersion: "transfer-3.0.0", scenarioId: lesson.id },
            lesson,
          }
        : {},
    );
    transferExperience.scene.setQuality(scene.quality);
    transferExperience.scene.setReducedMotion(reducedMotion);
    activeDebrief = null;
    reviewContext = null;
    previousResult = undefined;
    $("#toast-root").innerHTML = "";
  } catch (error) {
    ui.style.display = "";
    scene.canvas.style.visibility = "";
    toast(
      error instanceof Error ? error.message : "항법실을 열지 못했습니다.",
      true,
    );
  } finally {
    transferOpening = false;
  }
}
function clearSwingbyAssembly() {
  swingbyAssembly = false;
  swingbyDraft = undefined;
  swingbyNumerics={cruiseStepSeconds:300,activeStepSeconds:1};
  swingbyEvaluation = null;
  swingbyIssues = [];
  swingbyRequestId++;
  swingbyAssemblyWorker?.terminate();
  swingbyAssemblyWorker = null;
  scene?.setSwingbyCarrier(null, null);
}
function persistSwingbyAssembly(model: typeof import("./swingby"), plan: SwingbyPlan, craft: Design) {
  const save = model.makeSwingbySave(plan, craft,undefined,swingbyNumerics);
  swingbyAssemblySave = swingbyAssemblySave.catch(() => {}).then(() => model.saveSwingbyLocal(save));
  return swingbyAssemblySave;
}
function syncSwingbyCarrier() {
  if (!swingbyAssembly || !swingbyModel) return;
  const geometry = swingbyModel.swingbyThrustGeometry(
    design, swingbyModel.getSwingbyScenario().initialFuelKg,
  );
  scene.setSwingbyCarrier(swingbyModel.SWINGBY_PROPULSION,
    geometry.enginePartId, geometry.thrustDirectionBody);
}
function requestSwingbyAssemblyEvaluation() {
  if (!swingbyAssembly || !swingbyModel || !swingbyDraft) return;
  clearTimeout(previewTimeout);
  swingbyAssemblyWorker ??= new Worker(new URL("./swingby.worker.ts", import.meta.url), { type: "module" });
  const requestId = ++swingbyRequestId, requestedRevision = revision;
  const accept = () => swingbyAssembly && requestId === swingbyRequestId && revision === requestedRevision;
  swingbyAssemblyWorker.onmessage = ({data: message}) => {
    if (!accept() || message.requestId !== requestId || message.controlEpoch !== 0) return;
    if (message.type !== "solved" && message.type !== "error") return;
    if (message.type === "solved" && message.revision !== requestedRevision) return;
    clearTimeout(previewTimeout);
    pending = false;
    acceptedRevision = message.type === "solved" ? requestedRevision : -1;
    swingbyEvaluation = message.status === "solved" ? message.evaluation : null;
    swingbyIssues = swingbyEvaluation?.issues ?? message.issues ?? [{code:"EVALUATION_FAILED",severity:"error",message:message.error ?? "Evaluation unavailable"}];
    syncSwingbyCarrier();
    render();
  };
  swingbyAssemblyWorker.onerror = () => {
    if (!accept()) return;
    clearTimeout(previewTimeout);
    pending = false;
    acceptedRevision = -1;
    swingbyIssues = [{code:"EVALUATION_FAILED",severity:"error",message:"Evaluation unavailable"}];
    swingbyAssemblyWorker?.terminate();
    swingbyAssemblyWorker = null;
    render();
  };
  swingbyAssemblyWorker.postMessage({type:"solve",requestId,controlEpoch:0,revision:requestedRevision,
    craft:structuredClone(design),plan:structuredClone(swingbyDraft),numerics:structuredClone(swingbyNumerics)});
  previewTimeout = window.setTimeout(() => {
    if (!accept() || !pending) return;
    pending = false;
    acceptedRevision = -1;
    swingbyIssues = [{code:"EVALUATION_FAILED",severity:"error",message:"Evaluation unavailable"}];
    swingbyAssemblyWorker?.terminate();
    swingbyAssemblyWorker = null;
    render();
  }, 20000);
}
async function openSwingby(initialSave?: string, fresh = false) {
  if (solarExperience || solarOpening || deploymentExperience || deploymentOpening || archiveReview || archiveReviewOpening || swingbyOpening || swingbyExperience || transferOpening || transferExperience) return;
  swingbyOpening = true;
  playing = false;
  closeModal();
  clearTimeout(saveTimer);
  clearTimeout(previewTimer);
  clearTimeout(previewTimeout);
  try {
    const [model, {SwingbyExperience}] = await Promise.all([import("./swingby"), import("./swingby-ui")]);
    swingbyModel = model;
    const craft = !fresh && swingbyAssembly ? structuredClone(design) : model.createSwingbyDesign();
    const plan = !fresh && swingbyDraft ? structuredClone(swingbyDraft) : model.createSwingbyPlan("starter");
    const numerics:SwingbyNumerics=!fresh?structuredClone(swingbyNumerics):{cruiseStepSeconds:300,activeStepSeconds:1};
    // Complete older assembly writes before another UI can write this slot.
    // A handoff also persists a just-edited draft whose debounce has not fired.
    if (!fresh && !initialSave && swingbyAssembly)
      await persistSwingbyAssembly(model, plan, craft).catch(() => {});
    else await swingbyAssemblySave.catch(() => {});
    swingbyAssemblyWorker?.terminate();
    swingbyAssemblyWorker = null;
    swingbyRequestId++;
    ui.style.display = "none";
    scene.canvas.style.visibility = "hidden";
    const leave = () => {
      swingbyExperience?.dispose();
      swingbyExperience = null;
      ui.style.display = "";
      scene.canvas.style.visibility = "";
    };
    swingbyExperience = new SwingbyExperience(app, {
      exit: () => {
        leave();
        clearSwingbyAssembly();
        transferAssembly = false;
        transferDraft = undefined;
        pending = false;
        mode = "campus";
        scene.setMode("campus", !reducedMotion);
        render();
      },
      edit: (craft, plan, nextNumerics) => {
        leave();
        activeDebrief = null;
        reviewContext = null;
        previousResult = undefined;
        transferAssembly = false;
        transferDraft = undefined;
        swingbyAssembly = true;
        swingbyDraft = structuredClone(plan);
        swingbyNumerics=structuredClone(nextNumerics??numerics);
        design = structuredClone(craft);
        sim = null;
        preview = null;
        selected = null;
        history = [];
        future = [];
        resetFlightForecast();
        mode = "build";
        scene.setMode("build", !reducedMotion);
        designChanged();
      },
    }, craft, plan, initialSave, {quality:scene.quality,reducedMotion,numerics});
    transferAssembly = false;
    transferDraft = undefined;
    sim = null;
    preview = null;
    activeDebrief = null;
    reviewContext = null;
    previousResult = undefined;
    resetFlightForecast();
    $("#toast-root").innerHTML = "";
  } catch (error) {
    ui.style.display = "";
    scene.canvas.style.visibility = "";
    toast(error instanceof Error ? error.message : String(error), true);
    if (swingbyAssembly) requestPreview();
  } finally {
    swingbyOpening = false;
  }
}
async function openReviewArchive(){
  if(solarExperience||solarOpening||deploymentExperience||deploymentOpening||archiveReview||archiveReviewOpening||swingbyExperience||swingbyOpening||transferExperience||transferOpening)return;
  archiveReviewOpening=true;playing=false;closeModal();clearTimeout(saveTimer);clearTimeout(previewTimer);clearTimeout(previewTimeout);
  try{
    const [model,{ReviewExperience}]=await Promise.all([import('./swingby'),import('./review-ui')]);swingbyModel=model;
    ui.style.display='none';scene.canvas.style.visibility='hidden';
    const leave=()=>{archiveReview?.dispose();archiveReview=null;ui.style.display='';scene.canvas.style.visibility='';};
    archiveReview=new ReviewExperience(app,{quality:scene.quality,reducedMotion,
      close:()=>{leave();clearSwingbyAssembly();mode='campus';scene.setMode('campus',!reducedMotion);render();},
      fork:draft=>{leave();activeDebrief=null;reviewContext=null;previousResult=undefined;transferAssembly=false;transferDraft=undefined;swingbyAssembly=true;swingbyDraft=structuredClone(draft.plan);swingbyNumerics=structuredClone(draft.numerics);design=structuredClone(draft.craft);sim=null;preview=null;selected=null;history=[];future=[];resetFlightForecast();mode='build';scene.setMode('build',!reducedMotion);designChanged();},
    });
  }catch(error){ui.style.display='';scene.canvas.style.visibility='';toast(error instanceof Error?error.message:String(error),true);}
  finally{archiveReviewOpening=false;}
}
async function openDeployment(resume=false){
  if(solarExperience||solarOpening||deploymentExperience||deploymentOpening||archiveReview||archiveReviewOpening||swingbyExperience||swingbyOpening||transferExperience||transferOpening)return;
  const preserveWorkspace=mode!=="campus"||saveTimer!==0;
  deploymentOpening=true;playing=false;closeModal();clearTimeout(saveTimer);saveTimer=0;
  clearTimeout(previewTimer);clearTimeout(previewTimeout);
  try{
    // Persist the exact current workspace before handing ownership to another
    // experience. A rejected write leaves that workspace visible and editable.
    if(preserveWorkspace){
      if(swingbyAssembly&&swingbyModel&&swingbyDraft){await persistSwingbyAssembly(swingbyModel,structuredClone(swingbyDraft),structuredClone(design));}
      else if(transferAssembly){const craft=structuredClone(design),plan=transferDraft?structuredClone(transferDraft):undefined,model=await import('./transfer');await model.saveTransferLocal(model.makeTransferSave(plan??(craft.hardwareVersion?model.createHardwareTransferPlan():model.createTransferPlan()),craft));}
      else {await saveLocal(makeSave(design,sim??undefined,previousResult));if(design.hardwareVersion)savedHardwareAvailable=true;else savedAvailable=true;}
    }
    const {DeploymentExperience}=await import('./deployment-ui');
    ui.style.display='none';scene.canvas.style.visibility='hidden';
    deploymentExperience=new DeploymentExperience(app,{resume,quality:scene.quality,reducedMotion,close:()=>{
      deploymentExperience?.dispose();deploymentExperience=null;ui.style.display='';scene.canvas.style.visibility='';
      clearSwingbyAssembly();transferAssembly=false;transferDraft=undefined;pending=false;playing=false;mode='campus';scene.setMode('campus',!reducedMotion);render();
    }});
    pending=false;resetFlightForecast();$('#toast-root').innerHTML='';
  }catch(error){ui.style.display='';scene.canvas.style.visibility='';toast(error instanceof Error?error.message:String(error),true);if(mode!=='campus')requestPreview();}
  finally{deploymentOpening=false;}
}
function deploymentMissionCard(){
  return `<button class="mission-card transfer-mission-card" data-action="mission-deployment"><div class="mission-planet earth"></div><div class="mission-card-body"><div class="eyebrow">01B / FIRST LIGHT</div><h3>${getLanguage()==="ko"?"접힌 우주선에 첫 빛을":"First light, first contact"}</h3><p>${getLanguage()==="ko"?"부품을 직접 옮겨 태양판이 펼쳐질 공간을 만드세요. 실제 모터·전력·자세를 고려해 궤도에서 기체를 가동하고 확인 보고서를 지구로 보내세요.":"Make room for the unfolding solar wing by moving its hardware. Commission the craft in orbit using actual motor, power and attitude constraints, then return its report to Earth."}</p><div class="mission-tags"><span>${getLanguage()==="ko"?"3D 경첩 · 직접 배치":"3D HINGES · DIRECT PLACEMENT"}</span><span>90 W / 16 Mbit</span></div></div></button>`;
}
function home() {
  const en=getLanguage()==="en";
  return `<section class="home experience-home"><div class="eyebrow">ORBITAL FOUNDRY / EXPLORATION PROGRAM</div><h1>${en?"A SOLAR SYSTEM.<br><i>YOUR NEXT DISCOVERY.</i>":"우리의 태양계.<br><i>다음 발견은 당신의 손에.</i>"}</h1><p>${en?"Build a probe. Shape its journey. Find out what waits beyond Earth.":"탐사선을 만들고, 항로를 그리세요.<br>지구 너머에서 기다리는 발견을 향해."}</p><div class="home-actions"><button class="primary" data-action="solar-campaign" ${assetsReady?"":"disabled"}>${en?"Begin exploration":"탐사 시작"} ${icon("arrow")}</button></div><details class="home-laboratory"><summary>${en?"Mission laboratory & saved designs":"임무 실험실 · 이전 설계"}</summary><div class="home-laboratory-links"><button class="secondary" data-action="missions">${en?"Choose a laboratory mission":"실험실 임무 선택"}</button>${savedAvailable?`<button class="secondary" data-action="load">${en?"Continue saved design":"저장한 설계 이어하기"}</button>`:""}${savedHardwareAvailable?`<button class="secondary" data-action="load-hardware">${en?"Continue systems design":"시스템 설계 이어하기"}</button>`:""}<button class="text-btn" data-action="load-transfer">${en?"Earth→Mars mission":"지구→화성 임무 이어하기"}</button><button class="text-btn" data-action="load-transfer-hardware">${en?"Mars systems design":"화성 시스템 설계 이어하기"}</button>${operationsHomeLink()}${swingbyHomeLink()}<button class="text-btn" data-action="load-deployment">${en?"First-light commissioning":"첫 빛 · 기체 전개 이어하기"}</button><button class="text-btn" data-action="review-archive">${en?"Flight review archive":"비행 분석 보관함"}</button></div></details></section><div class="home-bottom"><div>DESIGN. EXPLORE. DISCOVER.</div><div class="home-coordinates">ORBITAL FOUNDRY / LAUNCH COMPLEX 01</div></div>`;
}

function stowReadout() {
  const ev = evaluateLaunchPackage(design);
  return `<div class="inspection-readout"><strong>${getLanguage() === "ko" ? ev.package.name : { rideshare: "Rideshare injection", precision: "Dedicated injection", heavy: "Heavy spacecraft" }[ev.package.id]}</strong><small>${getLanguage() === "ko" ? "수납 직경 / 높이" : "Stowed diameter / height"} ${fmt(ev.envelope.diameterM, 2)} / ${fmt(ev.envelope.heightM, 2)} m · ${getLanguage() === "ko" ? "반경 여유" : "Radial clearance"} ${fmt(ev.radialMarginM, 2)} m</small><small>${getLanguage() === "ko" ? "게임용 수납 외형 검사 · 실제 전개 기구의 인증 해석이 아닙니다." : "Authored compact envelope · Not certified deployment mechanics."}</small><button class="text-btn" data-action="launch-packages">${getLanguage() === "ko" ? "발사 패키지 선택" : "Choose launch package"}</button></div>`;
}
function launchPackagesModal() {
  const current = getLaunchPackage(design);
  modal(
    getLanguage() === "ko" ? "발사 패키지" : "Launch package",
    "INJECTION & FAIRING",
    `<div class="launch-package-options">${Object.values(LAUNCH_PACKAGES)
      .map(
        (p) =>
          `<button class="launch-package ${current.id === p.id ? "active" : ""}" data-package="${p.id}"><span class="eyebrow">${p.id.toUpperCase()}</span><h3>${getLanguage() === "ko" ? p.name : { rideshare: "Rideshare injection", precision: "Dedicated injection", heavy: "Heavy spacecraft" }[p.id]}</h3><strong>${p.cost} C</strong><p>${p.maxWetMassKg} kg · Ø${p.fairingDiameterM} × ${p.fairingHeightM} m</p><p>${p.altitudeRangeKm.join("–")} km · ${p.inclinationRangeDeg.join("–")}°</p></button>`,
      )
      .join(
        "",
      )}</div><p class="small-note">${getLanguage() === "ko" ? "가격과 패키지는 게임 설정입니다. 선택에 따라 예산·질량·수납 공간·초기 궤도 범위가 바뀝니다. 실제 발사 사업자의 견적이 아닙니다." : "Packages and prices are game settings. Selection changes budget, mass, fairing and initial orbit limits; these are not provider quotes."}</p>`,
  );
}
function nextAssemblyStep() {
  return [
    {
      kind: design.missionId === "earth" ? "camera" : "spectrometer",
      face: "nz",
      label:
        getLanguage() === "ko"
          ? "관측기를 뒤쪽 −Z 면에 놓으세요"
          : "Mount the sensor on the rear −Z face",
    },
    {
      kind: "solar",
      face: "px",
      label:
        getLanguage() === "ko"
          ? "태양전지를 오른쪽 +X 면에 놓으세요"
          : "Mount a solar wing on the right +X face",
    },
    {
      kind: "antenna",
      face: "pz",
      label:
        getLanguage() === "ko"
          ? "안테나를 앞쪽 +Z 면에 놓으세요"
          : "Mount the antenna on the front +Z face",
    },
    ...(design.hardwareVersion
      ? [
          {
            kind: "battery",
            face: "py",
            label:
              getLanguage() === "ko"
                ? "내부 베이에 배터리를 넣으세요"
                : "Install a battery inside the service bay",
          },
          {
            kind: "radio",
            face: "py",
            label:
              getLanguage() === "ko"
                ? "안테나와 같은 대역의 무선기를 내부에 넣으세요"
                : "Install a radio matching your antenna band",
          },
          {
            kind: "adcs",
            face: "py",
            label:
              getLanguage() === "ko"
                ? "자세제어 장치를 내부 베이에 넣으세요"
                : "Install an attitude-control unit in the bay",
          },
        ]
      : []),
  ].find(
    (s) =>
      !design.parts.some(
        (p) =>
          (s.kind === "solar"
            ? p.kind === "solar" || p.kind === "solarLarge"
            : p.kind === s.kind) && p.face === s.face,
      ),
  );
}
function assemblyGuide() {
  if(solarAssembly)return "";
  const step = nextAssemblyStep();
  return step
    ? `<div class="assembly-guide"><span class="live-dot"></span><div><small>${getLanguage() === "ko" ? "첫 설계 길잡이 · 권장 배치" : "FIRST DESIGN · SUGGESTED PLACEMENT"}</small><strong>${step.label}</strong></div><button class="secondary" data-action="guide-face">${getLanguage() === "ko" ? "그 면 보기" : "View face"} ${icon("rotate")}</button></div>`
    : "";
}
function viewTools() {
  return `<div class="viewport-tools compact-view-tools">${mode==="flight"?`<button class="secondary" data-action="control-room">${icon("grid")} ${getLanguage()==="ko"?(scene.controlRoomActive?"우주 보기":"관제실"):scene.controlRoomActive?"Space view":"Control room"}</button>`:""}<button class="secondary" data-action="camera-reset">${icon("orbit")} ${getLanguage()==="ko"?"전체 보기":"Frame all"}</button></div>`;
}
function assemblyInspectionHTML(part?:Part) {
  const en=getLanguage()==="en",kind=part?.kind;
  const inspection=kind==="solar"||kind==="solarLarge"?{action:"inspect-power",icon:"sun",label:en?"Show sunlight":"햇빛 확인"}:kind==="camera"||kind==="spectrometer"?{action:"inspect-camera",icon:"eye",label:en?"Show field of view":"관측 방향 보기"}:kind==="antenna"||kind==="radio"?{action:"inspect-antenna",icon:"antenna",label:en?"Show radio direction":"교신 방향 보기"}:null;
  return `${inspection?`<button class="secondary context-inspection" data-action="${inspection.action}">${icon(inspection.icon)} ${inspection.label}</button>`:""}${scene.inspectionKind?`<div class="context-inspection-result"><div id="inspection-readout">${scene.inspectionSummary?`<strong>${fmt(scene.inspectionSummary.value,1)} ${scene.inspectionSummary.unit}</strong>`:""}</div><button class="text-btn" data-action="inspect-off">${en?"Close inspection":"검사 닫기"}</button></div>`:""}`;
}
function assemblyUtilitiesHTML() {
  const en=getLanguage()==="en";
  return `<details class="assembly-utilities" data-preserve-details="tools"><summary>${en?"Assembly tools":"조립 도구"}</summary><div class="context-tool-list"><button class="secondary" data-action="bay" aria-pressed="${scene.bayOpen}">${icon("grid")} ${en?(scene.bayOpen?"Close service bay":"Open service bay"):(scene.bayOpen?"내부 베이 닫기":"내부 베이 열기")}</button>${design.missionId==="earth"?`<button class="secondary" data-action="stow" aria-pressed="${scene.stowOpen}">${icon("rocket")} ${en?"Check launch envelope":"발사 수납 확인"}</button>`:""}<button class="secondary" data-action="view-front">${en?"Front":"정면"}</button><button class="secondary" data-action="view-top">${en?"Top":"윗면"}</button><button class="secondary" data-action="view-side">${en?"Side":"옆면"}</button><button class="secondary" data-action="camera-focus">${en?"Inspect spacecraft":"탐사선 가까이"}</button></div>${scene.stowOpen?stowReadout():""}</details>`;
}

function warnings() {
  if(solarAssembly){
    const ev=evaluateDesign(design),messages=ev.warnings.filter(w=>w.code==='PLACEMENT').map(w=>w.message);
    if(solarAssemblyBrief&&!design.parts.some(p=>p.kind===solarAssemblyBrief!.sensor))messages.unshift(solarAssemblyBrief.reason);
    if(!design.parts.some(p=>p.kind==='antenna'))messages.push(getLanguage()==='ko'?'지구로 자료를 보낼 안테나를 붙여 주세요.':'Mount an antenna to return your observations.');
    return messages.map(message=>`<div class="warning">${esc(message)}</div>`).join('')||`<div class="status-label">${getLanguage()==='ko'?'배치 확인 · 항로에서 출발 조건을 확인하세요.':'Placement checked · review departure conditions on the map.'}</div>`;
  }
  if (swingbyAssembly) {
    if (pending)
      return `<div class="status-label" data-swingby-evaluation="pending">${getLanguage() === "ko" ? "현재 기체의 적재 질량과 기동 조건을 계산합니다." : "Calculating this craft’s loaded mass and maneuver conditions."}</div>`;
    return swingbyIssues.slice(0, 4).map(issue => `<div class="warning ${issue.severity}" data-swingby-issue="${esc(issue.code)}">${esc(swingbyIssueLabel(issue))}</div>`).join("") ||
      `<div class="status-label" data-swingby-evaluation="ready">${getLanguage() === "ko" ? "기체 조건 충족 · 경로와 실제 기동은 비행 설계에서 검토하세요." : "Craft checks passed · Review the trajectory and actual burn in flight planning."}</div>`;
  }
  const ev = evaluateDesign(design);
  const list = transferAssembly
    ? ev.warnings.filter((w) => !["BUDGET", "MASS"].includes(w.code))
    : [...ev.warnings];
  if (transferAssembly) {
    const m = missionFor();
    if (ev.cost > m.budget)
      list.push({
        code: "BUDGET",
        severity: "error",
        message: `기체 예산 ${ev.cost - m.budget} 크레딧 초과`,
      });
    if (ev.massKg > m.massLimitKg)
      list.push({
        code: "MASS",
        severity: "error",
        message: `탈출 단계 탑재 질량 ${m.massLimitKg} kg 초과`,
      });
  }
  return (
    list
      .slice(0, 4)
      .map(
        (w) =>
          `<div class="warning ${w.severity}">${esc(design.hardwareVersion ? hardwareIssueLabel(w) : w.message)}</div>`,
      )
      .join("") ||
    `<div class="status-label">${icon("check")} 구조와 자원 제한을 충족합니다</div>`
  );
}
function swingbyIssueLabel(issue: SwingbyIssue) {
  const ko: Record<string, string> = {
    PROPULSION_UNAVAILABLE: "전원·데이터가 연결된 chemical230 엔진과 CG 조정 캐리어가 필요합니다.",
    GIMBAL_LIMIT: "현재 질량중심을 향한 추력 방향이 캐리어의 10° 짐벌 범위를 벗어납니다.",
    FUEL: "계획한 보정에 필요한 추진제가 적재량 0.25 kg을 초과합니다.",
    UNSAFE_PERIAPSIS: "예측 최근접 고도가 안전 경계 250 km보다 낮습니다.",
    DEADLINE: "접근 경로가 이 모델의 지원 시간을 초과합니다.",
    BUDGET: "기체와 캐리어 비용이 임무 예산 760 C를 초과합니다.",
    PREPARATION_POWER: "기동 준비 전력이 버스의 배전 한도를 초과합니다.",
    SCHEDULE_AFTER_PATCH: "일부 작업이 실제 국소 비행 모델의 종료 이후까지 이어집니다.",
    BURN_PRIORITY: "이 작업 중에는 기동 준비가 자세 제어보다 우선합니다.",
    EVALUATION_FAILED: "기체 계산을 완료하지 못했습니다. 부품을 수정하거나 비행 설계에서 다시 검토하세요.",
  };
  return getLanguage() === "ko" && ko[issue.code] ? ko[issue.code] : hardwareIssueLabel(issue);
}
function hardwarePartLabel(kind: string, modelId?: string) {
  const d =
    (modelId && HARDWARE_MODELS[modelId]) ||
    Object.values(PARTS).find((p) => p.kind === kind);
  return d ? (getLanguage() === "ko" ? d.name : d.nameEn) : kind;
}
function hardwareBusLabel(id: string) {
  const bus = BUSES[id];
  return bus
    ? getLanguage() === "ko"
      ? bus.name
      : bus.nameEn
    : getLanguage() === "ko"
      ? "기존 탐사선 버스"
      : "Original spacecraft bus";
}
function hardwareDescription(d: HardwareModel) {
  const ko = getLanguage() === "ko";
  if (d.geometry.render.variant === "legacy") return d.description;
  if (d.solar)
    return ko
      ? `${fmt(d.outputW ?? 0)} W · 독립 태양전지 입력 ${d.solar.mpptGroups}개. 날개의 입사각과 그림자에 따라 실제 발전이 달라집니다.`
      : `${fmt(d.outputW ?? 0)} W · ${d.solar.mpptGroups} solar inputs. Incidence and each wing's shadow change actual generation.`;
  if (d.radio)
    return ko
      ? `${d.radio.band} 대역 무선기. 같은 대역의 안테나와 전원·데이터 연결이 필요합니다.`
      : `${d.radio.band}-band radio. Requires a matching antenna and compatible power/data connections.`;
  if (d.antenna)
    return ko
      ? `${d.antenna.band} 대역 수동 안테나. 무선기와 함께 사용하며 방향과 가림이 교신에 영향을 줍니다.`
      : `Passive ${d.antenna.band}-band antenna. Works with a radio; pointing and obstruction affect the link.`;
  if (d.optics)
    return ko
      ? `관측 자료 1개 ${fmt(d.optics.bitsPerFrame / 1e6, 2)} Mbit · 시야각 ${fmt(d.optics.halfAngleDeg * 2)}°. 전송 시간과 저장 공간을 함께 확보하세요.`
      : `${fmt(d.optics.bitsPerFrame / 1e6, 2)} Mbit per observation · ${fmt(d.optics.halfAngleDeg * 2)}° field of view. Budget acquisition, storage and downlink time together.`;
  if (d.adcs)
    return ko
      ? `각 축 토크 ${fmt(d.adcs.torqueNm * 1000)} mN·m · 운동량 ${fmt(d.adcs.momentumNms * 1000)} mN·m·s. 기체의 질량 배치에 따라 회전 시간이 달라집니다.`
      : `${fmt(d.adcs.torqueNm * 1000)} mN·m torque · ${fmt(d.adcs.momentumNms * 1000)} mN·m·s momentum per axis. Spacecraft mass distribution affects slew time.`;
  if (d.capacityWh)
    return ko
      ? `사용 가능 ${fmt(d.capacityWh)} Wh. 팩과 버스의 충전·방전 출력 한도를 함께 적용합니다.`
      : `${fmt(d.capacityWh)} Wh usable. Both pack and bus charge/discharge limits apply.`;
  if (d.recorder)
    return ko
      ? `${fmt((d.capacityBits ?? 0) / 1e9, 1)} Gbit 기록 공간. 저장량이 늘어도 무선 전송 속도는 그대로입니다.`
      : `${fmt((d.capacityBits ?? 0) / 1e9, 1)} Gbit storage. Extra capacity does not increase radio throughput.`;
  return ko
    ? "기체 중앙의 추력선과 추진제 잔량을 확인하세요. 순간 기동을 사용하는 교육용 화학추진 모델입니다."
    : "Check the thrust line and remaining propellant. Educational chemical propulsion with ideal impulsive maneuvers.";
}
function hardwareIssueLabel(
  issue: Pick<HardwareIssue, "code" | "message" | "partId"> &
    Partial<HardwareIssue>,
) {
  if (getLanguage() === "ko") return issue.message;
  const phrases: Record<string, string> = {
    PART_LIMIT: "At most 20 components are supported.",
    POWER_PORT_LIMIT: "No power output can meet this component’s peak demand.",
    POWER_VOLTAGE: "No compatible operating-voltage rail is available.",
    DATA_PORT_CAPACITY: "There are not enough compatible data ports.",
    DATA_INTERFACE: "The required data interface or driver is unavailable.",
    SOLAR_INPUT_LIMIT:
      "The number of solar wings exceeds the independent MPPT inputs.",
    BATTERY_MISSING: "This bus needs an installed battery pack.",
    RADIO_SELECTION: "The selected radio is absent or disconnected.",
    NO_RADIO: "Install a radio with compatible power and data.",
    RF_BAND: "The radio needs an antenna in the same frequency band.",
    ADCS_MISSING: "Install an attitude-control unit with power and data.",
    ADCS_COUNT: "This bus uses one attitude-control unit.",
    INSTRUMENT_COUNT:
      "This spacecraft operates one science instrument. Choose a single camera or spectrometer.",
    POWER_TOTAL_LIMIT: "Simultaneous load exceeds a power-distribution limit.",
    HARDWARE_VERSION: "The hardware catalogue version is unsupported.",
  };
  const part = design.parts.find((p) => p.id === issue.partId),
    base = phrases[issue.code];
  if (!base) return t(issue.message);
  return `${part ? `${hardwarePartLabel(part.kind, part.modelId)}: ` : ""}${base}${issue.required !== undefined ? ` Required ${issue.required}${issue.available !== undefined ? ` / available ${issue.available}` : ""}.` : ""}`;
}
function hardwareBusModal() {
  if (!design.hardwareVersion || sim) return;
  modal(
    getLanguage() === "ko"
      ? "기체의 바탕을 선택하세요"
      : "Choose the spacecraft platform",
    "SPACECRAFT BUS",
    hardwareBusPickerHTML(
      Object.values(BUSES).map((bus) => ({
        id: bus.id,
        name: hardwareBusLabel(bus.id),
        description:
          getLanguage() === "ko"
            ? bus.description
            : bus.id.startsWith("surveyor")
              ? "Lower mass and idle power for compact UHF observation missions."
              : "More electrical and data capacity for high-power instruments and deep-space radio.",
        selected: bus.id === design.busId,
        facts: [
          {
            label:
              getLanguage() === "ko" ? "본체 질량 · 비용" : "Body mass · cost",
            value: `${bus.massKg} kg · ${bus.cost} C`,
          },
          {
            label: getLanguage() === "ko" ? "기본 소비전력" : "Base load",
            value: `${bus.basePowerW} W`,
          },
          {
            label:
              getLanguage() === "ko" ? "전력 분배 한도" : "Power distribution",
            value: `${bus.totalPowerW} W`,
          },
          {
            label: getLanguage() === "ko" ? "태양전지 입력" : "Solar inputs",
            value: `${bus.mpptGroups} MPPT · ${bus.solarLimitW} W`,
          },
          {
            label: getLanguage() === "ko" ? "데이터 포트" : "Data ports",
            value: `${bus.dataPorts.length} · ${[...new Set(bus.dataPorts.map((p) => p.interface))].join(" / ")}`,
          },
          {
            label: getLanguage() === "ko" ? "탑재 추진제" : "Propellant",
            value: `${bus.fuelKg} kg`,
          },
        ],
      })),
    ),
  );
}
function hardwareConnectionsModal() {
  if (!design.hardwareVersion) return;
  const h = resolveHardware(design);
  modal(
    getLanguage() === "ko"
      ? "장비 연결과 제한"
      : "Equipment connections and limits",
    "AUTOMATIC INTEGRATION",
    hardwareConnectionsHTML(
      h.parts.map((p) => ({
        partId: p.part.id,
        partName: hardwarePartLabel(p.part.kind, p.part.modelId),
        connected:
          p.powered &&
          p.dataConnected &&
          !h.issues.some((i) => i.partId === p.part.id),
        channels: h.connections
          .filter((c) => c.partId === p.part.id)
          .map((c) => ({
            label: c.type.toUpperCase(),
            value:
              c.type === "rf"
                ? hardwarePartLabel(
                    design.parts.find((p) => p.id === c.endpoint)?.kind ??
                      "antenna",
                    design.parts.find((p) => p.id === c.endpoint)?.modelId,
                  )
                : `${c.endpoint}${c.voltageV !== undefined ? ` · ${c.voltageV} V` : ""}${c.rateBps !== undefined ? ` · ${fmt(c.rateBps / 1e6, 2)} Mbit/s` : ""}`,
          })),
        issues: h.issues
          .filter((i) => i.partId === p.part.id)
          .map(hardwareIssueLabel),
      })),
      [
        {
          label: getLanguage() === "ko" ? "버스" : "Bus",
          value: hardwareBusLabel(h.bus.id),
        },
        {
          label:
            getLanguage() === "ko"
              ? "관측 / 송신 소비"
              : "Observe / downlink load",
          value: `${fmt(h.modeLoadW.observe, 1)} / ${fmt(h.modeLoadW.downlink, 1)} W`,
        },
        {
          label: getLanguage() === "ko" ? "연결 제한" : "Connection issues",
          value: String(h.issues.length),
        },
      ],
    ) +
      h.issues
        .filter((i) => !i.partId)
        .map(
          (i) =>
            `<div class="warning error">${esc(hardwareIssueLabel(i))}</div>`,
        )
        .join(""),
  );
}
function hardwareSourceModal(part: Part) {
  const d = getPartDefinition(design, part),
    ko = getLanguage() === "ko";
  const facts: Array<[string, string, string]> = [
    ["massKg", ko ? "질량" : "Mass", `${fmt(d.massKg, 4)} kg`],
    [
      "activePowerW",
      ko ? "작동 DC 전력" : "Active DC power",
      `${fmt(d.activePowerW, 3)} W`,
    ],
    [
      "idlePowerW",
      ko ? "대기 DC 전력" : "Idle DC power",
      `${fmt(d.idlePowerW, 3)} W`,
    ],
    ["cost", ko ? "게임 비용" : "Game cost", `${d.cost} C`],
  ];
  if (d.outputW)
    facts.push([
      "outputW",
      ko ? "1 AU 정면 발전" : "Normal incidence at 1 AU",
      `${d.outputW} W`,
    ]);
  if (d.capacityWh)
    facts.push([
      "capacityWh",
      ko ? "사용 가능 에너지" : "Usable energy",
      `${d.capacityWh} Wh`,
    ]);
  if (d.radio)
    facts.push([
      "radio.rfPowerW",
      ko ? "RF 출력" : "RF output",
      `${d.radio.rfPowerW} W`,
    ]);
  if (d.radio)
    facts.push([
      "radio.frequencyHz",
      ko ? "사용 주파수" : "Carrier frequency",
      `${d.radio.frequencyHz / 1e9} GHz`,
    ]);
  const evidenceLinks = componentEvidenceLinks(
    d.evidence.map((e) => e.sourceId),
  );
  modal(
    ko ? "사양과 설계 근거" : "Specifications and evidence",
    "HARDWARE SOURCES",
    hardwareEvidenceHTML({
      title: hardwarePartLabel(part.kind, part.modelId),
      subtitle: d.modelId,
      facts: facts.map(([field, label, value]) => ({
        label,
        value,
        basis: d.evidence.some((e) => e.fields.includes(field))
          ? d.provenance === "manufacturer-published"
            ? ko
              ? "제조사 공개값 · 아래 조건 참조"
              : "Published · see conditions"
            : ko
              ? "문헌 기반 계산·통합"
              : "Source-based calculation / assembly"
          : ko
            ? "게임 설계값"
            : "Authored game value",
      })),
      notes: [
        hardwareDescription(d),
        ...d.evidence.map((e) => e.condition),
        ...(d.conditions ?? []),
      ],
      sources: evidenceLinks.length
        ? evidenceLinks
        : [
            {
              title: ko ? "원문 및 기술 자료" : "Primary technical source",
              url: d.source,
            },
          ],
    }),
  );
}
function reviewContextHTML() {
  if (!reviewContext) return "";
  return `<div class="review-context"><strong>${getLanguage() === "ko" ? "이전 실행에서 살펴볼 지점" : "REVIEW POINT FROM THE PREVIOUS RUN"}</strong>${esc(reviewContext.label)}${reviewContext.time !== undefined ? ` · T+${time(reviewContext.time)}` : ""}<br><small>${getLanguage() === "ko" ? "현재 화면은 수정할 설계의 예측입니다. 변경한 뒤 다시 실행해 확인하세요." : "This is the editable design preview. Run the revised design to check its effect."}</small><button class="text-btn" data-action="review-clear">${getLanguage() === "ko" ? "안내 닫기" : "Dismiss review note"}</button></div>`;
}
async function followDebriefTarget(target: DebriefTarget, label: string) {
  if (sim) await action("retry");
  if (solarExperience || solarOpening || deploymentExperience || deploymentOpening || archiveReview || archiveReviewOpening || transferExperience || swingbyExperience || transferOpening || swingbyOpening) return;
  const resolution = resolveDebriefTarget(target, design),
    resolved = resolution.target;
  reviewContext = {
    label,
    ...("time" in resolved
      ? { time: resolved.time }
      : resolved.kind === "operation"
        ? { time: resolved.start }
        : {}),
  };
  closeModal();
  if (resolved.kind === "part" || resolved.kind === "part-kind") {
    mode = "build";
    scene.setMode("build", !reducedMotion);
    const matches =
      resolved.kind === "part"
        ? design.parts.filter((p) => p.id === resolved.partId)
        : design.parts.filter((p) => p.kind === resolved.partKind);
    const part = matches.length === 1 ? matches[0] : undefined;
    selected = part?.id ?? null;
    scene.setSelected(selected);
    category =
      resolved.kind === "part-kind" &&
      ["camera", "spectrometer"].includes(resolved.partKind)
        ? "science"
        : "systems";
    if (part) {
      scene.setBayOpen(Boolean(getPartDefinition(design, part).internal));
      scene.viewMount(part.face);
      if (["solar", "solarLarge", "battery"].includes(part.kind))
        scene.setInspection("power");
      else if (["camera", "spectrometer"].includes(part.kind))
        scene.setInspection("camera");
      else if (part.kind === "antenna") scene.setInspection("antenna");
    }
  } else {
    mode = "plan";
    scene.setMode("plan", !reducedMotion);
    previewTime = Math.max(
      0,
      Math.min(
        missionFor().duration,
        resolved.kind === "operation" ? resolved.start : resolved.time,
      ),
    );
    showResources = resolved.kind === "time" && resolved.panel === "resources";
    if (resolved.kind === "maneuver" && resolved.maneuverId)
      scene.selectedManeuverId = resolved.maneuverId;
    updatePreviewTelemetry();
  }
  render();
  if (resolution.status === "stale" || resolution.status === "ambiguous")
    toast(
      getLanguage() === "ko"
        ? "설계가 달라져 특정 장비 대신 관련 종류나 시각을 열었습니다."
        : "The design changed; the related category or time is shown instead of guessing a component.",
    );
}
function buildUI() {
  const ev=evaluateDesign(design),mission=missionFor(),en=getLanguage()==="en";
  const swingby=swingbyAssembly&&acceptedRevision===revision?swingbyEvaluation:null;
  const mass=swingbyAssembly?swingby?.loadedMassKg:ev.massKg,cost=swingbyAssembly?swingby?.totalCost:solarAssembly?ev.componentCost:ev.cost;
  const dv=swingbyAssembly?swingby?.availableDeltaVMps:ev.deltaVMps;
  const ready=[{icon:"camera",label:en?"Science":"관측",has:design.parts.some(p=>p.kind==="camera"||p.kind==="spectrometer")},{icon:"solar",label:en?"Power":"전력",has:design.parts.some(p=>p.kind==="solar"||p.kind==="solarLarge")},{icon:"antenna",label:en?"Radio":"교신",has:design.parts.some(p=>p.kind==="antenna")}];
  return `<div class="scene-title"><span>${solarAssembly?"SOLAR EXPLORATION / SPACECRAFT":"INTEGRATION BAY"}</span><strong data-i18n-skip>${esc(design.name)}</strong></div>
  <aside class="left-panel"><section class="panel panel-fill"><div class="panel-head"><div class="eyebrow">HARDWARE</div><h2>${en?"Equipment shelf":"장비 선반"}<span class="task-count">${design.parts.length}</span></h2><p id="keyboard-palette-help">${en?"Drag onto the spacecraft":"장비를 잡아 기체에 놓으세요"}</p>${design.hardwareVersion?hardwareBusStrip(hardwareBusLabel(getBusDefinition(design).id),resolveHardware(design).issues.length):""}</div><div class="category-tabs">${[["all",en?"All":"전체"],["science",en?"Science":"관측"],["systems",en?"Systems":"시스템"]].map(([v,l])=>`<button data-category="${v}" class="${category===v?"active":""}">${l}</button>`).join("")}</div><div class="part-list">${hardwareLibraryDefinitions().filter(p=>category==="all"||(category==="science"?["camera","spectrometer"].includes(p.kind):!["camera","spectrometer"].includes(p.kind))).map(p=>`<button class="part-card" aria-describedby="keyboard-palette-help" data-part="${p.kind}" ${design.hardwareVersion?`data-model="${p.modelId}"`:""} data-selected="${libraryPartSelected(p)}" aria-pressed="${libraryPartSelected(p)}" aria-label="${esc(en?"Drag to mount "+p.nameEn:p.name+" 드래그하여 장착")}">${(design.hardwareVersion&&hardwareThumbnailHTML(p.modelId))||`<span class="part-symbol">${icon(partIcon(p.kind))}</span>`}<span><strong>${esc(en?p.nameEn:p.name)}</strong><small>${fmt(p.massKg,p.massKg<.1?3:1)} kg · ${fmt(p.cost)} C</small></span><span class="drag-dots">⠿</span></button>`).join("")}</div>${installedPartsHTML(design,en)}</section></aside>
  <aside class="right-panel"><section class="panel assembly-purpose"><div class="panel-head"><div class="eyebrow">${en?"YOUR PROBE":"나의 탐사선"}</div><h2>${solarAssembly?esc(solarAssemblyBrief?.title??(en?"Ready for the next world":"다음 세계를 향한 준비")):esc(mission.title)}</h2>${solarAssemblyBrief&&solarAssembly?`<p class="solar-builder-objective">${esc(solarAssemblyBrief.reason)}</p>`:""}<div class="assembly-readiness">${ready.map(item=>`<span class="${item.has?"ready":"missing"}" title="${en?"Component installed":"해당 장비 장착 여부"}">${icon(item.icon)} ${item.label} ${item.has?"✓":"＋"}</span>`).join("")}</div></div><details class="assembly-mission-details" data-preserve-details="mission"><summary>${en?"Mission & constraints":"임무와 제약조건"}</summary><div class="panel-body">${solarAssembly?`<p>${en?"Choose your destination on the solar map. Mass, power and instruments affect the expedition.":"태양계 지도에서 목적지를 정합니다. 질량·전력·관측 장비가 탐사에 영향을 줍니다."}</p>`:`<p>${esc(mission.description)}</p><div class="kv"><span>${en?"Science return":"과학 목표"}</span><strong>${mission.targetPackets}</strong></div><div class="kv"><span>${en?"Mass limit":"질량 한도"}</span><strong>${mission.massLimitKg} kg</strong></div><button class="text-btn" data-action="briefing">${en?"Mission requirements":"임무 요구 보기"}</button>${design.missionId==="earth"?`<button class="text-btn" data-action="launch-packages">${en?"Launch package":"발사 패키지"} · ${ev.launchCost} C</button>`:""}`}</div></details></section><section class="panel panel-fill" id="inspector">${reviewContextHTML()}${inspector()}</section>${assemblyUtilitiesHTML()}</aside>
  ${viewTools()}<div class="control-hint"><span>${en?"Right-drag · orbit":"우클릭 드래그 · 회전"}</span><span>${en?"Wheel · zoom":"휠 · 확대"}</span></div>
  <section class="assembly-flightbar"><div class="assembly-summary"><span>${icon("mass")} <strong>${mass===undefined?"—":fmt(mass,1)}</strong> kg</span><span>${icon("cost")} <strong>${cost===undefined?"—":fmt(cost)}</strong> C</span><span>${icon("power")} <strong>${fmt(solarAssembly?ev.activePowerW:ev.solarPowerW)}</strong> W</span><details data-preserve-details="resources"><summary>${en?"All resources":"자원 상세"}</summary><div class="assembly-resource-popover"><div class="kv"><span>${en?"Battery capacity":"배터리 용량"}</span><strong>${fmt(ev.batteryWh)} Wh</strong></div><div class="kv"><span>${en?"Available Δv":"가용 Δv"}</span><strong>${dv===undefined?"—":fmt(dv,1)} m/s</strong></div><small>${solarAssembly?(en?"Installed equipment demand; expedition carrier supplies 300 W.":"장착 장비의 소비 전력 · 탐사 운반선이 300 W를 공급합니다."):(en?"Solar figure is rated maximum, before illumination and shadow.":"발전량은 햇빛 각도와 가림을 반영하기 전 최대치입니다.")}</small></div></details></div><button class="primary" data-action="${solarAssembly?"solar-campaign":"plan"}">${solarAssembly?(en?"Return to solar map":"태양계로 돌아가기"):(en?"Shape flight path":"비행 경로 설계")} ${icon("arrow")}</button></section>`;
}

function libraryPartSelected(model:HardwareModel):boolean {
  const part=design.parts.find(part=>part.id===selected);
  return !!part && (design.hardwareVersion?part.modelId===model.modelId:part.kind===model.kind);
}
function hardwareLibraryDefinitions(): HardwareModel[] {
  return design.hardwareVersion
    ? Object.values(HARDWARE_MODELS)
    : Object.values(PARTS).map((p) =>
        getPartDefinition(design, {
          id: `library-${p.kind}`,
          kind: p.kind,
          face: "px",
          u: 0,
          v: 0,
          rotation: 0,
        }),
      );
}
function stat(
  ico: string,
  label: string,
  value: string,
  unit: string,
  fraction: number,
) {
  return `<div class="stat"><div class="stat-label">${icon(ico)} ${label}</div><div class="stat-value">${value}<small>${unit}</small></div><div class="bar ${fraction > 1 ? "red" : ""}"><i style="width:${Math.min(1, fraction) * 100}%"></i></div></div>`;
}
function inspector() {
  if(keyboardPlacement)return keyboardPlacementHTML(keyboardPlacement,design,getLanguage()==="en");
  const en=getLanguage()==="en",p=design.parts.find(p=>p.id===selected);
  if(!p)return `<div class="empty-select">${icon("mouse")}<p>${en?"Pick a part on your spacecraft":"기체의 부품을 선택해 보세요"}</p></div><details class="assembly-checks" data-preserve-details="checks"><summary>${en?"Craft checks & examples":"기체 점검 · 예시 설계"}</summary><div class="panel-body">${warnings()}<button class="secondary" data-action="preset-balanced">${en?"Load balanced example":"균형 설계 불러오기"}</button>${design.hardwareVersion&&design.missionId==="earth"?`<button class="secondary" data-action="preset-region-precision">${en?"Precision example":"정밀 관측 예시"}</button><button class="secondary" data-action="preset-region-survey">${en?"Survey example":"광역 관측 예시"}</button>`:""}</div></details>`;
  const d=getPartDefinition(design,p);
  return `<div class="panel-head"><div class="selected-head">${icon(partIcon(p.kind))}<div><small>${en?"SELECTED PART":"선택한 부품"}</small><h3>${esc(en?d.nameEn:d.name)}</h3></div></div></div><div class="panel-body"><p class="part-quick-facts">${fmt(d.massKg,1)} kg · ${fmt(d.activePowerW)} W</p>${assemblyInspectionHTML(p)}<div class="action-row">${button("rotate",en?"Rotate":"회전","rotate","secondary")}${button("delete",en?"Remove":"제거","trash","secondary danger")}</div><details class="part-edit-details" data-preserve-details="part-edit"><summary>${en?"Precise edit & properties":"정밀 편집 · 부품 정보"}</summary><p class="small-note">${esc(hardwareDescription(d))}</p><div class="face-select">${(["px","nx","py","ny","pz","nz"] as const).map((f,i)=>`<button data-face="${f}" class="${p.face===f?"active":""}">${(en?["Right","Left","Top","Bottom","Front","Rear"]:["오른쪽","왼쪽","위","아래","앞","뒤"])[i]}</button>`).join("")}</div><div class="direct-input"><label for="rotation">${en?"Rotation":"회전"}</label><input id="rotation" type="range" min="0" max="345" step="15" value="${p.rotation}"/><output>${p.rotation}°</output></div><div class="action-row">${button("duplicate",en?"Duplicate":"복제","grid","secondary")}<button class="secondary" data-action="selected-part-focus">${en?"Inspect closely":"가까이 보기"}</button></div><button class="text-btn" data-action="component-source">${en?"Component specifications & source":"실제 부품 사양 · 출처"}</button>${design.hardwareVersion&&d.radio?`<button class="secondary" data-hardware-radio="${esc(p.id)}" ${resolveHardware(design).radioId===p.id?"disabled":""}>${resolveHardware(design).radioId===p.id?(en?"Active downlink radio":"현재 송신 무선기"):(en?"Use for downlink":"이 무선기로 송신")}</button>`:""}</details><details class="assembly-checks" data-preserve-details="checks"><summary>${en?"Craft checks":"기체 점검"}</summary>${warnings()}</details></div>`;
}

function missionFor(d: Design = design) {
  const m = MISSIONS[d.missionId];
  if (swingbyAssembly && swingbyModel) {
    const en = getLanguage() === "en", scenario = swingbyModel.getSwingbyScenario();
    return {...m,
      title: en ? "Choose your exit from Mars" : "화성을 지나, 다음 궤도로",
      subtitle: "M02B / HELIOCENTRIC EXIT CORRIDOR",
      description: en ? "Drag the approach aim point, prepare a real correction burn, and leave Mars through the Sun-frame exit corridor while returning 3 spectra." : "접근 조준점을 끌고 실제 보정 기동을 준비해, 태양 기준 탈출 회랑을 통과하며 분광 자료 3개를 지구로 보내세요.",
      budget: swingbyModel.SWINGBY_MISSION_BUDGET,
      massLimitKg: Infinity, targetPackets: scenario.science.targetPackets,
      constraints: en ? ["760 C total hardware budget including the 12 C carrier", "0.25 kg loaded propellant; carrier adds 0.4 kg when installed", "Actual mass-center gimbal limit 10°; no separate authored mass cap", "250 km minimum safe altitude; Sun-frame exit direction and energy", "3 valid spectra received on Earth before the deadline"] : ["캐리어 12 C를 포함한 기체 예산 760 C", "추진제 적재 0.25 kg · 캐리어 장착 시 0.4 kg 추가", "실제 질량중심 기준 짐벌 한계 10° · 별도 질량 상한 없음", "최저 안전 고도 250 km · 태양 기준 탈출 방향과 에너지", "기한 내 유효 분광 자료 3개를 지구에서 수신"],
      briefing: en ? ["Place the hardware and inspect the actual loaded mass and thrust alignment.", "Drag the aim handle. The route follows Mars gravity and your available correction impulse.", "Allow attitude preparation before the correction. A plan is not proof the burn will fire.", "Inspect the executed trajectory and return science to Earth. This begins near Mars, not at Earth launch."] : ["장비를 붙이고 실제 적재 질량과 추력 정렬을 확인하세요.", "조준 손잡이를 끌어 화성 중력과 보정 기동으로 가능한 경로를 만듭니다.", "보정 전에 자세를 준비하세요. 계획이 있다고 실제 분사가 보장되지는 않습니다.", "실행된 궤도와 지구의 과학 자료 수신을 확인합니다. 지구 발사 이후가 아닌 화성 접근에서 시작합니다."],
      epoch: `JD ${scenario.epochJdTdb} TDB · ICRF`,
    };
  }
  if (transferAssembly) {
    const stage = transferDraft?.launchStageId ?? "pathfinder",
      cost = { pathfinder: 95, explorer: 140, heavy: 210 }[stage],
      totalBudget = d.hardwareVersion
        ? HARDWARE_TRANSFER_MISSION_BUDGET
        : LEGACY_TRANSFER_MISSION_BUDGET;
    return {
      ...m,
      title: getLanguage() === "ko" ? "지구에서 화성까지" : "Earth to Mars",
      subtitle: "EARTH → MARS · M03",
      description:
        getLanguage() === "ko"
          ? `지구 주차 궤도에서 출발해 화성에 도달하고 분광 자료 3개를 지구로 보내세요. 기체 예산 ${totalBudget - cost} C, 탈출 단계 ${cost} C입니다.`
          : `Depart Earth parking orbit, encounter Mars and return 3 spectra. Spacecraft budget ${totalBudget - cost} C, escape stage ${cost} C.`,
      budget: totalBudget - cost,
      massLimitKg: { pathfinder: 85, explorer: 110, heavy: 140 }[stage],
      constraints: [
        getLanguage() === "ko"
          ? `총 임무 예산 ${totalBudget} 크레딧`
          : `Total mission budget ${totalBudget} credits`,
        "선택한 탈출 단계의 질량·추진제·수납 제한",
        "실제 출발·도착 날짜에 맞는 전이 궤도",
        "화성 고유 분광 자료 3개를 지구 수신",
      ],
      briefing: [
        "발전판·분광기·안테나·배터리를 3D 기체에 직접 배치하세요.",
        "비행 설계에서 지구와 화성 날짜 손잡이를 끌어 전이 창을 정합니다.",
        "태양 거리 증가와 수개월의 순항을 버티는 발전량이 필요합니다.",
        "탐사선 추진제와 분리되는 탈출 단계 추진제를 따로 계산합니다.",
      ],
    };
  }
  return d.missionId === "earth"
    ? {
        ...m,
        ...getTargetRequirements(d.scienceTarget, Boolean(d.hardwareVersion)),
        massLimitKg: getLaunchPackage(d).maxWetMassKg,
      }
    : m;
}
function targetTools() {
  if (design.missionId !== "earth") return "";
  const target = design.scienceTarget;
  return `<div class="target-tools"><div class="target-profiles"><button class="secondary ${!target && !targetProfile ? "active" : ""}" data-action="target-clear">${getLanguage() === "ko" ? "기본 회랑" : "Corridor"}</button><button class="secondary ${targetProfile === "precision" || target?.profile === "precision" ? "active" : ""}" data-action="target-precision">${getLanguage() === "ko" ? "정밀 관측" : "Precision"}</button><button class="secondary ${targetProfile === "survey" || target?.profile === "survey" ? "active" : ""}" data-action="target-survey">${getLanguage() === "ko" ? "광역 조사" : "Survey"}</button></div><small>${targetProfile ? (getLanguage() === "ko" ? "행성 표면을 클릭하여 관측 지역을 정하세요." : "Click the planet surface to choose your region.") : target ? `${Math.abs(target.latDeg).toFixed(2)}° ${target.latDeg >= 0 ? "N" : "S"} · ${Math.abs(target.lonDeg).toFixed(2)}° ${target.lonDeg >= 0 ? "E" : "W"} · ${getTargetRequirements(target, Boolean(design.hardwareVersion)).regionRadiusKm} km` : getLanguage() === "ko" ? "북반구 회랑 · 지역을 선택하면 과학 조건이 바뀝니다." : "Northern corridor · Pick a region to change science criteria."}</small><small title="${getLanguage() === "ko" ? "현재 고도와 선택한 카메라의 시야각을 사용한 천저 기준 범위입니다. 자세 전환 중 실제 시야나 유효 관측을 뜻하지 않습니다." : "Nadir reference at the current altitude using the selected camera’s field of view, not valid observations or the actual view while slewing."}">${getLanguage() === "ko" ? "점선: 천저 기준 범위 · 카메라가 바로 아래를 볼 때" : "Dashed: nadir reference footprint · camera pointing down"}</small></div>`;
}
function planUI() {
  const activeNode =
    getManeuvers(design.plan).find((n) => n.id === scene.selectedManeuverId) ||
    getManeuvers(design.plan)[0];
  const encounter = conjunctionMetrics(design);
  const ev = evaluateDesign(design),
    m = missionFor(),
    fly = flybyMetrics(design.plan),
    mars = design.missionId === "mars";
  return `<div class="scene-title"><span>${mars ? "MARS ENCOUNTER / APPROACH PLANE" : "EARTH ORBIT / MANEUVER DESIGN"}</span><strong>${mars ? "중력을 이용해, 다음 목적지로" : "지구를 바라보는 새로운 시선"}</strong><small>${mars ? "행성 접근점을 드래그해 편향각을 바꿉니다" : "Pe·Ap: 반경 조절 · i: 궤도면 · Esc: 취소"}</small></div><aside class="left-panel"><section class="panel panel-fill"><div class="panel-head"><div class="eyebrow">TRAJECTORY DESIGN</div><h2>${esc(m.title)}</h2><div class="action-row">${button("undo",getLanguage()==="ko"?"되돌리기":"Undo","undo","icon-btn",history.length&&!sim?"":"disabled")}${button("redo",getLanguage()==="ko"?"다시 실행":"Redo","rotate","icon-btn",future.length&&!sim?"":"disabled")}</div></div><div class="nav-preview-status">${pending ? '<span class="live-dot busy"></span> 새로운 경로 계산 중' : acceptedRevision === revision && preview ? '<span class="live-dot"></span> 최신 계획 예측 완료' : "예측을 다시 계산해 주세요"}</div><div class="panel-body">${mars ? `<div class="kv"><span>최근접 고도</span><strong>${fmt(design.plan.periapsisAltitudeKm)}<small>km</small></strong></div><div class="kv"><span>편향각</span><strong>${fmt(fly.turnAngleDeg, 1)}<small>°</small></strong></div><div class="kv"><span>태양 기준 속도 변화</span><strong>+${fmt(fly.speedGainKmS, 2)}<small>km/s</small></strong></div><div class="kv"><span>접근 보정 Δv</span><strong>${fmt(fly.correctionDeltaVMps, 1)}<small>m/s</small></strong></div><div class="divider"></div><p class="small-note">주황색 접근점: 위아래로 최근접 고도, 좌우로 접근 평면을 바꿉니다. 화성 기준 무한원 속력은 보존됩니다.</p>` : `${earthOrbitReadoutsHTML()}<div class="kv"><span>기동 시각</span><strong>${time(activeNode?.time ?? 0)}</strong></div><div class="kv"><span>계획 Δv</span><strong>${fmt(ev.requiredDeltaVMps, 1)}<small>m/s</small></strong></div><div class="divider"></div><p class="small-note">${getLanguage()==="ko"?"Pe·Ap를 지구에서 가까이 또는 멀리 끌고, 보라색 i 손잡이를 고리 위에서 움직이세요. 점선은 초기 궤도, 실선은 기동을 포함한 경로입니다. Shift: 미세 조정 · Esc: 취소. 타원 투입에는 전용 또는 대형 발사 패키지가 필요합니다.":"Drag Pe/Ap towards or away from Earth; move the purple i handle around its ring. Dashed: initial orbit; solid: path including burns. Shift: fine control · Esc: cancel. Elliptical injection needs a Dedicated or Heavy package."}</p>`}${
    !mars
      ? `<div class="divider"></div><div class="tiny-heading">MANEUVER SEQUENCE</div><div class="maneuver-list">${getManeuvers(
          design.plan,
        )
          .map(
            (n, i) =>
              `<button class="node-chip ${n.id === activeNode?.id ? "active" : ""}" data-node="${n.id}">M${i + 1} <span>${time(n.time)}</span> <small>${fmt(Math.hypot(n.progradeMps, n.normalMps, n.radialMps), 1)} m/s</small></button>`,
          )
          .join(
            "",
          )}</div><div class="action-row"><button class="secondary" data-action="add-node">${icon("orbit")} ${addNodeArmed ? "궤도 클릭 대기" : "기동점 추가"}</button><button class="secondary" data-action="delete-node">${icon("trash")} 삭제</button></div>`
      : ""
  }${!mars ? `<div class="divider"></div><button class="secondary" style="width:100%;font-size:10px" data-action="toggle-hazard">${icon("warning")} ${design.hazard === "debris" ? "근접접근 훈련 켜짐" : "근접접근 훈련 추가"}</button>${encounter.enabled ? `<div class="status-label ${encounter.safe ? "" : "warn"}">최소 거리 ${fmt(encounter.minDistanceKm, 2)} km / 목표 2 km</div><p class="small-note">T+${time(encounter.time)} · 이른 기동으로 궤도를 분리하세요. 확률이 아닌 주어진 두 궤도의 거리입니다.</p>` : ""}` : ""}<div class="legends"><span><i class="legend-dot"></i>태양광 구간</span><span><i class="legend-dot dark"></i>행성 그림자</span></div><div class="divider"></div><button class="text-btn" data-action="advanced">정밀 조정 · 키보드 대체 조작</button><div class="divider"></div><p class="small-note">${mars ? "화성 도착 전부터 시작하는 교육용 근접비행입니다. 지구 출발 전이 설계는 아직 포함하지 않습니다." : "점질량 중력 모델. 표시용 우주선 크기는 확대되어 있습니다."}</p></div></section></aside><aside class="right-panel"><section class="panel"><div class="panel-head"><div class="eyebrow">PRE-FLIGHT REVIEW</div><h2>예상 과학 성과</h2></div><div class="panel-body"><div class="science-counter"><strong>${pending ? "—" : (preview?.result.received ?? "—")}</strong><span>/ ${m.targetPackets}</span></div><p class="small-note">기한 내 지구가 수신한 유효 데이터</p><div class="divider"></div>${preview && !pending ? `<div class="status-label ${preview.result.status === "success" ? "" : preview.result.status === "partial" ? "warn" : "error"}">${icon(preview.result.status === "success" ? "check" : "warning")} ${esc(preview.result.title)}</div><p class="small-note">${esc(preview.result.reasons[0] || "현재 설계와 운영 일정에 따른 예측입니다.")}</p>` : '<p class="small-note">배치·궤도·운영 일정을 함께 시험합니다.</p>'}<div class="divider"></div><div class="kv"><span>기동 후 연료</span><strong>${fmt(ev.fuelKg - ev.propellantUsedKg, 2)}<small>kg</small></strong></div><div class="kv"><span>전력 최소 잔량</span><strong>${preview ? fmt(preview.result.energyMinimumWh, 1) : "—"}<small>Wh</small></strong></div>${!mars?`<button class="text-btn" data-action="launch-packages">${getLanguage()==="ko"?"발사 패키지 · 궤도 투입 조건":"Launch package · orbit eligibility"}</button>`:""}<button class="primary" style="width:100%;margin-top:9px" data-action="launch" ${!ev.launchable || pending || acceptedRevision !== revision || !preview ? "disabled" : ""}>${icon("rocket")} 임무 시작</button></div></section><section class="panel panel-fill"><div class="panel-body">${reviewContextHTML()}${warnings()}<button class="text-btn" data-action="science">과학 모델 · GMAT 검증</button></div></section></aside>${viewTools()}${targetTools()}<div class="control-hint"><span><span class="kbd">우클릭</span> 회전</span><span><span class="kbd">Shift</span> 미세 조정</span><span><span class="kbd">궤도 클릭</span> 기동점 이동</span></div>${timelineUI(false)}`;
}
function timelineUI(flight: boolean) {
  const m = missionFor();
  return `${!flight && showResources ? resourceGraph(pending ? null : preview, previewTime) : ""}<section class="timeline-deck"><div class="timeline-top"><div class="timeline-heading"><h3>${flight ? "MISSION TIMELINE" : "운영 일정"}</h3><small>${flight ? "ONBOARD SEQUENCE" : "DRAG ACTIONS ONTO THE TRACK"}</small></div>${flight ? `<div class="timeline-play"><span class="time-value" id="flight-time">${time(sim?.time ?? 0)}</span>${button("play-pause", playing ? "일시정지" : "재생", playing ? "pause" : "play")}${[1, 60, 120, 600].map((v) => `<button class="speed-btn ${v === speed ? "active" : ""}" data-speed="${v}">${v}×</button>`).join("")}</div>` : `<div class="op-tools">${(["charge", "observe", "downlink"] as OperationKind[]).map((k) => `<button class="op-tool" data-op-new="${k}">${icon(k === "charge" ? "sun" : k === "observe" ? "camera" : "antenna")}${k === "charge" ? "충전" : k === "observe" ? "관측" : "송신"}</button>`).join("")}<button class="op-tool" data-action="resources">${icon("power")} ${getLanguage() === "ko" ? "자원 곡선" : "Resources"}</button><button class="op-tool" data-action="schedule-preset">${icon("rotate")} 기준 일정</button></div>`}</div><div class="timeline-track" id="timeline" aria-label="관측과 송신 일정을 드래그하는 타임라인">${design.plan.operations.map((op) => `<div class="op-block ${op.kind}" data-op="${op.id}" style="left:${(op.start / m.duration) * 100}%;width:${((op.end - op.start) / m.duration) * 100}%" title="${op.kind} ${time(op.start)}–${time(op.end)} · 우클릭으로 제거">${icon(op.kind === "observe" ? "camera" : op.kind === "downlink" ? "antenna" : "sun")}<span>${op.kind === "observe" ? "관측" : op.kind === "downlink" ? "송신" : "충전"}</span>${flight ? "" : '<i class="resize-handle"></i>'}</div>`).join("")}<div class="time-cursor" id="time-cursor" style="left:${((sim?.time ?? previewTime) / m.duration) * 100}%"></div></div><div class="timeline-scale">${[0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1].map((n) => `<span>${mins(m.duration * n)}</span>`).join("")}</div><div class="timeline-note">${flight ? "탑재된 일정은 통신이 끊겨도 실행됩니다 · Space 일시정지" : "드래그: 이동 · 오른쪽 끝: 길이 조정 · 우클릭: 제거 · 빈 구간: 충전"}</div></section>`;
}
function resetFlightForecast() {
  flightForecast = null;
  forecastSequence++;
  forecastPending = false;
  lastForecastTick = -Infinity;
  lastForecastCommandCount = -1;
  stopAtTime = null;
}
function updateFlightAdvisor() {
  const el = $("#flight-advisor");
  if (!el || el.contains(document.activeElement) || el.matches(":hover"))
    return;
  const html = flightAdvisorHTML();
  if (el.innerHTML !== html) el.innerHTML = html;
}
function requestFlightForecast(force = false) {
  if (!sim || sim.status !== "running" || !forecastWorker) return;
  if (
    !force &&
    (forecastPending ||
      (sim.time - lastForecastTick < 180 &&
        sim.commands.length === lastForecastCommandCount))
  )
    return;
  forecastPending = true;
  lastForecastTick = sim.time;
  lastForecastCommandCount = sim.commands.length;
  forecastWorker.postMessage({
    requestId: ++forecastSequence,
    state: structuredClone(sim),
  });
}
function flightAdvisorHTML() {
  if (!sim) return "";
  const en = getLanguage() === "en",
    f = flightForecast,
    e = f?.nextEvent,
    upcoming = e && e.time > sim.time ? e : null,
    risk = f && f.minEnergyWh / f.energyCapacity < 0.2;
  return `<div class="advisor-header"><span class="live-dot ${forecastPending ? "busy" : ""}"></span><small>${en ? "MISSION LOOKAHEAD" : "다가오는 상황"}</small><strong>${f ? `${Math.round(f.horizon / 60)} min` : ""}</strong><button class="advisor-toggle" data-action="advisor-details" aria-expanded="${advisorExpanded}" title="${en ? "Forecast details" : "예측 상세"}">${advisorExpanded ? "−" : "+"}</button></div>${f ? `<h3>${upcoming ? (en ? upcoming.en : upcoming.ko) : en ? "Continue the onboard sequence" : "탑재된 일정을 이어갑니다"}</h3><div class="advisor-metrics"><span>${en ? "Minimum battery" : "예상 최소 배터리"} <b class="${risk ? "warn" : ""}">${fmt(f.minEnergyWh, 1)} Wh</b></span>${upcoming ? `<span>T+${time(upcoming.time)}</span>` : ""}</div>${advisorExpanded ? `<p>${esc(f.reasons[0] ? (en ? f.reasons[0].en : f.reasons[0].ko) : "")}</p>` : ""}<div class="action-row">${upcoming ? `<button class="secondary" data-action="warp-event">${icon("play")} ${en ? "To decision point" : "검토 시점까지"}</button>` : ""}${risk ? `<button class="secondary" data-action="advisor-charge">${icon("sun")} ${en ? "Queue charging" : "충전 명령 예약"}</button>` : ""}</div>${advisorExpanded ? `<small class="advisor-assumption">${en ? "Assumes the current sequence and commands continue. New commands travel through the real link." : "현재 일정·명령 유지 가정 · 새 지시는 실제 교신과 전파 지연을 거칩니다."}</small>` : ""}` : `<p>${en ? "Forecasting from the live spacecraft state…" : "현재 탐사선 상태로 이후 상황을 계산하고 있습니다…"}</p>`}`;
}

function flightUI() {
  const m = missionFor();
  return `<div class="scene-title"><span>MISSION CONTROL / LIVE TELEMETRY</span><strong data-i18n-skip>${esc(design.name)}</strong><small id="flight-state">탐사선 상태 수신 중</small></div><aside class="left-panel"><section class="panel"><div class="panel-head"><div class="eyebrow">SCIENCE RETURN</div><h2>${esc(m.title)}</h2></div><div class="panel-body"><div class="science-counter"><strong id="science-value">0</strong><span>/ ${m.targetPackets}</span></div><p class="small-note">기한 내 수신한 유효 데이터</p><div class="bar"><i id="science-bar" style="width:0%"></i></div><div class="kv"><span>현재 고도</span><strong id="altitude-value">—</strong></div><div class="kv"><span>속력</span><strong id="velocity-value">—</strong></div><div class="divider"></div><p class="small-note" id="operation-reason">탑재된 일정에 따라 임무를 수행합니다.</p></div></section><section class="panel panel-fill"><div class="panel-head"><div class="eyebrow">SCIENCE DELIVERY</div><h2>${getLanguage() === "ko" ? "발견의 여정" : "Journey of a discovery"}</h2></div><div class="panel-body science-delivery-body">${sim ? scienceFlowHTML(sim) : ""}<details class="flight-log-details"><summary>${getLanguage() === "ko" ? "임무 기록" : "Mission log"}</summary><div class="event-list" id="event-log"></div></details></div></section></aside><aside class="right-panel"><section class="panel"><div class="panel-head"><div class="eyebrow">SPACECRAFT SYSTEMS</div><h2>탐사선 상태 <span class="live-dot"></span></h2></div><div class="panel-body"><div class="kv"><span>배터리</span><strong id="energy-value">—</strong></div><div class="bar"><i id="energy-bar" style="width:80%"></i></div><div class="kv"><span>발전 / 소비</span><strong id="power-value">—</strong></div><div class="kv"><span>저장 데이터</span><strong id="data-value">—</strong></div><div class="bar amber"><i id="data-bar" style="width:0%"></i></div><div class="kv"><span>통신 상태</span><strong id="link-value">—</strong></div><div class="kv"><span>빛의 전달 시간</span><strong id="delay-value">—</strong></div><div class="divider"></div><div class="kv"><span>남은 추진제</span><strong id="fuel-value">—</strong></div><div class="status-label" id="eclipse-value"></div><p class="small-note" id="attitude-state"></p></div></section><section class="panel"><div class="panel-body"><div class="tiny-heading">GROUND COMMAND · 10 MIN</div><div class="command-actions"><button class="secondary" data-action="command-charge">${icon("sun")} 충전 지시</button><button class="secondary" data-action="command-observe">${icon("camera")} 관측 지시</button><button class="secondary" data-action="command-downlink">${icon("antenna")} 송신 지시</button><button class="secondary" data-action="command-resume">${icon("rotate")} 일정 복귀</button></div><p class="command-state" id="command-state">지상 명령은 교신이 가능할 때 발송합니다.</p><div class="action-row"><button class="secondary" data-action="finish">${icon("science")} 중간 결과</button><button class="secondary" data-action="save">${icon("save")} 저장</button></div></div></section></aside>${viewTools()}<section id="flight-advisor" class="flight-advisor">${flightAdvisorHTML()}</section><div id="science-flash" class="science-flash" aria-live="polite"></div>${design.hazard === "debris" ? '<div class="hazard-live" id="hazard-live"></div>' : ""}<div class="control-hint"><span><span class="kbd">Space</span> 일시정지</span><span><span class="kbd">휠</span> 확대</span><span><span class="kbd">F</span> 기체 추적</span></div>${timelineUI(true)}`;
}
function render() {
  const openDetails=Array.from(ui.querySelectorAll<HTMLDetailsElement>("details[data-preserve-details][open]")).map(el=>el.dataset.preserveDetails!);
  const active=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const assemblyFocus=mode!=="build"||!active?null:active.dataset.keyboardPart?`[data-keyboard-part="${CSS.escape(active.dataset.keyboardPart)}"]`:active.matches('[data-part]')?active.dataset.model?`[data-model="${CSS.escape(active.dataset.model)}"]`:`[data-part="${active.dataset.part}"]`:active.matches('.keyboard-parts summary')?'.keyboard-parts summary':null;
  const keyboardFocus=keyboardPlacement&&document.activeElement instanceof HTMLElement?document.activeElement.dataset.kbField??document.activeElement.dataset.kbCommand:null;
  ui.className = `overlay ${mode==="build"?"experience-builder":""} ${keyboardPlacement?"keyboard-editing":""} ${scene.controlRoomActive ? "control-room-view" : ""} ${mode === "plan" || mode === "flight" ? "plan-layout" : ""} ${showResources && mode === "plan" ? "resource-open" : ""}`;
  ui.innerHTML =
    header() +
    (mode === "campus"
      ? home()
      : mode === "build"
        ? buildUI()
        : mode === "plan"
          ? planUI()
          : flightUI());
  if (mode === "flight" && sim) updateTelemetry();
  for(const key of openDetails){const details=ui.querySelector<HTMLDetailsElement>(`details[data-preserve-details="${CSS.escape(key)}"]`);if(details)details.open=true;}
  translateDOM(ui);
  translateDOM($("#viewport"));
  if(keyboardPlacement){refreshKeyboardPlacement();if(keyboardFocus)document.querySelector<HTMLElement>(`[data-kb-field="${keyboardFocus}"],[data-kb-command="${keyboardFocus}"]`)?.focus();}
  else if(assemblyFocus){const el=document.querySelector<HTMLElement>(assemblyFocus);if(el?.dataset.keyboardPart){const details=el.closest('details');if(details)details.open=true;}el?.focus();}
}

function modal(title: string, eyebrow: string, body: string, footer = "") {
  if (!$("#modal-root").children.length)
    modalReturnFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
  playing = false;
  $("#toast-root").innerHTML = "";
  $("#modal-root").innerHTML =
    `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-header"><div><div class="eyebrow">${eyebrow}</div><h2>${title}</h2></div>${button("close-modal", "닫기", "close")}</div><div class="modal-body">${body}</div>${footer ? `<div class="modal-footer">${footer}</div>` : ""}</section></div>`;
  translateDOM($("#modal-root"));
  queueMicrotask(() =>
    $("#modal-root")
      .querySelector<HTMLButtonElement>("button:not([disabled])")
      ?.focus({ preventScroll: true }),
  );
}
function closeModal() {
  $("#modal-root").innerHTML = "";
  if (modalReturnFocus?.isConnected)
    modalReturnFocus.focus({ preventScroll: true });
  modalReturnFocus = null;
}
function operationsHomeLink() {
  return `<button class="text-btn transfer-home-load" data-action="load-transfer-operations">${getLanguage() === "ko" ? "원격 관제 연습 이어하기" : "Continue remote operations"} ${icon("arrow")}</button>`;
}
function swingbyHomeLink() {
  return `<button class="text-btn transfer-home-load" data-action="load-swingby">${getLanguage() === "ko" ? "스윙바이 탈출 회랑 이어하기" : "Continue swingby exit corridor"} ${icon("arrow")}</button>`;
}
function swingbyMissionCard() {
  return `<button class="mission-card transfer-mission-card" data-action="mission-swingby"><div class="mission-planet mars"></div><div class="mission-card-body"><div class="eyebrow">02B / HELIOCENTRIC EXIT CORRIDOR</div><h3>${getLanguage() === "ko" ? "화성을 지나, 다음 궤도로" : "Choose your exit from Mars"}</h3><p>${getLanguage() === "ko" ? "화성 접근점을 직접 조준하고, 질량 배치와 자세가 허용하는 보정 기동을 실행하세요. 중력도움으로 태양 기준 탈출 회랑을 통과하고 과학 자료를 지구에 전달합니다." : "Aim your Mars approach and execute a correction allowed by the spacecraft’s mass distribution and attitude. Use gravity assist to cross the Sun-frame exit corridor and return science to Earth."}</p><div class="mission-tags"><span>${getLanguage() === "ko" ? "시스템 설계 전용" : "SYSTEMS DESIGN"}</span><span>760 C</span><span>0.25 kg ${getLanguage() === "ko" ? "추진제" : "PROPELLANT"}</span></div></div></button>`;
}
function operationsMissionCard() {
  return `<button class="mission-card transfer-mission-card" data-action="mission-operations"><div class="mission-planet mars"></div><div class="mission-card-body"><div class="eyebrow">03B / REMOTE OPERATIONS</div><h3>${getLanguage() === "ko" ? "늦기 전에, 관측 일정을 바꿔라" : "Repair the encounter schedule"}</h3><p>${getLanguage() === "ko" ? "화성에 다가가는 탐사선의 관측이 너무 일찍 끝납니다. 시간 블록을 끌어 일정을 고치고, 교신 기회가 닫히기 전에 명령을 전달하세요." : "The approaching spacecraft will stop observing too early. Drag its schedule blocks and deliver your correction before the listening opportunity closes."}</p><div class="mission-tags"><span>${getLanguage() === "ko" ? "고정 기체 · 관제 연습" : "FIXED CRAFT · TRAINING"}</span><span>${getLanguage() === "ko" ? "통신 지연" : "SIGNAL DELAY"}</span></div></div></button>`;
}
function missionModal() {
  modal(
    "어떤 발견을 만들까요?",
    "CHOOSE YOUR MISSION",
    `<div class="design-profile-switch" role="group" aria-label="${getLanguage() === "ko" ? "조립 난이도" : "Assembly approach"}"><button data-design-profile="legacy" class="${!hardwareMission ? "active" : ""}" aria-pressed="${!hardwareMission}"><strong>${getLanguage() === "ko" ? "첫 임무" : "First mission"}</strong><span>${getLanguage() === "ko" ? "통합 장비로 조립과 항법 익히기" : "Learn assembly and navigation with integrated equipment"}</span></button><button data-design-profile="hardware" class="${hardwareMission ? "active" : ""}" aria-pressed="${hardwareMission}"><strong>${getLanguage() === "ko" ? "시스템 설계" : "Systems design"}</strong><span>${getLanguage() === "ko" ? "버스·무선기·전원·자세제어 직접 구성" : "Build the bus, radio, power and attitude-control systems"}</span></button></div><div class="mission-options">${Object.values(
      MISSIONS,
    )
      .map(
        (m) =>
          `<button class="mission-card" data-mission="${m.id}"><div class="mission-planet ${m.id}"></div><div class="mission-card-body"><div class="eyebrow">${m.id === "earth" ? "01 / EARTH OBSERVATION" : "02 / MARS GRAVITY ASSIST"}</div><h3>${esc(m.title)}</h3><p>${esc(m.description)}</p><div class="mission-tags"><span>${m.id === "earth" ? "첫 탐사" : "중력도움 항법"}</span><span>${m.id === "earth" ? "약 8–12분" : "약 10–15분"}</span><span>${m.massLimitKg} kg 이내</span></div></div></button>`,
      )
      .join(
        "",
      )}<button class="mission-card transfer-mission-card" data-action="mission-transfer"><div class="mission-planet mars"></div><div class="mission-card-body"><div class="eyebrow">03 / EARTH TO MARS</div><h3>${getLanguage() === "ko" ? "지구에서 화성까지" : "Earth to Mars"}</h3><p>${getLanguage() === "ko" ? "움직이는 두 행성 사이의 만남을 설계하세요. 지구 탈출, 수개월의 순항, 화성 관측과 지구 수신까지 이어집니다." : "Design a meeting between moving planets. Escape Earth, cruise for months, encounter Mars and return your discoveries."}</p><div class="mission-tags"><span>JPL EPHEMERIDES</span><span>3 PHASES</span><span>${hardwareMission ? HARDWARE_TRANSFER_MISSION_BUDGET : LEGACY_TRANSFER_MISSION_BUDGET} C</span></div></div></button>${operationsMissionCard()}${swingbyMissionCard()}${deploymentMissionCard()}</div>`,
    getLanguage() === "ko" ? "3D 조립과 물리 기반 궤도 계산을 사용합니다. M02B 스윙바이와 M03 전이 임무는 각각 별도 저장 슬롯을 사용합니다." : "3D assembly and physics-based trajectories. M02B swingby and M03 transfer missions each use separate save slots.",
  );
}
function helpModal() {
  modal(
    "손으로 만드는 우주 탐사",
    "FLIGHT MANUAL",
    `<div class="help-grid"><div><h3>01 · 기체 조립</h3><p>장비 선반에서 부품을 끌어 기체의 평평한 표면 위에 놓습니다. 초록색은 장착 가능, 빨간색은 간섭이나 장착 제한입니다.</p><ul><li>왼쪽 드래그 — 부품 선택·이동</li><li>오른쪽 드래그 — 카메라 회전</li><li>휠 — 확대 · 중간 버튼 — 화면 이동</li><li>R / 회전 고리 — 회전</li><li>Delete — 제거 · Ctrl+Z/Y — 되돌리기</li></ul></div><div><h3>02 · 비행과 운영</h3><p>궤도의 손잡이를 드래그하면 물리적으로 가능한 경로를 다시 계산합니다. 화성에서는 주황색 접근점으로 최근접 고도와 접근 방향을 조절합니다.</p><ul><li>궤도 클릭 — 기동 시각 이동</li><li>Shift 드래그 — 정밀 조정</li><li>타임라인 — 관측·송신 작업 드래그</li><li>작업 오른쪽 끝 — 시간 길이 변경</li><li>Space — 실행 일시정지 · F — 기체 가까이</li></ul></div><div><h3>성공의 기준</h3><p>많이 찍는 것으로 끝나지 않습니다. 해상도·시야·전력 조건을 만족한 데이터를 기한 안에 지구로 전달해야 합니다. 기체의 그림자·행성 가림·통신 지연을 함께 확인하세요.</p></div><div><h3>실패하면 한 가지만 바꿔보세요</h3><p>부품 위치, 궤도, 관측과 송신 시각 중 하나를 바꾸어 같은 조건으로 다시 실행하세요. 결과 화면에서 이전 시도와 비교할 수 있습니다.</p></div></div>`,
    "숫자 입력은 정밀 조정을 위한 보조 기능입니다. 주요 제작과 항법은 3D 화면에서 직접 조작합니다.",
  );
}
function briefingModal() {
  const m = missionFor();
  modal(
    m.title,
    "MISSION REQUIREMENTS",
    `<p class="small-note">${esc(m.description)}</p>${transferAssembly || swingbyAssembly ? `<ul class="small-note">${m.constraints.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>` : requirementTable(design)}<div class="divider"></div>${m.briefing.map((b, i) => `<div class="briefing-step"><b>0${i + 1}</b><span>${esc(b)}</span></div>`).join("")}<button class="secondary" data-action="missions">다른 임무 살펴보기</button>`,
    `${transferAssembly ? "출발·도착 날짜: TDB" : m.epoch} · 교육용 임무 · 비용 단위는 게임 크레딧입니다.`,
  );
}
function settingsModal() {
  modal(
    "환경 설정",
    "PREFERENCES",
    `<div class="settings-row"><span>그래픽 품질</span><select id="quality"><option value="high" ${scene.quality === "high" ? "selected" : ""}>높음</option><option value="medium" ${scene.quality === "medium" ? "selected" : ""}>중간</option><option value="low" ${scene.quality === "low" ? "selected" : ""}>낮음</option></select></div><div class="settings-row"><span>인터페이스 크기</span><select id="ui-scale"><option value="normal">기본</option><option value="large" ${document.body.classList.contains("large-ui") ? "selected" : ""}>크게</option></select></div><div class="settings-row"><span>카메라 전환 효과</span><select id="motion"><option value="full">부드러운 전환</option><option value="reduced" ${reducedMotion ? "selected" : ""}>효과 줄이기</option></select></div><div class="settings-row"><span>효과음</span><button class="secondary" data-action="sound">${icon(sound ? "volume" : "mute")}${sound ? "켜짐" : "꺼짐"}</button></div><div class="divider"></div><div class="action-row"><button class="secondary" data-action="export">${icon("download")} JSON 백업</button><button class="secondary" data-action="import">${icon("upload")} 백업 가져오기</button><button class="secondary" data-action="science">${icon("info")} 출처와 모델</button></div><p class="small-note" style="margin-top:18px">플레이는 브라우저 내부에서 계산합니다. 브라우저 저장 공간은 사용자가 삭제할 수 있으므로 중요한 설계는 JSON으로 내려받으세요.</p>`,
  );
}
function advancedModal() {
  const p = design.plan,
    mars = design.missionId === "mars",
    node =
      getManeuvers(p).find((n) => n.id === scene.selectedManeuverId) ||
      getManeuvers(p)[0];
  const input = (
    key: string,
    label: string,
    min: number,
    max: number,
    step: number,
    burn = false,
  ) => {
    const value = (burn ? node : p) as unknown as Record<string, number>;
    return `<div class="direct-input"><label style="width:125px" for="plan-${key}">${label}</label><input ${burn ? "data-burn" : "data-plan"}="${key}" id="plan-${key}" type="range" min="${min}" max="${max}" step="${step}" value="${value[key]}"/><output>${fmt(value[key], 1)}</output></div>`;
  };
  const orbit=initialEarthOrbit(p),en=getLanguage()==='en';
  const apsisInput=(which:'periapsis'|'apoapsis')=>{const value=which==='periapsis'?orbit.periapsisAltitudeKm:orbit.apoapsisAltitudeKm,min=which==='periapsis'?180:orbit.periapsisAltitudeKm,max=which==='periapsis'?orbit.apoapsisAltitudeKm:2000,label=which==='periapsis'?(en?'Periapsis km':'근지점 고도 km'):(en?'Apoapsis km':'원지점 고도 km');return `<div class="direct-input"><label style="width:125px" for="earth-${which}">${label}</label><input data-earth-apsis="${which}" id="earth-${which}" type="range" min="${min}" max="${max}" step="1" value="${value}"/><output>${fmt(value,1)}</output></div>`;};
  modal(
    "항법 정밀 조정",
    "NAVIGATION CONTROLS",
    mars
      ? input("periapsisAltitudeKm", "최근접 고도 km", 250, 6000, 25) +
          input("bPlaneAngleDeg", "접근 궤도면 °", -150, 150, 1)
      : apsisInput("periapsis")+apsisInput("apoapsis")+
          input("inclinationDeg", "경사각 °", 0, 180, 1) +
          (node
            ? input(
                "time",
                "선택 기동 시각 s",
                0,
                missionFor().duration - 60,
                5,
                true,
              ) +
              input("progradeMps", p.earthOrbit?(en?"Transverse T m/s":"접선 기동 T m/s"):"진행 기동 m/s", -120, 180, 0.5, true) +
              input("normalMps", "법선 기동 m/s", -120, 120, 0.5, true) +
              input("radialMps", "반경 기동 m/s", -120, 120, 0.5, true)
            : ""),
    '<span>방향키로도 조절할 수 있습니다. 변경은 3D 경로와 과학 예측에 반영됩니다.</span><button class="secondary" data-action="close-modal">완료</button>',
  );
}

function scienceModal() {
  if (swingbyAssembly && swingbyModel) {
    const en = getLanguage() === "en", scenario = swingbyModel.getSwingbyScenario();
    modal(en ? "Swingby model and sources" : "스윙바이 모델과 출처", "M02B / SWINGBY-1.0.0",
      `<p class="small-note">${en ? "This separate model begins near Mars at a 2027 JPL ephemeris epoch. It does not simulate the preceding Earth departure. Mars-centred motion uses point-mass gravity; the outbound 100,000 km crossing is evaluated in the Sun frame." : "이 별도 모델은 2027년 JPL 천체력 시각의 화성 접근에서 시작합니다. 앞선 지구 출발은 포함하지 않습니다. 화성 중심 운동에는 점질량 중력을 사용하고, 바깥쪽 100,000 km 통과를 태양 기준으로 평가합니다."}</p><p class="small-note">${en ? "One ideal impulse after one hour requires actual attitude, bus power, battery output and 0.25 kg loaded propellant. The 0.4 kg / 12 C CG-trim carrier and its 10° gimbal are authored game assumptions. This is not a continuous-thrust or six-degree-of-freedom flight solver." : "1시간 뒤의 한 번의 이상적 충격 기동은 실제 자세·버스 전력·배터리 출력·적재 추진제 0.25 kg 조건을 충족해야 합니다. 0.4 kg / 12 C의 CG 조정 캐리어와 10° 짐벌은 게임 가정입니다. 연속 추력이나 6자유도 동역학 해석은 아닙니다."}</p><p class="small-note">JD ${scenario.epochJdTdb} TDB · ICRF<br>${en ? "Orbit validation does not validate component reliability or mission success." : "궤도 검증은 부품 신뢰도나 임무 성공을 보증하지 않습니다."}</p><div class="action-row"><a class="secondary" href="/data/transfer/sources.json" target="_blank" rel="noopener">${en ? "JPL ephemeris provenance" : "JPL 천체력 출처"}</a><a class="secondary" href="/data/hardware-catalog-v2.json" target="_blank" rel="noopener">${en ? "Hardware catalog" : "하드웨어 목록"}</a><a class="secondary" href="/data/component-sources.json" target="_blank" rel="noopener">${en ? "Manufacturer data and assumptions" : "제조사 사양과 가정"}</a></div>`);
    return;
  }
  modal(
    getLanguage() === "ko" ? "과학 모델과 출처" : "Science model and sources",
    "MODEL NOTES & REFERENCES",
    scienceModelHTML(Boolean(design.hardwareVersion)),
  );
}
function scienceThumbnail(p: DataPacket, index: number) {
  const parts = p.target.split(":"),
    fallback = { latDeg: Number(parts[0]) * 6, lonDeg: Number(parts[1]) * 6 },
    point =
      p.observedPoint ||
      (Number.isFinite(fallback.latDeg) && Number.isFinite(fallback.lonDeg)
        ? fallback
        : null);
  const u = point ? (point.lonDeg + 180) / 360 : 0.2 + index * 0.22,
    v = point ? (90 - point.latDeg) / 180 : 0.25 + index * 0.12;
  return `<div class="science-frame ${design.missionId}" style="background-position:calc(50% - ${(u - 0.5) * 580}px) calc(50% - ${(v - 0.5) * 290}px)" title="${getLanguage() === "ko" ? "수신 구역의 지도 기반 재구성입니다. 실제 카메라 사진이 아닙니다." : "Map reconstruction of a returned region, not an actual photograph."}${point ? ` ${point.latDeg.toFixed(2)}°, ${point.lonDeg.toFixed(2)}°` : ""}"><span>DATA ${index + 1} · Q ${Math.round(p.quality * 100)} · ${time(p.capturedAt)}</span></div>`;
}
function showResult() {
  if (!sim) return;
  playing = false;
  const r = getResult(sim),
    mission = missionFor(r.design);
  activeDebrief = buildDebrief(
    {
      result: r,
      meta: {
        modelVersion: sim.modelVersion,
        simulationStatus: sim.status,
        requirements: {
          targetPackets: mission.targetPackets,
          minimumQuality: mission.minimumQuality,
          deadlineSeconds: mission.duration,
        },
      },
      designWarnings: evaluateDesign(r.design).warnings,
    },
    previousResult ? { result: previousResult } : undefined,
  );
  const delta = activeDebrief.comparison.scoreDelta?.total ?? null;
  modal(
    r.status === "success"
      ? "임무를 완수했습니다"
      : r.status === "partial"
        ? "발견은 다음 설계로 이어집니다"
        : "이번 임무에서 배운 것",
    "MISSION DEBRIEF",
    `<div class="result-layout"><div class="result-score"><div class="score-ring"><strong>${fmt(r.score)}</strong><small>MISSION SCORE</small></div><div class="status-label ${r.status === "success" ? "" : "warn"}">${esc(r.title)}</div>${delta !== null ? `<p>이전 시도 대비 ${delta >= 0 ? "+" : ""}${fmt(delta)}점</p>` : ""}</div><div class="result-detail"><h3>지구가 받은 과학 성과</h3><div class="result-metrics"><div><span>유효 데이터</span><strong>${r.received} / ${r.required}</strong></div><div><span>최소 배터리</span><strong>${fmt(r.energyMinimumWh, 1)} Wh</strong></div><div><span>남은 추진제</span><strong>${fmt(r.fuelRemainingKg, 2)} kg</strong></div></div><div class="result-reasons">${r.reasons.map((x) => `<p>${esc(x)}</p>`).join("")}</div>${debriefHTML(activeDebrief, { part: (kind, modelId) => hardwarePartLabel(kind, modelId), bus: hardwareBusLabel })}<details class="result-science-details"><summary>${getLanguage() === "ko" ? "과학 자료와 상세 조건" : "Science data and detailed criteria"}</summary>${requirementTable(design, r)}<div class="science-gallery">${r.packets
      .filter((p) => p.receivedAt !== null)
      .slice(0, 4)
      .map((p, i) => scienceThumbnail(p, i))
      .join(
        "",
      )}</div><p class="small-note" style="margin-top:6px">수신 자료의 품질과 관측 시각 · 표면 지도 기반 구역 재구성</p></details><div class="result-actions"><button class="primary" data-action="retry">설계 개선하기 ${icon("arrow")}</button><button class="secondary" data-action="missions">다른 임무</button></div></div></div>`,
    "과학 성과 60 · 임무 달성 25 · 자원 여유 15 — 출처와 모델 가정이 있는 교육용 평가입니다.",
  );
  scheduleSave();
  beep("success");
}

function updatePreviewTelemetry() {
  if (!preview || mode !== "plan") return;
  const sample = preview.samples.reduce((a, b) =>
    Math.abs(a.time - previewTime) < Math.abs(b.time - previewTime) ? a : b,
  );
  scene.setTelemetry(sample);
}
function updateScienceAnnouncement() {
  const flash = $("#science-flash");
  if (!flash) return;
  const age = scienceAnnouncement
    ? performance.now() - scienceAnnouncement.announcedAt
    : SCIENCE_ANNOUNCEMENT_MS;
  if (!scienceAnnouncement || age >= SCIENCE_ANNOUNCEMENT_MS) {
    scienceAnnouncement = null;
    flash.textContent = "";
    flash.classList.remove("arrived");
    delete flash.dataset.packetIds;
    delete flash.dataset.announcedAt;
    return;
  }
  const announcementId = String(scienceAnnouncement.announcedAt);
  if (flash.dataset.announcedAt === announcementId) return;
  const count = scienceAnnouncement.packetIds.length;
  flash.textContent =
    getLanguage() === "ko"
      ? `지구 수신 완료 · 새로운 자료 ${count}개`
      : `Earth received ${count} new dataset${count > 1 ? "s" : ""}`;
  flash.dataset.packetIds = JSON.stringify(scienceAnnouncement.packetIds);
  flash.dataset.announcedAt = announcementId;
  // A UI refresh resumes the same short announcement; it does not replay a
  // receipt, repeat its sound, or extend its real-time display lifetime.
  flash.style.animationDelay = `${-Math.max(0, age)}ms`;
  flash.classList.remove("arrived");
  void flash.offsetWidth;
  flash.classList.add("arrived");
}

function updateTelemetry() {
  if (!sim || mode !== "flight") return;
  const t = getTelemetry(sim);
  scene.setTelemetry(t);
  scene.setSciencePackets(sim.dataPackets);
  requestFlightForecast();
  updateFlightAdvisor();
  const flow = $("#science-flow");
  if (flow) flow.outerHTML = scienceFlowHTML(sim, t);
  const changes = scienceEventsSince(scienceSeen, sim);
  scienceSeen = changes.ids;
  if (changes.received.length) {
    scienceAnnouncement = {
      packetIds: changes.received.map((packet) => packet.id),
      announcedAt: performance.now(),
    };
    beep("success");
  }
  updateScienceAnnouncement();
  const set = (id: string, html: string) => {
    const el = $("#" + id);
    if (el) el.innerHTML = html;
  };
  set("flight-time", time(sim.time));
  set("science-value", String(t.scienceReceived));
  set("altitude-value", `${fmt(t.altitudeKm)}<small>km</small>`);
  set("velocity-value", `${fmt(t.speedKmS, 2)}<small>km/s</small>`);
  set(
    "energy-value",
    `${fmt(t.energyWh, 1)}<small>/ ${fmt(t.batteryWh)} Wh</small>`,
  );
  set(
    "power-value",
    `${fmt(t.solarPowerW)} / ${fmt(t.loadPowerW)}<small>W</small>`,
  );
  set("data-value", `${fmt(t.storedBits / 8e6, 1)}<small>MB</small>`);
  set("link-value", t.linkReady ? "교신 가능" : "교신 대기");
  set("delay-value", `${fmt(t.lightTimeS, 1)}<small>s</small>`);
  set("fuel-value", `${fmt(t.fuelKg, 2)}<small>kg</small>`);
  set(
    "eclipse-value",
    `${icon(t.eclipse ? "moon" : "sun")} ${t.eclipse ? "행성 그림자 · 발전 중단" : "태양광 수신 중"}`,
  );
  set(
    "flight-state",
    `${t.safeMode ? "안전 모드" : t.operation === "observe" ? "과학 관측 중" : t.operation === "downlink" ? "데이터 송신 중" : "태양 지향 · 충전"} · ${playing ? speed + "× 가속" : "일시정지"}`,
  );
  set("operation-reason", esc(t.reason));
  set("command-state", esc(t.commandStatus));
  set(
    "attitude-state",
    t.slewing
      ? `${getLanguage() === "ko" ? "자세 전환 중" : "Reorienting"} · ${fmt(t.slewAngleDeg, 1)}° · ${fmt(t.slewRemainingS, 1)} s`
      : getLanguage() === "ko"
        ? "자세 지향 완료"
        : "Attitude acquired",
  );
  if (t.hazardStatus)
    set(
      "hazard-live",
      `${icon("warning")} <span>${esc(t.hazardStatus)}</span><strong>${t.debrisDistanceKm === null ? "—" : fmt(t.debrisDistanceKm, 2)} km</strong>`,
    );
  const bar = (id: string, n: number) => {
    const el = $("#" + id);
    if (el) el.style.width = Math.min(100, Math.max(0, n * 100)) + "%";
  };
  bar("science-bar", t.scienceReceived / t.targetPackets);
  bar("energy-bar", t.energyWh / t.batteryWh);
  bar("data-bar", t.storedBits / t.storageBits);
  const cursor = $("#time-cursor");
  if (cursor) cursor.style.left = (sim.time / t.duration) * 100 + "%";
  set(
    "event-log",
    sim.events
      .slice(-8)
      .reverse()
      .map(
        (e) =>
          `<div class="event ${e.severity}"><time>T+ ${time(e.time)}</time>${esc(e.message)}</div>`,
      )
      .join(""),
  );
  translateDOM(ui);
  translateDOM($("#viewport"));
}
let keyboardPlacement:KeyboardPlacement|null=null;
let keyboardReturnSelector="",keyboardPreviousSelection:string|null=null;
function refreshKeyboardPlacement(){
  if(!keyboardPlacement)return;
  const validation=keyboardPlacement.validation(design),p=keyboardPlacement.candidate,en=getLanguage()==="en";
  scene.showKeyboardPlacement(p,validation.valid);
  const status=document.querySelector<HTMLElement>(".kb-status");
  if(status){status.dataset.valid=String(validation.valid);status.textContent=`${p.face.toUpperCase()} · U ${p.u.toFixed(3)} m · V ${p.v.toFixed(3)} m · ${p.rotation}° — `+(keyboardPlacement.invalidInput?(en?"Enter a finite number.":"유한한 숫자를 입력하세요."):JSON.stringify(design)!==keyboardPlacement.designIdentity?(en?"The design changed. Cancel and restart placement.":"원본 설계가 변경되었습니다. 취소 후 다시 배치하세요."):validation.valid?(en?"Valid placement. Not applied yet.":"배치 가능 · 아직 적용하지 않았습니다."):validation.reasons.map(t).join(" "));}
  const confirm=document.querySelector<HTMLButtonElement>('[data-kb-command="confirm"]');if(confirm)confirm.disabled=!validation.valid;
  if(!keyboardPlacement.invalidInput)document.querySelectorAll<HTMLInputElement|HTMLSelectElement>('[data-kb-field]').forEach(el=>{if(el!==document.activeElement)el.value=String(p[el.dataset.kbField as "u"|"v"|"rotation"|"face"]);});
}
function beginKeyboardPlacement(part:Part,returnSelector:string){
  if(mode!=="build"||sim)return;
  cancelKeyboardPlacement(false);
  keyboardPreviousSelection=selected;keyboardReturnSelector=returnSelector;
  keyboardPlacement=new KeyboardPlacement(design,part);scene.setSelected(null);
  render();refreshKeyboardPlacement();document.querySelector<HTMLButtonElement>('[data-kb-command="pad"]')?.focus();
}
function cancelKeyboardPlacement(restoreFocus=true){
  if(!keyboardPlacement)return;
  keyboardPlacement=null;scene.cancelDrag();selected=keyboardPreviousSelection;scene.setSelected(selected);render();
  if(restoreFocus){const el=document.querySelector<HTMLElement>(keyboardReturnSelector);const details=el?.closest('details');if(details)details.open=true;el?.focus();}
}
function commitPlacement(part:Part):boolean{
  const validation=evaluatePlacement(design,part);if(!validation.valid){toast(validation.reasons.join(" "),true);return false;}
  checkpoint();const existing=design.parts.find(p=>p.id===part.id);if(existing)Object.assign(existing,part);else design.parts.push(part);
  selected=part.id;designChanged();scene.setSelected(selected);beep();return true;
}
function confirmKeyboardPlacement(){
  if(!keyboardPlacement)return;
  if(!keyboardPlacement.validation(design).valid){refreshKeyboardPlacement();return;}
  const part={...keyboardPlacement.candidate};keyboardPlacement=null;scene.finishKeyboardPlacement();commitPlacement(part);
  const el=document.querySelector<HTMLElement>(`[data-keyboard-part="${CSS.escape(part.id)}"]`);const details=el?.closest('details');if(details)details.open=true;el?.focus();
}
function rotateSelected(angle = 15) {
  const p = design.parts.find((p) => p.id === selected);
  if (!p) return;
  checkpoint();
  const q = { ...p, rotation: (p.rotation + angle + 360) % 360 };
  if (!evaluatePlacement(design, q).valid) {
    toast("이 회전은 다른 부품과 간섭합니다.", true);
    return;
  }
  Object.assign(p, q);
  designChanged();
}
async function startFlight() {
  const ev = evaluateDesign(design);
  if (!ev.launchable || pending || acceptedRevision !== revision || !preview) {
    toast("설계 제한과 최신 예측을 먼저 확인해 주세요.", true);
    return;
  }
  closeModal();
  sim = createSimulation(design);
  scienceSeen = scienceEventIds(sim);
  scienceAnnouncement = null;
  resetFlightForecast();
  playing = false;
  mode = "flight";
  if (design.missionId === "earth" && !reducedMotion) {
    ui.className = "overlay cinematic";
    ui.innerHTML =
      header() +
      '<div class="cinematic-title"><small>LAUNCH SEQUENCE / AURORA-01</small>THE JOURNEY BEGINS.</div><button class="secondary" data-action="skip-launch" style="position:absolute;right:30px;bottom:30px">발사 장면 건너뛰기 →</button>';
    await scene.playLaunch();
  }
  scene.setMode("flight", !reducedMotion);
  render();
  scene.setTelemetry(getTelemetry(sim));
  scene.focusCraft();
  playing = true;
  render();
  scheduleSave();
  beep("success");
  toast("탐사선이 임무를 시작했습니다. Space 키로 멈추고 상황을 살펴보세요.");
}

async function action(name: string) {
  if(keyboardPlacement)cancelKeyboardPlacement(false);
  if (swingbyOpening || transferOpening) return;
  beep();
  switch (name) {
    case "solar-campaign":
      await openSolarCampaign();
      break;
    case "home":
      if(solarAssembly){try{localStorage.setItem(solarAssemblySlot,serializeSave(makeSave(design)));}catch{toast(getLanguage()==="ko"?"설계를 저장하지 못했습니다.":"Could not save the spacecraft.",true);return;}clearTimeout(saveTimer);saveTimer=0;solarAssembly=false;}
      playing = false;
      mode = "campus";
      scene.setMode("campus", !reducedMotion);
      render();
      break;
    case "mission-deployment":
      await openDeployment();
      break;
    case "load-deployment":
      await openDeployment(true);
      break;
    case "review-archive":
      await openReviewArchive();
      break;
    case "mission-swingby":
      await openSwingby(undefined, true);
      break;
    case "load-swingby":
      try {
        clearTimeout(saveTimer);
        if (swingbyAssembly && swingbyModel && swingbyDraft)
          await persistSwingbyAssembly(swingbyModel, structuredClone(swingbyDraft), structuredClone(design)).catch(() => {});
        else await swingbyAssemblySave.catch(() => {});
        const model = await import("./swingby");
        const saved = await model.loadSwingbyLocalText();
        if (saved) await openSwingby(saved);
        else toast(getLanguage() === "ko" ? "저장된 스윙바이 임무가 없습니다." : "No saved swingby mission.");
      } catch (error) { toast(error instanceof Error ? error.message : String(error), true); }
      break;
    case "missions":
      missionModal();
      break;
    case "load-transfer":
    case "load-transfer-hardware":
    case "load-transfer-operations":
      try {
        const model = await import("./transfer/engine");
        const saved = await model.loadTransferEngineLocalText(
          name === "load-transfer-operations"
            ? "operations"
            : name === "load-transfer-hardware"
              ? "hardware"
              : "legacy",
        );
        if (saved) await openTransfer(saved);
        else
          toast(
            getLanguage() === "ko"
              ? "저장된 전이 임무가 없습니다."
              : "No saved transfer mission.",
          );
      } catch (error) {
        toast(String(error), true);
      }
      break;
    case "mission-operations":
      try {
        const { createOperationsLesson } = await import("./transfer/engine");
        await openTransfer(undefined, createOperationsLesson());
      } catch (error) {
        toast(error instanceof Error ? error.message : String(error), true);
      }
      break;
    case "mission-transfer":
      startMission("mars", "balanced", hardwareMission);
      clearTimeout(saveTimer);
      transferAssembly = true;
      if (hardwareMission) {
        design = createHardwareTransferDesign("balanced");
        scene.setDesign(design);
        scene.setSelected(selected);
        revision++;
        requestPreview();
      }
      design.name = "PATHFINDER-01";
      render();
      break;
    case "build":
      setMode("build");
      break;
    case "plan":
      if (solarAssembly) {await openSolarCampaign();break;}
      if (swingbyAssembly) await openSwingby();
      else if (transferAssembly) await openTransfer();
      else setMode("plan");
      break;
    case "flight":
      if (solarAssembly) {await openSolarCampaign();break;}
      if (swingbyAssembly) { await openSwingby(); break; }
      if (transferAssembly) {
        await openTransfer();
        break;
      }
      if (sim) {
        mode = "flight";
        scene.setMode("flight", !reducedMotion);
        render();
      } else toast("비행 설계에서 계획을 검토한 후 임무를 시작하세요.");
      break;
    case "language":
      setLanguage(getLanguage() === "ko" ? "en" : "ko");
      document.documentElement.lang = getLanguage();
      document.body.dataset.language = getLanguage();
      try {
        localStorage.setItem("orbital-language", getLanguage());
      } catch {}
      render();
      translateDOM($("#modal-root"));
      scene.setTrajectory(trajectory(design, 400));
      break;
    case "inspect-power":
    case "inspect-camera":
    case "inspect-antenna":
      scene.setStowOpen(false);
      scene.setInspection(name.slice(8) as "power" | "camera" | "antenna");
      render();
      break;
    case "inspect-off":
      scene.setInspection(null);
      render();
      break;
    case "toggle-hazard":
      if (!sim) {
        checkpoint();
        design.hazard = design.hazard === "debris" ? "none" : "debris";
        designChanged(false);
      }
      break;
    case "target-precision":
    case "target-survey":
      targetProfile = name.slice(7) as ScienceProfile;
      scene.targetPicking = true;
      render();
      break;
    case "target-clear":
      if (!sim) {
        checkpoint();
        delete design.scienceTarget;
        targetProfile = null;
        scene.targetPicking = false;
        designChanged(false);
      }
      break;
    case "stow":
      scene.setStowOpen(!scene.stowOpen);
      render();
      break;
    case "launch-packages":
      launchPackagesModal();
      break;
    case "guide-face": {
      const step = nextAssemblyStep();
      if (step) scene.viewMount(step.face as Part["face"]);
      break;
    }
    case "duplicate": {
      const part = design.parts.find((p) => p.id === selected);
      if (part && !sim) {
        scene.beginDuplicate(part);
        toast(
          getLanguage() === "ko"
            ? "마우스로 복제 부품을 옮긴 뒤 클릭하여 놓으세요. Escape로 취소합니다."
            : "Move the duplicate, then click to place. Escape cancels.",
        );
      }
      break;
    }
    case "bay":
      scene.setStowOpen(false);
      scene.setBayOpen(!scene.bayOpen);
      render();
      break;
    case "resources":
      showResources = !showResources;
      render();
      break;
    case "briefing":
      briefingModal();
      break;
    case "help":
      helpModal();
      break;
    case "component-source":
      if (design.hardwareVersion) {
        const part = design.parts.find((p) => p.id === selected);
        if (part) hardwareSourceModal(part);
        break;
      }
      modal(
        "실제 부품과 설계 근거",
        "HARDWARE SOURCES",
        componentSourceHTML(design.parts.find((p) => p.id === selected)?.kind),
      );
      break;
    case "hardware-buses":
      hardwareBusModal();
      break;
    case "hardware-connections":
      hardwareConnectionsModal();
      break;
    case "review-clear":
      reviewContext = null;
      render();
      break;
    case "settings":
      settingsModal();
      break;
    case "science":
      void scienceModal();
      break;
    case "advanced":
      advancedModal();
      break;
    case "close-modal":
      closeModal();
      render();
      break;
    case "add-node":
      if (!sim) {
        addNodeArmed = true;
        toast("궤도의 원하는 위치를 클릭해 새 기동점을 추가하세요.");
        render();
      }
      break;
    case "delete-node":
      if (!sim) {
        checkpoint();
        scene.freezeReferencePath();
        design.plan.maneuvers = getManeuvers(design.plan).filter(
          (n) => n.id !== scene.selectedManeuverId,
        );
        scene.selectedManeuverId = design.plan.maneuvers[0]?.id || "";
        designChanged(false);
      }
      break;
    case "camera-reset":
      scene.resetCamera();
      render();
      break;
    case "camera-focus":
      if (mode === "build" && selected) scene.focusSelectedPart();
      else scene.focusCraft();
      render();
      break;
    case "selected-part-focus":
      scene.focusSelectedPart();
      break;
    case "view-front":
      scene.viewAxis("front");
      render();
      break;
    case "view-top":
      scene.viewAxis("top");
      render();
      break;
    case "view-side":
      scene.viewAxis("side");
      render();
      break;
    case "rotate":
      rotateSelected();
      break;
    case "delete":
      if (selected && !sim) {
        checkpoint();
        design.parts = design.parts.filter((p) => p.id !== selected);
        selected = null;
        scene.setSelected(null);
        designChanged();
      }
      break;
    case "undo":
      if (history.length && !sim) {
        future.push(structuredClone({ design, transferPlan: transferDraft }));
        const snapshot = history.pop()!;
        design = snapshot.design;
        transferDraft = snapshot.transferPlan;
        selected = null;
        designChanged();
      }
      break;
    case "redo":
      if (future.length && !sim) {
        history.push(structuredClone({ design, transferPlan: transferDraft }));
        const snapshot = future.pop()!;
        design = snapshot.design;
        transferDraft = snapshot.transferPlan;
        selected = null;
        designChanged();
      }
      break;
    case "preset-balanced":
    case "preset-science":
      if (!sim) {
        checkpoint();
        const prior = design;
        const preset = name === "preset-science" ? "science" : "balanced";
        design = prior.hardwareVersion
          ? transferAssembly || swingbyAssembly
            ? createHardwareTransferDesign(preset)
            : createHardwareDesign(prior.missionId, preset)
          : createDesign(prior.missionId, preset);
        design.hazard = prior.hazard;
        design.scienceTarget = prior.scienceTarget;
        design.launchPackageId = prior.launchPackageId;
        if (transferAssembly) {
          const model = await import("./transfer");
          transferDraft = design.hardwareVersion
            ? model.createHardwareTransferPlan(preset)
            : model.createTransferPlan(preset);
        }
        selected = null;
        designChanged();
        toast(
          "검증용 예시 설계를 불러왔습니다. 장비와 일정을 자유롭게 바꿔보세요.",
        );
      }
      break;
    case "preset-region-precision":
    case "preset-region-survey":
      if (!sim && design.hardwareVersion && design.missionId === "earth") {
        checkpoint();
        design = createHardwareRegionDesign(
          name.endsWith("precision") ? "precision" : "survey",
        );
        selected = null;
        targetProfile = null;
        scene.targetPicking = false;
        designChanged();
        toast(
          getLanguage() === "ko"
            ? "기체·관측 지역·일정을 함께 불러왔습니다. 직접 수정하거나 되돌리기로 복원할 수 있습니다."
            : "Spacecraft, region and schedule loaded. Edit them directly or use Undo to restore your design.",
        );
      }
      break;
    case "schedule-preset":
      if (!sim) {
        checkpoint();
        design.plan.operations = (
          design.hardwareVersion
            ? createHardwareDesign(design.missionId, "balanced")
            : createDesign(design.missionId, "balanced")
        ).plan.operations;
        designChanged(false);
      }
      break;
    case "skip-launch":
      scene.skipLaunch();
      break;
    case "launch":
      await startFlight();
      break;
    case "command-charge":
    case "command-observe":
    case "command-downlink":
    case "command-resume":
      if (sim && sim.status === "running") {
        const command = queueCommand(
          sim,
          name.slice(8) as "charge" | "observe" | "downlink" | "resume",
          600,
        );
        toast(
          "지상 명령이 등록되었습니다. 교신과 전파 지연 뒤 탐사선에 도착합니다.",
        );
        scheduleSave();
        requestFlightForecast(true);
        updateTelemetry();
      }
      break;
    case "advisor-details":
      advisorExpanded = !advisorExpanded;
      $("#flight-advisor").innerHTML = flightAdvisorHTML();
      break;
    case "advisor-charge":
      await action("command-charge");
      break;
    case "control-room":
      if (scene.controlRoomActive) {
        scene.leaveControlRoom();
        render();
      } else {
        toast(
          getLanguage() === "ko"
            ? "3D 관제실을 준비하고 있습니다."
            : "Preparing the 3D control room.",
        );
        try {
          await scene.enterControlRoom();
          render();
        } catch {
          scene.leaveControlRoom();
          toast(
            getLanguage() === "ko"
              ? "관제실을 불러오지 못했습니다. 다시 시도해 주세요."
              : "Could not load the control room. Please retry.",
            true,
          );
        }
      }
      break;
    case "warp-event":
      if (
        sim &&
        flightForecast?.nextEvent &&
        flightForecast.nextEvent.time > sim.time
      ) {
        const eventTime = flightForecast.nextEvent.time;
        stopAtTime = eventTime - sim.time > 35 ? eventTime - 30 : eventTime;
        speed = 600;
        playing = true;
        render();
      }
      break;
    case "play-pause":
      if (sim && sim.status === "running") {
        playing = !playing;
        render();
      }
      break;
    case "finish":
      showResult();
      break;
    case "retry":
      if (sim) {
        previousResult = getResult(sim);
        design = structuredClone(sim.design);
        sim = null;
        playing = false;
        history = [];
        future = [];
        selected = null;
        mode = "build";
        scene.setDesign(design);
        scene.setSelected(selected);
        scene.setMode("build", !reducedMotion);
        closeModal();
        designChanged();
      }
      break;
    case "save":
      try {
        if(solarAssembly){clearTimeout(saveTimer);saveTimer=0;localStorage.setItem(solarAssemblySlot,serializeSave(makeSave(design)));toast(getLanguage()==="ko"?"탐사선 설계를 저장했습니다.":"Spacecraft design saved.");break;}
        if (swingbyAssembly && swingbyModel && swingbyDraft) {
          const model = swingbyModel, craft = structuredClone(design), plan = structuredClone(swingbyDraft);
          clearTimeout(saveTimer);
          await persistSwingbyAssembly(model, plan, craft);
          toast(getLanguage() === "ko" ? "스윙바이 기체와 조준·작업 계획을 별도 슬롯에 저장했습니다." : "Swingby craft, aim and schedule saved to their separate slot.");
          break;
        }
        if (transferAssembly) {
          const model = await import("./transfer");
          await model.saveTransferLocal(
            model.makeTransferSave(
              transferDraft ??
                (design.hardwareVersion
                  ? model.createHardwareTransferPlan()
                  : model.createTransferPlan()),
              design,
            ),
          );
          toast(
            getLanguage() === "ko"
              ? "전이 임무의 기체 설계를 저장했습니다."
              : "Transfer spacecraft saved.",
          );
          break;
        }
        await saveLocal(makeSave(design, sim ?? undefined, previousResult));
        if (design.hardwareVersion) savedHardwareAvailable = true;
        else savedAvailable = true;
        toast("설계와 임무 상태를 이 브라우저에 저장했습니다.");
      } catch {
        toast(
          "저장 공간에 접근할 수 없습니다. 설정에서 JSON 백업을 내려받으세요.",
          true,
        );
      }
      break;
    case "load":
    case "load-hardware":
      try {
        const data = await loadLocal(
          name === "load-hardware" ? "hardware" : "legacy",
        );
        if (data) {
          restore(data);
          toast(data.migrationNotice || "저장된 임무를 불러왔습니다.");
        } else toast("아직 저장된 임무가 없습니다.");
      } catch (e) {
        toast(
          e instanceof Error ? e.message : "저장 내용을 읽지 못했습니다.",
          true,
        );
      }
      break;
    case "export": {
      playing = false;
      const swingbyExport = swingbyAssembly && swingbyModel && swingbyDraft
        ? swingbyModel.serializeSwingbySave(swingbyModel.makeSwingbySave(structuredClone(swingbyDraft), structuredClone(design),undefined,swingbyNumerics))
        : null;
      const exportedName = swingbyExport ? "orbital-foundry-swingby.json" : transferAssembly ? "orbital-foundry-earth-mars.json" : `orbital-foundry-${design.missionId}.json`;
      const transferModel = !swingbyExport && transferAssembly
        ? await import("./transfer")
        : null;
      const data = swingbyExport ?? (transferModel
        ? transferModel.serializeTransferSave(
            transferModel.makeTransferSave(
              transferDraft ??
                (design.hardwareVersion
                  ? transferModel.createHardwareTransferPlan()
                  : transferModel.createTransferPlan()),
              design,
            ),
          )
        : serializeSave(makeSave(design, sim ?? undefined, previousResult)));
      const url = URL.createObjectURL(
          new Blob([data], { type: "application/json" }),
        ),
        a = document.createElement("a");
      a.href = url;
      a.download = exportedName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast("JSON 백업을 내려받았습니다.");
      break;
    }
    case "import":
      $("#import-file").click();
      break;
    case "sound":
      sound = !sound;
      settingsModal();
      break;
  }
}
function restore(data: SaveFile) {
  clearSwingbyAssembly();
  activeDebrief = null;
  reviewContext = null;
  transferAssembly = false;
  transferDraft = undefined;
  design = data.design;
  sim = data.simulation ?? null;
  scienceSeen = sim ? scienceEventIds(sim) : null;
  scienceAnnouncement = null;
  resetFlightForecast();
  previousResult = data.previousResult;
  playing = false;
  history = [];
  future = [];
  selected = null;
  preview = null;
  revision++;
  pending = true;
  mode = sim ? "flight" : "build";
  scene.setDesign(design);
  scene.setSelected(selected);
  scene.setMode(mode, !reducedMotion);
  requestPreview();
  closeModal();
  render();
}
document.addEventListener("click", (e) => {
  const target = e.target as HTMLElement;
  const kb=target.closest<HTMLElement>('[data-kb-command]');
  if(kb){if(kb.dataset.kbCommand==="confirm")confirmKeyboardPlacement();else if(kb.dataset.kbCommand==="cancel")cancelKeyboardPlacement();return;}
  const installed=target.closest<HTMLElement>('[data-keyboard-part]');
  if(installed){const p=design.parts.find(p=>p.id===installed.dataset.keyboardPart);if(p)beginKeyboardPlacement(p,`[data-keyboard-part="${CSS.escape(p.id)}"]`);return;}
  const debriefAction = target.closest<HTMLElement>("[data-debrief-action]");
  if (debriefAction && activeDebrief) {
    const [i, j] = debriefAction.dataset.debriefAction!.split(":").map(Number),
      diagnostic = activeDebrief.diagnostics[i],
      step = diagnostic?.actions[j];
    if (step)
      void followDebriefTarget(step.target, diagnostic.title[getLanguage()]);
    return;
  }
  const debriefChange = target.closest<HTMLElement>("[data-debrief-change]");
  if (debriefChange && activeDebrief) {
    const change =
      activeDebrief.comparison.designChanges[
        Number(debriefChange.dataset.debriefChange)
      ];
    if (change?.target)
      void followDebriefTarget(
        change.target,
        getLanguage() === "ko"
          ? "이전 시도에서 변경한 지점"
          : "Changed since the previous attempt",
      );
    return;
  }
  const hardwareBus = target.closest<HTMLElement>("[data-hardware-bus]");
  if (hardwareBus && !sim && design.hardwareVersion) {
    const id = hardwareBus.dataset.hardwareBus!;
    if (BUSES[id]) {
      checkpoint();
      design.busId = id as BusId;
      selected = null;
      scene.setSelected(null);
      closeModal();
      designChanged();
    }
    return;
  }
  const hardwareFocus = target.closest<HTMLElement>("[data-hardware-focus]");
  if (hardwareFocus && !sim) {
    const part = design.parts.find(
      (p) => p.id === hardwareFocus.dataset.hardwareFocus,
    );
    if (part) {
      selected = part.id;
      scene.setSelected(selected);
      scene.setBayOpen(Boolean(getPartDefinition(design, part).internal));
      scene.viewMount(part.face);
      closeModal();
      render();
    }
    return;
  }
  const hardwareRadio = target.closest<HTMLElement>("[data-hardware-radio]");
  if (hardwareRadio && !sim && design.hardwareVersion) {
    const part = design.parts.find(
      (p) => p.id === hardwareRadio.dataset.hardwareRadio && p.kind === "radio",
    );
    if (part) {
      checkpoint();
      design.activeRadioId = part.id;
      designChanged(false);
    }
    return;
  }
  const profile = target.closest<HTMLElement>("[data-design-profile]");
  if (profile) {
    hardwareMission = profile.dataset.designProfile === "hardware";
    missionModal();
    return;
  }
  const a = target.closest<HTMLElement>("[data-action]");
  if (a) {
    void action(a.dataset.action!);
    return;
  }
  const mission = target.closest<HTMLElement>("[data-mission]");
  if (mission) {
    startMission(
      mission.dataset.mission as MissionId,
      "starter",
      hardwareMission,
    );
    return;
  }
  const pkg = target.closest<HTMLElement>("[data-package]");
  if (pkg && !sim) {
    checkpoint();
    design.launchPackageId = pkg.dataset.package as LaunchPackageId;
    closeModal();
    designChanged();
    return;
  }
  const cat = target.closest<HTMLElement>("[data-category]");
  if (cat) {
    category = cat.dataset.category!;
    render();
    return;
  }
  const face = target.closest<HTMLElement>("[data-face]");
  if (face && !sim) {
    const p = design.parts.find((p) => p.id === selected);
    if (p) {
      const next = {
        ...p,
        face: face.dataset.face as Part["face"],
        u: 0,
        v: 0,
      };
      const validation = evaluatePlacement(design, next);
      if (validation.valid) {
        checkpoint();
        Object.assign(p, next);
        designChanged();
      } else toast(validation.reasons.join(" "), true);
    }
    return;
  }
  const node = target.closest<HTMLElement>("[data-node]");
  if (node) {
    scene.selectedManeuverId = node.dataset.node!;
    scene.setTrajectory(trajectory(design, 400));
    render();
    return;
  }
  const sp = target.closest<HTMLElement>("[data-speed]");
  if (sp) {
    speed = Number(sp.dataset.speed);
    render();
  }
});
document.addEventListener("input", (e) => {
  const el = e.target as HTMLInputElement;
  if(el.dataset.kbField&&keyboardPlacement){
    if(el.dataset.kbField==="face")keyboardPlacement.update({face:el.value as Part['face']});
    else if(!el.value.trim()||!Number.isFinite(el.valueAsNumber))keyboardPlacement.invalidInput=true;
    else keyboardPlacement.update({[el.dataset.kbField]:el.valueAsNumber});
    if(Array.from(document.querySelectorAll<HTMLInputElement>('.keyboard-placement input')).some(input=>!input.value.trim()||!Number.isFinite(input.valueAsNumber)))keyboardPlacement.invalidInput=true;
    refreshKeyboardPlacement();return;
  }
  if(el.dataset.earthApsis&&!sim){
    const which=el.dataset.earthApsis as 'periapsis'|'apoapsis',value=el.valueAsNumber,orbit=initialEarthOrbit(design.plan);
    if(!Number.isFinite(value))return;
    const next=updateEarthApsis(design.plan,which,Math.max(which==='periapsis'?180:orbit.periapsisAltitudeKm,Math.min(which==='periapsis'?orbit.apoapsisAltitudeKm:2000,value)));
    if(!navUndo){checkpoint();scene.freezeReferencePath();navUndo=true;}
    design.plan=next;el.nextElementSibling!.textContent=fmt(value,1);
    const opposite=document.querySelector<HTMLInputElement>(`[data-earth-apsis="${which==='periapsis'?'apoapsis':'periapsis'}"]`);
    if(opposite){if(which==='periapsis')opposite.min=String(next.altitudeKm);else opposite.max=String(next.earthOrbit!.apoapsisAltitudeKm);}
    revision++;pending=true;scene.setTrajectory(trajectory(design,240));requestPreview();scheduleSave();updateOrbitReadouts();return;
  }
  if (el.id === "rotation") {
    const p = design.parts.find((p) => p.id === selected);
    if (p && !sim) {
      if (!navUndo) {
        checkpoint();
        navUndo = true;
      }
      const next = { ...p, rotation: Number(el.value) };
      if (evaluatePlacement(design, next).valid) {
        p.rotation = next.rotation;
        scene.setDesign(design);
        scene.setSelected(selected);
        el.nextElementSibling!.textContent = p.rotation + "°";
        revision++;
        pending = true;
        requestPreview();
        scheduleSave();
      }
    }
  } else if (el.dataset.burn && !sim) {
    if (!navUndo) {
      checkpoint();
      scene.freezeReferencePath();
      navUndo = true;
    }
    design.plan.maneuvers ??= getManeuvers(design.plan);
    const n =
      design.plan.maneuvers.find((n) => n.id === scene.selectedManeuverId) ||
      design.plan.maneuvers[0];
    if (n) {
      (n as unknown as Record<string, number>)[el.dataset.burn] = Number(
        el.value,
      );
      el.nextElementSibling!.textContent = el.value;
      revision++;
      pending = true;
      requestPreview();
      scheduleSave();
    }
  } else if (el.dataset.plan && !sim) {
    if (!navUndo) {
      checkpoint();
      scene.freezeReferencePath();
      navUndo = true;
    }
    (design.plan as unknown as Record<string, number>)[el.dataset.plan] =
      Number(el.value);
    el.nextElementSibling!.textContent = el.value;
    revision++;
    pending = true;
    requestPreview();
    scheduleSave();
  }
});
document.addEventListener("change", (e) => {
  navUndo = false;
  const el = e.target as HTMLInputElement;
  if (el.id === "quality")
    scene.setQuality(el.value as "high" | "medium" | "low");
  if (el.id === "ui-scale")
    document.body.classList.toggle("large-ui", el.value === "large");
  if (el.id === "motion") {
    reducedMotion = el.value === "reduced";
    scene.controls.enableDamping = !reducedMotion;
    document.body.classList.toggle("reduced-motion", reducedMotion);
  }
  if (el.id === "import-file" && el.files?.[0]) {
    if (el.files[0].size > 8388608) {
      toast(
        getLanguage() === "ko"
          ? "파일이 8 MiB 한도를 초과합니다."
          : "File exceeds the 8 MiB limit.",
        true,
      );
      el.value = "";
      return;
    }
    void el.files[0].text().then(async (text) => {
      try {
        let importedFormat: unknown;
        try {
          importedFormat = JSON.parse(text)?.format;
        } catch {
          /* The selected parser supplies the localized validation error. */
        }
        if (importedFormat === "orbital-foundry-swingby") {
          await openSwingby(text);
          return;
        }
        if (importedFormat === "orbital-foundry-journey") {
          await openTransfer(text);
          return;
        }
        if (text.length > 2e6)
          throw new Error("파일이 2 MB 한도를 초과합니다.");
        const data = parseSave(text);
        restore(data);
        toast(data.migrationNotice || "백업을 검증하고 불러왔습니다.");
      } catch (error) {
        toast(
          error instanceof Error ? error.message : "유효하지 않은 파일입니다.",
          true,
        );
      }
    });
    el.value = "";
  }
});
document.addEventListener("keydown", (e) => {
  if (solarExperience || solarOpening || deploymentExperience || deploymentOpening || archiveReview || archiveReviewOpening || swingbyExperience || swingbyOpening || transferOpening) return;
  if (transferExperience) {
    if (
      e.key === " " &&
      !(e.target as HTMLElement).matches("input,select,textarea")
    ) {
      e.preventDefault();
      document
        .querySelector<HTMLButtonElement>('[data-transfer-action="play"]')
        ?.click();
    }
    return;
  }
  const dialog = $("#modal-root").querySelector<HTMLElement>('[role="dialog"]');
  if (dialog) {
    if (e.key === "Escape") {
      e.preventDefault();
      scene.cancelDrag();
      closeModal();
      return;
    }
    if (e.key === "Tab") {
      const controls = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]',
        ),
      ).filter((el) => el.getClientRects().length > 0);
      const first = controls[0],
        last = controls.at(-1);
      if (first && last) {
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            !dialog.contains(document.activeElement))
        ) {
          e.preventDefault();
          last.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last ||
            !dialog.contains(document.activeElement))
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    return;
  }
  const keyTarget=e.target as HTMLElement,card=keyTarget.closest<HTMLElement>('[data-part]');
  if(card&&mode==="build"&&!sim&&(e.key==="Enter"||e.key===" ")){
    e.preventDefault();if(e.repeat)return;
    const kind=card.dataset.part as PartKind,modelId=card.dataset.model;
    const part:Part={id:crypto.randomUUID(),kind,face:kind==="engine"?"ny":kind==="solar"||kind==="solarLarge"?"px":kind==="camera"||kind==="spectrometer"?"nz":"pz",u:0,v:0,rotation:0,...(modelId?{modelId}:{})};
    if(getPartDefinition(design,part).internal)part.face="py";
    beginKeyboardPlacement(part,modelId?`[data-model="${CSS.escape(modelId)}"]`:`[data-part="${kind}"]`);return;
  }
  if(keyboardPlacement){
    if(e.key==="Escape"){e.preventDefault();cancelKeyboardPlacement();return;}
    if(keyTarget.matches("input,select,textarea"))return;
    if(e.key==="Enter"&&keyTarget.dataset.kbCommand==="pad"){e.preventDefault();confirmKeyboardPlacement();return;}
    if(!e.ctrlKey&&!e.altKey&&!e.metaKey&&keyTarget.closest('.keyboard-placement')&&keyboardPlacement.key(e.key,e.shiftKey)){e.preventDefault();refreshKeyboardPlacement();}
    return;
  }
  if (keyTarget.matches("input,select,textarea")) return;
  if (e.key === "Escape") {
    targetProfile = null;
    scene.targetPicking = false;
    scene.cancelDrag();
    closeModal();
    return;
  }
  if ($("#modal-root").children.length) return;
  if (e.key === " ") {
    if(keyTarget.closest('button,a,summary'))return;
    e.preventDefault();
    void action("play-pause");
  }
  if (e.key.toLowerCase() === "f") {
    if (mode === "build" && selected) scene.focusSelectedPart();
    else scene.focusCraft();
    render();
  }
  if(mode==='plan'&&!sim&&(e.ctrlKey||e.metaKey)&&['z','y'].includes(e.key.toLowerCase())){
    e.preventDefault();
    if(orbitEdit){scene.cancelDrag();return;}
    void action(e.key.toLowerCase()==='y'||e.shiftKey?'redo':'undo');return;
  }
  if (mode === "build" && !sim) {
    if (e.key.toLowerCase() === "r") rotateSelected();
    if (e.ctrlKey && e.key.toLowerCase() === "d") {
      e.preventDefault();
      void action("duplicate");
    }
    if (e.key === "Delete") void action("delete");
    if (e.ctrlKey && e.key.toLowerCase() === "z") {
      e.preventDefault();
      void action(e.shiftKey ? "redo" : "undo");
    }
    if (e.ctrlKey && e.key.toLowerCase() === "y") {
      e.preventDefault();
      void action("redo");
    }
  }
});
document.addEventListener("pointerdown", (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>("[data-part]");
  if (el && e.button === 0 && mode === "build") {
    cancelKeyboardPlacement(false);
    e.preventDefault();
    scene.beginNewPart(
      el.dataset.part as PartKind,
      e.clientX,
      e.clientY,
      el.dataset.model,
    );
  }
});

let opDrag: {
  id: string | null;
  kind: OperationKind;
  startX: number;
  originalStart: number;
  duration: number;
  resize: boolean;
  new: boolean;
  currentX: number;
} | null = null;
document.addEventListener("pointerdown", (e) => {
  if (mode !== "plan" || e.button !== 0) return;
  const target = e.target as HTMLElement,
    op = target.closest<HTMLElement>("[data-op]"),
    fresh = target.closest<HTMLElement>("[data-op-new]");
  if (op) {
    const o = design.plan.operations.find((x) => x.id === op.dataset.op)!;
    opDrag = {
      id: o.id,
      kind: o.kind,
      startX: e.clientX,
      originalStart: o.start,
      duration: o.end - o.start,
      resize: target.classList.contains("resize-handle"),
      new: false,
      currentX: e.clientX,
    };
    e.preventDefault();
  } else if (fresh) {
    opDrag = {
      id: null,
      kind: fresh.dataset.opNew as OperationKind,
      startX: e.clientX,
      originalStart: 0,
      duration: 900,
      resize: false,
      new: true,
      currentX: e.clientX,
    };
    e.preventDefault();
  } else if (target.id === "timeline") {
    const r = target.getBoundingClientRect();
    previewTime = ((e.clientX - r.left) / r.width) * missionFor().duration;
    updatePreviewTelemetry();
    const c = $("#time-cursor");
    if (c) c.style.left = ((e.clientX - r.left) / r.width) * 100 + "%";
  }
});
window.addEventListener("pointermove", (e) => {
  if (!opDrag) return;
  opDrag.currentX = e.clientX;
  const track = $("#timeline");
  if (!track) return;
  const r = track.getBoundingClientRect(),
    duration = missionFor().duration,
    o = opDrag;
  if (o.id) {
    const el = $(`[data-op="${o.id}"]`);
    if (el) {
      const diff = ((e.clientX - o.startX) / r.width) * duration;
      const start = o.resize
          ? o.originalStart
          : Math.max(
              0,
              Math.min(duration - o.duration, o.originalStart + diff),
            ),
        len = o.resize
          ? Math.max(60, Math.min(duration - start, o.duration + diff))
          : o.duration;
      el.style.left = (start / duration) * 100 + "%";
      el.style.width = (len / duration) * 100 + "%";
    }
  }
});
window.addEventListener("pointerup", (e) => {
  if (!opDrag) return;
  const o = opDrag;
  opDrag = null;
  const track = $("#timeline");
  if (!track) return;
  const r = track.getBoundingClientRect(),
    duration = missionFor().duration;
  if (o.new && (e.clientY < r.top - 20 || e.clientY > r.bottom + 20)) return;
  checkpoint();
  if (o.new) {
    const start =
      Math.round(
        Math.max(
          0,
          Math.min(
            duration - o.duration,
            ((e.clientX - r.left) / r.width) * duration,
          ),
        ) / 30,
      ) * 30;
    design.plan.operations.push({
      id: `op-${Date.now()}-${lastOperationId++}`,
      kind: o.kind,
      start,
      end: start + o.duration,
    });
  } else {
    const op = design.plan.operations.find((p) => p.id === o.id)!;
    const diff =
      Math.round((((e.clientX - o.startX) / r.width) * duration) / 30) * 30;
    if (o.resize)
      op.end = Math.max(
        op.start + 60,
        Math.min(duration, op.start + o.duration + diff),
      );
    else {
      op.start = Math.max(
        0,
        Math.min(duration - o.duration, o.originalStart + diff),
      );
      op.end = op.start + o.duration;
    }
  }
  designChanged(false);
});
document.addEventListener("contextmenu", (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>("[data-op]");
  if (el && mode === "plan") {
    e.preventDefault();
    checkpoint();
    design.plan.operations = design.plan.operations.filter(
      (o) => o.id !== el.dataset.op,
    );
    designChanged(false);
  }
});
function scrubResource(x: number) {
  const graph = $("#resource-graph");
  if (!graph) return;
  const r = graph.getBoundingClientRect();
  previewTime =
    Math.max(0, Math.min(1, (x - r.left) / r.width)) * missionFor().duration;
  updatePreviewTelemetry();
  const chart = $(".resource-chart");
  if (chart) chart.outerHTML = resourceGraph(preview, previewTime);
  const cursor = $("#time-cursor");
  if (cursor)
    cursor.style.left = (previewTime / missionFor().duration) * 100 + "%";
}
document.addEventListener("pointerdown", (e) => {
  if (
    mode === "plan" &&
    (e.target as Element).closest("#resource-graph") &&
    e.button === 0
  ) {
    resourceScrubbing = true;
    scrubResource(e.clientX);
    e.preventDefault();
  }
});
window.addEventListener("pointermove", (e) => {
  if (resourceScrubbing) scrubResource(e.clientX);
});
window.addEventListener("pointerup", () => {
  resourceScrubbing = false;
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && playing) {
    playing = false;
    scheduleSave();
    render();
    toast("다른 탭으로 이동해 임무를 일시정지했습니다.");
  }
});
window.addEventListener("offline", () => {
  toast("연결이 끊겼지만 로드한 임무는 이 브라우저에서 계속 실행됩니다.");
  render();
});
window.addEventListener("online", () => render());

async function boot() {
  try {
    scene = new GameScene($("#viewport"), {
      select: (id) => {
        selected = id;
        scene.setSelected(id);
        if (
          design.parts.some(
            (p) => p.id === id && getPartDefinition(design, p).internal,
          )
        )
          scene.setBayOpen(true);
        if (mode === "build") {
          scene.setInspection(null);
          render();
        }
      },
      placement: (part, commit) => {
        const result = evaluatePlacement(design, part);
        if (commit) {
          return commitPlacement(part);
        } else {
          const el = $(".control-hint");
          if (el)
            el.innerHTML = `<span style="color:${result.valid ? "#9df0d2" : "#ffb19a"}">${result.valid ? "놓아서 장착" : esc(result.reasons[0] || "장착할 수 없는 위치")}</span>`;
        }
        return result.valid;
      },
      cancelNavigation:()=>cancelOrbitEdit(),
      navigationIssue:()=>toast(getLanguage()==='ko'?'이 방향에서는 손잡이의 움직임을 구분하기 어렵습니다. 오른쪽 드래그로 시점을 돌린 뒤 다시 잡으세요.':'This handle is viewed end-on. Orbit the camera with a right drag, then try again.'),
      navigation: (handle, dx, dy, finish) => {
        if (handle === "inspection-sun") {
          if (!finish) {
            scene.dragInspectionSun(dx, dy);
            const readout = $("#inspection-readout");
            if (readout && scene.inspectionSummary) {
              readout.innerHTML =
                esc(scene.inspectionSummary.detail) +
                " <strong>" +
                fmt(scene.inspectionSummary.value, 1) +
                " " +
                scene.inspectionSummary.unit +
                "</strong><small>노란 태양 손잡이를 드래그해 입사각을 바꾸세요.</small>";
              translateDOM(readout);
            }
          }
          return;
        }
        if (sim) return;
        if (finish) {
          orbitEdit=null;
          navUndo = false;
          designChanged(handle === "rotate");
          return;
        }
        if (!navUndo) {
          if(isOrbitShapeHandle(handle)){orbitEdit={design:structuredClone(design),history:history.slice(),future:future.slice()};clearTimeout(saveTimer);saveTimer=0;}
          checkpoint();
          scene.freezeReferencePath();
          navUndo = true;
        }
        if (handle === "rotate") {
          const p = design.parts.find((p) => p.id === selected);
          if (p) {
            const next = {
              ...p,
              rotation: (p.rotation + dx * 0.6 + 360) % 360,
            };
            const validation = evaluatePlacement(design, next);
            if (validation.valid) {
              p.rotation = next.rotation;
              scene.setDesign(design);
              scene.setSelected(selected);
            } else {
              toast(validation.reasons[0], true);
            }
          }
          return;
        }
        const p = design.plan;
        const node = p.maneuvers?.find(
          (n) => n.id === scene.selectedManeuverId,
        );
        const burn = node || p;
        const clamp = (v: number, min: number, max: number) =>
          Math.max(min, Math.min(max, v));
        if(handle==='earth-periapsis'||handle==='earth-apoapsis'){
          const orbit=initialEarthOrbit(p),peri=handle==='earth-periapsis',value=clamp((peri?orbit.periapsisAltitudeKm:orbit.apoapsisAltitudeKm)+dx,peri?180:orbit.periapsisAltitudeKm,peri?orbit.apoapsisAltitudeKm:2000);
          design.plan=updateEarthApsis(p,peri?'periapsis':'apoapsis',value);
        }
        if(handle==='earth-plane')p.inclinationDeg=clamp(p.inclinationDeg+dx,0,180);
        if (handle === "altitude")
          p.altitudeKm = clamp(p.altitudeKm - dy * 5 + dx, 250, 1500);
        if (handle === "inclination")
          p.inclinationDeg = clamp(
            p.inclinationDeg + dx * 0.2 - dy * 0.3,
            0,
            100,
          );
        if (handle === "prograde")
          burn.progradeMps = clamp(
            burn.progradeMps + dx * 0.5 - dy * 0.5,
            -120,
            180,
          );
        if (handle === "radial")
          burn.radialMps = clamp(
            burn.radialMps + dx * 0.3 - dy * 0.4,
            -120,
            120,
          );
        if (handle === "normal")
          burn.normalMps = clamp(
            burn.normalMps + dx * 0.3 - dy * 0.4,
            -120,
            120,
          );
        if (handle === "bplane") {
          p.periapsisAltitudeKm = clamp(
            p.periapsisAltitudeKm - dy * 10,
            250,
            6000,
          );
          p.bPlaneAngleDeg = clamp(p.bPlaneAngleDeg + dx * 0.5, -150, 150);
        }
        revision++;
        pending = true;
        scene.setTrajectory(trajectory(design, 240));
        requestPreview();
        if(isOrbitShapeHandle(handle))updateOrbitReadouts();
      },
      target: (latDeg, lonDeg) => {
        if (sim || !targetProfile) return;
        checkpoint();
        design.scienceTarget = normalizeScienceTarget({
          profile: targetProfile,
          latDeg,
          lonDeg,
        });
        targetProfile = null;
        scene.targetPicking = false;
        designChanged(false);
        toast(
          getLanguage() === "ko"
            ? "선택한 지역의 실제 관측 조건을 다시 계산합니다."
            : "Recomputing science access for the selected region.",
        );
      },
      node: (id) => {
        scene.selectedManeuverId = id;
        scene.setTrajectory(trajectory(design, 400));
        render();
      },
      burnAt: (t) => {
        if (sim) return;
        checkpoint();
        scene.freezeReferencePath();
        const at =
          Math.round(Math.max(0, Math.min(missionFor().duration - 60, t)) / 5) *
          5;
        if (addNodeArmed) {
          const nodes = getManeuvers(design.plan);
          if (nodes.length >= 8) {
            toast("기동점은 최대8개입니다.", true);
            return;
          }
          const id = "burn-" + Date.now().toString(36);
          design.plan.maneuvers = [
            ...nodes,
            { id, time: at, progradeMps: 0, normalMps: 0, radialMps: 0 },
          ];
          scene.selectedManeuverId = id;
          addNodeArmed = false;
        } else if (design.plan.maneuvers) {
          const node = design.plan.maneuvers.find(
            (n) => n.id === scene.selectedManeuverId,
          );
          if (node) node.time = at;
        } else design.plan.burnTime = at;
        designChanged(false);
      },
      contextLost: () => {
        playing = false;
        toast(
          "그래픽 컨텍스트가 중단되어 임무를 멈췄습니다. 복구 후 재생할 수 있습니다.",
          true,
        );
        scheduleSave();
      },
      assetProgress: (label, done, total) => {
        $("#load-bar").style.width = (done / total) * 100 + "%";
        $("#load-status").textContent =
          `${label} 준비 완료 · ${done} / ${total}`;
      },
    });
    worker = new Worker(new URL("./preview.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (e) => {
      const msg = e.data;
      if (solarExperience || solarOpening || deploymentExperience || deploymentOpening || archiveReview || archiveReviewOpening || swingbyAssembly || swingbyExperience || swingbyOpening || msg.revision !== revision) return;
      clearTimeout(previewTimeout);
      if (msg.error) {
        pending = false;
        toast("계획 계산 실패: " + msg.error, true);
        render();
        return;
      }
      acceptedRevision = msg.revision;
      pending = false;
      preview = msg.preview;
      scene.setTrajectory(msg.path);
      updatePreviewTelemetry();
      if (!navUndo&&!keyboardPlacement) render();
    };
    worker.onerror = () => {
      if (solarExperience || solarOpening || deploymentExperience || deploymentOpening || archiveReview || archiveReviewOpening || swingbyAssembly || swingbyExperience || swingbyOpening) return;
      pending = false;
      toast(
        "궤도 계산 작업이 중단되었습니다. 새로고침 또는 저장 후 다시 시도하세요.",
        true,
      );
      render();
    };
    forecastWorker = new Worker(
      new URL("./forecast.worker.ts", import.meta.url),
      { type: "module" },
    );
    forecastWorker.onmessage = (e) => {
      if (e.data.requestId !== forecastSequence) return;
      forecastPending = false;
      if (e.data.error || !sim) {
        flightForecast = null;
        return;
      }
      const f = e.data.forecast as FlightForecast;
      if (f.baseTime + f.horizon <= sim.time) {
        flightForecast = null;
        requestFlightForecast(true);
        return;
      }
      flightForecast = f;
      if (mode === "flight") updateFlightAdvisor();
    };
    forecastWorker.onerror = () => {
      forecastPending = false;
      flightForecast = null;
      forecastWorker?.terminate();
      forecastWorker = null;
    };
    scene.setDesign(design);
    scene.setSelected(selected);
    render();
    let last = performance.now();
    const frame = (now: number) => {
      requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.08);
      last = now;
      if (solarExperience || solarOpening || deploymentExperience || deploymentOpening || archiveReview || archiveReviewOpening || transferExperience || swingbyExperience || transferOpening || swingbyOpening) return;
      if (sim && playing && sim.status === "running" && !document.hidden) {
        const was = sim.status;
        const step =
          stopAtTime === null
            ? dt * speed
            : Math.min(
                dt * speed,
                Math.max(0, stopAtTime - sim.time - sim.remainder),
              );
        advanceSimulation(sim, step);
        if (
          stopAtTime !== null &&
          sim.time + sim.remainder >= stopAtTime - 1e-7
        ) {
          playing = false;
          stopAtTime = null;
          requestFlightForecast(true);
          scheduleSave();
          render();
        }
        if (sim.status !== was) {
          playing = false;
          updateTelemetry();
          showResult();
        }
      }
      if (now - lastTelemetry > 180) {
        lastTelemetry = now;
        if (mode === "flight") updateTelemetry();
      }
      if (sim && mode === "flight")
        scene.setFlightFrame(
          sim.time + sim.remainder,
          sim.attitudeQuaternion,
          dt,
        );
      scene.render(dt);
    };
    requestAnimationFrame(frame);
    await scene.loadAssets();
    try {
      savedAvailable = !!(await loadLocal());
      savedHardwareAvailable = !!(await loadLocal("hardware"));
    } catch {}
    assetsReady = true;
    $("#loading").remove();
    render();
    if(mode !== "campus")requestPreview();
    if (new URLSearchParams(location.search).has("qa")) {
      (window as unknown as Record<string, unknown>).__game = {
        getState: () => ({
          design: structuredClone(design),
          sim: sim ? structuredClone(sim) : null,
          mode,
          pending,
          acceptedRevision,
          revision,
          preview: preview?.result,
          assetsReady,
          playing,
          forecast: flightForecast ? structuredClone(flightForecast) : null,
          forecastPending,
          stopAtTime,
          transferAssembly,
          swingbyAssembly,
          swingbyDraft: swingbyDraft ? structuredClone(swingbyDraft) : null,
          swingbyNumerics: structuredClone(swingbyNumerics),
          swingbyEvaluation: swingbyEvaluation ? structuredClone(swingbyEvaluation) : null,
          swingby: swingbyExperience?.getState() ?? null,
          deployment: deploymentExperience?.getState() ?? null,
          transfer: transferExperience?.getState() ?? null,
          previousResult: previousResult
            ? structuredClone(previousResult)
            : null,
          debrief: activeDebrief ? structuredClone(activeDebrief) : null,
          reviewContext: reviewContext ? { ...reviewContext } : null,
          previewTime,
        }),
        startMission,
        action,
        scene,
        solar: () => solarExperience,
        transfer: () => transferExperience,
        swingby: () => swingbyExperience,
        deployment: () => deploymentExperience,
        review: () => archiveReview ?? swingbyExperience?.getReview() ?? null,
        finishFast: () => {
          if (sim) {
            advanceSimulation(sim, missionFor().duration);
            playing = false;
            updateTelemetry();
            showResult();
          }
        },
        setDesign: (d: Design) => {
          design = d;
          sim = null;
          designChanged();
        },
        telemetry: () => (sim ? getTelemetry(sim) : null),
      };
    }
  } catch (error) {
    console.error(error);
    $("#loading").innerHTML =
      `<div class="loading-failed"><div class="loading-logo">ORBITAL FOUNDRY</div><p>3D 공간을 준비하지 못했습니다.</p><p>${esc(error instanceof Error ? error.message : String(error))}</p><small>Chrome 또는 Edge에서 WebGL 2와 그래픽 가속을 확인해 주세요.</small><br><br><button class="primary" onclick="location.reload()">다시 시도</button></div>`;
  }
}
void boot();
