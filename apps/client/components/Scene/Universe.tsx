"use client";

import { Color } from "three";
import { useThree } from "@react-three/fiber";
import { useEffect } from "react";

export default function Universe() {

    const { scene } = useThree();

    useEffect(() => {

        scene.background = new Color("#020202");

    }, [scene]);

    return null;

}