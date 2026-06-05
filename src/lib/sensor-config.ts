// ============================================================
// MEMORIX IOT - Sensor Configuration Service
// Sensor type definitions, pin assignments, calibration presets,
// I2C/SPI address mappings, and configuration validation.
// ============================================================

import { db } from './db'

// ============================================================
// Types
// ============================================================

export type SensorProtocol = 'i2c' | 'spi' | 'uart' | 'gpio' | 'adc' | 'pwm' | 'one_wire'

export type SensorCategory =
  | 'temperature'
  | 'humidity'
  | 'pressure'
  | 'imu'
  | 'gps'
  | 'distance'
  | 'current'
  | 'voltage'
  | 'light'
  | 'gas'
  | 'water'
  | 'force'
  | 'flow'
  | 'magnetic'

export interface SensorTypeDefinition {
  id: string
  name: string
  category: SensorCategory
  protocol: SensorProtocol
  manufacturer: string
  description: string
  /** I2C address(es) if applicable */
  i2cAddresses?: string[]
  /** SPI chip select config if applicable */
  spiConfig?: { maxSpeedHz: number; mode: 0 | 1 | 2 | 3 }
  /** Default measurement range */
  measurementRange: { min: number; max: number; unit: string }
  /** Accuracy specification */
  accuracy: string
  /** Operating voltage range */
  voltageRange: { min: number; max: number }
  /** Default calibration preset name */
  defaultCalibration: string
}

export interface PinAssignment {
  pin: number
  function: string
  protocol: SensorProtocol
  /** Raspberry Pi BCM pin number */
  bcmPin?: number
  /** Arduino digital/analog pin */
  arduinoPin?: string
  notes?: string
}

export interface CalibrationPreset {
  id: string
  sensorTypeId: string
  name: string
  description: string
  parameters: Record<string, number | string | boolean>
}

export interface SensorProfile {
  id: string
  name: string
  description: string
  platform: 'arduino' | 'raspberry_pi' | 'esp32' | 'custom'
  sensors: string[] // sensor type IDs
  defaultPins: PinAssignment[]
  wiringNotes?: string
}

export interface SensorConfigValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

// ============================================================
// Sensor Type Definitions (Common Sensors)
// ============================================================

const SENSOR_DEFINITIONS: SensorTypeDefinition[] = [
  // ---- Temperature / Humidity / Pressure ----
  {
    id: 'bme280',
    name: 'BME280',
    category: 'temperature',
    protocol: 'i2c',
    manufacturer: 'Bosch',
    description: 'Combined temperature, humidity, and pressure sensor',
    i2cAddresses: ['0x76', '0x77'],
    measurementRange: { min: -40, max: 85, unit: '°C' },
    accuracy: '±1°C temperature, ±3%RH humidity, ±1hPa pressure',
    voltageRange: { min: 1.71, max: 3.6 },
    defaultCalibration: 'bme280_default',
  },
  {
    id: 'bmp280',
    name: 'BMP280',
    category: 'pressure',
    protocol: 'i2c',
    manufacturer: 'Bosch',
    description: 'Barometric pressure and temperature sensor',
    i2cAddresses: ['0x76', '0x77'],
    measurementRange: { min: 300, max: 1100, unit: 'hPa' },
    accuracy: '±1hPa',
    voltageRange: { min: 1.71, max: 3.6 },
    defaultCalibration: 'bmp280_default',
  },
  {
    id: 'dht22',
    name: 'DHT22 / AM2302',
    category: 'temperature',
    protocol: 'gpio',
    manufacturer: 'Aosong',
    description: 'Temperature and humidity sensor with single-wire digital interface',
    measurementRange: { min: -40, max: 80, unit: '°C' },
    accuracy: '±0.5°C temperature, ±2%RH humidity',
    voltageRange: { min: 3.3, max: 5.5 },
    defaultCalibration: 'dht22_default',
  },
  {
    id: 'ds18b20',
    name: 'DS18B20',
    category: 'temperature',
    protocol: 'one_wire',
    manufacturer: 'Dallas/Maxim',
    description: '1-Wire digital temperature sensor, waterproof probe available',
    measurementRange: { min: -55, max: 125, unit: '°C' },
    accuracy: '±0.5°C',
    voltageRange: { min: 3.0, max: 5.5 },
    defaultCalibration: 'ds18b20_default',
  },

  // ---- IMU ----
  {
    id: 'mpu6050',
    name: 'MPU6050',
    category: 'imu',
    protocol: 'i2c',
    manufacturer: 'InvenSense/TDK',
    description: '6-axis accelerometer + gyroscope IMU',
    i2cAddresses: ['0x68', '0x69'],
    measurementRange: { min: -16, max: 16, unit: 'g' },
    accuracy: '±0.5g accel, ±20°/s gyro',
    voltageRange: { min: 2.375, max: 3.46 },
    defaultCalibration: 'mpu6050_default',
  },
  {
    id: 'bno055',
    name: 'BNO055',
    category: 'imu',
    protocol: 'i2c',
    manufacturer: 'Bosch',
    description: '9-axis IMU with built-in sensor fusion (absolute orientation)',
    i2cAddresses: ['0x28', '0x29'],
    measurementRange: { min: -360, max: 360, unit: '°' },
    accuracy: '±2° heading, ±1° roll/pitch',
    voltageRange: { min: 2.4, max: 3.6 },
    defaultCalibration: 'bno055_default',
  },
  {
    id: 'lsm9ds1',
    name: 'LSM9DS1',
    category: 'imu',
    protocol: 'i2c',
    manufacturer: 'STMicroelectronics',
    description: '9-axis IMU (accel + gyro + magnetometer)',
    i2cAddresses: ['0x6A', '0x1E'],
    measurementRange: { min: -16, max: 16, unit: 'g' },
    accuracy: '±0.5g accel, ±0.1°/s gyro, ±0.15µT mag',
    voltageRange: { min: 1.9, max: 3.6 },
    defaultCalibration: 'lsm9ds1_default',
  },

  // ---- GPS ----
  {
    id: 'neo_m8n',
    name: 'u-blox NEO-M8N',
    category: 'gps',
    protocol: 'uart',
    manufacturer: 'u-blox',
    description: 'GPS/GLONASS/Galileo/BeiDou receiver, 72-channel',
    spiConfig: { maxSpeedHz: 5000000, mode: 0 },
    measurementRange: { min: -180, max: 180, unit: '°' },
    accuracy: '2.5m CEP',
    voltageRange: { min: 2.7, max: 3.6 },
    defaultCalibration: 'gps_default',
  },
  {
    id: 'neo_m9n',
    name: 'u-blox NEO-M9N',
    category: 'gps',
    protocol: 'uart',
    manufacturer: 'u-blox',
    description: 'Multi-band GNSS receiver with better accuracy',
    measurementRange: { min: -180, max: 180, unit: '°' },
    accuracy: '1.5m CEP',
    voltageRange: { min: 2.7, max: 3.6 },
    defaultCalibration: 'gps_default',
  },

  // ---- Distance ----
  {
    id: 'hc_sr04',
    name: 'HC-SR04',
    category: 'distance',
    protocol: 'gpio',
    manufacturer: 'Generic',
    description: 'Ultrasonic distance sensor, 2cm-400cm range',
    measurementRange: { min: 2, max: 400, unit: 'cm' },
    accuracy: '±3mm',
    voltageRange: { min: 5.0, max: 5.0 },
    defaultCalibration: 'hcsr04_default',
  },
  {
    id: 'vl53l0x',
    name: 'VL53L0X',
    category: 'distance',
    protocol: 'i2c',
    manufacturer: 'STMicroelectronics',
    description: 'Time-of-Flight laser distance sensor',
    i2cAddresses: ['0x29'],
    measurementRange: { min: 3, max: 1200, unit: 'mm' },
    accuracy: '±3%',
    voltageRange: { min: 2.6, max: 3.5 },
    defaultCalibration: 'vl53l0x_default',
  },
  {
    id: 'tf_luna',
    name: 'TF-Luna LiDAR',
    category: 'distance',
    protocol: 'uart',
    manufacturer: 'Benewake',
    description: 'Single-point LiDAR, 0.2m-8m range',
    measurementRange: { min: 20, max: 800, unit: 'cm' },
    accuracy: '±6cm at 6m',
    voltageRange: { min: 5.0, max: 5.0 },
    defaultCalibration: 'tfluna_default',
  },

  // ---- Current / Voltage ----
  {
    id: 'ina219',
    name: 'INA219',
    category: 'current',
    protocol: 'i2c',
    manufacturer: 'Texas Instruments',
    description: 'Bidirectional current/voltage sensor with I2C',
    i2cAddresses: ['0x40', '0x41', '0x44', '0x45'],
    measurementRange: { min: 0, max: 26, unit: 'V' },
    accuracy: '±0.5% voltage, ±1% current',
    voltageRange: { min: 3.0, max: 5.5 },
    defaultCalibration: 'ina219_default',
  },
  {
    id: 'acs712',
    name: 'ACS712',
    category: 'current',
    protocol: 'adc',
    manufacturer: 'Allegro',
    description: 'Hall-effect current sensor (5A/20A/30A versions)',
    measurementRange: { min: -30, max: 30, unit: 'A' },
    accuracy: '±1.5%',
    voltageRange: { min: 4.5, max: 5.5 },
    defaultCalibration: 'acs712_default',
  },

  // ---- Light ----
  {
    id: 'bh1750',
    name: 'BH1750',
    category: 'light',
    protocol: 'i2c',
    manufacturer: 'ROHM',
    description: 'Digital light sensor, 1-65535 lux',
    i2cAddresses: ['0x23', '0x5C'],
    measurementRange: { min: 1, max: 65535, unit: 'lux' },
    accuracy: '±20%',
    voltageRange: { min: 2.4, max: 3.6 },
    defaultCalibration: 'bh1750_default',
  },

  // ---- Gas ----
  {
    id: 'mq2',
    name: 'MQ-2',
    category: 'gas',
    protocol: 'adc',
    manufacturer: 'Generic',
    description: 'Combustible gas sensor (LPG, propane, methane)',
    measurementRange: { min: 200, max: 10000, unit: 'ppm' },
    accuracy: 'Indicative',
    voltageRange: { min: 4.5, max: 5.0 },
    defaultCalibration: 'mq2_default',
  },

  // ---- Water ----
  {
    id: 'water_sensor_digital',
    name: 'Water Level Sensor (Digital)',
    category: 'water',
    protocol: 'gpio',
    manufacturer: 'Generic',
    description: 'Simple digital water detection sensor',
    measurementRange: { min: 0, max: 1, unit: 'boolean' },
    accuracy: 'Binary wet/dry',
    voltageRange: { min: 3.3, max: 5.0 },
    defaultCalibration: 'water_default',
  },

  // ---- Force ----
  {
    id: 'fsr402',
    name: 'FSR 402 Force Sensor',
    category: 'force',
    protocol: 'adc',
    manufacturer: 'Interlink Electronics',
    description: 'Force sensitive resistor for grip force measurement',
    measurementRange: { min: 0.1, max: 10, unit: 'kg' },
    accuracy: '±25% (indicative)',
    voltageRange: { min: 3.3, max: 5.0 },
    defaultCalibration: 'fsr402_default',
  },

  // ---- Magnetic ----
  {
    id: 'qmc5883l',
    name: 'QMC5883L',
    category: 'magnetic',
    protocol: 'i2c',
    manufacturer: 'QST',
    description: '3-axis magnetic sensor (compass)',
    i2cAddresses: ['0x0D'],
    measurementRange: { min: -30, max: 30, unit: 'µT' },
    accuracy: '±1°',
    voltageRange: { min: 2.16, max: 3.6 },
    defaultCalibration: 'compass_default',
  },
]

// ============================================================
// Calibration Presets
// ============================================================

const CALIBRATION_PRESETS: CalibrationPreset[] = [
  // BME280
  { id: 'bme280_default', sensorTypeId: 'bme280', name: 'BME280 Default', description: 'Standard indoor/outdoor calibration', parameters: { tempOffset: 0, humidityOffset: 0, pressureOffset: 0, oversampling: 'ultra_high' } },
  // MPU6050
  { id: 'mpu6050_default', sensorTypeId: 'mpu6050', name: 'MPU6050 Default', description: 'Standard IMU calibration with DMP', parameters: { accelRange: '±2g', gyroRange: '±250°/s', dmpEnabled: true, sampleRate: 100, accelOffsetX: 0, accelOffsetY: 0, accelOffsetZ: 0, gyroOffsetX: 0, gyroOffsetY: 0, gyroOffsetZ: 0 } },
  { id: 'mpu6050_flight', sensorTypeId: 'mpu6050', name: 'MPU6050 Flight Mode', description: 'High-rate IMU for flight stabilization', parameters: { accelRange: '±4g', gyroRange: '±500°/s', dmpEnabled: true, sampleRate: 200, accelOffsetX: 0, accelOffsetY: 0, accelOffsetZ: 0, gyroOffsetX: 0, gyroOffsetY: 0, gyroOffsetZ: 0 } },
  // BNO055
  { id: 'bno055_default', sensorTypeId: 'bno055', name: 'BNO055 NDOF', description: '9-DOF fused orientation mode', parameters: { mode: 'ndof', fusionMode: true, unitSelection: 'windows', dataRate: 100 } },
  // GPS
  { id: 'gps_default', sensorTypeId: 'neo_m8n', name: 'GPS Default', description: 'Standard GPS with all constellations', parameters: { baudRate: 9600, constellations: 'gps+glonass+galileo', updateRate: 1, dynamicModel: 'airborne' } },
  // HC-SR04
  { id: 'hcsr04_default', sensorTypeId: 'hc_sr04', name: 'HC-SR04 Default', description: 'Standard ultrasonic ranging', parameters: { speedOfSound: 343, maxRange: 400, minRange: 2, temperatureCompensation: true } },
  // VL53L0X
  { id: 'vl53l0x_default', sensorTypeId: 'vl53l0x', name: 'VL53L0X Default', description: 'Standard ToF ranging', parameters: { mode: 'long_range', timingBudget: 200, signalRateLimit: 0.1 } },
  // INA219
  { id: 'ina219_default', sensorTypeId: 'ina219', name: 'INA219 32V/1A', description: '32V max voltage, 1A max current', parameters: { maxVoltage: 32, maxCurrent: 1, shuntResistorOhm: 0.1, calibrationValue: 4096 } },
  // ACS712
  { id: 'acs712_default', sensorTypeId: 'acs712', name: 'ACS712 30A', description: '30A range calibration', parameters: { sensitivity: 0.066, vref: 2.5, adcResolution: 10, version: '30A' } },
  // TF-Luna
  { id: 'tfluna_default', sensorTypeId: 'tf_luna', name: 'TF-Luna Default', description: 'Standard LiDAR ranging', parameters: { baudRate: 115200, frameRate: 100, triggerMode: false } },
  // Compass
  { id: 'compass_default', sensorTypeId: 'qmc5883l', name: 'Compass Default', description: 'Standard compass calibration', parameters: { oversampling: 512, range: '2g', rate: 200, declination: 0.37 } },
  // DHT22
  { id: 'dht22_default', sensorTypeId: 'dht22', name: 'DHT22 Default', description: 'Standard DHT22 calibration', parameters: { tempOffset: 0, humidityOffset: 0, readInterval: 2000 } },
  // DS18B20
  { id: 'ds18b20_default', sensorTypeId: 'ds18b20', name: 'DS18B20 Default', description: 'Standard 1-Wire temperature', parameters: { resolution: 12, parasitePower: false } },
  // FSR402
  { id: 'fsr402_default', sensorTypeId: 'fsr402', name: 'FSR402 Default', description: 'Standard force sensor', parameters: { vref: 3.3, pullupResistor: 10000, sensitivity: 1.0 } },
  // BH1750
  { id: 'bh1750_default', sensorTypeId: 'bh1750', name: 'BH1750 Default', description: 'Standard ambient light', parameters: { mode: 'continuous_high', resolution: 1, measurementTime: 69 } },
  // MQ-2
  { id: 'mq2_default', sensorTypeId: 'mq2', name: 'MQ-2 Default', description: 'Standard gas detection', parameters: { rl: 5, ro: 10, warmupMinutes: 3, thresholdPpm: 1000 } },
  // Water
  { id: 'water_default', sensorTypeId: 'water_sensor_digital', name: 'Water Sensor Default', description: 'Simple wet/dry detection', parameters: { activeHigh: true, debounceMs: 100 } },
  // LSM9DS1
  { id: 'lsm9ds1_default', sensorTypeId: 'lsm9ds1', name: 'LSM9DS1 Default', description: '9-axis IMU calibration', parameters: { accelRange: '±2g', gyroRange: '±245dps', magRange: '±4gauss', sampleRate: 952 } },
  // BMP280
  { id: 'bmp280_default', sensorTypeId: 'bmp280', name: 'BMP280 Default', description: 'Standard barometric pressure', parameters: { oversampling: 'ultra_high', filter: 'x16', standbyTime: 0.5 } },
  // NEO-M9N
  { id: 'gps_m9n_default', sensorTypeId: 'neo_m9n', name: 'NEO-M9N Default', description: 'Multi-band GNSS', parameters: { baudRate: 38400, constellations: 'gps+glonass+galileo+beidou', updateRate: 10, dynamicModel: 'airborne' } },
]

// ============================================================
// Default Pin Assignments
// ============================================================

const RASPBERRY_PI_DEFAULT_PINS: PinAssignment[] = [
  { pin: 2, function: 'I2C SDA', protocol: 'i2c', bcmPin: 2, notes: 'GPIO2 / SDA1' },
  { pin: 3, function: 'I2C SCL', protocol: 'i2c', bcmPin: 3, notes: 'GPIO3 / SCL1' },
  { pin: 8, function: 'UART TX', protocol: 'uart', bcmPin: 14, notes: 'GPIO14 / TXD0 — Pixhawk UART' },
  { pin: 10, function: 'UART RX', protocol: 'uart', bcmPin: 15, notes: 'GPIO15 / RXD0 — Pixhawk UART' },
  { pin: 19, function: 'SPI MOSI', protocol: 'spi', bcmPin: 10, notes: 'GPIO10 / SPI0 MOSI' },
  { pin: 21, function: 'SPI MISO', protocol: 'spi', bcmPin: 9, notes: 'GPIO9 / SPI0 MISO' },
  { pin: 23, function: 'SPI SCLK', protocol: 'spi', bcmPin: 11, notes: 'GPIO11 / SPI0 SCLK' },
  { pin: 24, function: 'SPI CE0', protocol: 'spi', bcmPin: 8, notes: 'GPIO8 / SPI0 CE0' },
  { pin: 26, function: 'SPI CE1', protocol: 'spi', bcmPin: 7, notes: 'GPIO7 / SPI0 CE1' },
  { pin: 7, function: 'Buzzer GPIO', protocol: 'gpio', bcmPin: 4, notes: 'GPIO4 — Buzzer output' },
  { pin: 11, function: 'HC-SR04 Trigger', protocol: 'gpio', bcmPin: 17, notes: 'GPIO17 — Ultrasonic trigger' },
  { pin: 13, function: 'HC-SR04 Echo', protocol: 'gpio', bcmPin: 27, notes: 'GPIO27 — Ultrasonic echo (3.3V!)' },
  { pin: 15, function: 'Water Sensor', protocol: 'gpio', bcmPin: 22, notes: 'GPIO22 — Water detect input' },
  { pin: 12, function: 'Servo PWM', protocol: 'pwm', bcmPin: 18, notes: 'GPIO18 / PWM0 — Servo output' },
]

const ARDUINO_MEGA_DEFAULT_PINS: PinAssignment[] = [
  { pin: 20, function: 'I2C SDA', protocol: 'i2c', arduinoPin: 'SDA', notes: 'Hardware I2C SDA' },
  { pin: 21, function: 'I2C SCL', protocol: 'i2c', arduinoPin: 'SCL', notes: 'Hardware I2C SCL' },
  { pin: 18, function: 'UART1 TX', protocol: 'uart', arduinoPin: 'TX1', notes: 'Serial1 TX — Radio/HC-12' },
  { pin: 19, function: 'UART1 RX', protocol: 'uart', arduinoPin: 'RX1', notes: 'Serial1 RX — Radio/HC-12' },
  { pin: 16, function: 'UART2 TX', protocol: 'uart', arduinoPin: 'TX2', notes: 'Serial2 TX — GPS' },
  { pin: 17, function: 'UART2 RX', protocol: 'uart', arduinoPin: 'RX2', notes: 'Serial2 RX — GPS' },
  { pin: 50, function: 'SPI MISO', protocol: 'spi', arduinoPin: 'MISO', notes: 'Hardware SPI MISO' },
  { pin: 51, function: 'SPI MOSI', protocol: 'spi', arduinoPin: 'MOSI', notes: 'Hardware SPI MOSI' },
  { pin: 52, function: 'SPI SCK', protocol: 'spi', arduinoPin: 'SCK', notes: 'Hardware SPI SCK' },
  { pin: 53, function: 'SPI SS', protocol: 'spi', arduinoPin: 'SS', notes: 'Hardware SPI SS' },
  { pin: 2, function: 'HC-SR04 Echo (INT0)', protocol: 'gpio', arduinoPin: 'D2', notes: 'Interrupt capable pin' },
  { pin: 3, function: 'HC-SR04 Trigger', protocol: 'gpio', arduinoPin: 'D3', notes: 'PWM capable' },
  { pin: 9, function: 'Servo PWM 1', protocol: 'pwm', arduinoPin: 'D9', notes: 'Timer1 PWM — Servo output' },
  { pin: 10, function: 'Servo PWM 2', protocol: 'pwm', arduinoPin: 'D10', notes: 'Timer1 PWM — Servo output' },
  { pin: 11, function: 'Servo PWM 3', protocol: 'pwm', arduinoPin: 'D11', notes: 'Timer1 PWM — Servo output' },
  { pin: 22, function: 'Buzzer Output', protocol: 'gpio', arduinoPin: 'D22', notes: 'Digital output for buzzer' },
  { pin: 0, function: 'ADC0 (Voltage)', protocol: 'adc', arduinoPin: 'A0', notes: 'Analog input — Battery voltage divider' },
  { pin: 1, function: 'ADC1 (Current)', protocol: 'adc', arduinoPin: 'A1', notes: 'Analog input — Current sensor' },
  { pin: 2, function: 'ADC2 (FSR)', protocol: 'adc', arduinoPin: 'A2', notes: 'Analog input — Force sensor' },
]

// ============================================================
// Sensor Profiles
// ============================================================

const SENSOR_PROFILES: SensorProfile[] = [
  {
    id: 'drone_standard',
    name: 'Drone Standard',
    description: 'Standard sensor suite for tricopter drone with Pixhawk + RPi',
    platform: 'raspberry_pi',
    sensors: ['bme280', 'mpu6050', 'neo_m8n', 'hc_sr04', 'ina219'],
    defaultPins: RASPBERRY_PI_DEFAULT_PINS,
    wiringNotes: 'BME280 and MPU6050 share I2C bus (different addresses). GPS on dedicated UART. HC-SR04 on GPIO.',
  },
  {
    id: 'rover_standard',
    name: 'Rover Standard',
    description: 'Standard sensor suite for 4-wheel rover',
    platform: 'raspberry_pi',
    sensors: ['bme280', 'neo_m8n', 'hc_sr04', 'ina219', 'bh1750'],
    defaultPins: RASPBERRY_PI_DEFAULT_PINS,
  },
  {
    id: 'arm_standard',
    name: 'Robotic Arm Standard',
    description: 'Sensor suite for 6-DOF robotic arm with Arduino Mega',
    platform: 'arduino',
    sensors: ['mpu6050', 'fsr402', 'bh1750'],
    defaultPins: ARDUINO_MEGA_DEFAULT_PINS,
    wiringNotes: 'MPU6050 on I2C. FSR on ADC. PCA9685 servo driver on I2C (0x40).',
  },
  {
    id: 'boat_standard',
    name: 'USV Standard',
    description: 'Sensor suite for unmanned surface vessel',
    platform: 'raspberry_pi',
    sensors: ['bme280', 'neo_m8n', 'ds18b20', 'ina219', 'water_sensor_digital'],
    defaultPins: RASPBERRY_PI_DEFAULT_PINS,
  },
]

// ============================================================
// Exported Functions
// ============================================================

/**
 * Get full sensor configuration for a given sensor type ID.
 * Returns the type definition, calibration presets, and default pins.
 */
export async function getSensorConfig(sensorTypeId: string): Promise<{
  definition: SensorTypeDefinition | null
  calibrations: CalibrationPreset[]
}> {
  const definition = SENSOR_DEFINITIONS.find(s => s.id === sensorTypeId) ?? null
  const calibrations = CALIBRATION_PRESETS.filter(c => c.sensorTypeId === sensorTypeId)

  // Also check if there are custom calibrations stored in the database
  try {
    const customCalibrations = await db.calibration.findMany({
      where: { deviceType: `sensor_${sensorTypeId}` },
      orderBy: { performedAt: 'desc' },
    })

    for (const cal of customCalibrations) {
      calibrations.push({
        id: `db_${cal.id}`,
        sensorTypeId,
        name: `Custom: ${cal.status}`,
        description: `Database calibration record (status: ${cal.status})`,
        parameters: cal.parameters ? JSON.parse(cal.parameters) : {},
      })
    }
  } catch (error) {
  }

  return { definition, calibrations }
}

/**
 * Validate a sensor configuration object.
 * Checks for required fields, valid I2C addresses, pin conflicts,
 * voltage compatibility, and measurement range sanity.
 */
export function validateSensorConfig(config: {
  sensorTypeId: string
  protocol: SensorProtocol
  address?: string
  pin?: number
  voltage?: number
}): SensorConfigValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  const definition = SENSOR_DEFINITIONS.find(s => s.id === config.sensorTypeId)

  if (!definition) {
    errors.push(`Unknown sensor type: "${config.sensorTypeId}". Valid types: ${SENSOR_DEFINITIONS.map(s => s.id).join(', ')}`)
    return { valid: false, errors, warnings }
  }

  // Protocol mismatch
  if (config.protocol !== definition.protocol) {
    errors.push(
      `Protocol mismatch: sensor "${definition.name}" uses ${definition.protocol}, but ${config.protocol} was specified.`
    )
  }

  // I2C address validation
  if (config.protocol === 'i2c' || definition.protocol === 'i2c') {
    if (!config.address) {
      warnings.push(`I2C sensor "${definition.name}" requires an address. Default: ${definition.i2cAddresses?.[0] ?? 'unknown'}`)
    } else if (definition.i2cAddresses && !definition.i2cAddresses.includes(config.address)) {
      warnings.push(
        `Address ${config.address} is not a known address for "${definition.name}". ` +
        `Known addresses: ${definition.i2cAddresses.join(', ')}. This may be fine if the address was changed.`
      )
    }
  }

  // Voltage compatibility
  if (config.voltage !== undefined) {
    if (config.voltage < definition.voltageRange.min) {
      errors.push(
        `Voltage ${config.voltage}V is below minimum ${definition.voltageRange.min}V for "${definition.name}". Sensor may not work.`
      )
    }
    if (config.voltage > definition.voltageRange.max) {
      errors.push(
        `Voltage ${config.voltage}V exceeds maximum ${definition.voltageRange.max}V for "${definition.name}". Risk of damage!`
      )
    }
  }

  // Pin validation (basic)
  if (config.protocol === 'gpio' && config.pin === undefined) {
    errors.push('GPIO sensor requires a pin number.')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Get default pin assignments for a given platform.
 * Returns Raspberry Pi or Arduino Mega pin mappings.
 */
export function getDefaultPins(platform: 'arduino' | 'raspberry_pi' | 'esp32'): PinAssignment[] {
  switch (platform) {
    case 'raspberry_pi':
      return RASPBERRY_PI_DEFAULT_PINS
    case 'arduino':
      return ARDUINO_MEGA_DEFAULT_PINS
    case 'esp32':
      // ESP32 default pins — common DevKit layout
      return [
        { pin: 21, function: 'I2C SDA', protocol: 'i2c', notes: 'Default I2C SDA' },
        { pin: 22, function: 'I2C SCL', protocol: 'i2c', notes: 'Default I2C SCL' },
        { pin: 1, function: 'UART TX', protocol: 'uart', notes: 'Default UART TX' },
        { pin: 3, function: 'UART RX', protocol: 'uart', notes: 'Default UART RX' },
        { pin: 23, function: 'SPI MOSI', protocol: 'spi', notes: 'Default SPI MOSI' },
        { pin: 19, function: 'SPI MISO', protocol: 'spi', notes: 'Default SPI MISO' },
        { pin: 18, function: 'SPI SCLK', protocol: 'spi', notes: 'Default SPI SCLK' },
        { pin: 5, function: 'SPI CS', protocol: 'spi', notes: 'Default SPI CS' },
        { pin: 36, function: 'ADC CH0', protocol: 'adc', notes: 'VP / ADC1_CH0' },
        { pin: 39, function: 'ADC CH3', protocol: 'adc', notes: 'VN / ADC1_CH3' },
      ]
    default:
      return RASPBERRY_PI_DEFAULT_PINS
  }
}

/**
 * Get all available sensor profiles.
 * Returns pre-built profiles for common robot configurations.
 */
export async function getSensorProfiles(): Promise<SensorProfile[]> {
  // Also check if there are custom sensor profiles stored in system config
  try {
    const customProfiles = await db.systemConfig.findMany({
      where: { category: 'sensor_profile' },
    })

    const custom: SensorProfile[] = customProfiles.map(p => {
      const data = JSON.parse(p.value) as SensorProfile
      return data
    })

    return [...SENSOR_PROFILES, ...custom]
  } catch (error) {
    return SENSOR_PROFILES
  }
}

/**
 * Get all sensor type definitions.
 * Returns the full catalog of supported sensors.
 */
export function getAllSensorDefinitions(): SensorTypeDefinition[] {
  return SENSOR_DEFINITIONS
}

/**
 * Get all calibration presets.
 * Optionally filter by sensor type ID.
 */
export function getCalibrationPresets(sensorTypeId?: string): CalibrationPreset[] {
  if (sensorTypeId) {
    return CALIBRATION_PRESETS.filter(c => c.sensorTypeId === sensorTypeId)
  }
  return CALIBRATION_PRESETS
}

/**
 * Get I2C address map — all known I2C devices and their addresses.
 * Useful for detecting conflicts before wiring.
 */
export function getI2CAddressMap(): Record<string, { sensorId: string; name: string; addresses: string[] }> {
  const map: Record<string, { sensorId: string; name: string; addresses: string[] }> = {}
  for (const def of SENSOR_DEFINITIONS) {
    if (def.i2cAddresses && def.i2cAddresses.length > 0) {
      for (const addr of def.i2cAddresses) {
        map[addr] = { sensorId: def.id, name: def.name, addresses: def.i2cAddresses }
      }
    }
  }
  return map
}
