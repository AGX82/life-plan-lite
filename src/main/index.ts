import { app, BrowserWindow, dialog, globalShortcut, ipcMain, screen, shell } from 'electron'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createDbClient } from './db/client'
import { LifePlanRepository } from './db/repository'
import { migrate } from './db/schema'
import type {
  AdminModeRequestResult,
  CreateBoardInput,
  CreateColumnInput,
  CreateGroupInput,
  CreateItemInput,
  CreateListInput,
  CreateWidgetInput,
  DisplayInfo,
  DisplayState,
  MoveListInput,
  UpdateBoardInput,
  UpdateColumnInput,
  UpdateGroupInput,
  UpdateItemInput,
  UpdateListInput,
  UpdateWidgetInput
} from '../shared/domain'

let adminWindow: BrowserWindow | null = null
let displayWindow: BrowserWindow | null = null
let repository: LifePlanRepository
let allowDisplayClose = false

function configureChromiumRuntime(): void {
  try {
    const runtimeDir = join(app.getPath('temp'), 'life-plan-lite-runtime', String(process.pid))
    const sessionDir = join(runtimeDir, 'session')
    const cacheDir = join(runtimeDir, 'cache')
    mkdirSync(sessionDir, { recursive: true })
    mkdirSync(cacheDir, { recursive: true })
    app.setPath('sessionData', sessionDir)
    app.commandLine.appendSwitch('disk-cache-dir', cacheDir)
    app.commandLine.appendSwitch('media-cache-dir', cacheDir)
  } catch {}
  app.commandLine.appendSwitch('disable-http-cache')
  app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')
}

configureChromiumRuntime()

function createWindow(route: 'admin' | 'display', options: Electron.BrowserWindowConstructorOptions): BrowserWindow {
  const window = new BrowserWindow({
    width: route === 'admin' ? 1440 : 1280,
    height: route === 'admin' ? 940 : 720,
    minWidth: route === 'admin' ? 1120 : 900,
    minHeight: route === 'admin' ? 720 : 560,
    backgroundColor: '#101214',
    show: false,
    autoHideMenuBar: route === 'display',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    },
    ...options
  })

  const rendererUrl = process.env.ELECTRON_RENDERER_URL
  if (rendererUrl) {
    window.loadURL(`${rendererUrl}/#/${route}`)
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'), { hash: route })
  }

  window.once('ready-to-show', () => window.show())
  return window
}

function getPrimaryAdminBounds(): Electron.Rectangle {
  const workArea = screen.getPrimaryDisplay().workArea
  const width = Math.min(1440, workArea.width)
  const height = Math.min(940, workArea.height)
  return {
    x: workArea.x + Math.max(0, Math.floor((workArea.width - width) / 2)),
    y: workArea.y + Math.max(0, Math.floor((workArea.height - height) / 2)),
    width,
    height
  }
}

function createAdminWindow(): BrowserWindow {
  adminWindow = createWindow('admin', getPrimaryAdminBounds())
  adminWindow.on('closed', () => {
    adminWindow = null
  })
  return adminWindow
}

function createDisplayWindow(): void {
  if (displayWindow && !displayWindow.isDestroyed()) {
    moveDisplayWindowToTarget()
    if (!displayWindow.isVisible()) displayWindow.show()
    displayWindow.setAlwaysOnTop(true)
    displayWindow.setFullScreen(true)
    displayWindow.focus()
    return
  }

  const targetDisplay = getSelectedDisplay()
  displayWindow = createWindow('display', {
    x: targetDisplay?.bounds.x,
    y: targetDisplay?.bounds.y,
    width: targetDisplay?.bounds.width,
    height: targetDisplay?.bounds.height,
    fullscreen: true,
    alwaysOnTop: true
  })

  displayWindow.on('close', (event) => {
    if (!allowDisplayClose && displayWindow?.isFullScreen()) {
      event.preventDefault()
      dialog
        .showMessageBox(displayWindow, {
          type: 'question',
          buttons: ['Keep Display Open', 'Close Display'],
          defaultId: 0,
          cancelId: 0,
          title: 'Close display board?',
          message: 'Close the read-only display board?'
        })
        .then((result) => {
          if (result.response === 1 && displayWindow) {
            allowDisplayClose = true
            displayWindow.setFullScreen(false)
            displayWindow.close()
            allowDisplayClose = false
          }
        })
    }
  })

  displayWindow.on('closed', () => {
    displayWindow = null
  })
}

function hideDisplayWindow(): void {
  if (!displayWindow || displayWindow.isDestroyed()) return
  displayWindow.setAlwaysOnTop(false)
  displayWindow.hide()
}

function getSelectedDisplay(): Electron.Display {
  const displays = screen.getAllDisplays()
  const selectedId = repository.getDisplayTargetId()
  return displays.find((display) => String(display.id) === selectedId) ?? displays.find((display) => display.bounds.x !== 0 || display.bounds.y !== 0) ?? screen.getPrimaryDisplay()
}

function moveDisplayWindowToTarget(): void {
  if (!displayWindow || displayWindow.isDestroyed()) return

  const targetDisplay = getSelectedDisplay()
  displayWindow.setFullScreen(false)
  displayWindow.setBounds(targetDisplay.bounds)
  displayWindow.setFullScreen(true)
}

function getDisplayState(): DisplayState {
  return {
    visible: Boolean(displayWindow && !displayWindow.isDestroyed() && displayWindow.isVisible()),
    selectedDisplayId: repository.getDisplayTargetId(),
    displays: screen.getAllDisplays().map<DisplayInfo>((display, index) => ({
      id: String(display.id),
      label: display.label || `${display === screen.getPrimaryDisplay() ? 'Primary' : 'Display'} ${index + 1}`,
      primary: display.id === screen.getPrimaryDisplay().id,
      bounds: {
        x: display.bounds.x,
        y: display.bounds.y,
        width: display.bounds.width,
        height: display.bounds.height
      }
    }))
  }
}

function focusAdminWindowOnPrimaryDisplay(): void {
  const targetWindow = adminWindow && !adminWindow.isDestroyed() ? adminWindow : createAdminWindow()
  const primaryDisplay = screen.getPrimaryDisplay()
  const currentDisplay = screen.getDisplayMatching(targetWindow.getBounds())

  if (currentDisplay.id !== primaryDisplay.id) {
    targetWindow.setBounds(getPrimaryAdminBounds())
  }

  if (targetWindow.isMinimized()) targetWindow.restore()
  if (!targetWindow.isVisible()) targetWindow.show()
  targetWindow.focus()
}

function requestAdminMode(): AdminModeRequestResult {
  if (screen.getAllDisplays().length <= 1) {
    return { switchInPlace: true }
  }

  focusAdminWindowOnPrimaryDisplay()
  return { switchInPlace: false }
}

function notifyDataChanged(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send('data:changed')
  }
}

function handleMutation<T extends unknown[], R>(action: (...args: T) => R): (...args: T) => R {
  return (...args: T): R => {
    const result = action(...args)
    notifyDataChanged()
    return result
  }
}

function registerIpc(): void {
  ipcMain.handle('boards:list', () => repository.listBoards())
  ipcMain.handle('boards:activeSnapshot', (_event, mode: 'admin' | 'display' = 'admin') =>
    repository.getActiveBoardSnapshot(mode)
  )
  ipcMain.handle('boards:snapshot', (_event, boardId: string, mode: 'admin' | 'display' = 'admin') =>
    repository.getBoardSnapshot(boardId, mode)
  )
  ipcMain.handle('boards:setActive', (_event, boardId: string) => handleMutation(repository.setActiveBoard.bind(repository))(boardId))
  ipcMain.handle('app:close', () => {
    allowDisplayClose = true
    app.quit()
  })
  ipcMain.handle('app:requestAdminMode', () => requestAdminMode())
  ipcMain.handle('display:state', () => getDisplayState())
  ipcMain.handle('appSettings:get', () => repository.getAppSettings())
  ipcMain.handle('appSettings:update', (_event, settings) => handleMutation(repository.updateAppSettings.bind(repository))(settings))
  ipcMain.handle('display:open', () => {
    createDisplayWindow()
    return getDisplayState()
  })
  ipcMain.handle('display:hide', () => {
    hideDisplayWindow()
    return getDisplayState()
  })
  ipcMain.handle('display:setTarget', (_event, displayId: string) => {
    repository.setDisplayTargetId(displayId)
    if (displayWindow && !displayWindow.isDestroyed() && displayWindow.isVisible()) moveDisplayWindowToTarget()
    return getDisplayState()
  })
  ipcMain.handle('items:publish', (_event, itemId: string) => handleMutation(repository.publishItem.bind(repository))(itemId))
  ipcMain.handle('items:publishList', (_event, listId: string) => handleMutation(repository.publishList.bind(repository))(listId))
  ipcMain.handle('items:publishBoard', (_event, boardId: string) => handleMutation(repository.publishBoard.bind(repository))(boardId))
  ipcMain.handle('items:complete', (_event, itemId: string) => handleMutation(repository.completeItem.bind(repository))(itemId))
  ipcMain.handle('items:close', (_event, input) => handleMutation(repository.closeItem.bind(repository))(input))
  ipcMain.handle('items:create', (_event, input: CreateItemInput) => handleMutation(repository.createItem.bind(repository))(input))
  ipcMain.handle('items:update', (_event, input: UpdateItemInput) => handleMutation(repository.updateItem.bind(repository))(input))
  ipcMain.handle('items:delete', (_event, itemId: string) => handleMutation(repository.deleteItem.bind(repository))(itemId))
  ipcMain.handle('boards:create', (_event, input: CreateBoardInput) => handleMutation(repository.createBoard.bind(repository))(input))
  ipcMain.handle('boards:update', (_event, input: UpdateBoardInput) => handleMutation(repository.updateBoard.bind(repository))(input))
  ipcMain.handle('lists:create', (_event, input: CreateListInput) => handleMutation(repository.createList.bind(repository))(input))
  ipcMain.handle('lists:update', (_event, input: UpdateListInput) => handleMutation(repository.updateList.bind(repository))(input))
  ipcMain.handle('lists:delete', (_event, listId: string) => handleMutation(repository.deleteList.bind(repository))(listId))
  ipcMain.handle('lists:moveToBoard', (_event, input: MoveListInput) => handleMutation(repository.moveListToBoard.bind(repository))(input))
  ipcMain.handle('lists:copyToBoard', (_event, input: MoveListInput) => handleMutation(repository.copyListToBoard.bind(repository))(input))
  ipcMain.handle('groups:create', (_event, input: CreateGroupInput) => handleMutation(repository.createGroup.bind(repository))(input))
  ipcMain.handle('groups:update', (_event, input: UpdateGroupInput) => handleMutation(repository.updateGroup.bind(repository))(input))
  ipcMain.handle('groups:delete', (_event, groupId: string) => handleMutation(repository.deleteGroup.bind(repository))(groupId))
  ipcMain.handle('columns:create', (_event, input: CreateColumnInput) => handleMutation(repository.createColumn.bind(repository))(input))
  ipcMain.handle('columns:update', (_event, input: UpdateColumnInput) => handleMutation(repository.updateColumn.bind(repository))(input))
  ipcMain.handle('columns:delete', (_event, columnId: string) => handleMutation(repository.deleteColumn.bind(repository))(columnId))
  ipcMain.handle('widgets:create', (_event, input: CreateWidgetInput) => handleMutation(repository.createWidget.bind(repository))(input))
  ipcMain.handle('widgets:update', (_event, input: UpdateWidgetInput) => handleMutation(repository.updateWidget.bind(repository))(input))
  ipcMain.handle('widgets:delete', (_event, widgetId: string) => handleMutation(repository.deleteWidget.bind(repository))(widgetId))
  ipcMain.handle('archive:list', (_event, filters) => repository.listArchive(filters))
  ipcMain.handle('app:openExternalUrl', async (_event, url: string) => {
    const parsed = new URL(url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('Unsupported URL protocol.')
    await shell.openExternal(parsed.toString())
  })
}

app.whenReady().then(() => {
  const client = createDbClient(app.getPath('userData'))
  migrate(client)
  repository = new LifePlanRepository(client)
  repository.seedIfEmpty()

  registerIpc()
  createAdminWindow()

  globalShortcut.register('CommandOrControl+Shift+D', () => {
    if (displayWindow) {
      displayWindow.focus()
    } else {
      createDisplayWindow()
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createAdminWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
