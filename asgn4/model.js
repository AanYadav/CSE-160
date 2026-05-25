// Generates a UV-sphere OBJ string (slices x stacks divisions)
// Returns a valid OBJ with v, vn, vt and triangulated f lines
function generateSphereOBJ(slices, stacks) {
    let vLines = [], vnLines = [], vtLines = [], fLines = [];
    let W = slices + 1;

    for (let i = 0; i <= stacks; i++) {
        let phi   = Math.PI * i / stacks;
        let sinPhi = Math.sin(phi), cosPhi = Math.cos(phi);
        for (let j = 0; j <= slices; j++) {
            let theta    = 2 * Math.PI * j / slices;
            let sinTheta = Math.sin(theta), cosTheta = Math.cos(theta);
            let x = sinPhi * cosTheta;
            let y = cosPhi;
            let z = sinPhi * sinTheta;
            vLines.push(`v ${x.toFixed(5)} ${y.toFixed(5)} ${z.toFixed(5)}`);
            vnLines.push(`vn ${x.toFixed(5)} ${y.toFixed(5)} ${z.toFixed(5)}`);
            vtLines.push(`vt ${(j/slices).toFixed(5)} ${(1 - i/stacks).toFixed(5)}`);
        }
    }

    for (let i = 0; i < stacks; i++) {
        for (let j = 0; j < slices; j++) {
            let a = i * W + j + 1;
            let b = a + W;
            let c = a + 1;
            let d = b + 1;
            fLines.push(`f ${a}/${a}/${a} ${b}/${b}/${b} ${c}/${c}/${c}`);
            fLines.push(`f ${b}/${b}/${b} ${d}/${d}/${d} ${c}/${c}/${c}`);
        }
    }

    return [...vLines, ...vnLines, ...vtLines, ...fLines].join('\n');
}

const SAMPLE_OBJ = generateSphereOBJ(16, 16);

class ObjModel extends geometry {
    constructor(objString) {
        super();
        this.vertices = new Float32Array();
        this.parse(objString);
    }

    parse(objStr) {
        let lines    = objStr.split('\n');
        let positions  = [];
        let normals    = [];
        let texcoords  = [];
        let finalVerts = [];

        for (let line of lines) {
            line = line.trim();
            if (!line || line.startsWith('#')) continue;
            let parts = line.split(/\s+/);
            switch (parts[0]) {
                case 'v':
                    positions.push([parseFloat(parts[1]),
                                    parseFloat(parts[2]),
                                    parseFloat(parts[3])]);
                    break;
                case 'vn':
                    normals.push([parseFloat(parts[1]),
                                  parseFloat(parts[2]),
                                  parseFloat(parts[3])]);
                    break;
                case 'vt':
                    texcoords.push([parseFloat(parts[1]),
                                    parseFloat(parts[2])]);
                    break;
                case 'f':
                    // Triangles only (3 vertex refs after 'f')
                    for (let i = 1; i <= 3; i++) {
                        let idx  = parts[i].split('/');
                        let pi   = parseInt(idx[0]) - 1;
                        let ti   = idx[1] !== undefined && idx[1] !== '' ? parseInt(idx[1]) - 1 : -1;
                        let ni   = idx[2] !== undefined && idx[2] !== '' ? parseInt(idx[2]) - 1 : -1;

                        let pos  = positions[pi]  || [0, 0, 0];
                        let norm = (ni >= 0 && normals[ni]) ? normals[ni] : [pos[0], pos[1], pos[2]];
                        let tex  = (ti >= 0 && texcoords[ti]) ? texcoords[ti] : [0, 0];

                        // x,y,z, r,g,b, u,v, nx,ny,nz
                        finalVerts.push(
                            pos[0],  pos[1],  pos[2],
                            0.8,     0.8,     0.8,
                            tex[0],  tex[1],
                            norm[0], norm[1], norm[2]
                        );
                    }
                    break;
            }
        }
        this.vertices = new Float32Array(finalVerts);
    }

    setColor(r, g, b) {
        for (let i = 0; i < this.vertices.length; i += 11) {
            this.vertices[i+3] = r;
            this.vertices[i+4] = g;
            this.vertices[i+5] = b;
        }
    }
}
