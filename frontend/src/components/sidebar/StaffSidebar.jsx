import { Link, useLocation } from "react-router-dom";
import styles from "./Sidebar.module.css";
import { Building2, LayoutDashboard, PlusCircle, Lock, SlidersHorizontal } from "lucide-react";

function StaffSidebar() {
    const location = useLocation();

    const menuItems = [
        { id: "dashboard", label: "Tổng quan", icon: LayoutDashboard, route: "/staff" },
        { id: "real-estate", label: "Bất động sản", icon: Building2, route: "/user/real-estate" },
        { id: "add-real-estate", label: "Thêm mới", icon: PlusCircle, route: "/user/add-real-estate" },
        { id: "property-valuation", label: "Thẩm định giá", icon: Search, route: "/staff/property-valuation"},
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

export default StaffSidebar;
