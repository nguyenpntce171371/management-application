import { Link, useLocation } from "react-router-dom";
import styles from "./Sidebar.module.css";
import { LayoutDashboard, PlusCircle } from "lucide-react";

function UserSidebar() {
    const location = useLocation();

    const menuItems = [
        { id: "dashboard", label: "Tổng quan", icon: LayoutDashboard, route: "/" },
        { id: "real-estate", label: "Bất động sản", icon: Building2, route: "/user/real-estate" },
        { id: "add-real-estate", label: "Thêm mới", icon: PlusCircle, route: "/user/add-real-estate" },
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