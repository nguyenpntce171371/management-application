import { Link, useLocation } from "react-router-dom";
import styles from "./Sidebar.module.css";
import { Building2, LayoutDashboard, PlusCircle } from "lucide-react";

function UserSidebar() {
    const location = useLocation();

    const menuItems = [
        { id: "real-estate", label: "Bất động sản", icon: Building2, route: "/real-estates" },
        { id: "add-real-estate", label: "Thêm mới", icon: PlusCircle, route: "/real-estates/add" },
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

export default UserSidebar;