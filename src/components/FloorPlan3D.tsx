import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Text } from '@react-three/drei';

// Synthwave color palette
const COLORS = {
  purple: '#a855f7',
  magenta: '#ec4899',
  darkBg: '#0f0f13',
  neonCyan: '#06b6d4',
  teal: '#14b8a6'
};

const RoomBox: React.FC<{
  position: [number, number, number];
  size: [number, number, number];
  label?: string;
  subLabel?: string;
  color?: string;
}> = ({ position, size, label, subLabel, color = COLORS.purple }) => {
  const edgesGeometry = useMemo(() => {
    const boxGeometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
    return new THREE.EdgesGeometry(boxGeometry);
  }, [size]);

  return (
    <group position={position}>
      {/* Glossy semi-transparent walls */}
      <mesh>
        <boxGeometry args={size} />
        <meshPhysicalMaterial 
          color={COLORS.darkBg} 
          transparent 
          opacity={0.8}
          roughness={0.1}
          metalness={0.8}
          transmission={0.5} 
        />
      </mesh>
      
      {/* Glowing neon edges */}
      <lineSegments geometry={edgesGeometry}>
        <lineBasicMaterial color={color} toneMapped={false} />
      </lineSegments>
      
      {/* Floor glow */}
      <mesh position={[0, -size[1]/2 + 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[size[0] * 0.95, size[2] * 0.95]} />
        <meshBasicMaterial color={color} transparent opacity={0.15} toneMapped={false} />
      </mesh>

      {/* Floating Labels */}
      {(label || subLabel) && (
        <group position={[0, size[1]/2 + 20, 0]} rotation={[-Math.PI / 2, 0, 0]}>
           {label && (
              <Text 
                position={[0, subLabel ? 10 : 0, 0]}
                fontSize={24} 
                color="#ffffff" 
                anchorX="center" 
                anchorY="middle"
                fontWeight="bold"
              >
                {label}
              </Text>
           )}
           {subLabel && (
              <Text 
                position={[0, -10, 0]}
                fontSize={12} 
                color="#cbd5e1" 
                anchorX="center" 
                anchorY="middle"
              >
                {subLabel}
              </Text>
           )}
        </group>
      )}
    </group>
  );
};

export const FloorPlan3D: React.FC = () => {
  // Let's create an elaborate floorplan matching the images.
  // Dimensions 1000 x 400 x 1000 approximate grid
  const wallHeight = 60;
  
  const shellGeometry = useMemo(() => {
    return new THREE.EdgesGeometry(new THREE.BoxGeometry(1050, wallHeight * 3.5, 950));
  }, [wallHeight]);

  return (
    <group position={[0, -20, 0]}>
      {/* ================= FLOOR 1 ================= */}
      <group position={[0, 0, 0]}>
        {/* Left Side */}
        <RoomBox position={[-350, wallHeight/2, -200]} size={[200, wallHeight, 200]} label="Yoga studio A" subLabel="Hot yoga" color={COLORS.purple} />
        <RoomBox position={[-350, wallHeight/2, 0]} size={[200, wallHeight, 200]} label="Yoga studio B" subLabel="Vinyasa flow" color={COLORS.purple} />
        <RoomBox position={[-350, wallHeight/2, 250]} size={[200, wallHeight, 300]} label="Women's locker" color={COLORS.purple} />
        
        {/* Top/Back */}
        <RoomBox position={[-100, wallHeight/2, -350]} size={[300, wallHeight, 100]} label="Meditation lounge" subLabel="Quiet seating" color={COLORS.purple} />
        <RoomBox position={[200, wallHeight/2, -350]} size={[300, wallHeight, 100]} label="FUEL LAB" subLabel="Smoothies · supplements" color={COLORS.magenta} />
        
        {/* Right Side */}
        <RoomBox position={[400, wallHeight/2, -200]} size={[200, wallHeight, 100]} label="Massage 1" subLabel="Deep tissue" color={COLORS.purple} />
        <RoomBox position={[400, wallHeight/2, -100]} size={[200, wallHeight, 100]} label="Massage 2" subLabel="Swedish" color={COLORS.purple} />
        <RoomBox position={[400, wallHeight/2, 50]} size={[200, wallHeight, 100]} label="Meditation A" subLabel="Guided" color={COLORS.purple} />
        <RoomBox position={[400, wallHeight/2, 150]} size={[200, wallHeight, 100]} label="Meditation B" subLabel="Sound bath" color={COLORS.purple} />
        <RoomBox position={[400, wallHeight/2, 300]} size={[200, wallHeight, 200]} label="Men's locker" color={COLORS.purple} />
        
        {/* Enter/Reception */}
        <RoomBox position={[0, wallHeight/2, 350]} size={[400, wallHeight, 50]} label="Reception" subLabel="Check-in · concierge" color={COLORS.magenta} />
        <RoomBox position={[0, wallHeight/2, 450]} size={[100, wallHeight, 40]} label="Entrance" color={COLORS.purple} />

        {/* Center Atrium (approximation using generic room bounding or custom structure) */}
        <group position={[0, wallHeight/2, 0]}>
           <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[130, 135, 64, 1, 0, Math.PI * 1.5]} />
              <meshBasicMaterial color={COLORS.magenta} transparent opacity={0.6} toneMapped={false} />
           </mesh>
           <group position={[0, 20, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <Text position={[-30, 15, 0]} fontSize={24} color={COLORS.magenta} anchorX="center" anchorY="middle" fontWeight="bold">Atrium</Text>
              <Text position={[-30, -10, 0]} fontSize={14} color="#ffffff" anchorX="center" anchorY="middle">Two-story</Text>
              <Text position={[-30, -28, 0]} fontSize={14} color="#ffffff" anchorX="center" anchorY="middle">open above</Text>
           </group>
        </group>

        {/* Planter */}
        <group position={[150, 5, 250]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]} scale={[1, 0.5, 1]}>
            <circleGeometry args={[40, 32]} />
            <meshBasicMaterial color={COLORS.darkBg} transparent opacity={0.8} />
          </mesh>
          <lineSegments rotation={[-Math.PI / 2, 0, 0]} scale={[1, 0.5, 1]}>
             <edgesGeometry args={[new THREE.CylinderGeometry(40, 40, 10, 32)]} />
             <lineBasicMaterial color={COLORS.teal} toneMapped={false} />
          </lineSegments>
          
          <Text position={[0, 20, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={14} color={COLORS.teal} anchorX="center" anchorY="middle">Planter</Text>
        </group>
        
        {/* Decorative Squares */}
        <RoomBox position={[-200, 10, 315]} size={[30, 20, 30]} color={COLORS.purple} />
        <RoomBox position={[200, 10, 315]} size={[30, 20, 30]} color={COLORS.purple} />

      </group>

      {/* ================= FLOOR 2 ================= */}
      <group position={[0, wallHeight * 2.5, 0]}>
        {/* Left Side */}
        <RoomBox position={[-400, wallHeight/2, -100]} size={[150, wallHeight, 400]} label="Cardio zone" subLabel="Treadmills · bikes" color={COLORS.purple} />
        <RoomBox position={[-400, wallHeight/2, 250]} size={[150, wallHeight, 200]} label="Rowers · skiergs" color={COLORS.purple} />
        
        {/* Top/Back */}
        <RoomBox position={[0, wallHeight/2, -350]} size={[500, wallHeight, 100]} label="Stretching · functional" subLabel="Mats · TRX · turf strip" color={COLORS.purple} />
        
        {/* Right Side */}
        <RoomBox position={[400, wallHeight/2, -150]} size={[200, wallHeight, 280]} label="Free weights" subLabel="Dumbbells · benches" color={COLORS.purple} />
        <RoomBox position={[400, wallHeight/2, 150]} size={[200, wallHeight, 250]} label="Weight machines" subLabel="Cable · plate-loaded" color={COLORS.purple} />
        <RoomBox position={[400, wallHeight/2, 350]} size={[200, wallHeight, 100]} label="Restrooms" color={COLORS.purple} />
        
        {/* Bottom/Front */}
        <RoomBox position={[0, wallHeight/2, 350]} size={[500, wallHeight, 100]} label="Recovery lounge" subLabel="Foam rollers · hydration · stretching" color={COLORS.purple} />
        
        {/* Center Open Atrium Ring */}
        <group position={[0, wallHeight/2, 0]}>
           <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[130, 135, 64]} />
              <meshBasicMaterial color={COLORS.magenta} transparent opacity={0.6} toneMapped={false} />
           </mesh>
           <group position={[0, 20, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <Text position={[0, 15, 0]} fontSize={24} color={COLORS.magenta} anchorX="center" anchorY="middle" fontWeight="bold">Open atrium</Text>
              <Text position={[0, -10, 0]} fontSize={14} color="#ffffff" anchorX="center" anchorY="middle">Looks down</Text>
              <Text position={[0, -28, 0]} fontSize={14} color="#ffffff" anchorX="center" anchorY="middle">to lobby below</Text>
           </group>
        </group>
      </group>

      {/* Main Building Outline Shell */}
      <group position={[0, wallHeight * 1.5, 0]}>
        <lineSegments geometry={shellGeometry}>
            <lineBasicMaterial color={COLORS.purple} toneMapped={false} transparent opacity={0.3} />
        </lineSegments>
      </group>
    </group>
  );
};
