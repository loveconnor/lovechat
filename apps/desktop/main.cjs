const { app, BrowserWindow, dialog } = require('electron')
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const net = require('node:net')
const path = require('node:path')

const ROOT_DIR = path.resolve(__dirname, '../..')
const BACKEND_DIR = path.resolve(ROOT_DIR, 'apps/backend')
const LOCAL_HOST = 'localhost'
const WEB_URL = `http://${LOCAL_HOST}:3000`
const BACKEND_URL = `http://${LOCAL_HOST}:4000/health`
const BACKEND_URL_IPV4 = 'http://127.0.0.1:4000/health'
const BACKEND_PORT = 4000
const WEB_PORT = 3000

const childProcesses = []
const isWindows = process.platform === 'win32'
const pnpmCommand = isWindows ? 'pnpm.cmd' : 'pnpm'
const pnpmExecPath = process.env.npm_execpath

let mainWindow = null

function spawnLoggedProcess(command, args, cwd, name) {
  const child = spawn(command, args, {
    cwd,
    env: process.env,
    stdio: 'inherit',
  })

  child.on('error', (error) => {
    console.error(`[desktop] failed to start ${name}:`, error)
  })

  child.on('exit', (code, signal) => {
    if (app.isQuitting) {
      return
    }

    const status = signal ? `signal ${signal}` : `code ${code}`
    console.error(`[desktop] ${name} exited unexpectedly (${status})`)
  })

  childProcesses.push(child)
  return child
}

function spawnPnpmProcess(args, cwd, name) {
  if (pnpmExecPath && fs.existsSync(pnpmExecPath)) {
    return spawnLoggedProcess(process.execPath, [pnpmExecPath, ...args], cwd, name)
  }

  return spawnLoggedProcess(pnpmCommand, args, cwd, name)
}

function runOneShot(command, args, cwd, name) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: 'inherit',
    })

    child.on('error', (error) => {
      reject(new Error(`[desktop] failed to start ${name}: ${error.message}`))
    })

    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`[desktop] ${name} failed with exit code ${code}`))
    })
  })
}

function ensureBackendEnvFile() {
  const envPath = path.resolve(BACKEND_DIR, '.env')
  if (fs.existsSync(envPath)) {
    return
  }

  const envExamplePath = path.resolve(BACKEND_DIR, '.env.example')
  if (!fs.existsSync(envExamplePath)) {
    return
  }

  fs.copyFileSync(envExamplePath, envPath)
}

async function ensureDockerServices() {
  try {
    await runOneShot('docker', ['compose', 'up', '-d', 'postgres', 'redis'], ROOT_DIR, 'docker services')
  } catch (error) {
    console.warn('[desktop] unable to start docker services automatically:', error)
  }
}

async function isHttpReachable(url) {
  const controller = new AbortController()
  const timeout = setTimeout(() => {
    controller.abort()
  }, 1200)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
    })
    return response.status >= 200 && response.status < 500
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

async function isPortInUse(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: LOCAL_HOST, port })

    socket.on('connect', () => {
      socket.destroy()
      resolve(true)
    })

    socket.on('error', () => {
      resolve(false)
    })

    socket.setTimeout(800, () => {
      socket.destroy()
      resolve(false)
    })
  })
}

async function isPortReachable(port) {
  const hosts = ['127.0.0.1', '::1', LOCAL_HOST]

  const checks = hosts.map(
    (host) =>
      new Promise((resolve) => {
        const socket = net.createConnection({ host, port })

        socket.on('connect', () => {
          socket.destroy()
          resolve(true)
        })

        socket.on('error', () => {
          resolve(false)
        })

        socket.setTimeout(800, () => {
          socket.destroy()
          resolve(false)
        })
      }),
  )

  const results = await Promise.all(checks)
  return results.some(Boolean)
}

async function waitForServicesReady(timeoutMs = 120000) {
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    const [backendReady, webReady] = await Promise.all([
      isPortReachable(BACKEND_PORT),
      isPortReachable(WEB_PORT),
    ])

    if (backendReady && webReady) {
      return
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 350)
    })
  }

  throw new Error(`Timed out waiting for: ${BACKEND_URL}, ${WEB_URL}`)
}

async function startDependencies() {
  ensureBackendEnvFile()
  await ensureDockerServices()
  const startupGuards = []

  const backendReachable = (await isHttpReachable(BACKEND_URL)) || (await isHttpReachable(BACKEND_URL_IPV4))
  if (!backendReachable) {
    const backendPortBusy = await isPortInUse(BACKEND_PORT)
    if (backendPortBusy) {
      throw new Error(
        `Port ${BACKEND_PORT} is already in use by another process. Stop it or start LoveChat backend on that port before launching desktop.`,
      )
    }

    const backendChild = spawnPnpmProcess(['--filter', '@lovechat/backend', 'dev'], ROOT_DIR, 'backend')
    startupGuards.push(
      new Promise((_, reject) => {
        backendChild.once('exit', (code, signal) => {
          if (app.isQuitting) {
            return
          }

          const state = signal ? `signal ${signal}` : `code ${code}`
          reject(new Error(`Backend exited before ready (${state}). Check backend logs in the terminal.`))
        })
      }),
    )
  }

  const webReachable = await isPortReachable(WEB_PORT)
  if (!webReachable) {
    const webPortBusy = await isPortInUse(WEB_PORT)
    if (webPortBusy) {
      throw new Error(
        `Port ${WEB_PORT} is already in use by another process. Stop it or start LoveChat web on that port before launching desktop.`,
      )
    }

    const webChild = spawnPnpmProcess(['--filter', '@lovechat/web', 'dev'], ROOT_DIR, 'web')
    startupGuards.push(
      new Promise((_, reject) => {
        webChild.once('exit', (code, signal) => {
          if (app.isQuitting) {
            return
          }

          const state = signal ? `signal ${signal}` : `code ${code}`
          reject(new Error(`Web app exited before ready (${state}). Check web logs in the terminal.`))
        })
      }),
    )
  }

  const readinessPromise = waitForServicesReady(120000)

  if (startupGuards.length === 0) {
    await readinessPromise
    return
  }

  await Promise.race([
    readinessPromise,
    ...startupGuards,
  ])

  await readinessPromise
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 720,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.loadURL(`data:text/html,${encodeURIComponent('<html><body style="font-family: -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; background:#f6f7f9; color:#1f2937;">Starting LoveChat Desktop...</body></html>')}`)
}

function stopChildren() {
  app.isQuitting = true

  for (const child of childProcesses) {
    if (child.killed) {
      continue
    }

    try {
      child.kill('SIGTERM')
    } catch {
      // ignore child termination failures during shutdown
    }
  }
}

app.on('before-quit', () => {
  stopChildren()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.whenReady().then(async () => {
  createMainWindow()

  try {
    await startDependencies()
    if (mainWindow && !mainWindow.isDestroyed()) {
      await mainWindow.loadURL(WEB_URL)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    dialog.showErrorBox('LoveChat Desktop startup failed', message)
    app.quit()
  }
})