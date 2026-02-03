import { Canvas } from '@react-three/fiber';
import { useIsMobile } from '@/hooks/use-mobile';
import FloatingBars from './FloatingBars';
import TrendLines from './TrendLines';
import FloatingOdds from './FloatingOdds';
import GlowingParticles from './GlowingParticles';
import GridFloor from './GridFloor';

const CameraController = () => {
  return null; // Using default camera with slight adjustments
};

const Scene = ({ isMobile }: { isMobile: boolean }) => {
  return (
    <>
      <ambientLight intensity={0.2} />
      <pointLight position={[10, 10, 10]} intensity={0.8} color="#22c55e" />
      <pointLight position={[-10, 5, -10]} intensity={0.4} color="#4ade80" />
      <spotLight
        position={[0, 15, 0]}
        angle={0.5}
        penumbra={1}
        intensity={0.5}
        color="#22c55e"
      />
      
      <FloatingBars />
      <TrendLines />
      {!isMobile && <FloatingOdds />}
      <GlowingParticles />
      <GridFloor />
      
      <CameraController />
      
      {/* Fog for depth */}
      <fog attach="fog" args={['#0a0a0f', 5, 30]} />
    </>
  );
};

const LoginBackground3D = () => {
  const isMobile = useIsMobile();

  return (
    <div className="absolute inset-0 z-0">
      <Canvas
        camera={{ 
          position: [0, 2, 12], 
          fov: 60,
          near: 0.1,
          far: 100
        }}
        dpr={isMobile ? 1 : [1, 1.5]}
        gl={{ 
          antialias: !isMobile,
          alpha: true,
          powerPreference: 'high-performance'
        }}
      >
        <color attach="background" args={['#0a0a0f']} />
        <Scene isMobile={isMobile} />
      </Canvas>
    </div>
  );
};

export default LoginBackground3D;
