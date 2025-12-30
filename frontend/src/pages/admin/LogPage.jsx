import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { User, Search, Clock, CheckCircle, XCircle, Info, Shield, Download, Calendar, AlertTriangle, Code } from "lucide-react";
import styles from "./LogPage.module.css";
import PageHeader from "../../components/layout/PageHeader";
import axiosInstance from "../../services/axiosInstance";

const filter = [
    { id: "all", label: "Tất cả" },
    { id: "success", label: "Success" },
    { id: "error", label: "Error" }
];

function LogPage() {
    const [logs, setLogs] = useState([]);
    const [selectedFilter, setSelectedFilter] = useState("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const loadingRef = useRef(loading);
    const hasMoreRef = useRef(hasMore);
    const observerTarget = useRef(null);
    const socketRef = useRef(null);

    useEffect(() => { loadingRef.current = loading }, [loading]);
    useEffect(() => { hasMoreRef.current = hasMore }, [hasMore]);

    useEffect(() => {
        socketRef.current = io("http://192.168.136.142", {
            path: "/socket.io/",
            transports: ["websocket"],
        });

        return () => {
            socketRef.current.disconnect();
        };
    }, []);

    const fetchData = async (reset = false) => {
        if (loading) return;

        setLoading(true);

        const res = await axiosInstance.get("/api/admin/log", {
            params: {
                page: reset ? 1 : page,
                limit: 20,
                search: searchTerm,
                type: selectedFilter === "all" ? undefined : selectedFilter,
                sortBy: "timestamp",
                sortOrder: "desc",
            },
        });

        const newData = res.data?.data ?? [];
        const pagination = res.data?.pagination;

        if (reset) {
            setLogs(newData);
            setHasMore(pagination?.hasMore);
        } else {
            setLogs(prev => [...prev, ...newData]);
            setHasMore(pagination?.hasMore);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (page === 1) return;
        fetchData(false);
    }, [page]);

    useEffect(() => {
        setPage(1);
        fetchData(true);
    }, [searchTerm, selectedFilter]);

    useEffect(() => {
        const observer = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting) {
                if (!loadingRef.current && hasMoreRef.current) {
                    setPage(prev => prev + 1);
                }
            }
        });

        if (observerTarget.current) {
            observer.observe(observerTarget.current);
        }

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const s = socketRef.current;

        s.on("log:created", (newLog) => {
            setLogs(prev => [newLog, ...prev]);
        });

        return () => {
            s.off("log:created");
        };
    }, []);

    const getLogType = (statusCode) => {
        if (statusCode >= 100 && statusCode < 400) return "success";
        if (statusCode >= 400 && statusCode < 600) return "error";
        return "info";
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString("vi-VN");
    };

    const formatTime = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString("vi-VN");
    };

    const formatTimestamp = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;

        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return "Vừa xong";
        if (minutes < 60) return `${minutes} phút trước`;
        if (hours < 24) return `${hours} giờ trước`;
        if (days < 7) return `${days} ngày trước`;
        return date.toLocaleDateString("vi-VN");
    };

    const getMethodIcon = (method) => {
        const icons = {
            GET: Search,
            POST: CheckCircle,
            PUT: AlertTriangle,
            DELETE: XCircle,
        };
        return icons[method] || Code;
    };

    const getLogTypeClass = (type) => {
        const types = {
            success: "success",
            error: "error"
        };
        return types[type] || "info";
    };

    const getLogIcon = (type) => {
        const icons = {
            success: CheckCircle,
            error: XCircle,
        };
        return icons[type] || Info;
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
        <>
            <PageHeader title="Quản lý Log hệ thống" />
            <div className={styles.content}>
                <div className={styles.sectionHeader}>
                    <div>
                        <h2 className={styles.sectionTitle}>Activity Logs</h2>
                        <p className={styles.sectionSubtitle}>Lịch sử hoạt động hệ thống</p>
                    </div>
                    <div className={styles.sectionActions}>
                        <button className={styles.exportButton}>
                            <Download />
                            Xuất Log
                        </button>
                    </div>
                </div>

                <div className={styles.searchFilterBar}>
                    <div className={styles.searchWrapper}>
                        <Search className={styles.searchIcon} />
                        <input type="text" placeholder="Tìm kiếm logs..." className={styles.searchInput} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                </div>

                <div className={styles.filterTabs}>
                    {filter.map((filter) => (
                        <button key={filter.id} onClick={() => setSelectedFilter(filter.id)} className={`${styles.filterTab} ${selectedFilter === filter.id ? styles.filterTabActive : ""}`}>
                            {filter.label}
                        </button>
                    ))}
                </div>

                <div className={styles.logsTimeline}>
                    {logs.map((log) => {
                        const logType = getLogType(log.statusCode);
                        const LogIcon = getMethodIcon(log.method);
                        const StatusIcon = getLogIcon(logType);

                        return (
                            <div key={log._id} className={`${styles.logItem} ${styles[`logItem${getLogTypeClass(logType).charAt(0).toUpperCase() + getLogTypeClass(logType).slice(1)}`]}`}>
                                <div className={styles.logIconWrapper}>
                                    <div className={`${styles.logIconBg} ${styles[`logIcon${getLogTypeClass(logType).charAt(0).toUpperCase() + getLogTypeClass(logType).slice(1)}`]}`}>
                                        <LogIcon className={styles.logIcon} />
                                    </div>
                                    <div className={styles.logLine} />
                                </div>

                                <div className={styles.logContent}>
                                    <div className={styles.logHeader}>
                                        <div className={styles.logHeaderLeft}>
                                            <StatusIcon className={`${styles.statusIcon} ${styles[`statusIcon${getLogTypeClass(logType).charAt(0).toUpperCase() + getLogTypeClass(logType).slice(1)}`]}`} />
                                            <h4 className={styles.logAction}>
                                                {log.method} {log.endpoint}
                                            </h4>
                                            <span className={`${styles.logType} ${styles[`logType${getLogTypeClass(logType).charAt(0).toUpperCase() + getLogTypeClass(logType).slice(1)}`]}`}>
                                                {log.statusCode}
                                            </span>
                                        </div>
                                        <span className={styles.logTimestamp}>
                                            {formatTimestamp(log.createdAt)}
                                        </span>
                                    </div>

                                    <p className={styles.logDescription}>{log.message}</p>

                                    <div className={styles.logMeta}>
                                        {log.email && (
                                            <div className={styles.logMetaItem}>
                                                <User className={styles.metaIcon} />
                                                <span>{log.email}</span>
                                            </div>
                                        )}
                                        {log.role && (
                                            <div className={styles.logMetaItem}>
                                                <User className={styles.metaIcon} />
                                                <span>{log.role}</span>
                                            </div>
                                        )}
                                        {log.userAgent && (
                                            <div className={styles.logMetaItem}>
                                                <Code className={styles.metaIcon} />
                                                <span>{parseUserAgent(log.userAgent)}</span>
                                            </div>
                                        )}
                                        <div className={styles.logMetaItem}>
                                            <Clock className={styles.metaIcon} />
                                            <span>{formatTime(log.createdAt)}</span>
                                        </div>
                                        <div className={styles.logMetaItem}>
                                            <Calendar className={styles.metaIcon} />
                                            <span>{formatDate(log.createdAt)}</span>
                                        </div>
                                        <div className={styles.logMetaItem}>
                                            <Shield className={styles.metaIcon} />
                                            <span>{log.ipAddress}</span>
                                        </div>
                                    </div>

                                    {log.referrer && (
                                        <div className={styles.logMeta} style={{ marginTop: "8px", opacity: 0.7 }}>
                                            <div className={styles.logMetaItem}>
                                                <Info className={styles.metaIcon} />
                                                <span style={{ fontSize: "0.85em" }}>From: {log.referrer}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {loading && (
                    <div className={styles.loadingContainer}>
                        <div className={styles.spinner}></div>
                        <p className={styles.loadingText}>Đang tải thêm logs...</p>
                    </div>
                )}

                {!loading && !hasMore && logs.length > 0 && (
                    <div className={styles.endMessage}>
                        <div className={styles.endMessageIcon}>✓</div>
                        <p className={styles.endMessageText}>Đã hiển thị tất cả logs</p>
                        <button className={styles.scrollTopBtn} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
                            Về đầu trang
                        </button>
                    </div>
                )}

                {!loading && logs.length === 0 && (
                    <div className={styles.noResults}>
                        <div className={styles.noResultsIcon}>🔍</div>
                        <h3 className={styles.noResultsTitle}>Không tìm thấy log</h3>
                        <p className={styles.noResultsText}>Hãy thử điều chỉnh bộ lọc hoặc từ khóa tìm kiếm</p>
                    </div>
                )}

                <div ref={observerTarget} className={styles.observerTarget}></div>
            </div>
        </>
    );
}

export default LogPage;