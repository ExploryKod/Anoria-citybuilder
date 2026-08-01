/**
 * WebGL Resource Detector
 * Detects WebGL capabilities and determines safe maximum city size
 * based on GPU resources (texture units, texture size, vertex attributes, etc.)
 */

import { registerAppService } from '../acl/appRuntime.js';

export class WebGLResourceDetector {
    constructor() {
        this.capabilities = null;
        this.maxSafeCitySize = null;
        this.detectionComplete = false;
    }

    /**
     * Detect WebGL capabilities by creating a test context
     * @returns {Object} Capabilities object with limits and recommendations
     */
    detectCapabilities() {
        if (this.capabilities) {
            return this.capabilities;
        }

        const canvas = document.createElement('canvas');
        let gl = null;
        
        try {
            // Try to get WebGL context
            gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            
            if (!gl) {
                // WebGL not supported at all
                this.capabilities = {
                    supported: false,
                    maxTextureSize: 0,
                    maxTextureUnits: 0,
                    maxVertexAttribs: 0,
                    maxSafeCitySize: 0,
                    issues: ['WebGL is not supported on this system'],
                    recommendation: 'Your system does not support WebGL. Please update your graphics drivers or use a different browser.'
                };
                this.maxSafeCitySize = 0;
                this.detectionComplete = true;
                return this.capabilities;
            }

            // Get WebGL limits
            const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
            const maxTextureUnits = gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS);
            const maxVertexAttribs = gl.getParameter(gl.MAX_VERTEX_ATTRIBS);
            const maxViewportDims = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
            
            // Get renderer info (if available)
            const vendor = gl.getParameter(gl.VENDOR) || 'Unknown';
            const renderer = gl.getParameter(gl.RENDERER) || 'Unknown';
            const version = gl.getParameter(gl.VERSION) || 'Unknown';
            
            // Check for WebGL2
            const isWebGL2 = !!canvas.getContext('webgl2');
            
            // Estimate GPU memory constraints
            // Typical limits: integrated GPUs have ~512MB-2GB, dedicated GPUs have more
            // We estimate based on texture size limits
            let estimatedMemoryMB = 0;
            if (maxTextureSize >= 16384) {
                estimatedMemoryMB = 4096; // High-end GPU
            } else if (maxTextureSize >= 8192) {
                estimatedMemoryMB = 2048; // Mid-range GPU
            } else if (maxTextureSize >= 4096) {
                estimatedMemoryMB = 1024; // Entry-level dedicated GPU
            } else if (maxTextureSize >= 2048) {
                estimatedMemoryMB = 512; // Integrated GPU
            } else {
                estimatedMemoryMB = 256; // Very limited GPU
            }

            // Calculate safe city size based on resources
            // Each tile requires textures, geometry, and lighting
            // Conservative estimates:
            // - 12x12 = 144 tiles (minimal)
            // - 16x16 = 256 tiles (standard)
            // - 20x20 = 400 tiles (moderate)
            // - 24x24 = 576 tiles (maximum)
            
            let maxSafeCitySize = 24;
            const issues = [];
            const warnings = [];

            // Check texture unit limit (minimum 8 required, 16+ recommended)
            if (maxTextureUnits < 8) {
                maxSafeCitySize = Math.min(maxSafeCitySize, 12);
                issues.push(`Limited texture units: ${maxTextureUnits} (minimum 8 required)`);
            } else if (maxTextureUnits < 16) {
                maxSafeCitySize = Math.min(maxSafeCitySize, 16);
                warnings.push(`Reduced texture units: ${maxTextureUnits} (16+ recommended)`);
            }

            // Check texture size limit (affects terrain quality)
            if (maxTextureSize < 2048) {
                maxSafeCitySize = Math.min(maxSafeCitySize, 12);
                issues.push(`Limited texture size: ${maxTextureSize}px (2048px+ recommended)`);
            } else if (maxTextureSize < 4096) {
                maxSafeCitySize = Math.min(maxSafeCitySize, 16);
                warnings.push(`Reduced texture size: ${maxTextureSize}px (4096px+ recommended)`);
            }

            // Check vertex attributes (affects geometry complexity)
            if (maxVertexAttribs < 8) {
                maxSafeCitySize = Math.min(maxSafeCitySize, 12);
                issues.push(`Limited vertex attributes: ${maxVertexAttribs} (8+ required)`);
            }

            // Estimate based on GPU memory
            if (estimatedMemoryMB < 512) {
                maxSafeCitySize = Math.min(maxSafeCitySize, 12);
                issues.push(`Limited GPU memory: estimated ${estimatedMemoryMB}MB (512MB+ recommended)`);
            } else if (estimatedMemoryMB < 1024) {
                maxSafeCitySize = Math.min(maxSafeCitySize, 16);
                warnings.push(`Reduced GPU memory: estimated ${estimatedMemoryMB}MB (1GB+ recommended)`);
            }

            // Check for integrated graphics (often have more limitations)
            const isIntegratedGPU = renderer.toLowerCase().includes('intel') || 
                                    renderer.toLowerCase().includes('integrated') ||
                                    renderer.toLowerCase().includes('mali') ||
                                    renderer.toLowerCase().includes('adreno');
            
            if (isIntegratedGPU && maxSafeCitySize > 16) {
                maxSafeCitySize = 16;
                warnings.push('Integrated graphics detected - reduced maximum city size for stability');
            }

            // Ensure minimum size of 12
            maxSafeCitySize = Math.max(12, maxSafeCitySize);

            // Build recommendation message
            let recommendation = '';
            if (issues.length > 0) {
                recommendation = `Your system has limited WebGL resources. Maximum recommended city size: ${maxSafeCitySize}×${maxSafeCitySize}. `;
                recommendation += 'Consider closing other applications or using a system with better graphics capabilities.';
            } else if (warnings.length > 0) {
                recommendation = `Your system has reduced WebGL capabilities. Maximum recommended city size: ${maxSafeCitySize}×${maxSafeCitySize}. `;
                recommendation += 'Performance may be affected with larger cities.';
            } else {
                recommendation = `Your system supports all city sizes up to 24×24.`;
            }

            this.capabilities = {
                supported: true,
                maxTextureSize,
                maxTextureUnits,
                maxVertexAttribs,
                maxViewportDims,
                vendor,
                renderer,
                version,
                isWebGL2,
                estimatedMemoryMB,
                maxSafeCitySize,
                issues,
                warnings,
                recommendation
            };

            this.maxSafeCitySize = maxSafeCitySize;
            this.detectionComplete = true;

        } catch (error) {
            console.error('WebGL detection error:', error);
            // Fallback to conservative defaults
            this.capabilities = {
                supported: false,
                maxTextureSize: 0,
                maxTextureUnits: 0,
                maxVertexAttribs: 0,
                maxSafeCitySize: 12,
                issues: ['Failed to detect WebGL capabilities'],
                recommendation: 'Unable to detect WebGL capabilities. Using minimum city size (12×12) for safety.'
            };
            this.maxSafeCitySize = 12;
            this.detectionComplete = true;
        } finally {
            // Cleanup
            if (gl) {
                const loseContext = gl.getExtension('WEBGL_lose_context');
                if (loseContext) {
                    loseContext.loseContext();
                }
            }
        }

        return this.capabilities;
    }

    /**
     * Get the maximum safe city size for this system
     * @returns {number} Maximum safe city size (12-24)
     */
    getMaxSafeCitySize() {
        if (!this.detectionComplete) {
            this.detectCapabilities();
        }
        return this.maxSafeCitySize || 12;
    }

    /**
     * Check if a city size is safe for this system
     * @param {number} citySize - City size to check
     * @returns {Object} { safe: boolean, reason: string }
     */
    isCitySizeSafe(citySize) {
        if (!this.detectionComplete) {
            this.detectCapabilities();
        }

        const maxSafe = this.getMaxSafeCitySize();
        
        if (citySize > maxSafe) {
            return {
                safe: false,
                reason: `City size ${citySize}×${citySize} exceeds your system's maximum supported size of ${maxSafe}×${maxSafe} due to limited WebGL resources.`
            };
        }

        return { safe: true, reason: '' };
    }

    /**
     * Get a user-friendly message about system limitations
     * @returns {string} Technical message about WebGL resource limitations
     */
    getTechnicalMessage() {
        if (!this.detectionComplete) {
            this.detectCapabilities();
        }

        if (!this.capabilities) {
            return 'WebGL capabilities could not be detected.';
        }

        if (!this.capabilities.supported) {
            return this.capabilities.recommendation;
        }

        const parts = [];
        
        if (this.capabilities.issues.length > 0) {
            parts.push('Limitations detected:');
            this.capabilities.issues.forEach(issue => {
                parts.push(`• ${issue}`);
            });
        }

        if (this.capabilities.warnings.length > 0) {
            parts.push('Warnings:');
            this.capabilities.warnings.forEach(warning => {
                parts.push(`• ${warning}`);
            });
        }

        parts.push(`\nMaximum recommended city size: ${this.maxSafeCitySize}×${this.maxSafeCitySize}`);
        parts.push(`\n${this.capabilities.recommendation}`);

        return parts.join('\n');
    }
}

// Create singleton instance
const webglDetector = new WebGLResourceDetector();

/**
 * Test mode: Simulate limited WebGL resources for testing
 * Usage: Set localStorage.setItem('webgl-test-mode', 'limited') before page load
 * Options: 'limited' (simulates 12x12 max), 'moderate' (simulates 16x16 max), 'none' (normal detection)
 */
if (typeof window !== 'undefined') {
    const testMode = localStorage.getItem('webgl-test-mode');
    if (testMode === 'limited' || testMode === 'moderate') {
        // Override detection with simulated limited resources
        const originalDetect = webglDetector.detectCapabilities.bind(webglDetector);
        webglDetector.detectCapabilities = function() {
            const realCapabilities = originalDetect();
            
            if (testMode === 'limited') {
                // Simulate very limited system (12x12 max)
                this.capabilities = {
                    ...realCapabilities,
                    maxTextureSize: 2048, // Limited texture size
                    maxTextureUnits: 8,  // Minimum texture units
                    maxVertexAttribs: 8, // Minimum vertex attributes
                    estimatedMemoryMB: 256, // Very low GPU memory
                    maxSafeCitySize: 12,
                    issues: [
                        'Limited texture units: 8 (16+ recommended)',
                        'Limited texture size: 2048px (4096px+ recommended)',
                        'Limited GPU memory: estimated 256MB (1GB+ recommended)'
                    ],
                    warnings: [],
                    recommendation: 'Your system has limited WebGL resources. Maximum recommended city size: 12×12. Consider closing other applications or using a system with better graphics capabilities.'
                };
                this.maxSafeCitySize = 12;
            } else if (testMode === 'moderate') {
                // Simulate moderate limitations (16x16 max)
                this.capabilities = {
                    ...realCapabilities,
                    maxTextureSize: 4096, // Moderate texture size
                    maxTextureUnits: 12, // Reduced texture units
                    estimatedMemoryMB: 512, // Low GPU memory
                    maxSafeCitySize: 16,
                    issues: [],
                    warnings: [
                        'Reduced texture units: 12 (16+ recommended)',
                        'Reduced GPU memory: estimated 512MB (1GB+ recommended)'
                    ],
                    recommendation: 'Your system has reduced WebGL capabilities. Maximum recommended city size: 16×16. Performance may be affected with larger cities.'
                };
                this.maxSafeCitySize = 16;
            }
            
            this.detectionComplete = true;
            return this.capabilities;
        };
    }
}

// Expose test helper via AppRegistry for easy console access (app.webglTestMode)
if (typeof window !== 'undefined') {
    const webglTestMode = {
        /**
         * Enable test mode to simulate limited WebGL resources
         * @param {string} mode - 'limited' (12x12 max), 'moderate' (16x16 max), or 'none' (normal)
         */
        set: (mode) => {
            if (mode === 'limited' || mode === 'moderate' || mode === 'none') {
                localStorage.setItem('webgl-test-mode', mode);
                if (mode === 'limited') {
                    console.info('  → Will simulate very limited system (12×12 max)');
                } else if (mode === 'moderate') {
                    console.info('  → Will simulate moderate limitations (16×16 max)');
                } else {
                    console.info('  → Will use normal WebGL detection');
                }
            } else {
                console.error('Invalid mode. Use: "limited", "moderate", or "none"');
            }
        },
        /**
         * Get current test mode
         */
        get: () => {
            const mode = localStorage.getItem('webgl-test-mode');
            return mode;
        },
        /**
         * Disable test mode
         */
        disable: () => {
            localStorage.removeItem('webgl-test-mode');
        },
        /**
         * Show help
         */
        help: () => {
            console.info(`
WebGL Test Mode Helper
======================
Usage:
  app.webglTestMode.set('limited')   - Simulate very limited system (12×12 max)
  app.webglTestMode.set('moderate')   - Simulate moderate limitations (16×16 max)
  app.webglTestMode.set('none')       - Use normal detection
  app.webglTestMode.get()             - Show current mode
  app.webglTestMode.disable()         - Disable test mode
  app.webglTestMode.help()            - Show this help

After setting a mode, reload the page (F5) for changes to take effect.
            `);
        }
    };

    registerAppService('webglTestMode', webglTestMode);
    
    // Show help on first load if test mode is active
    const testMode = localStorage.getItem('webgl-test-mode');
    if (testMode === 'limited' || testMode === 'moderate') {
        console.info(`[WebGL Test Mode] Active: ${testMode}. Use app.webglTestMode.help() for more info.`);
    }
}

export default webglDetector;

