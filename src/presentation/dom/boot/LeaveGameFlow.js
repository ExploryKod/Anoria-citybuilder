import { deleteGameDatabase } from '../../../core/persistence/dexie/db.js';
import loaderManager from '../shell/LoaderManager.js';
import { confirmModal } from '../shell/ConfirmModal.js';

/**
 * The door of the game (top left) leaves the game: the whole database is deleted, the cheat codes with it (they belong to the game they were typed in), and the player
 * goes back to the home page. No database is left behind: the next game creates its own while it loads. A game is not kept once left; a plain reload of the page,
 * which does not go through the door, still resumes it.
 *
 * A confirmation comes first ("Quitter la partie ?"); declining it, with the button or Escape, leaves the game exactly as it was.
 *
 * The loader "Suppression des données de la partie…" covers the game while it goes (the full-screen loader takes the clicks). The game is paused first, so no turn is
 * writing while the database goes. If the deletion fails the game is resumed and the error is raised, so the player is never left on a paused game with half a database.
 *
 * @param {{ pauseGame: () => void, playGame: () => void }} deps
 */
export function initLeaveGame({ pauseGame, playGame }) {
  const door = document.getElementById('game-exit-home-btn');
  if (!door) throw new Error('LeaveGameFlow: #game-exit-home-btn is missing from game.html');
  let asking = false;
  let leaving = false;

  door.addEventListener('click', async (event) => {
    // A click that opens the link elsewhere (a new tab, a new window) does not leave this game.
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (leaving || asking) return;
    // Leaving deletes the game for good: the player is asked first, and "no" changes nothing (the game goes on as it was, not paused, not touched).
    asking = true;
    const confirmed = await confirmModal({
      title: 'Quitter la partie ?',
      message: 'Les données de la partie seront supprimées définitivement. Cette action est irréversible.',
      confirmLabel: 'Quitter et supprimer',
      cancelLabel: 'Annuler',
    });
    asking = false;
    if (!confirmed) return;
    leaving = true;
    // The loader covers the game while the data goes: the player sees what is happening and cannot act on a game that is being deleted.
    loaderManager.show('Suppression des données de la partie…');
    pauseGame();
    try {
      await deleteGameDatabase();
    } catch (error) {
      leaving = false;
      loaderManager.hide();
      playGame();
      throw new Error(`[leave] the game was not left: ${error.message}`, { cause: error });
    }
    // The loader stays up until the home page replaces the game.
    window.location.assign(door.href);
  });
}
