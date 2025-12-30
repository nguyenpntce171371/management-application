import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Role } from "../config/role";

export default function ProtectedRoute({ role, children }) {
    const { user, setLastPath } = useAuth();

    if (!user) {
        setLastPath(location.pathname + location.search);
        return <Navigate to="/login" replace />;
    }

    if (role) {
        const userRoleKey = (user.role || "").toUpperCase();
        const requiredRoleKey = role.toUpperCase();

        const userRole = Role[userRoleKey];
        const needRole = Role[requiredRoleKey];

        if (!userRole || !needRole || userRole.value < needRole.value) {
            return <Navigate to="/403" replace />;
        }
    }

    return children;
}