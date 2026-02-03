import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Float } from '@react-three/drei';
import * as THREE from 'three';

interface OddData {
  value: string;
  position: [number, number, number];
  scale: number;
  rotationSpeed: number;
}

const FloatingOdd = ({ value, position, scale, rotationSpeed }: OddData) => {
  const textRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (!textRef.current) return;
    textRef.current.rotation.y = state.clock.elapsedTime * rotationSpeed;
  });

  return (
    <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
      <Text
        ref={textRef}
        position={position}
        fontSize={scale}
        color="#22c55e"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {value}
        <meshStandardMaterial
          color="#22c55e"
          emissive="#22c55e"
          emissiveIntensity={0.5}
          transparent
          opacity={0.9}
        />
      </Text>
    </Float>
  );
};

const FloatingOdds = () => {
  const odds = useMemo<OddData[]>(() => [
    { value: '1.85', position: [-6, 2, -8], scale: 0.8, rotationSpeed: 0.1 },
    { value: '2.10', position: [5, 1, -6], scale: 0.6, rotationSpeed: 0.15 },
    { value: '3.50', position: [-4, -1, -10], scale: 0.5, rotationSpeed: 0.08 },
    { value: '1.45', position: [7, 3, -12], scale: 0.7, rotationSpeed: 0.12 },
    { value: '4.20', position: [-8, 0, -7], scale: 0.55, rotationSpeed: 0.09 },
    { value: '2.75', position: [3, -2, -9], scale: 0.65, rotationSpeed: 0.11 },
  ], []);

  return (
    <group>
      {odds.map((odd, i) => (
        <FloatingOdd key={i} {...odd} />
      ))}
    </group>
  );
};

export default FloatingOdds;
