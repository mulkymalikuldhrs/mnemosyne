// ============================================================
// MEMORIX IOT - Testing API Route
// GET    /api/testing — List suites, tests, results
// POST   /api/testing — Generate tests, run tests, run suites
// PUT    /api/testing — Create manual test case, create suite
// DELETE /api/testing — Delete test/suite
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { TestingService } from '@/lib/testing'
import type { TestCategory } from '@/lib/testing'

const testingService = TestingService.getInstance()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const suites = searchParams.get('suites')
    const tests = searchParams.get('tests')
    const results = searchParams.get('results')

    // List all test suites
    if (suites === 'true') {
      const allSuites = testingService.getAllSuites()
      return NextResponse.json({
        success: true,
        data: allSuites,
      })
    }

    // List all test cases
    if (tests === 'true') {
      const allTests = testingService.getAllTests()
      return NextResponse.json({
        success: true,
        data: allTests,
      })
    }

    // Get latest results
    if (results === 'true') {
      const allTests = testingService.getAllTests()
      const testsWithResults = allTests.filter(t => t.result)
      const summary = {
        total: allTests.length,
        withResults: testsWithResults.length,
        passed: testsWithResults.filter(t => t.result?.status === 'passed').length,
        failed: testsWithResults.filter(t => t.result?.status === 'failed').length,
        error: testsWithResults.filter(t => t.result?.status === 'error').length,
        skipped: testsWithResults.filter(t => t.result?.status === 'skipped').length,
        pending: allTests.filter(t => t.status === 'pending').length,
        running: allTests.filter(t => t.status === 'running').length,
      }
      return NextResponse.json({
        success: true,
        data: {
          summary,
          results: testsWithResults.map(t => ({
            id: t.id,
            name: t.name,
            category: t.category,
            target: t.target,
            status: t.status,
            result: t.result,
          })),
        },
      })
    }

    // Default: return overview of all suites and tests
    const allSuites = testingService.getAllSuites()
    const allTests = testingService.getAllTests()

    const categoryCounts: Record<string, number> = {}
    for (const test of allTests) {
      categoryCounts[test.category] = (categoryCounts[test.category] || 0) + 1
    }

    const statusCounts: Record<string, number> = {}
    for (const test of allTests) {
      statusCounts[test.status] = (statusCounts[test.status] || 0) + 1
    }

    return NextResponse.json({
      success: true,
      data: {
        suites: allSuites.length,
        tests: allTests.length,
        categoryCounts,
        statusCounts,
        recentSuites: allSuites.slice(-5),
        recentTests: allTests.slice(-10),
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve testing data' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body as { action: string }

    switch (action) {
      case 'generate': {
        const { target, category, context } = body as {
          target: string
          category: TestCategory
          context?: string
        }

        if (!target || !category) {
          return NextResponse.json(
            { success: false, error: 'target and category are required for generate action' },
            { status: 400 }
          )
        }

        const validCategories: TestCategory[] = ['unit', 'integration', 'hardware', 'firmware', 'e2e', 'safety']
        if (!validCategories.includes(category)) {
          return NextResponse.json(
            { success: false, error: `Invalid category. Must be one of: ${validCategories.join(', ')}` },
            { status: 400 }
          )
        }

        const testCases = await testingService.generateTests(target, category, context)
        return NextResponse.json({
          success: true,
          data: testCases,
          message: `Generated ${testCases.length} test(s) for "${target}" (${category})`,
        })
      }

      case 'generate_hardware': {
        const { deviceType } = body as { deviceType: string }
        if (!deviceType) {
          return NextResponse.json(
            { success: false, error: 'deviceType is required for generate_hardware action' },
            { status: 400 }
          )
        }

        const testCases = await testingService.generateHardwareTests(deviceType)
        return NextResponse.json({
          success: true,
          data: testCases,
          message: `Generated ${testCases.length} hardware test(s) for "${deviceType}"`,
        })
      }

      case 'generate_safety': {
        const testCases = await testingService.generateSafetyTests()
        return NextResponse.json({
          success: true,
          data: testCases,
          message: `Generated ${testCases.length} safety test(s)`,
        })
      }

      case 'generate_firmware': {
        const { firmwareVersion } = body as { firmwareVersion: string }
        if (!firmwareVersion) {
          return NextResponse.json(
            { success: false, error: 'firmwareVersion is required for generate_firmware action' },
            { status: 400 }
          )
        }

        const testCases = await testingService.generateFirmwareTests(firmwareVersion)
        return NextResponse.json({
          success: true,
          data: testCases,
          message: `Generated ${testCases.length} firmware test(s) for "${firmwareVersion}"`,
        })
      }

      case 'run_test': {
        const { testId } = body as { testId: string }
        if (!testId) {
          return NextResponse.json(
            { success: false, error: 'testId is required for run_test action' },
            { status: 400 }
          )
        }

        const result = await testingService.runTest(testId)
        const test = testingService.getTest(testId)
        return NextResponse.json({
          success: true,
          data: {
            testId,
            testName: test?.name || 'Unknown',
            category: test?.category || 'unknown',
            result,
          },
          message: `Test "${test?.name || testId}": ${result.status}`,
        })
      }

      case 'run_suite': {
        const { suiteId } = body as { suiteId: string }
        if (!suiteId) {
          return NextResponse.json(
            { success: false, error: 'suiteId is required for run_suite action' },
            { status: 400 }
          )
        }

        const suite = await testingService.runSuite(suiteId)
        return NextResponse.json({
          success: true,
          data: suite,
          message: `Suite "${suite.name}": ${suite.status} (${suite.results.passed} passed, ${suite.results.failed} failed)`,
        })
      }

      case 'run_all': {
        const { category } = body as { category?: TestCategory }
        const suites = await testingService.runAllTests(category)
        const totalPassed = suites.reduce((sum, s) => sum + s.results.passed, 0)
        const totalFailed = suites.reduce((sum, s) => sum + s.results.failed, 0)
        return NextResponse.json({
          success: true,
          data: suites,
          message: `Ran ${suites.length} suite(s): ${totalPassed} passed, ${totalFailed} failed`,
        })
      }

      case 'verify_hardware': {
        const { deviceId } = body as { deviceId: string }
        if (!deviceId) {
          return NextResponse.json(
            { success: false, error: 'deviceId is required for verify_hardware action' },
            { status: 400 }
          )
        }

        const result = await testingService.verifyHardwareTest(deviceId)
        return NextResponse.json({
          success: true,
          data: { deviceId, result },
          message: `Hardware verification: ${result.status} (${result.assertionsPassed}/${result.assertionsPassed + result.assertionsFailed} assertions passed)`,
        })
      }

      case 'verify_firmware': {
        const { target } = body as { target: string }
        if (!target) {
          return NextResponse.json(
            { success: false, error: 'target is required for verify_firmware action' },
            { status: 400 }
          )
        }

        const result = await testingService.verifyFirmwareFlash(target)
        return NextResponse.json({
          success: true,
          data: { target, result },
          message: `Firmware verification: ${result.status} (${result.assertionsPassed}/${result.assertionsPassed + result.assertionsFailed} assertions passed)`,
        })
      }

      case 'verify_health': {
        const result = await testingService.verifySystemHealth()
        return NextResponse.json({
          success: true,
          data: result,
          message: `System health: ${result.status} (${result.assertionsPassed}/${result.assertionsPassed + result.assertionsFailed} checks passed)`,
        })
      }

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Unknown action: "${action}". Valid actions: generate, generate_hardware, generate_safety, generate_firmware, run_test, run_suite, run_all, verify_hardware, verify_firmware, verify_health`,
          },
          { status: 400 }
        )
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to process testing action' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body as { action: string }

    switch (action) {
      case 'create_test': {
        const { name, category, description, code, target, assertions } = body as {
          name: string
          category: TestCategory
          description: string
          code: string
          target: string
          assertions: Array<{ description: string; expected: string }>
        }

        if (!name || !category || !target) {
          return NextResponse.json(
            { success: false, error: 'name, category, and target are required for create_test action' },
            { status: 400 }
          )
        }

        const testCase = testingService.createTest({
          name,
          category,
          description: description || `Manual test for ${target}`,
          code: code || '// Manual test case',
          target,
          assertions: assertions || [{ description: 'Manual assertion', expected: 'Pass' }],
        })

        return NextResponse.json({
          success: true,
          data: testCase,
          message: `Created test "${testCase.name}" (${testCase.id})`,
        })
      }

      case 'create_suite': {
        const { name, category, testIds } = body as {
          name: string
          category: TestCategory
          testIds: string[]
        }

        if (!name || !category || !testIds || !Array.isArray(testIds)) {
          return NextResponse.json(
            { success: false, error: 'name, category, and testIds (array) are required for create_suite action' },
            { status: 400 }
          )
        }

        const suite = testingService.createSuite(name, category, testIds)
        return NextResponse.json({
          success: true,
          data: suite,
          message: `Created suite "${suite.name}" with ${suite.tests.length} test(s) (${suite.id})`,
        })
      }

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Unknown PUT action: "${action}". Valid actions: create_test, create_suite`,
          },
          { status: 400 }
        )
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to create test/suite' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const testId = searchParams.get('testId')
    const suiteId = searchParams.get('suiteId')

    if (testId) {
      const deleted = testingService.deleteTest(testId)
      if (!deleted) {
        return NextResponse.json(
          { success: false, error: `Test not found: ${testId}` },
          { status: 404 }
        )
      }
      return NextResponse.json({
        success: true,
        message: `Deleted test: ${testId}`,
      })
    }

    if (suiteId) {
      const deleted = testingService.deleteSuite(suiteId)
      if (!deleted) {
        return NextResponse.json(
          { success: false, error: `Suite not found: ${suiteId}` },
          { status: 404 }
        )
      }
      return NextResponse.json({
        success: true,
        message: `Deleted suite: ${suiteId}`,
      })
    }

    return NextResponse.json(
      { success: false, error: 'testId or suiteId query parameter is required' },
      { status: 400 }
    )
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to delete test/suite' },
      { status: 500 }
    )
  }
}
