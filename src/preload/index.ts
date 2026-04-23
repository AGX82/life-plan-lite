import { contextBridge, ipcRenderer } from 'electron'
import type {
  CloseItemInput,
  CreateColumnInput,
  CreateBoardInput,
  CreateGroupInput,
  CreateItemInput,
  CreateListInput,
  LplApi,
  MoveListInput,
  UpdateBoardInput,
  UpdateColumnInput,
  UpdateGroupInput,
  UpdateItemInput,
  UpdateListInput
} from '../shared/domain'

const api: LplApi = {
  listBoards: () => ipcRenderer.invoke('boards:list'),
  getActiveBoardSnapshot: (mode = 'admin') => ipcRenderer.invoke('boards:activeSnapshot', mode),
  getBoardSnapshot: (boardId: string, mode = 'admin') => ipcRenderer.invoke('boards:snapshot', boardId, mode),
  setActiveBoard: (boardId: string) => ipcRenderer.invoke('boards:setActive', boardId),
  closeApp: () => ipcRenderer.invoke('app:close'),
  requestAdminMode: () => ipcRenderer.invoke('app:requestAdminMode'),
  getDisplayState: () => ipcRenderer.invoke('display:state'),
  getAppSettings: () => ipcRenderer.invoke('appSettings:get'),
  updateAppSettings: (settings) => ipcRenderer.invoke('appSettings:update', settings),
  openDisplayWindow: () => ipcRenderer.invoke('display:open'),
  hideDisplayWindow: () => ipcRenderer.invoke('display:hide'),
  setDisplayTarget: (displayId: string) => ipcRenderer.invoke('display:setTarget', displayId),
  publishItem: (itemId: string) => ipcRenderer.invoke('items:publish', itemId),
  publishList: (listId: string) => ipcRenderer.invoke('items:publishList', listId),
  publishBoard: (boardId: string) => ipcRenderer.invoke('items:publishBoard', boardId),
  completeItem: (itemId: string) => ipcRenderer.invoke('items:complete', itemId),
  closeItem: (input: CloseItemInput) => ipcRenderer.invoke('items:close', input),
  createItem: (input: CreateItemInput) => ipcRenderer.invoke('items:create', input),
  updateItem: (input: UpdateItemInput) => ipcRenderer.invoke('items:update', input),
  deleteItem: (itemId: string) => ipcRenderer.invoke('items:delete', itemId),
  createBoard: (input: CreateBoardInput) => ipcRenderer.invoke('boards:create', input),
  updateBoard: (input: UpdateBoardInput) => ipcRenderer.invoke('boards:update', input),
  createList: (input: CreateListInput) => ipcRenderer.invoke('lists:create', input),
  updateList: (input: UpdateListInput) => ipcRenderer.invoke('lists:update', input),
  deleteList: (listId: string) => ipcRenderer.invoke('lists:delete', listId),
  moveListToBoard: (input: MoveListInput) => ipcRenderer.invoke('lists:moveToBoard', input),
  copyListToBoard: (input: MoveListInput) => ipcRenderer.invoke('lists:copyToBoard', input),
  createGroup: (input: CreateGroupInput) => ipcRenderer.invoke('groups:create', input),
  updateGroup: (input: UpdateGroupInput) => ipcRenderer.invoke('groups:update', input),
  deleteGroup: (groupId: string) => ipcRenderer.invoke('groups:delete', groupId),
  createColumn: (input: CreateColumnInput) => ipcRenderer.invoke('columns:create', input),
  updateColumn: (input: UpdateColumnInput) => ipcRenderer.invoke('columns:update', input),
  deleteColumn: (columnId: string) => ipcRenderer.invoke('columns:delete', columnId),
  listArchive: (filters) => ipcRenderer.invoke('archive:list', filters),
  openExternalUrl: (url: string) => ipcRenderer.invoke('app:openExternalUrl', url),
  onDataChanged: (callback) => {
    const listener = (): void => callback()
    ipcRenderer.on('data:changed', listener)
    return () => ipcRenderer.removeListener('data:changed', listener)
  }
}

contextBridge.exposeInMainWorld('lpl', api)
