// ============================================================
//  ASG4 – Phong Lighting  (CSE 160)
//  Vertex format: x,y,z, r,g,b, u,v, nx,ny,nz  (11 floats)
// ============================================================

const VSHADER = `
  precision mediump float;

  attribute vec3 a_Position;
  attribute vec3 a_Color;
  attribute vec2 a_UV;
  attribute vec3 a_Normal;

  uniform mat4 u_ModelMatrix;
  uniform mat4 u_ViewMatrix;
  uniform mat4 u_ProjMatrix;
  uniform mat4 u_NormalMatrix;

  varying vec3 v_Color;
  varying vec3 v_Normal;
  varying vec3 v_WorldPos;
  varying vec2 v_UV;

  void main() {
    vec4 worldPos4 = u_ModelMatrix * vec4(a_Position, 1.0);
    v_WorldPos = worldPos4.xyz;
    v_Normal   = normalize((u_NormalMatrix * vec4(a_Normal, 0.0)).xyz);
    v_Color    = a_Color;
    v_UV       = a_UV;
    gl_Position = u_ProjMatrix * u_ViewMatrix * worldPos4;
  }
`;

const FSHADER = `
  precision mediump float;

  varying vec3 v_Color;
  varying vec3 v_Normal;
  varying vec3 v_WorldPos;
  varying vec2 v_UV;

  uniform vec3  u_LightPos;
  uniform vec3  u_LightColor;
  uniform int   u_PointLightOn;

  uniform vec3  u_SpotPos;
  uniform vec3  u_SpotDir;
  uniform float u_SpotCutoff;
  uniform int   u_SpotOn;

  uniform vec3  u_EyePos;
  uniform int   u_LightingOn;
  uniform int   u_ShowNormals;
  
  uniform int   u_UseTexture;
  uniform sampler2D u_Sampler;

  const float ka        = 0.15;
  const float kd        = 0.85;
  const float ks        = 0.6;
  const float shininess = 48.0;

  vec3 phong(vec3 N, vec3 L, vec3 V, vec3 baseColor, vec3 lightColor) {
    float diff = max(dot(N, L), 0.0);
    vec3  R    = reflect(-L, N);
    float spec = pow(max(dot(V, R), 0.0), shininess);
    return ka * baseColor
         + kd * diff  * baseColor * lightColor
         + ks * spec  * lightColor;
  }

  void main() {
    if (u_ShowNormals == 1) {
      gl_FragColor = vec4(abs(v_Normal), 1.0);
      return;
    }

    vec3 baseColor = v_Color;
    if (u_UseTexture == 1) {
      baseColor = texture2D(u_Sampler, fract(v_UV * 4.0)).rgb;
    }

    if (u_LightingOn == 0) {
      gl_FragColor = vec4(baseColor, 1.0);
      return;
    }

    vec3 N = normalize(v_Normal);
    vec3 V = normalize(u_EyePos - v_WorldPos);
    vec3 result = ka * baseColor;   // ambient baseline

    if (u_PointLightOn == 1) {
      vec3 L = normalize(u_LightPos - v_WorldPos);
      result += phong(N, L, V, baseColor, u_LightColor) - ka * baseColor;
    }

    if (u_SpotOn == 1) {
      vec3  L       = normalize(u_SpotPos - v_WorldPos);
      vec3  spotDir = normalize(u_SpotDir);
      float cosA    = dot(-L, spotDir);
      if (cosA > u_SpotCutoff) {
        float intensity = pow(cosA, 6.0);
        result += intensity * (phong(N, L, V, baseColor, vec3(1.0, 0.85, 0.5)) - ka * baseColor);
      }
    }

    gl_FragColor = vec4(clamp(result, 0.0, 1.0), 1.0);
  }
`;

// ---- Global state ------------------------------------------
let gl, canvas, camera, g_program;

let g_lightPos   = [16, 12, 4];
let g_lightColor = [1, 1, 1];
let g_spotPos    = [16, 16, 16];
let g_spotDir    = [0, -1, 0];
let g_spotCutoff = 25;

let g_lightingOn   = true;
let g_showNormals  = false;
let g_pointLightOn = true;
let g_spotOn       = true;
let g_animOn       = true;
let g_animAngle    = 0;

const keys = {};

// ---- Entry -------------------------------------------------
function main() {
  canvas = document.getElementById('webgl');
  gl = getWebGLContext(canvas, false);
  if (!gl) { alert('WebGL unavailable'); return; }

  if (!initShaders(gl, VSHADER, FSHADER)) {
    alert('Shader error – check console');
    return;
  }
  g_program = gl.program;

  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0.1, 0.2, 0.8, 1.0);   // sky blue

  initTextures();
  camera = new Camera(canvas);
  setupUI();
  setupKeyboard();
  tick();
}

function initTextures() {
  let texture = gl.createTexture();
  let image = new Image();
  image.onload = function() {
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
    setUniform1i('u_Sampler', 0);
  };
  image.src = DIRT_TEX;
}

// ---- Loop --------------------------------------------------
function tick() {
  requestAnimationFrame(tick);
  handleKeys();

  if (g_animOn) {
    g_animAngle = (g_animAngle + 0.8) % 360;
    let r  = 14;
    let ax = g_animAngle * Math.PI / 180;
    g_lightPos[0] = 16 + r * Math.cos(ax);
    g_lightPos[2] = 16 + r * Math.sin(ax);
    document.getElementById('sl-lx').value = g_lightPos[0];
    document.getElementById('sl-lz').value = g_lightPos[2];
    document.getElementById('lx-val').textContent = g_lightPos[0].toFixed(1);
    document.getElementById('lz-val').textContent = g_lightPos[2].toFixed(1);
  }
  render();
}

// ---- Render ------------------------------------------------
function render() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  setUniform1i('u_LightingOn',   g_lightingOn   ? 1 : 0);
  setUniform1i('u_ShowNormals',  g_showNormals  ? 1 : 0);
  setUniform1i('u_PointLightOn', g_pointLightOn ? 1 : 0);
  setUniform1i('u_SpotOn',       g_spotOn       ? 1 : 0);

  setUniform3f('u_LightPos',   g_lightPos[0],   g_lightPos[1],   g_lightPos[2]);
  setUniform3f('u_LightColor', g_lightColor[0], g_lightColor[1], g_lightColor[2]);
  setUniform3f('u_SpotPos',    g_spotPos[0],    g_spotPos[1],    g_spotPos[2]);

  let sd = normVec3(g_spotDir);
  setUniform3f('u_SpotDir', sd[0], sd[1], sd[2]);
  setUniform1f('u_SpotCutoff', Math.cos(g_spotCutoff * Math.PI / 180));

  setUniform3f('u_EyePos',
    camera.eye.elements[0],
    camera.eye.elements[1],
    camera.eye.elements[2]);

  setUniformMatrix4('u_ViewMatrix', camera.viewMatrix.elements);
  setUniformMatrix4('u_ProjMatrix', camera.projectionMatrix.elements);

  drawGround();
  drawWalls();
  drawTable();
  drawChairs();
  drawObjModel();
  drawTeaCups();
  drawDonuts();
  drawAnimal();
  drawLightMarker();
  drawSpotMarker();
}

// ---- drawGeom ----------------------------------------------
function drawGeom(geom, modelMat) {
  let verts  = geom.vertices;
  let FSIZE  = verts.BYTES_PER_ELEMENT;
  let stride = 11 * FSIZE;

  let buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

  bindAttrib('a_Position', 3, stride,  0 * FSIZE);
  bindAttrib('a_Color',    3, stride,  3 * FSIZE);
  bindAttrib('a_UV',       2, stride,  6 * FSIZE);
  bindAttrib('a_Normal',   3, stride,  8 * FSIZE);

  setUniformMatrix4('u_ModelMatrix', modelMat.elements);

  let nm = new Matrix4(modelMat);
  nm.invert();
  nm.transpose();
  setUniformMatrix4('u_NormalMatrix', nm.elements);

  gl.drawArrays(gl.TRIANGLES, 0, verts.length / 11);
  gl.deleteBuffer(buf);
}

// ---- Scene objects -----------------------------------------

function drawGround() {
  setUniform1i('u_UseTexture', 0);
  let sq = new square();
  sq.setColor(0.55, 0.88, 0.55);   // bright green lawn
  let mat = new Matrix4();
  mat.setTranslate(16, 0, 16);
  mat.rotate(-90, 1, 0, 0);
  mat.scale(32, 32, 1);
  drawGeom(sq, mat);
}

function drawWalls() {
  setUniform1i('u_UseTexture', 1);
  // All 4 walls use the pink+purple checkerboard texture
  const wallDefs = [
    [16,  5,  0,   32,  5, 0.5],  // North
    [16,  5, 32,   32,  5, 0.5],  // South
    [ 0,  5, 16,  0.5,  5, 32],   // West
    [32,  5, 16,  0.5,  5, 32],   // East
  ];
  wallDefs.forEach(([tx,ty,tz, sx,sy,sz]) => {
    let c = new cube(); c.setColor(1, 1, 1);  // white tint so texture shows true colour
    let mat = new Matrix4();
    mat.setTranslate(tx, ty, tz); mat.scale(sx, sy, sz);
    drawGeom(c, mat);
  });
  setUniform1i('u_UseTexture', 0);
}

// ============================================================
//  TEA PARTY SCENE
// ============================================================

// Helper: draw a single cube part at world pos (wx,wy,wz) with scale (sx,sy,sz)
function drawCubePart(wx, wy, wz, sx, sy, sz, r, g, b) {
  setUniform1i('u_UseTexture', 0);
  let c = new cube(); c.setColor(r, g, b);
  let mat = new Matrix4();
  mat.setTranslate(wx, wy, wz);
  mat.scale(sx, sy, sz);
  drawGeom(c, mat);
}

// ---- OBJ model: Teapot centrepiece on the table -------------
function drawObjModel() {
  setUniform1i('u_UseTexture', 0);
  let m = new ObjModel(TEAPOT_OBJ);
  m.setColor(0.95, 0.65, 0.15);   // golden teapot
  let mat = new Matrix4();
  mat.setTranslate(16, 5.6, 16); // on the table surface
  mat.scale(0.6, 0.6, 0.6);
  drawGeom(m, mat);
}

// ---- Table (slab top + 4 legs) ------------------------------
function drawTable() {
  // Table top
  drawCubePart(16, 5.0, 16,  4.5, 0.25, 4.5,  0.55, 0.35, 0.15);
  // Legs
  let lx = 3.5, lz = 3.5;
  [[16-lx, 16-lz],[16+lx, 16-lz],[16-lx, 16+lz],[16+lx, 16+lz]].forEach(([x,z]) => {
    drawCubePart(x, 2.5, z,  0.22, 2.5, 0.22,  0.40, 0.25, 0.08);
  });
}

// ---- 4 Chairs around the table ------------------------------
function drawChair(cx, cz, ry) {
  // build in local space then rotate — simple approach: just translate
  let s = Math.sin(ry * Math.PI/180), co = Math.cos(ry * Math.PI/180);
  function rotOffset(lx, lz) {
    return [cx + co*lx - s*lz, cz + s*lx + co*lz];
  }
  // Seat
  let [sx, sz] = rotOffset(0, 0);
  drawCubePart(sx, 2.7, sz,  0.9, 0.15, 0.9,  0.65, 0.42, 0.20);
  // Back rest
  let [bx, bz] = rotOffset(0, -0.9);
  drawCubePart(bx, 3.5, bz,  0.9, 0.8, 0.12, 0.65, 0.42, 0.20);
  // Legs (4)
  [[-0.65,-0.65],[0.65,-0.65],[-0.65,0.65],[0.65,0.65]].forEach(([dlx,dlz]) => {
    let [lx, lz] = rotOffset(dlx, dlz);
    drawCubePart(lx, 1.35, lz,  0.14, 1.35, 0.14,  0.45, 0.28, 0.10);
  });
}

function drawChairs() {
  drawChair(16,  9.5, 0);    // south
  drawChair(16, 22.5, 180);  // north
  drawChair( 9.5, 16, 90);   // west
  drawChair(22.5, 16, -90);  // east
}

// ---- Tea cups (OBJ cup model) at 4 corners of the table -----
function drawTeaCups() {
  setUniform1i('u_UseTexture', 0);
  const cups = [
    [14.0, 5.25, 14.0,  0.95, 0.95, 0.95],  // white
    [18.0, 5.25, 14.0,  0.95, 0.55, 0.65],  // pink
    [14.0, 5.25, 18.0,  0.55, 0.75, 0.95],  // blue
    [18.0, 5.25, 18.0,  0.75, 0.95, 0.55],  // mint
  ];
  cups.forEach(([tx, ty, tz, r, g, b]) => {
    let m = new ObjModel(TEACUP_OBJ);
    m.setColor(r, g, b);
    let mat = new Matrix4();
    mat.setTranslate(tx, ty, tz);
    mat.scale(0.38, 0.38, 0.38);
    drawGeom(m, mat);
  });
}

// ---- Donuts (torus OBJ) on a small plate stack -------------
function drawDonuts() {
  setUniform1i('u_UseTexture', 0);
  const donuts = [
    [12.5, 5.35, 16.0,  0.80, 0.45, 0.20], // chocolate
    [12.5, 5.60, 16.0,  0.95, 0.85, 0.60], // vanilla
    [19.5, 5.35, 16.0,  0.90, 0.30, 0.45], // strawberry
  ];
  donuts.forEach(([tx, ty, tz, r, g, b]) => {
    let m = new ObjModel(DONUT_OBJ);
    m.setColor(r, g, b);
    let mat = new Matrix4();
    mat.setTranslate(tx, ty, tz);
    mat.scale(0.45, 0.45, 0.45);
    drawGeom(m, mat);
  });
}

// ---- Blocky Dog sitting at south chair ----------------------
function drawAnimal() {
  const tx = 16, ty = 2.85, tz = 9.5;
  setUniform1i('u_UseTexture', 0);

  function dp(cx, cy, cz, sx, sy, sz, r, g, b) {
    drawCubePart(tx+cx, ty+cy, tz+cz, sx, sy, sz, r, g, b);
  }

  const body  = [0.75, 0.50, 0.22];
  const leg   = [0.60, 0.38, 0.10];
  const head  = [0.80, 0.55, 0.25];
  const snout = [0.30, 0.20, 0.10];
  const ear   = [0.50, 0.28, 0.08];

  // Body
  dp(0, 0.6, 0,   1.2, 0.7, 1.8, ...body);
  // Head
  dp(0, 1.45, -1.2,  0.9, 0.85, 0.85, ...head);
  // Snout
  dp(0, 1.25, -2.0,  0.45, 0.38, 0.42, ...snout);
  // Ears
  dp(-0.6, 1.9, -1.1, 0.28, 0.55, 0.25, ...ear);
  dp( 0.6, 1.9, -1.1, 0.28, 0.55, 0.25, ...ear);
  // Legs (sitting: back legs behind, front tucked)
  dp(-0.7, 0, -0.8, 0.28, 0.65, 0.28, ...leg);
  dp( 0.7, 0, -0.8, 0.28, 0.65, 0.28, ...leg);
  dp(-0.7, 0,  0.8, 0.28, 0.65, 0.28, ...leg);
  dp( 0.7, 0,  0.8, 0.28, 0.65, 0.28, ...leg);
  // Tail (sticking up behind)
  dp(0, 1.1, 1.5,  0.2, 0.6, 0.2, ...ear);
}

function drawLightMarker() {
  // Bright cube at point-light position (unlit so it always glows)
  let sL = g_lightingOn, sN = g_showNormals;
  setUniform1i('u_LightingOn', 0); setUniform1i('u_ShowNormals', 0);

  let c = new cube();
  c.setColor(g_lightColor[0], g_lightColor[1], g_lightColor[2]);
  let mat = new Matrix4();
  mat.setTranslate(g_lightPos[0], g_lightPos[1], g_lightPos[2]);
  mat.scale(0.35, 0.35, 0.35);
  drawGeom(c, mat);

  setUniform1i('u_LightingOn',  sL ? 1 : 0);
  setUniform1i('u_ShowNormals', sN ? 1 : 0);
}

function drawSpotMarker() {
  // Bright yellow cube at spotlight position
  let sL = g_lightingOn, sN = g_showNormals;
  setUniform1i('u_LightingOn', 0); setUniform1i('u_ShowNormals', 0);

  let c = new cube();
  c.setColor(1.0, 0.9, 0.2);
  let mat = new Matrix4();
  mat.setTranslate(g_spotPos[0], g_spotPos[1], g_spotPos[2]);
  mat.scale(0.28, 0.28, 0.28);
  drawGeom(c, mat);

  setUniform1i('u_LightingOn',  sL ? 1 : 0);
  setUniform1i('u_ShowNormals', sN ? 1 : 0);
}

// ---- WebGL helpers -----------------------------------------
function setUniform1i(name, v) {
  let loc = gl.getUniformLocation(g_program, name);
  if (loc !== null) gl.uniform1i(loc, v);
}
function setUniform1f(name, v) {
  let loc = gl.getUniformLocation(g_program, name);
  if (loc !== null) gl.uniform1f(loc, v);
}
function setUniform3f(name, x, y, z) {
  let loc = gl.getUniformLocation(g_program, name);
  if (loc !== null) gl.uniform3f(loc, x, y, z);
}
function setUniformMatrix4(name, arr) {
  let loc = gl.getUniformLocation(g_program, name);
  if (loc !== null) gl.uniformMatrix4fv(loc, false, arr);
}
function bindAttrib(name, size, stride, offset) {
  let loc = gl.getAttribLocation(g_program, name);
  if (loc < 0) return;
  gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset);
  gl.enableVertexAttribArray(loc);
}
function normVec3(v) {
  let len = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
  return len < 0.0001 ? [0, 0, 1] : [v[0]/len, v[1]/len, v[2]/len];
}

// ---- Keyboard ----------------------------------------------
function setupKeyboard() {
  document.addEventListener('keydown', e => {
    keys[e.key] = true;
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))
      e.preventDefault();
  });
  document.addEventListener('keyup', e => { keys[e.key] = false; });
}
function handleKeys() {
  if (keys['w'] || keys['W']) camera.moveForward(0.2);
  if (keys['s'] || keys['S']) camera.moveBackward(0.2);
  if (keys['a'] || keys['A']) camera.moveLeft(0.2);
  if (keys['d'] || keys['D']) camera.moveRight(0.2);
  if (keys['q'] || keys['Q']) camera.panLeft(1.5);
  if (keys['e'] || keys['E']) camera.panRight(1.5);
  if (keys['ArrowLeft'])  camera.panLeft(1.5);
  if (keys['ArrowRight']) camera.panRight(1.5);
  if (keys['ArrowUp'])   { camera.eye.elements[1] += 0.2; camera.at.elements[1] += 0.2; camera.updateView(); }
  if (keys['ArrowDown']) { camera.eye.elements[1] -= 0.2; camera.at.elements[1] -= 0.2; camera.updateView(); }
}

// ---- Toggles -----------------------------------------------
function toggleLighting() {
  g_lightingOn = !g_lightingOn;
  let b = document.getElementById('btn-lighting');
  b.textContent = 'Lighting ' + (g_lightingOn ? 'ON' : 'OFF');
  b.classList.toggle('active', g_lightingOn);
}
function toggleNormals() {
  g_showNormals = !g_showNormals;
  let b = document.getElementById('btn-normals');
  b.textContent = 'Normals ' + (g_showNormals ? 'ON' : 'OFF');
  b.classList.toggle('active', g_showNormals);
}
function togglePointLight() {
  g_pointLightOn = !g_pointLightOn;
  let b = document.getElementById('btn-point');
  b.textContent = 'Point Light ' + (g_pointLightOn ? 'ON' : 'OFF');
  b.classList.toggle('active', g_pointLightOn);
}
function toggleSpotLight() {
  g_spotOn = !g_spotOn;
  let b = document.getElementById('btn-spot');
  b.textContent = 'Spot Light ' + (g_spotOn ? 'ON' : 'OFF');
  b.classList.toggle('active', g_spotOn);
}
function toggleAnim() {
  g_animOn = !g_animOn;
  let b = document.getElementById('btn-anim');
  b.textContent = 'Animate ' + (g_animOn ? 'ON' : 'OFF');
  b.classList.toggle('active', g_animOn);
}

// ---- Sliders -----------------------------------------------
function setupUI() {
  bind('sl-fov', 'fov-val', v => {
    camera.fov = parseFloat(v);
    camera.projectionMatrix.setPerspective(camera.fov, canvas.width/canvas.height, 0.1, 1000);
  });
  bind('sl-lx',  'lx-val',  v => { if (!g_animOn) g_lightPos[0] = parseFloat(v); });
  bind('sl-ly',  'ly-val',  v => { g_lightPos[1] = parseFloat(v); });
  bind('sl-lz',  'lz-val',  v => { if (!g_animOn) g_lightPos[2] = parseFloat(v); });
  bind('sl-lr',  'lr-val',  v => { g_lightColor[0] = parseFloat(v); });
  bind('sl-lg',  'lg-val',  v => { g_lightColor[1] = parseFloat(v); });
  bind('sl-lb',  'lb-val',  v => { g_lightColor[2] = parseFloat(v); });
  bind('sl-spx', 'spx-val', v => { g_spotPos[0] = parseFloat(v); });
  bind('sl-spy', 'spy-val', v => { g_spotPos[1] = parseFloat(v); });
  bind('sl-spz', 'spz-val', v => { g_spotPos[2] = parseFloat(v); });
  bind('sl-spot','spot-val',v => { g_spotCutoff = parseFloat(v); });
  bind('sl-sdx', 'sdx-val', v => { g_spotDir[0] = parseFloat(v); });
  bind('sl-sdy', 'sdy-val', v => { g_spotDir[1] = parseFloat(v); });
  bind('sl-sdz', 'sdz-val', v => { g_spotDir[2] = parseFloat(v); });
}

function bind(sliderId, valId, cb) {
  let el = document.getElementById(sliderId);
  let vl = document.getElementById(valId);
  if (!el || !vl) return;
  el.addEventListener('input', () => {
    let dec = (el.step && parseFloat(el.step) < 1) ? 2 : 1;
    vl.textContent = parseFloat(el.value).toFixed(dec);
    cb(el.value);
  });
}

// patch square (no setColor by default)
square.prototype.setColor = function(r, g, b) {
  for (let i = 0; i < this.vertices.length; i += 11) {
    this.vertices[i+3] = r; this.vertices[i+4] = g; this.vertices[i+5] = b;
  }
};

window.onload = main;
