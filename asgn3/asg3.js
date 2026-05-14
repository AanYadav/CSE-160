// ============================================================
// SHADERS
// ============================================================
var VERTEX_SHADER = `
    precision mediump float;
    attribute vec3 a_Position;
    attribute vec3 a_Color;
    attribute vec2 a_UV;
    varying vec3 v_Color;
    varying vec2 v_UV;
    uniform mat4 u_ModelMatrix;
    uniform mat4 u_viewMatrix;
    uniform mat4 u_projectionMatrix;
    void main() {
        v_Color = a_Color;
        v_UV = a_UV;
        gl_Position = u_projectionMatrix * u_viewMatrix * u_ModelMatrix * vec4(a_Position, 1.0);
    }
`;

var FRAGMENT_SHADER = `
    precision mediump float;
    varying vec3 v_Color;
    varying vec2 v_UV;
    uniform sampler2D u_Sampler0;
    uniform sampler2D u_Sampler1;
    uniform sampler2D u_Sampler2;
    uniform sampler2D u_Sampler3;
    uniform sampler2D u_Sampler4;
    uniform sampler2D u_Sampler5;
    uniform sampler2D u_Sampler6;
    uniform sampler2D u_Sampler7;
    uniform int u_texID;
    uniform vec4 u_FragColor;
    uniform float u_texColorWeight;
    uniform bool u_useUniformColor;

    void main() {
        vec4 texColor = vec4(1.0, 1.0, 1.0, 1.0);
        if (u_texID == 0)      texColor = texture2D(u_Sampler0, v_UV);
        else if (u_texID == 1) texColor = texture2D(u_Sampler1, v_UV);
        else if (u_texID == 2) texColor = texture2D(u_Sampler2, v_UV);
        else if (u_texID == 3) texColor = texture2D(u_Sampler3, v_UV);
        else if (u_texID == 4) texColor = texture2D(u_Sampler4, v_UV);
        else if (u_texID == 5) texColor = texture2D(u_Sampler5, v_UV);
        else if (u_texID == 6) texColor = texture2D(u_Sampler6, v_UV);
        else if (u_texID == 7) texColor = texture2D(u_Sampler7, v_UV);
        
        vec4 baseColor = u_useUniformColor ? u_FragColor : vec4(v_Color, 1.0);
        
        if (u_texID >= 0) {
            gl_FragColor = (1.0 - u_texColorWeight) * baseColor + u_texColorWeight * texColor;
        } else {
            gl_FragColor = baseColor;
        }
    }
`;

// ============================================================
// GLOBALS
// ============================================================
let canvas, gl, camera;
let shapes = [];
let g_globalCube = null;
let g_vertexBuffer = null;
let g_keys = {}; // Track held keys for smooth movement

let u_ModelMatrix_loc, u_viewMatrix_loc, u_projectionMatrix_loc, u_texID_loc;
let u_FragColor_loc, u_useUniformColor_loc;
let g_a_Position, g_a_Color, g_a_UV; // cached attrib locations

let g_breeding = false;
let g_ridingTarget = null;

function setRide(target) {
    g_ridingTarget = target;
}
let lastMouseX = 0;

let gateOpen = true;

let g_startTime = performance.now()/1000.0;
let g_seconds = 0;

let foodsCollected = 0;
const TOTAL_FOODS = 5;
let collectibles = [];

const MAP_SIZE = 32;
let worldMap = [];

// ============================================================
// MAIN
// ============================================================
function main() {
    setupWebGL();
    setupShaders();
    g_globalCube = new cube();
    buildMap();
    loadTextures();
    buildWorld(); // Builds the room/static part
    setupInputs();
    
    requestAnimationFrame(tick);
    
    setTimeout(() => setStory("Welcome to the Island of Swallow Falls! Find the Golden Foods 🍗"), 100);
}

function tick() {
    g_seconds = performance.now()/1000.0 - g_startTime;
    updateMovement();
    updateAnimationAngles();
    updateSkyColor();
    renderAllShapes();
    requestAnimationFrame(tick);
}

function updateMovement() {
    const speed = 0.15;
    if (g_keys['KeyW']) camera.moveForward(speed);
    if (g_keys['KeyS']) camera.moveBackward(speed);
    if (g_keys['KeyA']) camera.moveLeft(speed);
    if (g_keys['KeyD']) camera.moveRight(speed);
    if (g_keys['KeyQ']) camera.panLeft(3);
    if (g_keys['KeyE']) camera.panRight(3);
}

let g_yellowAngle = 0;
let g_magentaAngle = 0;
let g_whiteAngle = 0;

function updateAnimationAngles() {
    g_yellowAngle = (25 * Math.sin(g_seconds * 2.5));
    g_magentaAngle = (35 * Math.sin(g_seconds * 1.5));
    g_whiteAngle = (15 * Math.sin(g_seconds * 3.0));
}

function setupWebGL() {
    canvas = document.getElementById("webgl");
    gl = getWebGLContext(canvas);
    if (!gl) { console.log("Failed to get WebGL context."); return; }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0.04, 0.02, 0.06, 1.0);
    
    // Enable Alpha Blending for transparent PNGs
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
}

function setupShaders() {
    if (!initShaders(gl, VERTEX_SHADER, FRAGMENT_SHADER)) {
        console.log("Failed to init shaders."); return;
    }

    // Start inside the room looking toward closet (+z)
    camera = new Camera(canvas);
    camera.eye    = new Vector3([12, 1.5, 18]); // Near the animals
    camera.at     = new Vector3([16, 1, 22]);   // Looking toward pond/animals
    camera.updateView();

    let F = Float32Array.BYTES_PER_ELEMENT;
    g_a_Position = gl.getAttribLocation(gl.program, "a_Position");
    g_a_Color    = gl.getAttribLocation(gl.program, "a_Color");
    g_a_UV       = gl.getAttribLocation(gl.program, "a_UV");

    g_vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, g_vertexBuffer);
    gl.vertexAttribPointer(g_a_Position, 3, gl.FLOAT, false, 8*F, 0);
    gl.enableVertexAttribArray(g_a_Position);
    gl.vertexAttribPointer(g_a_Color,    3, gl.FLOAT, false, 8*F, 3*F);
    gl.enableVertexAttribArray(g_a_Color);
    gl.vertexAttribPointer(g_a_UV,       2, gl.FLOAT, false, 8*F, 6*F);
    gl.enableVertexAttribArray(g_a_UV);

    u_ModelMatrix_loc      = gl.getUniformLocation(gl.program, "u_ModelMatrix");
    u_viewMatrix_loc       = gl.getUniformLocation(gl.program, "u_viewMatrix");
    u_projectionMatrix_loc = gl.getUniformLocation(gl.program, "u_projectionMatrix");
    u_texID_loc            = gl.getUniformLocation(gl.program, "u_texID");
    u_FragColor_loc        = gl.getUniformLocation(gl.program, "u_FragColor");
    u_useUniformColor_loc  = gl.getUniformLocation(gl.program, "u_useUniformColor");
    u_texColorWeight_loc   = gl.getUniformLocation(gl.program, "u_texColorWeight");

    // Static buffer for cube (don't need to re-buffer unless colors/UVs change)
    let unitCube = new cube();
    gl.bindBuffer(gl.ARRAY_BUFFER, g_vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, unitCube.vertices, gl.STATIC_DRAW);

    // Initialize all 8 samplers with a placeholder texture
    for (let i = 0; i < 8; i++) {
        let u_Sampler = gl.getUniformLocation(gl.program, "u_Sampler" + i);
        gl.uniform1i(u_Sampler, i);
        
        // Create a 2x2 colored placeholder (helps diagnose if sampler works)
        let tex = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0 + i);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        // Alternate colors for better visibility
        let c1 = [255, 0, 255]; // Pink
        let c2 = [0, 255, 0];   // Green
        if (i % 2 == 1) { c1 = [0, 255, 255]; c2 = [255, 255, 0]; }
        let data = new Uint8Array([
            c1[0],c1[1],c1[2], c2[0],c2[1],c2[2],
            c2[0],c2[1],c2[2], c1[0],c1[1],c1[2]
        ]);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 2, 2, 0, gl.RGB, gl.UNSIGNED_BYTE, data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        textures[i] = tex; 
    }
}

// ============================================================
// MAP
// ============================================================
function buildMap() {
    for (let i = 0; i < MAP_SIZE; i++) {
        worldMap[i] = [];
        for (let j = 0; j < MAP_SIZE; j++) worldMap[i][j] = 0;
    }

    // Room cleared - total immersion

    // Low jungle border walls (32x32 requirement)
    for (let x = 0; x <= 31; x++) { worldMap[x][0] = 1; worldMap[x][31] = 1; }
    for (let z = 0; z <= 31; z++) { worldMap[0][z] = 1; worldMap[31][z] = 1; }

    // Scattered LOW jungle stumps (height=1 only, not overwhelming)
    let pillars = [
        [5,25,1],[8,14,1],[10,18,1],
        [12,16,1],[15,25,1],[18,14,1],
        [20,17,1],[24,15,1],[28,17,1],
        [6,29,1],[22,29,1],[2,20,1],[29,20,1],
    ];
    for (let [x,z,h] of pillars) worldMap[x][z] = h;
}

// ============================================================
// WORLD BUILDING
// ============================================================
function mc(tx,ty,tz, sx,sy,sz, r,g,b, texID=-1) {
    let c = new cube();
    c.setColor(r, g, b);
    c.texID = texID;
    c.translate(tx, ty, tz);
    c.scale(sx, sy, sz);
    shapes.push(c);
    return c;
}

// Optimized draw for dynamic elements
function dc(tx,ty,tz, sx,sy,sz, r,g,b, texID=-1, tw=1.0) {
    g_globalCube.texID = texID;
    g_globalCube.translationMatrix.setTranslate(tx, ty, tz);
    g_globalCube.scaleMatrix.setScale(sx, sy, sz);
    g_globalCube.rotationMatrix.setIdentity();
    
    gl.uniform4f(u_FragColor_loc, r, g, b, 1.0);
    gl.uniform1i(u_useUniformColor_loc, 1);
    gl.uniform1f(u_texColorWeight_loc, tw);
    
    drawGeometry(g_globalCube, true);
}

function buildWorld() {
    shapes = [];
    collectibles = [];

    // GIANT SKY BOX
    mc(16, 12, 16, 80, 80, 80, 0.5, 0.8, 1.0, -1);
    
    // JUNGLE FLOOR
    mc(16, -1, 16, 32, 0.1, 32, 1, 1, 1, 1); // jungle_floor.png
}

function buildJungle() {
    let zCam = camera.eye.elements[2];
    if (zCam < 0.0) return; // Always render if in positive Z (optimization removed to be safe)

    // ========== GROUND (Jungle Floor) ==========
    dc(16, -1.02, 23, 34, 0.04, 36, 1.0, 1.0, 1.0, 1);

    // ========== COTTON CANDY CLOUDS ==========
    for (let i = 0; i < 6; i++) {
        let cx = 8 + 25 * Math.cos(i*1.05 + g_seconds * 0.08);
        let cz = 20 + 20 * Math.sin(i*1.05 + g_seconds * 0.1);
        let cy = 14 + 2 * Math.sin(g_seconds * 0.3 + i);
        dc(cx, cy, cz, 5, 2, 4, 1, 0.8, 0.9, 0); 
    }

    // ========== FULL 32x32 MAP RENDERING (Minecraft Blocks) ==========
    const VIEW_DIST = 30; 
    let camX = camera.eye.elements[0];
    let camZ = camera.eye.elements[2];

    for (let x = 0; x < 32; x++) {
        for (let z = 0; z < 32; z++) {
            let h = worldMap[x][z];
            if (h <= 0) {
                // Trees every 6 cells, distance-culled
                if (z >= 14 && (x % 6 == 0) && (z % 6 == 0)) {
                    if (x >= 10 && x <= 18 && z >= 18 && z <= 26) continue; // skip pond
                    if (x >= 22 && x <= 28 && z >= 22 && z <= 28) continue; // skip volcano
                    let dx2 = x - camX, dz2 = z - camZ;
                    if (dx2*dx2 + dz2*dz2 > 400) continue; // Skip distant trees (20 units)
                    let ox = (Math.sin(x*z) * 1.0);
                    let oz = (Math.cos(x+z) * 1.0);
                    tree(x + ox, -1.0, z + oz, 0.8, 0.2, 0.7, 0.2);
                }
                continue;
            }

            let dx = x - camX, dz = z - camZ;
            if (dx*dx + dz*dz > VIEW_DIST*VIEW_DIST) continue; // Performance culling
            
            for (let y = 0; y < h; y++) {
                // Use different PNGs based on area
                let tid = 5; // wood_wall for room area
                if (z > 14) tid = 2; // cheese.png for jungle blocks
                if (z > 24) tid = 4; // jungle_canopy.png for deep jungle blocks
                
                dc(x, y - 0.5, z, 1, 1, 1, 1, 1, 1, tid, 1.0);
            }
        }
    }

    // ========== PANCAKE POND ==========
    dc(14, -0.98, 22, 5.0, 0.15, 5.0, 0.95, 0.85, 0.3, 3); 
    dc(14, -0.72, 22, 4.0, 0.15, 4.0, 1.0, 0.9, 0.5, 3);   

    // ========== CHEESE WATERFALL (Flowing) ==========
    let flowY = (g_seconds * 1.5) % 3.0;
    dc(3, 4.5, 14, 0.8, 4.0, 0.8, 1, 0.9, 0.4, 2); 
    for (let y = 0; y < 3; y++) {
        let py = 4.0 - y*1.5 - flowY;
        if (py < -3.5) py += 4.5;
        dc(3, py, 14.1, 1.0, 1.2, 0.2, 1, 0.9, 0.2, 2);
    }
    dc(3, -0.9, 14.5, 1.8, 0.2, 1.5, 0.98, 0.95, 0.3, 2);

    // ========== CHOCOLATE VOLCANO ==========
    dc(25, 0, 25, 6, 2, 6, 0.3, 0.15, 0.05, 5); 
    dc(25, 1.5, 25, 4, 2, 4, 0.25, 0.12, 0.04, 5);
    dc(25, 3.0, 25, 2, 1, 2, 0.2, 0.1, 0.03, 5);
    dc(25, 3.6, 25, 1.0, 0.2, 1.0, 0.4, 0.1, 0, 3); 
    dc(25.5, 3, 25, 0.2, 1.5, 0.1, 0.4, 0.1, 0, 3);
    dc(24.5, 2.5, 25.2, 0.2, 2.0, 0.1, 0.4, 0.1, 0, 3);

    // ========== FOOD ANIMALS (Spread out with complex paths) ==========
    
    // 1. Elephant (Large Ellipse)
    let eX = 14 + 5*Math.sin(g_seconds*0.4);
    let eZ = 20 + 3*Math.cos(g_seconds*0.6);
    drawWatermelophant(eX, -0.7, eZ, 0.9); 

    // 2. Spider (Figure Eight / Lemniscate)
    let sX = 24 + 4*Math.cos(g_seconds*0.8);
    let sZ = 18 + 2*Math.sin(g_seconds*1.6);
    drawCheespider(sX, -0.7, sZ, 0.8);

    // 3. Marshmallow (Z-Axis Bounce + Wide X)
    let mX = 6 + 6*Math.sin(g_seconds*0.5);
    let mZ = 12 + 4*Math.cos(g_seconds*0.3);
    drawMarshmallow(mX, -0.6, mZ, 0.7);

    // 4. Hippo (Slow lumbering circle)
    let hX = 18 + 6*Math.cos(g_seconds*0.2);
    let hZ = 26 + 4*Math.sin(g_seconds*0.2);
    drawSyrupHippo(hX, -0.75, hZ, 1.0);
    
    // Existing cute creatures
    jellyAnimal(10 + Math.sin(g_seconds), -0.80, 24, 0.3, 0.85, 0.25, 0.98);
    fluffyCreature(20, -0.88, 16 + Math.cos(g_seconds*2), 0.6, 0.20, 0.60, 0.20);
    roundCreature(12 + Math.cos(g_seconds*1.5), -0.85, 28, 0.4, 0.15, 0.75, 0.15);

    // ========== VINES ==========
    for (let i = 0; i < 4; i++) {
        let vx = 4 + i*7;
        dc(vx, 3.2, 13.5, 0.05, 3.4, 0.05, 0.10, 0.45, 0.12, 4);
    }

    // ========== COLLECTIBLE GOLDEN FOOD ITEMS ==========
    for (let c of collectibles) {
        if (!c.collected) dc(c.worldX, 0.35, c.worldZ, 0.22, 0.22, 0.22, 0.98, 0.85, 0.10, -1);
    }
}

function tree(x, y, z, scale, r, g, b) {
    dc(x, y + scale*1.5, z, scale*0.3, scale*3.0, scale*0.3, 0.45, 0.25, 0.08, 5); 
    dc(x, y + scale*3.2, z, scale*1.8, scale*1.5, scale*1.8, r, g, b, 4); 
}

function drawWatermelophant(x, y, z, scale) {
    // Body (Watermelon - large and heavy)
    dc(x, y + scale*0.8, z, scale*1.2, scale*1.4, scale*1.1, 0.2, 0.6, 0.2, -1);
    
    // Large Floppy Ears (Wide flat green)
    dc(x-scale*0.8, y+scale*1.4, z-scale*0.3, scale*0.6, scale*0.8, scale*0.1, 0.15, 0.5, 0.15, -1);
    dc(x+scale*0.8, y+scale*1.4, z-scale*0.3, scale*0.6, scale*0.8, scale*0.1, 0.15, 0.5, 0.15, -1);

    // Trunk (Segmented green swinging)
    let trunkSwing = 0.2 * Math.sin(g_seconds * 3);
    for (let i = 0; i < 4; i++) {
        let ty = y + scale*1.1 - i*scale*0.3;
        let tz = z - scale*1.0 - i*scale*0.1;
        let tx = x + trunkSwing * (i+1);
        dc(tx, ty, tz, scale*0.3, scale*0.3, scale*0.3, 0.2, 0.7, 0.2, -1);
    }

    // FACE on the head part
    dc(x-scale*0.3, y+scale*1.3, z-scale*1.0, scale*0.25, scale*0.25, scale*0.2, 1,1,1, -1); // L eye
    dc(x+scale*0.3, y+scale*1.3, z-scale*1.0, scale*0.25, scale*0.25, scale*0.2, 1,1,1, -1); // R eye
    dc(x-scale*0.3, y+scale*1.3, z-scale*1.15, scale*0.1, scale*0.1, scale*0.1, 0,0,0, -1); // pupils
    dc(x+scale*0.3, y+scale*1.3, z-scale*1.15, scale*0.1, scale*0.1, scale*0.1, 0,0,0, -1);
    
    // Legs
    let walk = 0.15 * Math.sin(g_seconds * 6);
    dc(x-scale*0.5, y+scale*0.2+walk, z-scale*0.4, scale*0.3, scale*0.5, scale*0.3, 0.1, 0.5, 0.1, -1);
    dc(x+scale*0.5, y+scale*0.2-walk, z-scale*0.4, scale*0.3, scale*0.5, scale*0.3, 0.1, 0.5, 0.1, -1);
    dc(x-scale*0.5, y+scale*0.2-walk, z+scale*0.4, scale*0.3, scale*0.5, scale*0.3, 0.1, 0.5, 0.1, -1);
    dc(x+scale*0.5, y+scale*0.2+walk, z+scale*0.4, scale*0.3, scale*0.5, scale*0.3, 0.1, 0.5, 0.1, -1);
}

function drawCheespider(x, y, z, scale) {
    // Main body chunk (Cheese ID 2)
    dc(x, y + scale*0.6, z, scale*1.2, scale*0.6, scale*1.0, 1, 1, 1, 2);
    // Head cube (Cheese ID 2)
    dc(x, y + scale*0.9, z - scale*0.6, scale*0.5, scale*0.5, scale*0.5, 1, 1, 1, 2);
    // Many legs (8 legs)
    for (let i = 0; i < 4; i++) {
        let legWiggle = 0.15 * Math.sin(g_seconds * 12 + i);
        // Left legs (segments)
        dc(x - scale*1.0, y + scale*0.4 + legWiggle, z - 0.6 + i*0.4, scale*0.8, scale*0.1, scale*0.1, 0.8, 0.6, 0, -1);
        dc(x - scale*1.6, y + scale*0.2 + legWiggle, z - 0.6 + i*0.4, scale*0.2, scale*0.5, scale*0.1, 0.8, 0.5, 0, -1);
        // Right legs
        dc(x + scale*1.0, y + scale*0.4 - legWiggle, z - 0.6 + i*0.4, scale*0.8, scale*0.1, scale*0.1, 0.8, 0.6, 0, -1);
        dc(x + scale*1.6, y + scale*0.2 - legWiggle, z - 0.6 + i*0.4, scale*0.2, scale*0.5, scale*0.1, 0.8, 0.5, 0, -1);
    }
    // === FACE ===
    dc(x-scale*0.2, y+scale*1.1, z-scale*0.9, scale*0.2, scale*0.2, scale*0.15, 1,1,1, -1); // L eye
    dc(x+scale*0.2, y+scale*1.1, z-scale*0.9, scale*0.2, scale*0.2, scale*0.15, 1,1,1, -1); // R eye
    dc(x-scale*0.2, y+scale*1.05, z-scale*1.0, scale*0.1, scale*0.1, scale*0.1, 0.8,0,0, -1); // L pupil red
    dc(x+scale*0.2, y+scale*1.05, z-scale*1.0, scale*0.1, scale*0.1, scale*0.1, 0.8,0,0, -1); // R pupil red
    dc(x-scale*0.1, y+scale*0.7, z-scale*0.9, scale*0.05, scale*0.15, scale*0.06, 1,1,1, -1); // L fang
    dc(x+scale*0.1, y+scale*0.7, z-scale*0.9, scale*0.05, scale*0.15, scale*0.06, 1,1,1, -1); // R fang
}

function drawSyrupHippo(x, y, z, scale) {
    // BODY (Very wide and heavy)
    dc(x, y + scale*0.8, z, scale*2.4, scale*1.4, scale*2.6, 1, 1, 1, 3);
    
    // HEAD (Flat and square)
    dc(x, y + scale*1.1, z-scale*1.4, scale*1.4, scale*1.2, scale*1.0, 1, 1, 1, 3);
    
    // BOXY HIPPO SNOUT (Extremely wide, faces camera)
    let mouthOpen = 0.35 * Math.abs(Math.sin(g_seconds * 1.5));
    // Upper box
    dc(x, y + scale*1.0 + mouthOpen, z-scale*2.1, scale*1.5, scale*0.7, scale*1.0, 0.8, 0.5, 0.2, -1);
    // Lower jaw box
    dc(x, y + scale*0.4 - mouthOpen, z-scale*2.1, scale*1.3, scale*0.4, scale*1.0, 0.8, 0.45, 0.2, -1);
    
    // Nostrils (big visible holes on snout)
    dc(x-scale*0.4, y+scale*1.4+mouthOpen, z-scale*2.6, scale*0.15, scale*0.15, scale*0.1, 0.1, 0.05, 0, -1);
    dc(x+scale*0.4, y+scale*1.4+mouthOpen, z-scale*2.6, scale*0.15, scale*0.15, scale*0.1, 0.1, 0.05, 0, -1);

    // EYES (Beady and set back)
    dc(x-scale*0.5, y+scale*1.8, z-scale*1.6, scale*0.35, scale*0.35, scale*0.1, 1,1,1, -1);
    dc(x+scale*0.5, y+scale*1.8, z-scale*1.6, scale*0.35, scale*0.35, scale*0.1, 1,1,1, -1);
    dc(x-scale*0.5, y+scale*1.8, z-scale*1.7, scale*0.15, scale*0.15, scale*0.1, 0,0,0, -1);
    dc(x+scale*0.5, y+scale*1.8, z-scale*1.7, scale*0.15, scale*0.15, scale*0.1, 0,0,0, -1);

    // Flappy hippo ears
    dc(x-scale*0.7, y+scale*2.2, z-scale*0.9, scale*0.3, scale*0.4, scale*0.1, 0.7, 0.4, 0.2, -1);
    dc(x+scale*0.7, y+scale*2.2, z-scale*0.9, scale*0.3, scale*0.4, scale*0.1, 0.7, 0.4, 0.2, -1);

    // Stubby pillars for legs
    let walk = 0.1 * Math.sin(g_seconds * 4);
    dc(x-scale*0.9, y+scale*0.3+walk, z-scale*0.8, scale*0.5, scale*0.7, scale*0.5, 0.6, 0.35, 0.15, -1);
    dc(x+scale*0.9, y+scale*0.3-walk, z-scale*0.8, scale*0.5, scale*0.7, scale*0.5, 0.6, 0.35, 0.15, -1);
    dc(x-scale*0.9, y+scale*0.3-walk, z+scale*0.8, scale*0.5, scale*0.7, scale*0.5, 0.6, 0.35, 0.15, -1);
    dc(x+scale*0.9, y+scale*0.3+walk, z+scale*0.8, scale*0.5, scale*0.7, scale*0.5, 0.6, 0.35, 0.15, -1);
    // Tail
    dc(x, y+scale*1.2, z+scale*1.2, scale*0.15, scale*0.15, scale*0.7, 0.6, 0.3, 0.1, -1);
}

function drawMarshmallow(x, y, z, scale) {
    let bounce = 0.2 * Math.abs(Math.sin(g_seconds * 5));
    // Body
    dc(x, y + scale*0.5 + bounce, z, scale, scale, scale, 1, 1, 1, -1);
    // Toasted ring
    dc(x, y + scale*1.0 + bounce, z, scale, scale*0.1, scale, 0.6, 0.4, 0.2, -1);
    // === FACE ===
    dc(x-scale*0.35, y+scale*0.8+bounce, z-scale*0.7, scale*0.22, scale*0.22, scale*0.18, 0.1,0.1,0.1, -1); // L eye
    dc(x+scale*0.35, y+scale*0.8+bounce, z-scale*0.7, scale*0.22, scale*0.22, scale*0.18, 0.1,0.1,0.1, -1); // R eye
    dc(x, y+scale*0.45+bounce, z-scale*0.7, scale*0.3, scale*0.1, scale*0.12, 0.9, 0.3, 0.3, -1); // Smile
}

function jellyAnimal(x, y, z, scale, r, g, b) {
    let wobble = 1.0 + 0.1 * Math.sin(g_seconds * 4);
    dc(x, y + scale*0.5, z, scale*0.5*wobble, scale*0.6, scale*0.5*wobble, r, g, b, -1);
    dc(x, y + scale*1.05, z, scale*0.4, scale*0.4, scale*0.4, r*0.9, g*0.9, b*0.9, -1);
    dc(x - scale*0.15, y + scale*1.1, z - scale*0.25, scale*0.12, scale*0.15, scale*0.08, 1.0, 1.0, 1.0, -1);
    dc(x + scale*0.15, y + scale*1.1, z - scale*0.25, scale*0.12, scale*0.15, scale*0.08, 1.0, 1.0, 1.0, -1);
}

function fluffyCreature(x, y, z, scale, r, g, b) {
    dc(x, y + scale*0.5, z, scale*0.6, scale*0.65, scale*0.6, r, g, b, -1);
    dc(x, y + scale*1.15, z, scale*0.45, scale*0.5, scale*0.45, r*1.05, g*1.05, b*1.05, -1);
    // Eyes
    dc(x - scale*0.18, y + scale*1.25, z - scale*0.28, scale*0.14, scale*0.16, scale*0.1, 1,1,1, -1);
    dc(x + scale*0.18, y + scale*1.25, z - scale*0.28, scale*0.14, scale*0.16, scale*0.1, 1,1,1, -1);
    dc(x - scale*0.18, y + scale*1.2, z - scale*0.35, scale*0.07, scale*0.08, scale*0.07, 0.05,0.05,0.05, -1);
    dc(x + scale*0.18, y + scale*1.2, z - scale*0.35, scale*0.07, scale*0.08, scale*0.07, 0.05,0.05,0.05, -1);
    // Mouth
    dc(x, y + scale*0.9, z - scale*0.28, scale*0.22, scale*0.09, scale*0.06, 1.0, 0.85, 0.85, -1);
}

function roundCreature(x, y, z, scale, r, g, b) {
    dc(x, y + scale*0.5, z, scale*0.7, scale*0.75, scale*0.75, r, g, b, -1);
    dc(x, y + scale*1.2, z, scale*0.5, scale*0.5, scale*0.5, r*1.1, g*1.1, b*1.1, -1);
    // Eyes
    dc(x - scale*0.22, y + scale*1.2, z - scale*0.35, scale*0.16, scale*0.2, scale*0.12, 1,1,1, -1);
    dc(x + scale*0.22, y + scale*1.2, z - scale*0.35, scale*0.16, scale*0.2, scale*0.12, 1,1,1, -1);
    dc(x - scale*0.22, y + scale*1.08, z - scale*0.38, scale*0.08, scale*0.1, scale*0.08, 0.05,0.05,0.05, -1);
    dc(x + scale*0.22, y + scale*1.08, z - scale*0.38, scale*0.08, scale*0.1, scale*0.08, 0.05,0.05,0.05, -1);
    // Mouth
    dc(x, y + scale*0.95, z - scale*0.32, scale*0.3, scale*0.15, scale*0.1, 1.0, 0.75, 0.75, -1);
}

function spawnCollectible(x, y, z) {
    let c = mc(x, y + 0.35, z, 0.22, 0.22, 0.22, 0.98, 0.85, 0.10, -1);
    c.isCollectible = true;
    c.worldX = x;
    c.worldZ = z;
    c.collected = false;
    collectibles.push(c);
}

function buildFromMap() {
    // Hidden interior walls - don't render visual blocks for now, just keep map data
    // This way players can still add/remove blocks with G/H keys but jungle isn't cluttered
}

// ============================================================
// TEXTURES
// ============================================================
let textures = {};

function loadTextures() {
    console.log("Starting texture loading...");
    // 0: Cotton Candy
    loadOneTex("./textures/cotton_candy.png", 0);
    // 1: Jungle Floor
    loadOneTex("./textures/jungle_floor.png", 1);
    // 2: Cheese
    loadOneTex("./textures/cheese.png", 2);
    // 3: Syrup
    loadOneTex("./textures/syrup.png", 3);
    // 4: Jungle Canopy
    loadOneTex("./textures/jungle_canopy.png", 4);
    // 5: Wood Wall
    loadOneTex("./textures/wood_wall.png", 5);
    // 6: Wood Floor
    loadOneTex("./textures/wood_floor.png", 6);
    // 7: Block
    loadOneTex("./textures/block.jpg", 7);
}

function loadOneTex(src, texIndex, cb) {
    let img = new Image();
    img.onload = function() {
        console.log("Texture loaded:", src);
        let tex = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0 + texIndex);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        
        // Use RGB as fallback since many "PNGs" are actually JPEGs (640x640 NPOT)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
        
        textures[texIndex] = tex;
        if (cb) cb();
    };
    img.onerror = () => { 
        console.log("Failed to load texture:", src);
        if (cb) cb(); 
    };
    img.src = src;
}

// ============================================================
// INPUT
// ============================================================
function setupInputs() {
    canvas.focus();
    canvas.tabIndex = 0;
    
    document.addEventListener('keydown', (ev) => { g_keys[ev.code] = true; keydown(ev); });
    document.addEventListener('keyup',   (ev) => { g_keys[ev.code] = false; });
    
    canvas.onmousedown = (e) => { mouseDown=true; lastMouseX=e.clientX; };
    canvas.onmouseup   = ()  => { mouseDown=false; };
    canvas.onmousemove = mousemove;
    // Pointer lock (click canvas to capture mouse)
    canvas.onclick = () => { if (canvas.requestPointerLock) canvas.requestPointerLock(); };
    document.addEventListener('pointerlockchange', ()=>{});
    document.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement === canvas) {
            camera.panLeft(-e.movementX * 0.15);
            renderAllShapes();
        }
    });
}

function keydown(ev) {
    let moved = true;
    const code = ev.code;
    switch(code) {
        case 'KeyW':     camera.moveForward();   break;
        case 'KeyS':     camera.moveBackward();  break;
        case 'KeyA':     camera.moveLeft();      break;
        case 'KeyD':     camera.moveRight();     break;
        case 'KeyQ':     camera.panLeft(5);      break;
        case 'KeyE':     camera.panRight(5);     break;
        case 'KeyF':     toggleGate();           break;
        case 'KeyG':     addBlockAhead();        break;
        case 'KeyH':     deleteBlockAhead();     break;
        case 'ArrowUp':  camera.moveForward();   break;
        case 'ArrowDown':camera.moveBackwards(); break;
        case 'ArrowLeft':camera.panLeft(5);      break;
        case 'ArrowRight':camera.panRight(5);   break;
        default: moved = false;
    }
    if (moved) {
        checkCollectibles();
        updateSkyColor();
        renderAllShapes();
    }
}

function mousemove(e) {
    if (!mouseDown) return;
    let dx = e.clientX - lastMouseX;
    lastMouseX = e.clientX;
    camera.panLeft(-dx * 0.3);
    renderAllShapes();
}

// ============================================================
// GATE
// ============================================================
function toggleGate() {
    gateOpen = !gateOpen;
    setStory(gateOpen
        ? "The wardrobe creaks open... step into the darkness..."
        : "The gate swings shut.");
    buildWorld();
    renderAllShapes();
    canvas.focus(); // Re-focus canvas after toggle
}

// ============================================================
// ADD / DELETE BLOCKS
// ============================================================
function getMapCellAhead() {
    let fx = camera.at.elements[0] - camera.eye.elements[0];
    let fz = camera.at.elements[2] - camera.eye.elements[2];
    let len = Math.sqrt(fx*fx + fz*fz) || 1;
    fx /= len; fz /= len;
    let mx = Math.round(camera.eye.elements[0] + fx * 1.5);
    let mz = Math.round(camera.eye.elements[2] + fz * 1.5);
    return [Math.max(0,Math.min(MAP_SIZE-1,mx)), Math.max(0,Math.min(MAP_SIZE-1,mz))];
}
function addBlockAhead() {
    let [x,z] = getMapCellAhead();
    if (worldMap[x][z] < 4) { worldMap[x][z]++; buildWorld(); setStory("Block added! (G=add H=delete)"); renderAllShapes(); canvas.focus(); }
}
function deleteBlockAhead() {
    let [x,z] = getMapCellAhead();
    if (worldMap[x][z] > 0) { worldMap[x][z]--; buildWorld(); setStory("Block removed!"); renderAllShapes(); canvas.focus(); }
}

// ============================================================
// COLLECTIBLES / STORY
// ============================================================
function checkCollectibles() {
    let ex = camera.eye.elements[0], ez = camera.eye.elements[2];
    collectibles.forEach(c => {
        if (c.collected) return;
        let dx = ex - c.worldX, dz = ez - c.worldZ;
        if (Math.sqrt(dx*dx + dz*dz) < 1.2) {
            c.collected = true;
            foodsCollected++;
            c.scale(0,0,0);
            let msg = foodsCollected < TOTAL_FOODS
                ? `✨ Golden food collected! ${foodsCollected}/${TOTAL_FOODS}`
                : "🎉 You found all golden foods! The Food Jungle is yours!";
            setStory(msg);
            buildWorld();
        }
    });
}

function setStory(msg) {
    let el = document.getElementById("story");
    if (el) el.innerText = msg;
}

// ============================================================
// SKY COLOR
// ============================================================
function updateSkyColor() {
    let z = camera.eye.elements[2];
    if (z > 13) {
        gl.clearColor(0.68, 0.88, 0.92, 1.0); // jungle bright aqua
    } else if (z > 7) {
        let t = (z-7)/6;
        gl.clearColor(
            0.04*(1-t)+0.68*t,
            0.02*(1-t)+0.88*t,
            0.06*(1-t)+0.92*t, 1.0
        );
    } else {
        gl.clearColor(0.04, 0.02, 0.06, 1.0); // dim room
    }
}

// ============================================================
// RENDER
// ============================================================
function renderAllShapes() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Follow animal if riding
    if (g_ridingTarget) {
        let tx, tz;
        if (g_ridingTarget === 'elephant') { 
            tx = 14 + 5*Math.sin(g_seconds*0.4); 
            tz = 20 + 3*Math.cos(g_seconds*0.6); 
        }
        else if (g_ridingTarget === 'spider') { 
            tx = 24 + 4*Math.cos(g_seconds*0.8); 
            tz = 18 + 2*Math.sin(g_seconds*1.6); 
        }
        else if (g_ridingTarget === 'marshmallow') { 
            tx = 6 + 6*Math.sin(g_seconds*0.5); 
            tz = 12 + 4*Math.cos(g_seconds*0.3); 
        }
        else if (g_ridingTarget === 'hippo') { 
            tx = 18 + 6*Math.cos(g_seconds*0.2); 
            tz = 26 + 4*Math.sin(g_seconds*0.2); 
        }

        if (tx !== undefined) {
            camera.eye.elements[0] = tx;
            camera.eye.elements[1] = 2.8; 
            camera.eye.elements[2] = tz - 0.5;
            camera.at.elements[0] = tx + 3 * Math.sin(g_seconds*0.3); 
            camera.at.elements[1] = 1.0;
            camera.at.elements[2] = tz + 6; 
            camera.updateView();
        }
    }

    gl.uniformMatrix4fv(u_viewMatrix_loc,       false, camera.viewMatrix.elements);
    gl.uniformMatrix4fv(u_projectionMatrix_loc,  false, camera.projectionMatrix.elements);

    // Draw static shapes
    for (let s of shapes) drawGeometry(s);
    
    // Draw dynamic jungle
    buildJungle();
}

function drawGeometry(g, skipBuffer=false) {
    g.modelMatrix.setIdentity();
    if (g.translationMatrix) g.modelMatrix.multiply(g.translationMatrix);
    if (g.rotationMatrix)    g.modelMatrix.multiply(g.rotationMatrix);
    if (g.scaleMatrix)       g.modelMatrix.multiply(g.scaleMatrix);
    gl.uniformMatrix4fv(u_ModelMatrix_loc, false, g.modelMatrix.elements);
    
    let texID = (g.texID !== undefined && g.texID >= 0 && textures[g.texID]) ? g.texID : -1;
    gl.uniform1i(u_texID_loc, texID);
    
    if (!skipBuffer) {
        gl.uniform1i(u_useUniformColor_loc, 0);
        gl.uniform1f(u_texColorWeight_loc, 1.0);
    }

    if (texID >= 0) {
        gl.activeTexture(gl.TEXTURE0 + texID);
        gl.bindTexture(gl.TEXTURE_2D, textures[texID]);
    }
    
    let F = Float32Array.BYTES_PER_ELEMENT;
    gl.bindBuffer(gl.ARRAY_BUFFER, g_vertexBuffer);
    if (!skipBuffer) {
        gl.bufferData(gl.ARRAY_BUFFER, g.vertices, gl.DYNAMIC_DRAW);
    }
    gl.vertexAttribPointer(g_a_Position, 3, gl.FLOAT, false, 8*F, 0);
    gl.vertexAttribPointer(g_a_Color,    3, gl.FLOAT, false, 8*F, 3*F);
    gl.vertexAttribPointer(g_a_UV,       2, gl.FLOAT, false, 8*F, 6*F);
    
    gl.drawArrays(gl.TRIANGLES, 0, 36);
}
