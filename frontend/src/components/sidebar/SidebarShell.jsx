import { Link } from "react-router-dom";
import styles from "./Sidebar.module.css";
import { Home, User } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

function SidebarShell({ children }) {
    const { user } = useAuth();

    return (
        <div className={styles.sidebarContent}>
            <Link to="/" className={styles.logo}>
                <div className={styles.logoIconWrapper}>
                    <Home className={styles.logoIcon} />
                </div>
                <div>
                    <h1 className={styles.logoTitle}>Name</h1>
                    <p className={styles.logoSubtitle}>SubName</p>
                </div>
            </Link>

            <nav className={styles.nav}>
                {children}
            </nav>

            {user && (
                <div className={styles.sidebarFooter}>
                    <Link to="/profile" className={styles.userCard}>
                        <div className={styles.userAvatar}>
                            <User size={40} color="#D4AF37" />
                        </div>
                        <div className={styles.userInfo}>
                            <p className={styles.userName}>Admin User</p>
                            <p className={styles.userRole}>Quản trị viên</p>
                        </div>
                    </Link>
                </div>
            )}
        </div>
    );
}

export default SidebarShell;
