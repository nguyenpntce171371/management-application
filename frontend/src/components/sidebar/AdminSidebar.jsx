import { Link, useLocation } from "react-router-dom";
import styles from "./Sidebar.module.css";
import { Building2, Logs, PlusCircle, Users, Search, DatabaseBackup, Trash } from "lucide-react";

function AdminSidebar() {
    const location = useLocation();

    const menuItems = [
        { id: "real-estate", label: "Bất động sản", icon: Building2, route: "/real-estates" },
        { id: "add-real-estate", label: "Thêm mới", icon: PlusCircle, route: "/real-estates/add" },
        { id: "property-valuation", label: "Thẩm định giá", icon: Search, route: "/appraisals" },
        { id: "users", label: "Thành viên", icon: Users, route: "/users" },
        { id: "log", label: "Log", icon: Logs, route: "/logs" },
        { id: "backup", label: "Backup", icon: DatabaseBackup, route: "/backups" },
        { id: "trash", label: "Thùng rác", icon: Trash, route: "/trashs"}
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

export default AdminSidebar;
