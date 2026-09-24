// Fresnel rim light injected into character materials only, so silhouettes
// glow against the fog without a real light glaring off the wet floor.

import * as THREE from 'three';

export const RIM = {
  rimColor: { value: new THREE.Color('#b890ff') },
  rimPower: { value: 3.4 },
  rimStrength: { value: 0.42 },
};

const patched = new WeakSet();

export function addRim(material) {
  if (!material || patched.has(material) || !material.isMeshStandardMaterial) return;
  patched.add(material);
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, r) => {
    if (prev) prev(shader, r);
    Object.assign(shader.uniforms, RIM);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 rimColor; uniform float rimPower; uniform float rimStrength;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float rimF = 1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
        totalEmissiveRadiance += rimColor * pow(rimF, rimPower) * rimStrength;`,
      );
  };
  const key = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () => (key ? key() : '') + '|rim';
  material.needsUpdate = true;
}

export function rimModel(root) {
  root.traverse((o) => {
    if (o.isMesh) addRim(o.material);
  });
}
