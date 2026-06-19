/*
 * three-client.js
 * 「トレメシ」相談相手キャラクター（3D演出）クライアント。
 *
 * 役割は「表示とアニメーションだけ」。
 * - 既存ゲームのクイズ判定・スコア・問題データ・Supabaseには一切触れない。
 * - 既存ゲームとは CustomEvent ('toremeshi:question' / 'toremeshi:answer') 経由でのみ連携する。
 * - 3D側で何が失敗してもゲーム本体は止めない（例外を外へ投げない）。
 *
 * モデルについて:
 *   assets/characters/trainer.glb があれば読み込み、AnimationMixer で再生する。
 *   無い／壊れている／WebGLが使えない場合は、プリミティブで作った簡易キャラクターに
 *   フォールバックし、4状態をプログラム制御のアニメーションで表現する。
 *   こうすることで、正式なGLBが用意できていなくても演出が成立し、かつ
 *   ゲーム本体は常に動作する。
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const MODEL_URL = './assets/characters/trainer.glb';

const CharacterState = Object.freeze({
  IDLE: 'idle',
  THINKING: 'thinking',
  HAPPY: 'happy',
  DISAPPOINTED: 'disappointed'
});

// GLB内のクリップ名は素材により異なるため、内部状態名と実クリップ名を分けて吸収する。
const CLIP_NAME_CANDIDATES = {
  idle: ['idle', 'Idle', 'breathing', 'Breathing Idle', 'Breathing', 'Armature|idle'],
  thinking: ['thinking', 'Thinking', 'think', 'Think', 'idea', 'Idea'],
  happy: ['happy', 'Happy', 'cheer', 'Cheer', 'victory', 'Victory', 'jump', 'Jump'],
  disappointed: ['disappointed', 'Disappointed', 'sad', 'Sad', 'defeat', 'Defeat', 'no', 'No']
};

const RETURN_TO_IDLE_MS = 1800;
const TARGET_HEIGHT = 1.6; // モデル/簡易キャラの想定身長（ワールド単位）

// ---- モジュールスコープの状態 ----
let container = null;
let scene = null;
let camera = null;
let renderer = null;
let clock = null;

let mixer = null;            // GLB用のAnimationMixer（簡易キャラ時は null）
let modelRoot = null;        // 表示中モデルのルート（GLB or 簡易キャラ）
let actions = {};            // state -> THREE.AnimationAction（GLB時のみ）
let currentAction = null;

let proceduralRig = null;    // フォールバックの簡易キャラのパーツ参照
let currentState = CharacterState.IDLE;
let stateChangedAt = 0;      // 状態が切り替わった経過時間（簡易キャラのイージング用）

let returnIdleTimerId = null;
let animationFrameId = null;
let resizeObserver = null;
let elapsed = 0;             // 自前の経過時間（clock.getDelta() を積算）
let disposed = false;

// 既存ゲームへ「絶対に例外を伝播させない」ためのラッパ。
function safe(label, fn) {
  return (...args) => {
    try {
      return fn(...args);
    } catch (e) {
      console.warn(`[three-client] ${label} で問題が発生しましたが、ゲーム本体には影響しません。`, e);
      return undefined;
    }
  };
}

function init() {
  container = document.getElementById('three-character-container');
  if (!container) {
    console.warn('[three-client] #three-character-container が見つからないため、3D表示は無効です。');
    return;
  }

  try {
    setupScene();
  } catch (e) {
    console.warn('[three-client] WebGLRenderer の作成に失敗したため、3D表示は無効です。', e);
    // レンダラーが作れなければ何も表示できないので、ここで静かに撤退する。
    safeDisposeRenderer();
    return;
  }

  addLights();
  addGround();
  registerEvents();
  startLoop();
  loadCharacter(); // 非同期。失敗時は簡易キャラへフォールバック。
}

function setupScene() {
  clock = new THREE.Clock();
  scene = new THREE.Scene();

  const w = Math.max(1, container.clientWidth);
  const hgt = Math.max(1, container.clientHeight);

  camera = new THREE.PerspectiveCamera(35, w / hgt, 0.1, 100);
  // キャラクターと向き合っているように見える位置。
  camera.position.set(0, 1.4, 3.2);
  camera.lookAt(0, 1.1, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, hgt, false);
  if ('outputColorSpace' in renderer) {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  }
  container.appendChild(renderer.domElement);
}

function addLights() {
  // 柔らかい光。硬すぎない見た目にする。
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x888888, 1.6);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(3, 5, 4);
  scene.add(dirLight);
}

function addGround() {
  // 浮いて見えないよう、控えめな円形の床を敷く。背景は主張させない。
  const geo = new THREE.CircleGeometry(2.4, 48);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x223046,
    roughness: 0.95,
    metalness: 0.0
  });
  const ground = new THREE.Mesh(geo, mat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  scene.add(ground);
}

// ---- モデル読み込み ----
async function loadCharacter() {
  let buffer = null;
  try {
    const res = await fetch(MODEL_URL, { cache: 'force-cache' });
    if (!res.ok) {
      console.info(
        `[three-client] ${MODEL_URL} が見つかりません (status ${res.status})。簡易キャラクターを表示します。`
      );
      buildProceduralCharacter();
      return;
    }
    buffer = await res.arrayBuffer();
  } catch (e) {
    console.info('[three-client] GLBの取得に失敗しました。簡易キャラクターを表示します。', e);
    buildProceduralCharacter();
    return;
  }

  try {
    const loader = new GLTFLoader();
    loader.parse(
      buffer,
      '',
      safe('GLBの解析', (gltf) => onModelLoaded(gltf)),
      (err) => {
        console.warn('[three-client] GLBの解析に失敗しました。簡易キャラクターを表示します。', err);
        buildProceduralCharacter();
      }
    );
  } catch (e) {
    console.warn('[three-client] GLBLoaderの初期化に失敗しました。簡易キャラクターを表示します。', e);
    buildProceduralCharacter();
  }
}

function onModelLoaded(gltf) {
  if (disposed) return;
  modelRoot = gltf.scene;
  fitModelToStage(modelRoot);
  scene.add(modelRoot);

  const clips = Array.isArray(gltf.animations) ? gltf.animations : [];
  // 仕様確認のため、読み込んだクリップ名を一度ログに出す。
  console.info('[three-client] GLB animation clips:', clips.map((c) => c.name));

  if (clips.length > 0) {
    mixer = new THREE.AnimationMixer(modelRoot);
    buildActionsFromClips(clips);
  } else {
    console.warn('[three-client] GLBにアニメーションがありません。静止ポーズのidleのみになります。');
  }

  playAnimation(CharacterState.IDLE);
}

function buildActionsFromClips(clips) {
  const byExactName = new Map(clips.map((c) => [c.name, c]));

  const findClip = (candidates) => {
    // 1) 完全一致
    for (const name of candidates) {
      if (byExactName.has(name)) return byExactName.get(name);
    }
    // 2) 部分一致（大文字小文字を無視）
    for (const clip of clips) {
      const lc = String(clip.name || '').toLowerCase();
      if (candidates.some((n) => lc.includes(String(n).toLowerCase()))) return clip;
    }
    return null;
  };

  const idleClip = findClip(CLIP_NAME_CANDIDATES.idle) || clips[0];

  for (const state of Object.values(CharacterState)) {
    // 足りない状態は idle にフォールバックする。
    const clip = findClip(CLIP_NAME_CANDIDATES[state]) || idleClip;
    if (!clip) continue;
    actions[state] = mixer.clipAction(clip);
  }
}

// モデルの中心を原点に、足元をy=0に、身長をTARGET_HEIGHTに合わせる。
function fitModelToStage(obj) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3();
  box.getSize(size);
  if (size.y > 0) {
    obj.scale.setScalar(TARGET_HEIGHT / size.y);
  }
  const box2 = new THREE.Box3().setFromObject(obj);
  const center = new THREE.Vector3();
  box2.getCenter(center);
  obj.position.x += -center.x;
  obj.position.z += -center.z;
  obj.position.y += -box2.min.y; // 足元を床へ
}

// ---- 簡易キャラクター（フォールバック） ----
// プリミティブで作るスタイライズドなトレーナー。GLBが無くても4状態を表現できる。
function buildProceduralCharacter() {
  if (disposed || !scene) return;
  console.info(
    '[three-client] 簡易キャラクターを使用します。assets/characters/trainer.glb を置くと自動的に差し替わります。'
  );

  const rig = {};
  const root = new THREE.Group();

  const skin = new THREE.MeshStandardMaterial({ color: 0xf2c9a0, roughness: 0.7 });
  const shirt = new THREE.MeshStandardMaterial({ color: 0x34d399, roughness: 0.6 }); // ゲームのアクセント色（緑）
  const pants = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.85 });
  const bandMat = new THREE.MeshStandardMaterial({ color: 0xfb7185, roughness: 0.5 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 });

  // 胴体
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.5, 6, 16), shirt);
  torso.position.y = 1.02;
  root.add(torso);
  rig.torso = torso;

  // 頭（首を支点に回せるようグループ化）
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.46, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 24, 24), skin);
  head.position.y = 0.16;
  headGroup.add(head);
  // ヘッドバンド（トレーナーらしさ）
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.05, 12, 24), bandMat);
  band.position.y = 0.22;
  band.rotation.x = Math.PI / 2;
  headGroup.add(band);
  // 目
  const eyeGeo = new THREE.SphereGeometry(0.035, 12, 12);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.1, 0.17, 0.24);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(0.1, 0.17, 0.24);
  headGroup.add(eyeL, eyeR);
  root.add(headGroup);
  rig.head = headGroup;

  // 腕（肩を支点に回せるようグループ化。メッシュは下向きにぶら下げる）
  const armGeo = new THREE.CapsuleGeometry(0.1, 0.46, 6, 12);

  const leftArm = new THREE.Group();
  leftArm.position.set(-0.44, 1.28, 0);
  const leftArmMesh = new THREE.Mesh(armGeo, shirt);
  leftArmMesh.position.y = -0.27;
  leftArm.add(leftArmMesh);
  root.add(leftArm);
  rig.leftArm = leftArm;

  const rightArm = new THREE.Group();
  rightArm.position.set(0.44, 1.28, 0);
  const rightArmMesh = new THREE.Mesh(armGeo, shirt);
  rightArmMesh.position.y = -0.27;
  rightArm.add(rightArmMesh);
  root.add(rightArm);
  rig.rightArm = rightArm;

  // 脚
  const legGeo = new THREE.CapsuleGeometry(0.12, 0.5, 6, 12);
  const leftLeg = new THREE.Mesh(legGeo, pants);
  leftLeg.position.set(-0.16, 0.4, 0);
  const rightLeg = new THREE.Mesh(legGeo, pants);
  rightLeg.position.set(0.16, 0.4, 0);
  root.add(leftLeg, rightLeg);

  scene.add(root);
  modelRoot = root;
  proceduralRig = rig;

  playAnimation(CharacterState.IDLE);
}

// 簡易キャラのプログラム制御アニメーション。currentState と経過時間からポーズを決め、
// 各フレームで目標ポーズへ滑らかに補間する。
function updateProceduralCharacter(dt) {
  const rig = proceduralRig;
  if (!rig) return;

  const t = elapsed;
  const since = t - stateChangedAt;

  // ベースの呼吸（常時）
  const breath = Math.sin(t * 1.8) * 0.02;
  const sway = Math.sin(t * 0.9) * 0.03;

  // 目標値（既定 = idle）
  let rootY = breath;
  let rootRotY = sway;
  let headTiltZ = Math.sin(t * 0.7) * 0.03;
  let headNodX = 0;
  let torsoTiltX = 0;
  let leftArmZ = 0.06 - Math.sin(t * 1.8) * 0.04;
  let rightArmZ = -0.06 + Math.sin(t * 1.8) * 0.04;
  let leftArmX = 0;
  let rightArmX = 0;

  switch (currentState) {
    case CharacterState.THINKING: {
      // 頭をかしげ、右手をあごへ寄せる。
      headTiltZ = 0.2;
      headNodX = 0.12;
      rightArmZ = -1.25;
      rightArmX = -0.35;
      leftArmZ = 0.12;
      break;
    }
    case CharacterState.HAPPY: {
      // 両手を上げて弾む。時間とともに弾みは収まる。
      const decay = Math.max(0, 1 - since / 1.8);
      const bounce = Math.abs(Math.sin(since * 8)) * 0.2 * decay;
      rootY = breath + bounce + 0.04;
      leftArmZ = 2.5;
      rightArmZ = -2.5;
      headNodX = -0.1;
      break;
    }
    case CharacterState.DISAPPOINTED: {
      // うつむいて肩を落とす。
      rootY = breath - 0.09;
      headNodX = 0.5;
      torsoTiltX = 0.2;
      leftArmZ = 0.22;
      rightArmZ = -0.22;
      break;
    }
    default:
      // idle: 既定値のまま
      break;
  }

  // フレームレート非依存の補間係数。
  const k = 1 - Math.pow(0.0015, dt);

  rig.root.position.y = THREE.MathUtils.lerp(rig.root.position.y, rootY, k);
  rig.root.rotation.y = THREE.MathUtils.lerp(rig.root.rotation.y, rootRotY, k * 0.6);
  rig.head.rotation.z = THREE.MathUtils.lerp(rig.head.rotation.z, headTiltZ, k);
  rig.head.rotation.x = THREE.MathUtils.lerp(rig.head.rotation.x, headNodX, k);
  rig.torso.rotation.x = THREE.MathUtils.lerp(rig.torso.rotation.x, torsoTiltX, k);
  rig.leftArm.rotation.z = THREE.MathUtils.lerp(rig.leftArm.rotation.z, leftArmZ, k);
  rig.rightArm.rotation.z = THREE.MathUtils.lerp(rig.rightArm.rotation.z, rightArmZ, k);
  rig.leftArm.rotation.x = THREE.MathUtils.lerp(rig.leftArm.rotation.x, leftArmX, k);
  rig.rightArm.rotation.x = THREE.MathUtils.lerp(rig.rightArm.rotation.x, rightArmX, k);
}

// ---- アニメーション状態管理 ----
function playAnimation(nextState) {
  if (!Object.values(CharacterState).includes(nextState)) {
    nextState = CharacterState.IDLE;
  }

  // GLB（AnimationMixer）の場合
  if (mixer) {
    if (!actions[nextState]) {
      nextState = CharacterState.IDLE;
    }
    const nextAction = actions[nextState];
    if (nextAction) {
      if (currentAction && currentAction !== nextAction) {
        currentAction.stop();
      }
      nextAction.reset();
      nextAction.play();
      currentAction = nextAction;
    }
  }

  // 簡易キャラの場合は currentState を見てupdateProceduralCharacterが描画する。
  currentState = nextState;
  stateChangedAt = elapsed;
}

function scheduleReturnToIdle(ms = RETURN_TO_IDLE_MS) {
  // idleへ戻すタイマーは常に1つだけ。連続回答でタイマーが競合しないようにする。
  if (returnIdleTimerId !== null) {
    window.clearTimeout(returnIdleTimerId);
  }
  returnIdleTimerId = window.setTimeout(() => {
    playAnimation(CharacterState.IDLE);
    returnIdleTimerId = null;
  }, ms);
}

// ---- イベント受信 ----
const onQuestion = safe('toremeshi:question の処理', () => {
  // 新しい問題が出た → 直前の回答による「idleへ戻す」予約は不要なのでキャンセルする。
  // これをしないと、回答直後にすぐ次の問題へ進んだ場合、残ったタイマーが
  // thinking を idle に戻してしまうことがある。
  if (returnIdleTimerId !== null) {
    window.clearTimeout(returnIdleTimerId);
    returnIdleTimerId = null;
  }
  // 問題が表示された → 考えるポーズ。回答が来るまで維持する。
  playAnimation(CharacterState.THINKING);
});

const onAnswer = safe('toremeshi:answer の処理', (event) => {
  const detail = (event && event.detail) || {};
  const isCorrect = Boolean(detail.isCorrect);
  const isClose = Boolean(detail.isClose);

  if (isCorrect) {
    playAnimation(CharacterState.HAPPY);
  } else if (isClose) {
    playAnimation(CharacterState.THINKING);
  } else {
    playAnimation(CharacterState.DISAPPOINTED);
  }
  scheduleReturnToIdle(RETURN_TO_IDLE_MS);
});

const onVisibilityChange = () => {
  if (document.hidden) {
    stopLoop();
  } else if (!disposed && renderer) {
    if (clock) clock.getDelta(); // 復帰時に巨大なdtが出ないようリセット
    startLoop();
  }
};

function registerEvents() {
  document.addEventListener('toremeshi:question', onQuestion);
  document.addEventListener('toremeshi:answer', onAnswer);
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('beforeunload', cleanup);

  // 画面全体ではなく、コンテナのサイズ変化に追従する。
  resizeObserver = new ResizeObserver(safe('リサイズ', resizeRendererToContainer));
  resizeObserver.observe(container);
}

function resizeRendererToContainer() {
  if (!renderer || !camera || !container) return;
  const width = container.clientWidth;
  const height = container.clientHeight;
  if (width <= 0 || height <= 0) return;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

// ---- 描画ループ ----
function startLoop() {
  if (animationFrameId === null) {
    animationFrameId = window.requestAnimationFrame(animate);
  }
}

function stopLoop() {
  if (animationFrameId !== null) {
    window.cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

function animate() {
  animationFrameId = window.requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1); // タブ復帰直後などの巨大dtを抑える
  elapsed += dt;

  if (mixer) mixer.update(dt);
  if (proceduralRig) updateProceduralCharacter(dt);

  renderer.render(scene, camera);
}

// ---- 後始末 ----
function cleanup() {
  if (disposed) return;
  disposed = true;

  if (returnIdleTimerId !== null) {
    window.clearTimeout(returnIdleTimerId);
    returnIdleTimerId = null;
  }
  stopLoop();

  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }

  document.removeEventListener('toremeshi:question', onQuestion);
  document.removeEventListener('toremeshi:answer', onAnswer);
  document.removeEventListener('visibilitychange', onVisibilityChange);

  if (mixer) {
    mixer.stopAllAction();
    if (modelRoot) {
      try { mixer.uncacheRoot(modelRoot); } catch (e) { /* noop */ }
    }
    mixer = null;
  }

  if (scene) {
    scene.traverse((object) => {
      if (object.geometry) {
        object.geometry.dispose();
      }
      if (object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          // テクスチャ等の dispose 可能なプロパティを解放する。
          Object.keys(material).forEach((key) => {
            const value = material[key];
            if (value && typeof value.dispose === 'function') {
              value.dispose();
            }
          });
          material.dispose();
        });
      }
    });
  }

  safeDisposeRenderer();
}

function safeDisposeRenderer() {
  if (renderer) {
    try {
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    } catch (e) {
      /* noop */
    }
    renderer = null;
  }
}

// ---- 起動 ----
// 既存ゲームには影響しないよう、初期化全体も保護する。
const safeInit = safe('初期化', init);
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', safeInit, { once: true });
} else {
  safeInit();
}
