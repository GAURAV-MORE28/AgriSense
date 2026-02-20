/**
 * Offline Context - Manages offline state and sync queue
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface KrishiDB extends DBSchema {
  profiles: {
    key: string;
    value: {
      id: string;
      data: unknown;
      synced: boolean;
      updatedAt: string;
    };
  };
  applications: {
    key: string;
    value: {
      id: string;
      data: unknown;
      synced: boolean;
      createdAt: string;
    };
  };
  syncQueue: {
    key: string;
    value: {
      id: string;
      type: 'profile' | 'application';
      operation: 'create' | 'update';
      data: unknown;
      createdAt: string;
    };
  };
}

interface OfflineContextType {
  isOffline: boolean;
  queuedCount: number;
  saveProfile: (id: string, data: unknown) => Promise<void>;
  saveApplication: (id: string, data: unknown) => Promise<void>;
  getProfile: (id: string) => Promise<unknown | null>;
  syncPending: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

let db: IDBPDatabase<KrishiDB> | null = null;

async function getDB(): Promise<IDBPDatabase<KrishiDB>> {
  if (db) return db;

  db = await openDB<KrishiDB>('krishi-ai-db', 1, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('profiles')) {
        database.createObjectStore('profiles', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('applications')) {
        database.createObjectStore('applications', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('syncQueue')) {
        database.createObjectStore('syncQueue', { keyPath: 'id' });
      }
    }
  });

  return db;
}

export const OfflineProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [queuedCount, setQueuedCount] = useState(0);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Update queued count
    updateQueuedCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const updateQueuedCount = async () => {
    try {
      const database = await getDB();
      const count = await database.count('syncQueue');
      setQueuedCount(count);
    } catch (e) {
      console.error('Failed to get queue count');
    }
  };

  const saveProfile = async (id: string, data: unknown) => {
    const database = await getDB();
    await database.put('profiles', {
      id,
      data,
      synced: !isOffline,
      updatedAt: new Date().toISOString()
    });

    if (isOffline) {
      await database.put('syncQueue', {
        id: `profile-${id}-${Date.now()}`,
        type: 'profile',
        operation: 'update',
        data,
        createdAt: new Date().toISOString()
      });
      updateQueuedCount();
    }
  };

  const saveApplication = async (id: string, data: unknown) => {
    const database = await getDB();
    await database.put('applications', {
      id,
      data,
      synced: !isOffline,
      createdAt: new Date().toISOString()
    });

    if (isOffline) {
      await database.put('syncQueue', {
        id: `app-${id}-${Date.now()}`,
        type: 'application',
        operation: 'create',
        data,
        createdAt: new Date().toISOString()
      });
      updateQueuedCount();
    }
  };

  const getProfile = async (id: string): Promise<unknown | null> => {
    const database = await getDB();
    const result = await database.get('profiles', id);
    return result?.data || null;
  };

  const syncPending = async () => {
    if (isOffline) return;

    const database = await getDB();
    const queue = await database.getAll('syncQueue');
    const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api/v1';
    const token = localStorage.getItem('krishi-token');

    for (const item of queue) {
      try {
        if (item.type === 'profile' && token) {
          const res = await fetch(`${API_URL}/profile`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify((item.data as any)?.data || item.data)
          });
          if (res.ok) await database.delete('syncQueue', item.id);
        } else if (item.type === 'application' && token) {
          const appData = (item.data as any)?.data || item.data;
          const res = await fetch(`${API_URL}/application/submit`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(appData)
          });
          if (res.ok) await database.delete('syncQueue', item.id);
        }
      } catch (error) {
        console.error('Sync failed for item:', item.id, error);
      }
    }

    updateQueuedCount();
  };

  // Auto-sync when coming back online
  useEffect(() => {
    if (!isOffline) {
      syncPending();
    }
  }, [isOffline]);

  return (
    <OfflineContext.Provider value={{
      isOffline,
      queuedCount,
      saveProfile,
      saveApplication,
      getProfile,
      syncPending
    }}>
      {children}
    </OfflineContext.Provider>
  );
};

export const useOffline = () => {
  const context = useContext(OfflineContext);
  if (context === undefined) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
};
