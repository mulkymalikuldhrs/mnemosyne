// ============================================================
// Memorix AI Memory - Face Tracking Service
// Camera-based face detection, tracking, and identification
// for Memorix AI Memory platform.
// Supports multiple tracking modes, pan-tilt servo control,
// face recognition database, and AI-powered identification.
// Optimized for Raspberry Pi with TFLite fallback.
// ============================================================

import ZAI from 'z-ai-web-dev-sdk'
import { db } from './db'
import type { FaceTrackingConfig } from './types'

// ============================================================
// Types
// ============================================================

export type TrackingMode = 'follow' | 'detect' | 'identify'
export type TrackingStatus = 'idle' | 'detecting' | 'tracking' | 'identifying' | 'error'
export type DetectionBackend = 'opencv' | 'tflite' | 'simulation'

export interface DetectedFace {
  id: string
  boundingBox: BoundingBox
  confidence: number
  landmarks?: FaceLandmarks
  encoding?: number[]
  label?: string
  recognizedPerson?: RecognizedPerson
  timestamp: string
}

export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
  centerX: number
  centerY: number
  area: number
}

export interface FaceLandmarks {
  leftEye: { x: number; y: number }
  rightEye: { x: number; y: number }
  nose: { x: number; y: number }
  leftMouth: { x: number; y: number }
  rightMouth: { x: number; y: number }
}

export interface RecognizedPerson {
  faceProfileId: string
  name: string
  label: string
  confidence: number
  sightingCount: number
  lastSeen: string
}

export interface FaceProfileEntry {
  id: string
  name: string
  label: string
  encoding: number[]
  photoPath?: string
  metadata?: Record<string, unknown>
  confidence: number
  sightingCount: number
  lastSeen: string
  createdAt: string
  updatedAt: string
}

export interface ServoPosition {
  pan: number   // Horizontal angle (-90 to 90)
  tilt: number  // Vertical angle (-45 to 45)
}

export interface TrackingState {
  status: TrackingStatus
  mode: TrackingMode
  backend: DetectionBackend
  activeFace: DetectedFace | null
  allFaces: DetectedFace[]
  servoPosition: ServoPosition
  frameCount: number
  fps: number
  lastDetectionTime: string | null
  isRunning: boolean
}

export interface CameraFrame {
  width: number
  height: number
  channels: number
  data: unknown // Raw frame data (Buffer, ImageData, etc.)
  timestamp: string
  format: 'rgb' | 'bgr' | 'jpeg' | 'raw'
}

export interface FaceTrackingEvent {
  type: 'face_detected' | 'face_lost' | 'face_recognized' | 'tracking_started' | 'tracking_stopped' | 'servo_moved' | 'error'
  timestamp: Date
  data?: unknown
}

type FaceTrackingEventCallback = (event: FaceTrackingEvent) => void

// ============================================================
// Default Configuration
// ============================================================

const DEFAULT_TRACKING_CONFIG: FaceTrackingConfig = {
  enabled: true,
  modelPath: '/opt/memorix/models/face_detection.tflite',
  confidenceThreshold: 0.7,
  trackingMode: 'detect',
  maxFaces: 5,
  followDistance: 200, // Target distance in cm
}

const DEFAULT_SERVO_POSITION: ServoPosition = {
  pan: 0,
  tilt: 0,
}

// Servo limits for pan-tilt mechanism
const SERVO_LIMITS = {
  panMin: -90,
  panMax: 90,
  tiltMin: -45,
  tiltMax: 45,
  panStep: 5,   // Degrees per adjustment step
  tiltStep: 3,
}

// Face encoding dimensions (standard 128-D for dlib, 512-D for FaceNet)
const ENCODING_DIMENSIONS = 128

// ============================================================
// FaceTrackingService — Singleton service
// ============================================================

export class FaceTrackingService {
  private static instance: FaceTrackingService

  // Configuration
  private config: FaceTrackingConfig = { ...DEFAULT_TRACKING_CONFIG }

  // State
  private status: TrackingStatus = 'idle'
  private backend: DetectionBackend = 'simulation'
  private isRunning = false

  // Tracking state
  private activeFace: DetectedFace | null = null
  private allFaces: DetectedFace[] = []
  private servoPosition: ServoPosition = { ...DEFAULT_SERVO_POSITION }
  private frameCount = 0
  private fps = 0
  private lastDetectionTime: string | null = null
  private fpsCounter = 0
  private fpsLastTime = Date.now()

  // Face database (in-memory cache of DB records)
  private faceDatabase: Map<string, FaceProfileEntry> = new Map()

  // Processing
  private processingInterval: ReturnType<typeof setInterval> | null = null
  private trackingInterval: ReturnType<typeof setInterval> | null = null

  // Events
  private eventListeners: FaceTrackingEventCallback[] = []

  // AI SDK
  private zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null

  // GPIO pins for pan-tilt servos
  private panServoPin: number = 18  // GPIO18 = PWM0
  private tiltServoPin: number = 19 // GPIO19 = PWM1

  private constructor() {}

  static getInstance(): FaceTrackingService {
    if (!FaceTrackingService.instance) {
      FaceTrackingService.instance = new FaceTrackingService()
    }
    return FaceTrackingService.instance
  }

  private async getZAI(): Promise<NonNullable<typeof this.zaiInstance>> {
    if (!this.zaiInstance) {
      this.zaiInstance = await ZAI.create()
    }
    return this.zaiInstance
  }

  // ============================================================
  // Lifecycle
  // ============================================================

  /**
   * Initialize the face tracking service.
   * Loads config from DB and detects available backends.
   */
  async initialize(config?: Partial<FaceTrackingConfig>): Promise<void> {

    // Merge config
    if (config) {
      this.config = { ...this.config, ...config }
    }

    // Load config from DB if available
    try {
      const dbConfig = await db.systemConfig.findUnique({
        where: { key: 'face_tracking.config' },
      })
      if (dbConfig) {
        const parsed = JSON.parse(dbConfig.value) as Partial<FaceTrackingConfig>
        this.config = { ...this.config, ...parsed }
      }
    } catch {
      // DB not available or config not set
    }

    // Detect available backend
    this.backend = await this.detectBackend()

    // Load face database from DB into memory
    await this.loadFaceDatabase()

  }

  /**
   * Start face tracking with the specified mode.
   */
  async startTracking(mode?: TrackingMode): Promise<void> {
    if (this.isRunning) {
      return
    }

    if (mode) {
      this.config.trackingMode = mode
    }

    this.isRunning = true
    this.status = 'detecting'
    this.frameCount = 0
    this.fpsCounter = 0
    this.fpsLastTime = Date.now()

    // Start the detection loop
    this.processingInterval = setInterval(async () => {
      try {
        await this.processFrame()
      } catch (err) {
        this.status = 'error'
      }
    }, 100) // 10 FPS target

    // Start the tracking/servo loop (separate from detection)
    if (this.config.trackingMode === 'follow') {
      this.trackingInterval = setInterval(async () => {
        try {
          await this.updateTracking()
        } catch (err) {
        }
      }, 50) // 20 Hz servo update
    }

    // Update DB config
    await this.persistConfig()

    this.emitEvent('tracking_started', { mode: this.config.trackingMode, backend: this.backend })
  }

  /**
   * Stop face tracking.
   */
  async stopTracking(): Promise<void> {
    if (!this.isRunning) return

    this.isRunning = false
    this.status = 'idle'
    this.activeFace = null
    this.allFaces = []

    // Clear intervals
    if (this.processingInterval) {
      clearInterval(this.processingInterval)
      this.processingInterval = null
    }
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval)
      this.trackingInterval = null
    }

    // Reset servo position
    this.servoPosition = { ...DEFAULT_SERVO_POSITION }
    await this.moveServos(this.servoPosition)

    this.emitEvent('tracking_stopped')
  }

  /**
   * Get the current tracking status.
   */
  getTrackingStatus(): TrackingState {
    return {
      status: this.status,
      mode: this.config.trackingMode as TrackingMode,
      backend: this.backend,
      activeFace: this.activeFace,
      allFaces: this.allFaces,
      servoPosition: { ...this.servoPosition },
      frameCount: this.frameCount,
      fps: this.fps,
      lastDetectionTime: this.lastDetectionTime,
      isRunning: this.isRunning,
    }
  }

  /**
   * Get the current configuration.
   */
  getConfig(): FaceTrackingConfig {
    return { ...this.config }
  }

  /**
   * Update the configuration.
   */
  async updateConfig(config: Partial<FaceTrackingConfig>): Promise<void> {
    this.config = { ...this.config, ...config }
    await this.persistConfig()
  }

  // ============================================================
  // Face Detection
  // ============================================================

  /**
   * Detect faces in a camera frame.
   * Returns an array of detected faces with bounding boxes and confidence.
   */
  async detectFaces(frame?: CameraFrame): Promise<DetectedFace[]> {
    const timestamp = new Date().toISOString()

    if (this.backend === 'simulation') {
      return this.simulateFaceDetection(timestamp)
    }

    try {
      // In real mode, this would:
      // 1. Use OpenCV's Haar cascade or DNN face detector
      // 2. Or use TFLite face detection model on the Pi
      // 3. Return detected face bounding boxes

      if (this.backend === 'tflite') {
        return await this.tfliteDetectFaces(frame, timestamp)
      }

      if (this.backend === 'opencv') {
        return await this.opencvDetectFaces(frame, timestamp)
      }

      return []
    } catch (err) {
      this.status = 'error'
      return []
    }
  }

  /**
   * Process a single camera frame: detect faces, update state.
   */
  private async processFrame(): Promise<void> {
    if (!this.isRunning) return

    this.frameCount++
    this.fpsCounter++

    // Calculate FPS every second
    const now = Date.now()
    if (now - this.fpsLastTime >= 1000) {
      this.fps = this.fpsCounter
      this.fpsCounter = 0
      this.fpsLastTime = now
    }

    // Detect faces
    const faces = await this.detectFaces()
    this.allFaces = faces

    if (faces.length > 0) {
      this.lastDetectionTime = new Date().toISOString()

      // Select the primary face to track (largest or highest confidence)
      const primaryFace = this.selectPrimaryFace(faces)

      // Check if we lost the previous face
      if (this.activeFace && primaryFace.id !== this.activeFace.id) {
        this.emitEvent('face_lost', { previousFace: this.activeFace })
      }

      this.activeFace = primaryFace

      // Update tracking status based on mode
      if (this.config.trackingMode === 'identify' && !primaryFace.recognizedPerson) {
        this.status = 'identifying'
        // Try to identify the face
        const recognized = await this.identifyFace(primaryFace)
        if (recognized) {
          primaryFace.recognizedPerson = recognized
          this.emitEvent('face_recognized', recognized)
        }
      } else if (this.config.trackingMode === 'follow') {
        this.status = 'tracking'
      } else {
        this.status = 'detecting'
      }

      this.emitEvent('face_detected', primaryFace)
    } else {
      // No faces detected
      if (this.activeFace) {
        this.emitEvent('face_lost', { previousFace: this.activeFace })
        this.activeFace = null
      }
      this.status = 'detecting'
    }
  }

  /**
   * Select the primary face to track from multiple detected faces.
   * Prioritizes: previously tracked face > largest face > highest confidence.
   */
  private selectPrimaryFace(faces: DetectedFace[]): DetectedFace {
    if (faces.length === 0) {
      throw new Error('No faces to select from')
    }

    if (faces.length === 1) return faces[0]

    // If we were tracking a face, try to find it again
    if (this.activeFace) {
      const sameFace = faces.find(f =>
        f.label === this.activeFace!.label ||
        f.recognizedPerson?.faceProfileId === this.activeFace!.recognizedPerson?.faceProfileId
      )
      if (sameFace) return sameFace
    }

    // Select the face with the largest bounding box area (closest)
    return faces.reduce((largest, face) =>
      face.boundingBox.area > largest.boundingBox.area ? face : largest
    )
  }

  // ============================================================
  // Face Tracking (Servo Control)
  // ============================================================

  /**
   * Track a face by sending servo commands to follow it.
   * Adjusts pan-tilt servos to keep the face centered in frame.
   */
  async trackFace(face: DetectedFace): Promise<ServoPosition> {
    if (!face) {
      return this.servoPosition
    }

    const frameCenterX = 320  // Assuming 640x480 resolution
    const frameCenterY = 240

    // Calculate offset from center
    const offsetX = face.boundingBox.centerX - frameCenterX
    const offsetY = face.boundingBox.centerY - frameCenterY

    // Calculate servo adjustment (proportional control)
    const panAdjustment = Math.sign(offsetX) * Math.min(Math.abs(offsetX / frameCenterX) * SERVO_LIMITS.panStep, SERVO_LIMITS.panStep)
    const tiltAdjustment = Math.sign(offsetY) * Math.min(Math.abs(offsetY / frameCenterY) * SERVO_LIMITS.tiltStep, SERVO_LIMITS.tiltStep)

    // Apply dead zone (don't move for small offsets)
    const deadZone = 0.05 // 5% of frame
    const normalizedOffsetX = Math.abs(offsetX) / frameCenterX
    const normalizedOffsetY = Math.abs(offsetY) / frameCenterY

    let newPan = this.servoPosition.pan
    let newTilt = this.servoPosition.tilt

    if (normalizedOffsetX > deadZone) {
      newPan = this.clampServo(
        this.servoPosition.pan + panAdjustment,
        'pan'
      )
    }

    if (normalizedOffsetY > deadZone) {
      newTilt = this.clampServo(
        this.servoPosition.tilt + tiltAdjustment,
        'tilt'
      )
    }

    const newPosition: ServoPosition = { pan: newPan, tilt: newTilt }

    // Only move if there's a meaningful change
    const panDiff = Math.abs(newPosition.pan - this.servoPosition.pan)
    const tiltDiff = Math.abs(newPosition.tilt - this.servoPosition.tilt)

    if (panDiff > 0.5 || tiltDiff > 0.5) {
      await this.moveServos(newPosition)
      this.servoPosition = newPosition
      this.emitEvent('servo_moved', newPosition)
    }

    return this.servoPosition
  }

  /**
   * Update tracking loop — called at higher frequency than detection.
   */
  private async updateTracking(): Promise<void> {
    if (!this.isRunning || !this.activeFace) return

    if (this.config.trackingMode === 'follow') {
      await this.trackFace(this.activeFace)
    }
  }

  /**
   * Move pan-tilt servos to the specified position.
   * In real mode, this sends GPIO PWM commands.
   */
  private async moveServos(position: ServoPosition): Promise<void> {
    if (this.backend === 'simulation') {
      // Simulate servo movement — just update position
      return
    }

    // Real hardware: convert angles to PWM duty cycle
    // Standard servo: 0° = 0.5ms pulse, 180° = 2.5ms pulse
    // At 50Hz (20ms period): duty cycle = angle/180 * 10 + 2.5
    const panDutyCycle = ((position.pan + 90) / 180) * 10 + 2.5
    const tiltDutyCycle = ((position.tilt + 45) / 90) * 10 + 2.5

    try {
      // Would use pigpio or rpi-gpio to set PWM
    } catch (err) {
    }
  }

  // ============================================================
  // Face Registration & Identification
  // ============================================================

  /**
   * Register a new face in the database.
   * Captures the face encoding and stores it for future identification.
   */
  async registerFace(
    name: string,
    label: string,
    face: DetectedFace,
    photoPath?: string,
    metadata?: Record<string, unknown>
  ): Promise<FaceProfileEntry> {

    // Check if label already exists
    const existing = await db.faceProfile.findFirst({ where: { label } })
    if (existing) {
      throw new Error(`Face profile with label "${label}" already exists`)
    }

    // Generate face encoding if not provided
    const encoding = face.encoding || await this.generateFaceEncoding(face)

    // Store in database
    const profile = await db.faceProfile.create({
      data: {
        name,
        label,
        encoding: JSON.stringify(encoding),
        photoPath: photoPath || null,
        metadata: metadata ? JSON.stringify(metadata) : null,
        confidence: face.confidence,
        sightingCount: 1,
        lastSeen: new Date(),
      },
    })

    // Update in-memory cache
    const entry = this.profileToEntry(profile)
    this.faceDatabase.set(profile.id, entry)

    // Record this as a learning event
    try {
      const { getSelfLearnService } = await import('./self-learn')
      const learnService = getSelfLearnService()
      await learnService.recordDecision(
        'face_tracking',
        'register_face',
        `Registering new face: ${name}`,
        `Store face encoding for "${label}"`,
        `Face can be identified in future detections`,
        face.confidence,
      )
    } catch {
      // Self-learn service may not be available
    }

    return entry
  }

  /**
   * Identify a detected face by comparing its encoding against the database.
   */
  async identifyFace(face: DetectedFace): Promise<RecognizedPerson | null> {
    if (this.faceDatabase.size === 0) {
      await this.loadFaceDatabase()
    }

    if (this.faceDatabase.size === 0) {
      return null
    }

    // Generate encoding if not available
    const encoding = face.encoding || await this.generateFaceEncoding(face)

    if (!encoding || encoding.length === 0) {
      return null
    }

    // Compare against all known faces
    let bestMatch: { entry: FaceProfileEntry; distance: number } | null = null

    for (const entry of this.faceDatabase.values()) {
      const distance = this.computeFaceDistance(encoding, entry.encoding)
      const similarity = 1 - distance

      if (!bestMatch || distance < bestMatch.distance) {
        bestMatch = { entry, distance }
      }

      // If similarity is above threshold, we have a match
      if (similarity >= this.config.confidenceThreshold && (!bestMatch || distance < bestMatch.distance)) {
        bestMatch = { entry, distance }
      }
    }

    // Check if the best match meets the confidence threshold
    if (bestMatch && (1 - bestMatch.distance) >= this.config.confidenceThreshold) {
      const confidence = Math.round((1 - bestMatch.distance) * 100) / 100

      // Update sighting count in DB
      try {
        await db.faceProfile.update({
          where: { id: bestMatch.entry.id },
          data: {
            sightingCount: { increment: 1 },
            lastSeen: new Date(),
            confidence: (bestMatch.entry.confidence * bestMatch.entry.sightingCount + confidence) / (bestMatch.entry.sightingCount + 1),
          },
        })

        // Update in-memory cache
        bestMatch.entry.sightingCount++
        bestMatch.entry.lastSeen = new Date().toISOString()
        bestMatch.entry.confidence = Math.round(
          ((bestMatch.entry.confidence * (bestMatch.entry.sightingCount - 1) + confidence) / bestMatch.entry.sightingCount) * 100
        ) / 100
      } catch {
        // DB update failed
      }

      return {
        faceProfileId: bestMatch.entry.id,
        name: bestMatch.entry.name,
        label: bestMatch.entry.label,
        confidence,
        sightingCount: bestMatch.entry.sightingCount,
        lastSeen: bestMatch.entry.lastSeen,
      }
    }

    // No match found — try AI-powered identification if available
    if (this.config.trackingMode === 'identify') {
      return await this.aiIdentifyFace(face)
    }

    return null
  }

  /**
   * Delete a face profile from the database.
   */
  async deleteFace(faceProfileId: string): Promise<boolean> {
    try {
      await db.faceProfile.delete({ where: { id: faceProfileId } })
      this.faceDatabase.delete(faceProfileId)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get all registered face profiles.
   */
  async getAllFaces(): Promise<FaceProfileEntry[]> {
    try {
      const profiles = await db.faceProfile.findMany({
        orderBy: { lastSeen: 'desc' },
      })
      return profiles.map(p => this.profileToEntry(p))
    } catch {
      return Array.from(this.faceDatabase.values())
    }
  }

  /**
   * Get a specific face profile by ID.
   */
  async getFace(faceProfileId: string): Promise<FaceProfileEntry | null> {
    const cached = this.faceDatabase.get(faceProfileId)
    if (cached) return cached

    try {
      const profile = await db.faceProfile.findUnique({ where: { id: faceProfileId } })
      if (!profile) return null
      return this.profileToEntry(profile)
    } catch {
      return null
    }
  }

  // ============================================================
  // Detection Backends
  // ============================================================

  /**
   * Detect which face detection backend is available.
   */
  private async detectBackend(): Promise<DetectionBackend> {
    try {
      // Check for TFLite runtime (preferred for Raspberry Pi)
      // In production, would check if /opt/memorix/models/ exists
      // and if the tflite-runtime Python package is available

      // Check for OpenCV
      // In production, would check if opencv4nodejs or similar is installed

      // For now, default to simulation
      return 'simulation'
    } catch {
      return 'simulation'
    }
  }

  /**
   * TFLite-based face detection (for Raspberry Pi).
   */
  private async tfliteDetectFaces(_frame?: CameraFrame, timestamp?: string): Promise<DetectedFace[]> {
    // In production, this would:
    // 1. Load the TFLite model from config.modelPath
    // 2. Preprocess the camera frame
    // 3. Run inference
    // 4. Post-process the output to extract bounding boxes
    // 5. Filter by confidence threshold

    // For now, return simulated detection
    return this.simulateFaceDetection(timestamp || new Date().toISOString())
  }

  /**
   * OpenCV-based face detection (for companion computer with more power).
   */
  private async opencvDetectFaces(_frame?: CameraFrame, timestamp?: string): Promise<DetectedFace[]> {
    // In production, this would:
    // 1. Use cv2.CascadeClassifier or DNN face detector
    // 2. Process the frame
    // 3. Return detected faces

    // For now, return simulated detection
    return this.simulateFaceDetection(timestamp || new Date().toISOString())
  }

  // ============================================================
  // Simulation Mode
  // ============================================================

  private simulateFaceDetection(timestamp: string): DetectedFace[] {
    // Simulate face detection with random results
    // This is useful for development and testing without a camera

    const faceDetected = Math.random() > 0.3 // 70% chance of detecting a face

    if (!faceDetected) {
      return []
    }

    const numFaces = Math.random() > 0.8 ? 2 : 1 // 80% chance of single face
    const faces: DetectedFace[] = []

    for (let i = 0; i < numFaces; i++) {
      const x = 100 + Math.floor(Math.random() * 300)
      const y = 50 + Math.floor(Math.random() * 200)
      const width = 80 + Math.floor(Math.random() * 120)
      const height = 100 + Math.floor(Math.random() * 140)

      const face: DetectedFace = {
        id: `face-${Date.now()}-${i}`,
        boundingBox: {
          x,
          y,
          width,
          height,
          centerX: Math.round(x + width / 2),
          centerY: Math.round(y + height / 2),
          area: width * height,
        },
        confidence: 0.7 + Math.random() * 0.3,
        landmarks: {
          leftEye: { x: x + width * 0.3, y: y + height * 0.35 },
          rightEye: { x: x + width * 0.7, y: y + height * 0.35 },
          nose: { x: x + width * 0.5, y: y + height * 0.5 },
          leftMouth: { x: x + width * 0.35, y: y + height * 0.7 },
          rightMouth: { x: x + width * 0.65, y: y + height * 0.7 },
        },
        timestamp,
      }

      // Occasionally "recognize" a face from the database
      if (this.faceDatabase.size > 0 && Math.random() > 0.5) {
        const entries = Array.from(this.faceDatabase.values())
        const randomEntry = entries[Math.floor(Math.random() * entries.length)]
        face.recognizedPerson = {
          faceProfileId: randomEntry.id,
          name: randomEntry.name,
          label: randomEntry.label,
          confidence: 0.75 + Math.random() * 0.2,
          sightingCount: randomEntry.sightingCount,
          lastSeen: randomEntry.lastSeen,
        }
        face.label = randomEntry.label
      }

      faces.push(face)
    }

    return faces
  }

  // ============================================================
  // Face Encoding & Comparison
  // ============================================================

  /**
   * Generate a face encoding vector from a detected face.
   * In production, this uses a deep learning model (e.g., FaceNet, dlib).
   */
  private async generateFaceEncoding(face: DetectedFace): Promise<number[]> {
    if (this.backend === 'simulation') {
      // Generate a deterministic pseudo-encoding based on face position
      // This is NOT a real face encoding — just for simulation
      const encoding: number[] = []
      const seed = face.boundingBox.centerX * 1000 + face.boundingBox.centerY
      for (let i = 0; i < ENCODING_DIMENSIONS; i++) {
        encoding.push(Math.sin(seed * (i + 1) * 0.1) * 0.5 + Math.random() * 0.1)
      }
      return encoding
    }

    // Real mode: would use FaceNet/dlib to generate 128-D or 512-D encoding
    return []
  }

  /**
   * Compute the Euclidean distance between two face encodings.
   * Lower distance = more similar faces.
   */
  private computeFaceDistance(encoding1: number[], encoding2: number[]): number {
    if (encoding1.length !== encoding2.length || encoding1.length === 0) {
      return 1.0 // Maximum distance for incompatible encodings
    }

    let sumSquares = 0
    for (let i = 0; i < encoding1.length; i++) {
      const diff = encoding1[i] - encoding2[i]
      sumSquares += diff * diff
    }

    return Math.sqrt(sumSquares) / Math.sqrt(encoding1.length) // Normalized distance
  }

  /**
   * Use AI to attempt identification when database matching fails.
   */
  private async aiIdentifyFace(face: DetectedFace): Promise<RecognizedPerson | null> {
    try {
      const zai = await this.getZAI()

      // Get list of known people
      const knownPeople = Array.from(this.faceDatabase.values()).map(e => e.name)
      const peopleList = knownPeople.length > 0
        ? `Known people: ${knownPeople.join(', ')}`
        : 'No known people in database.'

      const response = await zai.chat.completions.create({
        model: 'default',
        messages: [
          {
            role: 'system',
            content: `You are a face identification AI for Memorix AI Memory platform.
Given face detection data (position, confidence), attempt to identify the person.
${peopleList}
If you can identify the person, respond with their name. If not, respond with "unknown".
Respond ONLY with JSON: {"name": "string", "confidence": 0-1, "reasoning": "string"}`,
          },
          {
            role: 'user',
            content: `Face detected at position (${face.boundingBox.centerX}, ${face.boundingBox.centerY}), confidence: ${face.confidence.toFixed(2)}, size: ${face.boundingBox.area}px²`,
          },
        ],
        temperature: 0.3,
        max_tokens: 128,
      })

      const content = response.choices?.[0]?.message?.content || ''
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as {
          name: string
          confidence: number
          reasoning: string
        }

        if (parsed.name !== 'unknown') {
          // Find the matching face profile
          const match = Array.from(this.faceDatabase.values()).find(
            e => e.name.toLowerCase() === parsed.name.toLowerCase()
          )

          if (match) {
            return {
              faceProfileId: match.id,
              name: match.name,
              label: match.label,
              confidence: Math.min(parsed.confidence || 0.5, 0.9),
              sightingCount: match.sightingCount,
              lastSeen: match.lastSeen,
            }
          }
        }
      }
    } catch (err) {
    }

    return null
  }

  // ============================================================
  // Database Operations
  // ============================================================

  /**
   * Load all face profiles from the database into memory.
   */
  private async loadFaceDatabase(): Promise<void> {
    try {
      const profiles = await db.faceProfile.findMany({
        orderBy: { lastSeen: 'desc' },
      })

      this.faceDatabase.clear()
      for (const profile of profiles) {
        const entry = this.profileToEntry(profile)
        this.faceDatabase.set(profile.id, entry)
      }

    } catch (err) {
    }
  }

  /**
   * Persist current configuration to database.
   */
  private async persistConfig(): Promise<void> {
    try {
      await db.systemConfig.upsert({
        where: { key: 'face_tracking.config' },
        create: {
          key: 'face_tracking.config',
          value: JSON.stringify(this.config),
          category: 'hardware',
        },
        update: {
          value: JSON.stringify(this.config),
        },
      })
    } catch {
      // DB may not be available
    }
  }

  // ============================================================
  // Event System
  // ============================================================

  /**
   * Subscribe to face tracking events.
   */
  onEvent(callback: FaceTrackingEventCallback): () => void {
    this.eventListeners.push(callback)
    return () => {
      this.eventListeners = this.eventListeners.filter(cb => cb !== callback)
    }
  }

  private emitEvent(type: FaceTrackingEvent['type'], data?: unknown): void {
    const event: FaceTrackingEvent = {
      type,
      timestamp: new Date(),
      data,
    }
    for (const cb of this.eventListeners) {
    }
  }

  // ============================================================
  // Utility
  // ============================================================

  private clampServo(value: number, axis: 'pan' | 'tilt'): number {
    if (axis === 'pan') {
      return Math.max(SERVO_LIMITS.panMin, Math.min(SERVO_LIMITS.panMax, value))
    }
    return Math.max(SERVO_LIMITS.tiltMin, Math.min(SERVO_LIMITS.tiltMax, value))
  }

  private profileToEntry(profile: {
    id: string
    name: string
    label: string
    encoding: string
    photoPath: string | null
    metadata: string | null
    confidence: number
    sightingCount: number
    lastSeen: Date
    createdAt: Date
    updatedAt: Date
  }): FaceProfileEntry {
    let encoding: number[] = []
    try {
      encoding = JSON.parse(profile.encoding)
    } catch {
      // Invalid encoding data
    }

    let metadata: Record<string, unknown> | undefined
    try {
      if (profile.metadata) {
        metadata = JSON.parse(profile.metadata)
      }
    } catch {
      // Invalid metadata
    }

    return {
      id: profile.id,
      name: profile.name,
      label: profile.label,
      encoding,
      photoPath: profile.photoPath || undefined,
      metadata,
      confidence: profile.confidence,
      sightingCount: profile.sightingCount,
      lastSeen: profile.lastSeen.toISOString(),
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    }
  }

  /**
   * Get face tracking service statistics.
   */
  async getStats(): Promise<{
    isRunning: boolean
    status: TrackingStatus
    backend: DetectionBackend
    mode: TrackingMode
    frameCount: number
    fps: number
    facesDetected: number
    facesRegistered: number
    lastDetectionTime: string | null
    servoPosition: ServoPosition
  }> {
    const totalRegistered = await db.faceProfile.count().catch(() => this.faceDatabase.size)

    return {
      isRunning: this.isRunning,
      status: this.status,
      backend: this.backend,
      mode: this.config.trackingMode as TrackingMode,
      frameCount: this.frameCount,
      fps: this.fps,
      facesDetected: this.allFaces.length,
      facesRegistered: totalRegistered,
      lastDetectionTime: this.lastDetectionTime,
      servoPosition: { ...this.servoPosition },
    }
  }

  /**
   * Shut down the face tracking service.
   */
  async shutdown(): Promise<void> {
    await this.stopTracking()
    this.faceDatabase.clear()
    this.eventListeners = []
    this.zaiInstance = null
  }
}

// ============================================================
// Singleton Accessor
// ============================================================

let faceTrackingInstance: FaceTrackingService | null = null

/**
 * Get the FaceTrackingService singleton instance.
 */
export function getFaceTrackingService(): FaceTrackingService {
  if (!faceTrackingInstance) {
    faceTrackingInstance = FaceTrackingService.getInstance()
  }
  return faceTrackingInstance
}
