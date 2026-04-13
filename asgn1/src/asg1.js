let canvas, gl, a_Position, u_FragColor, u_Size;
let g_shapesList = []; 
let g_selectedColor = [1.0, 0.0, 0.0, 1.0];
let g_selectedSize = 10;
let g_selectedType = 'point';
let g_segments = 10;
let g_gameMode = false;

var VSHADER_SOURCE = `
  attribute vec4 a_Position;
  uniform float u_Size;
  void main() {
    gl_Position = a_Position;
    gl_PointSize = u_Size;
  }`;

var FSHADER_SOURCE = `
  precision mediump float;
  uniform vec4 u_FragColor;
  void main() {
    gl_FragColor = u_FragColor;
  }`;

function main() {
    setupWebGL();
    connectVariablesToGLSL();
    setupHtmlControls();
    canvas.onmousedown = function(ev) { if(g_gameMode) handleGameClick(ev); else click(ev); };
    canvas.onmousemove = function(ev) { if (ev.buttons == 1 && !g_gameMode) click(ev); };
    gl.clearColor(1.0, 1.0, 1.0, 1.0); // White background like paper
    gl.clear(gl.COLOR_BUFFER_BIT);
}

function setupWebGL() {
    canvas = document.getElementById('webgl');
    gl = canvas.getContext("webgl", { preserveDrawingBuffer: true });
}

function connectVariablesToGLSL() {
    if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) return;
    a_Position = gl.getAttribLocation(gl.program, 'a_Position');
    u_FragColor = gl.getUniformLocation(gl.program, 'u_FragColor');
    u_Size = gl.getUniformLocation(gl.program, 'u_Size');
}

function setupHtmlControls() {
    document.getElementById('clearButton').onclick = function() { g_shapesList = []; g_gameMode = false; renderAllShapes(); };
    document.getElementById('pointButton').onclick = function() { g_selectedType = 'point'; g_gameMode = false; };
    document.getElementById('triButton').onclick = function() { g_selectedType = 'triangle'; g_gameMode = false; };
    document.getElementById('circleButton').onclick = function() { g_selectedType = 'circle'; g_gameMode = false; };
    document.getElementById('recreateButton').onclick = function() { g_gameMode = false; drawMyPicture(); };
    document.getElementById('gameButton').onclick = function() { startDonkeyGame(); };
    document.getElementById('redSlider').oninput = function() { g_selectedColor[0] = this.value/100; };
    document.getElementById('greenSlider').oninput = function() { g_selectedColor[1] = this.value/100; };
    document.getElementById('blueSlider').oninput = function() { g_selectedColor[2] = this.value/100; };
    document.getElementById('sizeSlider').oninput = function() { g_selectedSize = this.value; };
    document.getElementById('segmentSlider').oninput = function() { g_segments = this.value; };
}

function click(ev) {
    let [x, y] = convertCoordinatesEventToGL(ev);
    let shape = (g_selectedType == 'point') ? new Point() : (g_selectedType == 'triangle' ? new Triangle() : new Circle());
    shape.position = [x, y];
    shape.color = g_selectedColor.slice();
    shape.size = g_selectedSize;
    g_shapesList.push(shape);
    renderAllShapes();
}

function convertCoordinatesEventToGL(ev) {
    var x = ev.clientX, y = ev.clientY, rect = ev.target.getBoundingClientRect();
    x = ((x - rect.left) - canvas.width/2)/(canvas.width/2);
    y = (canvas.height/2 - (y - rect.top))/(canvas.height/2);
    return [x, y];
}

function renderAllShapes() {
    gl.clear(gl.COLOR_BUFFER_BIT);
    for (var i = 0; i < g_shapesList.length; i++) g_shapesList[i].render();
}

function addPicTri(verts, color) {
    let t = new Triangle();
    t.color = color;
    t.render = function() {
        gl.uniform4f(u_FragColor, color[0], color[1], color[2], color[3]);
        drawTriangle(verts);
    };
    g_shapesList.push(t);
}

function drawMyPicture() {
    g_shapesList = [];
    gl.clearColor(0.85, 0.92, 1.0, 1.0); // light sky blue background

    const Y  = [1.0,  0.85, 0.0,  1.0];  // Yellow
    const LB = [0.5,  0.75, 1.0,  1.0];  // Light blue
    const PU = [0.35, 0.0,  0.5,  1.0];  // Purple
    const PK = [1.0,  0.55, 0.65, 1.0];  // Pink
    const GR = [0.0,  0.45, 0.1,  1.0];  // Green
    const DG = [0.0,  0.28, 0.05, 1.0];  // Dark green
    const WH = [1.0,  1.0,  1.0,  1.0];  // White

    // =============================================
    // LEFT CREATURE — "A" head, yellow wings
    // centered around x = -0.45
    // =============================================

    // --- Yellow wings: wide flat top ---
    addPicTri([-0.75, 0.72,  -0.15, 0.72,  -0.45, 0.52], Y);
    addPicTri([-0.75, 0.72,  -0.65, 0.52,  -0.45, 0.52], Y);
    addPicTri([-0.15, 0.72,  -0.25, 0.52,  -0.45, 0.52], Y);
    // Side spikes
    addPicTri([-0.75, 0.72,  -0.75, 0.52,  -0.95, 0.62], PU);
    addPicTri([-0.15, 0.72,  -0.15, 0.52,   0.05, 0.62], PU);
    // Lower yellow mid-wings
    addPicTri([-0.75, 0.52,  -0.55, 0.52,  -0.75, 0.35], Y);
    addPicTri([-0.15, 0.52,  -0.35, 0.52,  -0.15, 0.35], Y);
    // Purple neck/body connector
    addPicTri([-0.55, 0.52,  -0.35, 0.52,  -0.45, 0.35], PU);
    addPicTri([-0.55, 0.35,  -0.35, 0.35,  -0.45, 0.52], PU);

    // --- "A" HEAD (purple diamond = A shape) above wings ---
    // The letter A: two side triangles form an A silhouette
    // Left stroke of A
    addPicTri([-0.52, 0.72,  -0.45, 0.98,  -0.38, 0.72], PU);  // outer A triangle
    // Crossbar cutout (white notch to make it look like A)
    addPicTri([-0.50, 0.80,  -0.40, 0.80,  -0.45, 0.76], WH);

    // --- Pink chest block ---
    addPicTri([-0.65, 0.35,  -0.25, 0.35,  -0.65, 0.08], PK);
    addPicTri([-0.25, 0.35,  -0.25, 0.08,  -0.65, 0.08], PK);
    // Crown spikes on chest
    addPicTri([-0.62, 0.35,  -0.53, 0.35,  -0.575, 0.44], PK);
    addPicTri([-0.50, 0.35,  -0.40, 0.35,  -0.450, 0.44], PK);
    addPicTri([-0.37, 0.35,  -0.27, 0.35,  -0.320, 0.44], PK);

    // --- Green legs ---
    addPicTri([-0.60, 0.08,  -0.47, 0.08,  -0.535, -0.62], GR);
    addPicTri([-0.43, 0.08,  -0.30, 0.08,  -0.365, -0.62], GR);
    // Green feet
    addPicTri([-0.72, -0.52,  -0.40, -0.62,  -0.535, -0.62], GR);
    addPicTri([-0.25, -0.52,  -0.57, -0.62,  -0.365, -0.62], GR);

    // =============================================
    // RIGHT CREATURE — "Y" head, blue wings
    // centered around x = +0.45
    // =============================================

    // --- Light blue wings ---
    addPicTri([0.15, 0.72,  0.75, 0.72,  0.45, 0.52], LB);
    addPicTri([0.15, 0.72,  0.25, 0.52,  0.45, 0.52], LB);
    addPicTri([0.75, 0.72,  0.65, 0.52,  0.45, 0.52], LB);
    // Side spikes
    addPicTri([0.15, 0.72,  0.15, 0.52,  -0.05, 0.62], Y);
    addPicTri([0.75, 0.72,  0.75, 0.52,   0.95, 0.62], LB);
    // Lower mid-wings
    addPicTri([0.15, 0.52,  0.35, 0.52,  0.15, 0.35], Y);
    addPicTri([0.75, 0.52,  0.55, 0.52,  0.75, 0.35], LB);
    // Purple neck/body connector
    addPicTri([0.35, 0.52,  0.55, 0.52,  0.45, 0.35], PU);
    addPicTri([0.35, 0.35,  0.55, 0.35,  0.45, 0.52], PU);

    // --- "Y" HEAD above wings — wide, clear Y shape ---
    // Stem: tall thin rectangle made of 2 triangles
    addPicTri([0.42, 0.72,  0.48, 0.72,  0.42, 0.86], PU);
    addPicTri([0.48, 0.72,  0.48, 0.86,  0.42, 0.86], PU);
    // Left arm of Y: goes up-left from center point
    addPicTri([0.42, 0.86,  0.45, 0.86,  0.30, 0.99], PU);
    addPicTri([0.30, 0.99,  0.33, 0.99,  0.45, 0.86], PU);
    // Right arm of Y: goes up-right from center point
    addPicTri([0.45, 0.86,  0.48, 0.86,  0.60, 0.99], PU);
    addPicTri([0.60, 0.99,  0.57, 0.99,  0.45, 0.86], PU);

    // --- Pink chest block ---
    addPicTri([0.25, 0.35,  0.65, 0.35,  0.25, 0.08], PK);
    addPicTri([0.65, 0.35,  0.65, 0.08,  0.25, 0.08], PK);
    // Crown spikes
    addPicTri([0.28, 0.35,  0.37, 0.35,  0.325, 0.44], PK);
    addPicTri([0.40, 0.35,  0.50, 0.35,  0.450, 0.44], PK);
    addPicTri([0.53, 0.35,  0.63, 0.35,  0.580, 0.44], PK);

    // --- Dark green legs ---
    addPicTri([0.30, 0.08,  0.43, 0.08,  0.365, -0.62], DG);
    addPicTri([0.47, 0.08,  0.60, 0.08,  0.535, -0.62], DG);
    // Dark green feet
    addPicTri([0.18, -0.52,  0.50, -0.62,  0.365, -0.62], DG);
    addPicTri([0.72, -0.52,  0.40, -0.62,  0.535, -0.62], DG);

    renderAllShapes();
}

function startDonkeyGame() {
    g_gameMode = true;
    g_shapesList = [];
    gl.clearColor(0.5, 0.5, 0.5, 1.0);
    addPicTri([-0.3, -0.2, 0.3, -0.2, 0.0, 0.4], [0.4, 0.2, 0, 1]); 
    renderAllShapes();
    alert("Donkey Game: Click where the tail belongs!");
}

function handleGameClick(ev) {
    let [x, y] = convertCoordinatesEventToGL(ev);
    let tail = new Point();
    tail.position = [x, y]; tail.color = [0, 0, 0, 1]; tail.size = 20;
    g_shapesList.push(tail);
    renderAllShapes();
    if (x < -0.15 && y < 0.1) alert("Success!");
    else alert("Missed!");
}