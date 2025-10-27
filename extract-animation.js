import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import * as fs from 'fs';
import * as path from 'path';

const filePath = process.argv[2] || './public/resources/WalkingMan.glb';

console.log(`Loading GLB file: ${filePath}`);

// Initialize GLTF Transform
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

try {
    // Read the GLB file
    const document = await io.read(filePath);
    const root = document.getRoot();
    
    console.log('\n=== GLB File Information ===\n');
    
    // Get basic info
    const asset = document.getRoot().listScenes()[0];
    console.log(`Asset version: ${document.getRoot().getAsset()?.version || 'unknown'}`);
    console.log(`Generator: ${document.getRoot().getAsset()?.generator || 'unknown'}`);
    
    // Get animations
    const animationAccessor = root.listAccessors();
    const animationChannels = root.listAnimations();
    
    console.log(`\nTotal Animations: ${animationChannels.length}`);
    console.log(`Total Accessors: ${animationAccessor.length}`);
    
    const animations = animationChannels;
    
    if (animations.length > 0) {
        console.log('\n=== Animation Details ===\n');
        
        animations.forEach((anim, index) => {
            console.log(`Animation ${index + 1}:`);
            console.log(`  Name: ${anim.getName()}`);
            
            const channels = anim.listChannels();
            const samplers = anim.listSamplers();
            
            console.log(`  Channels: ${channels.length}`);
            channels.forEach((channel, cIndex) => {
                const targetNode = channel.getTargetNode();
                console.log(`    Channel ${cIndex + 1}:`);
                console.log(`      Path: ${channel.getTargetPath()}`);
                console.log(`      Target Node: ${targetNode ? targetNode.getName() : 'root'}`);
                console.log(`      Sampler: ${channel.getSampler().getName()}`);
            });
            
            console.log(`  Samplers: ${samplers.length}`);
            samplers.forEach((sampler, sIndex) => {
                console.log(`    Sampler ${sIndex + 1}:`);
                console.log(`      Name: ${sampler.getName()}`);
                console.log(`      Interpolation: ${sampler.getInterpolation()}`);
                
                const inputAccessor = sampler.getInput();
                const outputAccessor = sampler.getOutput();
                
                if (inputAccessor) {
                    console.log(`      Input Keyframe Count: ${inputAccessor.getCount()}`);
                    console.log(`      Input Type: ${inputAccessor.getType()}`);
                    try {
                        const min = inputAccessor.getMin();
                        const max = inputAccessor.getMax();
                        if (min && max && min.length > 0 && max.length > 0) {
                            console.log(`      Duration: ${min[0].toFixed(2)}s to ${max[0].toFixed(2)}s (${(max[0] - min[0]).toFixed(2)}s)`);
                        }
                    } catch (e) {
                        console.log(`      Duration: (could not access)`);
                    }
                }
                
                if (outputAccessor) {
                    console.log(`      Output Keyframe Count: ${outputAccessor.getCount()}`);
                    console.log(`      Output Type: ${outputAccessor.getType()}`);
                    console.log(`      Output Component Type: ${outputAccessor.getComponentType()}`);
                }
            });
            
            console.log('');
        });
        
        // Export animation data as JSON
        const animationData = animations.map((anim, index) => {
            const data = {
                index: index + 1,
                name: anim.getName() || 'animation',
                channels: [],
                samplers: []
            };
            
            anim.listChannels().forEach((channel, cIndex) => {
                data.channels.push({
                    index: cIndex,
                    targetPath: channel.getTargetPath(),
                    targetNode: channel.getTargetNode()?.getName() || 'root',
                    sampler: channel.getSampler().getName()
                });
            });
            
            anim.listSamplers().forEach((sampler, sIndex) => {
                const inputAccessor = sampler.getInput();
                const outputAccessor = sampler.getOutput();
                
                    let inputData = null;
                    let outputData = null;
                    
                    if (inputAccessor) {
                        try {
                            inputData = {
                                count: inputAccessor.getCount(),
                                type: inputAccessor.getType()
                            };
                            const min = inputAccessor.getMin();
                            const max = inputAccessor.getMax();
                            if (min && max && min.length > 0 && max.length > 0) {
                                inputData.duration = max[0] - min[0];
                                inputData.startTime = min[0];
                                inputData.endTime = max[0];
                            }
                        } catch (e) {
                            // Skip if can't access
                        }
                    }
                    
                    if (outputAccessor) {
                        outputData = {
                            count: outputAccessor.getCount(),
                            type: outputAccessor.getType(),
                            componentType: outputAccessor.getComponentType()
                        };
                    }
                    
                    data.samplers.push({
                        index: sIndex,
                        name: sampler.getName(),
                        input: inputData,
                        output: outputData,
                        interpolation: sampler.getInterpolation()
                    });
            });
            
            return data;
        });
        
        const outputPath = path.join(path.dirname(filePath), 'animation-data.json');
        fs.writeFileSync(outputPath, JSON.stringify(animationData, null, 2));
        console.log(`\n✓ Animation data exported to: ${outputPath}`);
        
    } else {
        console.log('No animations found in this GLB file.');
    }
    
    // Get mesh information
    const scenes = root.listScenes();
    const nodes = root.listNodes();
    const meshes = root.listMeshes();
    
    console.log('\n=== Scene Information ===\n');
    console.log(`Total Scenes: ${scenes.length}`);
    console.log(`Total Nodes: ${nodes.length}`);
    console.log(`Total Meshes: ${meshes.length}`);
    
} catch (error) {
    console.error('Error loading GLB file:', error.message);
    console.error(error);
}
