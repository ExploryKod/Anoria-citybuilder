import * as THREE from 'three';

const SELECTED_COLOR = 0xaaaa55;
const HIGHLIGHTED_COLOR = 0x555555;

class SimObject extends THREE.Object3D {
    #mesh = null;
    #worldPos = new THREE.Vector3();

    constructor(x = 0, y = 0) {
        super();
        this.position.x = x;
        this.position.z = y;
        this.name = 'SimObject';
    }

    get x() {
        this.getWorldPosition(this.#worldPos);
        return Math.floor(this.#worldPos.x);
    }

    get y() {
        this.getWorldPosition(this.#worldPos);
        return Math.floor(this.#worldPos.z);
    }

    get mesh() {
        return this.#mesh;
    }

    setMesh(value) {
        if (this.#mesh) {
            this.dispose();
            this.remove(this.#mesh);
        }
        this.#mesh = value;
        if (this.#mesh) {
            this.add(this.#mesh);
        }
    }

    setSelected(value) {
        this.#setMeshEmission(value ? SELECTED_COLOR : 0);
    }

    setFocused(value) {
        this.#setMeshEmission(value ? HIGHLIGHTED_COLOR : 0);
    }

    #setMeshEmission(color) {
        if (!this.#mesh) return;
        this.#mesh.traverse((obj) => obj.material?.emissive?.setHex(color));
    }

    dispose() {
        if (!this.#mesh) return;
        this.#mesh.traverse((obj) => {
            if (obj.material) {
                obj.material?.dispose();
            }
        });
    }
}

export default SimObject;


