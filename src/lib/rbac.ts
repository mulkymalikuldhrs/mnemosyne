// ============================================================
// MNEMOSYNE v2.0.0 — RBAC (Role-Based Access Control)
// Inspired by Pentaract's 3-tier access model (R/W/A)
// Extended to 5 tiers for Mnemosyne's multi-tenant needs
// ============================================================

export enum AccessLevel {
  /** Read-only: can view memories, entities, and search results */
  READ = 'read',
  /** Write: can add memories, create entities, sync storage */
  WRITE = 'write',
  /** Admin: can manage access, configure integrations */
  ADMIN = 'admin',
  /** Owner: full control including deletion and transfer */
  OWNER = 'owner',
  /** Super Admin: system-level operations */
  SUPER_ADMIN = 'super_admin',
}

export interface AccessCheck {
  userId: string
  resourceType: 'memory' | 'entity' | 'storage' | 'agent' | 'integration' | 'system'
  resourceId: string
  requiredLevel: AccessLevel
}

export interface AccessGrant {
  userId: string
  resourceType: string
  resourceId: string
  accessLevel: AccessLevel
  grantedBy: string
  grantedAt: Date
  expiresAt?: Date
}

/**
 * RBAC Manager for Mnemosyne.
 * 
 * Access hierarchy (inspired by Pentaract's R/W/A):
 * - READ ≤ WRITE ≤ ADMIN ≤ OWNER ≤ SUPER_ADMIN
 * - Higher levels implicitly include lower level permissions
 * - Resource-level granularity (per-memory, per-agent, per-storage account)
 */
export class RBACManager {
  private grants: Map<string, AccessGrant> = new Map()

  /**
   * Build a composite key for the access map.
   */
  private buildKey(userId: string, resourceType: string, resourceId: string): string {
    return `${userId}:${resourceType}:${resourceId}`
  }

  /**
   * Check if a user has the required access level for a resource.
   * Pentaract pattern: check_access(user, resource, required_level)
   */
  hasAccess(check: AccessCheck): boolean {
    // Super admin always has access
    if (check.requiredLevel === AccessLevel.SUPER_ADMIN) {
      return this.hasExactLevel(check.userId, check.resourceType, check.resourceId, AccessLevel.SUPER_ADMIN)
    }

    // Check grant hierarchy
    const levelHierarchy = [
      AccessLevel.READ,
      AccessLevel.WRITE,
      AccessLevel.ADMIN,
      AccessLevel.OWNER,
      AccessLevel.SUPER_ADMIN,
    ]

    const requiredIndex = levelHierarchy.indexOf(check.requiredLevel)
    if (requiredIndex === -1) return false

    // Check all grants that satisfy the required level
    for (const level of levelHierarchy.slice(requiredIndex)) {
      if (this.hasExactLevel(check.userId, check.resourceType, check.resourceId, level)) {
        // Check expiration
        const key = this.buildKey(check.userId, check.resourceType, check.resourceId)
        const grant = this.grants.get(key)
        if (grant && grant.accessLevel === level) {
          if (grant.expiresAt && grant.expiresAt < new Date()) {
            this.grants.delete(key) // Expired
            continue
          }
          return true
        }
      }
    }

    return false
  }

  /**
   * Grant access to a user for a resource.
   * Pentaract pattern: ON CONFLICT DO UPDATE (upsert)
   */
  grantAccess(grant: AccessGrant): void {
    const key = this.buildKey(grant.userId, grant.resourceType, grant.resourceId)
    this.grants.set(key, grant)
  }

  /**
   * Revoke access from a user for a resource.
   */
  revokeAccess(userId: string, resourceType: string, resourceId: string): void {
    const key = this.buildKey(userId, resourceType, resourceId)
    this.grants.delete(key)
  }

  /**
   * List all grants for a resource (admin-only operation).
   */
  listGrants(resourceType: string, resourceId: string): AccessGrant[] {
    const results: AccessGrant[] = []
    for (const [key, grant] of this.grants) {
      if (grant.resourceType === resourceType && grant.resourceId === resourceId) {
        results.push(grant)
      }
    }
    return results
  }

  /**
   * Get the access level for a user on a resource.
   */
  getAccessLevel(userId: string, resourceType: string, resourceId: string): AccessLevel | null {
    const key = this.buildKey(userId, resourceType, resourceId)
    const grant = this.grants.get(key)
    if (!grant) return null
    if (grant.expiresAt && grant.expiresAt < new Date()) {
      this.grants.delete(key)
      return null
    }
    return grant.accessLevel
  }

  private hasExactLevel(userId: string, resourceType: string, resourceId: string, level: AccessLevel): boolean {
    const key = this.buildKey(userId, resourceType, resourceId)
    const grant = this.grants.get(key)
    return grant?.accessLevel === level
  }

  /**
   * Create default owner access for a resource creator.
   */
  grantOwnerAccess(userId: string, resourceType: string, resourceId: string): void {
    this.grantAccess({
      userId,
      resourceType,
      resourceId,
      accessLevel: AccessLevel.OWNER,
      grantedBy: 'system',
      grantedAt: new Date(),
    })
  }
}

// --- Singleton ---

let rbacInstance: RBACManager | null = null

export function getRBACManager(): RBACManager {
  if (!rbacInstance) {
    rbacInstance = new RBACManager()
  }
  return rbacInstance
}
