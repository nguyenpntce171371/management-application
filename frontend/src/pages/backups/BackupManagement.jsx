import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Database, Trash2, RefreshCw, Settings, HardDrive } from "lucide-react";
import PageHeader from "../../components/layout/PageHeader";
import styles from "./BackupManagement.module.css";
import axiosInstance from "../../services/axiosInstance";
import Pagination from "../../components/common/Pagination";
import { useSocket } from "../../context/SocketContext";

function BackupManagement() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const socket = useSocket();

    const [creating, setCreating] = useState(false);
    const [restoring, setRestoring] = useState(null);

    const [stats, setStats] = useState(null);
    const [showConfig, setShowConfig] = useState(false);
    const [configForm, setConfigForm] = useState({
        schedule: "0 0 * * *",
        enabled: true,
        retention: 7
    });

    const [items, setItems] = useState([]);
    const [cursor, setCursor] = useState(null);
    const [direction, setDirection] = useState("next");
    const [nextCursor, setNextCursor] = useState(null);
    const [prevCursor, setPrevCursor] = useState(null);
    const [hasMore, setHasMore] = useState(false);
    const [hasPrev, setHasPrev] = useState(false);
    const limit = 21;

    const fetchBackups = useCallback(async () => {
        const res = await axiosInstance.get("/api/backups", {
            params: {
                limit,
                cursor,
                direction
            }
        });

        const { data, pagination } = res.data;
        setItems(data || []);
        setHasMore(!!pagination?.hasMore);
        setHasPrev(!!pagination?.hasPrev);
        setNextCursor(pagination?.nextCursor || null);
        setPrevCursor(pagination?.prevCursor || null);
    }, [limit, cursor, direction]);

    const fetchStats = useCallback(async () => {
        const res = await axiosInstance.get("/api/backups/stats");
        setStats(res.data.data);
    }, []);

    const fetchConfig = useCallback(async () => {
        const res = await axiosInstance.get("/api/backups/config");
        setConfigForm(res.data.data);
    }, []);

    const fetchData = useCallback(async () => {
        await Promise.all([fetchBackups(), fetchStats(), fetchConfig()]);
    }, [fetchBackups, fetchStats, fetchConfig]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (!socket) return;

        const refresh = () => fetchData();

        socket.on("backupCreated", refresh);
        socket.on("backupRestored", refresh);
        socket.on("backupDeleted", refresh);
        socket.on("backupUpdated", refresh);

        return () => {
            socket.off("backupCreated", refresh);
            socket.off("backupRestored", refresh);
            socket.off("backupDeleted", refresh);
            socket.off("backupUpdated", refresh);
        };
    }, [socket, fetchData]);

    const updateParams = (newParams) => {
        const params = new URLSearchParams(searchParams);
        Object.entries(newParams).forEach(([key, value]) => {
            if (value === "" || value === "all") params.delete(key);
            else params.set(key, value);
        });
        navigate(`?${params.toString()}`);
    };

    const handleCreateBackup = async (type) => {
        if (creating) return;

        setCreating(true);
        try {
            await axiosInstance.post("/api/backups", { type });
        } finally {
            setCreating(false);
        }
    };

    const handleRestore = async (id, type) => {
        if (restoring) return;
        if (!confirm("Bạn có chắc muốn restore? Dữ liệu hiện tại sẽ bị ghi đè!")) {
            return;
        }

        setRestoring(id);
        try {
            await axiosInstance.post("/api/backups/restore", { id, type });
        } finally {
            setRestoring(null);
        }
    };

    const handleDelete = async (id) => {
        await axiosInstance.delete(`/api/backups/${id}`);
    };

    const handleUpdateConfig = async () => {
        await axiosInstance.post("/api/backups/config", configForm);
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
                            Tạo Backup
                        </button>

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
                            <label>Giữ Lại (bản)</label>
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
                            {(items ?? []).map((backup) => (
                                <tr key={backup.id}>
                                    <td>
                                        <span className={`${styles.badge} ${styles[backup.type]}`}>
                                            {backup.type === "mongodb" ? "MongoDB" : "Redis"}
                                        </span>
                                    </td>
                                    <td className={styles.filename}>{backup.filename}</td>
                                    <td>{formatBytes(backup.size)}</td>
                                    <td>
                                        <span className={`${styles.badge} ${styles[backup.source]}`}>
                                            {backup.source === "auto" ? "Tự động" : "Thủ công"}
                                        </span>
                                    </td>
                                    <td>{formatDate(backup.createdAt)}</td>
                                    <td>
                                        <div className={styles.actionBtns}>
                                            <button className={styles.iconBtn} onClick={() => handleRestore(backup.id, backup.type)} disabled={restoring === backup.id} title="Restore">
                                                <RefreshCw size={16} />
                                            </button>

                                            <button className={`${styles.iconBtn} ${styles.danger}`} onClick={() => handleDelete(backup.id)} title="Xóa">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <Pagination prevCursor={prevCursor} nextCursor={nextCursor} hasPrev={hasPrev} hasMore={hasMore} setCursor={setCursor} setDirection={setDirection} />
            </div>
        </>
    );
}

export default BackupManagement;