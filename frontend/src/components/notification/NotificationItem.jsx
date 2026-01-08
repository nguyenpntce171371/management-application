import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";
import styles from "./Notification.module.css";

function NotificationItem({ notification, onClose }) {
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        if (notification.type !== "success") return;
        const t = setTimeout(handleClose, 5000);
        return () => clearTimeout(t);
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
                <div className={styles.title}>{notification.title}{notification.count > 1 && <span className={styles.count}>{notification.count}</span>}</div>
                {notification.message && (
                    <div className={styles.message}>{notification.message}</div>
                )}
            </div>

            <button className={styles.closeButton} onClick={handleClose}>
                <X className={styles.closeIcon} />
            </button>

            {notification.type === "success" && (
                <div className={styles.progressBar}>
                    <div className={styles.progressFill} />
                </div>
            )}
        </div>
    );
}

export default NotificationItem;
