import { useAuth } from "../../context/AuthContext";
import AdminSidebar from "./AdminSidebar";
import PublicSidebar from "./PublicSidebar";
import SidebarShell from "./SidebarShell";
import StaffSidebar from "./StaffSidebar";
import UserSidebar from "./UserSideBar";

function Sidebar() {
    const { user } = useAuth();

    let Menu;
    if (!user) Menu = PublicSidebar;
    else if (user.role === "Admin") Menu = AdminSidebar;
    else if (user.role === "Staff") Menu = StaffSidebar;
    else Menu = UserSidebar;

    return (
        <SidebarShell>
            <Menu />
        </SidebarShell>
    );
}

export default Sidebar;