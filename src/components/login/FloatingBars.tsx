import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface BarData {
  position: [number, number, number];
  baseHeight: number;
  offset: number;
  speed: number;
}

const FloatingBars = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  const bars = useMemo<BarData[]>(() => {
    const barsArray: BarData[] = [];
    const count = 12;
    
    for (let i = 0; i < count; i++) {
      barsArray.push({
        position: [
          (Math.random() - 0.5) * 20,
          0,
          (Math.random() - 0.5) * 15 - 5
        ],
        baseHeight: Math.random() * 1.5 + 0.5,
        offset: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.5 + 0.3
      });
    }
    return barsArray;
  }, []);

  useFrame((state) => {
    if (!meshRef.current) return;
    
    bars.forEach((bar, i) => {
      const height = bar.baseHeight + Math.sin(state.clock.elapsedTime * bar.speed + bar.offset) * 0.8;
      
      dummy.position.set(bar.position[0], height / 2, bar.position[2]);
      dummy.scale.set(0.3, height, 0.3);
      dummy.updateMatrix();
      
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, bars.length]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color="#22c55e"
        emissive="#22c55e"
        emissiveIntensity={0.3}
        transparent
        opacity={0.8}
      />
    </instancedMesh>
  );
};

export default FloatingBars;
