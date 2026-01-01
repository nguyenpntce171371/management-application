import { useNotification } from "../../context/NotificationContext";
import NotificationItem from "./NotificationItem";
import styles from "./Notification.module.css";

function NotificationContainer() {
    const { notifications, removeNotification } = useNotification();

    return (
        <div className={styles.container}>
            {notifications.map((notification) => (
                <NotificationItem key={notification.id} notification={notification} onClose={() => removeNotification(notification.id)} />
            ))}
        </div>
    );
}

export default NotificationContainer;
