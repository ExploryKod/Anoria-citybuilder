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
        // Jest has no CSS transform configured (no test needs real styling) —
        // stub out any .css import anywhere in a test's module graph instead
        // of failing to parse it (e.g. a UI library's own stylesheet pulled
        // in transitively, like js-toast-notifier's dist/index.css).
        '\\.css$': '<rootDir>/tests/__mocks__/styleMock.js',
        '^(\\.{1,2}/.*)\\.js$': '$1'
    },
    
    // Verbose output
    verbose: true
};

