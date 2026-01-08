import { useState, useRef, useEffect } from "react";
import { LogOut, Trash2, Clock } from "lucide-react";
import styles from "./Profile.module.css";
import axiosInstance from "../../services/axiosInstance";
import { notify } from "../../context/NotificationContext";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";

export default function Profile() {
    const socket = useSocket();
    const [activeTab, setActiveTab] = useState("info");
    const [deleteConfirm, setDeleteConfirm] = useState("");
    const [isEditingInfo, setIsEditingInfo] = useState(false);
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [tabIndicator, setTabIndicator] = useState({ left: 0, width: 0 });
    const tabRefs = useRef({});
    const [sessions, setSessions] = useState([]);
    const { user, setUser } = useAuth();
    const fileInputRef = useRef(null);
    const [avatarFile, setAvatarFile] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState(null);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const [formData, setFormData] = useState({
        fullName: "",
        email: "",
        address: "",
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
    });

    useEffect(() => {
        if (!user) return;
        setFormData(prev => ({
            ...prev,
            fullName: user.fullName || "",
            email: user.email || "",
            address: user.address || "",
        }));
    }, [user]);

    useEffect(() => {
        axiosInstance.get("/api/auth/sessions").then(res => setSessions(res.data.data));
    }, []);

    useEffect(() => {
        if (!socket || !user) return;
        const handleLoggedInElsewhere = (data) => {
            if (data._id) {
                axiosInstance.get("/api/auth/sessions").then(res => {
                    setSessions(res.data.data);
                });
            }
        };

        const handleSessionLoggedOut = (data) => {
            if (data.sessionId) {
                setSessions(prev => prev.filter(s => s.id !== data.sessionId));
            }
        };

        const handleProfileUpdated = (data) => {
            setUser(data);
            setFormData(prev => ({
                ...prev,
                fullName: data.fullName || "",
                email: data.email || "",
                address: data.address || "",
            }));
        };

        socket.on("loggedInElsewhere", handleLoggedInElsewhere);
        socket.on("sessionLoggedOut", handleSessionLoggedOut);
        socket.on("profileUpdated", handleProfileUpdated);

        return () => {
            socket.off("loggedInElsewhere", handleLoggedInElsewhere);
            socket.off("sessionLoggedOut", handleSessionLoggedOut);
            socket.off("profileUpdated", handleProfileUpdated);
        };
    }, [socket, user, sessions, setUser]);

    useEffect(() => {
        const activeTabElement = tabRefs.current[activeTab];
        if (activeTabElement) {
            setTabIndicator({
                left: activeTabElement.offsetLeft,
                width: activeTabElement.offsetWidth,
            });
        }
    }, [activeTab]);

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const diff = Date.now() - date.getTime();
        const mins = Math.floor(diff / 60000);
        const hours = Math.floor(mins / 60);
        const days = Math.floor(hours / 24);

        if (mins < 1) return "Vừa xong";
        if (mins < 60) return `${mins} phút trước`;
        if (hours < 24) return `${hours} giờ trước`;
        if (days < 7) return `${days} ngày trước`;

        return date.toLocaleString("vi-VN");
    };

    const parseUserAgent = (ua = "") => {
        ua = ua.toLowerCase();
        let browser = "Trình duyệt";
        let os = "Hệ điều hành";

        if (ua.includes("chrome")) browser = "Chrome";
        else if (ua.includes("firefox")) browser = "Firefox";
        else if (ua.includes("safari") && !ua.includes("chrome")) browser = "Safari";
        else if (ua.includes("edg")) browser = "Edge";

        if (ua.includes("windows")) os = "Windows";
        else if (ua.includes("mac")) os = "macOS";
        else if (ua.includes("android")) os = "Android";
        else if (ua.includes("iphone")) os = "iOS";

        return `${browser} · ${os}`;
    };

    const handleSelectAvatar = () => {
        fileInputRef.current?.click();
    };

    const handleAvatarChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            notify({
                type: "error",
                title: "Lỗi",
                message: "Vui lòng chọn file hình ảnh",
            });
            return;
        }

        setAvatarFile(file);

        const reader = new FileReader();
        reader.onloadend = () => {
            setAvatarPreview(reader.result);
        };
        reader.readAsDataURL(file);
    };

    const handleUploadAvatar = async () => {
        if (!avatarFile) return;

        try {
            setIsUploadingAvatar(true);
            const formData = new FormData();
            formData.append("avatar", avatarFile);

            const res = await axiosInstance.post("/api/user", formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });

            setUser(res.data.data);
            setAvatarFile(null);
            setAvatarPreview(null);

            notify({
                type: "success",
                title: "Thành công",
                message: "Cập nhật ảnh đại diện thành công",
            });
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    const handleCancelAvatar = () => {
        setAvatarFile(null);
        setAvatarPreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleDeleteAvatar = async () => {
        try {
            setIsUploadingAvatar(true);
            const res = await axiosInstance.delete("/api/user/avatar");
            setUser(res.data.data);
            setAvatarFile(null);
            setAvatarPreview(null);
            notify({
                type: "success",
                title: "Thành công",
                message: "Đã xóa ảnh đại diện",
            });
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    const handleLogoutAllDevices = async () => {
        if (!confirm("Bạn có chắc muốn đăng xuất khỏi tất cả thiết bị?")) return;
        await axiosInstance.post("/api/auth/logout-all-device");
        setUser(null);
    };

    const handleLogoutSession = async (sessionId) => {
        const res = await axiosInstance.post("/api/auth/logout-sessions", { sessionId });
        if (res.data.success) {
            setSessions(prev => prev.filter(s => s.id !== sessionId));
        }
    };

    const handleLogout = async () => {
        await axiosInstance.post("/api/auth/logout");
        setUser(null);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleEditInfo = () => {
        setIsEditingInfo(true);
    };

    const handleSaveInfo = async () => {
        if (!user) return;
        if (formData.fullName !== (user.fullName || "") || formData.address !== (user.address || "")) {
            try {
                const res = await axiosInstance.post("/api/user", {
                    fullName: formData.fullName,
                    address: formData.address,
                });
                setUser(res.data.data);
                notify({
                    type: "success",
                    title: "Thành công",
                    message: "Cập nhật thông tin thành công",
                });
            } catch (error) {
                notify({
                    type: "error",
                    title: "Lỗi",
                    message: error.response?.data?.message || "Không thể cập nhật thông tin",
                });
            }
        }
        setIsEditingInfo(false);
    };

    const handleCancelEdit = () => {
        setFormData({
            fullName: user.fullName || "",
            email: user.email || "",
            address: user.address || "",
        });
        setIsEditingInfo(false);
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (user.provider !== "local" && !formData.currentPassword) {
            notify({
                type: "error",
                title: "Thiếu thông tin",
                message: "Vui lòng nhập mật khẩu hiện tại!",
            });
            return;
        }
        if (formData.newPassword !== formData.confirmPassword) {
            notify({
                type: "error",
                title: "Sai thông tin",
                message: "Mật khẩu xác nhận không khớp!",
            });
            return;
        }
        await axiosInstance.post("/api/password/change-password", {
            email: user.email,
            oldPassword: formData.currentPassword,
            newPassword: formData.newPassword,
            confirm: formData.confirmPassword
        });
        notify({
            type: "success",
            title: "Thành công",
            message: "Mật khẩu đã được thay đổi!",
        });
        setShowPasswordForm(false);
        setFormData(prev => ({
            ...prev,
            currentPassword: "",
            newPassword: "",
            confirmPassword: "",
        }));
    };

    const handleDeleteAccount = () => {
        if (deleteConfirm !== user.email) {
            notify({
                type: "error",
                title: "Lỗi",
                message: "Vui lòng nhập đúng email để xác nhận xóa tài khoản",
            });
            return;
        }
        notify({
            type: "success",
            title: "Thành công",
            message: "Tài khoản đã được đánh dấu để xóa. Thao tác này sẽ hoàn tất trong 30 ngày.",
        });
        setDeleteConfirm("");
    };

    const tabs = [
        { id: "info", label: "Thông tin" },
        { id: "security", label: "Bảo mật" },
        { id: "sessions", label: "Quản lý Session" },
        { id: "delete", label: "Xóa tài khoản" },
    ];

    const displayAvatar = avatarPreview || user?.avatar;

    return (
        <div className={styles.container}>
            <div className={styles.tabs}>
                {tabs.map(tab => (
                    <button key={tab.id} ref={el => tabRefs.current[tab.id] = el} onClick={() => setActiveTab(tab.id)} className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ""}`}>
                        {tab.label}
                    </button>
                ))}
                <div className={styles.tabIndicator} style={{ left: `${tabIndicator.left}px`, width: `${tabIndicator.width}px` }} />
            </div>

            {activeTab === "info" &&
                <div className={styles.content}>
                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>Ảnh đại diện</h3>
                        <div className={styles.avatarSection}>
                            <div className={styles.avatar}>
                                {displayAvatar ? (
                                    <img src={displayAvatar} alt="Avatar" className={styles.avatarImage} />
                                ) : (
                                    formData.fullName.charAt(0).toUpperCase()
                                )}
                            </div>
                            <div className={styles.avatarActions}>
                                <button type="button" onClick={handleSelectAvatar} className={`${styles.button} ${styles.buttonSecondary} ${styles.buttonSmall}`} disabled={isUploadingAvatar}>
                                    {avatarFile ? "Chọn ảnh khác" : "Tải ảnh lên"}
                                </button>
                                <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleAvatarChange} />
                                {avatarFile && (
                                    <>
                                        <button type="button" onClick={handleUploadAvatar} disabled={isUploadingAvatar} className={`${styles.button} ${styles.buttonPrimary} ${styles.buttonSmall}`}>
                                            {isUploadingAvatar ? "Đang tải..." : "Lưu"}
                                        </button>
                                        <button type="button" onClick={handleCancelAvatar} disabled={isUploadingAvatar} className={`${styles.button} ${styles.buttonSecondary} ${styles.buttonSmall}`}>
                                            Hủy
                                        </button>
                                    </>
                                )}

                                {user?.avatar && !avatarFile && (
                                    <button type="button" onClick={handleDeleteAvatar} disabled={isUploadingAvatar} className={`${styles.button} ${styles.buttonSecondary} ${styles.buttonSmall}`}>
                                        Xóa
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>Thông tin cá nhân</h3>

                        <div className={styles.infoRow}>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Họ và tên</label>
                                <input type="text" name="fullName" value={formData.fullName} onChange={handleInputChange} className={styles.input} disabled={!isEditingInfo} />
                            </div>
                        </div>

                        <div className={styles.infoRow}>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Email</label>
                                <input type="email" name="email" value={formData.email} className={styles.input} disabled={true} />
                            </div>
                        </div>

                        <div className={styles.infoRow}>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Địa chỉ</label>
                                <input type="text" name="address" value={formData.address} onChange={handleInputChange} className={styles.input} disabled={!isEditingInfo} />
                            </div>
                        </div>

                        {!isEditingInfo ? (
                            <button onClick={handleEditInfo} className={`${styles.button} ${styles.buttonSecondary}`}>
                                Chỉnh sửa
                            </button>
                        ) : (
                            <div className={styles.buttonGroup}>
                                <button onClick={handleSaveInfo} className={`${styles.button} ${styles.buttonPrimary}`}>
                                    Lưu thay đổi
                                </button>
                                <button onClick={handleCancelEdit} className={`${styles.button} ${styles.buttonSecondary}`}>
                                    Hủy
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            }
            {activeTab === "security" &&
                <div className={styles.content}>
                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>Đổi mật khẩu</h3>

                        {!showPasswordForm ? (
                            <div className={styles.passwordToggle}>
                                <div className={styles.buttonGroup}>
                                    <button onClick={() => setShowPasswordForm(true)} className={`${styles.button} ${styles.buttonSecondary}`}>
                                        Thay đổi mật khẩu
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleChangePassword}>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Mật khẩu hiện tại</label>
                                    <input type="password" name="currentPassword" value={formData.currentPassword} onChange={handleInputChange} className={styles.input} required disabled={user.provider !== "local"} />
                                </div>

                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Mật khẩu mới</label>
                                    <input type="password" name="newPassword" value={formData.newPassword} onChange={handleInputChange} className={styles.input} required />
                                </div>

                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Xác nhận mật khẩu mới</label>
                                    <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleInputChange} className={styles.input} required />
                                </div>

                                <div className={styles.buttonGroup}>
                                    <button type="submit" className={`${styles.button} ${styles.buttonPrimary}`}>
                                        Cập nhật mật khẩu
                                    </button>
                                    <button type="button" onClick={() => setShowPasswordForm(false)} className={`${styles.button} ${styles.buttonSecondary}`}>
                                        Hủy
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            }
            {activeTab === "sessions" &&
                <div className={styles.content}>
                    <div className={styles.section}>
                        <div className={styles.cardHeaderRow}>
                            <h3 className={styles.sectionTitle}>Quản Lý Phiên Đăng Nhập</h3>
                            <button className={styles.logoutAllButton} onClick={handleLogoutAllDevices}>
                                <LogOut className={styles.buttonIcon} />
                                Đăng xuất tất cả thiết bị
                            </button>
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
                        <div className={styles.logout}>
                            <button className={styles.logoutAllButton} onClick={() => handleLogout()}>
                                Đăng xuất
                            </button>
                        </div>
                    </div>
                </div>
            }
            {activeTab === "delete" &&
                <div className={styles.content}>
                    <div className={styles.dangerZone}>
                        <h3 className={styles.dangerTitle}>Xóa tài khoản</h3>
                        <p className={styles.dangerText}>
                            Hành động này sẽ xóa vĩnh viễn tài khoản của bạn và tất cả dữ liệu liên quan.
                        </p>

                        <div className={styles.confirmGroup}>
                            <label className={styles.confirmLabel}>
                                Để xác nhận xóa tài khoản, vui lòng nhập email của bạn: <span className={styles.emailHighlight}>{formData.email}</span>
                            </label>
                            <input type="text" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} className={styles.confirmInput} placeholder="Nhập email của bạn" />
                        </div>

                        <div className={styles.buttonGroup}>
                            <button onClick={handleDeleteAccount} disabled={deleteConfirm !== formData.email} className={`${styles.button} ${styles.buttonDanger}`} style={{ opacity: deleteConfirm === formData.email ? 1 : 0.5, cursor: deleteConfirm === formData.email ? "pointer" : "not-allowed" }}>
                                Xóa tài khoản vĩnh viễn
                            </button>
                        </div>
                    </div>
                </div>
            }
        </div>
    );
}