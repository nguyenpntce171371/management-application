import { createContext, useContext, useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance, { setAuthFailHandler } from "../services/axiosInstance";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();
    const isFetchingUser = useRef(false);
    const [lastPath, setLastPath] = useState(null);

    const handleAuthFail = () => {
        const currentPath = window.location.pathname + window.location.search;
        if (currentPath !== "/login") {
            setLastPath(currentPath);
        }
        setUser(null);
        navigate("/login", { replace: true });
    };

    useEffect(() => {
        setAuthFailHandler(() => handleAuthFail);
    }, []);

    useEffect(() => {
        const fetchUser = async () => {
            if (isFetchingUser.current) return;

            isFetchingUser.current = true;
            setIsLoading(true);

            try {
                const response = await axiosInstance.get("/api/user");
                setUser(response.data?.data || null);
            } catch {
                setUser(null);
            } finally {
                isFetchingUser.current = false;
                setIsLoading(false);
            }
        };

        if (!user) fetchUser();
    }, [user]);

    if (isLoading) {
        return (
            <div style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "100vh"
            }}>
                Loading...
            </div>
        );
    }
    return (
        <AuthContext.Provider value={{ user, setUser, isLoading, lastPath, setLastPath }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
    return ctx;
};