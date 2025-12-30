import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function GuestRoute({ children }) {
    const { user } = useAuth();

    if (user) {
        const role = (user.role || "").toLowerCase();
        if (role === "admin") return <Navigate to="/admin" replace />;
        if (role === "staff") return <Navigate to="/staff" replace />;
        return <Navigate to="/" replace />;
    }

    return children;
}
