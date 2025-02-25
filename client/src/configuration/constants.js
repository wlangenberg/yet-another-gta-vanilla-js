const allEntities = []
const keys = {}

const gravity = 2480;
const DAY_LENGTH = 240
const SUN_NIGHT_THRESHOLD = 2000

const STATE = {
    myPlayer: null,
}

const LAYERS = {
    BACKGROUND: 0,
    WORLD: 1,
    PLAYER: 2,
    FOREGROUND: 3
};

export { keys, gravity, allEntities, DAY_LENGTH, SUN_NIGHT_THRESHOLD, STATE, LAYERS };
