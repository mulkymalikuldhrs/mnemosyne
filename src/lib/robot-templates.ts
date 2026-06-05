// ============================================================
// MEMORIX IOT - Robot Template & Auto-Detect Service
// Auto-detect hardware, match templates, auto-prepare configurations
// ============================================================

import { db } from './db'
import { BUILTIN_ROBOT_TEMPLATES } from './constants'
import type {
  RobotTemplateSummary,
  RobotTemplateDetail,
  RobotProjectSummary,
  HardwareRequirement,
  FirmwareRequirement,
  AssemblyStep,
  HardwareScanResult,
  DetectedDevice,
  HardwareSuggestion,
  RobotCategory,
  BuildDifficulty,
  RobotProjectStatus,
} from './types'

// ============================================================
// RobotTemplateService
// ============================================================

export class RobotTemplateService {
  private static instance: RobotTemplateService

  private constructor() {}

  static getInstance(): RobotTemplateService {
    if (!RobotTemplateService.instance) {
      RobotTemplateService.instance = new RobotTemplateService()
    }
    return RobotTemplateService.instance
  }

  /**
   * Initialize built-in templates in the database
   */
  async initializeTemplates(): Promise<void> {
    for (const template of BUILTIN_ROBOT_TEMPLATES) {
      const existing = await db.robotTemplate.findFirst({
        where: { name: template.name },
      })
      if (!existing) {
        await db.robotTemplate.create({
          data: {
            name: template.name,
            description: template.description,
            category: template.category,
            icon: template.icon,
            difficulty: template.difficulty,
            estimatedBuildHours: template.estimatedBuildHours,
            isOfficial: template.isOfficial,
            requiredHardware: JSON.stringify(template.requiredHardware),
            requiredFirmware: JSON.stringify(template.requiredFirmware),
            capabilities: JSON.stringify(template.capabilities),
            autoConfig: JSON.stringify({}),
            assemblyGuide: JSON.stringify(template.assemblyGuide),
            wiringDiagram: JSON.stringify(template.wiringDiagram),
          },
        })
      }
    }
  }

  /**
   * List all available templates
   */
  async listTemplates(category?: RobotCategory, difficulty?: BuildDifficulty): Promise<RobotTemplateSummary[]> {
    const where: Record<string, unknown> = {}
    if (category) where.category = category
    if (difficulty) where.difficulty = difficulty

    const templates = await db.robotTemplate.findMany({ where, orderBy: { name: 'asc' } })
    return templates.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category as RobotCategory,
      icon: t.icon,
      difficulty: t.difficulty as BuildDifficulty,
      estimatedBuildHours: t.estimatedBuildHours,
      isOfficial: t.isOfficial,
      version: t.version,
    }))
  }

  /**
   * Get full template details
   */
  async getTemplate(templateId: string): Promise<RobotTemplateDetail | null> {
    const template = await db.robotTemplate.findUnique({ where: { id: templateId } })
    if (!template) return null

    return {
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category as RobotCategory,
      icon: template.icon,
      difficulty: template.difficulty as BuildDifficulty,
      estimatedBuildHours: template.estimatedBuildHours,
      isOfficial: template.isOfficial,
      version: template.version,
      requiredHardware: JSON.parse(template.requiredHardware) as HardwareRequirement[],
      requiredFirmware: JSON.parse(template.requiredFirmware) as FirmwareRequirement[],
      capabilities: JSON.parse(template.capabilities) as string[],
      autoConfig: JSON.parse(template.autoConfig) as Record<string, unknown>,
      assemblyGuide: JSON.parse(template.assemblyGuide) as AssemblyStep[],
      wiringDiagram: JSON.parse(template.wiringDiagram) as Record<string, unknown>,
      codeTemplate: template.codeTemplate,
      tags: template.tags ? JSON.parse(template.tags) : null,
    }
  }

  /**
   * Create a new robot project from a template
   */
  async createProjectFromTemplate(
    templateId: string,
    name: string,
    description?: string
  ): Promise<RobotProjectSummary> {
    const template = await this.getTemplate(templateId)
    if (!template) throw new Error(`Template not found: ${templateId}`)

    const config = {
      templateId,
      templateName: template.name,
      category: template.category,
      capabilities: template.capabilities,
      autoConfig: template.autoConfig,
    }

    const steps = template.assemblyGuide.map((step) => ({
      ...step,
      completed: false,
    }))

    const project = await db.robotProject.create({
      data: {
        name,
        description: description || `Project from template: ${template.name}`,
        templateId,
        status: 'draft',
        config: JSON.stringify(config),
        hardwareList: JSON.stringify(template.requiredHardware),
        firmwareList: JSON.stringify(template.requiredFirmware),
        capabilities: JSON.stringify(template.capabilities),
        steps: JSON.stringify(steps),
        isOffline: true,
      },
    })

    return this.projectToSummary(project)
  }

  /**
   * Create a custom project (no template)
   */
  async createCustomProject(
    name: string,
    description: string,
    category: RobotCategory
  ): Promise<RobotProjectSummary> {
    const project = await db.robotProject.create({
      data: {
        name,
        description,
        status: 'draft',
        config: JSON.stringify({ category, custom: true }),
        hardwareList: JSON.stringify([]),
        firmwareList: JSON.stringify([]),
        capabilities: JSON.stringify([]),
        steps: JSON.stringify([]),
        isOffline: true,
      },
    })

    return this.projectToSummary(project)
  }

  /**
   * Get project by ID
   */
  async getProject(projectId: string): Promise<RobotProjectSummary | null> {
    const project = await db.robotProject.findUnique({ where: { id: projectId } })
    if (!project) return null
    return this.projectToSummary(project)
  }

  /**
   * List all projects
   */
  async listProjects(status?: RobotProjectStatus): Promise<RobotProjectSummary[]> {
    const where: Record<string, unknown> = {}
    if (status) where.status = status

    const projects = await db.robotProject.findMany({ where, orderBy: { updatedAt: 'desc' } })
    return projects.map(p => this.projectToSummary(p))
  }

  /**
   * Update project build step
   */
  async updateBuildStep(
    projectId: string,
    stepIndex: number,
    completed: boolean
  ): Promise<RobotProjectSummary> {
    const project = await db.robotProject.findUnique({ where: { id: projectId } })
    if (!project) throw new Error('Project not found')

    const steps = JSON.parse(project.steps) as AssemblyStep[]
    if (stepIndex >= 0 && stepIndex < steps.length) {
      steps[stepIndex].completed = completed
    }

    const completedCount = steps.filter(s => s.completed).length
    const progress = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0

    const newStatus: RobotProjectStatus = progress === 100 ? 'configured' :
      progress > 0 ? 'building' : 'draft'

    const updated = await db.robotProject.update({
      where: { id: projectId },
      data: {
        steps: JSON.stringify(steps),
        buildProgress: progress,
        currentStep: steps.find(s => !s.completed)?.title || null,
        status: newStatus,
      },
    })

    return this.projectToSummary(updated)
  }

  /**
   * Scan for connected hardware and match against template requirements
   */
  async scanHardware(projectId?: string): Promise<HardwareScanResult> {
    const connectedDevices = await db.hardwareDevice.findMany({
      orderBy: { lastSeen: 'desc' },
    })

    const detected: DetectedDevice[] = connectedDevices.map(d => ({
      deviceType: d.deviceType,
      name: d.name,
      protocol: d.protocol,
      port: d.port || '',
      vendorId: d.vendorId || undefined,
      productId: d.productId || undefined,
      address: d.address || undefined,
      status: d.status,
      autoConfigAvailable: d.status === 'active' || d.status === 'initialized',
    }))

    const missing: HardwareRequirement[] = []
    const suggestions: HardwareSuggestion[] = []

    if (projectId) {
      const project = await db.robotProject.findUnique({ where: { id: projectId } })
      if (project) {
        const requiredHardware = JSON.parse(project.hardwareList) as HardwareRequirement[]
        const connectedTypes = new Set(connectedDevices.map(d => d.deviceType))

        for (const req of requiredHardware) {
          if (req.required && !connectedTypes.has(req.deviceType)) {
            missing.push(req)
            suggestions.push({
              deviceType: req.deviceType,
              reason: `${req.name} diperlukan tapi belum terdeteksi. Hubungkan via ${req.protocol}.`,
              suggestedModels: req.alternatives ? [req.name, ...req.alternatives] : [req.name],
              connectionGuide: `Sambungkan ${req.name} ke port ${req.protocol}. ${req.notes || ''}`,
              priority: 'required',
            })
          }
        }
      }
    }

    return {
      timestamp: new Date().toISOString(),
      totalScanned: connectedDevices.length,
      detected,
      missing,
      suggestions,
    }
  }

  /**
   * Auto-configure project based on detected hardware
   * Sets up drivers, firmware, and capabilities automatically
   */
  async autoConfigure(projectId: string): Promise<RobotProjectSummary> {
    const project = await db.robotProject.findUnique({ where: { id: projectId } })
    if (!project) throw new Error('Project not found')

    const scanResult = await this.scanHardware(projectId)
    const config = JSON.parse(project.config) as Record<string, unknown>

    // Update config with detected hardware
    config.detectedHardware = scanResult.detected
    config.missingHardware = scanResult.missing
    config.autoConfigured = true
    config.autoConfiguredAt = new Date().toISOString()

    const allRequiredConnected = scanResult.missing.filter(m => m.required).length === 0
    const newStatus: RobotProjectStatus = allRequiredConnected ? 'ready' : 'building'

    const updated = await db.robotProject.update({
      where: { id: projectId },
      data: {
        config: JSON.stringify(config),
        status: newStatus,
        currentStep: allRequiredConnected
          ? 'All required hardware detected - Ready to flash!'
          : `Missing: ${scanResult.missing.filter(m => m.required).map(m => m.name).join(', ')}`,
      },
    })

    // Create alerts for missing hardware
    for (const missing of scanResult.missing.filter(m => m.required)) {
      await db.alert.create({
        data: {
          level: 'warning',
          source: 'system',
          title: `Hardware Missing: ${missing.name}`,
          message: `Sambungkan ${missing.name} ke port ${missing.protocol} untuk melanjutkan build. ${missing.notes || ''}`,
          category: 'hardware',
          isRead: false,
        },
      })
    }

    return this.projectToSummary(updated)
  }

  /**
   * Delete a project
   */
  async deleteProject(projectId: string): Promise<boolean> {
    try {
      await db.robotProject.delete({ where: { id: projectId } })
      return true
    } catch {
      return false
    }
  }

  // --- Helper ---
  private projectToSummary(project: {
    id: string
    name: string
    description: string | null
    templateId: string | null
    status: string
    config: string
    hardwareList: string
    buildProgress: number
    currentStep: string | null
    isOffline: boolean
    lastSyncAt: Date | null
    createdAt: Date
    updatedAt: Date
  }): RobotProjectSummary {
    return {
      id: project.id,
      name: project.name,
      description: project.description,
      templateId: project.templateId,
      status: project.status as RobotProjectStatus,
      config: JSON.parse(project.config),
      hardwareList: JSON.parse(project.hardwareList) as HardwareRequirement[],
      buildProgress: project.buildProgress,
      currentStep: project.currentStep,
      isOffline: project.isOffline,
      lastSyncAt: project.lastSyncAt?.toISOString() || null,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    }
  }
}
