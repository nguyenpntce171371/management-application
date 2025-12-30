const DB_NAME = 'PropertyAppraisalDB';
const DB_VERSION = 2;
const STORE_NAME = 'appraisalProperties';
const CW_STORE = 'constructionWorks';

class IndexedDBService {
    constructor() {
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);

            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    objectStore.createIndex('createdAt', 'createdAt', { unique: false });
                }

                if (!db.objectStoreNames.contains(CW_STORE)) {
                    const cwStore = db.createObjectStore(CW_STORE, { keyPath: 'id' });
                    cwStore.createIndex('createdAt', 'createdAt', { unique: false });
                    cwStore.createIndex('appraisalId', 'appraisalId', { unique: false });
                }
            };
        });
    }

    async saveProperty(property) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([STORE_NAME], 'readwrite');
            const store = tx.objectStore(STORE_NAME);

            property.updatedAt = new Date().toISOString();
            if (!property.createdAt) property.createdAt = property.updatedAt;

            const req = store.put(property);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    async getAllProperties() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([STORE_NAME], 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.getAll();

            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async getPropertyById(id) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([STORE_NAME], 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.get(id);

            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    }

    async deleteProperty(id) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([STORE_NAME], 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.delete(id);

            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    async clearAll() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([STORE_NAME], 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.clear();

            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    async deletePropertiesByAppraisalId(appraisalId) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([STORE_NAME], 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const index = store.index('appraisalId');
            const req = index.openCursor(IDBKeyRange.only(appraisalId));

            req.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                } else {
                    resolve();
                }
            };

            req.onerror = () => reject(req.error);
        });
    }

    async saveConstructionWork(work) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([CW_STORE], 'readwrite');
            const store = tx.objectStore(CW_STORE);

            work.updatedAt = new Date().toISOString();
            if (!work.createdAt) work.createdAt = work.updatedAt;

            const req = store.put(work);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    async getAllConstructionWorks() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([CW_STORE], 'readonly');
            const store = tx.objectStore(CW_STORE);
            const req = store.getAll();

            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async getConstructionWorkById(id) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([CW_STORE], 'readonly');
            const store = tx.objectStore(CW_STORE);
            const req = store.get(id);

            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    }

    async deleteConstructionWork(id) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([CW_STORE], 'readwrite');
            const store = tx.objectStore(CW_STORE);
            const req = store.delete(id);

            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    async clearAllConstructionWorks() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([CW_STORE], 'readwrite');
            const store = tx.objectStore(CW_STORE);
            const req = store.clear();

            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    async getConstructionWorksByAppraisal(appraisalId) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([CW_STORE], 'readonly');
            const store = tx.objectStore(CW_STORE);
            const index = store.index('appraisalId');

            const req = index.getAll(appraisalId);
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    }

    async deleteConstructionWorksByAppraisalId(appraisalId) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([CW_STORE], 'readwrite');
            const store = tx.objectStore(CW_STORE);
            const index = store.index('appraisalId');
            const req = index.openCursor(IDBKeyRange.only(appraisalId));

            req.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                } else {
                    resolve();
                }
            };

            req.onerror = () => reject(req.error);
        });
    }
}

export const indexedDBService = new IndexedDBService();