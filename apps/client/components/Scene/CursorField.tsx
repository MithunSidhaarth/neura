"use client";

import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

export const cursor = new THREE.Vector3(999,999,999);

const plane = new THREE.Plane(new THREE.Vector3(0,0,1),0);

const raycaster = new THREE.Raycaster();

export default function CursorField(){

    const {camera,mouse} = useThree();

    useFrame(()=>{

        raycaster.setFromCamera(mouse,camera);

        raycaster.ray.intersectPlane(
            plane,
            cursor
        );

    });

    return null;

}