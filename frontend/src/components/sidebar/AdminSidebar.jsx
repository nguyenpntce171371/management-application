import { Link, useLocation } from "react-router-dom";
import styles from "./Sidebar.module.css";
import { Building2, LayoutDashboard, Logs, PlusCircle, Users, Lock, SlidersHorizontal, Search } from "lucide-react";

function AdminSidebar() {
    const location = useLocation();

    const menuItems = [
        { id: "dashboard", label: "Tổng quan", icon: LayoutDashboard, route: "/admin" },
        { id: "add-real-estate", label: "Thêm mới", icon: PlusCircle, route: "/user/add-real-estate" },
        { id: "real-estate", label: "Bất động sản", icon: Building2, route: "/staff/real-estate" },
        { id: "property-valuation", label: "Thẩm định giá", icon: Search, route: "/staff/property-valuation"},
        { id: "users", label: "Thành viên", icon: Users, route: "/admin/user-management" },
        { id: "log", label: "Log", icon: Logs, route: "/admin/log" },
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
