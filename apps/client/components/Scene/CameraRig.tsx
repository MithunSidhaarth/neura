"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { engineStore } from "@/engine/store/EngineStore";
import { getNeuralGraph } from "./neuralGraph";
import { cameraDragState } from "@/engine/camera/dragState";

const ORIGIN = new THREE.Vector3(0, 0, 0);
const desired = new THREE.Vector3();
const right = new THREE.Vector3();
const up = new THREE.Vector3();
const forward = new THREE.Vector3();

const MIN_DIST = 3;
const MAX_DIST = 320;
const MAX_PHI = 1.35; // ~77deg, keeps the orbit from flipping over the pole
const ORBIT_SPEED = 0.0055;
const PAN_SPEED = 0.0016; // scaled by distance so panning feels consistent at any zoom
const ZOOM_SPEED = 0.0016;
const FRICTION = 0.9; // per-frame velocity decay once the pointer is released

type PointerInfo = { x: number; y: number };

export default function CameraRig() {

    const { camera, gl } = useThree();

    // The point the camera orbits/idles around. Eased toward either the
    // origin (ambient overview) or a selected neuron's position (focus) so
    // switching between them is a fly, not a cut.
    const center = useRef(new THREE.Vector3(0, 0, 0));
    const lookTarget = useRef(new THREE.Vector3(0, 0, 0));
    const baseDistance = useRef(18);

    // User-driven orbit/pan/zoom state. These are added on top of the
    // ambient idle motion and the focus fly-to above, rather than
    // replacing it -- so dragging around a focused neuron still orbits it,
    // and letting go still eases back into the idle drift.
    const theta = useRef(0); // horizontal orbit angle
    const phi = useRef(0.08); // vertical orbit angle
    const distanceOffset = useRef(0); // user zoom, added to baseDistance
    const panOffset = useRef(new THREE.Vector3());

    const velTheta = useRef(0);
    const velPhi = useRef(0);
    const velDistance = useRef(0);
    const velPan = useRef(new THREE.Vector3());

    const pointers = useRef(new Map<number, PointerInfo>());
    const panMode = useRef(false);
    const lastSelectedId = useRef<string | null>(null);
    const pinchStartDist = useRef(0);
    const pinchStartZoom = useRef(0);

    useEffect(() => {

        const el = gl.domElement;

        const getPan = () => panMode.current || pointers.current.size >= 2;

        const onPointerDown = (e: PointerEvent) => {
            el.setPointerCapture(e.pointerId);
            pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
            panMode.current = e.shiftKey || e.button === 2;
            cameraDragState.start();
            velTheta.current = 0;
            velPhi.current = 0;
            velPan.current.set(0, 0, 0);

            if (pointers.current.size === 2) {
                const pts = Array.from(pointers.current.values());
                pinchStartDist.current = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
                pinchStartZoom.current = distanceOffset.current;
            }
        };

        const onPointerMove = (e: PointerEvent) => {
            const prev = pointers.current.get(e.pointerId);
            if (!prev) return;
            pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

            if (pointers.current.size >= 2) {
                // Two-finger pinch: distance change zooms, midpoint drift pans.
                const pts = Array.from(pointers.current.values());
                const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
                if (pinchStartDist.current > 0) {
                    const scale = pinchStartDist.current / Math.max(dist, 1);
                    distanceOffset.current = pinchStartZoom.current + (scale - 1) * baseDistance.current * 0.6;
                }
                return;
            }

            const dx = e.clientX - prev.x;
            const dy = e.clientY - prev.y;
            if (Math.abs(dx) + Math.abs(dy) > 2) cameraDragState.markMoved();

            if (getPan()) {
                const dist = baseDistance.current + distanceOffset.current;
                const panX = -dx * PAN_SPEED * dist;
                const panY = dy * PAN_SPEED * dist;
                right.setFromMatrixColumn(camera.matrix, 0);
                up.setFromMatrixColumn(camera.matrix, 1);
                const delta = right.clone().multiplyScalar(panX).add(up.clone().multiplyScalar(panY));
                panOffset.current.add(delta);
                velPan.current.copy(delta);
            } else {
                const dTheta = -dx * ORBIT_SPEED;
                const dPhi = -dy * ORBIT_SPEED;
                theta.current += dTheta;
                phi.current = THREE.MathUtils.clamp(phi.current + dPhi, -MAX_PHI, MAX_PHI);
                velTheta.current = dTheta;
                velPhi.current = dPhi;
            }
        };

        const onPointerUp = (e: PointerEvent) => {
            pointers.current.delete(e.pointerId);
            if (pointers.current.size === 0) cameraDragState.end();
        };

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const delta = e.deltaY * ZOOM_SPEED * (baseDistance.current + distanceOffset.current);
            velDistance.current += delta;
        };

        const onContextMenuCapture = (e: MouseEvent) => {
            // Right-drag is used for panning; suppress the browser context
            // menu only when it followed an actual drag (a plain right
            // click still opens the app's own neuron context menu via
            // PickingLayer).
            if (cameraDragState.isDragging) e.preventDefault();
        };

        el.addEventListener("pointerdown", onPointerDown);
        el.addEventListener("pointermove", onPointerMove);
        el.addEventListener("pointerup", onPointerUp);
        el.addEventListener("pointercancel", onPointerUp);
        el.addEventListener("wheel", onWheel, { passive: false });
        el.addEventListener("contextmenu", onContextMenuCapture);

        return () => {
            el.removeEventListener("pointerdown", onPointerDown);
            el.removeEventListener("pointermove", onPointerMove);
            el.removeEventListener("pointerup", onPointerUp);
            el.removeEventListener("pointercancel", onPointerUp);
            el.removeEventListener("wheel", onWheel);
            el.removeEventListener("contextmenu", onContextMenuCapture);
        };

    }, [camera, gl]);

    useFrame(({ clock }) => {

        const t = clock.getElapsedTime();
        const { selectedId } = engineStore.getState();

        // Fresh focus target: recenter the pan offset (so the new neuron
        // lands in the middle of the view) but keep the orbit angle and
        // zoom the user already dialed in -- a focus transition, not a
        // hard reset of everything they set up.
        if (selectedId !== lastSelectedId.current) {
            lastSelectedId.current = selectedId;
            panOffset.current.set(0, 0, 0);
            velPan.current.set(0, 0, 0);
        }

        let target = ORIGIN;
        let targetBaseDistance = 18;

        if (selectedId) {
            const { clusters } = getNeuralGraph();
            const node = clusters.find((c) => c.id === selectedId);
            if (node) {
                target = node.position;
                targetBaseDistance = 6.5;
            }
        }

        // Inertia: while nothing is actively pointer-down, let the last
        // drag velocity keep nudging the angles/pan/zoom and decay it,
        // instead of stopping dead the instant the pointer lifts.
        const isDown = pointers.current.size > 0;
        if (!isDown) {
            theta.current += velTheta.current;
            phi.current = THREE.MathUtils.clamp(phi.current + velPhi.current, -MAX_PHI, MAX_PHI);
            panOffset.current.add(velPan.current);
            distanceOffset.current += velDistance.current;

            velTheta.current *= FRICTION;
            velPhi.current *= FRICTION;
            velPan.current.multiplyScalar(FRICTION);
            velDistance.current *= FRICTION;
        } else {
            distanceOffset.current += velDistance.current;
            velDistance.current *= FRICTION;
        }

        const maxOffset = MAX_DIST - targetBaseDistance;
        distanceOffset.current = THREE.MathUtils.clamp(distanceOffset.current, MIN_DIST - targetBaseDistance, maxOffset);

        center.current.lerp(target, 0.035);
        center.current.add(panOffset.current);
        baseDistance.current += (targetBaseDistance - baseDistance.current) * 0.035;

        const distance = THREE.MathUtils.clamp(
            baseDistance.current + distanceOffset.current,
            MIN_DIST,
            MAX_DIST
        );

        // Idle wobble on top of the user's orbit, damped down while they're
        // actively dragging so it doesn't fight their input.
        const idleDamp = isDown ? 0.15 : 1;
        const idleX = Math.sin(t * 0.08) * 0.5 * idleDamp;
        const idleY = Math.cos(t * 0.06) * 0.3 * idleDamp;
        const idleZ = Math.sin(t * 0.12) * 0.3 * idleDamp;

        forward.set(
            Math.sin(theta.current) * Math.cos(phi.current),
            Math.sin(phi.current),
            Math.cos(theta.current) * Math.cos(phi.current)
        );

        desired.set(
            center.current.x + forward.x * distance + idleX,
            center.current.y + forward.y * distance + idleY,
            center.current.z + forward.z * distance + idleZ
        );

        camera.position.lerp(desired, 0.08);

        lookTarget.current.lerp(center.current, 0.09);
        camera.lookAt(lookTarget.current);

    });

    return null;

}
