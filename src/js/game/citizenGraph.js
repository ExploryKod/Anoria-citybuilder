import * as THREE from 'three';
class citizenGraph extends THREE.Group {

    constructor(size, assets) {
        super()
        this.size = size;
        this.assets = assets
        // citizen graph tile
        this.tiles = []

        // Citizen graph tiles array
        for(let x = 0; x < this.size; x++) {
            const column = [];
            for(let y = 0; y < this.size; y++) {
                column.push(null);
            }
            this.tiles.push(column);
        }
    }

    getTile(x, y) {
        if (x >= 0 && x < this.size && y >= 0 && y < this.size) {
            return this.tiles[x][y];
        } else {
            return null;
        }
    }
}