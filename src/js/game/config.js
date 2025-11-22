// Centralized gameplay and rendering configuration
// Non-invasive: referenced gradually by other modules in later steps

const config = {
    simulation: {
        tickMsMin: 500,
        tickMsMax: 20000,
        defaultTickMs: 4000,
        citySize: 16,
        // Food distribution distance: maximum distance (in tiles) a market can distribute food to houses
        // Houses beyond this distance from any market will not receive food
        foodDistributionDistance: 5, // Default: 5 tiles (manhattan distance)
    },
    
    budget: {
        // Initial starting funds (trésorerie initiale / capital social)
        // Can be overridden via environment variable VITE_INITIAL_FUNDS
        // Default: 200 euros
        initialFunds: (() => {
            const envValue = import.meta.env.VITE_INITIAL_FUNDS;
            const parsed = envValue ? parseInt(envValue, 10) : null;
            const result = parsed && !isNaN(parsed) ? parsed : 200;
            console.log('[config.js] Initial funds config:', {
                envValue,
                parsed,
                result,
                'import.meta.env.VITE_INITIAL_FUNDS': import.meta.env.VITE_INITIAL_FUNDS
            });
            return result;
        })(),
    },

    building: {
        // Default values; specific assets override in assets data
        defaultConstructionTimeDays: 3,
        multiTilePlacementEnabled: true,
    },

    citizens: {
        minWorkingAge: 16,
        retirementAge: 65,
        defaultHouseholdSize: 2,
    },

    objectives: {
        // Example thresholds used by ObjectivesTracker
        initialCheckOnPlay: true,
    },

    ui: {
        notifications: {
            autoHideMs: 4000,
            animationMs: 300,
        },
        loader: {
            hideDelayMs: 500,
        },
    },

    rendering: {
        shadows: {
            enabled: true,
            type: 'PCFSoftShadowMap', // Original Anoria used PCFSoftShadowMap
            mapSize: 1024, // Original Anoria value (restored for exact brightness match)
            normalBias: 0.01,
        },
        lights: {
            sun: {
                color: 0xffffff,
                intensity: 2,
                // Position: (0, 1, 0) for overhead lighting (original Anoria)
                // Alternative: (-10, 20, 0) for angled lighting (simcity-style, darker)
                position: { x: 0, y: 1, z: 0 },
                // Shadow camera bounds: original Anoria values for better coverage
                camera: { left: -10, right: 10, top: 0, bottom: -10, near: 0.5, far: 50 },
            },
            ambient: { color: 0xffffff, intensity: 0.5 },
        },
        grid: {
            opacity: 0.2,
        },
    },
    
    assets: {
        // Base URL for assets - can be overridden or read from Vite config
        baseUrl: '/', // Default matches vite.config.js base
        // Asset paths
        models: {
            mainModel: '/resources/lowpoly/village_town_assets_v2.glb',
            catalog: '/village_town_assets.json',
        },
        textures: {
            base: '/resources/textures/maps/base.png',
            specular: '/resources/textures/maps/specular.png',
            grid: '/resources/textures/maps/grid.png',
        },
    },
};

export default config;


