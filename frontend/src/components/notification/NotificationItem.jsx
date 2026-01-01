import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";
import styles from "./Notification.module.css";

function NotificationItem({ notification, onClose }) {
    const [isExiting, setIsExiting] = useState(false);
    const [progress, setProgress] = useState(100);

    useEffect(() => {
        if (notification.type === "success") {
            const startTime = Date.now();
            const duration = 5000;

            const interval = setInterval(() => {
                const elapsed = Date.now() - startTime;
                const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
                setProgress(remaining);

                if (remaining <= 0) {
                    clearInterval(interval);
                }
            }, 16);

            return () => clearInterval(interval);
        }
    }, [notification.type]);

    const handleClose = () => {
        setIsExiting(true);
        setTimeout(() => {
            onClose();
        }, 300);
    };

    const getIcon = () => {
        switch (notification.type) {
            case "success":
                return <CheckCircle2 className={styles.icon} />;
            case "error":
                return <XCircle className={styles.icon} />;
            case "warning":
                return <AlertTriangle className={styles.icon} />;
            case "info":
                return <Info className={styles.icon} />;
            default:
                return null;
        }
    };

    return (
        <div className={`${styles.notification} ${styles[notification.type]} ${isExiting ? styles.exiting : ""}`} onClick={handleClose}>
            <div className={styles.iconWrapper}>{getIcon()}</div>

            <div className={styles.content}>
                <div className={styles.title}>{notification.title}</div>
                {notification.message && (
                    <div className={styles.message}>{notification.message}</div>
                )}
            </div>

            <button className={styles.closeButton} onClick={handleClose}>
                <X className={styles.closeIcon} />
            </button>

            {notification.type === "success" && (
                <div className={styles.progressBar}>
                    <div
                        className={styles.progressFill}
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>
            )}
        </div>
    );
}

export default NotificationItem;
