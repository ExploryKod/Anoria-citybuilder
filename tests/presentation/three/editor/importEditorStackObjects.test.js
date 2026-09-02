import { describe, expect, test, beforeEach } from '@jest/globals';
import { importEditorStackObjects, getEditorStackObjects, resetEditorNatureLayout } from '../../../../src/presentation/three/editor/editorNatureLayout.js';

describe('importEditorStackObjects', () => {
  beforeEach(() => {
    resetEditorNatureLayout();
  });

  test('restores stack objects and next id counter', () => {
    importEditorStackObjects([
      {
        id: 'stack-9',
        assetId: 'nature:cliff_rock',
        x: 1,
        y: 2,
        rotationY: 1.5,
        baseLocalY: 0.1,
        parentId: null,
        anchor: 'sea',
      },
    ]);

    expect(getEditorStackObjects()).toHaveLength(1);
    expect(getEditorStackObjects()[0].id).toBe('stack-9');
  });
});
