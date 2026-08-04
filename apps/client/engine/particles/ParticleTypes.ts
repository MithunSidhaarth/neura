import * as THREE from "three";

/**
 * Type of particle in the universe.
 */
export enum ParticleKind {
  BackgroundStar = "background-star",
  Dust = "dust",
  Neuron = "neuron",
  Foreground = "foreground",
}

/**
 * Runtime state of a neuron.
 */
export enum ParticleState {
  Sleeping = "sleeping",
  Idle = "idle",
  Active = "active",
  Excited = "excited",
}

/**
 * A single neural connection.
 */
export interface ParticleConnection {
  targetId: number;
  strength: number;
  distance: number;
  signal: number;
}

/**
 * Core particle interface.
 * Every renderer and simulation module
 * uses this structure.
 */
export interface Particle {

  id: number;

  kind: ParticleKind;

  state: ParticleState;

  position: THREE.Vector3;

  velocity: THREE.Vector3;

  acceleration: THREE.Vector3;

  initialPosition: THREE.Vector3;

  energy: number;

  attention: number;

  pulse: number;

  glow: number;

  opacity: number;

  radius: number;

  mass: number;

  temperature: number;

  age: number;

  life: number;

  noiseOffset: number;

  cluster: number;

  signalStrength: number;

  connections: ParticleConnection[];

}

/**
 * Engine configuration.
 */
export interface ParticleSystemSettings {

  backgroundStars: number;

  dustParticles: number;

  neurons: number;

  foregroundParticles: number;

  worldRadius: number;

  cursorRadius: number;

  maxConnections: number;

}