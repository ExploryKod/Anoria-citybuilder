/** @type {import('jest').Config} */
export default {
    // Use ESM modules
    testEnvironment: 'node',
    
    // Setup file to run before tests (mock Vite globals)
    setupFiles: ['./tests/setup.js'],
    
    // Transform ESM imports
    transform: {},
    
    // File extensions to consider
    moduleFileExtensions: ['js', 'mjs', 'cjs', 'json'],
    
    // Test file patterns
    testMatch: [
        '**/tests/**/*.test.js',
        '**/__tests__/**/*.js'
    ],
    
    // Ignore patterns
    testPathIgnorePatterns: [
        '/node_modules/',
        '/dist/'
    ],
    
    // Coverage configuration
    collectCoverageFrom: [
        'src/composition/**/*.js',
        'src/contexts/**/*.js',
        'src/engine/**/*.js',
        'src/shared/**/*.js',
        '!src/presentation/dom/**/*.js',
        '!**/node_modules/**'
    ],
    
    // Module name mapping for imports
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1'
    },
    
    // Verbose output
    verbose: true
};

