class square extends geometry{
  constructor(){
    super();
    this.vertices = new Float32Array([
      // format: x, y, z,   r, g, b,   u, v,   nx, ny, nz
      // Triangle 1
      -1.0,  1.0, 0.0,  1.0, 0.0, 0.0,  0.0, 1.0,   0.0, 0.0, 1.0, // top left
      -1.0, -1.0, 0.0,  0.0, 1.0, 0.0,  0.0, 0.0,   0.0, 0.0, 1.0, // bottom left
       1.0, -1.0, 0.0,  0.0, 0.0, 1.0,  1.0, 0.0,   0.0, 0.0, 1.0, // bottom right
      // Triangle 2
      -1.0,  1.0, 0.0,  1.0, 0.0, 0.0,  0.0, 1.0,   0.0, 0.0, 1.0, // top left
       1.0,  1.0, 0.0,  0.0, 1.0, 0.0,  1.0, 1.0,   0.0, 0.0, 1.0, // top right
       1.0, -1.0, 0.0,  0.0, 0.0, 1.0,  1.0, 0.0,   0.0, 0.0, 1.0  // bottom right
    ]);
  }
}
