import { createContext, useContext, useState, useCallback } from "react";

const NotificationContext = createContext(undefined);

let addNotificationRef = null;

export function NotificationProvider({ children }) {
    const [notifications, setNotifications] = useState([]);

    const removeNotification = useCallback((id) => {
        setNotifications((prev) => prev.filter((notif) => notif.id !== id));
    }, []);

    const addNotification = useCallback((notification) => {
        setNotifications((prev) => {
            const index = prev.findIndex(
                n => n.title === notification.title &&
                     n.message === notification.message &&
                     n.type === notification.type
            );

            if (index !== -1) {
                const updated = [...prev];
                updated[index] = {
                    ...updated[index],
                    count: (updated[index].count || 1) + 1
                };
                return updated;
            }
            const id = Math.random().toString(36).substring(2, 9);
            return [...prev, { ...notification, id, count: 1 }];
        });
    }, []);

    addNotificationRef = addNotification;

    return (
        <NotificationContext.Provider value={{ notifications, addNotification, removeNotification }}>
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotification() {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error("useNotification must be used within a NotificationProvider");
    }
    return context;
}

export function notify(notification) {
    if (addNotificationRef) {
        addNotificationRef(notification);
    }
}
