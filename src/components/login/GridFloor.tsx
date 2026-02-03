import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const GridFloor = () => {
  const gridRef = useRef<THREE.GridHelper>(null);

  useFrame((state) => {
    if (!gridRef.current) return;
    
    // Subtle movement
    gridRef.current.position.z = (state.clock.elapsedTime * 0.5) % 2;
  });

  return (
    <group position={[0, -4, -10]} rotation={[-Math.PI / 6, 0, 0]}>
      <gridHelper
        ref={gridRef}
        args={[50, 50, '#1a1a2e', '#1a1a2e']}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial
          color="#0a0a0f"
          transparent
          opacity={0.9}
        />
      </mesh>
    </group>
  );
};

export default GridFloor;
