import { useState, useEffect } from "react";
import { Database, Download, Trash2, Upload, RefreshCw, Settings, HardDrive } from "lucide-react";
import PageHeader from "../../components/layout/PageHeader";
import styles from "./BackupManagement.module.css";
import axiosInstance from "../../services/axiosInstance";
import { notify } from "../../context/NotificationContext";

function BackupManagement() {
    const [backups, setBackups] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [restoring, setRestoring] = useState(null);
    const [importing, setImporting] = useState(false);
    const [showConfig, setShowConfig] = useState(false);
    const [configForm, setConfigForm] = useState({
        schedule: "0 0 * * *",
        enabled: true,
        retention: 7
    });

    useEffect(() => {
        fetchBackups();
        fetchConfig();
        fetchStats();
    }, []);

    const fetchBackups = async () => {
        setLoading(true);
        try {
            const response = await axiosInstance.get("/api/backups", {
                params: {
                    page: 1,
                    limit: 20,
                    type: "all",
                    source: "all",
                    status: "completed"
                }
            });
            setBackups(response.data.data);
        } finally {
            setLoading(false);
        }
    };

    const fetchConfig = async () => {
        const response = await axiosInstance.get("/api/backups/config");
        setConfigForm({
            schedule: response.data.data.schedule,
            enabled: response.data.data.enabled,
            retention: response.data.data.retention
        });
    };

    const fetchStats = async () => {
        const response = await axiosInstance.get("/api/backups/stats");
        setStats(response.data.data);
    };

    const handleCreateBackup = async (type) => {
        if (creating) return;

        setCreating(true);
        try {
            await axiosInstance.post("/api/backups", { type });
            fetchBackups();
            fetchStats();
        } finally {
            setCreating(false);
        }
    };

    const handleRestore = async (backupId, type) => {
        if (!confirm(`Bạn có chắc muốn restore ${type}? Dữ liệu hiện tại sẽ bị ghi đè!`)) {
            return;
        }

        setRestoring(backupId);
        try {
            await axiosInstance.post("/api/backups/restore", { backupId, type });
        } finally {
            setRestoring(null);
        }
    };

    const handleDelete = async (backupId) => {
        await axiosInstance.delete(`/api/backups/${backupId}`);
        fetchBackups();
        fetchStats();
    };

    const handleImport = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        let type;
        if (file.name.startsWith("mongo")) {
            type = "mongodb";
        } else if (file.name.startsWith("redis")) {
            type = "redis";
        } else {
            type = prompt("Nhập loại backup (mongodb hoặc redis):");
        }

        if (!type || !["mongodb", "redis"].includes(type)) {
            notify({
                type: "error",
                title: "Import thất bại",
                message: "Loại backup không hợp lệ!",
            });
            return;
        }

        setImporting(true);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", type);

        try {
            await axiosInstance.post("/api/backups/import", formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });
            fetchBackups();
            fetchStats();
        } finally {
            setImporting(false);
            e.target.value = "";
        }
    };

    const handleUpdateConfig = async () => {
        await axiosInstance.post("/api/backups/config", configForm);
        fetchConfig();
        setShowConfig(false);
    };

    const formatBytes = (bytes) => {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleString("vi-VN");
    };

    return (
        <>
            <PageHeader title="Quản Lý Backup" />

            <div className={styles.content}>
                {stats && (
                    <div className={styles.statsGrid}>
                        <div className={styles.statCard}>
                            <Database className={styles.statIcon} />
                            <div>
                                <p className={styles.statLabel}>Tổng Backups</p>
                                <p className={styles.statValue}>{stats.totalBackups}</p>
                            </div>
                        </div>
                        <div className={styles.statCard}>
                            <HardDrive className={styles.statIcon} />
                            <div>
                                <p className={styles.statLabel}>Dung Lượng</p>
                                <p className={styles.statValue}>{formatBytes(stats.totalSize)}</p>
                            </div>
                        </div>
                    </div>
                )}

                <div className={styles.actions}>
                    <div className={styles.actionButtons}>
                        <button className={styles.btnPrimary} onClick={() => handleCreateBackup("full")} disabled={creating}>
                            <Database size={18} />
                            {creating ? "Đang tạo..." : "Backup Ngay"}
                        </button>

                        <label className={styles.btnSecondary}>
                            <Upload size={18} />
                            {importing ? "Đang import..." : "Import Backup"}
                            <input type="file" accept=".tar.gz,.tgz" onChange={handleImport} disabled={importing} style={{ display: "none" }} />
                        </label>

                        <button className={styles.btnSecondary} onClick={() => setShowConfig(!showConfig)}>
                            <Settings size={18} />
                            Cấu Hình
                        </button>
                    </div>
                </div>

                {showConfig && (
                    <div className={styles.configPanel}>
                        <h3>Cấu Hình Backup Tự Động</h3>

                        <div className={styles.formGroup}>
                            <label>Lịch Backup (Cron)</label>
                            <input type="text" value={configForm.schedule} onChange={(e) => setConfigForm({ ...configForm, schedule: e.target.value })} className={styles.input} placeholder="0 0 * * *" />
                            <small>Ví dụ: "0 0 * * *" = 00:00 mỗi ngày</small>
                        </div>

                        <div className={styles.formGroup}>
                            <label>Giữ Lại (ngày)</label>
                            <input type="number" value={configForm.retention} onChange={(e) => setConfigForm({ ...configForm, retention: parseInt(e.target.value) })} className={styles.input} min="1" max="365" />
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.checkbox}>
                                <input type="checkbox" checked={configForm.enabled} onChange={(e) => setConfigForm({ ...configForm, enabled: e.target.checked })} />
                                Kích hoạt backup tự động
                            </label>
                        </div>

                        <div className={styles.configActions}>
                            <button onClick={handleUpdateConfig} className={styles.btnPrimary}>
                                Lưu Cấu Hình
                            </button>
                            <button onClick={() => setShowConfig(false)} className={styles.btnSecondary}>
                                Hủy
                            </button>
                        </div>
                    </div>
                )}

                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Loại</th>
                                <th>Tên File</th>
                                <th>Dung Lượng</th>
                                <th>Nguồn</th>
                                <th>Ngày Tạo</th>
                                <th>Thao Tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className={styles.loading}>Đang tải...</td>
                                </tr>
                            ) : backups.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className={styles.empty}>Chưa có backup nào</td>
                                </tr>
                            ) : (
                                backups.map(backup => (
                                    <tr key={backup._id}>
                                        <td>
                                            <span className={`${styles.badge} ${styles[backup.type]}`}>
                                                {backup.type === "mongodb" ? "MongoDB" : "Redis"}
                                            </span>
                                        </td>
                                        <td className={styles.filename}>{backup.filename}</td>
                                        <td>{formatBytes(backup.size)}</td>
                                        <td>
                                            <span className={`${styles.badge} ${styles[backup.source]}`}>
                                                {backup.source === "auto" ? "Tự động" : backup.source === "manual" ? "Thủ công" : "Import"}
                                            </span>
                                        </td>
                                        <td>{formatDate(backup.createdAt)}</td>
                                        <td>
                                            <div className={styles.actionBtns}>
                                                {backup.downloadUrl && (
                                                    <a href={backup.downloadUrl} className={styles.iconBtn} title="Tải xuống" download>
                                                        <Download size={16} />
                                                    </a>
                                                )}

                                                <button className={styles.iconBtn} onClick={() => handleRestore(backup._id, backup.type)} disabled={restoring === backup._id} title="Restore">
                                                    <RefreshCw size={16} />
                                                </button>

                                                <button className={`${styles.iconBtn} ${styles.danger}`} onClick={() => handleDelete(backup._id)} title="Xóa">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}

export default BackupManagement;