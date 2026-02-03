import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Line } from '@react-three/drei';

interface TrendLineProps {
  offset: number;
  yOffset: number;
  zOffset: number;
}

const TrendLine = ({ offset, yOffset, zOffset }: TrendLineProps) => {
  const lineRef = useRef<THREE.Group>(null);
  
  const points = useMemo(() => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 20; i++) {
      const x = (i / 20) * 16 - 8;
      const y = Math.sin(i * 0.5 + offset) * 0.8 + yOffset;
      pts.push([x, y, zOffset]);
    }
    return pts;
  }, [offset, yOffset, zOffset]);

  useFrame((state) => {
    if (!lineRef.current) return;
    
    lineRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.3 + offset) * 0.3;
    lineRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.1 + offset) * 0.02;
  });

  return (
    <group ref={lineRef}>
      <Line
        points={points}
        color="#22c55e"
        lineWidth={2}
        transparent
        opacity={0.6}
      />
    </group>
  );
};

const TrendLines = () => {
  const lines = useMemo(() => [
    { offset: 0, yOffset: 2, zOffset: -8 },
    { offset: Math.PI / 3, yOffset: 0, zOffset: -6 },
    { offset: Math.PI / 2, yOffset: -1.5, zOffset: -10 },
    { offset: Math.PI, yOffset: 1, zOffset: -4 },
  ], []);

  return (
    <group>
      {lines.map((line, i) => (
        <TrendLine key={i} {...line} />
      ))}
    </group>
  );
};

export default TrendLines;
