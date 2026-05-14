// Camera class – rubric-compliant with Vector3 math and Matrix4 rotations
class Camera {
    constructor(canvas) {
        this.fov = 60;
        this.eye = new Vector3([16, 2, 16]); // Middle of jungle
        this.at  = new Vector3([16, 2, 20]); // Looking into deeper jungle
        this.up  = new Vector3([ 0, 1,  0]);

        this.viewMatrix = new Matrix4();
        this.updateView();

        this.projectionMatrix = new Matrix4();
        this.projectionMatrix.setPerspective(
            this.fov, canvas.width / canvas.height, 0.1, 1000
        );
    }

    updateView() {
        this.viewMatrix.setLookAt(
            this.eye.elements[0], this.eye.elements[1], this.eye.elements[2],
            this.at.elements[0],  this.at.elements[1],  this.at.elements[2],
            this.up.elements[0],  this.up.elements[1],  this.up.elements[2]
        );
    }

    moveForward(speed = 0.2) {
        let f = new Vector3(); f.set(this.at); f.sub(this.eye);
        f.normalize(); f.mul(speed);
        this.eye.add(f); this.at.add(f);
        this.updateView();
    }

    moveBackward(speed = 0.2) {
        let b = new Vector3(); b.set(this.eye); b.sub(this.at);
        b.normalize(); b.mul(speed);
        this.eye.add(b); this.at.add(b);
        this.updateView();
    }

    moveLeft(speed = 0.2) {
        let f = new Vector3(); f.set(this.at); f.sub(this.eye);
        let s = Vector3.cross(this.up, f);
        s.normalize(); s.mul(speed);
        this.eye.add(s); this.at.add(s);
        this.updateView();
    }

    moveRight(speed = 0.2) {
        let f = new Vector3(); f.set(this.at); f.sub(this.eye);
        let s = Vector3.cross(f, this.up);
        s.normalize(); s.mul(speed);
        this.eye.add(s); this.at.add(s);
        this.updateView();
    }

    // Rotate 'at' around 'up' by alpha degrees
    panLeft(alpha) {
        let f = new Vector3(); f.set(this.at); f.sub(this.eye);
        let rot = new Matrix4();
        rot.setRotate(alpha, this.up.elements[0], this.up.elements[1], this.up.elements[2]);
        let fp = rot.multiplyVector3(f);
        this.at = new Vector3([
            this.eye.elements[0] + fp.elements[0],
            this.eye.elements[1] + fp.elements[1],
            this.eye.elements[2] + fp.elements[2]
        ]);
        this.updateView();
    }

    panRight(alpha) { this.panLeft(-alpha); }
}
