import { useRef, useEffect } from 'react';
import { useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';

export function STLModel({ url, updating }: { url: string; updating: boolean }) {
  const geometry = useLoader(STLLoader, url);
  const ref = useRef<THREE.Mesh>(null);

  useEffect(() => {
    if (ref.current && geometry) {
      geometry.computeVertexNormals();
      const box = new THREE.Box3().setFromBufferAttribute(geometry.attributes.position as THREE.BufferAttribute);
      const center = box.getCenter(new THREE.Vector3());
      geometry.translate(-center.x, -center.y, -center.z);
    }
  }, [geometry]);

  return (
    <mesh ref={ref} geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color="#888"
        metalness={0.3}
        roughness={0.4}
        transparent={updating}
        opacity={updating ? 0.4 : 1}
      />
    </mesh>
  );
}
