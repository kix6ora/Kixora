import { Canvas } from '@react-three/fiber';
import { ContactShadows, Environment, OrbitControls, useGLTF } from '@react-three/drei';
import { Suspense, useEffect, useMemo } from 'react';
import * as THREE from 'three';

type Sneaker3DViewerProps = {
  modelUrl?: string;
  images: string[];
  fallbackImage: string;
  name: string;
  autoRotate?: boolean;
  compact?: boolean;
  onImageChange?: (index: number) => void;
  onViewerError?: () => void;
};

function SneakerModel({ url, lowPower }: { url: string; lowPower: boolean }) {
  const { scene } = useGLTF(url);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = 2.8 / Math.max(size.x, size.y, size.z, 0.001);
    clone.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
    clone.scale.setScalar(scale);
    clone.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = !lowPower;
      child.receiveShadow = !lowPower;
      if (!lowPower) child.geometry = child.geometry.clone();
      if (Array.isArray(child.material)) {
        child.material.forEach((material) => { material.precision = 'mediump'; });
      } else {
        child.material.precision = 'mediump';
      }
    });
    return clone;
  }, [scene, lowPower]);
  useEffect(() => () => {
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) child.geometry.dispose();
    });
  }, [model]);
  return <primitive object={model} />;
}

export default function Sneaker3DScene({ modelUrl, name, autoRotate = false, compact = false, onViewerError }: Sneaker3DViewerProps) {
  const lowPower = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    return Boolean(connection?.saveData || connection?.effectiveType === '2g' || connection?.effectiveType === 'slow-2g' || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4));
  }, []);

  useEffect(() => {
    if (!modelUrl) return;
    const url = modelUrl;
    void Promise.resolve(useGLTF.preload(url)).catch(() => onViewerError?.());
  }, [modelUrl, onViewerError]);

  if (!modelUrl) return null;
  return (
    <div className={`w-full overflow-hidden rounded-xl bg-[#181818] ${compact ? 'h-full' : 'min-h-[250px] flex-1'}`} aria-label={`Interactive 3D viewer for ${name}`}>
      <Canvas
        shadows={!compact && !lowPower}
        dpr={lowPower ? 1 : [1, 1.5]}
        camera={{ position: [3, 2, 4], fov: 38 }}
        gl={{ powerPreference: lowPower ? 'low-power' : 'high-performance', antialias: !lowPower, alpha: false }}
        fallback={<div className="flex h-full items-center justify-center text-sm text-white/60">3D unavailable — using product images</div>}
      >
        <color attach="background" args={['#181818']} />
        <ambientLight intensity={0.6} />
        <spotLight position={[4, 6, 5]} angle={0.42} penumbra={0.8} intensity={lowPower ? 1.2 : 2.2} castShadow={!compact && !lowPower} />
        <directionalLight position={[-4, 3, -2]} intensity={0.9} />
        <Suspense fallback={null}>
          <group rotation={[0.05, 0, 0]}>
          <SneakerModel url={modelUrl} lowPower={lowPower} />
          </group>
          {!compact && !lowPower ? <ContactShadows position={[0, -1.45, 0]} opacity={0.45} scale={5} blur={2.5} far={2.5} resolution={256} /> : null}
          <Environment preset="studio" />
        </Suspense>
        <OrbitControls enablePan={false} minDistance={2.5} maxDistance={7} autoRotate={autoRotate && !lowPower} autoRotateSpeed={1.3} />
      </Canvas>
    </div>
  );
}