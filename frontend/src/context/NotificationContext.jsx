import { createContext, useContext, useState, useCallback } from "react";

const NotificationContext = createContext(undefined);

let addNotificationRef = null;

export function NotificationProvider({ children }) {
    const [notifications, setNotifications] = useState([]);

    const removeNotification = useCallback((id) => {
        setNotifications((prev) => prev.filter((notif) => notif.id !== id));
    }, []);

    const addNotification = useCallback((notification) => {
        const id = Math.random().toString(36).substring(2, 9);
        const newNotification = { ...notification, id };

        setNotifications((prev) => [...prev, newNotification]);

        setTimeout(() => {
            removeNotification(id);
        }, 5000);
    }, [removeNotification]);

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
