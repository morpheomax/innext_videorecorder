import type { EditorClip } from '../../features/editor/types';
import type { StudioFormat } from '../compositor/stream-compositor';

const DB_NAME = 'studio-recorder-db';
const DB_VERSION = 1;
const RECORDINGS_STORE = 'recordings';
const PROJECTS_STORE = 'projects';
const PROJECT_ASSETS_STORE = 'project-assets';

export interface RecordingEntry {
  id: string;
  name: string;
  createdAt: string;
  durationMs: number;
  mimeType: string;
  sizeBytes: number;
  format?: StudioFormat;
  blob: Blob;
}

export interface RecordingMeta {
  id: string;
  name: string;
  createdAt: string;
  durationMs: number;
  mimeType: string;
  sizeBytes: number;
  format?: StudioFormat;
}

export interface ProjectAssetRecord {
  projectId: string;
  clipId: string;
  blob: Blob;
  name: string;
}

export interface ProjectRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  duration: number;
  format?: StudioFormat;
  clips: Array<Omit<EditorClip, 'url' | 'blob'>>;
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
  });
}

class StudioStorage {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private open() {
    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains(RECORDINGS_STORE)) {
          db.createObjectStore(RECORDINGS_STORE, { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
          db.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains(PROJECT_ASSETS_STORE)) {
          db.createObjectStore(PROJECT_ASSETS_STORE, { keyPath: ['projectId', 'clipId'] });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('No fue posible abrir IndexedDB.'));
    });

    return this.dbPromise;
  }

  async saveRecording(entry: RecordingEntry) {
    const db = await this.open();
    const transaction = db.transaction(RECORDINGS_STORE, 'readwrite');
    transaction.objectStore(RECORDINGS_STORE).put(entry);
    await transactionDone(transaction);
  }

  async listRecordings() {
    const db = await this.open();
    const transaction = db.transaction(RECORDINGS_STORE, 'readonly');
    const records = await requestToPromise(transaction.objectStore(RECORDINGS_STORE).getAll() as IDBRequest<RecordingEntry[]>);
    return records
      .map<RecordingMeta>((record) => ({
        id: record.id,
        name: record.name,
        createdAt: record.createdAt,
        durationMs: record.durationMs,
        mimeType: record.mimeType,
        sizeBytes: record.sizeBytes,
        format: record.format,
      }))
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }

  async getRecording(id: string) {
    const db = await this.open();
    const transaction = db.transaction(RECORDINGS_STORE, 'readonly');
    return await requestToPromise(transaction.objectStore(RECORDINGS_STORE).get(id) as IDBRequest<RecordingEntry | undefined>);
  }

  async deleteRecording(id: string) {
    const db = await this.open();
    const transaction = db.transaction(RECORDINGS_STORE, 'readwrite');
    transaction.objectStore(RECORDINGS_STORE).delete(id);
    await transactionDone(transaction);
  }

  async saveProject(record: ProjectRecord, assets: ProjectAssetRecord[]) {
    const db = await this.open();
    const transaction = db.transaction([PROJECTS_STORE, PROJECT_ASSETS_STORE], 'readwrite');
    const projectsStore = transaction.objectStore(PROJECTS_STORE);
    const assetsStore = transaction.objectStore(PROJECT_ASSETS_STORE);

    projectsStore.put(record);

    const existingAssets = await requestToPromise(
      assetsStore.getAll() as IDBRequest<ProjectAssetRecord[]>,
    );
    existingAssets
      .filter((asset) => asset.projectId === record.id)
      .forEach((asset) => assetsStore.delete([asset.projectId, asset.clipId]));

    assets.forEach((asset) => {
      assetsStore.put(asset);
    });

    await transactionDone(transaction);
  }

  async listProjects() {
    const db = await this.open();
    const transaction = db.transaction(PROJECTS_STORE, 'readonly');
    const projects = await requestToPromise(transaction.objectStore(PROJECTS_STORE).getAll() as IDBRequest<ProjectRecord[]>);
    return projects.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
  }

  async getProject(id: string) {
    const db = await this.open();
    const transaction = db.transaction([PROJECTS_STORE, PROJECT_ASSETS_STORE], 'readonly');
    const project = await requestToPromise(
      transaction.objectStore(PROJECTS_STORE).get(id) as IDBRequest<ProjectRecord | undefined>,
    );
    const assets = await requestToPromise(
      transaction.objectStore(PROJECT_ASSETS_STORE).getAll() as IDBRequest<ProjectAssetRecord[]>,
    );

    if (!project) {
      return null;
    }

    return {
      project,
      assets: assets.filter((asset) => asset.projectId === id),
    };
  }

  async deleteProject(id: string) {
    const db = await this.open();
    const transaction = db.transaction([PROJECTS_STORE, PROJECT_ASSETS_STORE], 'readwrite');
    transaction.objectStore(PROJECTS_STORE).delete(id);

    const assets = await requestToPromise(
      transaction.objectStore(PROJECT_ASSETS_STORE).getAll() as IDBRequest<ProjectAssetRecord[]>,
    );
    assets
      .filter((asset) => asset.projectId === id)
      .forEach((asset) => transaction.objectStore(PROJECT_ASSETS_STORE).delete([asset.projectId, asset.clipId]));

    await transactionDone(transaction);
  }

  async clearAll() {
    const db = await this.open();
    const transaction = db.transaction([RECORDINGS_STORE, PROJECTS_STORE, PROJECT_ASSETS_STORE], 'readwrite');
    transaction.objectStore(RECORDINGS_STORE).clear();
    transaction.objectStore(PROJECTS_STORE).clear();
    transaction.objectStore(PROJECT_ASSETS_STORE).clear();
    await transactionDone(transaction);
  }
}

export const studioStorage = new StudioStorage();
