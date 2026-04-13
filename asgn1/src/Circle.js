class Circle {
    constructor() {
        this.type = 'circle';
        this.position = [0.0, 0.0, 0.0];
        this.color = [1.0, 1.0, 1.0, 1.0];
        this.size = 5.0;
        this.segments = g_segments; // Uses global segment count
    }
    render() {
        gl.uniform4f(u_FragColor, this.color[0], this.color[1], this.color[2], this.color[3]);
        let d = this.size / 200.0;
        let step = 360 / this.segments;
        for (var angle = 0; angle < 360; angle += step) {
            let c1 = [Math.cos(angle * Math.PI / 180) * d, Math.sin(angle * Math.PI / 180) * d];
            let c2 = [Math.cos((angle + step) * Math.PI / 180) * d, Math.sin((angle + step) * Math.PI / 180) * d];
            drawTriangle([this.position[0], this.position[1], this.position[0] + c1[0], this.position[1] + c1[1], this.position[0] + c2[0], this.position[1] + c2[1]]);
        }
    }
}
