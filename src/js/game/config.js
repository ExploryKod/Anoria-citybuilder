// Centralized gameplay and rendering configuration
// Non-invasive: referenced gradually by other modules in later steps

const config = {
    simulation: {
        tickMsMin: 500,
        tickMsMax: 20000,
        defaultTickMs: 4000,
        citySize: 16,
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
            mapSize: 2048, // Original was 1024, using 2048 for better quality
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
};

export default config;


