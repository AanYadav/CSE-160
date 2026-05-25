class triangle extends geometry{
  constructor(){
    super();
    this.vertices = new Float32Array([
      // format: x, y, z,   r, g, b,   u, v,   nx, ny, nz
      -0.5, -0.5, 0.0,  1.0, 0.0, 0.0,  0.0, 0.0,   0.0, 0.0, 1.0, // a: bottom left
       0.5, -0.5, 0.0,  0.0, 1.0, 0.0,  1.0, 0.0,   0.0, 0.0, 1.0, // b: bottom right
       0.0,  0.5, 0.0,  0.0, 0.0, 1.0,  0.5, 1.0,   0.0, 0.0, 1.0  // c: top point
    ]);
  }
}
