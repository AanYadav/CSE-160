var canvas;
var ctx;

function main() {
  canvas = document.getElementById('example');
  if (!canvas) { console.log('Failed to retrieve the <canvas> element'); return; }
  ctx = canvas.getContext('2d');
  drawBlackCanvas();
  var v1 = new Vector3([2.25, 2.25, 0]);
  drawVector(v1, 'red');
}

function drawBlackCanvas() {
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawVector(v, color) {
  var cx = canvas.width / 2;
  var cy = canvas.height / 2;
  var scale = 20;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + v.elements[0] * scale, cy - v.elements[1] * scale);
  ctx.stroke();
}

function handleDrawEvent() {
  drawBlackCanvas();
  var x1 = parseFloat(document.getElementById('v1x').value) || 0;
  var y1 = parseFloat(document.getElementById('v1y').value) || 0;
  var x2 = parseFloat(document.getElementById('v2x').value) || 0;
  var y2 = parseFloat(document.getElementById('v2y').value) || 0;
  drawVector(new Vector3([x1, y1, 0]), 'red');
  drawVector(new Vector3([x2, y2, 0]), 'blue');
}

function handleDrawOperationEvent() {
  drawBlackCanvas();
  var x1 = parseFloat(document.getElementById('v1x').value) || 0;
  var y1 = parseFloat(document.getElementById('v1y').value) || 0;
  var x2 = parseFloat(document.getElementById('v2x').value) || 0;
  var y2 = parseFloat(document.getElementById('v2y').value) || 0;
  var scalar = parseFloat(document.getElementById('scalar').value) || 1;
  var op = document.getElementById('operation').value;

  var v1 = new Vector3([x1, y1, 0]);
  var v2 = new Vector3([x2, y2, 0]);
  drawVector(v1, 'red');
  drawVector(v2, 'blue');

  if (op === 'add') {
    var v3 = new Vector3([x1, y1, 0]);
    v3.add(new Vector3([x2, y2, 0]));
    drawVector(v3, 'green');
  } else if (op === 'sub') {
    var v3 = new Vector3([x1, y1, 0]);
    v3.sub(new Vector3([x2, y2, 0]));
    drawVector(v3, 'green');
  } else if (op === 'mul') {
    var v3 = new Vector3([x1, y1, 0]);
    var v4 = new Vector3([x2, y2, 0]);
    v3.mul(scalar); v4.mul(scalar);
    drawVector(v3, 'green');
    drawVector(v4, 'green');
  } else if (op === 'div') {
    var v3 = new Vector3([x1, y1, 0]);
    var v4 = new Vector3([x2, y2, 0]);
    v3.div(scalar); v4.div(scalar);
    drawVector(v3, 'green');
    drawVector(v4, 'green');
  } else if (op === 'magnitude') {
    console.log('Magnitude of v1: ' + v1.magnitude());
    console.log('Magnitude of v2: ' + v2.magnitude());
    var n1 = new Vector3([x1, y1, 0]); n1.normalize();
    var n2 = new Vector3([x2, y2, 0]); n2.normalize();
    drawVector(n1, 'green');
    drawVector(n2, 'green');
  } else if (op === 'normalize') {
    console.log('Magnitude of v1: ' + v1.magnitude());
    console.log('Magnitude of v2: ' + v2.magnitude());
    var n1 = new Vector3([x1, y1, 0]); n1.normalize();
    var n2 = new Vector3([x2, y2, 0]); n2.normalize();
    drawVector(n1, 'green');
    drawVector(n2, 'green');
  } else if (op === 'angle') {
    console.log('Angle between v1 and v2: ' + angleBetween(v1, v2) + ' degrees');
  } else if (op === 'area') {
    console.log('Area of triangle: ' + areaTriangle(v1, v2));
  }
}

function angleBetween(v1, v2) {
  var dot = Vector3.dot(v1, v2);
  var mag1 = v1.magnitude();
  var mag2 = v2.magnitude();
  if (mag1 === 0 || mag2 === 0) return 0;
  var cosAlpha = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return Math.acos(cosAlpha) * (180 / Math.PI);
}

function areaTriangle(v1, v2) {
  return 0.5 * Vector3.cross(v1, v2).magnitude();
}

window.onload = main;