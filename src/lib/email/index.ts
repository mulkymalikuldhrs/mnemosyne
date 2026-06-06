// ============================================================
// MEMORIX v3.0.0 — Email Manager
// Universal AI/Human Memory Hub: Email Integration Layer
//
// The EmailManager orchestrates all email providers (Gmail, IMAP,
// Outlook) and provides the high-level API for the rest of the
// Memorix application:
//   - Provider instantiation and lifecycle
//   - Account syncing with incremental cursor tracking
//   - Email ingestion into the Memorix memory system
//   - Cross-account email search
//   - AI-powered email summarisation
// ============================================================

import { db } from '@/lib/db'
import { storeMemory } from '@/ai/memory'
import { chunkText } from '@/ai/chunker'
import { generateEmbedding } from '@/ai/embedder'
import ZAI from 'z-ai-web-dev-sdk'

import {
  type EmailProvider,
  type EmailProviderInterface,
  type EmailAccountConfig,
  type EmailMessage,
  type EmailListOptions,
  type EmailSummarizeOptions,
  EmailProviderError,
} from './types'
import { GmailProvider } from './gmail'
import { ImapProvider } from './imap'

// --- Provider Registry ---

/** Map of provider type to its constructor */
const PROVIDER_REGISTRY: Record<EmailProvider, new () => EmailProviderInterface> = {
  gmail: GmailProvider,
  imap: ImapProvider,
  outlook: ImapProvider, // Outlook uses IMAP provider with Outlook-specific config
}

// --- Sync Configuration ---

const SYNC_BATCH_SIZE = 100
const SYNC_MAX_MESSAGES = 500

// ============================================================
// EmailManager
// ============================================================

/**
 * Central orchestrator for all email operations in Memorix.
 *
 * Responsibilities:
 *  1. Provider lifecycle management (instantiation, auth, disconnect)
 *  2. Account syncing with incremental cursor / history tracking
 *  3. Email ingestion: extract text → create Note → store chunks
 *  4. Cross-account email search
 *  5. AI-powered email summarisation
 */
export class EmailManager {
  private static instance: EmailManager
  private activeProviders: Map<string, EmailProviderInterface> = new Map()

  private constructor() {}

  /** Get the singleton EmailManager instance */
  static getInstance(): EmailManager {
    if (!EmailManager.instance) {
      EmailManager.instance = new EmailManager()
    }
    return EmailManager.instance
  }

  // ============================================================
  // Provider Management
  // ============================================================

  /**
   * Get an authenticated provider instance for the given provider type.
   * If a provider for the given account ID is already active, reuse it.
   *
   * @param providerType - The type of email provider
   * @param accountId - Optional account ID for caching the provider instance
   * @param config - Account configuration needed for authentication
   * @returns An authenticated EmailProviderInterface instance
   */
  async getProvider(
    providerType: EmailProvider,
    accountId?: string,
    config?: EmailAccountConfig
  ): Promise<EmailProviderInterface> {
    // Check for an existing active provider
    if (accountId) {
      const existing = this.activeProviders.get(accountId)
      if (existing && existing.providerType === providerType) {
        return existing
      }
    }

    // Instantiate a new provider
    const ProviderClass = PROVIDER_REGISTRY[providerType]
    if (!ProviderClass) {
      throw new EmailProviderError(
        providerType,
        'CONFIGURATION_ERROR',
        `Unknown email provider type: ${providerType}`
      )
    }

    const provider = new ProviderClass()

    // Authenticate if config is provided
    if (config) {
      await provider.authenticate(config)
      if (accountId) {
        this.activeProviders.set(accountId, provider)
      }
    }

    return provider
  }

  /**
   * Disconnect and remove an active provider from the cache.
   *
   * @param accountId - The account ID to disconnect
   */
  async disconnectProvider(accountId: string): Promise<void> {
    const provider = this.activeProviders.get(accountId)
    if (provider) {
      await provider.disconnect()
      this.activeProviders.delete(accountId)
    }
  }

  // ============================================================
  // Account Syncing
  // ============================================================

  /**
   * Sync emails from a connected email account.
   *
   * Uses the account's sync cursor (or history ID) for incremental
   * syncing. On the first sync, it fetches the most recent messages.
   * On subsequent syncs, it only fetches new/updated messages.
   *
   * @param emailAccountId - The database ID of the EmailAccount
   * @returns Summary of the sync operation
   */
  async syncAccount(emailAccountId: string): Promise<{
    synced: number
    errors: number
    cursor: string
  }> {
    // Load the account from the database
    const account = await db.emailAccount.findUnique({
      where: { id: emailAccountId },
    })

    if (!account) {
      throw new EmailProviderError(
        account?.provider as EmailProvider ?? 'gmail',
        'CONFIGURATION_ERROR',
        `Email account not found: ${emailAccountId}`
      )
    }

    // Check if a sync is already in progress
    if (account.isSyncing) {
      return { synced: 0, errors: 0, cursor: account.syncCursor }
    }

    // Mark as syncing
    await db.emailAccount.update({
      where: { id: emailAccountId },
      data: {
        isSyncing: true,
        syncError: '',
      },
    })

    try {
      const provider = await this.getProvider(
        account.provider as EmailProvider,
        emailAccountId,
        this.buildConfigFromAccount(account)
      )

      let synced = 0
      let errors = 0
      let nextPageToken: string | null = account.syncCursor || null
      let totalSynced = 0
      let newCursor = account.syncCursor

      // Sync messages in batches
      while (totalSynced < SYNC_MAX_MESSAGES) {
        const options: EmailListOptions = {
          limit: SYNC_BATCH_SIZE,
          pageToken: nextPageToken || undefined,
        }

        const result = await provider.listMessages(options)

        for (const message of result.messages) {
          try {
            await this.upsertEmailMessage(emailAccountId, message)
            synced++
          } catch (error) {
            errors++
            console.error(
              `Failed to sync email message ${message.messageId}:`,
              error instanceof Error ? error.message : String(error)
            )
          }
        }

        totalSynced += result.messages.length
        newCursor = result.nextPageToken ?? ''

        // No more pages
        if (!result.nextPageToken) break
        nextPageToken = result.nextPageToken
      }

      // Update the account with sync results
      await db.emailAccount.update({
        where: { id: emailAccountId },
        data: {
          isSyncing: false,
          lastSyncedAt: new Date(),
          syncCursor: newCursor,
          syncError: errors > 0 ? `${errors} errors during sync` : '',
        },
      })

      return { synced, errors, cursor: newCursor }
    } catch (error) {
      // Mark sync as failed
      await db.emailAccount.update({
        where: { id: emailAccountId },
        data: {
          isSyncing: false,
          syncError: error instanceof Error ? error.message : String(error),
        },
      })

      throw error
    }
  }

  // ============================================================
  // Email Ingestion
  // ============================================================

  /**
   * Ingest an email into the Memorix memory system.
   *
   * This process:
   *  1. Loads the email message from the database
   *  2. Extracts meaningful text content (prefers plain text, falls back to HTML)
   *  3. Creates a Memorix Note with email metadata
   *  4. Stores the note content as chunks with embeddings (via storeMemory)
   *  5. Links the Note back to the EmailMessage
   *
   * @param emailMessageId - The database ID of the EmailMessage to ingest
   * @param userId - The user who owns this email
   * @returns The ID of the created Note
   */
  async ingestEmail(emailMessageId: string, userId: string): Promise<string> {
    // Load the email message
    const emailMessage = await db.emailMessage.findUnique({
      where: { id: emailMessageId },
      include: { emailAccount: true },
    })

    if (!emailMessage) {
      throw new Error(`Email message not found: ${emailMessageId}`)
    }

    if (emailMessage.isIngested && emailMessage.noteId) {
      // Already ingested — return the existing note ID
      return emailMessage.noteId
    }

    // Step 1: Extract meaningful text content
    const extractedText = this.extractEmailContent(emailMessage)

    // Step 2: Build the note title and content with email metadata
    const noteTitle = `📧 ${emailMessage.subject || '(No Subject)'}`
    const noteContent = this.buildNoteContent(emailMessage, extractedText)

    // Step 3: Create a Memorix Note
    const note = await db.note.create({
      data: {
        userId,
        title: noteTitle,
        content: noteContent,
        markdown: this.buildNoteMarkdown(emailMessage, extractedText),
        tags: this.buildEmailTags(emailMessage),
      },
    })

    // Step 4: Store the note content as chunks with embeddings
    await storeMemory(note.id, noteContent, userId)

    // Step 5: Link the Note back to the EmailMessage
    await db.emailMessage.update({
      where: { id: emailMessageId },
      data: {
        isIngested: true,
        noteId: note.id,
        ingestedAt: new Date(),
      },
    })

    return note.id
  }

  // ============================================================
  // Email Search
  // ============================================================

  /**
   * Search across all connected email accounts for a user.
   *
   * This performs two-level search:
   *  1. Database search: searches already-synced emails in the local DB
   *  2. Provider search: optionally searches live email accounts
   *
   * @param userId - The user whose emails to search
   * @param query - Free-text search query
   * @returns Matching email messages
   */
  async searchEmails(
    userId: string,
    query: string
  ): Promise<EmailMessage[]> {
    // Step 1: Search local database for already-synced emails
    const accounts = await db.emailAccount.findMany({
      where: { userId },
      include: {
        emailMessages: {
          where: {
            OR: [
              { subject: { contains: query } },
              { fromAddress: { contains: query } },
              { bodyText: { contains: query } },
              { snippet: { contains: query } },
            ],
          },
          orderBy: { date: 'desc' },
          take: 50,
        },
      },
    })

    const results: EmailMessage[] = []

    for (const account of accounts) {
      for (const msg of account.emailMessages) {
        results.push({
          id: msg.id,
          messageId: msg.messageId,
          from: {
            address: msg.fromAddress,
            name: msg.fromName || undefined,
          },
          to: this.parseJsonAddresses(msg.toAddresses),
          subject: msg.subject,
          bodyText: msg.bodyText,
          bodyHtml: msg.bodyHtml,
          date: msg.date,
          isRead: msg.isRead,
          isStarred: msg.isStarred,
          labels: this.parseJsonArray(msg.labels),
        })
      }
    }

    // Step 2: Also perform semantic search via embeddings
    const semanticResults = await this.semanticEmailSearch(query, userId)
    const semanticIds = new Set(semanticResults.map((r) => r.id))

    // Merge semantic results, avoiding duplicates
    for (const result of semanticResults) {
      if (!results.some((r) => r.id === result.id)) {
        results.push(result)
      }
    }

    // Sort by date descending
    results.sort((a, b) => b.date.getTime() - a.date.getTime())

    return results
  }

  // ============================================================
  // AI Email Summarisation
  // ============================================================

  /**
   * Generate an AI-powered summary of recent emails.
   *
   * Uses the z-ai-web-dev-sdk to create a concise summary
   * that highlights:
   *  - Key topics and themes
   *  - Action items and requests
   *  - Important dates and deadlines
   *  - Notable senders
   *
   * @param userId - The user whose emails to summarise
   * @param options - Summarisation options (date range, senders, labels, etc.)
   * @returns AI-generated summary text
   */
  async summarizeEmails(
    userId: string,
    options?: EmailSummarizeOptions
  ): Promise<string> {
    const limit = options?.limit ?? 25

    // Step 1: Fetch relevant emails
    const whereClause: Record<string, unknown> = {}

    if (options?.afterDate) {
      whereClause.date = { gte: options.afterDate }
    }
    if (options?.fromAddresses && options.fromAddresses.length > 0) {
      whereClause.fromAddress = { in: options.fromAddresses }
    }

    const accounts = await db.emailAccount.findMany({
      where: { userId },
      select: { id: true },
    })

    const accountIds = accounts.map((a) => a.id)

    const emailMessages = await db.emailMessage.findMany({
      where: {
        emailAccountId: { in: accountIds },
        ...whereClause,
      },
      orderBy: { date: 'desc' },
      take: limit,
    })

    if (emailMessages.length === 0) {
      return 'No emails found matching the specified criteria.'
    }

    // Step 2: Format emails for the AI prompt
    const formattedEmails = emailMessages.map((msg) => ({
      from: msg.fromName ? `${msg.fromName} <${msg.fromAddress}>` : msg.fromAddress,
      subject: msg.subject,
      date: msg.date.toISOString(),
      snippet: msg.snippet || msg.bodyText.slice(0, 300),
      isRead: msg.isRead,
      isStarred: msg.isStarred,
      labels: this.parseJsonArray(msg.labels),
    }))

    // Step 3: Generate summary using z-ai-web-dev-sdk
    const zai = await ZAI.create()

    const systemPrompt = `You are Memorix, an AI assistant that helps users understand their email inbox. Generate a concise, well-organized summary of the following emails. Highlight:

1. **Key Topics & Themes** — What are the main subjects being discussed?
2. **Action Items** — What requests or tasks need attention?
3. **Important Dates & Deadlines** — Any time-sensitive items?
4. **Notable Senders** — Who are the key people communicating?
5. **Urgency Assessment** — Which items need immediate attention?

Format the summary in clean Markdown. Be concise but comprehensive.
${options?.customPrompt ?? ''}`

    const userPrompt = `Please summarize the following ${formattedEmails.length} emails:\n\n${JSON.stringify(formattedEmails, null, 2)}`

    const response = await zai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 1024,
      temperature: 0.5,
    })

    // Extract the response content
    if (response && typeof response === 'object' && 'choices' in response) {
      const choices = response.choices as Array<{
        message?: { content?: string }
      }>
      if (choices.length > 0 && choices[0].message?.content) {
        return choices[0].message.content
      }
    }

    return 'Unable to generate email summary at this time.'
  }

  // ============================================================
  // Account Management Helpers
  // ============================================================

  /**
   * Add a new email account for a user.
   * Validates the credentials by attempting to authenticate.
   *
   * @param userId - The user ID to associate the account with
   * @param config - Account configuration and credentials
   * @returns The created EmailAccount database record
   */
  async addAccount(
    userId: string,
    config: EmailAccountConfig
  ): Promise<{
    id: string
    emailAddress: string
    provider: string
  }> {
    // Validate credentials by authenticating
    const provider = await this.getProvider(config.provider, undefined, config)

    // Store the account in the database
    const account = await db.emailAccount.create({
      data: {
        userId,
        provider: config.provider,
        emailAddress: config.emailAddress,
        displayName: config.displayName ?? '',
        accessToken: config.accessToken ?? '',
        refreshToken: config.refreshToken ?? '',
        imapHost: config.imapHost ?? null,
        imapPort: config.imapPort ?? 993,
        smtpHost: config.smtpHost ?? null,
        smtpPort: config.smtpPort ?? 587,
      },
    })

    // Cache the provider
    this.activeProviders.set(account.id, provider)

    return {
      id: account.id,
      emailAddress: account.emailAddress,
      provider: account.provider,
    }
  }

  /**
   * Remove an email account and all its synced messages.
   *
   * @param accountId - The account ID to remove
   */
  async removeAccount(accountId: string): Promise<void> {
    // Disconnect the active provider if it exists
    await this.disconnectProvider(accountId)

    // Delete the account (cascades to email messages)
    await db.emailAccount.delete({
      where: { id: accountId },
    })
  }

  /**
   * List all email accounts for a user.
   *
   * @param userId - The user whose accounts to list
   * @returns Array of email account summaries
   */
  async listAccounts(userId: string): Promise<Array<{
    id: string
    emailAddress: string
    provider: string
    displayName: string
    lastSyncedAt: string | null
    isSyncing: boolean
    syncError: string
  }>> {
    const accounts = await db.emailAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    return accounts.map((a) => ({
      id: a.id,
      emailAddress: a.emailAddress,
      provider: a.provider,
      displayName: a.displayName,
      lastSyncedAt: a.lastSyncedAt?.toISOString() ?? null,
      isSyncing: a.isSyncing,
      syncError: a.syncError,
    }))
  }

  // ============================================================
  // Private Helpers
  // ============================================================

  /**
   * Build an EmailAccountConfig from a database EmailAccount record.
   */
  private buildConfigFromAccount(account: {
    provider: string
    emailAddress: string
    displayName: string
    accessToken: string
    refreshToken: string
    imapHost: string | null
    imapPort: number
    smtpHost: string | null
    smtpPort: number
  }): EmailAccountConfig {
    const config: EmailAccountConfig = {
      provider: account.provider as EmailProvider,
      emailAddress: account.emailAddress,
      displayName: account.displayName,
      accessToken: account.accessToken,
      refreshToken: account.refreshToken,
    }

    if (account.imapHost) {
      config.imapHost = account.imapHost
      config.imapPort = account.imapPort
    }
    if (account.smtpHost) {
      config.smtpHost = account.smtpHost
      config.smtpPort = account.smtpPort
    }

    return config
  }

  /**
   * Upsert an email message into the database.
   * Uses the unique constraint on (emailAccountId, messageId).
   */
  private async upsertEmailMessage(
    emailAccountId: string,
    message: EmailMessage
  ): Promise<void> {
    await db.emailMessage.upsert({
      where: {
        emailAccountId_messageId: {
          emailAccountId,
          messageId: message.messageId,
        },
      },
      create: {
        emailAccountId,
        messageId: message.messageId,
        fromAddress: message.from.address,
        fromName: message.from.name ?? '',
        toAddresses: JSON.stringify(
          message.to.map((t) => ({ address: t.address, name: t.name }))
        ),
        subject: message.subject,
        bodyText: message.bodyText,
        bodyHtml: message.bodyHtml,
        date: message.date,
        isRead: message.isRead,
        isStarred: message.isStarred,
        labels: JSON.stringify(message.labels),
        snippet: message.bodyText.slice(0, 200),
      },
      update: {
        fromAddress: message.from.address,
        fromName: message.from.name ?? '',
        subject: message.subject,
        bodyText: message.bodyText,
        bodyHtml: message.bodyHtml,
        isRead: message.isRead,
        isStarred: message.isStarred,
        labels: JSON.stringify(message.labels),
        snippet: message.bodyText.slice(0, 200),
      },
    })
  }

  /**
   * Extract meaningful text content from an email message.
   * Prefers plain text; falls back to stripping HTML tags.
   */
  private extractEmailContent(emailMessage: {
    bodyText: string
    bodyHtml: string
    subject: string
    fromAddress: string
    fromName: string
    date: Date
  }): string {
    // Prefer plain text
    if (emailMessage.bodyText.trim()) {
      return emailMessage.bodyText
    }

    // Fall back to stripping HTML
    if (emailMessage.bodyHtml.trim()) {
      return this.stripHtmlTags(emailMessage.bodyHtml)
    }

    // If neither body is available, use the subject and metadata
    return `Subject: ${emailMessage.subject}\nFrom: ${emailMessage.fromName || emailMessage.fromAddress}\nDate: ${emailMessage.date.toISOString()}`
  }

  /**
   * Build the note content string from email data and extracted text.
   */
  private buildNoteContent(
    emailMessage: {
      subject: string
      fromAddress: string
      fromName: string
      toAddresses: string
      date: Date
    },
    extractedText: string
  ): string {
    const metadata = [
      `From: ${emailMessage.fromName ? `${emailMessage.fromName} <${emailMessage.fromAddress}>` : emailMessage.fromAddress}`,
      `To: ${emailMessage.toAddresses}`,
      `Date: ${emailMessage.date.toISOString()}`,
      `Subject: ${emailMessage.subject}`,
    ].join('\n')

    return `${metadata}\n\n---\n\n${extractedText}`
  }

  /**
   * Build the note markdown with structured email metadata.
   */
  private buildNoteMarkdown(
    emailMessage: {
      subject: string
      fromAddress: string
      fromName: string
      toAddresses: string
      date: Date
      isStarred: boolean
    },
    extractedText: string
  ): string {
    const lines: string[] = [
      `## ${emailMessage.subject || '(No Subject)'}`,
      '',
      `| Field | Value |`,
      `|-------|-------|`,
      `| **From** | ${emailMessage.fromName ? `**${emailMessage.fromName}** ` : ''}\`${emailMessage.fromAddress}\` |`,
      `| **To** | \`${emailMessage.toAddresses}\` |`,
      `| **Date** | ${emailMessage.date.toLocaleString()} |`,
      `| **Starred** | ${emailMessage.isStarred ? '⭐ Yes' : 'No'} |`,
      '',
      '---',
      '',
      extractedText,
    ]

    return lines.join('\n')
  }

  /**
   * Build tags from email metadata for categorisation.
   */
  private buildEmailTags(emailMessage: {
    fromAddress: string
    labels: string
    isStarred: boolean
  }): string {
    const tags: string[] = ['email']

    // Add domain-based tag
    const domain = emailMessage.fromAddress.split('@')[1]
    if (domain) {
      tags.push(domain.split('.')[0])
    }

    // Add labels
    const labels = this.parseJsonArray(emailMessage.labels)
    for (const label of labels) {
      const tag = label.toLowerCase().replace(/[^a-z0-9]/g, '-')
      if (tag && !tags.includes(tag)) {
        tags.push(tag)
      }
    }

    // Add starred tag
    if (emailMessage.isStarred) {
      tags.push('starred')
    }

    return tags.join(',')
  }

  /**
   * Perform semantic search over ingested email notes.
   */
  private async semanticEmailSearch(
    query: string,
    userId: string
  ): Promise<EmailMessage[]> {
    try {
      // Generate embedding for the query
      const queryEmbedding = await generateEmbedding(query, userId)

      // Find email messages that have been ingested as notes
      const ingestedMessages = await db.emailMessage.findMany({
        where: {
          isIngested: true,
          noteId: { not: null },
          emailAccount: { userId },
        },
        include: { emailAccount: true },
        take: 100,
      })

      if (ingestedMessages.length === 0) return []

      // Load chunk embeddings for the ingested notes
      const noteIds = ingestedMessages
        .map((m) => m.noteId)
        .filter((id): id is string => id !== null)

      const chunks = await db.noteChunk.findMany({
        where: {
          noteId: { in: noteIds },
        },
      })

      // Compute similarity scores
      const scoredNotes = new Map<string, number>()

      for (const chunk of chunks) {
        try {
          const embedding = JSON.parse(chunk.embedding)
          if (!Array.isArray(embedding)) continue

          const score = this.cosineSimilarity(queryEmbedding.embedding, embedding)
          const currentBest = scoredNotes.get(chunk.noteId) ?? 0
          if (score > currentBest) {
            scoredNotes.set(chunk.noteId, score)
          }
        } catch {
          continue
        }
      }

      // Sort by score and get top results
      const topNoteIds = Array.from(scoredNotes.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 20)
        .map(([id]) => id)

      // Map back to email messages
      const results: EmailMessage[] = []
      for (const msg of ingestedMessages) {
        if (msg.noteId && topNoteIds.includes(msg.noteId)) {
          results.push({
            id: msg.id,
            messageId: msg.messageId,
            from: {
              address: msg.fromAddress,
              name: msg.fromName || undefined,
            },
            to: this.parseJsonAddresses(msg.toAddresses),
            subject: msg.subject,
            bodyText: msg.bodyText,
            bodyHtml: msg.bodyHtml,
            date: msg.date,
            isRead: msg.isRead,
            isStarred: msg.isStarred,
            labels: this.parseJsonArray(msg.labels),
          })
        }
      }

      return results
    } catch {
      // Semantic search is best-effort; don't break the whole search
      return []
    }
  }

  /**
   * Compute cosine similarity between two vectors.
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0
    const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0)
    const magA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0))
    const magB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0))
    if (magA === 0 || magB === 0) return 0
    return dot / (magA * magB)
  }

  /**
   * Parse a JSON string of email addresses.
   */
  private parseJsonAddresses(json: string): Array<{ address: string; name?: string }> {
    try {
      const parsed = JSON.parse(json)
      if (Array.isArray(parsed)) {
        return parsed.map((addr: Record<string, string>) => ({
          address: addr.address ?? '',
          name: addr.name || undefined,
        }))
      }
    } catch {
      // Not valid JSON
    }
    return []
  }

  /**
   * Parse a JSON array string into a string array.
   */
  private parseJsonArray(json: string): string[] {
    try {
      const parsed = JSON.parse(json)
      if (Array.isArray(parsed)) {
        return parsed.filter((v: unknown) => typeof v === 'string')
      }
    } catch {
      // Not valid JSON
    }
    return []
  }

  /**
   * Strip basic HTML tags to extract plain text.
   */
  private stripHtmlTags(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }
}

// --- Convenience singleton export ---

/** The default EmailManager instance for use across the application */
export const emailManager = EmailManager.getInstance()

// --- Re-export types and providers for convenient imports ---

export type {
  EmailProvider,
  EmailMessage,
  EmailAddress,
  EmailAccountConfig,
  EmailListOptions,
  EmailListResult,
  EmailSummarizeOptions,
  EmailProviderInterface,
} from './types'

export { EmailProviderError, RateLimiter } from './types'
export { GmailProvider } from './gmail'
export { ImapProvider } from './imap'
