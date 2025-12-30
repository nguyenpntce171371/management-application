import { Role } from "../../config/role.js";
import styles from "./User.module.css";
import {
    Eye,
    Trash2,
    Mail,
    Phone,
    MapPin
} from "lucide-react";

function UserCard({ user }) {
    const getRoleInfo = (role) => {
        if (!role) return Role.GUEST;

        const key = String(role).trim().toUpperCase();
        return Role[key] || Role.GUEST;
    };

    const roleInfo = getRoleInfo(user.role);

    return (
        <div className={styles.userCard}>
            <div className={styles.userCardBody}>
                <div className={styles.userMeta}>
                    <span className={`${styles.rolebadge} ${styles[`role${roleInfo.class.charAt(0).toUpperCase() + roleInfo.class.slice(1)}`]}`}>
                        {roleInfo.label}
                    </span>
                </div>

                <h3 className={styles.userCardName}>{user.name}</h3>
                <div className={styles.userContact}>
                    <div className={styles.contactItem}>
                        <Mail className={styles.contactIcon} />
                        <span>{user.email}</span>
                    </div>
                    <div className={styles.contactItem}>
                        <Phone className={styles.contactIcon} />
                        <span>{user.phone}</span>
                    </div>
                    <div className={styles.contactItem}>
                        <MapPin className={styles.contactIcon} />
                        <span>{user.location}</span>
                    </div>
                </div>
                <div className={styles.userCardFooter}>
                    <div className={styles.userActions}>
                        <button className={styles.actionBtn} title="Xem chi tiết">
                            <Eye />
                        </button>
                        <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} title="Xóa">
                            <Trash2 />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default UserCard;