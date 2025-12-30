import { Mail, Monitor, Smartphone, AlertTriangle, LogOut, Trash2, Clock } from "lucide-react";
import styles from "./Profile.module.css";
import axiosInstance from "../../services/axiosInstance";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";

function Profile() {
    const { user, setUser } = useAuth();
    const [sessions, setSessions] = useState([]);

    useEffect(() => {
        axiosInstance.get("/api/auth/sessions").then(response => setSessions(response.data.data))
    }, []);

    const handleLogout = async () => {
        await axiosInstance.post("/api/auth/logout");
        setUser(null);
    };

    const handleLogoutAllDevices = async () => {
        if (!confirm("Bạn có chắc muốn đăng xuất khỏi tất cả thiết bị?")) {
            return;
        }
        await axiosInstance.post("/api/auth/logout-all-device");
        setUser(null);
    };

    const handleLogoutSession = async (sessionId) => {
        const response = await axiosInstance.post("/api/auth/logout-sessions", {
            sessionId
        });
        if (response.data.success) {
            setSessions(sessions.filter(s => s.id !== sessionId));
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMins < 1) return "Vừa xong";
        if (diffMins < 60) return `${diffMins} phút trước`;
        if (diffHours < 24) return `${diffHours} giờ trước`;
        if (diffDays < 7) return `${diffDays} ngày trước`;

        return date.toLocaleDateString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    };

    const parseUserAgent = (userAgent = "") => {
        userAgent = userAgent.toLowerCase();

        let browser = "Unknown Browser";
        let os = "Unknown OS";

        if (userAgent.includes("chrome")) {
            const version = userAgent.match(/chrome\/([\d.]+)/)?.[1]?.split(".")[0];
            browser = `Chrome ${version}`;
        } else if (userAgent.includes("firefox")) {
            const version = userAgent.match(/firefox\/([\d.]+)/)?.[1]?.split(".")[0];
            browser = `Firefox ${version}`;
        } else if (userAgent.includes("safari") && !userAgent.includes("chrome")) {
            const version = userAgent.match(/version\/([\d.]+)/)?.[1]?.split(".")[0];
            browser = `Safari ${version}`;
        } else if (userAgent.includes("edg")) {
            const version = userAgent.match(/edg\/([\d.]+)/)?.[1]?.split(".")[0];
            browser = `Edge ${version}`;
        }

        if (userAgent.includes("windows nt 10")) os = "Windows 10";
        else if (userAgent.includes("windows nt 6.1")) os = "Windows 7";
        else if (userAgent.includes("mac os x")) os = "macOS";
        else if (userAgent.includes("android")) os = "Android";
        else if (userAgent.includes("iphone")) os = "iOS";

        return `${browser} · ${os}`;
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.headerBackground}></div>
                <div className={styles.headerContent}>
                    <div className={styles.avatarSection}>
                        <div className={styles.avatarWrapper}>
                            <div className={styles.avatar} />
                        </div>
                        <div className={styles.userInfo}>
                            <h1 className={styles.userName}>{user?.fullName}</h1>
                            <div className={styles.userRole}>{user?.role}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className={styles.content}>
                <div className={styles.mainContent}>
                    <div className={styles.infoCard}>
                        <div className={styles.cardHeader}>
                            <h2 className={styles.cardTitle}>Thông Tin Cá Nhân</h2>
                        </div>
                        <div className={styles.cardContent}>
                            <div className={styles.infoRow}>
                                <div className={styles.infoLabel}>
                                    <Mail className={styles.infoIcon} />
                                    Email
                                </div>
                                <div className={styles.infoValue}>{user?.email}</div>
                            </div>
                        </div>
                    </div>

                    <div className={styles.infoCard}>
                        <div className={styles.cardHeader}>
                            <div className={styles.cardHeaderRow}>
                                <h2 className={styles.cardTitle}>Quản Lý Phiên Đăng Nhập</h2>
                                <button className={styles.logoutAllButton} onClick={handleLogoutAllDevices}>
                                    <LogOut className={styles.buttonIcon} />
                                    Đăng xuất tất cả thiết bị
                                </button>
                            </div>
                        </div>
                        <div className={styles.cardContent}>
                            <div className={styles.sessionsList}>
                                {sessions.map(session => (
                                    <div key={session.id} className={`${styles.sessionItem} ${session.isCurrent ? styles.sessionCurrent : ""}`}>
                                        <div className={styles.sessionInfo}>
                                            <div className={styles.sessionHeader}>
                                                <div className={styles.sessionName}>
                                                    {parseUserAgent(session.deviceName)}
                                                    {session.isCurrent && (
                                                        <span className={styles.currentBadge}>
                                                            Hiện tại
                                                        </span>
                                                    )}
                                                </div>
                                                {!session.isCurrent && (
                                                    <button className={styles.sessionLogoutButton} onClick={() => handleLogoutSession(session.id)}>
                                                        <Trash2 className={styles.buttonIcon} />
                                                        Đăng xuất
                                                    </button>
                                                )}
                                            </div>
                                            <div className={styles.sessionDetails}>
                                                <div className={styles.sessionDetail}>
                                                    <span className={styles.sessionDetailLabel}>IP:</span>
                                                    <span className={styles.sessionDetailValue}>{session.ipAddress}</span>
                                                </div>
                                                <div className={styles.sessionDetail}>
                                                    <Clock className={styles.clockIcon} />
                                                    <span className={styles.sessionDetailValue}>
                                                        {formatDate(session.createdAt)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className={styles.logout}>
                <button className={styles.logoutText} onClick={handleLogout}>
                    Đăng xuất
                </button>
            </div>
        </div>
    );
}

export default Profile;
