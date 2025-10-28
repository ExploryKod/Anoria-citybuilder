import Splide from '@splidejs/splide';

// Attendre que le DOM soit chargé
document.addEventListener('DOMContentLoaded', function() {
    // Configuration du carousel toolbar pour mobile
    const toolbarCarousel = new Splide('.toolbar-carousel', {
        type: 'slide',
        perPage: 1,
        perMove: 1,
        arrows: true,
        pagination: true,
        drag: true,
        gap: '10px',
        padding: '10px',
        width: '100%',
        height: '80px',
        // Configuration spécifique pour les flèches
        classes: {
            arrows: 'splide__arrows toolbar-arrows',
            arrow: 'splide__arrow toolbar-arrow',
            prev: 'splide__arrow--prev toolbar-arrow-prev',
            next: 'splide__arrow--next toolbar-arrow-next',
        },
        breakpoints: {
            1024: {
                destroy: true, // Détruire le carousel sur desktop
            },
        },
    });

    // Monter le carousel
    toolbarCarousel.mount();
    
    console.log('Splide carousel initialized');
    console.log('Arrows enabled:', toolbarCarousel.options.arrows);

    // Gestion intelligente des événements du canvas en mode mobile paysage
    function handleCanvasEvents() {
        const canvas = document.querySelector('canvas');
        const toolbarCarousel = document.querySelector('.toolbar-carousel');
        
        if (window.innerWidth <= 1024 && window.innerHeight < window.innerWidth) {
            // Mode mobile paysage
            if (canvas && toolbarCarousel) {
                // Désactiver complètement les événements du canvas
                canvas.style.pointerEvents = 'none';
                canvas.style.touchAction = 'none';
                
                // Ajouter une couche de protection sur la toolbar
                toolbarCarousel.style.pointerEvents = 'auto';
                toolbarCarousel.style.touchAction = 'auto';
                
                // Empêcher la propagation des événements depuis la toolbar vers le canvas
                toolbarCarousel.addEventListener('click', function(e) {
                    e.stopPropagation();
                    e.preventDefault();
                });
                
                toolbarCarousel.addEventListener('touchstart', function(e) {
                    e.stopPropagation();
                    e.preventDefault();
                });
                
                toolbarCarousel.addEventListener('touchend', function(e) {
                    e.stopPropagation();
                    e.preventDefault();
                });
                
                // Créer une zone invisible au-dessus du canvas pour capturer les clics
                const canvasOverlay = document.createElement('div');
                canvasOverlay.style.position = 'fixed';
                canvasOverlay.style.top = '0';
                canvasOverlay.style.left = '0';
                canvasOverlay.style.width = '100%';
                canvasOverlay.style.height = '100%';
                canvasOverlay.style.zIndex = '9999';
                canvasOverlay.style.pointerEvents = 'auto';
                canvasOverlay.style.backgroundColor = 'transparent';
                
                // Masquer la zone de la toolbar dans l'overlay
                canvasOverlay.style.clipPath = `polygon(0 0, 100% 0, 100% calc(100% - 80px), 0 calc(100% - 80px))`;
                
                canvasOverlay.addEventListener('click', function(e) {
                    // Réactiver temporairement les événements du canvas pour ce clic
                    canvas.style.pointerEvents = 'auto';
                    canvas.style.touchAction = 'auto';
                    
                    // Simuler le clic sur le canvas
                    const rect = canvas.getBoundingClientRect();
                    const clickEvent = new MouseEvent('click', {
                        clientX: e.clientX,
                        clientY: e.clientY,
                        bubbles: true,
                        cancelable: true
                    });
                    
                    canvas.dispatchEvent(clickEvent);
                    
                    // Redésactiver après un court délai
                    setTimeout(() => {
                        canvas.style.pointerEvents = 'none';
                        canvas.style.touchAction = 'none';
                    }, 50);
                });
                
                document.body.appendChild(canvasOverlay);
                
                // Nettoyer l'overlay lors du redimensionnement
                window.addEventListener('resize', function() {
                    if (canvasOverlay.parentNode) {
                        canvasOverlay.parentNode.removeChild(canvasOverlay);
                    }
                });
            }
        } else {
            // Mode desktop ou portrait
            if (canvas) {
                canvas.style.pointerEvents = 'auto';
                canvas.style.touchAction = 'auto';
                
                // Nettoyer l'overlay s'il existe
                const existingOverlay = document.querySelector('[data-canvas-overlay]');
                if (existingOverlay) {
                    existingOverlay.remove();
                }
            }
        }
    }

    // Appeler la fonction au chargement et au redimensionnement
    handleCanvasEvents();
    window.addEventListener('resize', handleCanvasEvents);

    // Connecter les boutons mobiles aux gestionnaires d'événements
    function connectMobileButtons() {
        // Boutons de vitesse
        const fasterBtnMobile = document.getElementById('faster-btn-mobile');
        const slowerBtnMobile = document.getElementById('slower-btn-mobile');
        
        if (fasterBtnMobile) {
            fasterBtnMobile.addEventListener('click', () => {
                // Simuler le clic sur le bouton desktop
                const fasterBtnDesktop = document.getElementById('faster-btn');
                if (fasterBtnDesktop) {
                    fasterBtnDesktop.click();
                }
            });
        }
        
        if (slowerBtnMobile) {
            slowerBtnMobile.addEventListener('click', () => {
                // Simuler le clic sur le bouton desktop
                const slowerBtnDesktop = document.getElementById('slower-btn');
                if (slowerBtnDesktop) {
                    slowerBtnDesktop.click();
                }
            });
        }

        // Boutons d'outils
        const bulldozeBtnMobile = document.getElementById('bulldoze-btn-mobile');
        const selectBtnMobile = document.getElementById('select-btn-mobile');
        
        if (bulldozeBtnMobile) {
            bulldozeBtnMobile.addEventListener('click', (e) => {
                // Simuler le clic sur le bouton desktop
                const bulldozeBtnDesktop = document.getElementById('bulldoze-btn');
                if (bulldozeBtnDesktop) {
                    bulldozeBtnDesktop.click();
                }
            });
        }
        
        if (selectBtnMobile) {
            selectBtnMobile.addEventListener('click', (e) => {
                // Simuler le clic sur le bouton desktop
                const selectBtnDesktop = document.getElementById('select-btn');
                if (selectBtnDesktop) {
                    selectBtnDesktop.click();
                }
            });
        }

        // Boutons de groupes (habitations, agriculture, etc.)
        const residentialBtnMobile = document.getElementById('residential-btn-mobile');
        const palaceBtnMobile = document.getElementById('palace-btn-mobile');
        const farmBtnMobile = document.getElementById('farm-btn-mobile');
        const industryBtnMobile = document.getElementById('industry-btn-mobile');
        const infrastructureBtnMobile = document.getElementById('infrastructure-btn-mobile');
        const roadsBtnMobile = document.getElementById('roads-btn-mobile');
        const publicBtnMobile = document.getElementById('public-btn-mobile');
        const marketBtnMobile = document.getElementById('market-btn-mobile');
        
        // Connecter tous les boutons de groupes
        [residentialBtnMobile, palaceBtnMobile, farmBtnMobile, industryBtnMobile, 
         infrastructureBtnMobile, roadsBtnMobile, publicBtnMobile, marketBtnMobile].forEach(btn => {
            if (btn) {
                btn.addEventListener('click', (e) => {
                    // Trouver le bouton desktop correspondant
                    const desktopId = btn.id.replace('-mobile', '');
                    const desktopBtn = document.getElementById(desktopId);
                    if (desktopBtn) {
                        desktopBtn.click();
                    }
                });
            }
        });

        // Boutons de gestion
        const budgetBtnMobile = document.getElementById('budget-btn-mobile');
        const loansBtnMobile = document.getElementById('loans-btn-mobile');
        
        if (budgetBtnMobile) {
            budgetBtnMobile.addEventListener('click', (e) => {
                const budgetBtnDesktop = document.getElementById('budget-btn');
                if (budgetBtnDesktop) {
                    budgetBtnDesktop.click();
                }
            });
        }
        
        if (loansBtnMobile) {
            loansBtnMobile.addEventListener('click', (e) => {
                const loansBtnDesktop = document.getElementById('loans-btn');
                if (loansBtnDesktop) {
                    loansBtnDesktop.click();
                }
            });
        }

        // Boutons de jeu
        const tutorialBtnMobile = document.getElementById('tutorial-btn-mobile');
        const objectivesBtnMobile = document.getElementById('objectives-btn-mobile');
        
        if (tutorialBtnMobile) {
            tutorialBtnMobile.addEventListener('click', (e) => {
                const tutorialBtnDesktop = document.getElementById('tutorial-btn');
                if (tutorialBtnDesktop) {
                    tutorialBtnDesktop.click();
                }
            });
        }
        
        if (objectivesBtnMobile) {
            objectivesBtnMobile.addEventListener('click', (e) => {
                const objectivesBtnDesktop = document.getElementById('objectives-btn');
                if (objectivesBtnDesktop) {
                    objectivesBtnDesktop.click();
                }
            });
        }

        // Boutons pause/replay
        const pauseBtnMobile = document.getElementById('pause-btn-mobile');
        const replayBtnMobile = document.getElementById('replay-btn-mobile');
        
        if (pauseBtnMobile) {
            pauseBtnMobile.addEventListener('click', (e) => {
                const pauseBtnDesktop = document.getElementById('pause-btn');
                if (pauseBtnDesktop) {
                    pauseBtnDesktop.click();
                }
            });
        }
        
        if (replayBtnMobile) {
            replayBtnMobile.addEventListener('click', (e) => {
                const replayBtnDesktop = document.getElementById('replay-btn');
                if (replayBtnDesktop) {
                    replayBtnDesktop.click();
                }
            });
        }

        console.log('Mobile buttons connected to desktop handlers');
    }

    // Connecter les boutons mobiles après un délai pour s'assurer que les boutons desktop sont chargés
    setTimeout(connectMobileButtons, 1000);
});