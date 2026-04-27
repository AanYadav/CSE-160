// ===================================================
//  ASG2: 3D Sloth — Hugging a VERTICAL branch
//  Body curves in a C/D shape around the branch.
//  Front arms (near head) grip branch.
//  Back legs (near tail end) grip branch.
//  Can climb UP and DOWN the branch.
// ===================================================

var VSHADER_SOURCE = `
  attribute vec4 a_Position;
  uniform mat4 u_ModelMatrix;
  uniform mat4 u_GlobalRotationMatrix;
  void main() {
    gl_Position = u_GlobalRotationMatrix * u_ModelMatrix * a_Position;
  }`;

var FSHADER_SOURCE = `
  precision mediump float;
  uniform vec4 u_FragColor;
  void main() {
    gl_FragColor = u_FragColor;
  }`;

let canvas, gl;
let u_ModelMatrix, u_GlobalRotationMatrix, u_FragColor;

let g_globalAngleX = 0, g_globalAngleY = 0;
let g_sliderAngleX = 0, g_sliderAngleY = 0;

// Joint angles — all in degrees
let g_jFL = [0, 0, 0];   // front-left  arm  [shoulder, elbow, claw]
let g_jFR = [0, 0, 0];   // front-right arm
let g_jBL = [0, 0, 0];   // back-left   leg
let g_jBR = [0, 0, 0];   // back-right  leg

let g_animation = false;
let g_climbing  = false;
let g_climbDir  = 1;       // +1 = up, -1 = down
let g_climbPhase = 0;      // 0=FL, 1=FR, 2=BL, 3=BR
let g_climbT = 0;

// How far along the vertical branch the sloth has climbed (world Y offset)
let g_climbOffset = 0.0;

let g_poke = false, g_pokeStart = 0;
let g_startTime = performance.now() / 1000.0;
let g_seconds = 0;

let g_bodySwayX = 0;   // sway along branch axis during climb

let g_fpsBuffer = [], g_lastFrameTime = performance.now();
let g_cubeBuffer = null;
let g_a_Position = -1;

const C = {
    bodyDark:  [0.36, 0.24, 0.12, 1],
    bodyMid:   [0.48, 0.33, 0.17, 1],
    bodyLight: [0.56, 0.41, 0.22, 1],
    belly:     [0.70, 0.58, 0.40, 1],
    head:      [0.52, 0.37, 0.20, 1],
    facePale:  [0.88, 0.78, 0.62, 1],
    mask:      [0.18, 0.12, 0.07, 1],
    eyeRing:   [0.42, 0.28, 0.12, 1],
    eyeW:      [0.92, 0.90, 0.85, 1],
    eye:       [0.06, 0.05, 0.04, 1],
    nose:      [0.65, 0.40, 0.35, 1],
    claw:      [0.93, 0.91, 0.82, 1],
    branch:    [0.22, 0.14, 0.06, 1],
    branchMid: [0.32, 0.20, 0.09, 1],
    limb:      [0.44, 0.30, 0.15, 1],
    limbDark:  [0.33, 0.21, 0.10, 1],
    neck:      [0.46, 0.32, 0.16, 1],
};

function main() {
    canvas = document.getElementById('webgl');
    gl = getWebGLContext(canvas);
    if (!gl) { alert('No WebGL'); return; }
    if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) { alert('Shader fail'); return; }

    u_ModelMatrix          = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
    u_GlobalRotationMatrix = gl.getUniformLocation(gl.program, 'u_GlobalRotationMatrix');
    u_FragColor            = gl.getUniformLocation(gl.program, 'u_FragColor');
    g_a_Position           = gl.getAttribLocation(gl.program, 'a_Position');

    g_cubeBuffer = buildCubeBuffer();
    gl.clearColor(0.10, 0.13, 0.10, 1.0);
    gl.enable(gl.DEPTH_TEST);
    setupUI();
    requestAnimationFrame(tick);
}

function setupUI() {
    const s = (id, arr, i) =>
        document.getElementById(id).oninput = function() { arr[i] = parseFloat(this.value); };

    document.getElementById('globalRotX').oninput = e => g_sliderAngleX = parseFloat(e.target.value);
    document.getElementById('globalRotY').oninput = e => g_sliderAngleY = parseFloat(e.target.value);

    s('jFL1',g_jFL,0); s('jFL2',g_jFL,1); s('jFL3',g_jFL,2);
    s('jFR1',g_jFR,0); s('jFR2',g_jFR,1); s('jFR3',g_jFR,2);
    s('jBL1',g_jBL,0); s('jBL2',g_jBL,1); s('jBL3',g_jBL,2);
    s('jBR1',g_jBR,0); s('jBR2',g_jBR,1); s('jBR3',g_jBR,2);

    document.getElementById('animOn').onclick  = () => { g_animation = true;  g_climbing = false; };
    document.getElementById('animOff').onclick = () => { g_animation = false; g_climbing = false; };

    // Initialize joint arrays and sliders to rest pose so they start in sync
    setRestPose();
    const syncSlider = (id, val) => { const el = document.getElementById(id); if(el) el.value = val; };
    syncSlider('jFL1', g_jFL[0]); syncSlider('jFL2', g_jFL[1]); syncSlider('jFL3', g_jFL[2]);
    syncSlider('jFR1', g_jFR[0]); syncSlider('jFR2', g_jFR[1]); syncSlider('jFR3', g_jFR[2]);
    syncSlider('jBL1', g_jBL[0]); syncSlider('jBL2', g_jBL[1]); syncSlider('jBL3', g_jBL[2]);
    syncSlider('jBR1', g_jBR[0]); syncSlider('jBR2', g_jBR[1]); syncSlider('jBR3', g_jBR[2]);

    // Climb UP button
    document.getElementById('climbBtn').onclick = () => {
        g_climbing = true; g_animation = false;
        g_climbDir = 1; g_climbPhase = 0; g_climbT = 0;
    };

    // Climb DOWN button (add this in HTML or reuse — here we wire it to a second btn if present)
    const downBtn = document.getElementById('climbDownBtn');
    if (downBtn) downBtn.onclick = () => {
        g_climbing = true; g_animation = false;
        g_climbDir = -1; g_climbPhase = 0; g_climbT = 0;
    };

    let dragging = false, lastX = 0, lastY = 0;
    canvas.onmousedown = ev => {
        if (ev.shiftKey) {
            g_poke = true; g_pokeStart = g_seconds;
            setTimeout(() => g_poke = false, 1500);
        } else { dragging = true; lastX = ev.clientX; lastY = ev.clientY; }
    };
    canvas.onmouseup   = () => dragging = false;
    canvas.onmousemove = ev => {
        if (!dragging) return;
        g_globalAngleX += (ev.clientX - lastX) * 0.6;
        g_globalAngleY += (ev.clientY - lastY) * 0.6;
        lastX = ev.clientX; lastY = ev.clientY;
    };
}

// ── Default resting pose: arms & legs reach LEFT to grip branch ──
// Branch is at X = +0.30 (right side of sloth when viewed from front)
// Limbs extend to the RIGHT (+X) to grip it
function setRestPose() {
    // Arms (near head, upper body): reach right toward branch
    g_jFL[0] = 0;  g_jFL[1] = -25; g_jFL[2] = 30;
    g_jFR[0] = 0;  g_jFR[1] = -25; g_jFR[2] = 30;
    // Legs (near tail, lower body): also reach right to grip
    g_jBL[0] = 0;  g_jBL[1] = -20; g_jBL[2] = 24;
    g_jBR[0] = 0;  g_jBR[1] = -20; g_jBR[2] = 24;
}

function updateAnimationAngles() {
    const t = g_seconds;

    // ── POKE ──
    if (g_poke) {
        const pt = t - g_pokeStart;
        const d  = Math.max(0, 1 - pt * 0.85);
        g_bodySwayX = Math.sin(pt * 14) * 10 * d;
        g_jFL[0] =  30 * Math.sin(pt*14) * d;
        g_jFR[0] = -30 * Math.sin(pt*14) * d;
        g_jBL[0] =  24 * Math.sin(pt*11+1) * d;
        g_jBR[0] = -24 * Math.sin(pt*11+1) * d;
        g_jFL[1] = -25 + 18 * Math.sin(pt*18) * d;
        g_jFR[1] = -25 + 18 * Math.sin(pt*18+0.5) * d;
        g_jBL[1] = -20 + 14 * Math.sin(pt*15) * d;
        g_jBR[1] = -20 + 14 * Math.sin(pt*15+0.5) * d;
        g_jFL[2] = 30; g_jFR[2] = 30; g_jBL[2] = 24; g_jBR[2] = 24;
        return;
    }

    // ── CLIMB ──
    if (g_climbing) {
        g_climbT += 1/60;
        const PHASE_DUR = 0.80;
        if (g_climbT > PHASE_DUR) {
            g_climbT = 0;
            g_climbPhase = (g_climbPhase + 1) % 4;
            // Move body along branch each full limb cycle
            if (g_climbPhase === 0) {
                g_climbOffset += g_climbDir * 0.10;
                // Clamp so sloth stays on screen
                g_climbOffset = Math.max(-0.55, Math.min(0.55, g_climbOffset));
            }
        }
        const reach = Math.sin((g_climbT / PHASE_DUR) * Math.PI);

        // Base all at resting grip
        setRestPose();
        g_bodySwayX = 0;

        // The reaching limb releases, moves UP or DOWN, then re-grips
        const moveAmt = g_climbDir * 18 * reach;

        if      (g_climbPhase === 0) { g_jFL[0] = moveAmt; g_jFL[1] = -25 - 20*reach; g_jFL[2] = 30 + 15*reach; g_bodySwayX = -3*reach; }
        else if (g_climbPhase === 1) { g_jFR[0] = moveAmt; g_jFR[1] = -25 - 20*reach; g_jFR[2] = 30 + 15*reach; g_bodySwayX =  3*reach; }
        else if (g_climbPhase === 2) { g_jBL[0] = moveAmt; g_jBL[1] = -20 - 16*reach; g_jBL[2] = 24 + 12*reach; g_bodySwayX = -2*reach; }
        else                         { g_jBR[0] = moveAmt; g_jBR[1] = -20 - 16*reach; g_jBR[2] = 24 + 12*reach; g_bodySwayX =  2*reach; }
        return;
    }

    // ── IDLE BREATHE ──
    if (!g_animation) {
        // Don't touch joint angles — let manual sliders control them
        g_bodySwayX = 0;
        return;
    }

    // Gentle breathing sway
    const breathe = Math.sin(t * 0.35) * 1.2;
    g_bodySwayX = Math.sin(t * 0.22) * 1.8;

    g_jFL[0] = breathe * 0.8;
    g_jFR[0] = breathe * 0.8;
    g_jBL[0] = breathe * 0.6;
    g_jBR[0] = breathe * 0.6;

    g_jFL[1] = -25 - 5 * Math.sin(t * 0.4 + 0.0);
    g_jFR[1] = -25 - 5 * Math.sin(t * 0.4 + 0.5);
    g_jBL[1] = -20 - 4 * Math.sin(t * 0.4 + 1.0);
    g_jBR[1] = -20 - 4 * Math.sin(t * 0.4 + 1.5);

    g_jFL[2] = 30 + 3 * Math.sin(t * 0.9);
    g_jFR[2] = 30 + 3 * Math.sin(t * 0.9 + 0.4);
    g_jBL[2] = 24 + 2 * Math.sin(t * 0.8);
    g_jBR[2] = 24 + 2 * Math.sin(t * 0.8 + 0.3);
}

function tick() {
    g_seconds = performance.now() / 1000.0 - g_startTime;
    const now = performance.now();
    g_fpsBuffer.push(now - g_lastFrameTime);
    g_lastFrameTime = now;
    if (g_fpsBuffer.length > 30) g_fpsBuffer.shift();
    const avgMs = g_fpsBuffer.reduce((a,b)=>a+b,0) / g_fpsBuffer.length;
    document.getElementById('numIndicator').textContent =
        `FPS: ${Math.round(1000/avgMs)} | MS: ${Math.round(avgMs)}`;
    updateAnimationAngles();
    renderScene();
    requestAnimationFrame(tick);
}

function renderScene() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const rotMat = new Matrix4()
        .rotate(g_globalAngleX + g_sliderAngleX, 0, 1, 0)
        .rotate(g_globalAngleY + g_sliderAngleY, 1, 0, 0);
    gl.uniformMatrix4fv(u_GlobalRotationMatrix, false, rotMat.elements);
    drawSloth();
}

// ══════════════════════════════════════════════════════
//  LAYOUT — VERTICAL BRANCH
//
//  Branch: vertical pole at X = +0.30, runs full height
//
//  Sloth body is HORIZONTAL, curving around the right side of branch:
//
//     Branch (X=+0.30)
//         |
//    ___  |          <-- back legs grip here (upper on branch)
//   /   \ |
//   | C  ||  <-- body curves around branch
//   \___/ |
//         |          <-- front arms grip here (lower on branch, near head)
//
//  Body center X = -0.12 (left of branch)
//  Body runs vertically: Y = +0.45 (tail end) down to Y = -0.45 (head end)
//
//  g_climbOffset shifts the whole sloth+arms up/down the branch
// ══════════════════════════════════════════════════════

// Branch X position
const BRANCH_X = 0.30;

// Body geometry constants
const BW = 0.14;   // body half-width (X)
const BD = 0.19;   // body half-depth (Z)
const BODY_TOP    =  0.45;   // tail end (up)
const BODY_BOT    = -0.45;   // head end (down)
const BODY_HEIGHT = BODY_TOP - BODY_BOT;  // 0.90
const BODY_CX     = -0.12;   // body center X

// Arms attach near head (lower body, Y ≈ BODY_BOT)
// Legs attach near tail (upper body, Y ≈ BODY_TOP)
// Both reach RIGHTWARD (+X) to grip the branch

function drawSloth() {
    const t = g_seconds;
    const pd = g_poke ? Math.max(0, 1-(t-g_pokeStart)*0.85) : 0;

    // Apply climb offset — shifts entire sloth+branch slice up/down
    const cy = g_climbOffset;

    // ── VERTICAL BRANCH ──
    // Tall pole at X=BRANCH_X, runs from Y=-1.1 to Y=+1.1
    drawBox(BRANCH_X - 0.09, -1.10, -0.12,  0.18, 2.20, 0.24,  C.branch);
    // Highlight stripe
    drawBox(BRANCH_X - 0.03, -1.10, -0.04,  0.06, 2.20, 0.08,  C.branchMid);

    // ── BODY ROOT — pivot at body center ──
    let root = new Matrix4();
    root.translate(BODY_CX, cy, 0);
    root.rotate(g_bodySwayX, 0, 0, 1);  // slight sway along branch

    // ── 3 BODY SEGMENTS (stacked vertically) ──
    // Each segment: width ~2*BW, depth ~2*BD
    // Seg1 = upper (tail end): Y = +0.14 .. +0.45
    let s1 = new Matrix4(root);
    s1.translate(-BW,       0.14, -BD);
    s1.scale(BW*2, 0.31, BD*2);
    drawCube(s1, C.bodyMid);

    // Seg2 = middle (widest): Y = -0.14 .. +0.14
    let s2 = new Matrix4(root);
    s2.translate(-BW*1.06, -0.14, -BD*1.08);
    s2.scale(BW*2.12, 0.28, BD*2.16);
    drawCube(s2, C.bodyDark);

    // Seg3 = lower (head end): Y = -0.44 .. -0.14
    let s3 = new Matrix4(root);
    s3.translate(-BW*0.96, -0.44, -BD*0.96);
    s3.scale(BW*1.92, 0.30, BD*1.92);
    drawCube(s3, C.bodyMid);

    // ── BELLY ── (front face stripe, Z = +BD)
    let bel = new Matrix4(root);
    bel.translate(-BW*0.72, -0.44, BD);
    bel.scale(BW*1.44, 0.86, 0.04);
    drawCube(bel, C.belly);

    // ── NECK: Y = -0.44 .. -0.54 ──
    let nkM = new Matrix4(root);
    nkM.translate(-0.09, -0.54, -0.09);
    nkM.scale(0.18, 0.10, 0.18);
    drawCube(nkM, C.neck);

// ── REFINED SLOTH FACE (Fixed Attachment & Aligned Eyes) ──
    const HW = 0.22; const HH = 0.26; const HD = 0.17;

    let headPivot = new Matrix4(root);
    // Moved Y from -0.58 to -0.50 to attach it to the neck/body properly
    headPivot.translate(0, -0.50, 0); 
    if (g_poke) headPivot.rotate(Math.sin((t-g_pokeStart)*20)*16*pd, 0, 1, 0);

    // 1. Outer Fur (The base head shape)
    let hM = new Matrix4(headPivot);
    hM.translate(-HW, -HH, -HD);
    hM.scale(HW*2, HH, HD*2);
    drawCube(hM, C.head);

    // 2. Pale Face Patch
    let faceM = new Matrix4(headPivot);
    faceM.translate(-HW*0.8, -HH*0.9, HD);
    faceM.scale(HW*1.6, HH*0.82, 0.02);
    drawCube(faceM, C.facePale);

    // 3. Dark Eye Patches (Rotation flipped to tilt outwards)
    // Left Patch (Sloth's Right)
    let patchL = new Matrix4(headPivot);
    patchL.translate(HW*0.2, -HH*0.75, HD+0.01);
    patchL.rotate(10, 0, 0, 1); // Tilted 'out' towards the side of the head
    patchL.scale(0.20, 0.13, 0.02);
    drawCube(patchL, C.mask);

    // Right Patch (Sloth's Left)
    let patchR = new Matrix4(headPivot);
    patchR.translate(-HW*1.1, -HH*0.63, HD+0.01);
    patchR.rotate(-10, 0, 0, 1); // Tilted 'out' towards the side of the head
    patchR.scale(0.20, 0.13, 0.02);
    drawCube(patchR, C.mask);

    // 4. Aligned Pupils (Centered relative to the new patch tilt)
    let epL = new Matrix4(headPivot);
    epL.translate(HW*0.32, -HH*0.52, HD+0.04);
    epL.scale(0.05, 0.05, 0.02);
    drawCube(epL, [0, 0, 0, 1]);

    let epR = new Matrix4(headPivot);
    epR.translate(-HW*0.52, -HH*0.52, HD+0.04);
    epR.scale(0.05, 0.05, 0.02);
    drawCube(epR, [0, 0, 0, 1]);

    // 5. Focal Point Nose
    let noseM = new Matrix4(headPivot);
    noseM.translate(-0.07, -HH*0.75, HD+0.05);
    noseM.scale(0.14, 0.13, 0.05); 
    drawCube(noseM, [0.12, 0.1, 0.08, 1]);

    let mouth = new Matrix4(headPivot);
    mouth.translate(-0.1, -HH*0.2, HD+0.03);
    mouth.scale(0.2, 0.015, 0.01);
    drawCube(mouth, C.mask);

    // ══════════════════════════════════════════════════
    //  LIMBS — all reach RIGHTWARD (+X) to grip branch
    //
    //  Front arms  → near HEAD  (Y ≈ -0.30 in root space)
    //  Back legs   → near TAIL  (Y ≈ +0.28 in root space)
    //
    //  Each limb:
    //    shoulder pivot at body right face (X = +BW)
    //    upper segment goes RIGHT (+X)
    //    elbow bends
    //    lower segment continues right to branch
    //    claw curls AROUND branch
    //
    //  Two limbs per side: front (Z = +BD front face)
    //                      back  (Z = -BD back face)
    // ══════════════════════════════════════════════════

    // ARM length budget: body right face at X = BW = 0.14
    // Branch at X = BRANCH_X = 0.30, body center at X = BODY_CX = -0.12
    // So branch is at body-local X = BRANCH_X - BODY_CX = 0.42 from body center
    // Arms extend from X=+BW (0.14 from center) → need 0.42 - 0.14 = 0.28 to reach branch
    // Use: upper = 0.16, lower = 0.14  → total = 0.30 (slight overshoot = claws curl back)

    const ARM_U = 0.16; const ARM_L = 0.14;
    const LEG_U = 0.15; const LEG_L = 0.13;

    // FRONT LEFT ARM  (Z = +BD, Y = -0.30)
    drawLimb(root,  BW, -0.30,  BD*0.65,  g_jFL[0], g_jFL[1], g_jFL[2],  ARM_U, ARM_L, 0.086, 0.072, true);
    // FRONT RIGHT ARM (Z = -BD, Y = -0.30)
    drawLimb(root,  BW, -0.30, -BD*0.65,  g_jFR[0], g_jFR[1], g_jFR[2],  ARM_U, ARM_L, 0.086, 0.072, true);

    // BACK LEFT LEG   (Z = +BD, Y = +0.28)
    drawLimb(root,  BW,  0.28,  BD*0.65,  g_jBL[0], g_jBL[1], g_jBL[2],  LEG_U, LEG_L, 0.080, 0.066, false);
    // BACK RIGHT LEG  (Z = -BD, Y = +0.28)
    drawLimb(root,  BW,  0.28, -BD*0.65,  g_jBR[0], g_jBR[1], g_jBR[2],  LEG_U, LEG_L, 0.080, 0.066, false);
}

// ── Draw one limb reaching RIGHTWARD (+X) to grip vertical branch ──
// parent:  parent Matrix4 (body root)
// ox,oy,oz: shoulder attach point in parent space
// j1: shoulder up/down swing (Y-axis rotation)
// j2: elbow bend (Z-axis)
// j3: claw curl (Z-axis, curls to hook around branch)
// upperLen, lowerLen, upperW, lowerW: dimensions
// isFront: slight color variation
function drawLimb(parent, ox, oy, oz, j1, j2, j3, upperLen, lowerLen, upperW, lowerW, isFront) {
    // Shoulder pivot — limb extends in +X direction
    let sp = new Matrix4(parent);
    sp.translate(ox, oy, oz);
    // j1 swings limb up/down along branch (Y rotation)
    sp.rotate(j1, 0, 1, 0);

    // Upper segment: extends RIGHT (+X from 0..upperLen)
    let uM = new Matrix4(sp);
    uM.translate(0, -upperW/2, -upperW/2);
    uM.scale(upperLen, upperW, upperW);
    drawCube(uM, isFront ? C.limb : C.bodyMid);

    // Elbow pivot at end of upper segment
    let ep = new Matrix4(sp);
    ep.translate(upperLen, 0, 0);
    // j2 bends elbow (Z = bend forward/back relative to branch)
    ep.rotate(j2, 0, 0, 1);

    // Lower segment
    let lM = new Matrix4(ep);
    lM.translate(0, -lowerW/2, -lowerW/2);
    lM.scale(lowerLen, lowerW, lowerW);
    drawCube(lM, C.limbDark);

    // Wrist pivot at end of lower segment
    let wp = new Matrix4(ep);
    wp.translate(lowerLen, 0, 0);
    wp.rotate(j3, 0, 0, 1);  // whole wrist curl

    // 3 CLAWS — big, fanned along Z, each has base + hooked tip
    const clawBaseLen = isFront ? 0.085 : 0.072;
    const clawTipLen  = isFront ? 0.072 : 0.060;
    const clawW       = isFront ? 0.030 : 0.026;
    const fanSpacing  = isFront ? 0.055 : 0.048;

    for (let c = 0; c < 3; c++) {
        const zOff = (c - 1) * fanSpacing;
        const fanAngle = (c - 1) * 12;
        let cp = new Matrix4(wp);
        cp.translate(0, 0, zOff);
        cp.rotate(fanAngle, 0, 1, 0);
        cp.rotate(50, 0, 0, 1);

        // Base segment
        let cBase = new Matrix4(cp);
        cBase.translate(0, -clawW/2, -clawW/2);
        cBase.scale(clawBaseLen, clawW, clawW);
        drawCube(cBase, C.claw);

        // Hooked tip
        let tp = new Matrix4(cp);
        tp.translate(clawBaseLen, 0, 0);
        tp.rotate(40, 0, 0, 1);
        let cTip = new Matrix4(tp);
        cTip.translate(0, -clawW*0.4, -clawW*0.4);
        cTip.scale(clawTipLen, clawW*0.8, clawW*0.8);
        drawCube(cTip, C.claw);
    }
}

function drawBox(x, y, z, w, h, d, col) {
    let m = new Matrix4();
    m.translate(x, y, z);
    m.scale(w, h, d);
    drawCube(m, col);
}

function buildCubeBuffer() {
    const v = new Float32Array([
        0,0,0, 1,0,0, 1,1,0,  0,0,0, 1,1,0, 0,1,0,
        0,0,1, 1,1,1, 1,0,1,  0,0,1, 0,1,1, 1,1,1,
        0,1,0, 1,1,0, 1,1,1,  0,1,0, 1,1,1, 0,1,1,
        0,0,0, 1,0,1, 1,0,0,  0,0,0, 0,0,1, 1,0,1,
        0,0,0, 0,1,1, 0,1,0,  0,0,0, 0,0,1, 0,1,1,
        1,0,0, 1,1,0, 1,1,1,  1,0,0, 1,1,1, 1,0,1,
    ]);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, v, gl.STATIC_DRAW);
    return buf;
}

function bindBuf(buf) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.vertexAttribPointer(g_a_Position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(g_a_Position);
}

function drawCube(m, col) {
    bindBuf(g_cubeBuffer);
    gl.uniformMatrix4fv(u_ModelMatrix, false, m.elements);
    gl.uniform4f(u_FragColor, col[0], col[1], col[2], col[3]);
    gl.drawArrays(gl.TRIANGLES, 0, 36);
}