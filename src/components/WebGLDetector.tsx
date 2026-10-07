import { useState } from 'react';

function detectWebGL(): boolean {
    if (typeof document === 'undefined') return false;

    try {
        const canvas = document.createElement('canvas');
        return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
    } catch {
        return false;
    }
}

export default function WebGLDetector() {
    const [ok] = useState(detectWebGL);
    return ok;
}
