/**
 * TutorialPanel — popup tutoriel (DOM + événements).
 */
import EventBlocker from '../shell/EventBlocker.js';

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

class TutorialPanel {
    /**
     * @param {{
     *   pauseGame?: () => void,
     *   playGame?: () => void,
     *   registerAppService?: (name: string, instance: *) => void,
     *   registerAppFunction?: (name: string, fn: Function) => void,
     *   getTutorialManager?: () => object | null,
     *   invokeStartTutorial?: () => boolean | void,
     * }} deps
     */
    constructor(deps) {
        this.deps = deps;
        this.panel = null;
        this.currentStep = 0;
        this.steps = [];
        this.isVisible = false;
        this.isInitialized = false;
        this.eventBlocker = new EventBlocker();
        /** @type {HTMLElement | null} */
        this.lastFocusedElement = null;
        this.handleDocumentKeyDown = this.handleDocumentKeyDown.bind(this);
    }

    init() {
        if (this.isInitialized) return;
        if (typeof document === 'undefined') return;
        
        this.panel = document.getElementById('tutorial-panel');
        if (!this.panel) {
            console.error('Tutorial panel not found in DOM');
            return;
        }

        this.setupEventListeners();
        this.setupDefaultSteps();
        this.isInitialized = true;

    }

    /**
     * Configure les event listeners
     */
    setupEventListeners() {
        const previousBtn = this.panel.querySelector('.tutorial-previous-btn');
        const nextBtn = this.panel.querySelector('.tutorial-next-btn');
        const closeBtn = this.panel.querySelector('.tutorial-close-btn');
        const rulesBtn = this.panel.querySelector('.tutorial-rules-btn');

        if (rulesBtn) {
            rulesBtn.addEventListener('click', () => this.toggleRules());
        }

        if (previousBtn) {
            previousBtn.addEventListener('click', () => this.previousStep());
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.nextStep());
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeTutorial());
        }
    }

    /**
     * @returns {HTMLElement[]}
     */
    getFocusableElements() {
        if (!this.panel) return [];
        return [...this.panel.querySelectorAll(FOCUSABLE_SELECTOR)].filter((el) => {
            if (!(el instanceof HTMLElement)) return false;
            if (el.closest('[hidden]')) return false;
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden';
        });
    }

    focusPrimaryAction() {
        const nextBtn = this.panel?.querySelector('.tutorial-next-btn');
        const closeBtn = this.panel?.querySelector('.tutorial-close-btn');
        const target = (nextBtn instanceof HTMLElement && nextBtn.offsetParent !== null)
          ? nextBtn
          : (closeBtn instanceof HTMLElement ? closeBtn : null);
        target?.focus();
    }

    handleDocumentKeyDown(event) {
        if (!this.isVisible || !this.panel) return;

        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            this.closeTutorial();
            return;
        }

        if (event.key !== 'Tab') return;

        const focusables = this.getFocusableElements();
        event.preventDefault();
        event.stopPropagation();

        if (focusables.length === 0) {
            this.panel.focus();
            return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        const currentIndex =
            active instanceof HTMLElement ? focusables.indexOf(active) : -1;

        if (event.shiftKey) {
            if (currentIndex <= 0) {
                last.focus();
            } else {
                focusables[currentIndex - 1].focus();
            }
            return;
        }

        if (currentIndex === -1 || currentIndex >= focusables.length - 1) {
            first.focus();
        } else {
            focusables[currentIndex + 1].focus();
        }
    }

    /**
     * Configure les étapes par défaut
     */
    setupDefaultSteps() {
        this.storySteps = [
            {
                title: 'Bienvenue, fondateur !',
                content: `
                    <p>Vous avez pris la route de l'exil, et cette route vous a menés sur la <strong>terre des hameaux</strong>.</p>
                    <p>Ici, chaque île est si petite qu'elle ne peut porter que <strong>peu d'habitants et de bâtiments</strong>. Personne n'y a le luxe de gaspiller : chacun est passé maître dans l'art de gérer son économie.</p>
                `
            },
            {
                title: 'Trois savoir-faire',
                content: `
                    <p>Des exilés de cultures différentes cohabitent ici, chacun avec son savoir-faire :</p>
                    <ul>
                        <li><strong>Les Artisans</strong> qui produisent et transforment ;</li>
                        <li><strong>Les Commerçants</strong> qui font circuler les biens ;</li>
                        <li><strong>Les Savants</strong> qui soignent, enseignent et éclairent.</li>
                    </ul>
                    <p>Aucun ne peut prospérer seul. Votre rôle sera de les faire vivre ensemble.</p>
                `
            },
            {
                title: 'Un trésor inespéré',
                content: `
                    <p>En chemin, vous avez trouvé un <strong>petit trésor</strong>. Peu d'exilés ont cette chance.</p>
                    <p>Il suffit pour fonder votre <strong>premier hameau</strong>. Mais attention : ici, chacun se débrouille comme il peut, <strong>sans loi ni maître</strong>. À vous de poser les premières routes, les premières maisons, les premières règles.</p>
                `
            },
            {
                title: 'Refonder une ville',
                content: `
                    <p>Votre but : convaincre d'autres exilés de vous rejoindre, fonder <strong>plusieurs hameaux</strong> et, ensemble, <strong>refonder une ville</strong> capable d'offrir à ses habitants plus de biens et plus de services, pour retrouver un confort de vie optimal.</p>
                    <p>La <strong>coopération</strong> rapporte bien plus que l'agressivité.</p>
                `
            },
            {
                title: 'Gagner le cœur des cités voisines',
                content: `
                    <p>Ménagez vos voisins et gagnez leur estime : les cités alentour vous proposeront des <strong>biens introuvables ici</strong>, qui attireront à leur tour de nouveaux exilés sur vos terres.</p>
                    <p>Toutes les terres ne se valent pas : selon les cas, elles sont plus ou moins accueillantes et chaque nouveau hameau vous réservera ses <strong>défis</strong>.</p>
                    <p>Et vous n'êtes pas au bout de vos surprises…</p>
                    <p><em>Envie de comprendre les mécanismes ? Le bouton « Règles » détaille le fonctionnement du jeu.</em></p>
                `
            }
        ];

        // Volontairement sans aucun chiffre : coûts, portées, durées et seuils
        // évoluent avec l'équilibrage. Ne décrire ici que les principes stables.
        this.rulesSteps = [
            {
                title: 'Mécanismes du jeu :',
                content: `
                    <p>Un hameau qui prospère, c'est une boucle :</p>
                    <p><strong>des maisons</strong> abritent des habitants, qui ont des <strong>compétences</strong>, qui font fonctionner des <strong>bâtiments</strong>, qui rendent des <strong>services</strong>, qui permettent aux maisons de <strong>s'améliorer</strong>.</p>
                    <p>Les pages suivantes détaillent chaque maillon.</p>
                `
            },
            {
                title: 'Les routes',
                content: `
                    <p>Chaque bâtiment doit être <strong>relié à une route</strong>, sinon il ne sert à rien.</p>
                    <p>Les routes ne sont pas que du décor : ce sont elles qui portent les marchandises et les services. Un bâtiment n'aide que les maisons qu'il peut <strong>rejoindre en suivant les routes</strong>, dans sa zone d'action. Une maison trop loin, ou coupée du réseau, n'est pas servie.</p>
                `
            },
            {
                title: 'Produire et distribuer',
                content: `
                    <p>Les biens suivent un trajet : les <strong>producteurs</strong> (fermes, ateliers…) fabriquent, les <strong>marchés</strong> distribuent, les <strong>maisons</strong> consomment.</p>
                    <p>Si un maillon manque ou est trop éloigné, la suite de la chaîne reste vide. Une ferme sans marché à proximité ne nourrit personne.</p>
                    <p>La production et la vente suivent le rythme des <strong>saisons</strong>. Pensez à faire des stocks.</p>
                `
            },
            {
                title: 'Les services',
                content: `
                    <p>Chapelle, médecin, bains, taverne, école, cinéma… chaque service couvre les maisons proches par la route.</p>
                    <p>Un service est utile <strong>seulement s'il est actif</strong> : il lui faut du personnel (voir « Travailleurs »). Un bâtiment de service vide ne couvre personne.</p>
                `
            },
            {
                title: 'Faire évoluer une maison',
                content: `
                    <p>Une maison commence tout en bas. Pour monter d'un cran, elle doit remplir les conditions du niveau suivant : être reliée à une route, être couverte par certains services, avoir de quoi se nourrir, et parfois disposer de plusieurs sortes de biens.</p>
                    <p>Les conditions <strong>s'additionnent</strong> : un niveau élevé demande tout ce que demandaient les niveaux précédents, plus de nouveaux services.</p>
                    <p>Attention : si un service disparaît ou n'atteint plus la maison, elle <strong>redescend</strong>. Une belle maison est un équilibre à entretenir.</p>
                `
            },
            {
                title: 'Artisans, Commerçants, Savants',
                content: `
                    <p>Chaque maison accueille l'un de ces trois groupes.</p>
                    <p>En progressant, ses habitants apprennent de nouvelles <strong>compétences</strong> : spirituelle, médicale, enseignement, vente… Plus la maison est évoluée, plus ses habitants sont qualifiés.</p>
                    <p>Une même compétence peut monter en niveau au fil des paliers. Un habitant très qualifié peut aussi tenir un poste plus simple de la même compétence.</p>
                `
            },
            {
                title: 'Travailleurs',
                content: `
                    <p>La plupart des bâtiments ont besoin de <strong>travailleurs</strong>. Chaque poste demande une <strong>compétence précise</strong> : seul un habitant qui la possède peut l'occuper.</p>
                    <p>Un habitant ne travaille que dans un bâtiment à la fois. Sans personnel qualifié, un bâtiment tourne au ralenti ou s'arrête.</p>
                    <p><strong>Astuce :</strong> pour qu'un médecin ouvre ses portes, il faut d'abord des maisons assez évoluées pour former des habitants compétents en médecine.</p>
                `
            },
            {
                title: 'Argent et imprévus',
                content: `
                    <p>Construire coûte de l'argent, puis de l'entretien chaque mois. Vos habitants rapportent des impôts : gardez vos <strong>revenus</strong> au-dessus de vos <strong>dépenses</strong>.</p>
                    <p>Un hameau qui s'étend trop vite sans rentrées s'endette.</p>
                    <p>Des événements imprévus (tempêtes, sécheresses, récessions…) viendront bousculer vos équilibres. Gardez une réserve.</p>
                `
            }
        ];

        this.mode = 'story';
        this.steps = this.storySteps;
    }

    /**
     * Bascule entre l'histoire et les règles.
     */
    toggleRules() {
        this.mode = this.mode === 'rules' ? 'story' : 'rules';
        this.steps = this.mode === 'rules' ? this.rulesSteps : this.storySteps;
        this.currentStep = 0;
        this.updateDisplay();
        this.focusPrimaryAction();
    }

    /**
     * Désactive les événements Three.js (clavier / souris jeu), pas ceux du dialogue.
     */
    disableThreeJSEvents() {
        this.eventBlocker.blockThreeJSEvents({
            excludeSelectors: [
                '#tutorial-panel',
                '#tutorial-panel *',
                '.tutorial-panel',
                '.tutorial-panel *',
            ],
            onBlock: () => {},
        });
    }

    /**
     * Réactive les événements Three.js
     */
    enableThreeJSEvents() {
        this.eventBlocker.unblockEvents();
    }

    /**
     * Affiche le tutoriel
     */
    showTutorial() {
        if (!this.isInitialized) {
            this.init();
        }

        this.mode = 'story';
        this.steps = this.storySteps;
        this.currentStep = 0;
        this.updateDisplay();
        this.lastFocusedElement = document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
        this.panel.hidden = false;
        this.panel.setAttribute('aria-hidden', 'false');
        this.panel.classList.add('visible');
        this.isVisible = true;
        
        // Désactiver les événements Three.js
        this.disableThreeJSEvents();
        document.getElementById('game-window')?.setAttribute('inert', '');
        
        // Mettre le jeu en pause
        this.deps.pauseGame?.();

        document.addEventListener('keydown', this.handleDocumentKeyDown, true);
        requestAnimationFrame(() => {
            this.focusPrimaryAction();
        });
    }

    /**
     * @param {HTMLElement | null | undefined} el
     * @returns {boolean}
     */
    isPracticallyFocusable(el) {
        if (!(el instanceof HTMLElement)) return false;
        if (!document.contains(el)) return false;
        if (el.closest('[inert]')) return false;
        if (el.closest('[hidden]')) return false;
        if (el.getAttribute('aria-hidden') === 'true') return false;
        if (el.disabled) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    /**
     * After closing, land on a visible HUD control — avoid Tab ghosts (hidden pause / placement).
     */
    restoreFocusAfterClose() {
        const last = this.lastFocusedElement;
        this.lastFocusedElement = null;
        if (this.isPracticallyFocusable(last) && last !== this.panel) {
            last.focus();
            return;
        }
        const landing =
            document.getElementById('game-exit-home-btn')
            || document.getElementById('toolbar-mobile-toggle');
        landing?.focus();
    }

    /**
     * Cache le tutoriel
     */
    hideTutorial() {
        this.panel.classList.remove('visible');
        this.panel.hidden = true;
        this.panel.setAttribute('aria-hidden', 'true');
        this.isVisible = false;

        document.removeEventListener('keydown', this.handleDocumentKeyDown, true);
        
        // Réactiver les événements Three.js
        this.enableThreeJSEvents();
        document.getElementById('game-window')?.removeAttribute('inert');
        
        // Reprendre le jeu
        this.deps.playGame?.();

        this.restoreFocusAfterClose();
    }

    /**
     * Ferme le tutoriel
     */
    closeTutorial() {
        this.hideTutorial();
    }

    /**
     * Passe à l'étape suivante
     */
    nextStep() {
        if (this.currentStep < this.steps.length - 1) {
            this.currentStep++;
            this.updateDisplay();
        } else {
            // Dernière étape - fermer le tutoriel
            this.closeTutorial();
        }
    }

    /**
     * Revient à l'étape précédente
     */
    previousStep() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.updateDisplay();
        }
    }

    /**
     * Met à jour l'affichage de l'étape actuelle
     */
    updateDisplay() {
        const step = this.steps[this.currentStep];
        if (!step) return;

        // Mettre à jour le titre
        const header = this.panel.querySelector('.tutorial-panel-header h3');
        if (header) {
            header.textContent = step.title;
        }

        // Mettre à jour le contenu
        const content = this.panel.querySelector('.tutorial-content');
        if (content) {
            content.innerHTML = step.content;
        }

        // Mettre à jour les boutons
        this.updateButtons();
    }

    /**
     * Met à jour l'état des boutons
     */
    updateButtons() {
        const previousBtn = this.panel.querySelector('.tutorial-previous-btn');
        const nextBtn = this.panel.querySelector('.tutorial-next-btn');
        const rulesBtn = this.panel.querySelector('.tutorial-rules-btn');

        if (rulesBtn) {
            rulesBtn.textContent = this.mode === 'rules' ? 'Histoire' : 'Règles';
        }

        // Bouton précédent
        if (previousBtn) {
            previousBtn.style.display = this.currentStep > 0 ? 'block' : 'none';
        }

        // Bouton suivant
        if (nextBtn) {
            if (this.currentStep === this.steps.length - 1) {
                nextBtn.textContent = 'Terminer';
            } else {
                nextBtn.textContent = 'Suivant';
            }
        }
    }

    /**
     * Ajoute une étape personnalisée
     */
    addStep(title, content) {
        this.steps.push({ title, content });
    }

    /**
     * Définit les étapes du tutoriel
     */
    setSteps(steps) {
        this.steps = steps;
        this.currentStep = 0;
    }

    /**
     * Vérifie si le tutoriel est visible
     */
    isTutorialVisible() {
        return this.isVisible;
    }

    /**
     * Récupère l'étape actuelle
     */
    getCurrentStep() {
        return this.currentStep;
    }

    /**
     * Récupère le nombre total d'étapes
     */
    getTotalSteps() {
        return this.steps.length;
    }

    /**
     * Nettoie les ressources (à appeler en cas d'erreur ou de destruction)
     */
    cleanup() {
        this.eventBlocker.cleanup();
    }
}


/**
 * @param {ConstructorParameters<typeof TutorialPanel>[0]} deps
 */
export function initTutorialPanel(deps) {
  const tutorialPanel = new TutorialPanel(deps);
  tutorialPanel.init();

  deps.registerAppService?.('tutorialManager', tutorialPanel);
  deps.registerAppFunction?.('startTutorial', () => {
    tutorialPanel.showTutorial();
  });
  deps.registerAppFunction?.('closeTutorial', () => {
    tutorialPanel.closeTutorial();
  });

  const tutorialBtn = document.getElementById('tutorial-btn');
  if (tutorialBtn) {
    const newBtn = tutorialBtn.cloneNode(true);
    tutorialBtn.parentNode.replaceChild(newBtn, tutorialBtn);
    newBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      deps.invokeStartTutorial?.();
    }, true);
  } else {
    console.error('Tutorial button not found');
  }

  window.addEventListener('error', () => {
    const tutorialManagerRef = deps.getTutorialManager?.();
    if (tutorialManagerRef && tutorialManagerRef.eventBlocker.isEventsBlocked()) {
      console.warn('Error detected while tutorial is open, cleaning up Three.js events');
      tutorialManagerRef.cleanup();
    }
  });

  window.addEventListener('beforeunload', () => {
    deps.getTutorialManager?.()?.cleanup();
  });

  return tutorialPanel;
}
