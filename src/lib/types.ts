// ============================================================
// NANGGROE IOT - TypeScript Type Definitions
// ============================================================

// --- Hardware Types ---
export type DeviceType =
  | 'flight_controller'
  | 'companion_computer'
  | 'gps'
  | 'camera'
  | 'sensor'
  | 'radio'
  | 'battery'
  | 'motor'
  | 'servo'
  | 'esc'

export type Protocol = 'usb' | 'i2c' | 'spi' | 'uart' | 'gpio' | 'can' | 'adc'

export type DeviceStatus = 'unknown' | 'detected' | 'initialized' | 'active' | 'error' | 'offline'

export interface HardwareDeviceSummary {
  id: string
  name: string
  deviceType: DeviceType
  protocol: Protocol
  status: DeviceStatus
  vendorId?: string | null
  productId?: string | null
  port?: string | null
  address?: string | null
  capabilities?: string | null
  firmware?: string | null
  lastSeen: string
  profiles: HardwareProfileSummary[]
}

export interface HardwareProfileSummary {
  id: string
  adapterName: string
  config: string
  isDefault: boolean
}

// --- Telemetry Types ---
export type TelemetryMetric =
  | 'battery_voltage'
  | 'gps_lat'
  | 'gps_lng'
  | 'altitude'
  | 'signal_strength'
  | 'temperature'
  | 'humidity'
  | 'pressure'
  | 'heading'
  | 'speed'
  | 'roll'
  | 'pitch'
  | 'yaw'
  | 'motor_rpm_1'
  | 'motor_rpm_2'
  | 'motor_rpm_3'
  | 'current_draw'

export type TelemetrySource = 'sensor' | 'manual'

export interface TelemetryReading {
  id: string
  deviceId?: string | null
  metric: TelemetryMetric
  value: number
  unit?: string | null
  source: TelemetrySource
  timestamp: string
}

export interface TelemetrySnapshot {
  battery_voltage: number
  gps_lat: number
  gps_lng: number
  altitude: number
  signal_strength: number
  temperature: number
  humidity: number
  pressure: number
  heading: number
  speed: number
  roll: number
  pitch: number
  yaw: number
  motor_rpm_1: number
  motor_rpm_2: number
  motor_rpm_3: number
  current_draw: number
}

// --- Mission Types ---
export type MissionType = 'mapping' | 'survey' | 'delivery' | 'patrol' | 'inspection' | 'agriculture'

export type MissionStatus = 'draft' | 'planned' | 'active' | 'paused' | 'completed' | 'failed' | 'aborted'

export interface Waypoint {
  lat: number
  lng: number
  alt: number
  action: WaypointAction
  hoverTime?: number
  speed?: number
}

export type WaypointAction = 'fly' | 'hover' | 'take_photo' | 'land' | 'takeoff' | 'survey_start' | 'survey_end'

export interface MissionSummary {
  id: string
  name: string
  description?: string | null
  type: MissionType
  status: MissionStatus
  prompt?: string | null
  waypoints: Waypoint[]
  altitude: number
  speed: number
  overlapFront: number
  overlapSide: number
  gsd?: number | null
  startedAt?: string | null
  completedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface MissionDetail extends MissionSummary {
  parameters?: string | null
  areaPolygon?: string | null
  logs: MissionLogEntry[]
  agentMessages: AgentMessageEntry[]
}

export type MissionLogLevel = 'debug' | 'info' | 'warning' | 'error' | 'critical'
export type MissionLogSource = 'system' | 'hermes' | 'picoclaw' | 'autopilot' | 'sensor' | 'operator'

export interface MissionLogEntry {
  id: string
  missionId: string
  level: MissionLogLevel
  source: MissionLogSource
  message: string
  data?: string | null
  timestamp: string
}

// --- Agent Types ---
export type AgentName = 'hermes' | 'picoclaw' | 'operator' | 'system'
export type AgentRole = 'command' | 'response' | 'alert' | 'recommendation' | 'status'

export interface AgentMessageEntry {
  id: string
  missionId?: string | null
  agent: AgentName
  role: AgentRole
  content: string
  metadata?: string | null
  timestamp: string
}

export interface SystemContext {
  mode: string
  activeMission?: MissionSummary | null
  deviceCount: number
  activeDeviceCount: number
  latestTelemetry?: TelemetrySnapshot | null
  recentAlerts: AlertEntry[]
  sessionMode: string
}

export interface HermesResponse {
  type: 'mission_plan' | 'recommendation' | 'alert' | 'status' | 'clarification'
  content: string
  data?: Record<string, unknown>
  priority: 'low' | 'medium' | 'high' | 'critical'
}

export interface PicoClawCheckResult {
  safe: boolean
  alerts: PicoClawAlert[]
  actions: PicoClawAction[]
}

export interface PicoClawAlert {
  level: 'warning' | 'critical'
  metric: string
  message: string
  currentValue: number
  threshold: number
}

export interface PicoClawAction {
  type: 'land' | 'rth' | 'hover' | 'reduce_speed' | 'alert_operator'
  reason: string
}

// --- Alert Types ---
export type AlertLevel = 'info' | 'warning' | 'critical'
export type AlertSource = 'system' | 'picoclaw' | 'hermes' | 'sensor' | 'battery' | 'gps'
export type AlertCategory = 'safety' | 'hardware' | 'mission' | 'system' | 'communication'

export interface AlertEntry {
  id: string
  level: AlertLevel
  source: AlertSource
  title: string
  message: string
  category: AlertCategory
  isRead: boolean
  isResolved: boolean
  timestamp: string
}

// --- Calibration Types ---
export type CalibrationDeviceType = 'compass' | 'accelerometer' | 'gyro' | 'esc' | 'radio'
export type CalibrationStatus = 'pending' | 'in_progress' | 'completed' | 'failed'

export interface CalibrationEntry {
  id: string
  deviceType: CalibrationDeviceType
  deviceId?: string | null
  status: CalibrationStatus
  parameters?: string | null
  results?: string | null
  performedAt: string
}

// --- Boot Flow Types ---
export type BootStage = 'power_on' | 'hardware_detection' | 'hal_initialization' | 'agent_startup' | 'system_ready'

export interface BootFlowStatus {
  currentStage: BootStage
  stages: BootStageInfo[]
  isComplete: boolean
  startedAt?: string
  completedAt?: string
}

export interface BootStageInfo {
  stage: BootStage
  label: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  startedAt?: string
  completedAt?: string
  details?: string
}

// --- Session Types ---
export type SessionMode = 'discovery' | 'planning' | 'build' | 'debug' | 'optimize'
export type SessionStatus = 'active' | 'closed' | 'archived'

export interface SessionEntry {
  id: string
  name?: string | null
  mode: SessionMode
  status: SessionStatus
  config?: string | null
  startedAt: string
  endedAt?: string | null
}

// --- API Response Types ---
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total?: number
  page?: number
  limit?: number
}

// --- Config Types ---
export type ConfigCategory = 'general' | 'hardware' | 'agent' | 'mission' | 'network'

export interface SystemConfigEntry {
  id: string
  key: string
  value: string
  category: ConfigCategory
}

// --- Robot Template Types ---
export type RobotCategory = 'drone' | 'rover' | 'boat' | 'amphibious' | 'arm' | 'custom'
export type RobotProjectStatus = 'draft' | 'building' | 'configured' | 'ready' | 'active' | 'error'
export type BuildDifficulty = 'beginner' | 'intermediate' | 'advanced'

export interface RobotTemplateSummary {
  id: string
  name: string
  description: string
  category: RobotCategory
  icon: string
  difficulty: BuildDifficulty
  estimatedBuildHours: number
  isOfficial: boolean
  version: string
}

export interface RobotTemplateDetail extends RobotTemplateSummary {
  requiredHardware: HardwareRequirement[]
  requiredFirmware: FirmwareRequirement[]
  capabilities: string[]
  autoConfig: Record<string, unknown>
  assemblyGuide: AssemblyStep[]
  wiringDiagram: Record<string, unknown>
  codeTemplate?: string | null
  tags?: string[] | null
}

export interface HardwareRequirement {
  deviceType: string
  name: string
  protocol: string
  required: boolean
  alternatives?: string[]
  notes?: string
}

export interface FirmwareRequirement {
  target: string
  version: string
  url: string
}

export interface AssemblyStep {
  step: number
  title: string
  description: string
  duration: string
  tools: string[]
  parts: string[]
  warnings: string[]
  images?: string[]
  completed?: boolean
}

export interface RobotProjectSummary {
  id: string
  name: string
  description?: string | null
  templateId?: string | null
  status: RobotProjectStatus
  config: Record<string, unknown>
  hardwareList: HardwareRequirement[]
  buildProgress: number
  currentStep?: string | null
  isOffline: boolean
  lastSyncAt?: string | null
  createdAt: string
  updatedAt: string
}

// --- Communication Types ---
export type CommChannelType = 'telegram' | 'voice' | 'android' | 'beep' | 'gsm' | 'radio'
export type CommChannelStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface CommChannelSummary {
  id: string
  type: CommChannelType
  name: string
  status: CommChannelStatus
  isEnabled: boolean
  lastMessage?: string | null
  createdAt: string
}

export interface TelegramConfig {
  botToken: string
  chatId: string
  allowedUsers: string[]
  commands: string[]
  webhookUrl?: string
}

export interface VoiceConfig {
  language: string
  ttsEngine: string
  sttEngine: string
  wakeWord?: string
  volume: number
  rate: number
}

export interface AndroidConfig {
  deviceId: string
  appName: string
  connectionType: 'wifi' | 'bluetooth' | 'usb'
  ip?: string
  port?: number
}

export interface BeepConfig {
  enabled: boolean
  volume: number
  patterns: BeepPattern[]
}

export interface BeepPattern {
  name: string
  pattern: number[] // durations in ms
  frequency: number // Hz
}

export interface GsmConfig {
  apn: string
  pin?: string
  phoneNumber?: string
  dataEnabled: boolean
  smsEnabled: boolean
}

// --- Navigation Types ---
export type NavigationType = 'gps_track' | 'autopilot' | 'rth' | 'field_mapping' | 'survey' | 'delivery'
export type NavigationStatus = 'idle' | 'active' | 'paused' | 'completed' | 'aborted'

export interface NavigationPlanSummary {
  id: string
  name: string
  type: NavigationType
  status: NavigationStatus
  waypoints: Waypoint[]
  homePosition?: { lat: number; lng: number; alt: number } | null
  startedAt?: string | null
  completedAt?: string | null
  createdAt: string
}

export interface FieldMappingResult {
  areaHectares: number
  photosTaken: number
  gsdCmPerPixel: number
  overlapPercent: number
  flightTime: number
  coveragePercent: number
}

export interface DeliveryTask {
  pickupPoint: { lat: number; lng: number; alt: number }
  dropPoint: { lat: number; lng: number; alt: number }
  payloadWeight: number
  dropCommand: 'servo' | 'relay' | 'magnet'
}

// --- Power Types ---
export type PowerSourceType = 'battery' | 'solar' | 'gsm' | 'usb'
export type PowerSourceStatus = 'unknown' | 'charging' | 'discharging' | 'full' | 'error' | 'offline'

export interface PowerSourceSummary {
  id: string
  type: PowerSourceType
  name: string
  status: PowerSourceStatus
  capacity: number
  currentLevel: number
  voltage: number
  current: number
  temperature: number
  lastReading: string
}

export interface SolarConfig {
  panelWattage: number
  chargeControllerType: string
  batteryType: string
  emergencyOnly: boolean
  minVoltageThreshold: number
}

// --- AI Memory Types ---
export type AiMemoryCategory = 'conversation' | 'decision' | 'learning' | 'pattern' | 'preference'

export interface AiMemoryEntry {
  id: string
  category: AiMemoryCategory
  key: string
  value: unknown
  context?: string | null
  confidence: number
  accessCount: number
  isSynced: boolean
  createdAt: string
  accessedAt: string
}

// --- Voice Log Types ---
export interface VoiceLogEntry {
  id: string
  direction: 'input' | 'output'
  transcript: string
  audioPath?: string | null
  language: string
  duration: number
  agentSource?: string | null
  createdAt: string
}

// --- Auto-Detect Types ---
export interface HardwareScanResult {
  timestamp: string
  totalScanned: number
  detected: DetectedDevice[]
  missing: HardwareRequirement[]
  suggestions: HardwareSuggestion[]
}

export interface DetectedDevice {
  deviceType: string
  name: string
  protocol: string
  port: string
  vendorId?: string
  productId?: string
  address?: string
  status: string
  autoConfigAvailable: boolean
}

export interface HardwareSuggestion {
  deviceType: string
  reason: string
  suggestedModels: string[]
  connectionGuide: string
  priority: 'required' | 'recommended' | 'optional'
}

// --- Payload Types ---
export interface PayloadConfig {
  type: 'servo' | 'relay' | 'magnet' | 'mechanical'
  pin: number
  triggerCommand: string
  releaseCommand: string
  maxWeight: number
  currentPayload: number
}

// --- Face Tracking Types ---
export interface FaceTrackingConfig {
  enabled: boolean
  modelPath: string
  confidenceThreshold: number
  trackingMode: 'follow' | 'detect' | 'identify'
  maxFaces: number
  followDistance: number
}

// --- Autopilot & Safety Types ---
export interface AutopilotConfig {
  enabled: boolean
  mode: 'stabilize' | 'alt_hold' | 'loiter' | 'auto' | 'rtl' | 'land'
  failsafeAction: 'rth' | 'land' | 'hover'
  geofenceEnabled: boolean
  maxAltitude: number
  maxDistance: number
  obstacleAvoidance: boolean
  returnToHomeAlt: number
}

// --- Amphibious Types ---
export interface AmphibiousConfig {
  waterDetection: boolean
  floatMode: 'auto' | 'manual'
  finEnabled: boolean
  finPin: number
  wheelEnabled: boolean
  wheelMode: 'drive' | 'idle'
  transitionMode: 'auto' | 'manual'
}

// --- Self-Learning Types ---
export type LearningCategory = 'pattern' | 'decision' | 'performance' | 'suggestion' | 'auto_tune'
export type LearningSource = 'hermes' | 'picoclaw' | 'system' | 'operator'

export interface PatternDetection {
  id: string
  name: string
  description: string
  pattern: string
  frequency: number
  confidence: number
  firstSeen: string
  lastSeen: string
  relatedMetrics: string[]
  suggestedAction?: string
}

export interface DecisionRecord {
  id: string
  agent: LearningSource
  context: string
  decision: string
  reasoning: string
  outcome?: 'success' | 'failure' | 'pending'
  confidence: number
  timestamp: string
  projectId?: string
}

export interface PerformanceMetric {
  metric: string
  currentValue: number
  previousValue: number
  changePercent: number
  trend: 'improving' | 'stable' | 'degrading'
  target?: number
  unit: string
}

export interface LearningSuggestion {
  id: string
  category: LearningCategory
  title: string
  description: string
  confidence: number
  impact: 'low' | 'medium' | 'high'
  source: LearningSource
  isApplied: boolean
  appliedAt?: string
  createdAt: string
}

export interface AutoTuneResult {
  parameter: string
  oldValue: number
  newValue: number
  improvement: number
  timestamp: string
}

export interface LearningReport {
  totalPatterns: number
  totalDecisions: number
  totalSuggestions: number
  appliedSuggestions: number
  autoTuneCount: number
  topPatterns: PatternDetection[]
  recentDecisions: DecisionRecord[]
  pendingSuggestions: LearningSuggestion[]
  performanceMetrics: PerformanceMetric[]
  generatedAt: string
}

export interface LearningRecordEntry {
  id: string
  category: LearningCategory
  key: string
  value: unknown
  confidence: number
  source: LearningSource
  projectId?: string | null
  isApplied: boolean
  appliedAt?: string | null
  createdAt: string
  updatedAt: string
}

// --- Face Tracking Types (Extended) ---
export type FaceTrackingMode = 'follow' | 'detect' | 'identify'
export type FaceDetectionStatus = 'detected' | 'tracking' | 'lost' | 'identified'

export interface FaceDetection {
  id: string
  profileId?: string
  label?: string
  confidence: number
  boundingBox: { x: number; y: number; width: number; height: number }
  landmarks?: FaceLandmark[]
  encoding?: number[]
  timestamp: string
}

export interface FaceLandmark {
  point: string // 'left_eye', 'right_eye', 'nose_tip', 'mouth_left', 'mouth_right', etc.
  x: number
  y: number
}

export interface FaceProfileEntry {
  id: string
  name: string
  label: string
  encoding: number[]
  photoPath?: string | null
  metadata?: Record<string, unknown> | null
  sightingCount: number
  confidence: number
  lastSeen: string
  projectId?: string | null
  createdAt: string
  updatedAt: string
}

export interface FaceTrackingState {
  isTracking: boolean
  mode: FaceTrackingMode
  detections: FaceDetection[]
  trackedFaceId?: string
  fps: number
  modelLoaded: boolean
  lastFrameTime: string
}

export interface FaceTrackingStats {
  totalDetections: number
  totalIdentifications: number
  uniqueFaces: number
  averageConfidence: number
  trackingUptime: number
  profilesCount: number
}

// --- Hardware Bridge Types ---
export type BridgeMode = 'serial' | 'i2c' | 'spi' | 'gpio' | 'adc'
export type BusStatus = 'unknown' | 'available' | 'busy' | 'error'

export interface SerialPort {
  path: string
  baudRate: number
  dataBits: 5 | 6 | 7 | 8
  stopBits: 1 | 2
  parity: 'none' | 'even' | 'odd'
  flowControl: 'none' | 'hardware' | 'software'
  isConnected: boolean
  deviceName?: string
}

export interface I2CBus {
  busNumber: number
  path: string
  speed: number // kHz
  devices: I2CDevice[]
  isAvailable: boolean
}

export interface I2CDevice {
  address: string // hex like 0x68
  name: string
  description?: string
  isResponsive: boolean
}

export interface SPIBus {
  busNumber: number
  path: string
  mode: 0 | 1 | 2 | 3
  maxSpeed: number // Hz
  bitOrder: 'msb' | 'lsb'
  isAvailable: boolean
}

export interface GPIOConfig {
  pin: number
  direction: 'input' | 'output'
  pullMode: 'none' | 'pullup' | 'pulldown'
  value?: boolean
  edge?: 'none' | 'rising' | 'falling' | 'both'
}

export interface ADCChannel {
  channel: number
  resolution: number // bits
  referenceVoltage: number
  currentValue: number
  unit: string
}

export interface HardwareBusStateEntry {
  id: string
  busType: BridgeMode
  busPath: string
  status: BusStatus
  deviceId?: string | null
  config?: Record<string, unknown> | null
  lastScanned: string
  createdAt: string
  updatedAt: string
}

export interface HardwareBridgeStatus {
  mode: BridgeMode
  isConnected: boolean
  activeBus?: HardwareBusStateEntry
  serialPorts: SerialPort[]
  i2cBuses: I2CBus[]
  spiBuses: SPIBus[]
  gpioPins: GPIOConfig[]
  adcChannels: ADCChannel[]
  lastScanned: string
}

// --- Extension Connection Types ---
export type ExtensionType = 'vscode' | 'cursor' | 'neovim' | 'jetbrains' | 'custom'
export type ExtensionStatus = 'connected' | 'disconnected'

export interface ExtensionConnectionEntry {
  id: string
  name: string
  type: ExtensionType
  status: ExtensionStatus
  apiKey: string
  capabilities: string[]
  lastHeartbeat: string
  connectedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface ExtensionCapability {
  id: string
  name: string
  description: string
  enabled: boolean
}

export interface ExtensionConfig {
  name: string
  type: ExtensionType
  capabilities: ExtensionCapability[]
  autoConnect: boolean
  heartbeatInterval: number // seconds
  reconnectAttempts: number
}
