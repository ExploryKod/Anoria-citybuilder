/**
 * InputManager - Centralizes mouse and keyboard input state
 * Non-invasive: not wired into the game yet; attach/detach when needed
 */

class InputManager {
    mouse = { x: 0, y: 0 };
    isLeftMouseDown = false;
    isMiddleMouseDown = false;
    isRightMouseDown = false;

    /**
     * Adds listeners to a specific target element for pointer and to document for keyboard
     * @param {HTMLElement} targetEl
     */
    attach(targetEl) {
        if (!targetEl) return;
        this.detach();
        this._target = targetEl;

        this._onMouseDown = this.#onMouseDown.bind(this);
        this._onMouseUp = this.#onMouseUp.bind(this);
        this._onMouseMove = this.#onMouseMove.bind(this);
        this._onContextMenu = (event) => event.preventDefault();

        this._target.addEventListener('mousedown', this._onMouseDown, false);
        this._target.addEventListener('mouseup', this._onMouseUp, false);
        this._target.addEventListener('mousemove', this._onMouseMove, false);
        this._target.addEventListener('contextmenu', this._onContextMenu, false);

        // Keyboard (optional expansion later)
        this._onKeyDown = this.#onKeyDown.bind(this);
        this._onKeyUp = this.#onKeyUp.bind(this);
        document.addEventListener('keydown', this._onKeyDown, false);
        document.addEventListener('keyup', this._onKeyUp, false);
    }

    /**
     * Removes previously attached listeners
     */
    detach() {
        if (!this._target) return;
        this._target.removeEventListener('mousedown', this._onMouseDown, false);
        this._target.removeEventListener('mouseup', this._onMouseUp, false);
        this._target.removeEventListener('mousemove', this._onMouseMove, false);
        this._target.removeEventListener('contextmenu', this._onContextMenu, false);
        document.removeEventListener('keydown', this._onKeyDown, false);
        document.removeEventListener('keyup', this._onKeyUp, false);
        this._target = null;
    }

    // Mouse handlers
    #onMouseDown(event) {
        if (event.button === 0) this.isLeftMouseDown = true;
        if (event.button === 1) this.isMiddleMouseDown = true;
        if (event.button === 2) this.isRightMouseDown = true;
    }

    #onMouseUp(event) {
        if (event.button === 0) this.isLeftMouseDown = false;
        if (event.button === 1) this.isMiddleMouseDown = false;
        if (event.button === 2) this.isRightMouseDown = false;
    }

    #onMouseMove(event) {
        // button bitmask on movement keeps state robust
        this.isLeftMouseDown = !!(event.buttons & 1);
        this.isRightMouseDown = !!(event.buttons & 2);
        this.isMiddleMouseDown = !!(event.buttons & 4);
        this.mouse.x = event.clientX;
        this.mouse.y = event.clientY;
    }

    // Keyboard handlers (expand as needed)
    #onKeyDown(_event) {}
    #onKeyUp(_event) {}
}

export default InputManager;


