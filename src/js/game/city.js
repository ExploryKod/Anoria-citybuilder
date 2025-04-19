export function createCity(size) {
    const tiles = [];
    const neighbors = [];

    initialize();

    function initialize() {
        for(let x = 0; x < size; x++) {
            const column = [];
            for(let y = 0; y < size; y++) {
             const tile = createTile(x,y);
             column.push(tile);
            }
            tiles.push(column);
        }
    }

    function update() {
        for(let x = 0; x < size; x++) {
            for(let y = 0; y < size; y++) {
                tiles[x][y].update();
            }
        }
    }

    return  {
        size,
        tiles,
        update,
    }
}

function createTile(x,y) {
    return { 
        x, 
        y, 
        terrainId: 'grass',
        neighbors: [],
        buildingId: undefined,
        buildingCoord: undefined,
        tileLeft: x-1,
        tileRight: x+1,
        tileTop: y+1,
        tileBottom: y-1,
        player: "",
        update(){
          //  const x = Math.random();
          //
          //  if(x) {
          //  if(this.buildingId === 'House-Red') {
          //       this.buildingId = 'House-Purple';
          //   } else if(this.buildingId === 'House-Blue') {
          //       this.buildingId = 'House-Red';
          //   }
          // }
        }
    };
}

function getTile(x, y, tiles, size) {
    if (x === undefined || y === undefined ||
        x < 0 || y < 0 ||
        x >= size || y >= size) {
        return null;
    } else {
        return tiles[x][y];
    }
}
function getVicinityTile(x, y, tiles, size) {
    const neighbors = [];

    if (x > 0) {
        neighbors.push(getTile(x - 1, y, tiles, size));
    }
    if (x < size - 1) {
        neighbors.push(getTile(x + 1, y, tiles, size));
    }
    if (y > 0) {
        neighbors.push(getTile(x, y - 1, tiles, size));
    }
    if (y < size - 1) {
        neighbors.push(getTile(x, y + 1, tiles, size));
    }
    console.log('Vicinity tiles ', neighbors)
    return neighbors;
}