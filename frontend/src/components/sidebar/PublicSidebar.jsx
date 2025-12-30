import { Link, useLocation } from "react-router-dom";
import styles from "./Sidebar.module.css";
import { LayoutDashboard, LogIn } from "lucide-react";

function PublicSidebar() {
    const location = useLocation();

    const menuItems = [
        { id: "dashboard", label: "Tổng quan", icon: LayoutDashboard, route: "/" },
        { id: "login", label: "Đăng nhập", icon: LogIn, route: "/login" },
    ];

    return (
        <nav className={styles.sidebarNav}>
            {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.route;

                return (
                    <Link key={item.id} to={item.route} className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}>
                        <Icon className={styles.navIcon} />
                        <span>{item.label}</span>
                    </Link>
                );
            })}
        </nav>
    );
}

export default PublicSidebar;
