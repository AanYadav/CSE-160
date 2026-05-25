class sphere extends geometry {
    constructor() {
        super();
        this.vertices = [];

        let SPHERE_DIV = 13;
        for (let j = 0; j <= SPHERE_DIV; j++) {
            let aj = j * Math.PI / SPHERE_DIV;
            let sj = Math.sin(aj);
            let cj = Math.cos(aj);
            for (let i = 0; i <= SPHERE_DIV; i++) {
                let ai = i * 2 * Math.PI / SPHERE_DIV;
                let si = Math.sin(ai);
                let ci = Math.cos(ai);

                // x, y, z
                let x = si * sj;
                let y = cj;
                let z = ci * sj;

                // Color (r, g, b)
                let r = 1.0;
                let g = 1.0;
                let b = 1.0;

                // uv
                let u = i / SPHERE_DIV;
                let v = j / SPHERE_DIV;

                // Normal
                let nx = x;
                let ny = y;
                let nz = z;

                this.vertices.push(x, y, z, r, g, b, u, v, nx, ny, nz);
            }
        }

        let indices = [];
        for (let j = 0; j < SPHERE_DIV; j++) {
            for (let i = 0; i < SPHERE_DIV; i++) {
                let p1 = j * (SPHERE_DIV + 1) + i;
                let p2 = p1 + (SPHERE_DIV + 1);

                indices.push(p1, p2, p1 + 1);
                indices.push(p1 + 1, p2, p2 + 1);
            }
        }

        // Unroll indices into flat Float32Array to match drawArrays(TRIANGLES)
        let finalArray = [];
        for (let i = 0; i < indices.length; i++) {
            let idx = indices[i];
            let offset = idx * 11;
            for(let k=0; k<11; k++){
                finalArray.push(this.vertices[offset + k]);
            }
        }
        
        this.vertices = new Float32Array(finalArray);
    }

    setColor(r, g, b) {
        for (let i = 0; i < this.vertices.length; i += 11) {
            this.vertices[i + 3] = r;
            this.vertices[i + 4] = g;
            this.vertices[i + 5] = b;
        }
    }
}
