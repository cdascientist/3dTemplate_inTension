import React, { useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { InTensionPlaque } from '../lib/InTensionPlaque';

interface InTensionPlaqueProperties {
    position?: [number, number, number];
    scale?: number;
    onClick?: () => void;
    isHighlighted?: boolean;
}

export const InTensionPlaque3D: React.FC<InTensionPlaqueProperties> = ({
    position = [0, 0, 0],
    scale = 1,
    onClick,
    isHighlighted = false
}) => {
    const { gl } = useThree();
    const plaqueRef = useRef<InTensionPlaque | null>(null);
    const [plaqueInstance, setPlaqueInstance] = useState<InTensionPlaque | null>(null);

    useEffect(() => {
        const anisotropy = gl.capabilities.getMaxAnisotropy();
        const plaque = new InTensionPlaque({
            text: 'InTension',
            width: 50.0,
            height: 30.0,
            depth: 4.5,
            cornerRadius: 4.0,
            italic: true,
            seed: 1,
            anisotropy,
        });
        setPlaqueInstance(plaque);
        plaqueRef.current = plaque;

        return () => {
            plaque.dispose();
        };
    }, [gl]);

    useFrame((state) => {
        if (plaqueRef.current) {
            plaqueRef.current.update(state.clock.elapsedTime);
        }
    });

    if (!plaqueInstance) return null;

    return (
        <group position={position} scale={[scale, scale, scale]} onClick={onClick}>
            <primitive object={plaqueInstance} />
            {isHighlighted && (
                <mesh position={[0, 0, -2]}>
                    <planeGeometry args={[52, 32]} />
                    <meshBasicMaterial color="#a855f7" wireframe transparent opacity={0.6} />
                </mesh>
            )}
        </group>
    );
};
